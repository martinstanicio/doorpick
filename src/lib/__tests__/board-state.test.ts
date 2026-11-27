import { describe, expect, it } from 'vitest';
import {
  boardReducer,
  getVisiblePanels,
  initialBoardState,
} from '../board-state';
import { splitPanelCode } from '../qr';
import { PANEL_CODES, PanelCode, PanelItem, PanelSource } from '../types';

function makePanel(
  id: number,
  code: PanelCode,
  ubicacion: PanelSource = 'DOBLADORA'
): PanelItem {
  const { posicion, mano } = splitPanelCode(code);
  return {
    idOrdenProduccion: id,
    secuencia: id % 1000,
    fechaProceso: `2026-11-27T08:0${id % 10}:00`,
    sd: `SD-${id}`,
    estado: ubicacion === 'STOCK' ? 1 : 0,
    mano,
    posicion,
    codigoPanel: code,
    ubicacion,
  };
}

describe('boardReducer & getVisiblePanels', () => {
  describe.each(PANEL_CODES)('panel type %s', (code) => {
    it('transitions STANDBY (DOBLADORA & STOCK) -> CORRECT (pins slot 0) -> GREEN_TIMER_EXPIRED -> advances', () => {
      const p1 = makePanel(1, code, 'DOBLADORA');
      const p2 = makePanel(2, code, 'STOCK');
      const p3 = makePanel(3, code, 'DOBLADORA');

      // STANDBY with DOBLADORA at slot 0 and STOCK at slot 1
      let state = boardReducer(initialBoardState, {
        type: 'SYNC_QUEUE',
        queue: [p1, p2, p3],
      });
      expect(state.mode).toBe('STANDBY');
      expect(getVisiblePanels(state).map((p) => p.idOrdenProduccion)).toEqual([1, 2, 3]);

      // SCAN_CORRECT -> CORRECT, keeps p1 pinned at slot 0
      state = boardReducer(state, {
        type: 'SCAN_CORRECT',
        confirmedPanel: p1,
        nextPanels: [p2, p3],
      });
      expect(state.mode).toBe('CORRECT');
      expect(state.confirmedNonce).toBe(1);
      expect(getVisiblePanels(state).map((p) => p.idOrdenProduccion)).toEqual([1, 2, 3]);

      // GREEN_TIMER_EXPIRED -> STANDBY, advances to p2 (STOCK)
      state = boardReducer(state, { type: 'GREEN_TIMER_EXPIRED' });
      expect(state.mode).toBe('STANDBY');
      expect(state.confirmedPanel).toBeNull();
      expect(getVisiblePanels(state).map((p) => p.idOrdenProduccion)).toEqual([2, 3]);
    });

    it('handles rapid SCAN_CORRECT while in CORRECT mode (new panel, nonce increments)', () => {
      const p1 = makePanel(1, code, 'DOBLADORA');
      const p2 = makePanel(2, code, 'STOCK');
      const p3 = makePanel(3, code, 'DOBLADORA');

      let state = boardReducer(initialBoardState, {
        type: 'SCAN_CORRECT',
        confirmedPanel: p1,
        nextPanels: [p2, p3],
      });
      expect(state.confirmedNonce).toBe(1);

      state = boardReducer(state, {
        type: 'SCAN_CORRECT',
        confirmedPanel: p2,
        nextPanels: [p3],
      });
      expect(state.mode).toBe('CORRECT');
      expect(state.confirmedNonce).toBe(2);
      expect(state.confirmedPanel?.idOrdenProduccion).toBe(2);
      expect(getVisiblePanels(state).map((p) => p.idOrdenProduccion)).toEqual([2, 3]);
    });

    it('handles rapid SCAN_INCORRECT while in CORRECT mode (instant red on next panel)', () => {
      const p1 = makePanel(1, code, 'DOBLADORA');
      const p2 = makePanel(2, code, 'STOCK');

      let state = boardReducer(initialBoardState, {
        type: 'SCAN_CORRECT',
        confirmedPanel: p1,
        nextPanels: [p2],
      });

      state = boardReducer(state, {
        type: 'SCAN_INCORRECT',
        panels: [p2],
        errorMessage: 'Panel incorrecto',
      });
      expect(state.mode).toBe('INCORRECT');
      expect(state.confirmedPanel).toBeNull();
      expect(state.errorMessage).toBe('Panel incorrecto');
      expect(getVisiblePanels(state).map((p) => p.idOrdenProduccion)).toEqual([2]);
    });

    it('persists INCORRECT across SYNC_QUEUE polling until active panel changes or valid scan', () => {
      const p1 = makePanel(1, code, 'DOBLADORA');
      const p2 = makePanel(2, code, 'STOCK');

      let state = boardReducer(initialBoardState, {
        type: 'SCAN_INCORRECT',
        panels: [p1, p2],
        errorMessage: 'Mismatch',
      });

      // Polling returns same head (p1) -> stays INCORRECT
      state = boardReducer(state, {
        type: 'SYNC_QUEUE',
        queue: [p1, p2],
      });
      expect(state.mode).toBe('INCORRECT');

      // Polling returns different head (p2) -> resets to STANDBY
      state = boardReducer(state, {
        type: 'SYNC_QUEUE',
        queue: [p2],
      });
      expect(state.mode).toBe('STANDBY');
    });
  });

  it('GREEN_TIMER_EXPIRED is a no-op when not in CORRECT mode', () => {
    const p1 = makePanel(1, 'FRLH');
    const state = boardReducer(initialBoardState, {
      type: 'SCAN_INCORRECT',
      panels: [p1],
    });
    const next = boardReducer(state, { type: 'GREEN_TIMER_EXPIRED' });
    expect(next).toBe(state);
  });

  it('SWITCH_LINE resets to initialBoardState and SCAN_EMPTY clears queue', () => {
    const p1 = makePanel(1, 'RRRH');
    let state = boardReducer(initialBoardState, {
      type: 'SCAN_CORRECT',
      confirmedPanel: p1,
      nextPanels: [],
    });
    state = boardReducer(state, { type: 'SWITCH_LINE' });
    expect(state).toEqual(initialBoardState);

    const emptyState = boardReducer(state, {
      type: 'SCAN_EMPTY',
      errorMessage: 'Sin pendientes',
    });
    expect(emptyState.mode).toBe('STANDBY');
    expect(emptyState.queue).toEqual([]);
    expect(emptyState.errorMessage).toBe('Sin pendientes');
  });
});
