type MovementState = { estado?: unknown; unidadId?: unknown };
type UnitState = { estado?: unknown; movimientos?: unknown };

/** A previous start does not prevent cancellation while the operation is stopped. */
export function canCancelNaturalState(movement: MovementState, unit?: UnitState | null) {
  if (!["SOLICITADO", "ASIGNADO", "DETENIDO"].includes(String(movement.estado))) return false;
  // Legacy requests can have no unit yet; the service creates it transactionally.
  if (!unit) return movement.unidadId == null;
  if (!["PENDIENTE", "DETENIDA", "LISTA_REANUDAR"].includes(String(unit.estado))) return false;
  return !(
    Array.isArray(unit.movimientos) &&
    unit.movimientos.some(
      (member) => member && typeof member === "object" && member.estado === "EN_PROCESO",
    )
  );
}
