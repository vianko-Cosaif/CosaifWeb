"use client";

import { CheckCircle2, Save } from "lucide-react";
import { useEffect, useState } from "react";
import type { TornoMeasures } from "../../lib/types";
import { cn, normalizeMeasureInput, TORNO_MEASURE_POSITIONS } from "../../lib/tornoFormat";

export default function TornoFinalMeasuresForm({
  requested,
  final,
  canEdit,
  canConclude,
  busy,
  onSave,
  onConclude,
}: {
  requested?: TornoMeasures;
  final?: TornoMeasures;
  canEdit: boolean;
  canConclude: boolean;
  busy?: boolean;
  onSave?: (measures: TornoMeasures) => Promise<void>;
  onConclude?: (measures: TornoMeasures) => Promise<void>;
}) {
  const [values, setValues] = useState(() => normalizeMeasureInput(final ?? requested));

  useEffect(() => {
    setValues(normalizeMeasureInput(final ?? requested));
  }, [final, requested]);

  const measures = values as TornoMeasures;
  const valid = TORNO_MEASURE_POSITIONS.every((position) => String(values[position] ?? "").trim().length > 0);

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <div>
          <h3 className="text-sm font-black text-slate-950 dark:text-slate-100">Medidas finales</h3>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Registro final por lado y eje.
          </p>
        </div>
        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy || !valid}
              onClick={() => onSave?.(measures)}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
            >
              <Save className="h-4 w-4" />
              Guardar
            </button>
            {canConclude && (
              <button
                type="button"
                disabled={busy || !valid}
                onClick={() => onConclude?.(measures)}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-emerald-600 px-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400"
              >
                <CheckCircle2 className="h-4 w-4" />
                Concluir
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {TORNO_MEASURE_POSITIONS.map((position) => (
          <label key={position} className="grid gap-1">
            <span className="text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {position}
            </span>
            <input
              value={values[position]}
              readOnly={!canEdit}
              onChange={(event) => setValues((prev) => ({ ...prev, [position]: event.target.value }))}
              className={cn(
                "h-11 rounded-md border px-3 text-sm font-black outline-none transition",
                canEdit
                  ? "border-slate-200 bg-white text-slate-900 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-cyan-950"
                  : "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200",
              )}
            />
          </label>
        ))}
      </div>
    </section>
  );
}
