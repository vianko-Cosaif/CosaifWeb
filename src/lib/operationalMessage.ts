export function operationalMessage(event: Record<string, unknown>) {
  const raw = String(event.tipo ?? event.type ?? "");
  const state = String(event.estado ?? "").toUpperCase();
  let kind = raw;
  const entity = raw.includes("arrastre")
    ? "arrastre"
    : raw === "torno.estado"
      ? "torno"
      : "movimiento";
  if (
    raw.endsWith("movimiento.estado") ||
    raw.endsWith("arrastre.estado") ||
    raw === "torno.estado"
  ) {
    const actions: Record<string, string> = {
      SOLICITADO: "solicitado",
      ASIGNADO: "asignado",
      EN_PROCESO: event.estadoAnterior === "DETENIDO" ? "reanudado" : "iniciado",
      DETENIDO: "detenido",
      CONCLUIDO: "concluido",
      CANCELADO: "cancelado",
    };
    if (actions[state]) kind = `${entity}_${actions[state]}`;
  }
  if (raw.endsWith("movimiento.creado") || raw === "torreon_movimiento_creado")
    kind = "nuevo_movimiento";
  if (raw.endsWith("arrastre.creado")) kind = "nuevo_arrastre";
  if (raw.endsWith("movimiento.incidente") || raw.endsWith("arrastre.incidente"))
    kind = "nuevo_incidente";
  if (raw.endsWith("incidente.estado"))
    kind =
      state === "RESUELTO"
        ? "incidente_resuelto"
        : state === "CERRADO"
          ? "incidente_cerrado"
          : "nuevo_incidente";

  const titles: Record<string, string> = {
    nuevo_movimiento: "Nueva solicitud de movimiento",
    movimiento_solicitado: "Movimiento solicitado",
    movimiento_asignado: "Movimiento asignado",
    movimiento_iniciado: "Movimiento iniciado",
    movimiento_reanudado: "Movimiento reanudado",
    movimiento_detenido: "Movimiento detenido",
    movimiento_concluido: "Movimiento finalizado",
    movimiento_cancelado: "Movimiento cancelado",
    nuevo_arrastre: "Nueva solicitud de arrastre",
    arrastre_solicitado: "Arrastre solicitado",
    arrastre_asignado: "Arrastre asignado",
    arrastre_iniciado: "Arrastre iniciado",
    arrastre_reanudado: "Arrastre reanudado",
    arrastre_detenido: "Arrastre detenido",
    arrastre_concluido: "Arrastre finalizado",
    arrastre_cancelado: "Arrastre cancelado",
    torno_iniciado: "Torneado iniciado",
    torno_concluido: "Torneado finalizado",
    nuevo_incidente: "Incidente reportado",
    incidente_resuelto: "Incidente resuelto",
    incidente_cerrado: "Incidente cerrado",
    movimiento_pendiente_recordatorio: "Movimiento pendiente de iniciar",
  };
  const title = String(
    event.notificationTitle || event.title || titles[kind] || "Actualización de operación",
  );
  const locomotive = event.locomotiveNumber ?? event.locomotora;
  const details = [
    locomotive ? `Locomotora ${locomotive}` : null,
    event.movimientoId
      ? `Movimiento #${event.movimientoId}`
      : event.arrastreId
        ? `Arrastre #${event.arrastreId}`
        : null,
    event.incidenteId ? `Incidente #${event.incidenteId}` : null,
    event.localidad ||
      event.localidadNombre ||
      (event.localidadId ? `Patio ${event.localidadId}` : null),
    event.descripcion,
  ];
  const body = String(event.notificationBody || event.body || details.filter(Boolean).join(" · "));
  return { title, body, kind };
}
