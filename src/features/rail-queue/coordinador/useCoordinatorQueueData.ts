"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchJson, isAbortError } from "../utils";
import type { Ronda } from "../types";

type Snapshot = {
  localidadId: number;
  items: Ronda[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  updatedAt: number | null;
};

const emptySnapshot = (localidadId: number): Snapshot => ({
  localidadId, items: [], loading: true, refreshing: false, error: null, updatedAt: null,
});

export function useCoordinatorQueueData({
  localidadId,
  onChanged,
  autoRefresh = true,
}: {
  localidadId: number;
  onChanged?: (items: Ronda[], previous: Ronda[]) => void;
  autoRefresh?: boolean;
}) {
  const [snapshot, setSnapshot] = useState(() => emptySnapshot(localidadId));
  const sequence = useRef(0);
  const active = useRef<{ localidadId: number; controller: AbortController; promise: Promise<void> } | null>(null);
  const pendingRefresh = useRef(false);
  const previous = useRef<{ localidadId: number; items: Ronda[] } | null>(null);
  const onChangedRef = useRef(onChanged);
  const autoRefreshRef = useRef(autoRefresh);
  useEffect(() => { onChangedRef.current = onChanged; }, [onChanged]);
  useEffect(() => { autoRefreshRef.current = autoRefresh; }, [autoRefresh]);

  const load = useCallback(async (force = false): Promise<void> => {
    if (document.visibilityState === "hidden") {
      pendingRefresh.current ||= force;
      return;
    }
    if (active.current?.localidadId === localidadId) {
      pendingRefresh.current ||= force;
      return active.current.promise;
    }
    active.current?.controller.abort();
    const requestId = ++sequence.current;
    const controller = new AbortController();
    pendingRefresh.current = false;
    setSnapshot((current) => current.localidadId === localidadId
      ? { ...current, loading: current.updatedAt === null, refreshing: current.updatedAt !== null, error: null }
      : emptySnapshot(localidadId));

    const promise = (async () => {
      try {
        const response = await fetchJson<Ronda[]>(`/api/cliente/rondas?localidadId=${localidadId}`, controller.signal, { force, ttlMs: 20_000 });
        if (controller.signal.aborted || requestId !== sequence.current) return;
        if (!Array.isArray(response)) throw new Error("No se pudo leer la respuesta de rondas.");
        const items = response.filter((item) => {
          const itemLocalidadId = item.localidadId ?? item.localidad?.id;
          return (!itemLocalidadId || itemLocalidadId === localidadId) && !item.concluido;
        }).sort((a, b) => a.rondaNumero - b.rondaNumero || a.orden - b.orden || a.id - b.id);
        if (previous.current?.localidadId === localidadId) onChangedRef.current?.(items, previous.current.items);
        previous.current = { localidadId, items };
        setSnapshot({ localidadId, items, loading: false, refreshing: false, error: null, updatedAt: Date.now() });
      } catch (error) {
        if (controller.signal.aborted || requestId !== sequence.current || isAbortError(error)) return;
        setSnapshot((current) => ({ ...current, loading: false, refreshing: false, error: error instanceof Error ? error.message : "No se pudo actualizar el tablero. Intenta de nuevo." }));
      } finally {
        if (requestId === sequence.current) {
          active.current = null;
          if (pendingRefresh.current && !controller.signal.aborted && document.visibilityState !== "hidden") {
            pendingRefresh.current = false;
            void load(true);
          }
        }
      }
    })();
    active.current = { localidadId, controller, promise };
    return promise;
  }, [localidadId]);

  const cancel = useCallback(() => {
    ++sequence.current;
    active.current?.controller.abort();
    active.current = null;
    pendingRefresh.current = false;
  }, []);

  useEffect(() => {
    void load();
    const onVisible = () => {
      if (document.visibilityState !== "hidden" && (autoRefreshRef.current || previous.current?.localidadId !== localidadId)) {
        void load(pendingRefresh.current);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      cancel();
    };
  }, [load, localidadId, cancel]);

  return { ...(snapshot.localidadId === localidadId ? snapshot : emptySnapshot(localidadId)), load };
}
