import { extractArray, localDateKey, normalizeStatus, type Arrastre } from "@/features/torreon/arrastres";
import type { FotoDraft } from "./types";

export const dateKey = localDateKey;
export const normalizeArray = extractArray;

export const fmtFullDate = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

export const statusText = (estado?: string | null) => normalizeStatus(estado) || "SIN_ESTADO";
export const isClosed = (estado?: string | null) => ["CONCLUIDO", "CANCELADO"].includes(statusText(estado));
export const displayStatus = (estado?: string | null) => statusText(estado).replaceAll("_", " ");

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

export function getOpenIncident(arrastre: Arrastre) {
  return (arrastre.incidentes || []).find((incidente) => statusText(incidente.estado) === "ABIERTO");
}

export async function readFilesAsDataUrls(files: FileList | null): Promise<FotoDraft[]> {
  const selected = Array.from(files || []).slice(0, 4);
  return Promise.all(
    selected.map((file) => new Promise<FotoDraft>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ name: file.name, dataUrl: String(reader.result || "") });
      reader.onerror = () => reject(new Error(`No se pudo leer ${file.name}`));
      reader.readAsDataURL(file);
    }))
  );
}

export function parseErrorMessage(input: unknown, fallback: string) {
  if (input && typeof input === "object" && "error" in input) {
    return String((input as { error?: unknown }).error || fallback);
  }
  return fallback;
}
