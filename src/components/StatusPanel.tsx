'use client';

import type { BoardMode } from '@/lib/board-state';
import type { PanelItem } from '@/lib/types';

interface StatusPanelProps {
  activePanel: PanelItem | null;
  mode: BoardMode;
}

export function StatusPanel({ activePanel, mode }: StatusPanelProps) {
  const bannerConfig =
    mode === 'INCORRECT'
      ? {
        leftText: 'PANEL INCORRECTO',
        bgClass: 'bg-[#CC0000] text-white',
      }
      : mode === 'CORRECT'
        ? {
          leftText: 'PANEL CORRECTO',
          bgClass: 'bg-[#15803D] text-white',
        }
        : {
          leftText: 'ESPERANDO PANEL',
          bgClass: 'bg-white text-black',
        };

  const renderBottomBox = () => {
    if (!activePanel) {
      return (
        <div className="flex-1 bg-white p-8 flex flex-col items-center justify-center text-center">
          <span className="font-mono text-3xl sm:text-4xl font-bold tracking-widest text-black">
            SIN PANELES PENDIENTES
          </span>
        </div>
      );
    }

    if (mode === 'INCORRECT') {
      return (
        <div className="flex-1 bg-[#CC0000] text-white p-8 flex items-center justify-center text-center font-sans text-3xl sm:text-5xl font-bold tracking-tight uppercase">
          PANEL INCORRECTO
        </div>
      );
    }

    if (mode === 'CORRECT') {
      return (
        <div className="flex-1 bg-[#15803D] text-white p-8 flex items-center justify-center text-center font-sans text-4xl sm:text-6xl font-bold tracking-tight uppercase">
          PANEL CORRECTO
        </div>
      );
    }

    const isStock = activePanel.ubicacion === 'STOCK';
    return (
      <div
        className={`flex-1 p-8 flex flex-col items-center justify-center text-center gap-6 ${isStock ? 'bg-[#FFE600] text-black' : 'bg-[#BBF7D0] text-black'
          }`}
      >
        <span className="font-sans text-5xl sm:text-7xl font-bold tracking-tight">
          {activePanel.ubicacion}
        </span>
      </div>
    );
  };

  return (
    <section className="w-full lg:w-[62%] border-4 border-black bg-white flex flex-col h-full">
      {/* Top Banner */}
      <div
        className={`border-b-4 border-black px-5 py-3 flex items-center justify-between gap-4 font-mono text-base sm:text-lg font-bold tracking-widest ${bannerConfig.bgClass}`}
      >
        {bannerConfig.leftText}
      </div>

      {/* Middle 2-Column Grid (always white) */}
      <div className="grid grid-cols-2 border-b-4 border-black bg-white">
        <div className="p-6 border-r-4 border-black flex flex-col gap-1">
          <span className="font-mono text-xs sm:text-sm font-bold tracking-widest text-neutral-600">
            SECUENCIA ACTIVA
          </span>
          <span className="font-mono text-5xl sm:text-6xl font-bold tracking-tight text-black tabular-nums">
            {activePanel ? activePanel.secuencia : '—'}
          </span>
        </div>
        <div className="p-6 flex flex-col gap-1">
          <span className="font-mono text-xs sm:text-sm font-bold tracking-widest text-neutral-600">
            CÓDIGO DE PANEL
          </span>
          <span className="font-mono text-5xl sm:text-6xl font-bold tracking-tight text-black">
            {activePanel ? activePanel.codigoPanel : '—'}
          </span>
        </div>
      </div>

      {/* Bottom Large Box */}
      {renderBottomBox()}
    </section>
  );
}
