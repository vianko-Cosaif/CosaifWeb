import { extractArray, normalizeStatus, type Arrastre } from "@/features/torreon/arrastres";
export const normalizeArray = extractArray;

export const statusText = (estado?: string | null) => normalizeStatus(estado) || "SIN_ESTADO";
export const isClosed = (estado?: string | null) =>
  ["CONCLUIDO", "CANCELADO"].includes(statusText(estado));
export const isArrastreEditable = (estado?: string | null) =>
  ["SOLICITADO", "DETENIDO"].includes(statusText(estado));

export function canEditArrastreRequest(arrastre: Arrastre) {
  const vagones = arrastre.vagones || [];
  return (
    statusText(arrastre.estado) === "SOLICITADO" &&
    vagones.length > 0 &&
    vagones.every((vagon) => statusText(vagon.estado) === "PENDIENTE")
  );
}

export function canCancelArrastreRequest(arrastre: Arrastre) {
  return (
    !isClosed(arrastre.estado) &&
    !(arrastre.vagones || []).some((vagon) => statusText(vagon.estado) === "EN_PROCESO")
  );
}

export function fieldClass() {
  return "h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20";
}

export function parseErrorMessage(input: unknown, fallback: string) {
  if (input && typeof input === "object" && "error" in input) {
    const payload = input as { error?: unknown; message?: unknown };
    const error = String(payload.error || fallback).trim();
    const detail = String(payload.message || "").trim();
    return detail && detail !== error ? `${error}. ${detail}` : error;
  }
  return fallback;
}
