"use client";

import { CalendarDays, Plus, RefreshCw, X } from "lucide-react";
import Button from "@/components/ui/Button";
import SearchInput from "@/components/ui/SearchInput";
import SegmentedControl from "@/components/ui/SegmentedControl";
import type { Ambito } from "../types";

type Props = {
  ambito: Ambito;
  search: string;
  dateFilter: string;
  refreshing: boolean;
  actuales: number;
  pasados: number;
  onAmbito: (ambito: Ambito) => void;
  onSearch: (value: string) => void;
  onDateFilter: (value: string) => void;
  onRefresh: () => void;
  onNuevo: () => void;
};

export function MovimientoToolbar({
  ambito, search, dateFilter, refreshing, actuales, pasados,
  onAmbito, onSearch, onDateFilter, onRefresh, onNuevo,
}: Props) {
  return (
    <section aria-label="Filtros de arrastres" className="min-w-0 space-y-4 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-subtle)] p-4 sm:p-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <SegmentedControl
          ariaLabel="Periodo de arrastres"
          value={ambito}
          onChange={onAmbito}
          className="w-full [&>button]:flex-1 xl:w-auto"
          options={[
            { value: "actuales", label: "Actuales", count: actuales },
            { value: "pasados", label: "Pasados", count: pasados },
          ]}
        />
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="lg" onClick={onRefresh} loading={refreshing} leftIcon={<RefreshCw className="h-4 w-4" aria-hidden />}>
            {refreshing ? "Actualizando…" : "Actualizar"}
          </Button>
          <Button variant="primary" size="lg" onClick={onNuevo} leftIcon={<Plus className="h-4 w-4" aria-hidden />}>
            Solicitar arrastre
          </Button>
        </div>
      </div>
      <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_220px] md:items-end">
        <div className="grid min-w-0 gap-1.5">
          <span className="text-xs font-semibold text-[var(--app-text-muted)]">Buscar arrastres</span>
          <SearchInput value={search} onChange={onSearch} onClear={() => onSearch("")} label="Buscar por folio, vagón, estado o vía" placeholder="Folio, vagón, estado o vía…" inputClassName="text-base sm:text-sm" />
        </div>
        <label className="grid min-w-0 gap-1.5">
          <span className="text-xs font-semibold text-[var(--app-text-muted)]">Fecha de solicitud</span>
          <span className="relative min-w-0">
            <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-text-soft)]" aria-hidden />
            <input type="date" value={dateFilter} onChange={(event) => onDateFilter(event.target.value)} className="h-11 w-full min-w-0 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] py-2 pl-10 pr-3 text-base text-[var(--app-text)] outline-none focus:border-[var(--app-accent)] focus:ring-2 focus:ring-[var(--app-focus)] sm:text-sm" />
          </span>
        </label>
      </div>
      {(search || dateFilter) && <Button variant="ghost" onClick={() => { onSearch(""); onDateFilter(""); }} leftIcon={<X className="h-4 w-4" aria-hidden />}>Limpiar filtros</Button>}
    </section>
  );
}
