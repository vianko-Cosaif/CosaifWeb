"use client";

import { useCallback, useEffect, useRef, useState, type SetStateAction } from "react";
import { cachedFetchJson } from "@/lib/http/client";

export async function readTorreonJson<T>(url: string, signal: AbortSignal, force = false): Promise<T> {
  const payload = await cachedFetchJson<T>(url, {
    credentials: "include", cache: "no-store", signal,
  }, { ttlMs: 5_000, force });
  if (payload && typeof payload === "object" && "success" in payload && payload.success === false) {
    const failure = payload as { error?: string; message?: string };
    throw new Error(failure.message || failure.error || "No se pudo consultar la operación de Torreón.");
  }
  return payload;
}

const EMPTY_ROWS: never[] = [];

type CollectionState<T> = {
  key: string;
  rows: T[];
  loaded: boolean;
  loading: boolean;
  error: string | null;
};

/** A list belongs to one query. Old responses may never paint a new scope. */
export function useTorreonCollection<T>({
  queryKey,
  enabled = true,
  fetchRows,
}: {
  queryKey: string;
  enabled?: boolean;
  fetchRows: (signal: AbortSignal, force: boolean) => Promise<T[]>;
}) {
  const [state, setState] = useState<CollectionState<T>>({ key: queryKey, rows: [], loaded: false, loading: enabled, error: null });
  const context = useRef<{ key: string; active: boolean }>({ key: queryKey, active: false });
  const pending = useRef<{ controller: AbortController; promise: Promise<void>; forceNext: boolean } | null>(null);
  const itemRequests = useRef(new Map<number, AbortController>());
  const rowsRevision = useRef(0);
  const [itemLoading, setItemLoading] = useState(false);

  const setRows = useCallback((update: SetStateAction<T[]>) => {
    if (!context.current.active || context.current.key !== queryKey) return;
    rowsRevision.current += 1;
    setState((current) => {
      if (current.key !== queryKey) return current;
      return { ...current, rows: typeof update === "function" ? update(current.rows) : update };
    });
  }, [queryKey]);

  const load = useCallback((force = false): Promise<void> => {
    if (!enabled || !context.current.active || context.current.key !== queryKey) return Promise.resolve();
    const existing = pending.current;
    if (existing && !existing.controller.signal.aborted) {
      // Changes that happened during a read need one subsequent read, not one per event.
      if (force) existing.forceNext = true;
      return existing.promise;
    }
    const controller = new AbortController();
    const task = { controller, promise: Promise.resolve(), forceNext: false };
    pending.current = task;
    for (const request of itemRequests.current.values()) request.abort();
    itemRequests.current.clear();
    setItemLoading(false);
    const current = () => !controller.signal.aborted && context.current.active && context.current.key === queryKey && pending.current === task;
    setState((previous) => ({
      key: queryKey, rows: previous.key === queryKey ? previous.rows : [],
      loaded: previous.key === queryKey && previous.loaded, loading: true, error: null,
    }));
    task.promise = (async () => {
      let forceRead = force;
      try {
        do {
          task.forceNext = false;
          const revision = rowsRevision.current;
          const rows = await fetchRows(controller.signal, forceRead);
          if (!current()) return;
          if (revision === rowsRevision.current) {
            setState({ key: queryKey, rows, loaded: true, loading: true, error: null });
          } else {
            // A realtime snapshot or optimistic action is newer than this response.
            task.forceNext = true;
          }
          forceRead = true;
        } while (task.forceNext && current());
      } catch (error) {
        if (current()) setState((previous) => ({ ...previous, error: error instanceof Error ? error.message : "No se pudo actualizar la operación." }));
      } finally {
        if (current()) {
          pending.current = null;
          setState((previous) => ({ ...previous, loading: false }));
        }
        controller.abort();
      }
    })();
    return task.promise;
  }, [enabled, fetchRows, queryKey]);

  const refreshItem = useCallback(async (
    id: number,
    fetchItem: (signal: AbortSignal) => Promise<T | null>,
    merge: (current: T[], item: T) => T[],
  ) => {
    const scope = context.current;
    if (!enabled || !scope.active || scope.key !== queryKey) return;
    // An item read follows an outstanding collection read so it cannot be overwritten by it.
    if (pending.current) await pending.current.promise;
    if (context.current !== scope || !scope.active) return;
    itemRequests.current.get(id)?.abort();
    const controller = new AbortController();
    itemRequests.current.set(id, controller);
    setItemLoading(true);
    try {
      const item = await fetchItem(controller.signal);
      if (controller.signal.aborted || context.current !== scope || !scope.active) return;
      if (item) setRows((rows) => merge(rows, item));
      else await load(true);
    } catch {
      if (!controller.signal.aborted && context.current === scope && scope.active) await load(true);
    } finally {
      if (itemRequests.current.get(id) === controller) itemRequests.current.delete(id);
      if (context.current === scope && scope.active) setItemLoading(itemRequests.current.size > 0);
    }
  }, [enabled, load, queryKey, setRows]);

  useEffect(() => {
    const scope = { key: queryKey, active: true };
    context.current = scope;
    const requests = itemRequests.current;
    void load();
    return () => {
      scope.active = false;
      pending.current?.controller.abort();
      pending.current = null;
      for (const request of requests.values()) request.abort();
      requests.clear();
    };
  }, [load, queryKey]);

  const visible = state.key === queryKey && enabled;
  return {
    rows: visible ? state.rows : EMPTY_ROWS,
    setRows,
    loading: enabled && (!visible || !state.loaded) && (state.loading || state.key !== queryKey),
    refreshing: visible && ((state.loaded && state.loading) || itemLoading),
    error: visible ? state.error : null,
    load,
    refreshItem,
  };
}
