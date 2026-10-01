"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Movimiento } from "../../Movimiento";
import type { TornoAutocompleteConflict } from "../tornoAutocomplete";

type Props = {
  open: boolean;
  conflicts: readonly TornoAutocompleteConflict[];
  onCancel: () => void;
  onApply: (decisions: Record<string, string | null>) => void;
};

export default function TornoAutocompleteConflictDialog({
  open,
  conflicts,
  onCancel,
  onApply,
}: Props) {
  const [decisions, setDecisions] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (!open) return;
    setDecisions(Object.fromEntries(conflicts.map((conflict) => [conflict.id, null])));
  }, [conflicts, open]);

  const chosenCount = useMemo(
    () => Object.values(decisions).filter(Boolean).length,
    [decisions]
  );

  if (!open || conflicts.length === 0) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100020] flex items-end justify-center bg-black/45 p-3 sm:items-center">
      <div className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-black text-slate-900 dark:text-white">Resolver autocompletado</h4>
              <p className="mt-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                Hay medidas distintas. Elige una medida para unificar el grupo o conserva lo capturado.
              </p>
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              aria-label="Cerrar panel"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          <div className="grid gap-3">
            {conflicts.map((conflict) => {
              const selected = decisions[conflict.id] ?? null;
              return (
                <div
                  key={conflict.id}
                  className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950/40"
                >
                  <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-black text-slate-900 dark:text-white">{conflict.label}</div>
                      <div className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{conflict.description}</div>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-black text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                      {conflict.targets.length} celdas
                    </span>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {conflict.options.map((option) => (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => setDecisions((current) => ({ ...current, [conflict.id]: option.key }))}
                        className={Movimiento.clsx(
                          "min-h-11 rounded-xl border px-3 py-2 text-left text-sm font-black transition-colors",
                          selected === option.key
                            ? "border-emerald-600 bg-emerald-600 text-white"
                            : "border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setDecisions((current) => ({ ...current, [conflict.id]: null }))}
                      className={Movimiento.clsx(
                        "min-h-11 rounded-xl border px-3 py-2 text-left text-sm font-black transition-colors",
                        selected === null
                          ? "border-slate-500 bg-slate-700 text-white"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                      )}
                    >
                      Conservar actuales
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            {chosenCount} grupo(s) se unificaran
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => onApply(decisions)}
              className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              Aplicar decisiones
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
