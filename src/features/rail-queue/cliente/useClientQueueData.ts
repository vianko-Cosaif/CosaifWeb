"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchJson, isAbortError } from "../utils";
import type { Ronda } from "../types";
import { clientQueueUrl, selectClientQueue, type ClientQueueSelection } from "./queueData";

type QueueSnapshot = {
  key: string;
  items: Ronda[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  updatedAt: number | null;
};

export function useClientQueueData({
  onChanged,
  ...selection
}: ClientQueueSelection & { onChanged?: (items: Ronda[], previous: Ronda[]) => void }) {
  const url = clientQueueUrl(selection);
  const key = `${selection.empresaId ?? "none"}:${url}`;
  const [snapshot, setSnapshot] = useState<QueueSnapshot>(() => ({ key, items: [], loading: true, refreshing: false, error: null, updatedAt: null }));
  const sequence = useRef(0);
  const active = useRef<{ key: string; controller: AbortController; promise: Promise<void> } | null>(null);
  const pendingRefresh = useRef(false);
  const previous = useRef<{ key: string; items: Ronda[] } | null>(null);
  const onChangedRef = useRef(onChanged);
  useEffect(() => { onChangedRef.current = onChanged; }, [onChanged]);

  const { localidadId, empresaId, entity } = selection;
  const load = useCallback(async (force = true): Promise<void> => {
    if (active.current?.key === key) {
      if (force) pendingRefresh.current = true;
      return active.current.promise;
    }
    active.current?.controller.abort();
    const requestId = ++sequence.current;
    const controller = new AbortController();
    setSnapshot((current) => current.key === key
      ? { ...current, loading: current.updatedAt === null, refreshing: current.updatedAt !== null, error: null }
      : { key, items: [], loading: true, refreshing: false, error: null, updatedAt: null });

    const promise = (async () => {
      try {
        const response = await fetchJson<Ronda[]>(url, controller.signal, { force, ttlMs: 20_000 });
        if (controller.signal.aborted || requestId !== sequence.current) return;
        if (!Array.isArray(response)) throw new Error("No se pudo leer la respuesta de rondas.");
        const items = selectClientQueue(response, { localidadId, empresaId, entity });
        if (previous.current?.key === key) onChangedRef.current?.(items, previous.current.items);
        previous.current = { key, items };
        setSnapshot({ key, items, loading: false, refreshing: false, error: null, updatedAt: Date.now() });
      } catch (error) {
        if (controller.signal.aborted || requestId !== sequence.current || isAbortError(error)) return;
        setSnapshot((current) => ({ ...current, loading: false, refreshing: false, error: error instanceof Error ? error.message : "No se pudo actualizar el listado. Intenta de nuevo." }));
      } finally {
        if (requestId === sequence.current) {
          active.current = null;
          if (pendingRefresh.current && !controller.signal.aborted) {
            pendingRefresh.current = false;
            void load(true);
          }
        }
      }
    })();
    active.current = { key, controller, promise };
    return promise;
  }, [key, url, localidadId, empresaId, entity]);

  const cancel = useCallback(() => {
    ++sequence.current;
    active.current?.controller.abort();
    active.current = null;
    pendingRefresh.current = false;
  }, []);

  useEffect(() => {
    void load(false);
    return cancel;
  }, [load, cancel]);

  return {
    ...(snapshot.key === key ? snapshot : { key, items: [], loading: true, refreshing: false, error: null, updatedAt: null }),
    load,
  };
}
