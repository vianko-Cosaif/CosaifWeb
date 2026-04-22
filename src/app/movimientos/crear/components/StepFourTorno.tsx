import React, { useMemo } from "react";
import type { MovementFormData } from "../../movimientos.shared";
import {
  formatTornoMeasure,
  getTornoPositions,
  EMPTY_TORNO_ROW,
  type TornoMedicionState,
} from "../tornoMedicion.types";
import {
  resolveTornoProfile,
  TORNO_PROFILE_FIELDS,
} from "../tornoProfiles";

type StepFourTornoProps = {
  form: MovementFormData;
  tornoMedicion: TornoMedicionState;
  companyName?: string;
  tornoMovimientoId: number | null;
  tornoPdfSending: boolean;
  tornoPdfStatus: string | null;
  onEditMedicion: () => void;
  onGeneratePdf: () => Promise<void>;
};

/**
 * Step 4 (Torno):
 * - Resumen final de mediciones capturadas.
 * - Envio simulado de datos torno + generacion de PDF.
 * - Acceso rapido para volver a Step 2 y editar.
 */
export default function StepFourTorno(props: StepFourTornoProps) {
  const {
    form,
    tornoMedicion,
    companyName,
    tornoMovimientoId,
    tornoPdfSending,
    tornoPdfStatus,
    onEditMedicion,
    onGeneratePdf,
  } = props;

  const profile = useMemo(() => resolveTornoProfile(companyName), [companyName]);
  const fieldDefs = TORNO_PROFILE_FIELDS[profile];
  const positions = useMemo(() => getTornoPositions(tornoMedicion.wheelCount), [tornoMedicion.wheelCount]);
  const dateText = useMemo(
    () => new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date()),
    []
  );

  return (
    <div className="grid gap-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 shadow-xl shadow-slate-200/40 dark:border-slate-800 dark:bg-[#0d1117] dark:text-slate-100 dark:shadow-zinc-900/30 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-700">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Resumen de Medidas</h3>
            <p className="text-xs text-slate-500 dark:text-slate-300">Verifique la informacion antes de finalizar el registro.</p>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-300">
            <span className="mr-3">Unidad: <strong className="text-slate-900 dark:text-white">{form.locomotiveNumber || "-"}</strong></span>
            <span>Fecha: <strong className="text-slate-900 dark:text-white">{dateText}</strong></span>
            {tornoMovimientoId ? (
              <span className="ml-3">Movimiento: <strong className="text-slate-900 dark:text-white">#{tornoMovimientoId}</strong></span>
            ) : null}
          </div>
        </div>

        <div className="mt-3 overflow-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="min-w-[980px] w-full text-sm">
            <thead className="bg-slate-100 dark:bg-slate-900/70">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Posicion</th>
                {fieldDefs.map((field) => (
                  <th key={field.key} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                    {field.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {positions.map((position) => {
                const row = tornoMedicion.rows[position] ?? EMPTY_TORNO_ROW;
                return (
                  <tr key={position} className="border-t border-slate-200 dark:border-slate-800">
                    <td className="px-3 py-2 font-semibold text-slate-800 dark:text-slate-200">{position}</td>
                    {fieldDefs.map((field) => (
                      <td key={`${position}_${field.key}`} className="px-3 py-2 text-slate-700 dark:text-slate-200">
                        {formatTornoMeasure(row[field.key]) || "-"}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-950/60">
          <div className="text-sm font-semibold text-slate-900 dark:text-white">Observaciones y Comentarios</div>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{form.comments?.trim() || "Sin comentarios."}</p>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={onEditMedicion}
          className="rounded-xl border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900/20"
        >
          Editar medicion
        </button>
        <button
          onClick={() => void onGeneratePdf()}
          disabled={tornoPdfSending}
          className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-bold text-white shadow shadow-emerald-500/20 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {tornoPdfSending ? "Generando..." : "Generar PDF"}
        </button>
        {tornoPdfStatus ? (
          <span className="text-xs text-slate-600 dark:text-slate-300">{tornoPdfStatus}</span>
        ) : null}
      </div>
    </div>
  );
}
