import { isTorreonLocalidadId, normalizeRoleName } from "@/lib/torreonLocalidad";

type UnknownRecord = Record<string, unknown>;

export type IncidentCountdownContext = {
  localidadId?: string | number | null;
  role?: string | null;
};

function asRecord(value: unknown): UnknownRecord | null {
  return value != null && typeof value === "object" ? value as UnknownRecord : null;
}

function normalizeText(value: unknown) {
  return normalizeRoleName(typeof value === "string" ? value : "");
}

function collectIncidentRecords(incident: unknown) {
  const root = asRecord(incident);
  if (!root) return [];

  const records: UnknownRecord[] = [];
  const queue: UnknownRecord[] = [root];
  const seen = new Set<UnknownRecord>();
  const nestedKeys = ["_original", "_detalle", "movimiento", "localidad"];

  while (queue.length && records.length < 24) {
    const current = queue.shift();
    if (!current || seen.has(current)) continue;
    seen.add(current);
    records.push(current);

    nestedKeys.forEach((key) => {
      const nested = asRecord(current[key]);
      if (nested && !seen.has(nested)) queue.push(nested);
    });
  }

  return records;
}

export function isTorreonIncidentContext(
  incident: unknown,
  context: IncidentCountdownContext = {},
) {
  if (normalizeText(context.role).includes("TORREON")) return true;
  if (isTorreonLocalidadId(context.localidadId)) return true;

  const records = collectIncidentRecords(incident);
  return records.some((record) => {
    const source = normalizeText(record._source || record.source || record.fuente);
    if (source.includes("TORREON")) return true;

    const locality = asRecord(record.localidad);
    const localityName = normalizeText(
      record.localidadNombre || record.nombreLocalidad || locality?.nombre || locality?.name,
    );
    if (localityName.includes("TORREON")) return true;

    return [
      record.localidadId,
      record.localidad_id,
      record.idLocalidad,
      locality?.id,
    ].some((value) => isTorreonLocalidadId(value as string | number | null));
  });
}

export function shouldUseIncidentCountdown(
  incident: unknown,
  context: IncidentCountdownContext = {},
) {
  return !isTorreonIncidentContext(incident, context);
}
