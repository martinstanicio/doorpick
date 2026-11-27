import {
  DoorPickRepository,
  SqlServerDoorPickRepository,
} from './doorpick-repository';
import {
  getPanelCodesForLine,
  matchesExpectedPanel,
  parseQrCode,
  validateConfigInput,
} from './qr';
import {
  DoorPickConfig,
  DoorPickConfigInput,
  LineId,
  QueueResponse,
  ScanResponse,
} from './types';

export function createDoorPickService(repo: DoorPickRepository) {
  async function getConfig(): Promise<DoorPickConfig> {
    return repo.getLatestConfig();
  }

  async function saveConfig(
    input: DoorPickConfigInput
  ): Promise<DoorPickConfig> {
    const validation = validateConfigInput(input);
    if (!validation.valid || !validation.normalized) {
      throw new Error(validation.error ?? 'Configuración inválida.');
    }
    return repo.insertConfig(validation.normalized);
  }

  async function getQueueForLine(
    line: LineId,
    limit = 5
  ): Promise<QueueResponse> {
    const config = await repo.getLatestConfig();
    const panelCodes = getPanelCodesForLine(config.assignments, line);
    const panels = await repo.getPendingPanels(
      config.fechaInicioEvaluacion,
      panelCodes,
      limit
    );
    return {
      line,
      panels,
      config,
    };
  }

  async function processQrScan(
    line: LineId,
    rawQr: string
  ): Promise<ScanResponse> {
    const queue = await getQueueForLine(line, 5);
    if (queue.panels.length === 0) {
      return {
        ok: false,
        status: 'EMPTY',
        panels: [],
        reason: 'No hay paneles pendientes para esta línea.',
      };
    }

    const expectedPanel = queue.panels[0];
    const parsed = parseQrCode(rawQr);
    if (!parsed) {
      return {
        ok: false,
        status: 'INCORRECT',
        expectedPanel,
        panels: queue.panels,
        reason: 'Formato de código QR inválido.',
      };
    }

    if (!matchesExpectedPanel(parsed, expectedPanel)) {
      return {
        ok: false,
        status: 'INCORRECT',
        expectedPanel,
        panels: queue.panels,
        reason: 'El panel escaneado no coincide con el siguiente panel esperado.',
      };
    }

    const expectedEstado = expectedPanel.estado;
    if (expectedEstado !== 0 && expectedEstado !== 1) {
      return {
        ok: false,
        status: 'INCORRECT',
        expectedPanel,
        panels: queue.panels,
        reason: 'El panel esperado ya no se encuentra en estado pendiente.',
      };
    }

    const newEstado: 2 | 3 = expectedEstado === 0 ? 2 : 3;
    const updated = await repo.markPanelProcessed(
      expectedPanel.idOrdenProduccion,
      expectedEstado,
      newEstado
    );

    const nextQueue = await getQueueForLine(line, 5);
    if (!updated) {
      if (nextQueue.panels.length === 0) {
        return {
          ok: false,
          status: 'EMPTY',
          panels: [],
          reason: 'El panel ya fue procesado y no quedan paneles pendientes.',
        };
      }
      return {
        ok: false,
        status: 'INCORRECT',
        expectedPanel: nextQueue.panels[0],
        panels: nextQueue.panels,
        reason: 'El panel ya fue procesado o cambió de estado.',
      };
    }

    return {
      ok: true,
      status: 'CORRECT',
      confirmedPanel: expectedPanel,
      nextPanels: nextQueue.panels,
      newEstado,
    };
  }

  return {
    getConfig,
    saveConfig,
    getQueueForLine,
    processQrScan,
  };
}

const defaultRepository = new SqlServerDoorPickRepository();
export const doorPickService = createDoorPickService(defaultRepository);
export default doorPickService;
