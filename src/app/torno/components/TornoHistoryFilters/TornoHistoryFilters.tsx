"use client";

import { RefreshCw, Search, X } from "lucide-react";
import type { TornoFilters, TornoHistoryTab } from "../../lib/types";
import { cn } from "../../lib/tornoFormat";

export default function TornoHistoryFilters({
  tab,
  filters,
  refreshing,
  loading,
  onTabChange,
  onSearch,
  onFiltersChange,
  onRefresh,
}: {
  tab: TornoHistoryTab;
  filters: TornoFilters;
  refreshing: boolean;
  loading: boolean;
  onTabChange: (tab: TornoHistoryTab) => void;
  onSearch: (search: string) => void;
  onFiltersChange: (patch: Partial<TornoFilters>) => void;
  onRefresh: () => void;
}) {
  const setDate = (key: "fechaInicio" | "fechaFin", value: string) => {
    onFiltersChange({ [key]: value ? new Date(value).toISOString() : null, page: 1 });
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none">
      <div className="grid gap-3 xl:grid-cols-[minmax(240px,320px)_minmax(280px,1fr)_auto] xl:items-center">
        <div className="grid grid-cols-2 rounded-md bg-slate-100 p-1 dark:bg-slate-900">
          {[
            { id: "activos" as const, label: "Activos" },
            { id: "concluidos" as const, label: "Pasados" },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              className={cn(
                "min-h-10 rounded px-4 py-2 text-sm font-black transition",
                tab === item.id
                  ? "bg-white text-slate-950 shadow-sm dark:bg-slate-800 dark:text-white"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="relative min-w-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={filters.search ?? ""}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Buscar locomotora, cliente, folio..."
            className="h-11 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-cyan-950"
          />
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing || loading}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
        >
          <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          Actualizar
        </button>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_160px_auto] md:items-end">
        <label className="grid gap-1">
          <span className="text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Desde</span>
          <input
            type="datetime-local"
            value={toDateInput(filters.fechaInicio)}
            onChange={(event) => setDate("fechaInicio", event.target.value)}
            className="h-11 rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-cyan-950"
          />
        </label>
        <label className="grid gap-1">
          <span className="text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Hasta</span>
          <input
            type="datetime-local"
            value={toDateInput(filters.fechaFin)}
            onChange={(event) => setDate("fechaFin", event.target.value)}
            className="h-11 rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-cyan-950"
          />
        </label>
        <label className="grid gap-1">
          <span className="text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Por pagina</span>
          <select
            value={filters.pageSize ?? 25}
            onChange={(event) => onFiltersChange({ pageSize: Number(event.target.value), page: 1 })}
            className="h-11 rounded-md border border-slate-200 bg-white px-3 text-sm font-black text-slate-800 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-cyan-950"
          >
            {[10, 25, 50, 100].map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => onFiltersChange({ fechaInicio: null, fechaFin: null, page: 1 })}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 text-sm font-black text-rose-700 transition hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200"
        >
          <X className="h-4 w-4" />
          Fechas
        </button>
      </div>
    </section>
  );
}

function toDateInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
