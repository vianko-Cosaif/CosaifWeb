"use client";

import { RefreshCw, X } from "lucide-react";
import Button from "@/components/ui/Button";
import SearchInput from "@/components/ui/SearchInput";
import SegmentedControl from "@/components/ui/SegmentedControl";
import { GuidedTarget } from "@/features/capacitacion";
import type { TornoFilters, TornoHistoryTab } from "../../lib/types";

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
    const date = value ? new Date(value) : null;
    if (date && Number.isNaN(date.getTime())) return;
    onFiltersChange({ [key]: date?.toISOString() ?? null, page: 1 });
  };

  return (
    <GuidedTarget
      id="torno-history-filters"
      as="section"
      className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-[var(--app-shadow-sm)] sm:p-5"
    >
      <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(240px,320px)_minmax(0,1fr)_auto] xl:items-end">
        <GuidedTarget id="torno-history-scope-tabs">
          <SegmentedControl value={tab} onChange={onTabChange} ariaLabel="Periodo de servicios de torno" className="w-full [&>button]:flex-1" options={[{ value: "activos", label: "Actuales" }, { value: "concluidos", label: "Pasados" }]} />
        </GuidedTarget>
        <GuidedTarget id="torno-history-search" className="min-w-0">
          <SearchInput value={filters.search ?? ""} onChange={onSearch} onClear={() => onSearch("")} label="Buscar servicios por locomotora, cliente o folio" placeholder="Locomotora, cliente o folio…" inputClassName="text-base sm:text-sm" />
        </GuidedTarget>
        <Button onClick={onRefresh} loading={refreshing} disabled={loading} leftIcon={<RefreshCw className="h-4 w-4" aria-hidden />}>Actualizar</Button>
      </div>

      <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_140px_auto] xl:items-end">
        <label className="grid min-w-0 gap-1.5">
          <span className="text-xs font-semibold text-[var(--app-text-muted)]">Desde</span>
          <input
            type="datetime-local"
            value={toDateInput(filters.fechaInicio)}
            max={toDateInput(filters.fechaFin) || undefined}
            onChange={(event) => setDate("fechaInicio", event.target.value)}
            className="h-11 w-full min-w-0 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-3 text-base font-medium sm:text-sm text-[var(--app-text)] outline-none focus:border-[var(--app-accent)] focus:ring-2 focus:ring-[var(--app-focus)]"
          />
        </label>
        <label className="grid min-w-0 gap-1.5">
          <span className="text-xs font-semibold text-[var(--app-text-muted)]">Hasta</span>
          <input
            type="datetime-local"
            value={toDateInput(filters.fechaFin)}
            min={toDateInput(filters.fechaInicio) || undefined}
            onChange={(event) => setDate("fechaFin", event.target.value)}
            className="h-11 w-full min-w-0 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-3 text-base font-medium sm:text-sm text-[var(--app-text)] outline-none focus:border-[var(--app-accent)] focus:ring-2 focus:ring-[var(--app-focus)]"
          />
        </label>
        <label className="grid min-w-0 gap-1.5">
          <span className="text-xs font-semibold text-[var(--app-text-muted)]">Por página</span>
          <select
            value={filters.pageSize ?? 25}
            onChange={(event) => onFiltersChange({ pageSize: Number(event.target.value), page: 1 })}
            className="h-11 w-full min-w-0 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-3 text-base font-medium sm:text-sm text-[var(--app-text)] outline-none focus:border-[var(--app-accent)] focus:ring-2 focus:ring-[var(--app-focus)]"
          >
            {[10, 25, 50, 100].map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </label>
        <Button variant="secondary" disabled={!filters.fechaInicio && !filters.fechaFin} onClick={() => onFiltersChange({ fechaInicio: null, fechaFin: null, page: 1 })} leftIcon={<X className="h-4 w-4" aria-hidden />}>Limpiar fechas</Button>
      </div>
    </GuidedTarget>
  );
}

function toDateInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
