'use client';

import { IconAlertTriangle, IconCheck, IconRefresh } from '@tabler/icons-react';
import type { BoardMode } from '@/lib/board-state';
import type { PanelItem } from '@/lib/types';

interface PanelQueueProps {
  panels: PanelItem[];
  mode: BoardMode;
}

export function PanelQueue({ panels, mode }: PanelQueueProps) {
  const activePanel = panels[0] ?? null;
  const upcomingPanels = panels.slice(1, 5);

  return (
    <section className="w-full lg:w-[38%] flex flex-col gap-3">
      {!activePanel ? (
        <div className="border-4 border-black bg-white p-6 flex items-center justify-center h-full">
          <span className="font-mono text-base font-bold tracking-widest text-black">
            SIN PANELES EN COLA
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {/* Card 0: Active */}
          <div
            className={`border-4 border-black p-4 flex flex-col gap-4 ${activePanel.ubicacion === 'STOCK' ? 'bg-[#FFE600]' : 'bg-[#BBF7D0]'
              }`}
          >
            <div className="flex items-center justify-between gap-2">
              {mode === 'CORRECT' ? (
                <div className="inline-flex items-center gap-1.5 bg-[#15803D] text-white px-2 py-0.5 font-mono text-xs font-bold tracking-wider">
                  <IconCheck size={16} stroke={2.5} />
                  <span>CORRECTO</span>
                </div>
              ) : mode === 'INCORRECT' ? (
                <div className="inline-flex items-center gap-1.5 bg-[#CC0000] text-white px-2 py-0.5 font-mono text-xs font-bold tracking-wider">
                  <IconAlertTriangle size={16} stroke={2.5} />
                  <span>INCORRECTO</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 text-black font-mono text-xs font-bold tracking-wider">
                  <IconRefresh size={16} stroke={2} />
                  <span>EN ESPERA</span>
                </div>
              )}

              <span
                className={`px-2.5 py-0.5 font-mono text-xs font-bold tracking-wider ${activePanel.ubicacion === 'STOCK'
                  ? 'bg-black text-[#FFE600]'
                  : 'border border-black bg-white text-black'
                  }`}
              >
                {activePanel.ubicacion}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-1 border-t-2 border-black">
              <div className="flex flex-col">
                <span className="font-mono text-[11px] font-semibold tracking-wider text-black/80">
                  SECUENCIA
                </span>
                <span className="font-mono text-3xl font-bold tracking-tight text-black tabular-nums">
                  {activePanel.secuencia}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="font-mono text-[11px] font-semibold tracking-wider text-black/80">
                  CÓDIGO PANEL
                </span>
                <span className="font-mono text-3xl font-bold tracking-tight text-black">
                  {activePanel.codigoPanel}
                </span>
              </div>
            </div>
          </div>

          {/* Cards 1-4: Compact */}
          {upcomingPanels.map((panel) => {
            const isStock = panel.ubicacion === 'STOCK';
            return (
              <div
                key={panel.idOrdenProduccion}
                className={`border-2 border-black px-3.5 py-2.5 flex items-center justify-between gap-2 ${isStock ? 'bg-[#FFE600]' : 'bg-white'
                  }`}
              >
                <div className="flex items-baseline gap-4">
                  <span className="font-mono text-sm font-bold text-black tabular-nums">
                    SECUENCIA {panel.secuencia}
                  </span>
                  <span className="font-mono text-base font-bold text-black">
                    {panel.codigoPanel}
                  </span>
                </div>

                <span
                  className={`px-2 py-0.5 font-mono text-xs font-bold tracking-wider ${isStock
                    ? 'bg-black text-[#FFE600]'
                    : 'border border-black bg-white text-black'
                    }`}
                >
                  {panel.ubicacion}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
