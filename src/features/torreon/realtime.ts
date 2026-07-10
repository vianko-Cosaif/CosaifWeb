import type {
  RealtimeConnectionStatus,
  RealtimeMovementEvent,
} from "@/app/hooks/useRealtimeMovimientos";
import type { Arrastre } from "@/features/torreon/arrastres/types";

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
  if (status === "connected") return "Tiempo real";
  if (status === "connecting") return "Conectando";
  return "Sin conexion";
}

export function realtimeArrastreSnapshot(event: RealtimeMovementEvent): Arrastre | null {
  const snapshot = event.snapshot;
  const id = Number(snapshot?.id ?? event.arrastreId);
  if (!snapshot || !Number.isFinite(id) || id <= 0) return null;
  if (!Array.isArray(snapshot.vagones) && !Array.isArray(snapshot.incidentes)) return null;
  return { ...snapshot, id } as Arrastre;
}
