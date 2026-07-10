import { Plus, RefreshCw, TrainFront } from "lucide-react";
import { STATUS_TABS } from "../constants";
import type { StatusTab } from "../types";

type Props = {
  status: StatusTab;
  total: number;
  loading: boolean;
  onRefresh: () => void;
  onNuevo?: () => void;
  compact?: boolean;
};

export function NaturalesHeader({ status, total, loading, onRefresh, onNuevo, compact = false }: Props) {
  return (
    <div className={`border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 ${compact ? "p-4" : "p-4 sm:p-5"}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className={`flex shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white ${compact ? "h-10 w-10" : "h-12 w-12"}`}>
            <TrainFront className={compact ? "h-5 w-5" : "h-6 w-6"} />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-400">Torreón</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h2 className={`${compact ? "text-xl" : "text-2xl"} font-black text-slate-950 dark:text-white`}>Movimientos naturales</h2>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {STATUS_TABS.find((tab) => tab.value === status)?.label}
              </span>
            </div>
            <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
              {compact ? "Cola operativa de locomotoras" : "Consulta operativa e historial"}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
            <span className="text-emerald-600">{total}</span> registros
          </div>
          {onNuevo && (
            <button
              type="button"
              onClick={onNuevo}
              disabled={loading}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60"
            >
              <Plus className="h-5 w-5" />
              Nuevo
            </button>
          )}
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </button>
        </div>
      </div>
    </div>
  );
}
