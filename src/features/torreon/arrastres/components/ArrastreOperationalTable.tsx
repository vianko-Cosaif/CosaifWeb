"use client";

import { Fragment, useState, type ElementType, type MouseEvent } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronsUp,
  ChevronUp,
  Clock3,
  CircleCheckBig,
  History,
  ListChecks,
  MapPin,
  Play,
  Route,
} from "lucide-react";
import StatusBadge from "@/app/Components/ui/StatusBadge";
import type { Arrastre, DailyInfo, IncidenteArrastre, VagonArrastre } from "../types";
import {
  buildArrastreFolio,
  fmtDate,
  fmtTime,
  getArrastreTimeline,
  getPrimaryIncident,
  getVagonName,
  getVagonStats,
  normalizeStatus,
} from "../utils";

type Props = {
  rows: Arrastre[];
  dailyCounters: Map<number, DailyInfo>;
  compact?: boolean;
  mode?: "active" | "history";
  busyArrastreId?: number | null;
  canPrioritizeByIncident?: boolean;
  onPrioritizeArrastre?: (arrastre: Arrastre) => void;
  onStartVagon?: (arrastre: Arrastre, vagon: VagonArrastre) => void;
  onFinishVagon?: (arrastre: Arrastre, vagon: VagonArrastre) => void;
  busyVagonKey?: string | null;
  onIncidentSelect?: (incident: IncidenteArrastre, arrastre: Arrastre) => void;
  onAuditSelect?: (arrastre: Arrastre) => void;
};

export default function ArrastreOperationalTable({
  rows,
  dailyCounters,
  compact = false,
  mode = "active",
  busyArrastreId = null,
  canPrioritizeByIncident = false,
  onPrioritizeArrastre,
  onStartVagon,
  onFinishVagon,
  busyVagonKey = null,
  onIncidentSelect,
  onAuditSelect,
}: Props) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const isHistoryMode = mode === "history";

  const toggleExpanded = (id: number) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
      <div className="grid gap-3 bg-slate-50 p-3 dark:bg-slate-950 lg:hidden">
        {rows.map((arrastre) => {
          const vagones = arrastre.vagones || [];
          const dailyInfo = dailyCounters.get(arrastre.id);
          const primaryIncident = getPrimaryIncident(arrastre);
          const activeVagon = vagones.find((vagon) => normalizeStatus(vagon.estado) === "EN_PROCESO");
          const nextVagon = vagones.find((vagon) => ["PENDIENTE", "BLOQUEADO"].includes(normalizeStatus(vagon.estado)));
          const isOpen = Boolean(expanded[arrastre.id]);
          const canPrioritize = canPrioritizeByIncident && mode === "active" && canPrioritizeArrastre(arrastre);
          const isBusy = busyArrastreId === arrastre.id;
          return (
            <article key={arrastre.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-slate-400">Solicitud</p>
                  <h3 className="mt-1 font-mono text-lg font-black text-slate-950 dark:text-white">{buildArrastreFolio(arrastre, dailyInfo)}</h3>
                  <p className="mt-1 text-xs font-bold text-slate-500">{vagones.length} vagón{vagones.length === 1 ? "" : "es"}</p>
                </div>
                <StatusBadge status={arrastre.estado} />
              </div>

              <p className="mt-3 text-sm font-bold text-emerald-700 dark:text-emerald-300">{formatPrimaryVagonRoute(getNextVagones(vagones, 1)[0] ?? vagones[0])}</p>
              <div className="mt-4"><ArrastreProgress vagones={vagones} /></div>
              <div className="mt-2"><VagonStatusSummaryInline vagones={vagones} /></div>

              {arrastre.instrucciones ? <p className="mt-3 line-clamp-2 text-sm font-medium text-slate-600 dark:text-slate-300">{arrastre.instrucciones}</p> : null}

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => toggleExpanded(arrastre.id)} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-black text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200" aria-expanded={isOpen}>
                  {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  {isOpen ? "Ocultar detalle" : "Ver detalle"}
                </button>
                {onPrioritizeArrastre ? <PriorityButton loading={isBusy} disabled={!canPrioritize || Boolean(busyArrastreId)} onClick={() => onPrioritizeArrastre(arrastre)} /> : null}
                {!activeVagon && nextVagon && onStartVagon ? <OperationalVagonButton label={`Iniciar ${getVagonName(nextVagon)}`} loading={busyVagonKey === `${arrastre.id}:${nextVagon.id}`} onClick={() => onStartVagon(arrastre, nextVagon)} /> : null}
                {activeVagon && onFinishVagon ? <OperationalVagonButton label={`Finalizar ${getVagonName(activeVagon)}`} finish loading={busyVagonKey === `${arrastre.id}:${activeVagon.id}`} onClick={() => onFinishVagon(arrastre, activeVagon)} /> : null}
                {primaryIncident ? <IncidentButton count={arrastre.incidentes?.length || 0} onClick={() => onIncidentSelect?.(primaryIncident, arrastre)} /> : null}
                {onAuditSelect ? <AuditButton expanded onClick={() => onAuditSelect(arrastre)} /> : null}
              </div>

              {isOpen ? (
                <div className="mt-4 space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
                  <ArrastreTimelineSummary arrastre={arrastre} />
                  {arrastre.instrucciones && !compact ? <InstructionPanel text={arrastre.instrucciones} /> : null}
                  <MobileVagonList vagones={vagones} />
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[1160px] table-fixed text-left text-sm">
          <colgroup>
            <col className="w-12" />
            <col className="w-56" />
            <col className="w-32" />
            <col className="w-56" />
            <col className="w-60" />
            <col className="w-60" />
            <col className="w-52" />
            <col className="w-28" />
          </colgroup>
          <thead className="border-b border-slate-200 bg-slate-100 text-[11px] uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
            <tr>
              <th className="px-3 py-3" aria-label="Detalle" />
              <th className="px-3 py-3">Solicitud</th>
              <th className="px-3 py-3">Estado</th>
              <th className="px-3 py-3">Ventana</th>
              <th className="px-3 py-3">Avance</th>
              <th className="px-3 py-3">{isHistoryMode ? "Resultado" : "Siguientes vagones"}</th>
              <th className="px-3 py-3">Instrucciones</th>
              <th className="px-3 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
            {rows.map((arrastre) => {
              const vagones = arrastre.vagones || [];
              const dailyInfo = dailyCounters.get(arrastre.id);
              const nextVagones = getNextVagones(vagones, 2);
              const primaryIncident = getPrimaryIncident(arrastre);
              const activeVagon = vagones.find((vagon) => normalizeStatus(vagon.estado) === "EN_PROCESO");
              const nextVagon = vagones.find((vagon) => ["PENDIENTE", "BLOQUEADO"].includes(normalizeStatus(vagon.estado)));
              const incidentCount = arrastre.incidentes?.length || 0;
              const isOpen = Boolean(expanded[arrastre.id]);
              const folio = buildArrastreFolio(arrastre, dailyInfo);
              const timeline = getArrastreTimeline(arrastre);
              const totalVagones = arrastre.resumen?.totalVagones ?? vagones.length;
              const canPrioritize = canPrioritizeByIncident && mode === "active" && canPrioritizeArrastre(arrastre);
              const isBusy = busyArrastreId === arrastre.id;

              return (
                <Fragment key={arrastre.id}>
                  <tr
                    onClick={() => toggleExpanded(arrastre.id)}
                    className={`cursor-pointer transition hover:bg-slate-50 dark:hover:bg-slate-800/50 ${isOpen ? "bg-emerald-50/40 dark:bg-emerald-950/10" : ""}`}
                  >
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={(event) => { event.stopPropagation(); toggleExpanded(arrastre.id); }}
                        aria-label={isOpen ? "Ocultar detalle" : "Ver detalle"}
                        aria-expanded={isOpen}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:border-emerald-300 hover:text-emerald-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
                      >
                        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                    </td>
                    <td className="px-3 py-3">
                      <p className="truncate font-black tabular-nums text-slate-950 dark:text-white">{folio}</p>
                      <div className="mt-1 flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400">
                        <span>ID #{arrastre.id}</span>
                        <span>·</span>
                        <span>{totalVagones} vagón{totalVagones === 1 ? "" : "es"}</span>
                        {dailyInfo ? <span>· {dailyInfo.index}/{dailyInfo.total}</span> : null}
                      </div>
                      <p className="mt-1 truncate text-xs font-bold text-emerald-700 dark:text-emerald-300">
                        {formatPrimaryVagonRoute(nextVagones[0] ?? vagones[0])}
                      </p>
                    </td>
                    <td className="px-3 py-3"><StatusBadge status={arrastre.estado} /></td>
                    <td className="px-3 py-3">
                      <div className="grid grid-cols-2 gap-3">
                        <TableDate value={timeline.inicio || arrastre.fechaSolicitud} tone="success" />
                        <TableDate value={timeline.fin} />
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <ArrastreProgress vagones={vagones} />
                      <div className="mt-2"><VagonStatusSummaryInline vagones={vagones} /></div>
                    </td>
                    <td className="px-3 py-3">
                      {isHistoryMode ? (
                        <ResultCell text={primaryIncident?.solucion || primaryIncident?.motivo || arrastre.instrucciones || "Sin observaciones"} />
                      ) : (
                        <NextVagonesInline vagones={nextVagones} />
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <p className="line-clamp-2 text-xs font-semibold leading-5 text-slate-600 dark:text-slate-300">
                        {arrastre.instrucciones || "Sin instrucciones adicionales."}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-2">
                        {!activeVagon && nextVagon && onStartVagon ? <OperationalVagonButton compact label={`Iniciar ${getVagonName(nextVagon)}`} loading={busyVagonKey === `${arrastre.id}:${nextVagon.id}`} onClick={() => onStartVagon(arrastre, nextVagon)} /> : null}
                        {activeVagon && onFinishVagon ? <OperationalVagonButton compact finish label={`Finalizar ${getVagonName(activeVagon)}`} loading={busyVagonKey === `${arrastre.id}:${activeVagon.id}`} onClick={() => onFinishVagon(arrastre, activeVagon)} /> : null}
                        {onPrioritizeArrastre ? (
                          <PriorityButton
                            loading={isBusy}
                            disabled={!canPrioritize || Boolean(busyArrastreId)}
                            onClick={(event) => { event.stopPropagation(); onPrioritizeArrastre(arrastre); }}
                          />
                        ) : null}
                        {primaryIncident ? (
                          <IncidentButton
                            count={incidentCount}
                            onClick={(event) => { event.stopPropagation(); onIncidentSelect?.(primaryIncident, arrastre); }}
                          />
                        ) : null}
                        {onAuditSelect ? <AuditButton onClick={() => onAuditSelect(arrastre)} /> : null}
                      </div>
                    </td>
                  </tr>
                  {isOpen ? (
                    <tr>
                      <td colSpan={8} className="bg-slate-50 px-4 py-4 dark:bg-slate-950/50">
                        <div className="space-y-3">
                          <ArrastreTimelineSummary arrastre={arrastre} />
                          {arrastre.instrucciones && !compact ? <InstructionPanel text={arrastre.instrucciones} /> : null}
                          <VagonDetailTable vagones={vagones} />
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OperationalVagonButton({ label, loading, finish = false, compact = false, onClick }: { label: string; loading: boolean; finish?: boolean; compact?: boolean; onClick: () => void }) {
  const Icon = finish ? CircleCheckBig : Play;
  return (
    <button
      type="button"
      onClick={(event) => { event.stopPropagation(); onClick(); }}
      disabled={loading}
      title={label}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border px-3 text-xs font-black transition disabled:opacity-50 ${finish ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-200" : "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/35 dark:text-sky-200"}`}
    >
      <Icon className={`h-4 w-4 ${loading ? "animate-pulse" : ""}`} aria-hidden />
      {compact ? null : label}
    </button>
  );
}

function MobileVagonList({ vagones }: { vagones: VagonArrastre[] }) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-300">Detalle de vagones</h4>
      {vagones.map((vagon) => (
        <div key={vagon.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center justify-between gap-3">
            <p className="font-black text-slate-950 dark:text-white">{getVagonName(vagon)}</p>
            <StatusBadge status={vagon.estado} size="sm" />
          </div>
          <p className="mt-2 text-xs font-semibold text-slate-600 dark:text-slate-300">{formatZone(vagon)}</p>
          <p className="mt-2 text-xs text-slate-500">Carga: {normalizeStatus(vagon.carga) === "LLENO" ? "Lleno" : "Vacío"}{vagon.comentario ? ` · ${vagon.comentario}` : ""}</p>
        </div>
      ))}
    </div>
  );
}

function VagonStatusSummaryInline({ vagones }: { vagones: VagonArrastre[] }) {
  const stats = getVagonStats(vagones);
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-black">
      <span className="text-slate-500">Pend {stats.PENDIENTE}</span>
      <span className="text-sky-700 dark:text-sky-300">Proc {stats.EN_PROCESO}</span>
      <span className="text-amber-700 dark:text-amber-300">Bloq {stats.BLOQUEADO}</span>
      <span className="text-emerald-700 dark:text-emerald-300">Listos {stats.CONCLUIDO}</span>
    </div>
  );
}

function NextVagonesInline({ vagones }: { vagones: VagonArrastre[] }) {
  if (!vagones.length) return <span className="text-xs font-bold text-slate-400">Sin vagones pendientes</span>;
  return (
    <div className="space-y-1.5">
      {vagones.map((vagon, index) => (
        <div key={vagon.id} className="flex min-w-0 items-center gap-2 text-xs">
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-black uppercase ${index === 0 ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300"}`}>
            {index === 0 ? "Ahora" : "Después"}
          </span>
          <span className="font-black text-slate-900 dark:text-white">{getVagonName(vagon)}</span>
          <span className="truncate font-semibold text-slate-500 dark:text-slate-400">{formatZone(vagon)}</span>
        </div>
      ))}
    </div>
  );
}

function canPrioritizeArrastre(arrastre: Arrastre) {
  const estado = normalizeStatus(arrastre.estado);
  const hasVagonEnProceso = (arrastre.vagones || []).some((vagon) => normalizeStatus(vagon.estado) === "EN_PROCESO");
  const hasVagonPendiente = (arrastre.vagones || []).some((vagon) => normalizeStatus(vagon.estado) === "PENDIENTE");
  return ["SOLICITADO", "DETENIDO"].includes(estado) && !hasVagonEnProceso && hasVagonPendiente;
}

function PriorityButton({
  disabled,
  loading,
  onClick,
}: {
  disabled?: boolean;
  loading?: boolean;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      title="Subir al frente por incidente"
      disabled={disabled}
      onClick={onClick}
      onKeyDown={(event) => event.stopPropagation()}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-35 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300"
    >
      <ChevronsUp className={`h-4 w-4 ${loading ? "animate-pulse" : ""}`} />
    </button>
  );
}

function IncidentButton({
  count,
  onClick,
}: {
  count: number;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onKeyDown={(event) => event.stopPropagation()}
      className="inline-flex w-fit items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-bold text-amber-800 transition hover:border-amber-400 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-900/50"
    >
      <AlertTriangle className="h-3.5 w-3.5" />
      Inc. {count}
    </button>
  );
}

function AuditButton({ expanded = false, onClick }: { expanded?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      title="Ver bitácora de ediciones"
      aria-label="Ver bitácora de ediciones"
      onClick={(event) => { event.stopPropagation(); onClick(); }}
      onKeyDown={(event) => event.stopPropagation()}
      className={`inline-flex items-center justify-center gap-2 rounded-lg border border-violet-200 bg-violet-50 font-black text-violet-700 transition hover:border-violet-300 hover:bg-violet-100 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-200 ${expanded ? "min-h-11 px-3 text-xs" : "h-8 w-8"}`}
    >
      <History className="h-4 w-4" />
      {expanded ? "Bitácora" : null}
    </button>
  );
}

function TableDate({ value, tone = "neutral" }: { value?: string | null; tone?: "neutral" | "success" }) {
  return (
    <div className="min-w-0">
      <div
        className={`font-black tabular-nums ${
          tone === "success" ? "text-emerald-700 dark:text-emerald-300" : "text-slate-950 dark:text-white"
        }`}
      >
        {fmtTime(value)}
      </div>
      <div className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-400">
        {fmtDate(value).split(",")[0]}
      </div>
    </div>
  );
}

function ArrastreProgress({ vagones }: { vagones: VagonArrastre[] }) {
  const stats = getVagonStats(vagones);
  const total = Math.max(vagones.length, 1);
  const completed = stats.CONCLUIDO;
  const progress = Math.round((completed / total) * 100);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
        <span>Avance</span>
        <span className="tabular-nums text-slate-900 dark:text-slate-100">
          {completed}/{vagones.length}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

function getNextVagones(vagones: VagonArrastre[], limit: number) {
  const priority = (estado?: string | null) => {
    const normalized = normalizeStatus(estado);
    if (normalized === "EN_PROCESO") return 0;
    if (normalized === "PENDIENTE") return 1;
    return 2;
  };

  return [...vagones]
    .filter((vagon) => ["EN_PROCESO", "PENDIENTE"].includes(normalizeStatus(vagon.estado)))
    .sort((a, b) => priority(a.estado) - priority(b.estado) || (a.orden ?? 0) - (b.orden ?? 0))
    .slice(0, limit);
}

function ResultCell({ text }: { text: string }) {
  return (
    <div className="line-clamp-4 text-xs font-semibold leading-5 text-slate-600 dark:text-slate-300">
      {text}
    </div>
  );
}

function ArrastreTimelineSummary({ arrastre }: { arrastre: Arrastre }) {
  const timeline = getArrastreTimeline(arrastre);
  return (
    <div className="grid gap-2 md:grid-cols-2">
      <TimelineTile icon={Clock3} label="Inicio primer vagon" value={fmtDate(timeline.inicio)} />
      <TimelineTile icon={ListChecks} label="Fin ultimo vagon" value={fmtDate(timeline.fin)} />
    </div>
  );
}

function TimelineTile({
  icon: Icon,
  label,
  value,
}: {
  icon: ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wide text-slate-400">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-1 text-sm font-black text-slate-900 dark:text-slate-100">
        {value}
      </p>
    </div>
  );
}

function InstructionPanel({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-wide text-slate-400">
        <Route className="h-3.5 w-3.5" />
        Instrucciones
      </div>
      <p className="text-sm font-semibold leading-6 text-slate-700 dark:text-slate-300">{text}</p>
    </div>
  );
}

function VagonDetailTable({ vagones }: { vagones: VagonArrastre[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/40">
      <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
        <h4 className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-300">
          Detalle de vagones
        </h4>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-white text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
            <tr>
              <th className="px-3 py-2">Orden</th>
              <th className="px-3 py-2">Vagon</th>
              <th className="px-3 py-2">Carga</th>
              <th className="px-3 py-2">Origen / destino</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Inicio</th>
              <th className="px-3 py-2">Fin</th>
              <th className="px-3 py-2">Comentario</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {vagones.map((vagon) => (
              <tr key={vagon.id} className="hover:bg-slate-50 dark:hover:bg-slate-900">
                <td className="px-3 py-2 font-black tabular-nums text-slate-500 dark:text-slate-400">{vagon.orden}</td>
                <td className="px-3 py-2 font-black text-slate-950 dark:text-white">{getVagonName(vagon)}</td>
                <td className="px-3 py-2">
                  <CargaBadge carga={vagon.carga} />
                </td>
                <td className="px-3 py-2 text-slate-700 dark:text-slate-300">
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" />
                    {formatZone(vagon)}
                  </span>
                </td>
                <td className="px-3 py-2"><StatusBadge status={vagon.estado} /></td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{fmtDate(vagon.fechaInicio)}</td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{fmtDate(vagon.fechaFin)}</td>
                <td className="max-w-xs px-3 py-2 text-xs font-semibold leading-5 text-slate-500 dark:text-slate-400">
                  {vagon.comentario?.trim() || "--"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CargaBadge({ carga }: { carga?: string | null }) {
  const normalized = normalizeStatus(carga) || "VACIO";
  const isFull = normalized === "LLENO";

  return (
    <span
      className={`inline-flex rounded-md border px-2 py-1 text-[11px] font-black ${
        isFull
          ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
          : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
      }`}
    >
      {normalized}
    </span>
  );
}

function formatZone(vagon: VagonArrastre) {
  return `Origen ${formatPoint(vagon.viaOrigenNombre, vagon.seccionOrigenNombre, vagon.viaOrigenId, vagon.seccionOrigenId)} -> Destino ${formatPoint(vagon.viaDestinoNombre, vagon.seccionDestinoNombre, vagon.viaId, vagon.seccionId)}`;
}

function formatPrimaryVagonRoute(vagon?: VagonArrastre | null) {
  if (!vagon) return "Sin vagones";
  return formatZone(vagon);
}

function formatPoint(viaName?: string | null, sectionName?: string | null, viaId?: number | null, seccionId?: number | null) {
  return `Via ${viaName || viaId || "-"} / Seccion ${sectionName || seccionId || "-"}`;
}
