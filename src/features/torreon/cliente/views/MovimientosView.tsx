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
  canPrioritizeByIncident: boolean;
  onAmbito: (ambito: Ambito) => void;
  onSearch: (value: string) => void;
  onDateFilter: (value: string) => void;
  onRefresh: () => void;
  onNuevo: () => void;
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
  canPrioritizeByIncident,
  onAmbito,
  onSearch,
  onDateFilter,
  onRefresh,
  onNuevo,
  onEditVagon,
  onPrioritizeSolicitud,
  onReorderVagon,
  onReorderSolicitud,
  onCancel,
  onIncidentSelect,
}: Props) {
  const editableSolicitudIds = useMemo(() => visibleArrastres.filter(canReorderSolicitud).map((arrastre) => arrastre.id), [visibleArrastres]);
  return (
    <section className="w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 text-slate-900 shadow-xl shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:shadow-black/30">
      <div className="flex min-h-[calc(100svh-7rem)] flex-col gap-5 px-3 py-4 sm:px-5 sm:py-6 lg:px-7">
        <ModuleHeader title="Movimientos" chip={ambito === "actuales" ? "Actuales" : "Pasados"} total={visibleArrastres.length} icon={TrainFront} />
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
            title="Terminal de rondas"
            subtitle="Cola operativa"
            pageSize={6}
            editableSolicitudIds={editableSolicitudIds}
            canPrioritizeByIncident={canPrioritizeByIncident}
            onEditVagon={onEditVagon}
            onPrioritizeSolicitud={onPrioritizeSolicitud}
            onReorderVagon={onReorderVagon}
            onReorderSolicitud={onReorderSolicitud}
            onCancel={onCancel}
            onIncidentSelect={onIncidentSelect}
          />
        ) : (
          <EmptyState
            text={ambito === "actuales" ? "No hay rondas activas" : "No hay rondas pasadas"}
            hint={search ? "Ajusta la busqueda o cambia de pestana" : "Cuando se soliciten arrastres apareceran aqui"}
          />
        )}
      </div>
    </section>
  );
}
