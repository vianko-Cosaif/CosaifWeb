"use client";

import { useState, type ElementType, type MouseEvent, type ReactNode } from "react";
import {
  AlertTriangle,
  Boxes,
  ChevronDown,
  ChevronsUp,
  ChevronUp,
  Clock3,
  ListChecks,
  MapPin,
  Route,
  TimerReset,
} from "lucide-react";
import { StatusBadge } from "@/app/Components/ui";
import type { Arrastre, DailyInfo, IncidenteArrastre, VagonArrastre } from "../types";
import {
  buildArrastreFolio,
  fmtDate,
  fmtMinutes,
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
  onIncidentSelect?: (incident: IncidenteArrastre, arrastre: Arrastre) => void;
};

export default function ArrastreOperationalTable({
  rows,
  dailyCounters,
  compact = false,
  mode = "active",
  busyArrastreId = null,
  canPrioritizeByIncident = false,
  onPrioritizeArrastre,
  onIncidentSelect,
}: Props) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const isHistoryMode = mode === "history";

  const toggleExpanded = (id: number) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-3">
      {rows.map((arrastre) => {
        const vagones = arrastre.vagones || [];
        const dailyInfo = dailyCounters.get(arrastre.id);
        const nextVagones = getNextVagones(vagones, 2);
        const primaryIncident = getPrimaryIncident(arrastre);
        const incidentCount = arrastre.incidentes?.length || 0;
        const isOpen = Boolean(expanded[arrastre.id]);
        const folio = buildArrastreFolio(arrastre, dailyInfo);
        const timeline = getArrastreTimeline(arrastre);
        const totalVagones = arrastre.resumen?.totalVagones ?? vagones.length;
        const resumenTiempo = fmtMinutes(
          timeline.totalMin ??
          arrastre.resumen?.operacionTotalMin ??
          arrastre.resumen?.solicitudTotalMin
        );
        const canPrioritize = canPrioritizeByIncident && mode === "active" && canPrioritizeArrastre(arrastre);
        const isBusy = busyArrastreId === arrastre.id;

        return (
          <article
            key={arrastre.id}
            onClick={() => toggleExpanded(arrastre.id)}
            className={`cursor-pointer overflow-hidden rounded-2xl border bg-white shadow-sm ring-1 ring-slate-950/[0.02] transition dark:bg-slate-900 ${
              isOpen
                ? "border-emerald-200 shadow-md dark:border-emerald-800/80"
                : "border-slate-200 hover:border-emerald-200 hover:shadow-md dark:border-slate-700/80 dark:hover:border-emerald-800/80"
            }`}
          >
            <div className={`grid gap-4 p-4 ${
              isHistoryMode ? "" : "xl:grid-cols-[minmax(0,1fr)_280px] 2xl:grid-cols-[minmax(0,1fr)_320px]"
            }`}>
              <div className="min-w-0 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleExpanded(arrastre.id);
                      }}
                      className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition ${
                        isOpen
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                          : "border-slate-200 bg-white text-slate-500 hover:border-emerald-300 hover:text-emerald-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-emerald-700 dark:hover:text-emerald-300"
                      }`}
                      aria-label={isOpen ? "Ocultar detalle" : "Ver detalle"}
                    >
                      {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    <div className="min-w-0">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="truncate text-xl font-black leading-tight tabular-nums text-slate-950 dark:text-white">
                          {folio}
                        </span>
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-black uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                          ID #{arrastre.id}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs font-black text-slate-600 dark:bg-slate-800/90 dark:text-slate-300">
                          <Boxes className="h-3.5 w-3.5" />
                          {totalVagones} vagon{totalVagones === 1 ? "" : "es"}
                        </span>
                        {dailyInfo ? (
                          <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-black text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                            Orden {dailyInfo.index} de {dailyInfo.total}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {onPrioritizeArrastre ? (
                      <PriorityButton
                        loading={isBusy}
                        disabled={!canPrioritize || Boolean(busyArrastreId)}
                        onClick={(event) => {
                          event.stopPropagation();
                          onPrioritizeArrastre(arrastre);
                        }}
                      />
                    ) : null}
                    <StatusBadge status={arrastre.estado} />
                    {primaryIncident ? (
                      <IncidentButton
                        count={incidentCount}
                        onClick={(event) => {
                          event.stopPropagation();
                          onIncidentSelect?.(primaryIncident, arrastre);
                        }}
                      />
                    ) : null}
                  </div>
                </div>

                {!compact && arrastre.instrucciones ? (
                  <p className="line-clamp-2 rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold leading-5 text-slate-600 dark:bg-slate-800/70 dark:text-slate-300">
                    {arrastre.instrucciones}
                  </p>
                ) : null}

                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <SummaryTile icon={Clock3} label="Solicitud">
                    <TableDate value={arrastre.fechaSolicitud} />
                  </SummaryTile>
                  <SummaryTile icon={Route} label="Inicio">
                    <TableDate value={timeline.inicio} tone="success" />
                  </SummaryTile>
                  <SummaryTile icon={ListChecks} label="Fin">
                    <TableDate value={timeline.fin} />
                  </SummaryTile>
                  <SummaryTile icon={TimerReset} label="Tiempo">
                    <TimePill value={fmtMinutes(timeline.totalMin)} />
                  </SummaryTile>
                </div>

                {isHistoryMode ? (
                  <div className="grid gap-2 sm:grid-cols-[140px_minmax(0,1fr)]">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/70">
                      <div className="text-[10px] font-black uppercase tracking-wide text-slate-400">Vagones</div>
                      <div className="mt-1 text-2xl font-black tabular-nums text-slate-950 dark:text-white">{totalVagones}</div>
                      <div className="text-xs font-bold text-slate-500 dark:text-slate-400">{resumenTiempo}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/70">
                      <div className="mb-1 text-[10px] font-black uppercase tracking-wide text-slate-400">Resultado</div>
                      <ResultCell text={primaryIncident?.solucion || primaryIncident?.motivo || arrastre.instrucciones || "Sin observaciones"} />
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-800/60">
                    <ArrastreProgress vagones={vagones} />
                    <div className="mt-3">
                      <VagonStatusSummary vagones={vagones} />
                    </div>
                  </div>
                )}
              </div>

              {!isHistoryMode ? (
                <aside className="min-w-0 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-800/80 dark:bg-emerald-950/20">
                  <div className="mb-2 text-[11px] font-black uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                    Siguientes vagones
                  </div>
                  <NextVagonesPanel vagones={nextVagones} />
                </aside>
              ) : null}
            </div>

            {isOpen ? (
              <div
                onClick={(event) => event.stopPropagation()}
                className="border-t border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-950/40"
              >
                <div className="space-y-3">
                  <ArrastreTimelineSummary arrastre={arrastre} />
                  {arrastre.instrucciones ? <InstructionPanel text={arrastre.instrucciones} /> : null}
                  <VagonDetailTable vagones={vagones} />
                </div>
              </div>
            ) : null}
          </article>
        );
      })}
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

function SummaryTile({
  icon: Icon,
  label,
  children,
}: {
  icon: ElementType;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900/80">
      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-slate-400">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      {children}
    </div>
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

function TimePill({ value }: { value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-black text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
      <TimerReset className="h-3.5 w-3.5" />
      {value}
    </span>
  );
}

function VagonStatusSummary({ vagones }: { vagones: VagonArrastre[] }) {
  const stats = getVagonStats(vagones);
  const items = [
    ["Pend.", stats.PENDIENTE, "bg-slate-50 text-slate-600 dark:bg-slate-800/80 dark:text-slate-300"],
    ["Proc.", stats.EN_PROCESO, "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"],
    ["Bloq.", stats.BLOQUEADO, "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"],
    ["Listos", stats.CONCLUIDO, "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"],
  ] as const;

  return (
    <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
      {items.map(([label, value, tone]) => (
        <span
          key={label}
          className={`flex min-h-10 items-center justify-between gap-3 rounded-xl px-3 py-2 font-black ${tone}`}
        >
          <span>{label}</span>
          <span className="text-base tabular-nums text-slate-950 dark:text-white">{value}</span>
        </span>
      ))}
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

function NextVagonesPanel({ vagones }: { vagones: VagonArrastre[] }) {
  if (!vagones.length) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300">
        Sin vagones pendientes
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {vagones.map((vagon, index) => (
        <NextVagonCard key={vagon.id} vagon={vagon} index={index} />
      ))}
    </div>
  );
}

function NextVagonCard({ vagon, index }: { vagon: VagonArrastre; index: number }) {
  const isCurrent = index === 0;

  return (
    <div
      className={`w-full rounded-xl border px-3 py-2 shadow-sm ${
        isCurrent
          ? "border-emerald-200 bg-white dark:border-emerald-800/80 dark:bg-slate-900/95"
          : "border-slate-200 bg-white/80 dark:border-slate-700 dark:bg-slate-900/70"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={`rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${
            isCurrent
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
              : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300"
          }`}
        >
          {isCurrent ? "Ahora" : "Después"}
        </span>
        <CargaBadge carga={vagon.carga} />
      </div>
      <div className="mt-2 flex min-w-0 items-end gap-2">
        <span
          className={`shrink-0 text-2xl font-black leading-none tabular-nums ${
            isCurrent ? "text-emerald-700 dark:text-emerald-300" : "text-slate-900 dark:text-slate-100"
          }`}
        >
          {getVagonName(vagon)}
        </span>
        <span className="min-w-0 truncate pb-0.5 text-xs font-bold text-slate-500 dark:text-slate-300">
          Orden {vagon.orden ?? "-"}
        </span>
      </div>
      <div className="mt-2 flex min-w-0 items-center gap-1.5 text-xs font-black text-slate-700 dark:text-slate-200">
        <MapPin className={`h-3.5 w-3.5 shrink-0 ${isCurrent ? "text-emerald-600 dark:text-emerald-300" : "text-slate-400"}`} />
        <span className="min-w-0 truncate">{formatZone(vagon)}</span>
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
    <div className="grid gap-2 md:grid-cols-3">
      <TimelineTile icon={Clock3} label="Inicio primer vagon" value={fmtDate(timeline.inicio)} />
      <TimelineTile icon={ListChecks} label="Fin ultimo vagon" value={fmtDate(timeline.fin)} />
      <TimelineTile icon={TimerReset} label="Tiempo total" value={fmtMinutes(timeline.totalMin)} emphasis />
    </div>
  );
}

function TimelineTile({
  icon: Icon,
  label,
  value,
  emphasis = false,
}: {
  icon: ElementType;
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wide text-slate-400">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className={`mt-1 text-sm font-black ${emphasis ? "text-emerald-700 dark:text-emerald-300" : "text-slate-900 dark:text-slate-100"}`}>
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
        <table className="w-full min-w-[1040px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-white text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
            <tr>
              <th className="px-3 py-2">Orden</th>
              <th className="px-3 py-2">Vagon</th>
              <th className="px-3 py-2">Carga</th>
              <th className="px-3 py-2">Zona destino</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Inicio</th>
              <th className="px-3 py-2">Fin</th>
              <th className="px-3 py-2">Operacion</th>
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
                <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{fmtMinutes(vagon.metricas?.operacionMin)}</td>
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
  return `Via ${vagon.viaId ?? "-"} / Seccion ${vagon.seccionId ?? "-"}`;
}
