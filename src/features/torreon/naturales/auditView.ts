import type { QueueAudit, QueueUnit } from "./queueView";

const actionTitles: Record<string, string> = {
  MIGRAR_MODELO: "Registro incorporado al modelo operativo",
  CREAR: "Solicitud registrada",
  SOLICITAR: "Solicitud registrada",
  CREAR_SOLICITUD: "Solicitud registrada",
  EDITAR_SOLICITUD: "Solicitud actualizada",
  CANCELAR_SOLICITUD: "Solicitud cancelada",
  ASIGNAR: "Maquinista asignado",
  PRIORIZAR: "Prioridad actualizada",
  FORMAR_CONJUNTO: "Conjunto formado",
  INICIAR: "Movimiento iniciado",
  REANUDAR: "Movimiento reanudado",
  FINALIZAR: "Movimiento finalizado",
  REGISTRAR_EVIDENCIA: "Evidencia registrada",
  REPORTAR_INCIDENTE: "Incidente reportado",
  RESOLVER_INCIDENTE: "Incidente resuelto",
  CONFIRMAR_SOLUCION: "Solución del incidente confirmada",
  HABILITAR_REANUDACION: "Reanudación habilitada",
};

export function uniqueAuditEvents(entries: QueueAudit[]) {
  const seen = new Set<number>();
  return entries.filter((event) => {
    if (seen.has(event.id)) return false;
    seen.add(event.id);
    return true;
  });
}

export function auditEventView(
  event: QueueAudit,
  unit: QueueUnit | undefined,
  names: ReadonlyMap<number, string>,
) {
  const system = event.usuarioId === 0 || event.rol?.toUpperCase() === "SISTEMA";
  const actor = system
    ? "Sistema"
    : (names.get(event.usuarioId) ?? `Usuario #${event.usuarioId}`) +
      (event.rol ? ` · ${event.rol.toLowerCase().replaceAll("_", " ")}` : "");
  const fallback = event.accion.replaceAll("_", " ").toLowerCase();
  const title = actionTitles[event.accion] ?? fallback.charAt(0).toUpperCase() + fallback.slice(1);
  const movement = unit?.movimientos.find((member) => member.id === event.movimientoId);
  let target: string | undefined;
  if (movement) {
    target = `Locomotora ${movement.locomotiveNumber} · Movimiento #${movement.id}`;
  } else if (unit && event.unidadId === unit.id) {
    target = `${unit.modalidad === "CONJUNTO" ? "Conjunto" : "Solicitud"} #${unit.id}`;
    if (event.accion === "FORMAR_CONJUNTO" && Array.isArray(event.datos?.movimientoIds)) {
      // Use only members already visible in the company-scoped queue.
      const ids = event.datos.movimientoIds;
      const members = unit.movimientos.filter((member) => ids.includes(member.id));
      if (members.length) {
        target += ` · ${members.length === 1 ? "Locomotora" : "Locomotoras"} ${members.map((member) => member.locomotiveNumber).join(", ")}`;
      }
    }
  }
  const detail =
    event.accion === "MIGRAR_MODELO"
      ? "Solicitud anterior incorporada a la operación actual."
      : event.accion === "PRIORIZAR"
        ? `Prioridad manual aplicada ${event.datos?.modalidad === "CONJUNTO" ? "al conjunto" : "a la solicitud"}.`
        : undefined;
  return { title, actor, target, detail };
}
