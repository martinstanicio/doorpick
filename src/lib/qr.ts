import {
  DoorPickConfigInput,
  LineAssignment,
  LineId,
  PANEL_CODES,
  PanelCode,
  PanelHand,
  PanelItem,
  PanelPosition,
  ParsedQr,
} from './types';

function parsePositiveInt(segment: string): number | null {
  const trimmed = segment.trim();
  if (!/^\d+$/.test(trimmed)) {
    return null;
  }
  const value = Number(trimmed);
  if (!Number.isSafeInteger(value) || value <= 0) {
    return null;
  }
  return value;
}

export function parseQrCode(raw: string): ParsedQr | null {
  if (typeof raw !== 'string') {
    return null;
  }

  const segments = raw.trim().split('|');
  if (segments.length !== 5) {
    return null;
  }

  const idOrdenProduccion = parsePositiveInt(segments[0]);
  const secuencia = parsePositiveInt(segments[1]);
  const sd = segments[2].trim().toUpperCase();
  const posicion = segments[3].trim().toUpperCase();
  const mano = segments[4].trim().toUpperCase();

  if (idOrdenProduccion === null || secuencia === null || sd.length === 0) {
    return null;
  }

  if (posicion !== 'FR' && posicion !== 'RR') {
    return null;
  }

  if (mano !== 'LH' && mano !== 'RH') {
    return null;
  }

  return {
    idOrdenProduccion,
    secuencia,
    sd,
    posicion,
    mano,
  };
}

export function matchesExpectedPanel(qr: ParsedQr, expected: PanelItem): boolean {
  return (
    qr.idOrdenProduccion === expected.idOrdenProduccion &&
    qr.secuencia === expected.secuencia &&
    qr.sd === expected.sd.trim().toUpperCase() &&
    qr.posicion === expected.posicion &&
    qr.mano === expected.mano
  );
}

export function splitPanelCode(code: PanelCode): {
  posicion: PanelPosition;
  mano: PanelHand;
} {
  return {
    posicion: code.slice(0, 2) as PanelPosition,
    mano: code.slice(2, 4) as PanelHand,
  };
}

export function getPanelCodesForLine(
  assignments: Record<PanelCode, LineAssignment>,
  line: LineId
): PanelCode[] {
  return PANEL_CODES.filter((code) => assignments[code] === line);
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatLocalDateTime(date: Date): string {
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  const hours = pad2(date.getHours());
  const minutes = pad2(date.getMinutes());
  const seconds = pad2(date.getSeconds());
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

function normalizeLocalDateTimeString(raw: string): string | null {
  const trimmed = raw.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(
    trimmed
  );
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hours = Number(match[4]);
  const minutes = Number(match[5]);
  const seconds = match[6] !== undefined ? Number(match[6]) : 0;

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59 ||
    seconds < 0 ||
    seconds > 59
  ) {
    return null;
  }

  const check = new Date(year, month - 1, day, hours, minutes, seconds);
  if (
    check.getFullYear() !== year ||
    check.getMonth() !== month - 1 ||
    check.getDate() !== day ||
    check.getHours() !== hours ||
    check.getMinutes() !== minutes ||
    check.getSeconds() !== seconds
  ) {
    return null;
  }

  return `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${pad2(seconds)}`;
}

export function validateConfigInput(input: DoorPickConfigInput): {
  valid: boolean;
  error?: string;
  normalized?: DoorPickConfigInput;
} {
  if (!input || typeof input !== 'object') {
    return { valid: false, error: 'Configuración inválida.' };
  }

  if (typeof input.fechaInicioEvaluacion !== 'string') {
    return {
      valid: false,
      error: 'fechaInicioEvaluacion debe ser una cadena de fecha/hora.',
    };
  }

  const normalizedFecha = normalizeLocalDateTimeString(
    input.fechaInicioEvaluacion
  );
  if (!normalizedFecha) {
    return {
      valid: false,
      error:
        'fechaInicioEvaluacion debe tener formato YYYY-MM-DDTHH:mm o YYYY-MM-DDTHH:mm:ss.',
    };
  }

  if (!input.assignments || typeof input.assignments !== 'object') {
    return { valid: false, error: 'assignments es requerido.' };
  }

  const normalizedAssignments = {} as Record<PanelCode, LineAssignment>;
  for (const code of PANEL_CODES) {
    const val = input.assignments[code];
    if (val !== 'A' && val !== 'B' && val !== null) {
      return {
        valid: false,
        error: `Asignación inválida para ${code}: debe ser 'A', 'B' o null.`,
      };
    }
    normalizedAssignments[code] = val;
  }

  return {
    valid: true,
    normalized: {
      fechaInicioEvaluacion: normalizedFecha,
      assignments: normalizedAssignments,
    },
  };
}
