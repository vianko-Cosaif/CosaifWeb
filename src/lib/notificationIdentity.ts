import { logicalNotificationId } from "./logicalNotificationId";
/** Identidad del evento, independiente del transporte o del momento de recepción. */
export function notificationIdentity(event: Record<string, unknown>) {
  const logicalId = logicalNotificationId(event);
  return logicalId ? { key: logicalId, ttlMs: 86_400_000 } : transportEventIdentity(event);
}

// Data refreshes keep their revision identity even after the notice was consumed.
function transportEventIdentity(event: Record<string, unknown>) {
  const eventId = String(event.eventId ?? "").trim();
  const version = event.version ?? event.occurredAt;
  const key =
    (event.version == null ? eventId : "") ||
    JSON.stringify([
      event.type ?? event.eventType,
      event.source,
      event.entity,
      event.entityId,
      event.empresaId,
      event.localidadId,
      event.movimientoId,
      event.arrastreId,
      event.vagonId,
      event.incidenteId,
      event.accion,
      event.estado,
      event.estadoAnterior,
      version,
    ]);
  // Sin ID ni revisión sólo se agrupan entregas inmediatas: una transición
  // legítima posterior con el mismo estado debe poder notificarse de nuevo.
  return { key, ttlMs: eventId || version != null ? 86_400_000 : 5_000 };
}

export function createRealtimeEventDeduplicator() {
  const seen = new Map<string, number>();
  return (event: Record<string, unknown>, now = Date.now()) => {
    if (String(event.type ?? "").startsWith("realtime.")) return false;
    const { key, ttlMs } = transportEventIdentity(event);
    if ((seen.get(key) ?? 0) > now) return true;
    for (const [id, expiry] of seen) if (expiry <= now) seen.delete(id);
    seen.delete(key);
    seen.set(key, now + ttlMs);
    if (seen.size > 2_000) seen.delete(seen.keys().next().value!);
    return false;
  };
}
