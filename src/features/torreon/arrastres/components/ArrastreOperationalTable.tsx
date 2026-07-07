"use client";

import { Fragment, useState, type ElementType, type MouseEvent } from "react";
import {
  AlertTriangle,
  Boxes,
  ChevronDown,
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
  getNextVagon,
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
  onIncidentSelect?: (incident: IncidenteArrastre, arrastre: Arrastre) => void;
};

export default function ArrastreOperationalTable({
  rows,
  dailyCounters,
  compact = false,
  mode = "active",
  onIncidentSelect,
}: Props) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const isHistoryMode = mode === "history";

  const toggleExpanded = (id: number) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1160px] table-fixed text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-black uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
            <tr>
              <th className="w-[22%] px-4 py-3">Movimiento</th>
              <th className="w-[12%] px-4 py-3">Estado</th>
              <th className="w-[10%] px-4 py-3">Solicitud</th>
              <th className="w-[10%] px-4 py-3">Inicio</th>
              <th className="w-[10%] px-4 py-3">Fin</th>
              <th className="w-[11%] px-4 py-3">Tiempo</th>
              <th className="w-[15%] px-4 py-3">Vagones</th>
              <th className="w-[10%] px-4 py-3">{isHistoryMode ? "Resultado" : "Siguiente"}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((arrastre) => {
              const vagones = arrastre.vagones || [];
              const dailyInfo = dailyCounters.get(arrastre.id);
              const nextVagon = getNextVagon(vagones);
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

              return (
                <Fragment key={arrastre.id}>
                  <tr
                    onClick={() => toggleExpanded(arrastre.id)}
                    className={`cursor-pointer align-top transition ${
                      isOpen
                        ? "bg-emerald-50/50 shadow-[inset_4px_0_0_#10b981] dark:bg-emerald-950/20"
                        : "hover:bg-slate-50/80 dark:hover:bg-slate-900/70"
                    }`}
                  >
                    <td className="px-4 py-4">
                      <div className="flex min-w-0 items-start gap-3">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleExpanded(arrastre.id);
                          }}
                          className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition ${
                            isOpen
                              ? "border-emerald-300 bg-white text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                              : "border-slate-200 bg-white text-slate-500 hover:border-emerald-300 hover:text-emerald-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-emerald-700 dark:hover:text-emerald-300"
                          }`}
                          aria-label={isOpen ? "Ocultar detalle" : "Ver detalle"}
                        >
                          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                        <div className="min-w-0">
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <span className="truncate text-base font-black leading-tight tabular-nums text-slate-950 dark:text-white">
                              {folio}
                            </span>
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-black uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                              ID #{arrastre.id}
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs font-black text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                              <Boxes className="h-3.5 w-3.5" />
                              {totalVagones} vagon{totalVagones === 1 ? "" : "es"}
                            </span>
                            {dailyInfo ? (
                              <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-black text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                                Orden {dailyInfo.index} de {dailyInfo.total}
                              </span>
                            ) : null}
                          </div>
                          {!compact && arrastre.instrucciones ? (
                            <p className="mt-2 line-clamp-2 text-xs font-semibold leading-5 text-slate-500 dark:text-slate-400">
                              {arrastre.instrucciones}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex min-w-0 flex-col gap-2">
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
                    </td>
                    <td className="px-4 py-4">
                      <TableDate value={arrastre.fechaSolicitud} />
                    </td>
                    <td className="px-4 py-4">
                      <TableDate value={timeline.inicio} tone="success" />
                    </td>
                    <td className="px-4 py-4">
                      <TableDate value={timeline.fin} />
                    </td>
                    <td className="px-4 py-4">
                      <TimePill value={fmtMinutes(timeline.totalMin)} />
                    </td>
                    <td className="px-4 py-4">
                      {isHistoryMode ? (
                        <div className="space-y-1">
                          <div className="text-lg font-black tabular-nums text-slate-950 dark:text-white">
                            {totalVagones}
                          </div>
                          <div className="text-xs font-bold text-slate-500 dark:text-slate-400">{resumenTiempo}</div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <ArrastreProgress vagones={vagones} />
                          <VagonStatusSummary vagones={vagones} />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {isHistoryMode ? (
                        <ResultCell
                          text={primaryIncident?.solucion || primaryIncident?.motivo || arrastre.instrucciones || "Sin observaciones"}
                        />
                      ) : (
                        <NextVagonCell vagon={nextVagon} />
                      )}
                    </td>
                  </tr>
                  {isOpen ? (
                    <tr key={`${arrastre.id}-detail`}>
                      <td colSpan={8} className="bg-slate-50/70 px-4 py-4 dark:bg-slate-950/70">
                        <div className="space-y-3">
                          <ArrastreTimelineSummary arrastre={arrastre} />
                          {arrastre.instrucciones ? (
                            <InstructionPanel text={arrastre.instrucciones} />
                          ) : null}
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
    ["Pend", stats.PENDIENTE, "text-slate-500 dark:text-slate-300"],
    ["Proc", stats.EN_PROCESO, "text-blue-700 dark:text-blue-300"],
    ["Bloq", stats.BLOQUEADO, "text-amber-800 dark:text-amber-300"],
    ["Listos", stats.CONCLUIDO, "text-emerald-700 dark:text-emerald-300"],
  ] as const;

  return (
    <div className="grid min-w-[220px] grid-cols-2 gap-1 text-xs">
      {items.map(([label, value, tone]) => (
        <span
          key={label}
          className={`flex items-center justify-between rounded-md bg-slate-50 px-2 py-1.5 font-black dark:bg-slate-800/70 ${tone}`}
        >
          <span>{label}</span>
          <span className="tabular-nums text-slate-950 dark:text-white">{value}</span>
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

function NextVagonCell({ vagon }: { vagon?: VagonArrastre | null }) {
  if (!vagon) {
    return <div className="text-xs font-semibold text-slate-400">Sin vagon pendiente</div>;
  }

  return (
    <div className="min-w-0 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-800 dark:bg-emerald-950/30">
      <div className="text-xs font-black uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Ahora</div>
      <div className="mt-1 truncate text-lg font-black leading-none text-emerald-800 dark:text-emerald-200">
        {getVagonName(vagon)}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <ZoneChip vagon={vagon} />
        <CargaBadge carga={vagon.carga} />
      </div>
    </div>
  );
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
        <table className="w-full min-w-[920px] text-left text-sm">
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ZoneChip({ vagon }: { vagon: VagonArrastre }) {
  return (
    <span className="rounded-md bg-white px-2 py-1 text-[11px] font-black text-slate-600 dark:bg-slate-900 dark:text-slate-300">
      {formatZone(vagon)}
    </span>
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
