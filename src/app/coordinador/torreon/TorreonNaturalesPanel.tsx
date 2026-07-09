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
  apiBase?: string;
};

export default function TorreonNaturalesPanel({ localidadId, apiBase }: Props) {
  const naturales = useTorreonNaturales(localidadId, apiBase);
  const [selected, setSelected] = useState<MovimientoNatural | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<SelectedIncident | null>(null);

  async function openFotos(row: MovimientoNatural) {
    setSelected(row);
    const currentFotos = row.fotos?.length ?? 0;
    if ((row.fotosCount ?? 0) <= currentFotos) return;

    const params = new URLSearchParams({
      localidadId: String(localidadId),
      id: String(row.id),
    });
    const response = await fetch(`/api/coordinador/torreon/movimientos?${params.toString()}`, {
      cache: "no-store",
      credentials: "include",
    }).catch(() => null);
    const payload = await response?.json().catch(() => null);
    if (!response?.ok || !payload?.data) return;
    setSelected((current) => current && String(current.id) === String(row.id) ? payload.data : current);
  }

  function openIncident(payload: SelectedIncident) {
    setSelectedIncident(payload);
    const incidentId = Number(payload.incident.id);
    const currentFotos = payload.incident.fotos?.length ?? 0;
    if (!Number.isFinite(incidentId) || (payload.incident.fotosCount ?? 0) <= currentFotos) return;

    const params = new URLSearchParams({
      source: "torreon",
      tipo: "NATURAL",
      localidadId: String(localidadId),
    });
    fetch(`/api/incidentes/${incidentId}?${params.toString()}`, {
      cache: "no-store",
      credentials: "include",
    })
      .then((response) => response.ok ? response.json() : null)
      .then((responsePayload) => {
        const detail = responsePayload?.data;
        if (!detail) return;
        setSelectedIncident((current) => (
          current && Number(current.incident.id) === incidentId
            ? { ...current, incident: { ...current.incident, ...detail } }
            : current
        ));
      })
      .catch(() => undefined);
  }

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
          empresaId={naturales.empresaId}
          empresas={naturales.empresas}
          onEmpresaChange={naturales.setEmpresaId}
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
          onOpenFotos={openFotos}
          onOpenIncident={openIncident}
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
