'use client';

import Link from 'next/link';
import { IconSettings } from '@tabler/icons-react';
import type { LineId } from '@/lib/types';

interface HeaderProps {
  line: LineId;
  onSelectLine: (line: LineId) => void;
}

export function Header({ line, onSelectLine }: HeaderProps) {
  return (
    <header className="w-full border-b-2 border-black bg-white px-4 py-3 flex items-center justify-between gap-4">
      <div className="flex items-center gap-6">
        <span className="font-mono text-2xl font-bold tracking-widest text-black select-none">
          DOORPICK
        </span>

        <div className="inline-flex border-2 border-black" role="group" aria-label="Selector de línea">
          <button
            type="button"
            onClick={() => onSelectLine('A')}
            className={`px-4 py-1.5 font-mono text-sm font-bold tracking-wider transition-colors cursor-pointer ${
              line === 'A'
                ? 'bg-black text-white'
                : 'bg-white text-black hover:bg-neutral-100'
            }`}
          >
            LÍNEA A
          </button>
          <button
            type="button"
            onClick={() => onSelectLine('B')}
            className={`px-4 py-1.5 font-mono text-sm font-bold tracking-wider border-l-2 border-black transition-colors cursor-pointer ${
              line === 'B'
                ? 'bg-black text-white'
                : 'bg-white text-black hover:bg-neutral-100'
            }`}
          >
            LÍNEA B
          </button>
        </div>
      </div>

      <Link
        href="/configuracion"
        className="inline-flex items-center gap-2 border-2 border-black bg-white px-4 py-1.5 font-mono text-sm font-bold tracking-wider text-black hover:bg-black hover:text-white transition-colors"
      >
        <IconSettings size={18} stroke={2} />
        <span>CONFIGURACIÓN</span>
      </Link>
    </header>
  );
}
