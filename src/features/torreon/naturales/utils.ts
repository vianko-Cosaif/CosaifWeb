import type { FechaCampo, MovimientoNatural, NaturalesMetrics, SortDir, SortKey } from "./types";

export function normalizeStatus(value?: string | null) {
  return String(value || "").trim().toUpperCase() || "SIN_ESTADO";
}

export function formatDate(value?: string | null) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export function formatDuration(inicio?: string | null, fin?: string | null) {
  if (!inicio || !fin) return "--";
  const start = Date.parse(inicio);
  const end = Date.parse(fin);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return "--";
  const minutes = Math.round((end - start) / 60000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

export function formatMinutes(minutes?: number | null) {
  if (!Number.isFinite(Number(minutes))) return "--";
  const safe = Math.max(0, Math.round(Number(minutes)));
  if (safe < 60) return `${safe} min`;
  const hours = Math.floor(safe / 60);
  const rest = safe % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

export function getChronologyStart(row: MovimientoNatural) {
  return row.fechaInicio || row.fechaSolicitud || null;
}

export function getChronologyEnd(row: MovimientoNatural) {
  return row.fechaFin || null;
}

export function getOperatorLabel(row: MovimientoNatural) {
  const name = row.iniciadoPorNombre || row.operadorNombre || row.creadoPorNombre;
  if (name) return name;
  const id = row.iniciadoPorId || row.operadorId || row.creadoPorId;
  return id ? `Usuario #${id}` : "Sin iniciar";
}

export function getClientLabel(row: MovimientoNatural) {
  if (row.clienteNombre) return row.clienteNombre;
  if (row.clienteId) return `Cliente #${row.clienteId}`;
  return row.empresaNombre || "Cliente";
}

export function getFechaValue(row: MovimientoNatural, campo: FechaCampo | SortKey) {
  if (campo === "cronologia") return getChronologyStart(row);
  if (campo === "inicio") return row.fechaInicio || null;
  if (campo === "fin") return row.fechaFin || null;
  if (campo === "solicitud") return row.fechaSolicitud || null;
  return null;
}

export function toLocalDateTimeInput(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function compareRows(a: MovimientoNatural, b: MovimientoNatural, sortKey: SortKey, sortDir: SortDir) {
  const factor = sortDir === "asc" ? 1 : -1;
  if (sortKey === "id") return String(a.id).localeCompare(String(b.id), "es-MX", { numeric: true }) * factor;
  if (sortKey === "cronologia") {
    const aStart = Date.parse(String(getChronologyStart(a) || "")) || Number.POSITIVE_INFINITY;
    const bStart = Date.parse(String(getChronologyStart(b) || "")) || Number.POSITIVE_INFINITY;
    const startDiff = aStart - bStart;
    if (startDiff) return startDiff * factor;
    const aEnd = Date.parse(String(getChronologyEnd(a) || "")) || Number.POSITIVE_INFINITY;
    const bEnd = Date.parse(String(getChronologyEnd(b) || "")) || Number.POSITIVE_INFINITY;
    const endDiff = aEnd - bEnd;
    if (endDiff) return endDiff * factor;
  }
  const aTime = Date.parse(String(getFechaValue(a, sortKey) || "")) || Number.POSITIVE_INFINITY;
  const bTime = Date.parse(String(getFechaValue(b, sortKey) || "")) || Number.POSITIVE_INFINITY;
  return (aTime - bTime) * factor || String(a.id).localeCompare(String(b.id), "es-MX", { numeric: true }) * factor;
}

export function statusClass(status: string) {
  if (status === "CONCLUIDO") return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300";
  if (status === "EN_PROCESO") return "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300";
  if (status === "DETENIDO" || status === "BLOQUEADO") return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300";
  if (status === "CANCELADO") return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300";
  return "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";
}

export function getIncidentList(row: MovimientoNatural) {
  return Array.isArray(row.incidentes) ? row.incidentes : [];
}

export function getPrimaryIncident(row: MovimientoNatural) {
  const incidentes = getIncidentList(row);
  return incidentes.find((incidente) => normalizeStatus(incidente.estado) === "ABIERTO") || incidentes[0] || null;
}

export function filterNaturalRows(
  rows: MovimientoNatural[],
  filters: {
    search: string;
    fechaCampo: FechaCampo;
    desde: string;
    hasta: string;
    sortKey: SortKey;
    sortDir: SortDir;
  }
) {
  const q = filters.search.trim().toLowerCase();
  const from = filters.desde ? Date.parse(filters.desde) : null;
  const to = filters.hasta ? Date.parse(filters.hasta) : null;

  return rows
    .filter((row) => {
      if (!q) return true;
      return [
        row.id,
        row.empresaNombre,
        row.locomotiveNumber,
        row.estado,
        row.viaOrigen,
        row.viaDestino,
        row.tipoMovimiento,
        row.clienteNombre,
        row.supervisorNombre,
        row.coordinadorNombre,
        row.operadorNombre,
        row.creadoPorNombre,
        row.iniciadoPorNombre,
      ]
        .map((value) => String(value ?? "").toLowerCase())
        .some((value) => value.includes(q));
    })
    .filter((row) => {
      if (!from && !to) return true;
      const value = getFechaValue(row, filters.fechaCampo);
      if (!value) return false;
      const time = Date.parse(value);
      if (Number.isNaN(time)) return false;
      if (from && time < from) return false;
      if (to && time > to) return false;
      return true;
    })
    .sort((a, b) => compareRows(a, b, filters.sortKey, filters.sortDir));
}

export function getNaturalMetrics(rows: MovimientoNatural[]): NaturalesMetrics {
  const active = rows.filter((row) => !["CONCLUIDO", "CANCELADO"].includes(normalizeStatus(row.estado))).length;
  const process = rows.filter((row) => normalizeStatus(row.estado) === "EN_PROCESO").length;
  const done = rows.filter((row) => normalizeStatus(row.estado) === "CONCLUIDO").length;
  const withPhotos = rows.filter((row) => (row.fotos || []).length > 0).length;
  const withIncidents = rows.filter((row) => getIncidentList(row).length > 0).length;
  const durations = rows
    .map((row) => {
      const start = Date.parse(String(row.fechaInicio || ""));
      const end = Date.parse(String(row.fechaFin || ""));
      return Number.isNaN(start) || Number.isNaN(end) || end < start ? null : Math.round((end - start) / 60000);
    })
    .filter((value): value is number => typeof value === "number");
  const avg = durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : null;
  return { active, process, done, withPhotos, withIncidents, avg };
}
