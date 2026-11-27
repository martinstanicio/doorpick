export type LineId = 'A' | 'B';

export type PanelCode = 'FRLH' | 'FRRH' | 'RRLH' | 'RRRH';

export const PANEL_CODES: readonly PanelCode[] = ['FRLH', 'FRRH', 'RRLH', 'RRRH'] as const;

export type LineAssignment = LineId | null;

export type PanelSource = 'DOBLADORA' | 'STOCK';

export type PanelPosition = 'FR' | 'RR';

export type PanelHand = 'LH' | 'RH';

export type PanelStatusCode = 0 | 1 | 2 | 3;

export const DEFAULT_PANEL_CORRECTO_SEGUNDOS = 10;

export interface DoorPickConfig {
  idDoorPick?: number;
  fechaInicioEvaluacion: string;
  assignments: Record<PanelCode, LineAssignment>;
  segundosPanelCorrecto: number;
  fechaActualizacion?: string;
}

export interface DoorPickConfigInput {
  fechaInicioEvaluacion: string;
  assignments: Record<PanelCode, LineAssignment>;
  segundosPanelCorrecto: number;
}

export interface PanelItem {
  idOrdenProduccion: number;
  secuencia: number;
  fechaProceso: string;
  sd: string;
  estado: PanelStatusCode;
  mano: PanelHand;
  posicion: PanelPosition;
  codigoPanel: PanelCode;
  ubicacion: PanelSource;
}

export interface ParsedQr {
  idOrdenProduccion: number;
  secuencia: number;
  sd: string;
  posicion: PanelPosition;
  mano: PanelHand;
}

export interface QueueResponse {
  line: LineId;
  panels: PanelItem[];
  config: DoorPickConfig;
}

export type ScanResponse =
  | {
      ok: true;
      status: 'CORRECT';
      confirmedPanel: PanelItem;
      nextPanels: PanelItem[];
      newEstado: 2 | 3;
    }
  | {
      ok: false;
      status: 'INCORRECT';
      expectedPanel: PanelItem;
      panels: PanelItem[];
      reason: string;
    }
  | {
      ok: false;
      status: 'EMPTY';
      panels: [];
      reason: string;
    };
