import "server-only";
import type { UnknownRecord, NormalizedRondaBase, MovimientoRecord, RondaOut } from "./models";
import { RondasReadError } from "./errors";

export function asRecord(input: unknown): UnknownRecord {
  return input && typeof input === "object" ? (input as UnknownRecord) : {};
}

export function asNumber(input: unknown): number | null {
  const value = Number(input);
  return Number.isFinite(value) ? value : null;
}

export function firstPositiveNumber(...values: unknown[]): number | null {
  for (const value of values) {
    const parsed = asNumber(value);
    if (parsed && parsed > 0) return parsed;
  }
  return null;
}

export function asDateString(input: unknown): string | null {
  return typeof input === "string" && input.trim() ? input : null;
}

export function asPriority(input: unknown): "BAJA" | "ALTA" | null {
  const value = String(input ?? "").toUpperCase();
  return value === "BAJA" || value === "ALTA" ? value : null;
}

export function extractArray(input: unknown): UnknownRecord[] {
  const record = asRecord(input);
  if (record.success === false) throw new RondasReadError(502);
  const collection = Array.isArray(input)
    ? input
    : [record.data, record.items, record.rows, record.value].find(Array.isArray);
  if (
    !Array.isArray(collection) ||
    collection.some((item) => !item || typeof item !== "object" || Array.isArray(item))
  ) {
    throw new RondasReadError(502);
  }
  return collection as UnknownRecord[];
}

export function readDetailRecord(input: unknown): UnknownRecord {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new RondasReadError(502);
  const record = input as UnknownRecord;
  if (
    record.success === false ||
    !["id", "idTecnico", "movimiento", "movimientoId", "empresa"].some((key) => key in record)
  ) {
    throw new RondasReadError(502);
  }
  if (
    record.movimiento != null &&
    (typeof record.movimiento !== "object" || Array.isArray(record.movimiento))
  ) {
    throw new RondasReadError(502);
  }
  return record;
}

export function normalizeRondas(input: unknown): NormalizedRondaBase[] {
  return extractArray(input).map((x) => {
    const ronda = asRecord(x.ronda);
    const movimientoRecord = asRecord(x.movimiento ?? ronda.movimiento);
    const empresaRecord = asRecord(x.empresa ?? ronda.empresa ?? movimientoRecord.empresa);
    const movimiento = Object.keys(movimientoRecord).length
      ? {
          ...(movimientoRecord as MovimientoRecord),
          viaOrigen: (movimientoRecord.viaOrigen ?? x.viaOrigen ?? ronda.viaOrigen ?? null) as
            MovimientoRecord["viaOrigen"] | null,
          viaDestino: (movimientoRecord.viaDestino ?? x.viaDestino ?? ronda.viaDestino ?? null) as
            MovimientoRecord["viaDestino"] | null,
        }
      : null;
    const empresa = Object.keys(empresaRecord).length
      ? (empresaRecord as { id?: number; nombre?: string })
      : null;

    const id = Number(x.id ?? x.rondaId ?? ronda.id);
    if (!Number.isFinite(id) || id <= 0) throw new RondasReadError(502);
    return {
      id,
      localidadId: firstPositiveNumber(
        x.localidadId,
        ronda.localidadId,
        movimiento?.localidadId,
        movimiento?.localidad?.id,
      ),
      rondaNumero: Number(x.rondaNumero ?? x.numero ?? x.num ?? ronda.numero ?? 0),
      orden: Number(x.orden ?? x.order ?? 0),
      concluido: Boolean(
        x.concluido ??
        x.finalizado ??
        x.terminado ??
        (typeof x.estado === "string" ? x.estado.toUpperCase() === "CONCLUIDO" : x.estado === true),
      ),
      empresa,
      movimiento,
      movimientoId: firstPositiveNumber(x.movimientoId, ronda.movimientoId, movimiento?.id),
      createdAt: asDateString(
        x.createdAt ?? ronda.createdAt ?? movimiento?.fechaSolicitud ?? movimiento?.createdAt,
      ),
    };
  });
}

export function isTornoConcluido(status?: string | null) {
  return ["CONCLUIDO", "CANCELADO"].includes(String(status ?? "").toUpperCase());
}

export function normalizeMovimientoCollection(input: unknown): MovimientoRecord[] {
  const source = asRecord(input);
  return extractArray(source.data ?? source.items ?? source.rows ?? input) as MovimientoRecord[];
}

export function movementToRondaOut(
  mv: MovimientoRecord,
  index: number,
  concluido: boolean,
): RondaOut | null {
  const movimientoId = firstPositiveNumber(mv.idTecnico, mv.id);
  if (!movimientoId) return null;
  const visibleId = firstPositiveNumber(mv.folioLocalidad, mv.id) ?? movimientoId;
  return {
    id: -Math.abs(1_000_000 + movimientoId),
    localidadId: firstPositiveNumber(mv.localidadId, mv.localidad?.id),
    rondaNumero: 1,
    orden: index + 1,
    concluido,
    empresa: mv.empresa
      ? { id: Number(mv.empresa.id ?? 0), nombre: String(mv.empresa.nombre ?? "—") }
      : null,
    movimiento: {
      id: visibleId,
      idTecnico: movimientoId,
      folioLocalidad: mv.folioLocalidad ?? visibleId,
      folioLocalidadLabel: mv.folioLocalidadLabel ?? `#${visibleId}`,
      viaOrigen: mv.viaOrigen ?? null,
      viaDestino: mv.viaDestino ?? null,
      lavado: Boolean(mv.lavado ?? mv.Lavado),
      torno: Boolean(mv.torno),
      estado: mv.estado ?? (concluido ? "CONCLUIDO" : "SOLICITADO"),
      prioridad: mv.prioridad ?? null,
      locomotiveNumber: mv.locomotiveNumber ?? mv.locomotora ?? null,
      locomotora: mv.locomotora ?? null,
      fechaSolicitud: mv.fechaSolicitud ?? mv.createdAt ?? null,
      createdAt: mv.createdAt ?? null,
      tipoMovimiento: mv.tipoMovimiento ?? null,
      accion: mv.accion ?? null,
      fechaInicio: mv.fechaInicio ?? null,
      fechaFin: mv.fechaFin ?? null,
      instrucciones: mv.instrucciones ?? null,
    },
    movimientoId,
    createdAt: mv.fechaSolicitud ?? mv.createdAt ?? null,
    source: "cosaif",
  };
}

export function getTornoQueueCreatedTime(item: RondaOut): number {
  const candidates = [item.createdAt, item.movimiento?.fechaSolicitud, item.movimiento?.createdAt];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const timestamp = Date.parse(String(candidate));
    if (Number.isFinite(timestamp)) return timestamp;
  }

  const numericId = Math.abs(Number(item.id));
  return Number.isFinite(numericId) ? numericId : Number.MAX_SAFE_INTEGER;
}

function getTornoQueueStatusRank(item: RondaOut): number {
  const status = String(item.movimiento?.estado ?? "")
    .trim()
    .toUpperCase();
  if (status === "EN_PROCESO") return 0;
  if (status === "DETENIDO") return 2;
  return 1;
}

function getTornoQueueNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : Number.MAX_SAFE_INTEGER;
}

export function sortTornoQueue(rows: RondaOut[]) {
  return [...rows].sort((a, b) => {
    const statusDiff = getTornoQueueStatusRank(a) - getTornoQueueStatusRank(b);
    if (statusDiff !== 0) return statusDiff;

    const rondaDiff = getTornoQueueNumber(a.rondaNumero) - getTornoQueueNumber(b.rondaNumero);
    if (rondaDiff !== 0) return rondaDiff;

    const ordenDiff = getTornoQueueNumber(a.orden) - getTornoQueueNumber(b.orden);
    if (ordenDiff !== 0) return ordenDiff;

    const timeDiff = getTornoQueueCreatedTime(a) - getTornoQueueCreatedTime(b);
    if (timeDiff !== 0) return timeDiff;

    return a.id - b.id;
  });
}

export function hasVisibleLocomotive(value: unknown) {
  const text = String(value ?? "").trim();
  return Boolean(text && text !== "-" && text !== "â€”" && text.toUpperCase() !== "NULL");
}

export function sortRondaQueue(rows: RondaOut[]) {
  return [...rows]
    .sort((a, b) => {
      const rondaDiff = a.rondaNumero - b.rondaNumero;
      if (rondaDiff) return rondaDiff;
      const ordenDiff = a.orden - b.orden;
      if (ordenDiff) return ordenDiff;
      const aTime = Date.parse(String(a.createdAt ?? a.movimiento?.fechaSolicitud ?? "")) || 0;
      const bTime = Date.parse(String(b.createdAt ?? b.movimiento?.fechaSolicitud ?? "")) || 0;
      return aTime - bTime || a.id - b.id;
    })
    .map((item, index) => ({ ...item, orden: index + 1 }));
}

export function projectClientCurrentRounds(
  rows: RondaOut[],
  sharedCurrent: boolean,
  ownEmpresaId: number | null,
) {
  if (!sharedCurrent) return rows;
  return rows.map((row) =>
    Number(row.empresa?.id) === ownEmpresaId || !row.movimiento
      ? row
      : { ...row, movimiento: { ...row.movimiento, instrucciones: null } },
  );
}
