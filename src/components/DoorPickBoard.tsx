'use client';

import { useCallback, useEffect, useReducer, useRef, useSyncExternalStore } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { boardReducer, getVisiblePanels, initialBoardState } from '@/lib/board-state';
import type { LineId, QueueResponse, ScanResponse } from '@/lib/types';
import { Header } from './Header';
import { PanelQueue } from './PanelQueue';
import { StatusPanel } from './StatusPanel';

const STORAGE_KEY = 'doorpick_line';
const POLL_INTERVAL_MS = 2500;
const GREEN_HOLD_MS = 5000;
const SCAN_GAP_RESET_MS = 500;

function parseLineParam(value: string | null): LineId | null {
  if (value === 'A' || value === 'B') return value;
  return null;
}

function readStoredLine(): LineId | null {
  try {
    return parseLineParam(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

function getServerLine(): LineId | null {
  return null;
}

function subscribeLineStorage(callback: () => void): () => void {
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
}

export function DoorPickBoard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlLine = parseLineParam(searchParams.get('linea'));
  const storedLine = useSyncExternalStore(
    subscribeLineStorage,
    readStoredLine,
    getServerLine,
  );
  const line: LineId = urlLine ?? storedLine ?? 'A';
  const [state, dispatch] = useReducer(boardReducer, initialBoardState);

  const greenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scanBufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);
  const scanInFlightRef = useRef<boolean>(false);

  const clearGreenTimer = useCallback(() => {
    if (greenTimerRef.current !== null) {
      clearTimeout(greenTimerRef.current);
      greenTimerRef.current = null;
    }
  }, []);

  const startGreenTimer = useCallback(() => {
    clearGreenTimer();
    greenTimerRef.current = setTimeout(() => {
      greenTimerRef.current = null;
      dispatch({ type: 'GREEN_TIMER_EXPIRED' });
    }, GREEN_HOLD_MS);
  }, [clearGreenTimer]);

  // Persist URL line selection to localStorage
  useEffect(() => {
    if (!urlLine) return;
    try {
      localStorage.setItem(STORAGE_KEY, urlLine);
    } catch {
      // ignore storage errors
    }
  }, [urlLine]);

  const handleSelectLine = useCallback(
    (nextLine: LineId) => {
      if (nextLine === line) return;
      clearGreenTimer();
      scanBufferRef.current = '';
      dispatch({ type: 'SWITCH_LINE' });
      try {
        localStorage.setItem(STORAGE_KEY, nextLine);
      } catch {
        // ignore storage errors
      }
      router.replace(`/?linea=${nextLine}`);
    },
    [clearGreenTimer, line, router],
  );

  // Poll queue every 2500ms
  useEffect(() => {
    let active = true;

    const fetchQueue = async () => {
      try {
        const res = await fetch(`/api/panels?line=${line}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data: QueueResponse = await res.json();
        if (active) {
          dispatch({ type: 'SYNC_QUEUE', queue: data.panels });
        }
      } catch {
        // silent poll retry
      }
    };

    fetchQueue();
    const interval = setInterval(fetchQueue, POLL_INTERVAL_MS);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [line]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => clearGreenTimer();
  }, [clearGreenTimer]);

  // Global HID QR keyboard listener (no visible input)
  useEffect(() => {
    const submitScan = async (qr: string) => {
      if (!qr || scanInFlightRef.current) return;
      scanInFlightRef.current = true;
      clearGreenTimer();

      try {
        const res = await fetch('/api/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ line, qr }),
        });

        const data: ScanResponse = await res.json();

        if (data.status === 'CORRECT') {
          dispatch({
            type: 'SCAN_CORRECT',
            confirmedPanel: data.confirmedPanel,
            nextPanels: data.nextPanels,
          });
          startGreenTimer();
        } else if (data.status === 'INCORRECT') {
          dispatch({
            type: 'SCAN_INCORRECT',
            panels: data.panels,
            errorMessage: data.reason,
          });
        } else if (data.status === 'EMPTY') {
          dispatch({
            type: 'SCAN_EMPTY',
            errorMessage: data.reason,
          });
        }
      } catch {
        dispatch({ type: 'SET_ERROR', errorMessage: 'ERROR DE CONEXIÓN' });
      } finally {
        scanInFlightRef.current = false;
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      if (e.key === 'Escape') {
        scanBufferRef.current = '';
        lastKeyTimeRef.current = 0;
        return;
      }

      const now = Date.now();
      if (lastKeyTimeRef.current > 0 && now - lastKeyTimeRef.current > SCAN_GAP_RESET_MS) {
        scanBufferRef.current = '';
      }
      lastKeyTimeRef.current = now;

      if (e.key === 'Enter') {
        const qr = scanBufferRef.current.trim();
        scanBufferRef.current = '';
        lastKeyTimeRef.current = 0;
        if (qr.length > 0) {
          e.preventDefault();
          void submitScan(qr);
        }
        return;
      }

      if (e.key.length === 1) {
        scanBufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [clearGreenTimer, line, startGreenTimer]);

  const visiblePanels = getVisiblePanels(state);
  const activePanel = visiblePanels[0] ?? null;

  return (
    <div className="min-h-screen flex flex-col bg-white text-black">
      <Header line={line} onSelectLine={handleSelectLine} />

      <main className="flex-1 p-4 sm:p-6 flex flex-col lg:flex-row gap-6">
        <PanelQueue panels={visiblePanels} mode={state.mode} />
        <StatusPanel activePanel={activePanel} mode={state.mode} />
      </main>
    </div>
  );
}
