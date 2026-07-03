"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Hash,
  Loader2,
  RefreshCw,
  Search,
} from "lucide-react";
import TorreonIncidentDetailModal, { type TorreonIncidentDetail } from "./TorreonIncidentDetailModal";

type ArrastreStatus = "TODOS" | "SOLICITADO" | "EN_PROCESO" | "DETENIDO" | "CONCLUIDO" | "CANCELADO";
type VagonStatus = "PENDIENTE" | "EN_PROCESO" | "BLOQUEADO" | "CONCLUIDO";
type VagonStatusFilter = "TODOS" | VagonStatus;
type ArrastreFechaCampo = "solicitud" | "inicio" | "fin";

type VagonArrastre = {
  id: number;
  orden: number;
  numeroVagon?: string | null;
  carga?: string | null;
  estado?: string | null;
  viaId?: number | null;
  seccionId?: number | null;
  fechaSolicitud?: string | null;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  metricas?: {
    esperaMin?: number | null;
    operacionMin?: number | null;
    solicitudTotalMin?: number | null;
  } | null;
};

type IncidenteArrastre = TorreonIncidentDetail & {
  id: number;
  vagonId?: number | null;
};

type Arrastre = {
  id: number;
  estado?: string | null;
  empresaId?: number | null;
  fechaSolicitud?: string | null;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  instrucciones?: string | null;
  vagones?: VagonArrastre[] | null;
  incidentes?: IncidenteArrastre[] | null;
  resumen?: {
    totalVagones?: number | null;
    pendientes?: number | null;
    enProceso?: number | null;
    bloqueados?: number | null;
    concluidos?: number | null;
    solicitudTotalMin?: number | null;
    operacionTotalMin?: number | null;
  } | null;
};

type Props = {
  localidadId: number;
  variant?: "dashboard" | "movimientos";
};

type DailyInfo = {
  index: number;
  total: number;
  date: string;
};

type Stats = {
  total: number;
  solicitados: number;
  proceso: number;
  detenidos: number;
  concluidos: number;
  cancelados: number;
  vagonesPendientes: number;
  incidentesAbiertos: number;
};

const STATUS_OPTIONS: Array<{ value: ArrastreStatus; label: string }> = [
  { value: "TODOS", label: "Todos" },
  { value: "SOLICITADO", label: "Solicitados" },
  { value: "EN_PROCESO", label: "En proceso" },
  { value: "DETENIDO", label: "Detenidos" },
  { value: "CONCLUIDO", label: "Concluidos" },
  { value: "CANCELADO", label: "Cancelados" },
];

const VAGON_STATUS_OPTIONS: Array<{ value: VagonStatusFilter; label: string }> = [
  { value: "TODOS", label: "Todos los vagones" },
  { value: "PENDIENTE", label: "Pendientes" },
  { value: "EN_PROCESO", label: "En proceso" },
  { value: "BLOQUEADO", label: "Bloqueados" },
  { value: "CONCLUIDO", label: "Listos" },
];

const OPERATIONAL_STATUSES = new Set(["SOLICITADO", "EN_PROCESO"]);
const HISTORY_STATUSES = new Set(["DETENIDO", "CONCLUIDO", "CANCELADO"]);

function normalizeStatus(value?: string | null) {
  return String(value || "").trim().toUpperCase();
}

function extractArray<T>(input: unknown): T[] {
  if (Array.isArray(input)) return input as T[];
  if (input && typeof input === "object") {
    const record = input as { data?: unknown; items?: unknown; rows?: unknown };
    if (Array.isArray(record.data)) return record.data as T[];
    if (Array.isArray(record.items)) return record.items as T[];
    if (Array.isArray(record.rows)) return record.rows as T[];
  }
  return [];
}

function fmtDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function fmtTime(value?: string | null) {
  if (!value) return "--:--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";
  return new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function localDateKey(value?: string | Date | null) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function arrastreDateKey(arrastre: Arrastre) {
  return localDateKey(arrastre.fechaSolicitud || arrastre.fechaInicio || arrastre.fechaFin);
}

function formatFolioDate(dateKey: string) {
  if (!dateKey) return "sin-fecha";
  const [year, month, day] = dateKey.split("-");
  if (!year || !month || !day) return dateKey;
  return `${day}-${month}-${year}`;
}

function buildArrastreFolio(arrastre: Arrastre, dailyInfo?: DailyInfo) {
  const dateKey = dailyInfo?.date || arrastreDateKey(arrastre);
  const index = dailyInfo?.index || arrastre.id;
  return `${formatFolioDate(dateKey)}:${index}`;
}

function getArrastreDateValue(arrastre: Arrastre, campo: ArrastreFechaCampo) {
  if (campo === "inicio") return getArrastreTimeline(arrastre).inicio || arrastre.fechaInicio || null;
  if (campo === "fin") return getArrastreTimeline(arrastre).fin || arrastre.fechaFin || null;
  return arrastre.fechaSolicitud || null;
}

function toLocalDateTimeInput(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function isLiveArrastre(arrastre: Arrastre) {
  return OPERATIONAL_STATUSES.has(normalizeStatus(arrastre.estado));
}

function isHistoryArrastre(arrastre: Arrastre) {
  return HISTORY_STATUSES.has(normalizeStatus(arrastre.estado));
}

function fmtDateKey(value: string) {
  if (!value) return "-";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(date);
}

function fmtMinutes(value?: number | null) {
  if (!Number.isFinite(Number(value))) return "-";
  const minutes = Math.max(0, Math.round(Number(value)));
  if (minutes < 60) return `${minutes} min`;
  const hrs = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem ? `${hrs} h ${rem} min` : `${hrs} h`;
}

function parseDateTime(value?: string | null) {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

function getArrastreTimeline(arrastre: Arrastre) {
  const vagones = arrastre.vagones || [];
  const starts = vagones
    .map((vagon) => parseDateTime(vagon.fechaInicio))
    .filter((value): value is number => typeof value === "number")
    .sort((a, b) => a - b);
  const ends = vagones
    .map((vagon) => parseDateTime(vagon.fechaFin))
    .filter((value): value is number => typeof value === "number")
    .sort((a, b) => a - b);

  const fallbackStart = parseDateTime(arrastre.fechaInicio);
  const fallbackEnd = parseDateTime(arrastre.fechaFin);
  const start = starts[0] ?? fallbackStart ?? null;
  const end = ends[ends.length - 1] ?? fallbackEnd ?? null;
  const totalMin = start && end && end >= start ? Math.round((end - start) / 60000) : null;

  return {
    inicio: start ? new Date(start).toISOString() : null,
    fin: end ? new Date(end).toISOString() : null,
    totalMin,
  };
}

function statusTone(status?: string | null) {
  const normalized = normalizeStatus(status);
  if (normalized === "CONCLUIDO") return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300";
  if (normalized === "EN_PROCESO") return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300";
  if (normalized === "DETENIDO" || normalized === "BLOQUEADO") return "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300";
  if (normalized === "CANCELADO") return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300";
  return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";
}

function StatusBadge({ status }: { status?: string | null }) {
  const normalized = normalizeStatus(status) || "SOLICITADO";
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold ${statusTone(normalized)}`}>
      {normalized.replace("_", " ")}
    </span>
  );
}

function getOpenIncident(arrastre: Arrastre) {
  return (arrastre.incidentes || []).find((incident) => normalizeStatus(incident.estado) === "ABIERTO") || null;
}

function getPrimaryIncident(arrastre: Arrastre) {
  return getOpenIncident(arrastre) || (arrastre.incidentes || [])[0] || null;
}

function arrastreMatches(arrastre: Arrastre, search: string) {
  const query = search.trim().toLowerCase();
  if (!query) return true;
  const values = [
    arrastre.id,
    arrastre.estado,
    arrastre.empresaId,
    arrastre.instrucciones,
    ...(arrastre.vagones || []).flatMap((vagon) => [
      vagon.numeroVagon,
      vagon.carga,
      vagon.estado,
      vagon.viaId,
      vagon.seccionId,
    ]),
    ...(arrastre.incidentes || []).flatMap((incident) => [incident.id, incident.estado, incident.motivo]),
  ];
  return values.some((value) => String(value ?? "").toLowerCase().includes(query));
}

function sortArrastres(rows: Arrastre[]) {
  return [...rows].sort((a, b) => {
    const aTime = Date.parse(String(a.fechaSolicitud || a.fechaInicio || "")) || 0;
    const bTime = Date.parse(String(b.fechaSolicitud || b.fechaInicio || "")) || 0;
    return bTime - aTime || b.id - a.id;
  });
}

function sortByFolioOrder(rows: Arrastre[], dailyCounters: Map<number, DailyInfo>) {
  return [...rows].sort((a, b) => {
    const aInfo = dailyCounters.get(a.id);
    const bInfo = dailyCounters.get(b.id);
    const aDate = aInfo?.date || arrastreDateKey(a);
    const bDate = bInfo?.date || arrastreDateKey(b);
    const dateDiff = aDate.localeCompare(bDate);
    if (dateDiff) return dateDiff;
    const orderDiff = (aInfo?.index || a.id) - (bInfo?.index || b.id);
    if (orderDiff) return orderDiff;
    const aTime = Date.parse(String(a.fechaSolicitud || a.fechaInicio || "")) || 0;
    const bTime = Date.parse(String(b.fechaSolicitud || b.fechaInicio || "")) || 0;
    return aTime - bTime || a.id - b.id;
  });
}

function buildDailyCounters(rows: Arrastre[]) {
  const grouped = new Map<string, Arrastre[]>();
  rows.forEach((arrastre) => {
    const key = arrastreDateKey(arrastre);
    if (!key) return;
    grouped.set(key, [...(grouped.get(key) || []), arrastre]);
  });

  const counters = new Map<number, DailyInfo>();
  grouped.forEach((items, date) => {
    sortArrastres(items).reverse().forEach((arrastre, index) => {
      counters.set(arrastre.id, { index: index + 1, total: items.length, date });
    });
  });
  return counters;
}

function StatusStrip({ stats }: { stats: Stats }) {
  const items = [
    ["Solicitados", stats.solicitados, "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"],
    ["En proceso", stats.proceso, "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"],
    ["Detenidos", stats.detenidos, "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"],
    ["Concluidos", stats.concluidos, "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"],
    ["Cancelados", stats.cancelados, "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"],
    ["Vagones activos", stats.vagonesPendientes, "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"],
    ["Incidentes", stats.incidentesAbiertos, "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300"],
  ] as const;

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {items.map(([label, value, tone]) => (
          <span key={label} className={`flex min-h-10 items-center justify-between gap-2 rounded-lg px-3 text-xs font-bold ${tone}`}>
            <span className="truncate">{label}</span>
            <strong className="text-lg leading-none tabular-nums">{value}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}

function getVagonStats(vagones: VagonArrastre[]) {
  const stats = vagones.reduce<Record<VagonStatus, number>>((acc, vagon) => {
    const status = normalizeStatus(vagon.estado) as VagonStatus;
    if (status in acc) acc[status] += 1;
    return acc;
  }, { PENDIENTE: 0, EN_PROCESO: 0, BLOQUEADO: 0, CONCLUIDO: 0 });
  return stats;
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
        <span key={label} className={`flex items-center justify-between rounded-md bg-slate-50 px-2 py-1.5 font-black dark:bg-slate-800/70 ${tone}`}>
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
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

function getNextVagon(vagones: VagonArrastre[]) {
  return (
    vagones.find((vagon) => normalizeStatus(vagon.estado) === "EN_PROCESO") ||
    vagones.find((vagon) => normalizeStatus(vagon.estado) === "PENDIENTE") ||
    null
  );
}

function getVagonName(vagon?: VagonArrastre | null) {
  if (!vagon) return "-";
  return vagon.numeroVagon || `Vagon ${vagon.orden ?? "-"}`;
}

function ArrastreTimelineSummary({ arrastre }: { arrastre: Arrastre }) {
  const timeline = getArrastreTimeline(arrastre);
  return (
    <div className="mb-3 grid gap-2 sm:grid-cols-3">
      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
        <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Inicio primer vagón</p>
        <p className="mt-1 text-sm font-black text-slate-900 dark:text-slate-100">{fmtDate(timeline.inicio)}</p>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
        <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Fin último vagón</p>
        <p className="mt-1 text-sm font-black text-slate-900 dark:text-slate-100">{fmtDate(timeline.fin)}</p>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
        <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Tiempo total</p>
        <p className="mt-1 text-sm font-black text-emerald-700 dark:text-emerald-300">{fmtMinutes(timeline.totalMin)}</p>
      </div>
    </div>
  );
}

function VagonDetailTable({ vagones }: { vagones: VagonArrastre[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/40">
      <table className="min-w-[920px] w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
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
              <td className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-300">{normalizeStatus(vagon.carga) || "VACIO"}</td>
              <td className="px-3 py-2 text-slate-700 dark:text-slate-300">Via {vagon.viaId ?? "-"} / Seccion {vagon.seccionId ?? "-"}</td>
              <td className="px-3 py-2"><StatusBadge status={vagon.estado} /></td>
              <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{fmtDate(vagon.fechaInicio)}</td>
              <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{fmtDate(vagon.fechaFin)}</td>
              <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{fmtMinutes(vagon.metricas?.operacionMin)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ArrastreOperationalTable({
  rows,
  dailyCounters,
  compact = false,
  mode = "active",
  onIncidentSelect,
}: {
  rows: Arrastre[];
  dailyCounters: Map<number, DailyInfo>;
  compact?: boolean;
  mode?: "active" | "history";
  onIncidentSelect?: (incident: IncidenteArrastre, arrastre: Arrastre) => void;
}) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const isHistoryMode = mode === "history";
  const toggleExpanded = (id: number) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
      <div className="overflow-x-auto">
        <table className="min-w-[1180px] w-full table-fixed text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-950 text-[11px] uppercase tracking-wide text-slate-100">
            <tr>
              <th className="w-[19%] px-3 py-3">Folio</th>
              <th className="w-[12%] px-3 py-3">Estado</th>
              <th className="w-[10%] px-3 py-3">Solicitud</th>
              <th className="w-[11%] px-3 py-3">Inicio</th>
              <th className="w-[11%] px-3 py-3">Fin</th>
              <th className="w-[9%] px-3 py-3">Tiempo</th>
              <th className="w-[15%] px-3 py-3">Vagones</th>
              <th className="w-[13%] px-3 py-3">{isHistoryMode ? "Resultado" : "Siguiente"}</th>
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
              const resumenTiempo = fmtMinutes(timeline.totalMin ?? arrastre.resumen?.operacionTotalMin ?? arrastre.resumen?.solicitudTotalMin);

              return (
                <Fragment key={arrastre.id}>
                  <tr
                    onClick={() => toggleExpanded(arrastre.id)}
                    className={`cursor-pointer align-top transition ${
                      isOpen ? "bg-emerald-50/50 shadow-[inset_4px_0_0_#10b981] dark:bg-emerald-950/20" : "hover:bg-slate-50 dark:hover:bg-slate-900/70"
                    }`}
                  >
                    <td className="px-3 py-3">
                      <div className="flex min-w-0 items-start gap-2">
                        <span
                          className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${
                            isOpen
                              ? "border-emerald-200 bg-white text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                              : "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
                          }`}
                        >
                          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </span>
                        <div className="min-w-0">
                          <span className="block truncate text-base font-black leading-none tabular-nums text-slate-950 dark:text-white">{folio}</span>
                          <span className="mt-1 block text-[11px] font-black uppercase tracking-wide text-slate-400">ID #{arrastre.id}</span>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-1 text-xs font-black text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                          <Boxes className="h-3.5 w-3.5" />
                          {arrastre.resumen?.totalVagones ?? vagones.length} vagones
                        </span>
                        {!compact && arrastre.instrucciones && (
                          <span className="line-clamp-1 min-w-0 flex-1 text-xs font-semibold leading-4 text-slate-500 dark:text-slate-400">
                            {arrastre.instrucciones}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex min-w-0 flex-col gap-1.5">
                        <StatusBadge status={arrastre.estado} />
                        {primaryIncident && (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              onIncidentSelect?.(primaryIncident, arrastre);
                            }}
                            onKeyDown={(event) => event.stopPropagation()}
                            className="inline-flex w-fit items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-bold text-amber-800 transition hover:border-amber-400 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-900/50"
                          >
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Inc. {incidentCount}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="min-w-0">
                        <div className="font-black tabular-nums text-slate-950 dark:text-white">{fmtTime(arrastre.fechaSolicitud)}</div>
                        <div className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-400">
                          {fmtDate(arrastre.fechaSolicitud).split(",")[0]}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="min-w-0">
                        <div className="font-black tabular-nums text-slate-950 dark:text-white">{fmtTime(timeline.inicio)}</div>
                        <div className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-400">
                          {fmtDate(timeline.inicio).split(",")[0]}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="min-w-0">
                        <div className="font-black tabular-nums text-slate-950 dark:text-white">{fmtTime(timeline.fin)}</div>
                        <div className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-400">
                          {fmtDate(timeline.fin).split(",")[0]}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-flex rounded-md bg-emerald-50 px-2 py-1 text-xs font-black text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                        {fmtMinutes(timeline.totalMin)}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {isHistoryMode ? (
                        <div className="space-y-1 text-xs font-bold text-slate-500 dark:text-slate-400">
                          <div className="text-base font-black text-slate-950 dark:text-white">{arrastre.resumen?.totalVagones ?? vagones.length}</div>
                          <div>{resumenTiempo}</div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <ArrastreProgress vagones={vagones} />
                          <VagonStatusSummary vagones={vagones} />
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {isHistoryMode ? (
                        <div className="min-w-0 text-xs font-semibold leading-5 text-slate-600 dark:text-slate-300">
                          <div className="line-clamp-3">
                            {primaryIncident?.solucion || primaryIncident?.motivo || arrastre.instrucciones || "Sin observaciones"}
                          </div>
                        </div>
                      ) : (
                        <div className="min-w-0 space-y-1.5">
                          <div className="truncate text-lg font-black leading-none text-emerald-700">{getVagonName(nextVagon)}</div>
                          {nextVagon ? (
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="rounded-md bg-slate-50 px-2 py-1 text-[11px] font-black text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                                Via {nextVagon.viaId ?? "-"}
                              </span>
                              <span className="rounded-md bg-slate-50 px-2 py-1 text-[11px] font-black text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                                Seccion {nextVagon.seccionId ?? "-"}
                              </span>
                              <span className="rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-black text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                                {normalizeStatus(nextVagon.carga) || "VACIO"}
                              </span>
                            </div>
                          ) : (
                            <div className="text-xs font-semibold text-slate-400">Sin vagón pendiente</div>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr key={`${arrastre.id}-detail`}>
                      <td colSpan={8} className="bg-slate-50/70 px-3 py-3 dark:bg-slate-950/70">
                        <ArrastreTimelineSummary arrastre={arrastre} />
                        <VagonDetailTable vagones={vagones} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function TorreonArrastresPanel({ localidadId, variant = "dashboard" }: Props) {
  const [arrastres, setArrastres] = useState<Arrastre[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [scope, setScope] = useState<"actuales" | "pasados">("actuales");
  const [status, setStatus] = useState<ArrastreStatus>("TODOS");
  const [vagonStatus, setVagonStatus] = useState<VagonStatusFilter>("TODOS");
  const [search, setSearch] = useState("");
  const [fechaCampo, setFechaCampo] = useState<ArrastreFechaCampo>("solicitud");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedIncident, setSelectedIncident] = useState<{
    incident: TorreonIncidentDetail;
    title: string;
    subtitle?: string;
  } | null>(null);

  async function load(showRefresh = false) {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const response = await fetch(`/api/cliente/torreon/arrastres?localidadId=${localidadId}`, {
        cache: "no-store",
        credentials: "include",
      });
      const data = await response.json().catch(() => []);
      setArrastres(sortArrastres(extractArray<Arrastre>(data)));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void load();
  }, [localidadId]);

  useEffect(() => {
    setPage(1);
  }, [scope, status, vagonStatus, search, fechaCampo, desde, hasta, pageSize, variant]);

  const todayKey = localDateKey(new Date());
  const dashboardArrastres = useMemo(() => arrastres.filter(isLiveArrastre), [arrastres]);
  const metricRows = variant === "dashboard" ? dashboardArrastres : arrastres;
  const dailyCounters = useMemo(() => buildDailyCounters(arrastres), [arrastres]);

  const stats = useMemo(() => {
    const vagonesActivos = metricRows.filter(isLiveArrastre).flatMap((arrastre) => arrastre.vagones || []);
    const incidentes = metricRows.flatMap((arrastre) => arrastre.incidentes || []);
    return {
      total: metricRows.length,
      solicitados: metricRows.filter((item) => normalizeStatus(item.estado) === "SOLICITADO").length,
      proceso: metricRows.filter((item) => normalizeStatus(item.estado) === "EN_PROCESO").length,
      detenidos: metricRows.filter((item) => normalizeStatus(item.estado) === "DETENIDO").length,
      concluidos: metricRows.filter((item) => normalizeStatus(item.estado) === "CONCLUIDO").length,
      cancelados: metricRows.filter((item) => normalizeStatus(item.estado) === "CANCELADO").length,
      vagonesPendientes: vagonesActivos.filter((item) => ["PENDIENTE", "EN_PROCESO", "BLOQUEADO"].includes(normalizeStatus(item.estado))).length,
      incidentesAbiertos: incidentes.filter((item) => normalizeStatus(item.estado) === "ABIERTO").length,
    };
  }, [metricRows]);

  const visible = useMemo(() => {
    const from = desde ? Date.parse(desde) : null;
    const to = hasta ? Date.parse(hasta) : null;
    return (variant === "dashboard" ? dashboardArrastres : arrastres)
      .filter((arrastre) => status === "TODOS" || normalizeStatus(arrastre.estado) === status)
      .filter((arrastre) => (
        vagonStatus === "TODOS" ||
        (arrastre.vagones || []).some((vagon) => normalizeStatus(vagon.estado) === vagonStatus)
      ))
      .filter((arrastre) => {
        if (!from && !to) return true;
        const value = getArrastreDateValue(arrastre, fechaCampo);
        if (!value) return false;
        const time = Date.parse(value);
        if (Number.isNaN(time)) return false;
        if (from && time < from) return false;
        if (to && time > to) return false;
        return true;
      })
      .filter((arrastre) => {
        const query = search.trim().toLowerCase();
        if (!query) return true;
        const folio = buildArrastreFolio(arrastre, dailyCounters.get(arrastre.id)).toLowerCase();
        return folio.includes(query) || arrastreMatches(arrastre, search);
      })
  }, [arrastres, dashboardArrastres, dailyCounters, desde, fechaCampo, hasta, search, status, vagonStatus, variant]);

  const activeRows = useMemo(() => (
    sortByFolioOrder(visible.filter(isLiveArrastre), dailyCounters)
  ), [dailyCounters, visible]);
  const historyRows = useMemo(() => (
    sortArrastres(visible.filter(isHistoryArrastre))
  ), [visible]);
  const dashboardRows = useMemo(() => activeRows.slice(0, 8), [activeRows]);

  const selectedRows = variant === "movimientos" && scope === "pasados" ? historyRows : activeRows;
  const rows = variant === "dashboard" ? dashboardRows : selectedRows;
  const selectedMode: "active" | "history" = variant === "movimientos" && scope === "pasados" ? "history" : "active";
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedRows = useMemo(() => {
    if (variant === "dashboard") return rows;
    const start = (safePage - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [pageSize, rows, safePage, variant]);
  const headerCount = variant === "dashboard" ? rows.length : selectedRows.length;

  const applyToday = (field: ArrastreFechaCampo) => {
    const now = new Date();
    setFechaCampo(field);
    setDesde(toLocalDateTimeInput(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0)));
    setHasta(toLocalDateTimeInput(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59)));
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
      <div className="border-b border-slate-200 bg-gradient-to-r from-white via-slate-50 to-white px-4 py-4 dark:border-slate-800 dark:from-slate-900 dark:via-slate-900/80 dark:to-slate-900 sm:px-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Torreon</p>
            <h2 className="mt-1 text-xl font-bold text-slate-950 dark:text-white">
              {variant === "dashboard" ? "Arrastres activos" : "Arrastres operativos"}
            </h2>
            {variant === "dashboard" && (
              <p className="mt-1 text-xs font-semibold capitalize text-slate-500 dark:text-slate-400">
                Cola viva · {fmtDateKey(todayKey)}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
              <Hash className="h-4 w-4 text-emerald-600" />
              {headerCount} movimiento{headerCount === 1 ? "" : "s"}
            </span>
            <button
              type="button"
              onClick={() => load(true)}
              disabled={refreshing}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-emerald-300 hover:text-emerald-700 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-emerald-600 dark:hover:text-emerald-300"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Actualizar
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        <StatusStrip stats={stats} />

        {variant === "movimientos" && (
          <div className="inline-grid grid-cols-2 gap-1 rounded-2xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-800">
            {[
              { value: "actuales" as const, label: "Actuales", count: activeRows.length },
              { value: "pasados" as const, label: "Pasados", count: historyRows.length },
            ].map((option) => {
              const active = scope === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setScope(option.value)}
                  className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-black transition ${
                    active
                      ? "bg-white text-emerald-700 shadow-sm dark:bg-slate-950 dark:text-emerald-300"
                      : "text-slate-500 hover:bg-white/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"
                  }`}
                >
                  {option.label}
                  <span className={`rounded-full px-2 py-0.5 text-xs ${active ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"}`}>
                    {option.count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="grid gap-2 xl:grid-cols-[minmax(240px,1fr)_145px_150px_130px_190px_190px_90px]">
            <label className="flex h-10 min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
              <Search className="h-4 w-4 shrink-0" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
                placeholder="Folio, ID, vagon, estado"
              />
            </label>
            <label className="flex h-10 min-w-0 items-center rounded-lg border border-slate-200 bg-slate-50 px-2 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as ArrastreStatus)}
                className="w-full bg-transparent font-black text-slate-700 outline-none dark:text-slate-100"
                aria-label="Estado de arrastre"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="flex h-10 min-w-0 items-center rounded-lg border border-slate-200 bg-slate-50 px-2 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
              <select
                value={vagonStatus}
                onChange={(event) => setVagonStatus(event.target.value as VagonStatusFilter)}
                className="w-full bg-transparent font-black text-slate-700 outline-none dark:text-slate-100"
                aria-label="Estado de vagon"
              >
                {VAGON_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="flex h-10 min-w-0 items-center rounded-lg border border-slate-200 bg-slate-50 px-2 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
              <select
                value={fechaCampo}
                onChange={(event) => setFechaCampo(event.target.value as ArrastreFechaCampo)}
                className="w-full bg-transparent font-black text-slate-700 outline-none dark:text-slate-100"
                aria-label="Fecha base de arrastre"
              >
                <option value="solicitud">Solicitud</option>
                <option value="inicio">Inicio</option>
                <option value="fin">Fin</option>
              </select>
            </label>
            <label className="flex h-10 min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
              <CalendarDays className="h-4 w-4 shrink-0" />
              <input
                type="datetime-local"
                value={desde}
                onChange={(event) => setDesde(event.target.value)}
                className="min-w-0 flex-1 bg-transparent font-semibold text-slate-700 outline-none dark:text-slate-100"
              />
            </label>
            <label className="flex h-10 min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
              <CalendarDays className="h-4 w-4 shrink-0" />
              <input
                type="datetime-local"
                value={hasta}
                onChange={(event) => setHasta(event.target.value)}
                className="min-w-0 flex-1 bg-transparent font-semibold text-slate-700 outline-none dark:text-slate-100"
              />
            </label>
            <label className="flex h-10 min-w-0 items-center rounded-lg border border-slate-200 bg-slate-50 px-2 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
              <select
                value={pageSize}
                onChange={(event) => setPageSize(Number(event.target.value))}
                className="w-full bg-transparent font-black text-slate-700 outline-none dark:text-slate-100"
                aria-label="Arrastres por página"
              >
                {[10, 25, 50, 100].map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2 dark:border-slate-800">
            <button type="button" onClick={() => applyToday("solicitud")} className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300">
              Solicitudes hoy
            </button>
            <button type="button" onClick={() => applyToday("inicio")} className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300">
              Inicios hoy
            </button>
            <button type="button" onClick={() => applyToday("fin")} className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300">
              Cierres hoy
            </button>
            <button type="button" onClick={() => { setDesde(""); setHasta(""); }} className="h-8 rounded-lg border border-rose-200 bg-white px-3 text-xs font-black text-rose-600 transition hover:bg-rose-50 dark:border-rose-800 dark:bg-slate-950 dark:text-rose-300 dark:hover:bg-rose-950/40">
              Limpiar fechas
            </button>
            <span className="ml-auto inline-flex h-8 items-center rounded-lg bg-slate-50 px-3 text-xs font-black text-slate-500 dark:bg-slate-800 dark:text-slate-300">
              Activos {activeRows.length} · Historial {historyRows.length}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-black uppercase tracking-wide text-slate-700 dark:text-slate-200">
                {selectedMode === "history" ? "Historial de arrastres" : "Cola operativa"}
              </h3>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {selectedMode === "history"
                  ? "Arrastres detenidos, concluidos y cancelados."
                  : "Arrastres solicitados o en proceso."}
              </p>
            </div>
            <span className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              {rows.length} registro{rows.length === 1 ? "" : "s"}
            </span>
          </div>
          {loading ? (
            <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : rows.length ? (
            <ArrastreOperationalTable
              rows={paginatedRows}
              dailyCounters={dailyCounters}
              compact={variant === "dashboard"}
              mode={selectedMode}
              onIncidentSelect={(incident, arrastre) => setSelectedIncident({
                incident,
                title: `Arrastre ${buildArrastreFolio(arrastre, dailyCounters.get(arrastre.id))}`,
                subtitle: `Movimiento de arrastre #${arrastre.id}`,
              })}
            />
          ) : (
            <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm font-semibold text-slate-500 dark:border-slate-700 dark:text-slate-400">
              {selectedMode === "history" ? "Sin arrastres pasados para mostrar." : "Sin arrastres vivos para mostrar."}
            </div>
          )}
        </div>

        {variant === "movimientos" && !loading && rows.length > 0 && (
          <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Mostrando {(safePage - 1) * pageSize + 1}-{Math.min(safePage * pageSize, rows.length)} de {rows.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                disabled={safePage <= 1}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-black text-slate-600 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </button>
              <span className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {safePage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                disabled={safePage >= totalPages}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-black text-slate-600 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
              >
                Siguiente
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
      {selectedIncident && (
        <TorreonIncidentDetailModal
          incident={selectedIncident.incident}
          title={selectedIncident.title}
          subtitle={selectedIncident.subtitle}
          onClose={() => setSelectedIncident(null)}
        />
      )}
    </section>
  );
}
