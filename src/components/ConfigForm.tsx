'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { IconArrowLeft, IconCheck } from '@tabler/icons-react';
import {
  PANEL_CODES,
  type DoorPickConfig,
  type LineAssignment,
  type PanelCode,
} from '@/lib/types';

function toDatetimeLocalValue(iso: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.slice(0, 19);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

const ASSIGNMENT_OPTIONS: { label: string; value: LineAssignment }[] = [
  { label: 'LÍNEA A', value: 'A' },
  { label: 'LÍNEA B', value: 'B' },
  { label: 'NINGUNA', value: null },
];

export function ConfigForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedBanner, setSavedBanner] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fechaInicio, setFechaInicio] = useState('');
  const [assignments, setAssignments] = useState<Record<PanelCode, LineAssignment>>({
    FRLH: 'A',
    FRRH: 'A',
    RRLH: 'B',
    RRRH: 'B',
  });

  useEffect(() => {
    let active = true;

    const loadConfig = async () => {
      try {
        const res = await fetch('/api/config', { cache: 'no-store' });
        if (!res.ok) throw new Error('Error al cargar configuración');
        const data: DoorPickConfig = await res.json();
        if (!active) return;
        setFechaInicio(toDatetimeLocalValue(data.fechaInicioEvaluacion));
        setAssignments(data.assignments);
      } catch {
        if (active) setError('NO SE PUDO CARGAR LA CONFIGURACIÓN');
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadConfig();
    return () => {
      active = false;
    };
  }, []);

  const handleAssignmentChange = (code: PanelCode, value: LineAssignment) => {
    setSavedBanner(false);
    setAssignments((prev) => ({ ...prev, [code]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedBanner(false);
    setError(null);

    try {
      const res = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fechaInicioEvaluacion: fechaInicio,
          assignments,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Error al guardar configuración');
      }

      const updated: DoorPickConfig = await res.json();
      setFechaInicio(toDatetimeLocalValue(updated.fechaInicioEvaluacion));
      setAssignments(updated.assignments);
      setSavedBanner(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ERROR AL GUARDAR');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white text-black">
      <header className="w-full border-b-2 border-black bg-white px-4 py-3 flex items-center justify-between gap-4">
        <span className="font-mono text-2xl font-bold tracking-widest text-black select-none">
          DOORPICK
        </span>

        <Link
          href="/"
          className="inline-flex items-center gap-2 border-2 border-black bg-white px-4 py-1.5 font-mono text-sm font-bold tracking-wider text-black hover:bg-black hover:text-white transition-colors"
        >
          <IconArrowLeft size={18} stroke={2} />
          <span>VOLVER</span>
        </Link>
      </header>

      <main className="flex-1 p-6 max-w-3xl w-full mx-auto">
        <div className="border-b-2 border-black pb-3 mb-6">
          <h1 className="font-mono text-xl font-bold tracking-widest uppercase">
            CONFIGURACIÓN DE LÍNEAS
          </h1>
        </div>

        {loading ? (
          <div className="border-2 border-black p-8 font-mono text-sm font-bold tracking-widest">
            CARGANDO CONFIGURACIÓN...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-8">
            {/* Panel Assignments */}
            <section className="flex flex-col gap-3">
              <h2 className="font-mono text-xs font-bold tracking-widest text-neutral-600 uppercase">
                ASIGNACIÓN DE PANELES POR LÍNEA
              </h2>

              <div className="border-2 border-black divide-y-2 divide-black">
                {PANEL_CODES.map((code) => (
                  <div
                    key={code}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white"
                  >
                    <span className="font-mono text-xl font-bold tracking-wider text-black">
                      {code}
                    </span>

                    <div
                      className="inline-flex border-2 border-black"
                      role="group"
                      aria-label={`Asignación para ${code}`}
                    >
                      {ASSIGNMENT_OPTIONS.map((opt, idx) => {
                        const selected = assignments[code] === opt.value;
                        return (
                          <button
                            key={opt.label}
                            type="button"
                            onClick={() => handleAssignmentChange(code, opt.value)}
                            className={`px-4 py-2 font-mono text-xs sm:text-sm font-bold tracking-wider transition-colors cursor-pointer ${idx > 0 ? 'border-l-2 border-black' : ''
                              } ${selected
                                ? 'bg-black text-white'
                                : 'bg-white text-black hover:bg-neutral-100'
                              }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Fecha Inicio Evaluacion */}
            <section className="flex flex-col gap-2">
              <label
                htmlFor="fecha-inicio-evaluacion"
                className="font-mono text-xs font-bold tracking-widest text-neutral-600 uppercase"
              >
                Fecha de inicio de evaluación de paneles
              </label>
              <input
                id="fecha-inicio-evaluacion"
                type="datetime-local"
                step="1"
                required
                value={fechaInicio}
                onChange={(e) => {
                  setSavedBanner(false);
                  setFechaInicio(e.target.value);
                }}
                className="border-2 border-black bg-white px-4 py-3 font-mono text-base font-bold text-black focus:outline-none"
              />
            </section>

            {error && (
              <div className="border-2 border-[#CC0000] bg-[#CC0000] text-white px-4 py-3 font-mono text-sm font-bold tracking-wider">
                {error}
              </div>
            )}

            {savedBanner && (
              <div className="border-2 border-[#15803D] bg-[#15803D] text-white px-4 py-3 font-mono text-sm font-bold tracking-wider flex items-center gap-2">
                <IconCheck size={18} stroke={2.5} />
                <span>CONFIGURACIÓN GUARDADA</span>
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="border-2 border-black bg-black text-white px-6 py-4 font-mono text-base font-bold tracking-widest uppercase hover:bg-neutral-800 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {saving ? 'GUARDANDO...' : 'GUARDAR CONFIGURACIÓN'}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
