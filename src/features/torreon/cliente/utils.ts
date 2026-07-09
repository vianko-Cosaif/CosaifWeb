import { extractArray, localDateKey, normalizeStatus, type Arrastre } from "@/features/torreon/arrastres";

export const dateKey = localDateKey;
export const normalizeArray = extractArray;

export const statusText = (estado?: string | null) => normalizeStatus(estado) || "SIN_ESTADO";
export const isClosed = (estado?: string | null) => ["CONCLUIDO", "CANCELADO"].includes(statusText(estado));
export const isArrastreEditable = (estado?: string | null) => ["SOLICITADO", "DETENIDO"].includes(statusText(estado));

export function arrastreMatchesSearch(arrastre: Arrastre, query: string) {
  const text = query.trim().toLowerCase();
  if (!text) return true;

  const haystack = [
    arrastre.id,
    arrastre.estado,
    arrastre.instrucciones,
    arrastre.fechaSolicitud,
    ...(arrastre.vagones || []).flatMap((vagon) => [
      vagon.numeroVagon,
      vagon.carga,
      vagon.estado,
      vagon.viaId,
      vagon.seccionId,
    ]),
  ]
    .filter((item) => item != null)
    .join(" ")
    .toLowerCase();

  return haystack.includes(text);
}

export function fieldClass() {
  return "h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20";
}

export function parseErrorMessage(input: unknown, fallback: string) {
  if (input && typeof input === "object" && "error" in input) {
    return String((input as { error?: unknown }).error || fallback);
  }
  return fallback;
}
