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
    <section className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-3 shadow-[var(--app-shadow-sm)]">
      <div className="grid gap-3 xl:grid-cols-[minmax(240px,320px)_minmax(280px,1fr)_auto] xl:items-center">
        <div className="grid grid-cols-2 rounded-md bg-[var(--app-surface-muted)] p-1">
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
                  ? "bg-[var(--app-surface)] text-[var(--app-text)] shadow-sm"
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
            className="h-11 w-full rounded-md border border-[var(--app-border)] bg-[var(--app-surface-subtle)] pl-9 pr-3 text-sm font-semibold text-[var(--app-text)] outline-none transition placeholder:text-[var(--app-text-soft)] focus:border-[var(--app-accent)] focus:ring-2 focus:ring-[var(--app-focus)]"
          />
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing || loading}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-sm font-black text-[var(--app-text-muted)] shadow-sm transition hover:bg-[var(--app-surface-subtle)] disabled:opacity-50"
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
            className="h-11 rounded-md border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-3 text-sm font-bold text-[var(--app-text)] outline-none focus:border-[var(--app-accent)] focus:ring-2 focus:ring-[var(--app-focus)]"
          />
        </label>
        <label className="grid gap-1">
          <span className="text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Hasta</span>
          <input
            type="datetime-local"
            value={toDateInput(filters.fechaFin)}
            onChange={(event) => setDate("fechaFin", event.target.value)}
            className="h-11 rounded-md border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-3 text-sm font-bold text-[var(--app-text)] outline-none focus:border-[var(--app-accent)] focus:ring-2 focus:ring-[var(--app-focus)]"
          />
        </label>
        <label className="grid gap-1">
          <span className="text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Por pagina</span>
          <select
            value={filters.pageSize ?? 25}
            onChange={(event) => onFiltersChange({ pageSize: Number(event.target.value), page: 1 })}
            className="h-11 rounded-md border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-3 text-sm font-black text-[var(--app-text)] outline-none focus:border-[var(--app-accent)] focus:ring-2 focus:ring-[var(--app-focus)]"
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
