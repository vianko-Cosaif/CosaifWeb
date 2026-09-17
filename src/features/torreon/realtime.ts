import type {
  RealtimeConnectionStatus,
  RealtimeMovementEvent,
} from "@/features/movimientos/useRealtimeMovimientos";

export function isTorreonNaturalEvent(event: RealtimeMovementEvent) {
  const type = String(event.type ?? "");
  if (type === "realtime.ready" || type === "realtime.resume") return true;
  if (type.startsWith("torreon.movimiento.")) return true;
  return type.startsWith("torreon.incidente.") && Number(event.movimientoId) > 0;
}

export function isTorreonArrastreEvent(event: RealtimeMovementEvent) {
  const type = String(event.type ?? "");
  if (type === "realtime.ready" || type === "realtime.resume") return true;
  if (type.startsWith("torreon.arrastre.")) return true;
  return type.startsWith("torreon.incidente.") && Number(event.arrastreId) > 0;
}

export function realtimeStatusLabel(status: RealtimeConnectionStatus) {
  if (status === "connected") return "Conectado";
  if (status === "connecting") return "Conectando";
  return "Sin conexión";
}
