import { useMemo, type ReactNode } from "react";
import { TrainFront, Plus } from "lucide-react";
import type {
  Arrastre,
  DailyInfo,
  IncidenteArrastre,
  VagonArrastre,
} from "@/features/torreon/arrastres";
import { ArrastreTerminalTable, EmptyState, MovimientoToolbar } from "../components";
import type { Ambito } from "../types";
import { isArrastreEditable, statusText } from "../utils";
import type { TorreonPageMeta } from "../../useTorreonCollection";
import s from "../../presentation/rail.module.scss";
import PaginationBar from "@/components/ui/PaginationBar";

type Props = {
  feedback: ReactNode;
  ambito: Ambito;
  search: string;
  dateFilter: string;
  refreshing: boolean;
  loading: boolean;
  visibleArrastres: Arrastre[];
  activeCount?: number;
  pastCount?: number;
  pagination?: TorreonPageMeta & { onPage: (page: number) => void };
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
  pagination,
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
    () =>
      visibleArrastres
        .filter((arrastre) => manageableIds.has(arrastre.id) && canReorderSolicitud(arrastre))
        .map((arrastre) => arrastre.id),
    [manageableIds, visibleArrastres],
  );
  return (
    <section className={s.workspace}>
      <header className={s.pageHeader}>
        <div>
          <p className={s.eyebrow}>
            <TrainFront size={15} aria-hidden />
            Torreón · Arrastres
          </p>
          <h1 className={s.title}>Seguimiento de arrastres</h1>
          <p className={s.subtitle}>Cada turno, recorrido y vagón en un solo lugar.</p>
        </div>
        <button type="button" className={s.primaryButton} onClick={onNuevo}>
          <Plus size={16} aria-hidden />
          Solicitar arrastre
        </button>
      </header>
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
        <div className={s.loading} role="status">
          Cargando solicitudes…
        </div>
      ) : visibleArrastres.length ? (
        <ArrastreTerminalTable
          rows={visibleArrastres}
          dailyCounters={dailyCounters}
          busyAction={busyAction}
          title={ambito === "actuales" ? "Solicitudes activas" : "Historial de arrastres"}
          subtitle={ambito === "actuales" ? "Seguimiento" : "Operaciones anteriores"}
          pageSize={pagination?.pageSize ?? 8}
          hidePagination={Boolean(pagination)}
          editableSolicitudIds={editableSolicitudIds}
          manageableRowIds={manageableRowIds}
          canPrioritizeByIncident={canPrioritizeByIncident}
          onEditArrastre={ambito === "actuales" ? onEditArrastre : undefined}
          onEditVagon={ambito === "actuales" ? onEditVagon : undefined}
          onPrioritizeSolicitud={ambito === "actuales" ? onPrioritizeSolicitud : undefined}
          onReorderVagon={ambito === "actuales" ? onReorderVagon : undefined}
          onReorderSolicitud={ambito === "actuales" ? onReorderSolicitud : undefined}
          onCancel={ambito === "actuales" ? onCancel : undefined}
          onIncidentSelect={onIncidentSelect}
        />
      ) : (
        <EmptyState
          text={
            search || dateFilter
              ? "Sin resultados con estos filtros"
              : ambito === "actuales"
                ? "No hay arrastres activos"
                : "No hay arrastres en el historial"
          }
          hint={
            search || dateFilter
              ? "Ajusta la búsqueda o limpia los filtros para ver los registros disponibles."
              : ambito === "actuales"
                ? "Las solicitudes pendientes aparecerán aquí para darles seguimiento."
                : "Los arrastres concluidos o cancelados aparecerán aquí."
          }
        />
      )}
      {pagination && !loading ? (
        <PaginationBar
          page={pagination.page}
          totalPages={pagination.totalPages}
          totalItems={pagination.total}
          pageSize={pagination.pageSize}
          onPageChange={pagination.onPage}
        />
      ) : null}
    </section>
  );
}
