import type { ReactNode } from "react";
import { AlertTriangle, Boxes, CheckCircle2, FileClock, Plus, RefreshCw, TrainFront, Play } from "lucide-react";
import { DynamicBanner } from "@/app/Components/DynamicBanner";
import type { Arrastre, DailyInfo, IncidenteArrastre } from "@/features/torreon/arrastres";
import { ArrastreTerminalTable, Metric } from "../components";
import type { ClienteArrastreStats } from "../types";
import { isArrastreEditable, statusText } from "../utils";

type Props = {
  feedback: ReactNode;
  stats: ClienteArrastreStats;
  activeArrastres: Arrastre[];
  dailyCounters: Map<number, DailyInfo>;
  loading: boolean;
  refreshing: boolean;
  onMovimientos: () => void;
  onCrear: () => void;
  onRefresh: () => void;
  onPrioritizeSolicitud: (arrastre: Arrastre) => void;
  onIncidentSelect: (incident: IncidenteArrastre, arrastre: Arrastre) => void;
};

function hasVagonEnProceso(arrastre: Arrastre) {
  return (arrastre.vagones || []).some((vagon) => statusText(vagon.estado) === "EN_PROCESO");
}

function canReorderSolicitud(arrastre: Arrastre) {
  return isArrastreEditable(arrastre.estado) && !hasVagonEnProceso(arrastre);
}

export function DashboardView({ feedback, stats, activeArrastres, dailyCounters, loading, refreshing, onMovimientos, onCrear, onRefresh, onPrioritizeSolicitud, onIncidentSelect }: Props) {
  const editableSolicitudIds = activeArrastres.filter(canReorderSolicitud).map((arrastre) => arrastre.id);
  const hasOpenIncident = activeArrastres.some((arrastre) => (arrastre.incidentes || []).some((incident) => statusText(incident.estado) === "ABIERTO"));

  return (
    <>
      <DynamicBanner />
      {feedback}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-slate-900">Control de Patio</h1>
            <span className="inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              En vivo
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <DashboardButton onClick={onMovimientos} icon={TrainFront}>Movimientos</DashboardButton>
            <button type="button" onClick={onCrear} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 text-sm font-semibold text-white shadow-sm">
              <Plus className="h-4 w-4" />
              Nuevo
            </button>
            <button type="button" onClick={onRefresh} disabled={refreshing} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm disabled:opacity-60" title="Actualizar">
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        <div className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Metric icon={FileClock} label="Solicitados" value={stats.solicitados} />
            <Metric icon={Play} label="En proceso" value={stats.proceso} />
            <Metric icon={AlertTriangle} label="Detenidos" value={stats.detenidos} />
            <Metric icon={CheckCircle2} label="Concluidos" value={stats.concluidos} />
            <Metric icon={Boxes} label="Vagones por mover" value={stats.pendientesVagon} />
          </div>
          {loading ? (
            <div className="h-72 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-900" />
          ) : (
            <ArrastreTerminalTable
              rows={activeArrastres}
              dailyCounters={dailyCounters}
              title="Terminal de rondas"
              subtitle="Conjuntos activos"
              pageSize={5}
              emptyText="No hay rondas activas por mover."
              editableSolicitudIds={editableSolicitudIds}
              canPrioritizeByIncident={hasOpenIncident}
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
    <button type="button" onClick={onClick} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm">
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}
