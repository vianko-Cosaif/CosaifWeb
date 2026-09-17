import "server-only";
import { fetchUpstream } from "@/lib/server/upstream";
import { mapConcurrent } from "@/lib/http/concurrency";
import { recordMatchesMovementScope } from "@/lib/auth/movementScope";
import type { RondaOut, TornoServiceRecord, MovimientoDetailRecord } from "./models";
import {
  extractArray,
  readDetailRecord,
  asRecord,
  firstPositiveNumber,
  isTornoConcluido,
  hasVisibleLocomotive,
  getTornoQueueCreatedTime,
  sortTornoQueue,
} from "./mapping";
import { readRondasJson, fetchRondasJsonFirst } from "./transport";

export async function readTornoRounds({
  base,
  headers,
  signal,
  concluido,
  localidadId,
  empresaId,
  ownEmpresaId,
  sharedCurrentLocality,
}: {
  base: string;
  headers: HeadersInit;
  signal: AbortSignal;
  concluido: boolean;
  localidadId: number;
  empresaId: number | null;
  ownEmpresaId: number | null;
  sharedCurrentLocality: boolean;
}): Promise<RondaOut[]> {
  const statusParam = concluido ? "CONCLUIDO,CANCELADO" : "SOLICITADO,EN_PROCESO,DETENIDO";
  const qs = new URLSearchParams({ status: statusParam, localidadId: String(localidadId) });
  const empresaScopeId = empresaId;
  if (empresaScopeId) qs.set("empresaId", String(empresaScopeId));
  const r = await fetchUpstream(
    `${base}/torno/rondas-servicio/historial?${qs.toString()}`,
    {
      cache: "no-store",
      headers,
    },
    signal,
  );

  const records = extractArray(await readRondasJson(r)) as TornoServiceRecord[];
  const details = new Map<number, Promise<MovimientoDetailRecord | null>>();
  const getMovementDetail = (id: number) => {
    let pending = details.get(id);
    if (!pending) {
      pending = fetchRondasJsonFirst(
        [`${base}/movimientos/${id}/edicion`, `${base}/movimientos/${id}`],
        headers,
        signal,
      ).then((raw) => readDetailRecord(raw) as MovimientoDetailRecord);
      details.set(id, pending);
    }
    return pending;
  };
  const out = await mapConcurrent(records, 4, async (record, index): Promise<RondaOut | null> => {
    const movimientoRecord = asRecord(record.movimiento ?? record.movimientoResumen);
    const recordRonda = asRecord(record.ronda);
    const movimientoRonda = asRecord(movimientoRecord.ronda);
    const servicioRecord = asRecord(record.servicio);
    const rondaServicioRecord = asRecord(record.rondaServicio);
    const status = String(record.historialStatus ?? record.status ?? "SOLICITADO").toUpperCase();
    const movimientoId = firstPositiveNumber(
      record.movimientoId,
      movimientoRecord.id,
      servicioRecord.movimientoId,
      rondaServicioRecord.movimientoId,
    );
    const servicioId = firstPositiveNumber(
      record.servicioId,
      record.rondaServicioId,
      record.id,
      servicioRecord.id,
      rondaServicioRecord.id,
      rondaServicioRecord.servicioId,
      index + 1,
    );
    if (!servicioId) return null;

    let rondaNumero =
      firstPositiveNumber(
        record.movimientoRondaNumero,
        record.rondaNumero,
        recordRonda.rondaNumero,
        movimientoRonda.rondaNumero,
      ) ?? 1;
    let orden =
      firstPositiveNumber(
        record.movimientoOrden,
        record.orden,
        recordRonda.orden,
        movimientoRonda.orden,
      ) ?? index + 1;

    const recordEmpresa = asRecord(movimientoRecord.empresa);
    const recordEmpresaId = firstPositiveNumber(movimientoRecord.empresaId, recordEmpresa.id);
    let empresa: RondaOut["empresa"] = recordEmpresaId
      ? { id: recordEmpresaId, nombre: String(recordEmpresa.nombre ?? "—") }
      : null;
    let localidadMovimientoId = firstPositiveNumber(
      record.localidadId,
      movimientoRecord.localidadId,
      asRecord(movimientoRecord.localidad).id,
    );
    let movimiento: RondaOut["movimiento"] = {
      id: movimientoId ?? undefined,
      torno: true,
      estado: status,
      locomotiveNumber:
        record.numeroLocomotora ?? record.locomotiveNumber ?? record.locomotora ?? null,
      locomotora: record.locomotora == null ? null : String(record.locomotora),
      fechaSolicitud:
        record.creadoEn ??
        (typeof movimientoRecord.fechaSolicitud === "string"
          ? movimientoRecord.fechaSolicitud
          : null),
      fechaInicio: record.inicio ?? null,
      fechaFin: record.fin ?? null,
    };

    if (movimientoId && (!sharedCurrentLocality || recordEmpresaId === ownEmpresaId)) {
      const detail = await getMovementDetail(movimientoId);
      if (detail) {
        const mv = detail?.movimiento ?? detail;
        const mvRonda = asRecord(asRecord(mv).ronda);
        rondaNumero = firstPositiveNumber(mvRonda.rondaNumero, rondaNumero) ?? rondaNumero;
        orden = firstPositiveNumber(mvRonda.orden, orden) ?? orden;
        localidadMovimientoId =
          firstPositiveNumber(mv?.localidad?.id, mv?.localidadId) ?? localidadMovimientoId;
        empresa = mv?.empresa
          ? { id: Number(mv.empresa.id ?? 0), nombre: String(mv.empresa.nombre ?? "—") }
          : null;
        const visibleId = firstPositiveNumber(mv?.folioLocalidad, mv?.id) ?? movimientoId;
        movimiento = {
          id: visibleId,
          idTecnico: firstPositiveNumber(mv?.idTecnico, movimientoId) ?? movimientoId,
          folioLocalidad: mv?.folioLocalidad ?? visibleId,
          folioLocalidadLabel: mv?.folioLocalidadLabel ?? `#${visibleId}`,
          viaOrigen: mv?.viaOrigen ?? null,
          viaDestino: mv?.viaDestino ?? null,
          lavado: Boolean(mv?.lavado ?? mv?.Lavado),
          torno: true,
          estado: status,
          prioridad: mv?.prioridad ?? null,
          locomotiveNumber: mv?.locomotiveNumber ?? mv?.locomotora ?? null,
          locomotora: mv?.locomotora ?? null,
          fechaSolicitud: mv?.fechaSolicitud ?? record.creadoEn ?? null,
          fechaInicio: record.inicio ?? mv?.fechaInicio ?? null,
          fechaFin: record.fin ?? mv?.fechaFin ?? null,
          instrucciones: mv?.instrucciones ?? null,
        };
      }
    }

    if (
      !recordMatchesMovementScope(
        { localidadId: localidadMovimientoId, empresaId: empresa?.id },
        { localidadId, empresaId: empresaScopeId },
      )
    )
      return null;
    if (isTornoConcluido(status) !== concluido) return null;
    if (
      !concluido &&
      !hasVisibleLocomotive(
        movimiento?.locomotiveNumber ??
          movimiento?.locomotora ??
          record.numeroLocomotora ??
          record.locomotiveNumber ??
          record.locomotora,
      )
    ) {
      return null;
    }
    return {
      id: -Math.abs(servicioId),
      localidadId: localidadMovimientoId,
      rondaNumero,
      orden,
      concluido: isTornoConcluido(status),
      empresa,
      movimiento,
      movimientoId,
      createdAt:
        record.movimientoFechaSolicitud ??
        movimiento?.fechaSolicitud ??
        record.creadoEn ??
        record.inicio ??
        null,
      source: "torno",
    };
  });

  const filtered = out.filter((item): item is RondaOut => Boolean(item));

  if (concluido) {
    // Concluidos: más recientes primero (updatedAt desc o createdAt desc)
    filtered.sort((a, b) => getTornoQueueCreatedTime(b) - getTornoQueueCreatedTime(a));
  } else {
    // Activos/pendientes: FIFO (oldest first), igual a CosaifLogistcs
    filtered.splice(0, filtered.length, ...sortTornoQueue(filtered));
  }

  return filtered;
}
