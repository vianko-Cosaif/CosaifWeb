import { useMemo, type ReactNode } from "react";
import { TrainFront } from "lucide-react";
import type { Arrastre, DailyInfo, IncidenteArrastre, VagonArrastre } from "@/features/torreon/arrastres";
import { ArrastreTerminalTable, EmptyState, ModuleHeader, MovimientoToolbar } from "../components";
import type { Ambito } from "../types";
import { isArrastreEditable, statusText } from "../utils";

type Props = {
  feedback: ReactNode;
  ambito: Ambito;
  search: string;
  dateFilter: string;
  refreshing: boolean;
  loading: boolean;
  visibleArrastres: Arrastre[];
  activeCount: number;
  pastCount: number;
  busyAction: string | null;
  dailyCounters: Map<number, DailyInfo>;
  manageableRowIds: number[];
  canPrioritizeByIncident: boolean;
  onAmbito: (ambito: Ambito) => void;
  onSearch: (value: string) => void;
  onDateFilter: (value: string) => void;
  onRefresh: () => void;
  onNuevo: () => void;
  onEditArrastre: (arrastre: Arrastre) => void;
  onEditVagon: (arrastre: Arrastre, vagon: VagonArrastre) => void;
  onPrioritizeSolicitud: (arrastre: Arrastre) => void;
  onReorderVagon: (arrastre: Arrastre, vagon: VagonArrastre, direction: "up" | "down") => void;
  onReorderSolicitud: (arrastre: Arrastre, direction: "up" | "down") => void;
  onCancel: (arrastre: Arrastre) => void;
  onIncidentSelect: (incident: IncidenteArrastre, arrastre: Arrastre) => void;
};

function hasVagonEnProceso(arrastre: Arrastre) {
  return (arrastre.vagones || []).some((vagon) => statusText(vagon.estado) === "EN_PROCESO");
}

function canReorderSolicitud(arrastre: Arrastre) {
  return isArrastreEditable(arrastre.estado) && !hasVagonEnProceso(arrastre);
}

export function MovimientosView({
  feedback,
  ambito,
  search,
  dateFilter,
  refreshing,
  loading,
  visibleArrastres,
  activeCount,
  pastCount,
  busyAction,
  dailyCounters,
  manageableRowIds,
  canPrioritizeByIncident,
  onAmbito,
  onSearch,
  onDateFilter,
  onRefresh,
  onNuevo,
  onEditArrastre,
  onEditVagon,
  onPrioritizeSolicitud,
  onReorderVagon,
  onReorderSolicitud,
  onCancel,
  onIncidentSelect,
}: Props) {
  const manageableIds = useMemo(() => new Set(manageableRowIds), [manageableRowIds]);
  const editableSolicitudIds = useMemo(
    () => visibleArrastres
      .filter((arrastre) => manageableIds.has(arrastre.id) && canReorderSolicitud(arrastre))
      .map((arrastre) => arrastre.id),
    [manageableIds, visibleArrastres],
  );
  return (
    <section className="min-w-0 w-full overflow-x-hidden overflow-y-visible rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text)] shadow-[var(--app-shadow-sm)]">
      <div className="flex min-h-[calc(100svh-7rem)] flex-col gap-5 px-3 py-4 sm:px-5 sm:py-6 lg:px-7">
        <ModuleHeader title="Seguimiento de arrastres" subtitle="Solicitudes, turnos y avance" chip={ambito === "actuales" ? "Activos" : "Historial"} total={visibleArrastres.length} icon={TrainFront} />
        <div className="h-px bg-gradient-to-r from-transparent via-emerald-300/40 to-transparent" />
        {feedback}
        <MovimientoToolbar
          ambito={ambito}
          search={search}
          dateFilter={dateFilter}
          refreshing={refreshing}
          actuales={activeCount}
          pasados={pastCount}
          onAmbito={onAmbito}
          onSearch={onSearch}
          onDateFilter={onDateFilter}
          onRefresh={onRefresh}
          onNuevo={onNuevo}
        />

        {loading ? (
          <div className="h-72 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-900" />
        ) : visibleArrastres.length ? (
          <ArrastreTerminalTable
            rows={visibleArrastres}
            dailyCounters={dailyCounters}
            busyAction={busyAction}
            title={ambito === "actuales" ? "Solicitudes activas" : "Historial de arrastres"}
            subtitle={ambito === "actuales" ? "Seguimiento" : "Operaciones anteriores"}
            pageSize={6}
            editableSolicitudIds={editableSolicitudIds}
            manageableRowIds={manageableRowIds}
            canPrioritizeByIncident={canPrioritizeByIncident}
            onEditArrastre={onEditArrastre}
            onEditVagon={onEditVagon}
            onPrioritizeSolicitud={onPrioritizeSolicitud}
            onReorderVagon={onReorderVagon}
            onReorderSolicitud={onReorderSolicitud}
            onCancel={onCancel}
            onIncidentSelect={onIncidentSelect}
          />
        ) : (
          <EmptyState
            text={search || dateFilter ? "Sin resultados con estos filtros" : ambito === "actuales" ? "No hay arrastres activos" : "No hay arrastres en el historial"}
            hint={search || dateFilter ? "Ajusta la búsqueda o limpia los filtros para ver los registros disponibles." : ambito === "actuales" ? "Las solicitudes pendientes aparecerán aquí para darles seguimiento." : "Los arrastres concluidos o cancelados aparecerán aquí."}
          />
        )}
      </div>
    </section>
  );
}
