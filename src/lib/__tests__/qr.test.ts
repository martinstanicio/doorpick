import { describe, expect, it } from 'vitest';
import {
  formatLocalDateTime,
  getPanelCodesForLine,
  matchesExpectedPanel,
  parseQrCode,
  splitPanelCode,
  validateConfigInput,
} from '../qr';
import { PANEL_CODES, PanelCode, PanelItem } from '../types';

function makePanel(code: PanelCode, overrides: Partial<PanelItem> = {}): PanelItem {
  const { posicion, mano } = splitPanelCode(code);
  return {
    idOrdenProduccion: 1001,
    secuencia: 42,
    fechaProceso: '2026-11-27T08:00:00',
    sd: 'SD-9901',
    estado: 0,
    mano,
    posicion,
    codigoPanel: code,
    ubicacion: 'DOBLADORA',
    ...overrides,
  };
}

describe('parseQrCode', () => {
  it.each(PANEL_CODES)('parses valid QR code for %s', (code) => {
    const { posicion, mano } = splitPanelCode(code);
    const parsed = parseQrCode(`12345|99|SD-001|${posicion}|${mano}`);
    expect(parsed).toEqual({
      idOrdenProduccion: 12345,
      secuencia: 99,
      sd: 'SD-001',
      posicion,
      mano,
    });
  });

  it('trims whitespace and normalizes lowercase sd, posicion, mano', () => {
    const parsed = parseQrCode('  77 | 5 | sd-abc | fr | lh  ');
    expect(parsed).toEqual({
      idOrdenProduccion: 77,
      secuencia: 5,
      sd: 'SD-ABC',
      posicion: 'FR',
      mano: 'LH',
    });
  });

  it.each([
    ['empty string', ''],
    ['too few segments', '100|1|SD1|FR'],
    ['too many segments', '100|1|SD1|FR|LH|EXTRA'],
    ['non-numeric idOrdenProduccion', 'abc|1|SD1|FR|LH'],
    ['zero idOrdenProduccion', '0|1|SD1|FR|LH'],
    ['negative idOrdenProduccion', '-5|1|SD1|FR|LH'],
    ['decimal idOrdenProduccion', '12.5|1|SD1|FR|LH'],
    ['non-numeric secuencia', '100|xyz|SD1|FR|LH'],
    ['zero secuencia', '100|0|SD1|FR|LH'],
    ['negative secuencia', '100|-1|SD1|FR|LH'],
    ['empty sd', '100|1|   |FR|LH'],
    ['invalid posicion', '100|1|SD1|XX|LH'],
    ['invalid mano', '100|1|SD1|FR|XX'],
  ])('returns null for %s (%s)', (_label, raw) => {
    expect(parseQrCode(raw)).toBeNull();
  });

  it('returns null for non-string input', () => {
    expect(parseQrCode(null as unknown as string)).toBeNull();
    expect(parseQrCode(undefined as unknown as string)).toBeNull();
    expect(parseQrCode(123 as unknown as string)).toBeNull();
  });
});

describe('matchesExpectedPanel', () => {
  describe.each(PANEL_CODES)('panel type %s', (code) => {
    const expected = makePanel(code);

    it('matches when all 5 fields match', () => {
      const qr = parseQrCode(
        `${expected.idOrdenProduccion}|${expected.secuencia}|${expected.sd.toLowerCase()}|${expected.posicion}|${expected.mano}`
      );
      expect(qr).not.toBeNull();
      expect(matchesExpectedPanel(qr!, expected)).toBe(true);
    });

    it('fails when idOrdenProduccion differs', () => {
      const qr = parseQrCode(
        `${expected.idOrdenProduccion + 1}|${expected.secuencia}|${expected.sd}|${expected.posicion}|${expected.mano}`
      )!;
      expect(matchesExpectedPanel(qr, expected)).toBe(false);
    });

    it('fails when secuencia differs', () => {
      const qr = parseQrCode(
        `${expected.idOrdenProduccion}|${expected.secuencia + 1}|${expected.sd}|${expected.posicion}|${expected.mano}`
      )!;
      expect(matchesExpectedPanel(qr, expected)).toBe(false);
    });

    it('fails when sd differs', () => {
      const qr = parseQrCode(
        `${expected.idOrdenProduccion}|${expected.secuencia}|SD-OTHER|${expected.posicion}|${expected.mano}`
      )!;
      expect(matchesExpectedPanel(qr, expected)).toBe(false);
    });

    it('fails when posicion differs', () => {
      const otherPos = expected.posicion === 'FR' ? 'RR' : 'FR';
      const qr = parseQrCode(
        `${expected.idOrdenProduccion}|${expected.secuencia}|${expected.sd}|${otherPos}|${expected.mano}`
      )!;
      expect(matchesExpectedPanel(qr, expected)).toBe(false);
    });

    it('fails when mano differs', () => {
      const otherMano = expected.mano === 'LH' ? 'RH' : 'LH';
      const qr = parseQrCode(
        `${expected.idOrdenProduccion}|${expected.secuencia}|${expected.sd}|${expected.posicion}|${otherMano}`
      )!;
      expect(matchesExpectedPanel(qr, expected)).toBe(false);
    });
  });
});

describe('splitPanelCode & getPanelCodesForLine', () => {
  it('splits all 4 panel codes into posicion and mano', () => {
    expect(splitPanelCode('FRLH')).toEqual({ posicion: 'FR', mano: 'LH' });
    expect(splitPanelCode('FRRH')).toEqual({ posicion: 'FR', mano: 'RH' });
    expect(splitPanelCode('RRLH')).toEqual({ posicion: 'RR', mano: 'LH' });
    expect(splitPanelCode('RRRH')).toEqual({ posicion: 'RR', mano: 'RH' });
  });

  it('filters panel codes assigned to each line', () => {
    const assignments = {
      FRLH: 'A' as const,
      FRRH: 'B' as const,
      RRLH: 'A' as const,
      RRRH: null,
    };
    expect(getPanelCodesForLine(assignments, 'A')).toEqual(['FRLH', 'RRLH']);
    expect(getPanelCodesForLine(assignments, 'B')).toEqual(['FRRH']);
  });
});

describe('validateConfigInput & formatLocalDateTime', () => {
  it('normalizes YYYY-MM-DDTHH:mm to include :00 seconds', () => {
    const res = validateConfigInput({
      fechaInicioEvaluacion: '2026-11-27T08:30',
      assignments: { FRLH: 'A', FRRH: 'B', RRLH: 'A', RRRH: null },
    });
    expect(res.valid).toBe(true);
    expect(res.normalized?.fechaInicioEvaluacion).toBe('2026-11-27T08:30:00');
  });

  it('rejects invalid calendar dates like Feb 30', () => {
    const res = validateConfigInput({
      fechaInicioEvaluacion: '2026-02-30T08:00:00',
      assignments: { FRLH: 'A', FRRH: 'B', RRLH: null, RRRH: null },
    });
    expect(res.valid).toBe(false);
  });

  it('rejects invalid line assignment values', () => {
    const res = validateConfigInput({
      fechaInicioEvaluacion: '2026-11-27T08:00:00',
      assignments: {
        FRLH: 'C' as unknown as 'A',
        FRRH: 'B',
        RRLH: null,
        RRRH: null,
      },
    });
    expect(res.valid).toBe(false);
  });

  it('formats Date to YYYY-MM-DDTHH:mm:ss', () => {
    const d = new Date(2026, 10, 27, 9, 5, 3);
    expect(formatLocalDateTime(d)).toBe('2026-11-27T09:05:03');
  });
});
