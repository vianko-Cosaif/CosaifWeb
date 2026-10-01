import "server-only";
import { recordMatchesMovementScope } from "@/lib/auth/movementScope";
import { asNumber, extractArray, firstPositiveNumber, asPriority, asDateString } from "./mapping";
import type {
  TorreonMovimientoRecord,
  TorreonIncidenteRecord,
  TorreonRondaMovimientoRecord,
  RondaOut,
  TorreonRondaRecord,
} from "./models";
import { RondasReadError } from "./errors";

function formatTorreonRef(snapshot: unknown, fallbackPrefix: string, id: unknown) {
  const snapshotText = typeof snapshot === "string" && snapshot.trim() ? snapshot.trim() : null;
  if (snapshotText) return snapshotText;
  const numericId = asNumber(id);
  return numericId ? `${fallbackPrefix} ${numericId}` : null;
}

function formatTorreonVia(
  viaSnapshot: unknown,
  viaId: unknown,
  seccionSnapshot: unknown,
  seccionId: unknown,
) {
  const via = formatTorreonRef(viaSnapshot, "Via", viaId);
  const seccion = formatTorreonRef(seccionSnapshot, "Seccion", seccionId);
  if (via && seccion) return `${via} / ${seccion}`;
  return via || seccion || null;
}

function buildTorreonInstructions(
  movimiento: TorreonMovimientoRecord,
  incidente?: TorreonIncidenteRecord | null,
) {
  const base = typeof movimiento.instrucciones === "string" ? movimiento.instrucciones.trim() : "";
  const incidenteAbierto = String(incidente?.estado ?? "").toUpperCase() === "ABIERTO";
  if (!incidenteAbierto) return base || null;

  const incidenteId = asNumber(incidente?.id);
  const motivo =
    typeof incidente?.motivo === "string" && incidente.motivo.trim()
      ? incidente.motivo.trim()
      : "sin detalle";
  const bloqueo = `Incidente abierto${incidenteId ? ` #${incidenteId}` : ""}: ${motivo}`;
  return [base, bloqueo].filter(Boolean).join("\n");
}

function isTorreonDetailDone(
  detail: TorreonRondaMovimientoRecord,
  movimiento: TorreonMovimientoRecord,
) {
  const detailState = String(detail.estado ?? "").toUpperCase();
  const movementState = String(movimiento.estado ?? "").toUpperCase();
  return (
    ["CONCLUIDO", "CANCELADO"].includes(detailState) ||
    ["CONCLUIDO", "CANCELADO"].includes(movementState)
  );
}

export function mapTorreonRondasToOut(
  input: unknown,
  concluido: boolean,
  empresaScopeId: number | null,
  localidadScopeId: number,
): RondaOut[] {
  const rondas = extractArray(input) as TorreonRondaRecord[];
  const out: RondaOut[] = [];

  for (const ronda of rondas) {
    const numeroRonda = asNumber(ronda.numeroRonda) ?? 0;
    if (!Array.isArray(ronda.movimientos)) throw new RondasReadError(502);
    const movimientos = extractArray(ronda.movimientos) as TorreonRondaMovimientoRecord[];

    movimientos.forEach((detail, index) => {
      const movimiento = detail.movimiento ?? {};
      const detailId = asNumber(detail.id);
      const movimientoId = asNumber(detail.movimientoId ?? movimiento.id);
      if (!detailId || !movimientoId) return;

      const empresaId = asNumber(detail.empresaId ?? movimiento.empresaId);
      const localidadId = firstPositiveNumber(ronda.localidadId, movimiento.localidadId);
      if (
        !recordMatchesMovementScope(
          { empresaId, localidadId },
          { empresaId: empresaScopeId, localidadId: localidadScopeId },
        )
      )
        return;

      const itemDone = isTorreonDetailDone(detail, movimiento);
      if (itemDone !== concluido) return;

      const incidente = detail.bloqueadoPorIncidente ?? null;
      const bloqueado =
        String(detail.estado ?? "").toUpperCase() === "BLOQUEADO" ||
        String(incidente?.estado ?? "").toUpperCase() === "ABIERTO";
      const estado = bloqueado
        ? "BLOQUEADO"
        : String(detail.estado ?? movimiento.estado ?? "SOLICITADO").toUpperCase();
      const locomotiveNumber = movimiento.locomotiveNumber ?? null;
      const empresaNombre =
        typeof movimiento.empresaNombreSnapshot === "string" &&
        movimiento.empresaNombreSnapshot.trim()
          ? movimiento.empresaNombreSnapshot.trim()
          : empresaId
            ? `Empresa ${empresaId}`
            : "—";

      out.push({
        id: detailId,
        localidadId,
        rondaNumero: numeroRonda,
        orden: asNumber(detail.orden) ?? index + 1,
        concluido: itemDone,
        empresa: empresaId ? { id: empresaId, nombre: empresaNombre } : null,
        movimiento: {
          id: movimientoId,
          idTecnico: movimientoId,
          folioLocalidad: movimientoId,
          folioLocalidadLabel: `#${movimientoId}`,
          viaOrigen: {
            nombre: formatTorreonVia(
              movimiento.viaOrigenNombreSnapshot,
              movimiento.viaOrigenId,
              movimiento.seccionOrigenNombreSnapshot,
              movimiento.seccionOrigenId,
            ),
          },
          viaDestino: {
            nombre: formatTorreonVia(
              movimiento.viaDestinoNombreSnapshot,
              movimiento.viaDestinoId,
              movimiento.seccionDestinoNombreSnapshot,
              movimiento.seccionDestinoId,
            ),
          },
          lavado: false,
          torno: false,
          estado,
          prioridad: asPriority(detail.prioridad ?? movimiento.prioridad),
          locomotiveNumber,
          locomotora: locomotiveNumber == null ? null : String(locomotiveNumber),
          fechaSolicitud: asDateString(
            movimiento.fechaSolicitud ?? movimiento.createdAt ?? detail.fechaAsignado,
          ),
          fechaInicio: asDateString(detail.fechaInicio ?? movimiento.fechaInicio),
          fechaFin: asDateString(detail.fechaFin ?? movimiento.fechaFin),
          instrucciones: buildTorreonInstructions(movimiento, incidente),
        },
        movimientoId,
        createdAt: asDateString(
          detail.fechaAsignado ??
            movimiento.fechaSolicitud ??
            ronda.fechaApertura ??
            ronda.createdAt,
        ),
        source: "torreon",
      });
    });
  }

  return out.sort((a, b) => a.rondaNumero - b.rondaNumero || a.orden - b.orden || a.id - b.id);
}
