"use client";

import { useState } from "react";
import TorreonIncidentDetailModal from "./TorreonIncidentDetailModal";
import {
  FotosModal,
  NaturalesChronology,
  NaturalesFilters,
  NaturalesHeader,
  NaturalesMetrics,
  NaturalesPagination,
  NaturalesTable,
  useTorreonNaturales,
  type MovimientoNatural,
  type SelectedIncident,
} from "@/features/torreon/naturales";

type Props = {
  localidadId: number;
};

export default function TorreonNaturalesPanel({ localidadId }: Props) {
  const naturales = useTorreonNaturales(localidadId);
  const [selected, setSelected] = useState<MovimientoNatural | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<SelectedIncident | null>(null);

  return (
    <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <NaturalesHeader
        status={naturales.status}
        total={naturales.filteredRows.length}
        loading={naturales.loading}
        onRefresh={naturales.load}
      />

      <div className="p-4 sm:p-5">
        <NaturalesFilters
          status={naturales.status}
          onStatusChange={naturales.setStatus}
          search={naturales.search}
          onSearchChange={naturales.setSearch}
          fechaCampo={naturales.fechaCampo}
          onFechaCampoChange={naturales.setFechaCampo}
          desde={naturales.desde}
          onDesdeChange={naturales.setDesde}
          hasta={naturales.hasta}
          onHastaChange={naturales.setHasta}
          sortKey={naturales.sortKey}
          onSortKeyChange={naturales.setSortKey}
          sortDir={naturales.sortDir}
          onSortDirChange={naturales.setSortDir}
          pageSize={naturales.pageSize}
          onPageSizeChange={naturales.setPageSize}
          onToday={naturales.applyToday}
          onClearDates={naturales.clearDates}
        />

        <NaturalesMetrics metrics={naturales.metrics} />
        <NaturalesChronology
          rows={naturales.chronologyRows}
          sortKey={naturales.sortKey}
          loading={naturales.loading}
          error={naturales.error}
        />
        <NaturalesTable
          rows={naturales.paginatedRows}
          loading={naturales.loading}
          error={naturales.error}
          page={naturales.safePage}
          pageSize={naturales.pageSize}
          onOpenFotos={setSelected}
          onOpenIncident={setSelectedIncident}
        />
        <NaturalesPagination
          loading={naturales.loading}
          error={naturales.error}
          total={naturales.filteredRows.length}
          page={naturales.safePage}
          totalPages={naturales.totalPages}
          pageSize={naturales.pageSize}
          onPageChange={naturales.setPage}
        />
      </div>

      {selected && <FotosModal movimiento={selected} onClose={() => setSelected(null)} />}
      {selectedIncident && (
        <TorreonIncidentDetailModal
          incident={selectedIncident.incident}
          title={selectedIncident.title}
          subtitle={selectedIncident.subtitle}
          onClose={() => setSelectedIncident(null)}
        />
      )}
    </section>
  );
}
