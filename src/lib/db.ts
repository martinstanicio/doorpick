import sql from 'mssql';
import { formatLocalDateTime } from './qr';

declare global {
  var __doorpickPool: Promise<sql.ConnectionPool> | undefined;
}

function parseDbConfig(dbUrl: string): sql.config {
  let config: sql.config;
  try {
    config = sql.ConnectionPool.parseConnectionString(dbUrl);
  } catch {
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
  if (config.options.useUTC === undefined) {
    config.options.useUTC = false;
  }

  return config;
}

export async function ensureDoorPickSchema(
  pool: sql.ConnectionPool
): Promise<void> {
  await pool.request().query(`
    IF OBJECT_ID(N'[dbo].[DoorPick]', N'U') IS NULL
    BEGIN
      CREATE TABLE [dbo].[DoorPick] (
        [ID_DoorPick] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [Fecha_Inicio_Evaluacion] DATETIME2(0) NOT NULL,
        [FRLH] CHAR(1) NULL CONSTRAINT [CK_DoorPick_FRLH] CHECK ([FRLH] IN ('A', 'B')),
        [FRRH] CHAR(1) NULL CONSTRAINT [CK_DoorPick_FRRH] CHECK ([FRRH] IN ('A', 'B')),
        [RRLH] CHAR(1) NULL CONSTRAINT [CK_DoorPick_RRLH] CHECK ([RRLH] IN ('A', 'B')),
        [RRRH] CHAR(1) NULL CONSTRAINT [CK_DoorPick_RRRH] CHECK ([RRRH] IN ('A', 'B')),
        [Segundos_Panel_Correcto] INT NOT NULL CONSTRAINT [DF_DoorPick_SegundosPanelCorrecto] DEFAULT ((10)) CONSTRAINT [CK_DoorPick_SegundosPanelCorrecto] CHECK ([Segundos_Panel_Correcto] >= 1 AND [Segundos_Panel_Correcto] <= 300),
        [Fecha_Actualizacion] DATETIME2(0) NOT NULL CONSTRAINT [DF_DoorPick_FechaActualizacion] DEFAULT SYSDATETIME()
      );
    END

    IF NOT EXISTS (
      SELECT 1
      FROM sys.indexes
      WHERE name = N'IX_DoorPick_FechaActualizacion'
        AND object_id = OBJECT_ID(N'[dbo].[DoorPick]')
    )
    BEGIN
      CREATE INDEX [IX_DoorPick_FechaActualizacion]
        ON [dbo].[DoorPick] ([Fecha_Actualizacion] DESC, [ID_DoorPick] DESC);
    END
  `);

  const now = new Date();
  const todayMidnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0
  );
  const defaultFecha = formatLocalDateTime(todayMidnight);

  await pool
    .request()
    .input('fechaInicio', sql.VarChar(19), defaultFecha)
    .query(`
      IF NOT EXISTS (SELECT 1 FROM [dbo].[DoorPick])
      BEGIN
        INSERT INTO [dbo].[DoorPick] (
          [Fecha_Inicio_Evaluacion],
          [FRLH],
          [FRRH],
          [RRLH],
          [RRRH]
        )
        VALUES (
          CAST(@fechaInicio AS DATETIME2(0)),
          'A',
          'B',
          'B',
          'A'
        );
      END
    `);
}

export function getPool(): Promise<sql.ConnectionPool> {
  if (!globalThis.__doorpickPool) {
    const dbUrl = process.env.DB_URL;
    if (!dbUrl || dbUrl.trim().length === 0) {
      throw new Error(
        'Missing DB_URL environment variable. Please configure DB_URL to connect to SQL Server.'
      );
    }

    const config = parseDbConfig(dbUrl);
    globalThis.__doorpickPool = new sql.ConnectionPool(config)
      .connect()
      .then(async (pool) => {
        await ensureDoorPickSchema(pool);
        return pool;
      })
      .catch((err) => {
        globalThis.__doorpickPool = undefined;
        throw err;
      });
  }

  return globalThis.__doorpickPool;
}
