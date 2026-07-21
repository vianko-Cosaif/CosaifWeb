import type { ReactNode } from "react";
import { AlertTriangle, Boxes, FileClock, Plus, RefreshCw, TrainFront, Play } from "lucide-react";
import type { Arrastre, DailyInfo, IncidenteArrastre } from "@/features/torreon/arrastres";
import { ArrastreTerminalTable, Metric } from "../components";
import type { ClienteArrastreStats } from "../types";
import type { RealtimeConnectionStatus } from "@/app/hooks/useRealtimeMovimientos";
import { TorreonRealtimeBadge } from "@/features/torreon/components/TorreonRealtimeBadge";
import { isArrastreEditable, statusText } from "../utils";

type Props = {
  feedback: ReactNode;
  stats: ClienteArrastreStats;
  activeArrastres: Arrastre[];
  dailyCounters: Map<number, DailyInfo>;
  loading: boolean;
  refreshing: boolean;
  busyAction: string | null;
  realtimeStatus: RealtimeConnectionStatus;
  audience: "cliente" | "arrastre";
  empresaId: number | null;
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
  audience,
  empresaId,
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
  const editableSolicitudIds = manageableArrastres.filter(canReorderSolicitud).map((arrastre) => arrastre.id);
  const hasOpenIncident = manageableArrastres.some((arrastre) => (arrastre.incidentes || []).some((incident) => statusText(incident.estado) === "ABIERTO"));

  return (
    <>
      {feedback}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-col gap-4 border-b border-slate-200 px-4 py-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-black uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Torreón · Arrastres</p>
              <TorreonRealtimeBadge status={realtimeStatus} />
            </div>
            <h1 className="mt-2 text-2xl font-black text-slate-950 dark:text-white">
              Ronda general de tu localidad
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
              {audience === "arrastre"
                ? "Consulta el turno completo del patio y el avance de todas las rondas. Solo puedes editar o cancelar las solicitudes de tu empresa."
                : "Revisa todas las solicitudes activas de tu localidad. Las acciones permanecen limitadas a los movimientos de tu empresa."}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <DashboardButton onClick={onMovimientos} icon={TrainFront}>Ver seguimiento</DashboardButton>
            <button type="button" onClick={onCrear} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700">
              <Plus className="h-4 w-4" aria-hidden />
              Solicitar arrastre
            </button>
            {realtimeStatus !== "connected" ? (
              <button type="button" onClick={onRefresh} disabled={refreshing} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-600 shadow-sm disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" title="Reintentar conexión">
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden />
                Reintentar
              </button>
            ) : null}
          </div>
        </div>

        <div className="space-y-4 p-4 sm:p-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Metric icon={FileClock} label="En espera" value={stats.solicitados} />
            <Metric icon={Play} label="En movimiento" value={stats.proceso} />
            <Metric icon={AlertTriangle} label="Pausados" value={stats.detenidos} />
            <Metric icon={Boxes} label="Vagones por mover" value={stats.pendientesVagon} />
          </div>

          {loading ? (
            <div className="h-72 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-900" />
          ) : (
            <ArrastreTerminalTable
              rows={activeArrastres}
              dailyCounters={dailyCounters}
              busyAction={busyAction}
              title="Ronda general activa"
              subtitle="Todas las empresas de tu localidad"
              pageSize={5}
              emptyText="No hay arrastres activos en tu localidad."
              editableSolicitudIds={editableSolicitudIds}
              manageableRowIds={manageableRowIds}
              canPrioritizeByIncident={hasOpenIncident}
              onEditArrastre={onEditArrastre}
              onCancel={onCancel}
              onPrioritizeSolicitud={onPrioritizeSolicitud}
              onIncidentSelect={onIncidentSelect}
            />
          )}
        </div>
      </section>
    </>
  );
}

function DashboardButton({ children, onClick, icon: Icon }: { children: ReactNode; onClick: () => void; icon: typeof TrainFront }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
      <Icon className="h-4 w-4" aria-hidden />
      {children}
    </button>
  );
}
