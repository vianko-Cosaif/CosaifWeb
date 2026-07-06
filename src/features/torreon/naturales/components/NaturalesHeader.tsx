import { RefreshCw, TrainFront } from "lucide-react";
import { STATUS_TABS } from "../constants";
import type { StatusTab } from "../types";

type Props = {
  status: StatusTab;
  total: number;
  loading: boolean;
  onRefresh: () => void;
};

export function NaturalesHeader({ status, total, loading, onRefresh }: Props) {
  return (
    <div className="border-b border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-200 dark:shadow-emerald-950/40">
            <TrainFront className="h-7 w-7" />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-400">Torreón</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-black text-slate-950 dark:text-white sm:text-3xl">Movimientos</h2>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {STATUS_TABS.find((tab) => tab.value === status)?.label}
              </span>
            </div>
            <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">Gestión ferroviaria · Torreón</p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
            <span className="text-emerald-600">{total}</span> registros
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </button>
        </div>
      </div>
    </div>
  );
}
