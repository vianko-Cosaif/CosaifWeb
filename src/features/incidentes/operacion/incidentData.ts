import { z } from "zod";
import { currentStorageScope } from "@/lib/auth/storageScope";
import { cachedFetchJson } from "@/lib/http/client";
import { mapConcurrent } from "@/lib/http/concurrency";
import type { IncidenteRow } from "./types";

const identifier = z.union([z.number(), z.string()]);
const namedRecord = z.looseObject({ nombre: z.string().nullish() });
const movementSchema = z.looseObject({
  localidadId: identifier.nullish(),
  empresa: namedRecord.nullish(),
  viaOrigen: namedRecord.nullish(),
  viaDestino: namedRecord.nullish(),
  locomotiveNumber: identifier.nullish(),
});
const detailSchema = z.looseObject({
  id: identifier.optional(),
  _source: z.string().nullish(),
  source: z.string().nullish(),
  _torreonTipo: z.string().nullish(),
  tipoIncidente: z.string().nullish(),
  localidadId: identifier.nullish(),
  movimiento: movementSchema.nullish(),
  descripcion: z.string().nullish(),
  motivo: z.string().nullish(),
  usuario: namedRecord.nullish(),
});
const incidentSchema = detailSchema.extend({
  id: identifier,
  estado: z.string(),
  fechaInicio: z.string().nullish(),
});
const pageSchema = z.object({
  success: z.literal(true),
  data: z.array(incidentSchema),
  meta: z
    .object({
      page: z.number().int().positive().optional(),
      pageSize: z.number().int().positive().optional(),
      total: z.number().int().nonnegative().optional(),
      totalPages: z.number().int().nonnegative().optional(),
    })
    .nullish(),
});

export type IncidentRecord = z.infer<typeof incidentSchema>;
export type IncidentDetail = z.infer<typeof detailSchema>;
type IncidentIdentity = Pick<
  IncidentDetail,
  "id" | "_source" | "source" | "_torreonTipo" | "tipoIncidente" | "localidadId" | "movimiento"
> & { _detalle?: IncidentIdentity };

export function parseIncidentPage(value: unknown) {
  const result = pageSchema.safeParse(value);
  if (!result.success) throw new Error("Formato de respuesta de incidentes inesperado");
  return result.data;
}

export function parseIncidentDetail(value: unknown): IncidentDetail {
  const data = value && typeof value === "object" && "data" in value ? value.data : value;
  return detailSchema.parse(data);
}

export function isTorreonIncident(incident: IncidentIdentity) {
  return (
    String(
      incident._source || incident.source || incident._detalle?._source || "",
    ).toLowerCase() === "torreon"
  );
}

export function incidentSourceQuery(incident: IncidentIdentity): string {
  if (!isTorreonIncident(incident)) return "";
  const params = new URLSearchParams({ source: "torreon" });
  const tipo = String(
    incident._torreonTipo ||
      incident.tipoIncidente ||
      incident._detalle?._torreonTipo ||
      incident._detalle?.tipoIncidente ||
      "",
  ).toUpperCase();
  if (tipo.includes("ARRASTRE")) params.set("tipo", "ARRASTRE");
  if (tipo.includes("NATURAL")) params.set("tipo", "NATURAL");
  const localidad =
    incident.localidadId ??
    incident.movimiento?.localidadId ??
    incident._detalle?.localidadId ??
    incident._detalle?.movimiento?.localidadId;
  if (localidad) params.set("localidadId", String(localidad));
  return `?${params}`;
}

export function incidentCacheKey(
  incident: IncidentIdentity,
  scope = currentStorageScope() ?? "anonymous",
) {
  return JSON.stringify([scope, incidentSourceQuery(incident), String(incident.id)]);
}

export class IncidentDetailCache {
  private entries = new Map<string, { data: IncidentDetail; expiresAt: number }>();
  constructor(
    private readonly capacity = 150,
    private readonly ttlMs = 30_000,
  ) {}

  set(key: string, data: IncidentDetail) {
    this.entries.delete(key);
    this.entries.set(key, { data, expiresAt: Date.now() + this.ttlMs });
    while (this.entries.size > this.capacity)
      this.entries.delete(this.entries.keys().next().value!);
  }

  get(key: string) {
    const entry = this.entries.get(key);
    if (!entry) return null;
    this.entries.delete(key);
    if (entry.expiresAt <= Date.now()) return null;
    this.entries.set(key, entry);
    return entry.data;
  }

  clear() {
    this.entries.clear();
  }
}

export const detailCache = new IncidentDetailCache();

export async function fetchIncidenteDetailsBulk(
  incidents: readonly IncidentRecord[],
  signal: AbortSignal,
  maxConcurrency = 4,
): Promise<Record<string, IncidentDetail>> {
  const result: Record<string, IncidentDetail> = {};
  // Capture the account once: a session change must not put old responses in the new account.
  const scope = currentStorageScope() ?? "anonymous";
  const unique = new Map(
    incidents
      .filter((incident) => incident.id && !isTorreonIncident(incident))
      .filter(
        (incident) =>
          !incident.movimiento?.empresa ||
          !incident.movimiento?.viaOrigen ||
          !incident.movimiento?.viaDestino,
      )
      .map((incident) => [incidentCacheKey(incident, scope), incident]),
  );
  const pending: [string, IncidentRecord][] = [];
  for (const [key, incident] of unique) {
    const cached = detailCache.get(key);
    if (cached) result[key] = cached;
    else pending.push([key, incident]);
  }
  // A free worker starts the next detail immediately, without waiting for a slow batch.
  await mapConcurrent(pending, maxConcurrency, async ([key, incident]) => {
    if (signal.aborted) return;
    try {
      const response = await cachedFetchJson<unknown>(
        `/api/incidentes/${encodeURIComponent(String(incident.id))}`,
        { signal },
        { ttlMs: 30_000 },
      );
      if (signal.aborted || (currentStorageScope() ?? "anonymous") !== scope) return;
      const data = parseIncidentDetail(response);
      detailCache.set(key, data);
      result[key] = data;
    } catch {
      /* Optional details must not hide a successfully loaded incident list. */
    }
  });
  return result;
}

export function incidentRows(
  incidents: readonly IncidentRecord[],
  detailsMap: Record<string, IncidentDetail>,
): IncidenteRow[] {
  const statuses: Record<string, string> = {
    ABIERTO: "Activo",
    CERRADO: "Cerrado",
    RESUELTO: "Resuelto",
  };
  return incidents.map((incident) => {
    const details = detailsMap[incidentCacheKey(incident)] ?? {};
    const movement = details.movimiento || incident.movimiento;
    const original = { ...details, ...incident, movimiento: movement, _detalle: details };
    const torreon = isTorreonIncident(original);
    const tipo = String(
      original._torreonTipo || original.tipoIncidente || details._torreonTipo || "",
    ).toUpperCase();
    return {
      id: incident.id,
      empresa: movement?.empresa?.nombre ?? incident.movimiento?.empresa?.nombre ?? undefined,
      locomotora: movement?.locomotiveNumber ?? incident.movimiento?.locomotiveNumber ?? undefined,
      origen: movement?.viaOrigen?.nombre ?? incident.movimiento?.viaOrigen?.nombre ?? undefined,
      destino: movement?.viaDestino?.nombre ?? incident.movimiento?.viaDestino?.nombre ?? undefined,
      descripcion:
        details.descripcion ??
        details.motivo ??
        incident.descripcion ??
        incident.motivo ??
        undefined,
      fecha: incident.fechaInicio
        ? new Date(incident.fechaInicio).toLocaleDateString("es-ES", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          })
        : "—",
      estatus: statuses[incident.estado] || "Desconocido",
      estadoRaw: incident.estado,
      usuario: details.usuario?.nombre ?? incident.usuario?.nombre ?? undefined,
      fuente: torreon ? "Torreón" : "Cosaif",
      tipoIncidente: torreon ? (tipo === "ARRASTRE" ? "Arrastre" : "Natural") : "GDL",
      _original: original,
    };
  });
}
