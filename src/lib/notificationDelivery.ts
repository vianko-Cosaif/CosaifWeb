const fallbackClaims = new Map<string, number>();
let realtimeConnected = false;
export function setRealtimeNotificationConnection(connected: boolean) {
  realtimeConnected = connected;
}
export function hasRealtimeNotificationConnection() {
  return realtimeConnected;
}

function claimInMemory(eventId: string, ttlMs: number) {
  const now = Date.now();
  if ((fallbackClaims.get(eventId) ?? 0) > now) return false;
  fallbackClaims.set(eventId, now + ttlMs);
  if (fallbackClaims.size > 2_000) fallbackClaims.delete(fallbackClaims.keys().next().value!);
  return true;
}

// IndexedDB serializa la reserva entre pestañas y la conserva tras recargar.
// Sólo se guardan identificadores de eventos, nunca tokens ni contenido.
export async function claimNotification(eventId: string, ttlMs = 86_400_000): Promise<boolean> {
  if (typeof indexedDB === "undefined") return claimInMemory(eventId, ttlMs);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (accepted: boolean) => {
      if (!settled) {
        settled = true;
        resolve(accepted);
      }
    };
    const fallback = () => finish(claimInMemory(eventId, ttlMs));
    try {
      const open = indexedDB.open("cosaif-notification-delivery", 1);
      open.onupgradeneeded = () => open.result.createObjectStore("events");
      open.onerror = fallback;
      open.onblocked = fallback;
      open.onsuccess = () => {
        const db = open.result;
        if (settled) {
          db.close();
          return;
        }
        try {
          let accepted = false;
          const tx = db.transaction("events", "readwrite");
          const store = tx.objectStore("events");
          const previous = store.get(eventId);
          previous.onsuccess = () => {
            const now = Date.now();
            if (typeof previous.result === "number" && now - previous.result < ttlMs) return;
            accepted = true;
            store.put(now, eventId);
          };
          tx.oncomplete = () => {
            db.close();
            finish(accepted);
          };
          tx.onabort = () => {
            db.close();
            fallback();
          };
        } catch {
          db.close();
          fallback();
        }
      };
    } catch {
      fallback();
    }
  });
}

/** El push operativo es respaldo del canal visible, no un segundo aviso. */
export function shouldDeferPushToRealtime(data?: Record<string, string>) {
  if (!realtimeConnected) return false;
  const type = data?.eventType || data?.tipo || "";
  if (data?.eventType)
    return /^(?:torreon\.(?:arrastre|movimiento|incidente)\.|movimiento\.|incidente\.|torno\.)/.test(
      data.eventType,
    );
  return new Set([
    "nuevo_movimiento",
    "nuevo_incidente",
    "movimiento_iniciado",
    "movimiento_finalizado",
    "movimiento_concluido",
    "movimiento_cancelado",
    "movimiento_cancelado_incidentes",
    "movimiento_reanudado",
    "movimiento_detenido",
    "incidente_resuelto",
    "incidente_resuelto_cliente",
    "incidente_cerrado_manual",
    "incidente_cerrado",
    "incidente_actualizado",
    "incidente_continuado",
    "incidente_omitido",
  ]).has(type);
}
