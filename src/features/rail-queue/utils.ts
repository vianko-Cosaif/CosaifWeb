import type { Localidad, Ronda, RondaInfo } from "./types";

export const API_XAPI_BASE = process.env.NEXT_PUBLIC_API_URL || "/xapi";
export const API_BFF_BASE = (process.env.NEXT_PUBLIC_API_BASE ?? "/bff").replace(/\/+$/, "");

export const railQueueListFormatter = new Intl.ListFormat("es", {
  style: "short",
  type: "conjunction",
});

export function codeFrom(info?: RondaInfo, fallbackId?: number) {
  return String(info?.movimientoId ?? info?.movimiento?.id ?? fallbackId ?? "—");
}

export function movementIdFrom(ronda?: Ronda | null, info?: RondaInfo | null) {
  return info?.movimientoId ?? info?.movimiento?.id ?? ronda?.movimientoId ?? null;
}

export function fmtLoco(value: unknown, fallback = "N/D") {
  if (value == null) return fallback;
  const clean = String(value).replace(/\D+/g, "");
  if (!clean) return fallback;
  return clean.padStart(4, "0").slice(0, 16);
}

export function formatDateTimeMX(
  iso?: string | null,
  options: {
    fallback?: string;
    dateStyle?: Intl.DateTimeFormatOptions["dateStyle"];
    timeStyle?: Intl.DateTimeFormatOptions["timeStyle"];
    hour12?: boolean;
  } = {}
) {
  const {
    fallback = "—",
    dateStyle = "medium",
    timeStyle = "short",
    hour12,
  } = options;
  if (!iso) return fallback;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle,
    timeStyle,
    timeZone: "America/Mexico_City",
    ...(hour12 === undefined ? {} : { hour12 }),
  }).format(date);
}

export function formatQueueDate(iso?: string | null, fallback = "—") {
  if (!iso) return fallback;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    day: "numeric",
    month: "short",
    hour12: true,
    timeZone: "America/Mexico_City",
  }).format(date);
}

export async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    credentials: "include",
    mode: "same-origin",
    signal,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`${response.status} ${response.statusText} :: ${text.slice(0, 200)}`);
  }

  return (await response.json()) as T;
}

export function unwrapArray<T>(response: unknown): T[] {
  if (Array.isArray(response)) return response as T[];
  if (response && typeof response === "object") {
    const record = response as { data?: unknown; items?: unknown; rows?: unknown };
    if (Array.isArray(record.data)) return record.data as T[];
    if (Array.isArray(record.items)) return record.items as T[];
    if (Array.isArray(record.rows)) return record.rows as T[];
  }
  return [];
}

export function isAbortError(error: unknown) {
  if (!error) return false;
  if (typeof DOMException !== "undefined" && error instanceof DOMException) {
    return error.name === "AbortError";
  }
  if (error instanceof Error) {
    const message = String(error.message || "").toLowerCase();
    return (
      error.name === "AbortError" ||
      message.includes("signal is aborted") ||
      message.includes("aborted without reason")
    );
  }
  if (typeof error === "object" && "name" in error) {
    return (error as { name?: string }).name === "AbortError";
  }
  return false;
}

export function timeAgo(timestamp?: number | null) {
  if (!timestamp) return "—";
  const seconds = Math.max(1, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h`;
}

export function attachLocalidad(list: Ronda[], localidad: Localidad): Ronda[] {
  return list.map((ronda) => ({
    ...ronda,
    localidadId: ronda.localidadId ?? localidad.id,
    localidad: ronda.localidad ?? { id: localidad.id, nombre: localidad.nombre },
  }));
}
