import { Hash, UserRound } from "lucide-react";
import type { MovimientoNatural, SortKey } from "../types";
import { formatDate, formatDuration, getClientLabel, getMovimientoFolio, getOperatorLabel, normalizeStatus, statusClass } from "../utils";

type Props = {
  rows: MovimientoNatural[];
  sortKey: SortKey;
  loading: boolean;
  error: string | null;
};

export function NaturalesChronology({ rows, sortKey, loading, error }: Props) {
  if (loading || error || rows.length === 0) return null;

  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Orden operativo</p>
          <h3 className="text-lg font-black text-slate-950 dark:text-white">Cronología aplicada</h3>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          <Hash className="h-4 w-4 text-emerald-600" />
          {sortKey === "cronologia" ? "Inicio a cierre" : "Orden filtrado"}
        </div>
      </div>

      <div className="mt-3 grid gap-2 xl:grid-cols-3">
        {rows.map((row, index) => (
          <ChronologyCard key={`timeline-${row.id}`} row={row} index={index} />
        ))}
      </div>
    </div>
  );
}

function ChronologyCard({ row, index }: { row: MovimientoNatural; index: number }) {
  const state = normalizeStatus(row.estado);
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/40">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">
            #{index + 1} · Movimiento {getMovimientoFolio(row)}
          </p>
          <p className="mt-1 text-sm font-black text-slate-950 dark:text-white">
            Loco {row.locomotiveNumber || "--"} · {getClientLabel(row)}
          </p>
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-black ${statusClass(state)}`}>
          {state.replace(/_/g, " ")}
        </span>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <DateBox label="Inicio" value={formatDate(row.fechaInicio)} />
        <DateBox label="Fin" value={formatDate(row.fechaFin)} />
        <DateBox label="Tiempo" value={formatDuration(row.fechaInicio, row.fechaFin)} />
      </div>

      <div className="mt-2 flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-700 dark:bg-slate-900 dark:text-slate-300">
        <UserRound className="h-4 w-4 text-emerald-600" />
        {getOperatorLabel(row)}
      </div>
    </div>
  );
}

function DateBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white px-3 py-2 dark:bg-slate-900">
      <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-xs font-black text-slate-700 dark:text-slate-300">{value}</p>
    </div>
  );
}
