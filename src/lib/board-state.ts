import type { PanelItem } from './types';

export type BoardMode = 'STANDBY' | 'CORRECT' | 'INCORRECT';

export interface BoardState {
  mode: BoardMode;
  queue: PanelItem[];
  confirmedPanel: PanelItem | null;
  confirmedNonce: number;
  errorMessage: string | null;
}

export type BoardAction =
  | { type: 'SYNC_QUEUE'; queue: PanelItem[] }
  | { type: 'SCAN_CORRECT'; confirmedPanel: PanelItem; nextPanels: PanelItem[] }
  | { type: 'SCAN_INCORRECT'; panels: PanelItem[]; errorMessage?: string | null }
  | { type: 'SCAN_EMPTY'; errorMessage?: string | null }
  | { type: 'GREEN_TIMER_EXPIRED' }
  | { type: 'SWITCH_LINE' }
  | { type: 'SET_ERROR'; errorMessage: string | null };

export const initialBoardState: BoardState = {
  mode: 'STANDBY',
  queue: [],
  confirmedPanel: null,
  confirmedNonce: 0,
  errorMessage: null,
};

/**
 * Pure reducer for the DoorPick production board state machine.
 */
export function boardReducer(state: BoardState, action: BoardAction): BoardState {
  switch (action.type) {
    case 'SYNC_QUEUE': {
      if (state.mode === 'CORRECT') {
        return {
          ...state,
          queue: action.queue,
          errorMessage: null,
        };
      }

      if (state.mode === 'INCORRECT') {
        const prevHeadId = state.queue[0]?.idOrdenProduccion;
        const nextHeadId = action.queue[0]?.idOrdenProduccion;
        const headUnchanged =
          prevHeadId !== undefined && nextHeadId !== undefined && prevHeadId === nextHeadId;

        return {
          ...state,
          mode: headUnchanged ? 'INCORRECT' : 'STANDBY',
          queue: action.queue,
          confirmedPanel: null,
          errorMessage: null,
        };
      }

      return {
        ...state,
        mode: 'STANDBY',
        queue: action.queue,
        confirmedPanel: null,
        errorMessage: null,
      };
    }

    case 'SCAN_CORRECT':
      return {
        ...state,
        mode: 'CORRECT',
        confirmedPanel: action.confirmedPanel,
        queue: action.nextPanels,
        confirmedNonce: state.confirmedNonce + 1,
        errorMessage: null,
      };

    case 'SCAN_INCORRECT':
      return {
        ...state,
        mode: 'INCORRECT',
        confirmedPanel: null,
        queue: action.panels,
        errorMessage: action.errorMessage ?? null,
      };

    case 'SCAN_EMPTY':
      return {
        ...state,
        mode: 'STANDBY',
        confirmedPanel: null,
        queue: [],
        errorMessage: action.errorMessage ?? null,
      };

    case 'GREEN_TIMER_EXPIRED':
      if (state.mode !== 'CORRECT') {
        return state;
      }
      return {
        ...state,
        mode: 'STANDBY',
        confirmedPanel: null,
      };

    case 'SWITCH_LINE':
      return initialBoardState;

    case 'SET_ERROR':
      return {
        ...state,
        errorMessage: action.errorMessage,
      };

    default:
      return state;
  }
}

/**
 * Returns all visible panels for the left queue column.
 * In CORRECT mode, Card 0 is pinned to the confirmedPanel.
 */
export function getVisiblePanels(state: BoardState): PanelItem[] {
  if (state.mode === 'CORRECT' && state.confirmedPanel) {
    const rest = state.queue.filter(
      (p) => p.idOrdenProduccion !== state.confirmedPanel!.idOrdenProduccion
    );
    return [state.confirmedPanel, ...rest];
  }
  return state.queue;
}
