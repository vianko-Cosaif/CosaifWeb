import type { TornoHistoryItem, TornoMeasurePosition, TornoMeasures } from "./types";

export const TORNO_MEASURE_POSITIONS: TornoMeasurePosition[] = [
  "L1",
  "R1",
  "L2",
  "R2",
  "L3",
  "R3",
  "L4",
  "R4",
  "L5",
  "R5",
  "L6",
  "R6",
];

export function cn(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(" ");
}

export function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateShort(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
  });
}

export function formatTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDuration(seconds?: number | null) {
  if (!seconds || seconds < 1) return "0 min";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

export function serviceFolio(item: TornoHistoryItem) {
  const rawDate = item.date ?? item.startAt ?? item.updatedAt;
  const date = rawDate ? new Date(rawDate) : null;
  const day = date && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" }).replaceAll("/", "-")
    : "sin-fecha";
  return `${day}:${item.orderNumber ?? item.rondaNumber ?? item.id}`;
}

export function normalizeMeasureInput(measures?: TornoMeasures) {
  const next: Record<TornoMeasurePosition, string> = {} as Record<TornoMeasurePosition, string>;
  for (const position of TORNO_MEASURE_POSITIONS) {
    next[position] = measures?.[position] == null ? "" : String(measures[position]);
  }
  return next;
}

export function statusLabel(status?: string) {
  const key = String(status || "").toUpperCase();
  if (key === "EN_PROCESO") return "EN PROCESO";
  if (key === "SOLICITADO") return "SOLICITADO";
  if (key === "DETENIDO") return "DETENIDO";
  if (key === "CONCLUIDO") return "CONCLUIDO";
  if (key === "CANCELADO") return "CANCELADO";
  if (key === "PAUSADO") return "PAUSADO";
  if (key === "TERMINADO") return "TERMINADO";
  if (key === "PENDIENTE") return "PENDIENTE";
  return key || "-";
}
