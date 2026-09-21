import type { IncidenteEmergente } from "@/features/incidentes/useIncidentMonitor";
import type { TorreonIncidentDetail } from "@/features/torreon/coordinador/TorreonIncidentDetailModal";

type TorreonIncidentRequest = {
  incidentId: number;
  localidadId: number;
  tipo: "NATURAL" | "ARRASTRE";
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function positiveNumber(value: unknown): number | null {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

export function torreonIncidentRequest(
  incident: IncidenteEmergente,
  fallbackLocalidadId?: number | null,
): TorreonIncidentRequest | null {
  const original = asRecord(incident._original);
  if (String(original._source || "").toLowerCase() !== "torreon") return null;

  const movimiento = asRecord(original.movimiento);
  const arrastre = asRecord(original.arrastre);
  const incidentId = positiveNumber(incident.id);
  const localidadId =
    positiveNumber(original.localidadId) ||
    positiveNumber(movimiento.localidadId) ||
    positiveNumber(arrastre.localidadId) ||
    positiveNumber(fallbackLocalidadId);
  if (!incidentId || !localidadId) return null;

  const kind = String(
    original._torreonTipo || original.tipoIncidente || original.tipo || "",
  ).toUpperCase();
  const tipo =
    kind.includes("ARRASTRE") || original.arrastreId || original.arrastre ? "ARRASTRE" : "NATURAL";
  return { incidentId, localidadId, tipo };
}

export function torreonIncidentSourceQuery(
  incident: IncidenteEmergente,
  fallbackLocalidadId?: number | null,
) {
  const request = torreonIncidentRequest(incident, fallbackLocalidadId);
  if (!request) return "";
  const params = new URLSearchParams({
    source: "torreon",
    tipo: request.tipo,
    localidadId: String(request.localidadId),
  });
  return `?${params.toString()}`;
}

export function withTorreonIncidentDetail(
  incident: IncidenteEmergente,
  detail: TorreonIncidentDetail,
): IncidenteEmergente {
  const images =
    Array.isArray(detail.imagenes) && detail.imagenes.length
      ? detail.imagenes.filter((url): url is string => typeof url === "string" && Boolean(url))
      : (detail.fotos || [])
          .map((foto) => foto.url)
          .filter((url): url is string => typeof url === "string" && Boolean(url));
  return {
    ...incident,
    imagenes: images,
    imagen1: images[0],
    imagen2: images[1],
    imagen3: images[2],
    imagen4: images[3],
    _original: { ...asRecord(incident._original), ...detail },
  };
}
