import type { ReactNode } from "react";
import { AlertTriangle, Boxes, CheckCircle2, FileClock, Plus, RefreshCw, TrainFront, Play } from "lucide-react";
import { DynamicBanner } from "@/app/Components/DynamicBanner";
import { fmtDate, type Arrastre, type VagonArrastre } from "@/features/torreon/arrastres";
import { EmptyState, EstadoBadge, Metric } from "../components";
import type { ClienteArrastreStats } from "../types";

type Props = {
  feedback: ReactNode;
  stats: ClienteArrastreStats;
  nextVagones: Array<{ arrastre: Arrastre; vagon: VagonArrastre }>;
  loading: boolean;
  refreshing: boolean;
  onMovimientos: () => void;
  onIncidentes: () => void;
  onCrear: () => void;
  onRefresh: () => void;
};

export function DashboardView({ feedback, stats, nextVagones, loading, refreshing, onMovimientos, onIncidentes, onCrear, onRefresh }: Props) {
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
            <DashboardButton onClick={onIncidentes} icon={AlertTriangle}>Incidentes</DashboardButton>
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
          <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
            <VagonQueue loading={loading} nextVagones={nextVagones} />
            <StatusSummary stats={stats} />
          </div>
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

function VagonQueue({ loading, nextVagones }: { loading: boolean; nextVagones: Array<{ arrastre: Arrastre; vagon: VagonArrastre }> }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Por mover</p>
          <h2 className="mt-1 text-base font-semibold text-slate-950">Cola de vagones</h2>
        </div>
        <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold text-slate-500">{nextVagones.length}</span>
      </div>
      {loading ? (
        <div className="mt-4 h-48 animate-pulse rounded-xl bg-slate-100" />
      ) : nextVagones.length ? (
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-[760px] w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2 pr-3">Arrastre</th>
                <th className="py-2 pr-3">Vagon</th>
                <th className="py-2 pr-3">Zona</th>
                <th className="py-2 pr-3">Carga</th>
                <th className="py-2 pr-3">Estado</th>
                <th className="py-2 pr-3">Solicitud</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {nextVagones.map(({ arrastre, vagon }) => (
                <tr key={`${arrastre.id}-${vagon.id}`}>
                  <td className="py-2 pr-3 font-semibold text-slate-900">#{arrastre.id}</td>
                  <td className="py-2 pr-3 text-slate-700">{vagon.numeroVagon || `Vagon ${vagon.orden}`}</td>
                  <td className="py-2 pr-3 text-slate-700">Via {vagon.viaId} / Seccion {vagon.seccionId}</td>
                  <td className="py-2 pr-3 text-slate-700">{vagon.carga}</td>
                  <td className="py-2 pr-3"><EstadoBadge estado={vagon.estado} /></td>
                  <td className="py-2 pr-3 text-slate-600">{fmtDate(vagon.fechaSolicitud || arrastre.fechaSolicitud)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState text="No hay vagones pendientes." />
      )}
    </div>
  );
}

function StatusSummary({ stats }: { stats: ClienteArrastreStats }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Estados</p>
        <span className="rounded-lg bg-white px-2 py-1 text-xs font-bold text-slate-500">{stats.total}</span>
      </div>
      <div className="mt-4 space-y-3">
        {[
          ["Solicitados", stats.solicitados],
          ["En proceso", stats.proceso],
          ["Detenidos", stats.detenidos],
          ["Concluidos", stats.concluidos],
        ].map(([label, value]) => (
          <div key={String(label)} className="flex items-center justify-between rounded-xl bg-white px-3 py-3 text-sm shadow-sm">
            <span className="font-semibold text-slate-600">{label}</span>
            <span className="font-bold text-slate-950">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
