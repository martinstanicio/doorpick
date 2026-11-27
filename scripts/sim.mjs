import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import QRCode from 'qrcode';
import sql from 'mssql';

const STYLES = ['D3L', 'D4K', 'S1X', 'D5M'];

function parseArgs(argv) {
  const opts = { interval: 15, port: 4000, maxPending: 20, help: false };
  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') opts.help = true;
    else if (arg.startsWith('--interval=')) opts.interval = Math.max(2, Number(arg.split('=')[1]) || 15);
    else if (arg.startsWith('--port=')) opts.port = Number(arg.split('=')[1]) || 4000;
    else if (arg.startsWith('--max-pending=')) opts.maxPending = Math.max(4, Number(arg.split('=')[1]) || 20);
  }
  return opts;
}

function loadDbUrl() {
  if (process.env.DB_URL) return process.env.DB_URL.trim();
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    throw new Error('No se encontró .env ni variable DB_URL.');
  }
  const content = fs.readFileSync(envPath, 'utf8');
  const match = content.match(/^DB_URL=(.+)$/m);
  if (!match) throw new Error('No se encontró DB_URL en .env.');
  return match[1].trim().replace(/^["']|["']$/g, '');
}

function parseDbConfig(dbUrl) {
  let config = sql.ConnectionPool.parseConnectionString(dbUrl);
  if (!config.server) {
    const parsed = new URL(dbUrl);
    config = {
      server: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : undefined,
      user: parsed.username ? decodeURIComponent(parsed.username) : undefined,
      password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
      database: parsed.pathname.replace(/^\//, '') || undefined,
      options: {},
    };
  }
  config.options = config.options ?? {};
  if (config.options.useUTC === undefined) config.options.useUTC = false;
  return config;
}

function formatLocalDateTime(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

async function toQrSvg(text) {
  return QRCode.toString(text, {
    type: 'svg',
    margin: 4,
    width: 150,
    errorCorrectionLevel: 'M',
  });
}

function buildInvalidCases(activeA, activeB) {
  const ref = activeA ?? activeB;
  if (!ref) {
    return [
      { label: 'ID INEXISTENTE', qr: '99999|104|D3L|FR|LH' },
      { label: 'QR MALFORMADO', qr: 'QR-INVALIDO|123' },
    ];
  }
  const wrongPos = ref.posicion === 'FR' ? 'RR' : 'FR';
  const wrongMano = ref.mano === 'LH' ? 'RH' : 'LH';
  const wrongSeq = ref.secuencia === 999 ? 998 : 999;

  return [
    {
      label: `ID_OrdenProduccion INCORRECTO (vs #${ref.idOrdenProduccion})`,
      qr: `99999|${ref.secuencia}|${ref.sd}|${ref.posicion}|${ref.mano}`,
    },
    {
      label: `SECUENCIA INCORRECTA (vs SEQ ${ref.secuencia})`,
      qr: `${ref.idOrdenProduccion}|${wrongSeq}|${ref.sd}|${ref.posicion}|${ref.mano}`,
    },
    {
      label: `ESTILO SD INCORRECTO (vs ${ref.sd})`,
      qr: `${ref.idOrdenProduccion}|${ref.secuencia}|ERR|${ref.posicion}|${ref.mano}`,
    },
    {
      label: `PANEL EQUIVOCADO (vs ${ref.codigoPanel})`,
      qr: `${ref.idOrdenProduccion}|${ref.secuencia}|${ref.sd}|${wrongPos}|${wrongMano}`,
    },
    {
      label: 'QR MALFORMADO',
      qr: 'QR-INVALIDO|123',
    },
  ];
}

const HTML_PAGE = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>DoorPick — Simulador en Vivo</title>
  <style>
    * { box-sizing: border-box; border-radius: 0; }
    body { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; background: #fff; color: #000; margin: 0; padding: 20px; }
    header { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 12px; border-bottom: 3px solid #000; padding-bottom: 12px; margin-bottom: 18px; }
    h1 { margin: 0; font-size: 20px; letter-spacing: 0.04em; }
    .controls { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
    button { font-family: inherit; font-weight: 700; font-size: 12px; padding: 8px 12px; border: 2px solid #000; background: #fff; color: #000; cursor: pointer; text-transform: uppercase; }
    button:hover { background: #000; color: #fff; }
    button.primary { background: #000; color: #fff; }
    .pill { border: 2px solid #000; padding: 6px 10px; font-size: 12px; font-weight: 700; }
    h2 { font-size: 14px; margin: 20px 0 10px; background: #000; color: #fff; padding: 6px 10px; text-transform: uppercase; }
    h2.alert { background: #CC0000; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 12px; }
    .card { border: 2px solid #000; padding: 10px; display: flex; flex-direction: column; align-items: center; gap: 8px; background: #fff; }
    .card.active { border-width: 4px; }
    .card.stock { background: #FFE600; }
    .card.invalid { background: #fee2e2; border-color: #CC0000; }
    .card-head { width: 100%; display: flex; justify-content: space-between; align-items: center; font-size: 12px; font-weight: 700; gap: 6px; }
    .badge { padding: 2px 6px; font-size: 10px; border: 1px solid #000; background: #fff; color: #000; }
    .card.stock .badge { background: #000; color: #FFE600; }
    .card.invalid .badge { background: #CC0000; color: #fff; border-color: #CC0000; }
    .qr-box { background: #fff; padding: 4px; border: 1px solid #000; line-height: 0; }
    .qr-text { font-size: 11px; font-weight: 700; word-break: break-all; text-align: center; }
    .empty { font-size: 13px; padding: 12px; border: 2px dashed #000; }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>DOORPICK — SIMULADOR EN VIVO</h1>
      <div id="meta" style="font-size:12px;margin-top:4px;">Cargando...</div>
    </div>
    <div class="controls">
      <span id="status-pill" class="pill">AUTO: ...</span>
      <button class="primary" onclick="insertNow()">+ Insertar Secuencia</button>
      <button id="toggle-btn" onclick="toggleAuto()">Pausar / Reanudar</button>
    </div>
  </header>
  <div id="error-bar" style="display:none;background:#CC0000;color:#fff;padding:10px 12px;font-weight:700;font-size:13px;margin-bottom:14px;border:2px solid #000;"></div>

  <h2>Línea A — Próximos Paneles (<span id="count-a">0</span>)</h2>
  <div id="grid-a" class="grid"></div>

  <h2>Línea B — Próximos Paneles (<span id="count-b">0</span>)</h2>
  <div id="grid-b" class="grid"></div>

  <h2 class="alert">QRs Incorrectos (Prueba de Alerta Roja)</h2>
  <div id="grid-invalid" class="grid"></div>

  <script>
    function renderCards(el, items, emptyText) {
      if (!items.length) {
        el.innerHTML = '<div class="empty">' + emptyText + '</div>';
        return;
      }
      el.innerHTML = items.map((item, idx) => {
        const cls = ['card', idx === 0 ? 'active' : '', item.ubicacion === 'STOCK' ? 'stock' : ''].filter(Boolean).join(' ');
        const tag = idx === 0 ? 'ACTIVO · ' : '#' + (idx + 1) + ' · ';
        return '<div class="' + cls + '">' +
          '<div class="card-head"><span>' + tag + 'SEQ ' + item.secuencia + ' · ' + item.codigoPanel + '</span><span class="badge">' + item.ubicacion + '</span></div>' +
          '<div class="qr-box">' + item.svg + '</div>' +
          '<div class="qr-text">' + item.qr + '</div>' +
        '</div>';
      }).join('');
    }

    function renderInvalid(el, items) {
      el.innerHTML = items.map((item) => {
        return '<div class="card invalid">' +
          '<div class="card-head"><span>' + item.label + '</span><span class="badge">ALERTA</span></div>' +
          '<div class="qr-box">' + item.svg + '</div>' +
          '<div class="qr-text">' + item.qr + '</div>' +
        '</div>';
      }).join('');
    }

    async function refresh() {
      try {
        const res = await fetch('/api/qrs', { cache: 'no-store' });
        const data = await res.json();
        document.getElementById('meta').textContent =
          'Pendientes totales en DL01: ' + data.totalPending + ' / máx auto: ' + data.maxPending + ' · Intervalo: ' + data.interval + 's';
        document.getElementById('status-pill').textContent = data.autoEnabled ? 'AUTO: ACTIVO' : 'AUTO: PAUSADO';
        document.getElementById('toggle-btn').textContent = data.autoEnabled ? 'Pausar Auto' : 'Reanudar Auto';
        document.getElementById('count-a').textContent = data.lineA.length;
        document.getElementById('count-b').textContent = data.lineB.length;
        renderCards(document.getElementById('grid-a'), data.lineA, 'Sin paneles pendientes en Línea A');
        renderCards(document.getElementById('grid-b'), data.lineB, 'Sin paneles pendientes en Línea B');
        renderInvalid(document.getElementById('grid-invalid'), data.invalid);
      } catch (err) {
        document.getElementById('meta').textContent = 'Error consultando /api/qrs';
      }
    }

    async function insertNow() {
      const errBar = document.getElementById('error-bar');
      try {
        const res = await fetch('/api/insert', { method: 'POST' });
        const data = await res.json();
        if (!res.ok) {
          errBar.textContent = 'ERROR AL INSERTAR: ' + (data.error || res.status);
          errBar.style.display = 'block';
          return;
        }
        errBar.style.display = 'none';
        await refresh();
      } catch (err) {
        errBar.textContent = 'ERROR DE CONEXIÓN AL INSERTAR';
        errBar.style.display = 'block';
      }
    }

    async function toggleAuto() {
      await fetch('/api/toggle', { method: 'POST' });
      await refresh();
    }

    refresh();
    setInterval(refresh, 2000);
  </script>
</body>
</html>`;

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log('Uso: npm run sim [-- --interval=15 --port=4000 --max-pending=20]');
    process.exit(0);
  }

  const dbUrl = loadDbUrl();
  const pool = await new sql.ConnectionPool(parseDbConfig(dbUrl)).connect();

  const tablesRes = await pool.request().query(`
    SELECT
      OBJECT_ID(N'[dbo].[Orden_Produccion]', N'U') AS opId,
      OBJECT_ID(N'[dbo].[DoorPick]', N'U') AS dpId
  `);
  const { opId, dpId } = tablesRes.recordset[0];
  if (!opId || !dpId) {
    console.error('Faltan tablas dbo.Orden_Produccion o dbo.DoorPick. Ejecutá primero db/init.sql.');
    await pool.close();
    process.exit(1);
  }

  const colRes = await pool.request().query(`
    SELECT 1 AS hasCol
    FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[Orden_Produccion]')
      AND name = N'ID_OrdenCliente'
  `);
  const hasOrdenCliente = colRes.recordset.length > 0;
  let nextOrdenCliente = 1001;
  if (hasOrdenCliente) {
    const maxClienteRes = await pool.request().query(`
      SELECT ISNULL(MAX([ID_OrdenCliente]), 1000) AS maxCliente FROM [dbo].[Orden_Produccion]
    `);
    nextOrdenCliente = Number(maxClienteRes.recordset[0].maxCliente) + 1;
  }

  const seqRes = await pool.request().query(`
    SELECT TOP 1 [Secuencia]
    FROM [dbo].[Orden_Produccion]
    WHERE [Puesto] = 'DL01'
    ORDER BY [Fecha_Proceso] DESC, [ID_OrdenProduccion] DESC
  `);
  const lastSeq = seqRes.recordset[0]?.Secuencia ?? 100;
  let nextSeq = (Number(lastSeq) % 999) + 1;
  let autoEnabled = true;

  async function countPending() {
    const cfgRes = await pool.request().query(`
      SELECT TOP 1 [Fecha_Inicio_Evaluacion]
      FROM [dbo].[DoorPick]
      ORDER BY [Fecha_Actualizacion] DESC, [ID_DoorPick] DESC
    `);
    const fechaInicio = cfgRes.recordset[0]?.Fecha_Inicio_Evaluacion;
    const req = pool.request();
    let filter = '';
    if (fechaInicio) {
      req.input('fechaInicio', sql.DateTime2(0), fechaInicio);
      filter = 'AND [Fecha_Proceso] > @fechaInicio';
    }
    const res = await req.query(`
      SELECT COUNT(*) AS total
      FROM [dbo].[Orden_Produccion]
      WHERE [Puesto] = 'DL01'
        ${filter}
        AND [Estado] IN (0, 1)
    `);
    return res.recordset[0].total;
  }

  async function insertSequence() {
    const seq = nextSeq;
    nextSeq = (nextSeq % 999) + 1;
    const ordenCliente = hasOrdenCliente ? nextOrdenCliente++ : null;

    const sd = STYLES[Math.floor(Math.random() * STYLES.length)];
    const isDouble = Math.random() < 0.7;
    const isAllStock = Math.random() < 0.2;
    const now = new Date();
    const later = new Date(now.getTime() + 1000);

    const rows = [
      { pos: 'FR', mano: 'LH', fecha: formatLocalDateTime(now), estado: isAllStock || Math.random() < 0.2 ? 1 : 0 },
      { pos: 'FR', mano: 'RH', fecha: formatLocalDateTime(now), estado: isAllStock || Math.random() < 0.2 ? 1 : 0 },
    ];
    if (isDouble) {
      rows.push(
        { pos: 'RR', mano: 'LH', fecha: formatLocalDateTime(later), estado: isAllStock || Math.random() < 0.2 ? 1 : 0 },
        { pos: 'RR', mano: 'RH', fecha: formatLocalDateTime(later), estado: isAllStock || Math.random() < 0.2 ? 1 : 0 },
      );
    }

    const inserted = [];
    for (const r of rows) {
      const req = pool
        .request()
        .input('sec', sql.Int, seq)
        .input('fecha', sql.VarChar(19), r.fecha)
        .input('sd', sql.VarChar(20), sd)
        .input('estado', sql.Int, r.estado)
        .input('mano', sql.VarChar(10), r.mano)
        .input('pos', sql.VarChar(10), r.pos);
      if (hasOrdenCliente) {
        req.input('ordenCliente', sql.Int, ordenCliente);
      }

      const res = await req.query(
        hasOrdenCliente
          ? `
            INSERT INTO [dbo].[Orden_Produccion] ([ID_OrdenCliente], [Secuencia], [Fecha_Proceso], [SD], [Puesto], [Estado], [Mano], [Posicion])
            OUTPUT INSERTED.[ID_OrdenProduccion]
            VALUES (@ordenCliente, @sec, CAST(@fecha AS DATETIME), @sd, 'DL01', @estado, @mano, @pos);
          `
          : `
            INSERT INTO [dbo].[Orden_Produccion] ([Secuencia], [Fecha_Proceso], [SD], [Puesto], [Estado], [Mano], [Posicion])
            OUTPUT INSERTED.[ID_OrdenProduccion]
            VALUES (@sec, CAST(@fecha AS DATETIME), @sd, 'DL01', @estado, @mano, @pos);
          `,
      );
      const id = res.recordset[0].ID_OrdenProduccion;
      const qr = `${id}|${seq}|${sd}|${r.pos}|${r.mano}`;
      inserted.push({ id, seq, sd, pos: r.pos, mano: r.mano, estado: r.estado, qr });
    }

    console.log(
      `[SIM] +SEQ ${seq} (${sd}, ${isDouble ? 'doble' : 'simple'}): ${inserted.map((x) => `${x.qr} [${x.estado === 1 ? 'STOCK' : 'DOBLADORA'}]`).join(' | ')}`,
    );
    return inserted;
  }

  async function getQrPayload() {
    const cfgRes = await pool.request().query(`
      SELECT TOP 1 [Fecha_Inicio_Evaluacion], [FRLH], [FRRH], [RRLH], [RRRH]
      FROM [dbo].[DoorPick]
      ORDER BY [Fecha_Actualizacion] DESC, [ID_DoorPick] DESC
    `);
    const cfg = cfgRes.recordset[0];
    const pendingRes = await pool
      .request()
      .input('fechaInicio', sql.DateTime2(0), cfg.Fecha_Inicio_Evaluacion)
      .query(`
        SELECT [ID_OrdenProduccion], [Secuencia], [SD], [Estado], [Mano], [Posicion]
        FROM [dbo].[Orden_Produccion]
        WHERE [Puesto] = 'DL01'
          AND [Fecha_Proceso] > @fechaInicio
          AND [Estado] IN (0, 1)
        ORDER BY [Fecha_Proceso] ASC,
          [Posicion] ASC,
          [Mano] ASC,
          [ID_OrdenProduccion] ASC
      `);

    const all = await Promise.all(
      pendingRes.recordset.map(async (row) => {
        const posicion = String(row.Posicion).trim();
        const mano = String(row.Mano).trim();
        const sd = String(row.SD).trim();
        const codigoPanel = `${posicion}${mano}`;
        const qr = `${row.ID_OrdenProduccion}|${row.Secuencia}|${sd}|${posicion}|${mano}`;
        return {
          idOrdenProduccion: row.ID_OrdenProduccion,
          secuencia: row.Secuencia,
          sd,
          posicion,
          mano,
          codigoPanel,
          ubicacion: row.Estado === 1 ? 'STOCK' : 'DOBLADORA',
          line: cfg[codigoPanel] ?? null,
          qr,
          svg: await toQrSvg(qr),
        };
      }),
    );

    const lineA = all.filter((p) => p.line === 'A').slice(0, 8);
    const lineB = all.filter((p) => p.line === 'B').slice(0, 8);
    const invalidRaw = buildInvalidCases(lineA[0] ?? null, lineB[0] ?? null);
    const invalid = await Promise.all(
      invalidRaw.map(async (c) => ({ ...c, svg: await toQrSvg(c.qr) })),
    );

    return {
      totalPending: all.length,
      maxPending: opts.maxPending,
      interval: opts.interval,
      autoEnabled,
      lineA,
      lineB,
      invalid,
    };
  }

  if ((await countPending()) < 4) {
    await insertSequence();
  }

  const timer = setInterval(async () => {
    if (!autoEnabled) return;
    try {
      const total = await countPending();
      if (total < opts.maxPending) {
        await insertSequence();
      }
    } catch (err) {
      console.error('[SIM] Error insertando secuencia:', err.message ?? err);
    }
  }, opts.interval * 1000);

  const server = http.createServer(async (req, res) => {
    try {
      if (req.method === 'GET' && req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(HTML_PAGE);
      } else if (req.method === 'GET' && req.url === '/api/qrs') {
        const payload = await getQrPayload();
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(payload));
      } else if (req.method === 'POST' && req.url === '/api/insert') {
        const inserted = await insertSequence();
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ inserted }));
      } else if (req.method === 'POST' && req.url === '/api/toggle') {
        autoEnabled = !autoEnabled;
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ autoEnabled }));
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    } catch (err) {
      console.error('[SIM] Error en request:', err.message ?? err);
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: err.message ?? 'Internal error' }));
    }
  });

  server.listen(opts.port, () => {
    console.log(`[SIM] Simulador DoorPick activo:`);
    console.log(`      Panel de QRs en vivo: http://localhost:${opts.port}`);
    console.log(`      Inserción automática cada ${opts.interval}s (máx ${opts.maxPending} pendientes)`);
    console.log(`      Presioná Ctrl+C para detener.`);
  });

  const shutdown = async () => {
    clearInterval(timer);
    server.close();
    await pool.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[SIM] Error fatal:', err.message ?? err);
  process.exit(1);
});
