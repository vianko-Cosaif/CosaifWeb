import { useCallback, useEffect, useState } from "react";
import { Movimiento } from "../Movimiento";
import { API_BASE, FLUSH_INTERVAL_MS, OUTBOX_KEY } from "../movimientos.shared";
import { useVisibleInterval } from "@/app/hooks/useVisibleInterval";

/**
 * MODULO: useCrearMovimientoOutbox
 *
 * Responsabilidad:
 * - Gestionar cola offline de POST /movimientos.
 * - Reintentar envios periodicamente cuando hay conectividad.
 * - Exponer indicadores de estado (online, pendientes, banner).
 *
 * Este archivo NO:
 * - Construye payload de negocio.
 * - Aplica reglas de validacion.
 * - Navega entre steps.
 */

type OutboxItem = {
  id: string;
  payload: unknown;
  endpoint?: string;
  createdAt: number;
};

/**
 * Hook de outbox para resiliencia de red.
 *
 * Salidas:
 * - pushOutbox(): encola solicitud.
 * - flushOutbox(): intenta sincronizar cola.
 * - clearOutbox(): vacia cola.
 * - hydratePendingCount(): sincroniza contador inicial.
 */
export function useCrearMovimientoOutbox() {
  const [online, setOnline] = useState<boolean>(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  /** Inicializa badge de pendientes. */
  const hydratePendingCount = useCallback(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(OUTBOX_KEY) || "[]") as unknown;
      setPendingCount(Array.isArray(raw) ? raw.length : 0);
    } catch {
      setPendingCount(0);
    }
  }, []);

  /** Encola payload para sincronizar cuando vuelva la red. */
  const pushOutbox = useCallback((payload: unknown, endpoint = `${API_BASE}/movimientos`) => {
    let q: OutboxItem[] = [];
    try {
      const raw = JSON.parse(localStorage.getItem(OUTBOX_KEY) || "[]") as unknown;
      q = Array.isArray(raw) ? (raw as OutboxItem[]) : [];
    } catch { }

    const item = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      payload,
      endpoint,
      createdAt: Date.now(),
    };

    const next = [...(Array.isArray(q) ? q : []), item];
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(next));
    setPendingCount(next.length);

    setBanner("Sin conexion: la solicitud quedo en cola y se enviara automaticamente.");
    setTimeout(() => setBanner(null), 3500);
  }, []);

  /** Reintenta cola. Conserva en cola los elementos que sigan fallando. */
  const flushOutbox = useCallback(async () => {
    if (!online) return;

    let q: OutboxItem[] = [];
    try {
      const raw = JSON.parse(localStorage.getItem(OUTBOX_KEY) || "[]") as unknown;
      q = Array.isArray(raw) ? (raw as OutboxItem[]) : [];
    } catch { }
    if (q.length === 0) return;

    const keep: OutboxItem[] = [];
    for (const item of q) {
      try {
        const endpoint = typeof item.endpoint === "string" && item.endpoint.trim()
          ? item.endpoint
          : `${API_BASE}/movimientos`;
        const res = await Movimiento.fetchWithTimeout(endpoint, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            ...Movimiento.tokenHeader(),
          },
          body: JSON.stringify(item.payload),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } catch {
        keep.push(item);
      }
    }

    localStorage.setItem(OUTBOX_KEY, JSON.stringify(keep));
    setPendingCount(keep.length);

    if (keep.length === 0) {
      setBanner("Todos los envios pendientes fueron sincronizados.");
      setTimeout(() => setBanner(null), 2500);
    }
  }, [online]);

  useVisibleInterval(flushOutbox, online ? FLUSH_INTERVAL_MS : null);

  const clearOutbox = useCallback(() => {
    localStorage.removeItem(OUTBOX_KEY);
    setPendingCount(0);
  }, []);

  return {
    online,
    pendingCount,
    banner,
    flushOutbox,
    pushOutbox,
    clearOutbox,
    hydratePendingCount,
  };
}
