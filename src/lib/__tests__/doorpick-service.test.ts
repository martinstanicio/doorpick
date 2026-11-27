import { beforeEach, describe, expect, it } from 'vitest';
import { DoorPickRepository } from '../doorpick-repository';
import { createDoorPickService } from '../doorpick-service';
import { splitPanelCode } from '../qr';
import {
  DoorPickConfig,
  DoorPickConfigInput,
  PANEL_CODES,
  PanelCode,
  PanelItem,
  PanelStatusCode,
} from '../types';

interface InMemoryOrdenRow {
  idOrdenProduccion: number;
  puesto: string;
  secuencia: number;
  fechaProceso: string;
  sd: string;
  estado: PanelStatusCode;
  mano: 'LH' | 'RH';
  posicion: 'FR' | 'RR';
}

interface InMemoryConfigRow {
  idDoorPick: number;
  fechaInicioEvaluacion: string;
  assignments: Record<PanelCode, 'A' | 'B' | null>;
  segundosPanelCorrecto: number;
  fechaActualizacion: string;
}

class InMemoryDoorPickRepository implements DoorPickRepository {
  public configs: InMemoryConfigRow[] = [];
  public ordenes: InMemoryOrdenRow[] = [];
  private nextConfigId = 1;
  private configTick = 0;

  seedConfig(
    input: DoorPickConfigInput,
    fechaActualizacion?: string
  ): InMemoryConfigRow {
    this.configTick += 1;
    const row: InMemoryConfigRow = {
      idDoorPick: this.nextConfigId++,
      fechaInicioEvaluacion: input.fechaInicioEvaluacion,
      assignments: { ...input.assignments },
      segundosPanelCorrecto: input.segundosPanelCorrecto,
      fechaActualizacion:
        fechaActualizacion ??
        `2026-11-27T07:00:${String(this.configTick).padStart(2, '0')}`,
    };
    this.configs.push(row);
    return row;
  }

  seedOrden(row: InMemoryOrdenRow): void {
    this.ordenes.push({ ...row });
  }

  async getLatestConfig(): Promise<DoorPickConfig> {
    if (this.configs.length === 0) {
      throw new Error('No se encontró configuración en [dbo].[DoorPick].');
    }
    const sorted = [...this.configs].sort((a, b) => {
      const cmp = b.fechaActualizacion.localeCompare(a.fechaActualizacion);
      if (cmp !== 0) return cmp;
      return b.idDoorPick - a.idDoorPick;
    });
    const latest = sorted[0];
    return {
      idDoorPick: latest.idDoorPick,
      fechaInicioEvaluacion: latest.fechaInicioEvaluacion,
      assignments: { ...latest.assignments },
      segundosPanelCorrecto: latest.segundosPanelCorrecto,
      fechaActualizacion: latest.fechaActualizacion,
    };
  }

  async insertConfig(input: DoorPickConfigInput): Promise<DoorPickConfig> {
    const row = this.seedConfig(input);
    return {
      idDoorPick: row.idDoorPick,
      fechaInicioEvaluacion: row.fechaInicioEvaluacion,
      assignments: { ...row.assignments },
      segundosPanelCorrecto: row.segundosPanelCorrecto,
      fechaActualizacion: row.fechaActualizacion,
    };
  }

  async getPendingPanels(
    fechaInicio: string,
    panelCodes: PanelCode[],
    limit?: number
  ): Promise<PanelItem[]> {
    if (panelCodes.length === 0 || (limit !== undefined && limit <= 0)) {
      return [];
    }
    const allowed = new Set(panelCodes);

    const sorted = this.ordenes
      .filter((row) => {
        const code = `${row.posicion}${row.mano}` as PanelCode;
        return (
          (row.puesto === 'DL01' || row.puesto === 'DR01') &&
          row.fechaProceso > fechaInicio &&
          (row.estado === 0 || row.estado === 1) &&
          allowed.has(code)
        );
      })
      .sort((a, b) => {
        const dateCmp = a.fechaProceso.localeCompare(b.fechaProceso);
        if (dateCmp !== 0) return dateCmp;
        const posA = a.posicion === 'FR' ? 0 : 1;
        const posB = b.posicion === 'FR' ? 0 : 1;
        if (posA !== posB) return posA - posB;
        const manoCmp = a.mano.localeCompare(b.mano);
        if (manoCmp !== 0) return manoCmp;
        return a.idOrdenProduccion - b.idOrdenProduccion;
      });

    const filtered = limit !== undefined ? sorted.slice(0, limit) : sorted;

    return filtered.map((row) => ({
      idOrdenProduccion: row.idOrdenProduccion,
      secuencia: row.secuencia,
      fechaProceso: row.fechaProceso,
      sd: row.sd,
      estado: row.estado,
      mano: row.mano,
      posicion: row.posicion,
      codigoPanel: `${row.posicion}${row.mano}` as PanelCode,
      ubicacion: row.estado === 1 ? 'STOCK' : 'DOBLADORA',
    }));
  }

  async markPanelProcessed(
    idOrdenProduccion: number,
    expectedEstado: 0 | 1,
    nextEstado: 2 | 3
  ): Promise<boolean> {
    const row = this.ordenes.find(
      (o) =>
        o.idOrdenProduccion === idOrdenProduccion && o.estado === expectedEstado
    );
    if (!row) {
      return false;
    }
    row.estado = nextEstado;
    return true;
  }
}

describe('doorPickService', () => {
  let repo: InMemoryDoorPickRepository;
  let service: ReturnType<typeof createDoorPickService>;

  beforeEach(() => {
    repo = new InMemoryDoorPickRepository();
    repo.seedConfig({
      fechaInicioEvaluacion: '2026-11-27T08:00:00',
      assignments: {
        FRLH: 'A',
        FRRH: 'A',
        RRLH: 'B',
        RRRH: 'B',
      },
      segundosPanelCorrecto: 10,
    });
    service = createDoorPickService(repo);
  });

  describe('getQueueForLine', () => {
    it('filters by Puesto IN (DL01, DR01), Fecha_Proceso > Fecha_Inicio_Evaluacion, and Estado IN (0, 1)', async () => {
      repo.seedOrden({
        idOrdenProduccion: 1,
        puesto: 'DL02',
        secuencia: 10,
        fechaProceso: '2026-11-27T08:05:00',
        sd: 'SD-1',
        estado: 0,
        posicion: 'FR',
        mano: 'LH',
      });
      repo.seedOrden({
        idOrdenProduccion: 5,
        puesto: 'DR02',
        secuencia: 10,
        fechaProceso: '2026-11-27T08:05:00',
        sd: 'SD-5',
        estado: 0,
        posicion: 'FR',
        mano: 'RH',
      });
      repo.seedOrden({
        idOrdenProduccion: 2,
        puesto: 'DL01',
        secuencia: 11,
        fechaProceso: '2026-11-27T08:00:00', // equal, not strictly greater
        sd: 'SD-2',
        estado: 0,
        posicion: 'FR',
        mano: 'LH',
      });
      repo.seedOrden({
        idOrdenProduccion: 3,
        puesto: 'DL01',
        secuencia: 12,
        fechaProceso: '2026-11-27T08:05:00',
        sd: 'SD-3',
        estado: 2, // already processed
        posicion: 'FR',
        mano: 'LH',
      });
      repo.seedOrden({
        idOrdenProduccion: 4,
        puesto: 'DL01',
        secuencia: 13,
        fechaProceso: '2026-11-27T08:05:00',
        sd: 'SD-4',
        estado: 0,
        posicion: 'FR',
        mano: 'LH',
      });
      repo.seedOrden({
        idOrdenProduccion: 6,
        puesto: 'DR01',
        secuencia: 14,
        fechaProceso: '2026-11-27T08:06:00',
        sd: 'SD-6',
        estado: 1,
        posicion: 'FR',
        mano: 'RH',
      });

      const queue = await service.getQueueForLine('A');
      expect(queue.panels.map((p) => p.idOrdenProduccion)).toEqual([4, 6]);
      expect(queue.panels[0].ubicacion).toBe('DOBLADORA');
      expect(queue.panels[1].ubicacion).toBe('STOCK');
    });

    it('orders by Fecha_Proceso ASC (handling 999 -> 1 secuencia wrap-around) and FR before RR tie-breaker', async () => {
      // Secuencia 999 at 08:01:00 should come before Secuencia 1 at 08:02:00
      repo.seedOrden({
        idOrdenProduccion: 10,
        puesto: 'DL01',
        secuencia: 1,
        fechaProceso: '2026-11-27T08:02:00',
        sd: 'SD-WRAP-1',
        estado: 1,
        posicion: 'FR',
        mano: 'LH',
      });
      repo.seedOrden({
        idOrdenProduccion: 11,
        puesto: 'DL01',
        secuencia: 999,
        fechaProceso: '2026-11-27T08:01:00',
        sd: 'SD-WRAP-999',
        estado: 0,
        posicion: 'FR',
        mano: 'LH',
      });

      // Tie-breaker at 08:03:00: FR before RR
      repo.seedConfig({
        fechaInicioEvaluacion: '2026-11-27T08:00:00',
        assignments: { FRLH: 'A', FRRH: 'A', RRLH: 'A', RRRH: 'A' },
        segundosPanelCorrecto: 10,
      });
      repo.seedOrden({
        idOrdenProduccion: 12,
        puesto: 'DL01',
        secuencia: 2,
        fechaProceso: '2026-11-27T08:03:00',
        sd: 'SD-RR',
        estado: 0,
        posicion: 'RR',
        mano: 'LH',
      });
      repo.seedOrden({
        idOrdenProduccion: 13,
        puesto: 'DL01',
        secuencia: 3,
        fechaProceso: '2026-11-27T08:03:00',
        sd: 'SD-FR',
        estado: 1,
        posicion: 'FR',
        mano: 'RH',
      });

      const queue = await service.getQueueForLine('A');
      expect(queue.panels.map((p) => p.idOrdenProduccion)).toEqual([11, 10, 13, 12]);
      expect(queue.panels[0].ubicacion).toBe('DOBLADORA');
      expect(queue.panels[1].ubicacion).toBe('STOCK');
    });

    it('returns all pending items by default and respects explicit limit', async () => {
      for (let i = 1; i <= 7; i++) {
        repo.seedOrden({
          idOrdenProduccion: 100 + i,
          puesto: 'DL01',
          secuencia: i,
          fechaProceso: `2026-11-27T08:0${i}:00`,
          sd: `SD-${i}`,
          estado: 0,
          posicion: 'FR',
          mano: 'LH',
        });
      }
      const queue = await service.getQueueForLine('A');
      expect(queue.panels).toHaveLength(7);
      expect(queue.panels.map((p) => p.idOrdenProduccion)).toEqual([101, 102, 103, 104, 105, 106, 107]);

      const limited = await service.getQueueForLine('A', 3);
      expect(limited.panels.map((p) => p.idOrdenProduccion)).toEqual([101, 102, 103]);
    });

    it('uses latest historical row from dbo.DoorPick overriding older rows', async () => {
      repo.seedOrden({
        idOrdenProduccion: 201,
        puesto: 'DL01',
        secuencia: 1,
        fechaProceso: '2026-11-27T08:05:00',
        sd: 'SD-201',
        estado: 0,
        posicion: 'FR',
        mano: 'LH',
      });
      repo.seedOrden({
        idOrdenProduccion: 202,
        puesto: 'DL01',
        secuencia: 2,
        fechaProceso: '2026-11-27T08:06:00',
        sd: 'SD-202',
        estado: 0,
        posicion: 'RR',
        mano: 'RH',
      });

      // Initially FRLH is on A, RRRH is on B
      expect((await service.getQueueForLine('A')).panels.map((p) => p.codigoPanel)).toEqual(['FRLH']);

      // New config moves FRLH to B and RRRH to A
      await service.saveConfig({
        fechaInicioEvaluacion: '2026-11-27T08:00:00',
        assignments: { FRLH: 'B', FRRH: null, RRLH: null, RRRH: 'A' },
        segundosPanelCorrecto: 10,
      });

      expect((await service.getQueueForLine('A')).panels.map((p) => p.codigoPanel)).toEqual(['RRRH']);
      expect((await service.getQueueForLine('B')).panels.map((p) => p.codigoPanel)).toEqual(['FRLH']);
    });

    it.each(PANEL_CODES)('lists panel type %s correctly when assigned to line A', async (code) => {
      await service.saveConfig({
        fechaInicioEvaluacion: '2026-11-27T08:00:00',
        assignments: {
          FRLH: code === 'FRLH' ? 'A' : 'B',
          FRRH: code === 'FRRH' ? 'A' : 'B',
          RRLH: code === 'RRLH' ? 'A' : 'B',
          RRRH: code === 'RRRH' ? 'A' : 'B',
        },
        segundosPanelCorrecto: 10,
      });

      const { posicion, mano } = splitPanelCode(code);
      repo.seedOrden({
        idOrdenProduccion: 300,
        puesto: 'DL01',
        secuencia: 5,
        fechaProceso: '2026-11-27T08:10:00',
        sd: 'SD-300',
        estado: 0,
        posicion,
        mano,
      });

      const queueA = await service.getQueueForLine('A');
      expect(queueA.panels).toHaveLength(1);
      expect(queueA.panels[0].codigoPanel).toBe(code);
    });
  });

  describe.each(PANEL_CODES)('processQrScan for %s', (code) => {
    const { posicion, mano } = splitPanelCode(code);

    beforeEach(async () => {
      await service.saveConfig({
        fechaInicioEvaluacion: '2026-11-27T08:00:00',
        assignments: {
          FRLH: code === 'FRLH' ? 'A' : 'B',
          FRRH: code === 'FRRH' ? 'A' : 'B',
          RRLH: code === 'RRLH' ? 'A' : 'B',
          RRRH: code === 'RRRH' ? 'A' : 'B',
        },
        segundosPanelCorrecto: 10,
      });
    });

    it('confirms DOBLADORA panel (Estado 0 -> 2) and returns nextPanels', async () => {
      repo.seedOrden({
        idOrdenProduccion: 501,
        puesto: 'DL01',
        secuencia: 10,
        fechaProceso: '2026-11-27T08:05:00',
        sd: 'SD-501',
        estado: 0,
        posicion,
        mano,
      });
      repo.seedOrden({
        idOrdenProduccion: 502,
        puesto: 'DL01',
        secuencia: 11,
        fechaProceso: '2026-11-27T08:06:00',
        sd: 'SD-502',
        estado: 1,
        posicion,
        mano,
      });

      const res = await service.processQrScan('A', `501|10|SD-501|${posicion}|${mano}`);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.status).toBe('CORRECT');
        expect(res.newEstado).toBe(2);
        expect(res.confirmedPanel.idOrdenProduccion).toBe(501);
        expect(res.nextPanels.map((p) => p.idOrdenProduccion)).toEqual([502]);
      }
      expect(repo.ordenes.find((o) => o.idOrdenProduccion === 501)?.estado).toBe(2);
    });

    it('confirms STOCK panel (Estado 1 -> 3) and returns nextPanels', async () => {
      repo.seedOrden({
        idOrdenProduccion: 601,
        puesto: 'DL01',
        secuencia: 20,
        fechaProceso: '2026-11-27T08:05:00',
        sd: 'SD-601',
        estado: 1,
        posicion,
        mano,
      });

      const res = await service.processQrScan('A', `601|20|SD-601|${posicion}|${mano}`);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.status).toBe('CORRECT');
        expect(res.newEstado).toBe(3);
        expect(res.confirmedPanel.idOrdenProduccion).toBe(601);
        expect(res.nextPanels).toEqual([]);
      }
      expect(repo.ordenes.find((o) => o.idOrdenProduccion === 601)?.estado).toBe(3);
    });

    it.each([
      ['wrong panel type', (p: string, m: string) => `701|30|SD-701|${p === 'FR' ? 'RR' : 'FR'}|${m}`],
      ['wrong ID_OrdenProduccion', (p: string, m: string) => `999|30|SD-701|${p}|${m}`],
      ['wrong Secuencia', (p: string, m: string) => `701|99|SD-701|${p}|${m}`],
      ['wrong SD', (p: string, m: string) => `701|30|SD-WRONG|${p}|${m}`],
      ['malformed QR', () => 'NOT-A-VALID-QR'],
    ])('rejects %s without mutating Estado', async (_label, makeQr) => {
      repo.seedOrden({
        idOrdenProduccion: 701,
        puesto: 'DL01',
        secuencia: 30,
        fechaProceso: '2026-11-27T08:05:00',
        sd: 'SD-701',
        estado: 0,
        posicion,
        mano,
      });

      const res = await service.processQrScan('A', makeQr(posicion, mano));
      expect(res.ok).toBe(false);
      expect(res.status).toBe('INCORRECT');
      if (!res.ok && res.status === 'INCORRECT') {
        expect(res.expectedPanel.idOrdenProduccion).toBe(701);
        expect(res.panels.map((p) => p.idOrdenProduccion)).toEqual([701]);
      }
      expect(repo.ordenes.find((o) => o.idOrdenProduccion === 701)?.estado).toBe(0);
    });
  });

  describe('EMPTY queue & append-only config history', () => {
    it('returns EMPTY when no pending panels exist for the line', async () => {
      const res = await service.processQrScan('A', '1|1|SD-1|FR|LH');
      expect(res).toEqual({
        ok: false,
        status: 'EMPTY',
        panels: [],
        reason: 'No hay paneles pendientes para esta línea.',
      });
    });

    it('saveConfig appends rows and getConfig returns the latest', async () => {
      const initialCount = repo.configs.length;
      const saved = await service.saveConfig({
        fechaInicioEvaluacion: '2026-11-27T09:15',
        assignments: { FRLH: 'B', FRRH: 'A', RRLH: null, RRRH: 'B' },
        segundosPanelCorrecto: 5,
      });

      expect(repo.configs.length).toBe(initialCount + 1);
      expect(saved.fechaInicioEvaluacion).toBe('2026-11-27T09:15:00');
      expect(saved.segundosPanelCorrecto).toBe(5);

      const latest = await service.getConfig();
      expect(latest.idDoorPick).toBe(saved.idDoorPick);
      expect(latest.segundosPanelCorrecto).toBe(5);
      expect(latest.assignments).toEqual({
        FRLH: 'B',
        FRRH: 'A',
        RRLH: null,
        RRRH: 'B',
      });
    });

    it('saveConfig rejects invalid config input', async () => {
      await expect(
        service.saveConfig({
          fechaInicioEvaluacion: 'invalid-date',
          assignments: { FRLH: 'A', FRRH: 'B', RRLH: null, RRRH: null },
          segundosPanelCorrecto: 10,
        })
      ).rejects.toThrow();
    });
  });
});
