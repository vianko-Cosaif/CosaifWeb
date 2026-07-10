import { HISTORY_STATUSES, OPERATIONAL_STATUSES } from "./constants";
import type {
  Arrastre,
  ArrastreFechaCampo,
  DailyInfo,
  VagonArrastre,
  VagonStatus,
} from "./types";

export function normalizeStatus(value?: string | null) {
  return String(value || "").trim().toUpperCase();
}

export function extractArray<T>(input: unknown): T[] {
  if (Array.isArray(input)) return input as T[];
  if (input && typeof input === "object") {
    const record = input as { data?: unknown; items?: unknown; rows?: unknown };
    if (Array.isArray(record.data)) return record.data as T[];
    if (Array.isArray(record.items)) return record.items as T[];
    if (Array.isArray(record.rows)) return record.rows as T[];
  }
  return [];
}

export function fmtDate(value?: string | null) {
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

export function fmtTime(value?: string | null) {
  if (!value) return "--:--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";
  return new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function localDateKey(value?: string | Date | null) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function arrastreDateKey(arrastre: Arrastre) {
  return localDateKey(arrastre.fechaSolicitud || arrastre.fechaInicio || arrastre.fechaFin);
}

export function buildArrastreFolio(arrastre: Arrastre, dailyInfo?: DailyInfo) {
  const dateKey = dailyInfo?.date || arrastreDateKey(arrastre);
  const index = dailyInfo?.index || arrastre.id;
  return `${formatFolioDate(dateKey)}:${index}`;
}

export function getArrastreDateValue(arrastre: Arrastre, campo: ArrastreFechaCampo) {
  if (campo === "inicio") return getArrastreTimeline(arrastre).inicio || arrastre.fechaInicio || null;
  if (campo === "fin") return getArrastreTimeline(arrastre).fin || arrastre.fechaFin || null;
  return arrastre.fechaSolicitud || null;
}

export function toLocalDateTimeInput(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function isLiveArrastre(arrastre: Arrastre) {
  return OPERATIONAL_STATUSES.has(normalizeStatus(arrastre.estado));
}

export function isHistoryArrastre(arrastre: Arrastre) {
  return HISTORY_STATUSES.has(normalizeStatus(arrastre.estado));
}

export function fmtDateKey(value: string) {
  if (!value) return "-";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(date);
}

export function fmtMinutes(value?: number | null) {
  if (!Number.isFinite(Number(value))) return "-";
  const minutes = Math.max(0, Math.round(Number(value)));
  if (minutes < 60) return `${minutes} min`;
  const hrs = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem ? `${hrs} h ${rem} min` : `${hrs} h`;
}

export function parseDateTime(value?: string | null) {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

export function getArrastreTimeline(arrastre: Arrastre) {
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

export function getOpenIncident(arrastre: Arrastre) {
  return (arrastre.incidentes || []).find((incident) => normalizeStatus(incident.estado) === "ABIERTO") || null;
}

export function getPrimaryIncident(arrastre: Arrastre) {
  return getOpenIncident(arrastre) || (arrastre.incidentes || [])[0] || null;
}

export function arrastreMatches(arrastre: Arrastre, search: string) {
  const query = search.trim().toLowerCase();
  if (!query) return true;
  const values = [
    arrastre.id,
    arrastre.estado,
    arrastre.empresaId,
    arrastre.viaOrigenId,
    arrastre.seccionOrigenId,
    arrastre.viaDestinoId,
    arrastre.seccionDestinoId,
    arrastre.instrucciones,
    ...(arrastre.vagones || []).flatMap((vagon) => [
      vagon.numeroVagon,
      vagon.carga,
      vagon.estado,
      vagon.viaOrigenId,
      vagon.seccionOrigenId,
      vagon.viaId,
      vagon.seccionId,
    ]),
    ...(arrastre.incidentes || []).flatMap((incident) => [incident.id, incident.estado, incident.motivo]),
  ];
  return values.some((value) => String(value ?? "").toLowerCase().includes(query));
}

export function sortArrastres(rows: Arrastre[]) {
  return [...rows].sort((a, b) => {
    const aTime = Date.parse(String(a.fechaSolicitud || a.fechaInicio || "")) || 0;
    const bTime = Date.parse(String(b.fechaSolicitud || b.fechaInicio || "")) || 0;
    return bTime - aTime || b.id - a.id;
  });
}

export function sortByFolioOrder(rows: Arrastre[], dailyCounters: Map<number, DailyInfo>) {
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

export function buildDailyCounters(rows: Arrastre[]) {
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

export function getVagonStats(vagones: VagonArrastre[]) {
  return vagones.reduce<Record<VagonStatus, number>>(
    (acc, vagon) => {
      const status = normalizeStatus(vagon.estado) as VagonStatus;
      if (status in acc) acc[status] += 1;
      return acc;
    },
    { PENDIENTE: 0, EN_PROCESO: 0, BLOQUEADO: 0, CONCLUIDO: 0 }
  );
}

export function getNextVagon(vagones: VagonArrastre[]) {
  return (
    vagones.find((vagon) => normalizeStatus(vagon.estado) === "EN_PROCESO") ||
    vagones.find((vagon) => normalizeStatus(vagon.estado) === "PENDIENTE") ||
    null
  );
}

export function getVagonName(vagon?: VagonArrastre | null) {
  if (!vagon) return "-";
  return vagon.numeroVagon || `Vagon ${vagon.orden ?? "-"}`;
}

function formatFolioDate(dateKey: string) {
  if (!dateKey) return "sin-fecha";
  const [year, month, day] = dateKey.split("-");
  if (!year || !month || !day) return dateKey;
  return `${day}-${month}-${year}`;
}
