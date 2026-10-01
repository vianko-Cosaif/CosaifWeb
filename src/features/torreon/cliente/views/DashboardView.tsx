import type { ReactNode } from "react";
import { AlertTriangle, Boxes, FileClock, Plus, RefreshCw, Play } from "lucide-react";
import type { Arrastre, DailyInfo, IncidenteArrastre } from "@/features/torreon/arrastres";
import { ArrastreTerminalTable } from "../components";
import type { ClienteArrastreStats } from "../types";
import type { RealtimeConnectionStatus } from "@/features/movimientos/useRealtimeMovimientos";
import { TorreonRealtimeBadge } from "@/features/torreon/components/TorreonRealtimeBadge";
import { TorreonModeIntro } from "@/features/torreon/components/TorreonModeIntro";
import { isArrastreEditable, statusText } from "../utils";
import { RailMetrics } from "../../presentation/RailPrimitives";
import s from "../../presentation/rail.module.scss";
import ArrastreFocus from "../../arrastres/components/ArrastreFocus";

type Props = {
  feedback: ReactNode;
  stats: ClienteArrastreStats;
  activeArrastres: Arrastre[];
  dailyCounters: Map<number, DailyInfo>;
  loading: boolean;
  refreshing: boolean;
  busyAction: string | null;
  realtimeStatus: RealtimeConnectionStatus;
  empresaId: number | null;
  canPrioritizeByIncident?: boolean;
  onMovimientos: () => void;
  onCrear: () => void;
  onRefresh: () => void;
  onEditArrastre: (arrastre: Arrastre) => void;
  onCancel: (arrastre: Arrastre) => void;
  onPrioritizeSolicitud: (arrastre: Arrastre) => void;
  onIncidentSelect: (incident: IncidenteArrastre, arrastre: Arrastre) => void;
};

function hasVagonEnProceso(arrastre: Arrastre) {
  return (arrastre.vagones || []).some((vagon) => statusText(vagon.estado) === "EN_PROCESO");
}

function canReorderSolicitud(arrastre: Arrastre) {
  return isArrastreEditable(arrastre.estado) && !hasVagonEnProceso(arrastre);
}

export function DashboardView({
  feedback,
  stats,
  activeArrastres,
  dailyCounters,
  loading,
  refreshing,
  busyAction,
  realtimeStatus,
  empresaId,
  canPrioritizeByIncident,
  onMovimientos,
  onCrear,
  onRefresh,
  onEditArrastre,
  onCancel,
  onPrioritizeSolicitud,
  onIncidentSelect,
}: Props) {
  const manageableArrastres = empresaId
    ? activeArrastres.filter((arrastre) => Number(arrastre.empresaId) === empresaId)
    : [];
  const manageableRowIds = manageableArrastres.map((arrastre) => arrastre.id);
  const editableSolicitudIds = manageableArrastres
    .filter(canReorderSolicitud)
    .map((arrastre) => arrastre.id);
  const hasOpenIncident = manageableArrastres.some((arrastre) =>
    (arrastre.incidentes || []).some((incident) => statusText(incident.estado) === "ABIERTO"),
  );

  return (
    <div className={s.workspace} data-mode="arrastres">
      {feedback}
      <TorreonModeIntro
        mode="arrastres"
        heading="h1"
        title="Arrastres de Torreón"
        actions={
          <>
            <TorreonRealtimeBadge status={realtimeStatus} />
            <button type="button" className={s.button} onClick={onMovimientos}>
              Ver seguimiento
            </button>
            <button type="button" className={s.primaryButton} onClick={onCrear}>
              <Plus size={16} aria-hidden />
              Solicitar arrastre
            </button>
            {realtimeStatus !== "connected" ? (
              <button type="button" className={s.button} onClick={onRefresh} disabled={refreshing}>
                <RefreshCw size={16} aria-hidden />
                Reintentar
              </button>
            ) : null}
          </>
        }
      />
      <RailMetrics
        items={[
          {
            icon: FileClock,
            label: "En espera",
            value: stats.solicitados,
            hint: "Solicitudes por atender",
          },
          { icon: Play, label: "En movimiento", value: stats.proceso, hint: "Operación en curso" },
          {
            icon: AlertTriangle,
            label: "Pausados",
            value: stats.detenidos,
            hint: "Requieren seguimiento",
          },
          {
            icon: Boxes,
            label: "Vagones por mover",
            value: stats.pendientesVagon,
            hint: "Pendientes en el patio",
          },
        ]}
      />
      {loading ? (
        <div className={s.loading} role="status">
          Cargando operación del patio…
        </div>
      ) : (
        <>
          <ArrastreFocus rows={activeArrastres} />
          <ArrastreTerminalTable
            rows={activeArrastres}
            dailyCounters={dailyCounters}
            busyAction={busyAction}
            title="Cola actual de arrastres"
            pageSize={5}
            emptyText="No hay arrastres activos en tu localidad."
            editableSolicitudIds={editableSolicitudIds}
            manageableRowIds={manageableRowIds}
            canPrioritizeByIncident={canPrioritizeByIncident ?? hasOpenIncident}
            onEditArrastre={onEditArrastre}
            onCancel={onCancel}
            onPrioritizeSolicitud={onPrioritizeSolicitud}
            onIncidentSelect={onIncidentSelect}
          />
          {stats.total > activeArrastres.length ? (
            <button type="button" className={s.button} onClick={onMovimientos}>
              Ver las {stats.total} solicitudes y sus filtros
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}
