import type { TorreonIncidentDetail } from "@/features/torreon/coordinador/TorreonIncidentDetailModal";

type IncidentKind = "NATURAL" | "ARRASTRE";

type IncidentDetailRequest = {
  incidentId: number;
  localidadId: number;
  tipo: IncidentKind;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export function torreonIncidentDetailUrl({ incidentId, localidadId, tipo }: IncidentDetailRequest) {
  const params = new URLSearchParams({
    source: "torreon",
    tipo,
    localidadId: String(localidadId),
  });
  return `/api/incidentes/${encodeURIComponent(String(incidentId))}?${params.toString()}`;
}

export async function fetchTorreonIncidentDetail(
  request: IncidentDetailRequest,
  signal?: AbortSignal,
): Promise<TorreonIncidentDetail> {
  const response = await fetch(torreonIncidentDetailUrl(request), {
    cache: "no-store",
    credentials: "include",
    signal,
  });
  const payload: unknown = await response.json().catch(() => ({}));
  const envelope = asRecord(payload);

  if (!response.ok) {
    const message = envelope.error || envelope.message;
    throw new Error(
      typeof message === "string" && message.trim()
        ? message
        : "No se pudo cargar el detalle del incidente.",
    );
  }

  const detail = asRecord(envelope.data ?? payload);
  if (!Object.keys(detail).length) {
    throw new Error("El detalle del incidente llegó vacío.");
  }
  return detail as TorreonIncidentDetail;
}
