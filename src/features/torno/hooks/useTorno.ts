/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getClientCookie } from "@/lib/cookies";
import {
  addIncidentChild,
  configureNavajas,
  createNavajaChange,
  createParentIncident,
  getNavajaStats,
  getTornoHistoryDetail,
  listLocalidadesLite,
  listNavajaChanges,
  listTornoHistory,
  listTornoIncidents,
  reopenParentIncident,
  resolveChildIncident,
  resolveParentIncident,
  updateParentIncident,
} from "../lib/tornoService";
import { getTornoPermissions, normalizeTornoRole } from "../lib/permissions";
import type {
  TornoFilters,
  TornoHistoryItem,
  TornoHistoryTab,
  TornoIncidentChild,
  TornoIncidentParent,
  TornoIncidentPayload,
  TornoListResult,
  TornoLocalidadLite,
  TornoNavajaChange,
  TornoNavajaStats,
  TornoPermissions,
  TornoReopenPayload,
  TornoResolvePayload,
  TornoRole,
} from "../lib/types";

export type TornoSessionUser = {
  id?: number;
  nombre?: string;
  rol?: string;
  empresaId?: number | null;
  localidadId?: number | null;
};

export type TornoSession = {
  mounted: boolean;
  user: TornoSessionUser | null;
  role: TornoRole;
  permissions: TornoPermissions;
  empresaId: number | null;
  localidadId: number | null;
};

function parseNumber(value?: string | number | null): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function readLocalUser(): TornoSessionUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function useTornoSession(initialSession?: TornoSessionUser): TornoSession {
  const [mounted, setMounted] = useState(Boolean(initialSession));
  const [user, setUser] = useState<TornoSessionUser | null>(initialSession ?? null);

  useEffect(() => {
    if (initialSession) return;
    const localUser = readLocalUser();
    setUser(localUser);
    setMounted(true);
  }, [initialSession]);

  const role = useMemo(() => {
    if (initialSession) return normalizeTornoRole(initialSession.rol);
    const cookieRole = getClientCookie("role");
    return normalizeTornoRole(cookieRole ?? user?.rol);
  }, [initialSession, user?.rol]);

  const empresaId = useMemo(
    () => initialSession ? parseNumber(initialSession.empresaId) : parseNumber(getClientCookie("empresaId")) ?? parseNumber(user?.empresaId ?? null),
    [initialSession, user?.empresaId],
  );
  const localidadId = useMemo(
    () => initialSession ? parseNumber(initialSession.localidadId) : parseNumber(getClientCookie("locId")) ?? parseNumber(user?.localidadId ?? null),
    [initialSession, user?.localidadId],
  );

  return {
    mounted: Boolean(initialSession) || mounted,
    user: initialSession ?? user,
    role,
    permissions: getTornoPermissions(role),
    empresaId,
    localidadId,
  };
}

function emptyList<T>(): TornoListResult<T> {
  return {
    items: [],
    meta: { page: 1, pageSize: 25, total: 0, totalPages: 1, hasNextPage: false, hasPrevPage: false },
  };
}

export function useTornoHistory(defaultFilters: TornoFilters = {}, enabled = true) {
  const reqSeq = useRef(0);
  const listAbort = useRef<AbortController | null>(null);
  const detailAbort = useRef<AbortController | null>(null);
  const [tab, setTab] = useState<TornoHistoryTab>("activos");
  const [filters, setFilters] = useState<TornoFilters>({ page: 1, pageSize: 25, ...defaultFilters });
  const [debouncedSearch, setDebouncedSearch] = useState(filters.search ?? "");
  const search = filters.search ?? "";
  useEffect(() => {
    if (search === debouncedSearch) return;
    const timer = window.setTimeout(() => setDebouncedSearch(search), 250);
    return () => window.clearTimeout(timer);
  }, [debouncedSearch, search]);

  const queryKey = JSON.stringify({ tab, filters: {
    ...filters, empresaId: defaultFilters.empresaId, localidadId: defaultFilters.localidadId,
    search: debouncedSearch,
    page: filters.empresaId === defaultFilters.empresaId && filters.localidadId === defaultFilters.localidadId ? filters.page : 1,
  } });
  const query = useMemo(() => JSON.parse(queryKey) as { tab: TornoHistoryTab; filters: TornoFilters }, [queryKey]);
  const [snapshot, setSnapshot] = useState<{ key: string; result: TornoListResult<TornoHistoryItem> }>({ key: "", result: emptyList() });
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<TornoHistoryItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const ready = enabled && search === debouncedSearch;

  const load = useCallback(async (showRefresh = false) => {
    if (!ready) return;
    const seq = ++reqSeq.current;
    listAbort.current?.abort();
    const controller = new AbortController();
    listAbort.current = controller;
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const next = await listTornoHistory(query.tab, query.filters, { signal: controller.signal, cache: showRefresh ? "reload" : "force-cache" });
      if (controller.signal.aborted || seq !== reqSeq.current) return;
      setSnapshot({ key: queryKey, result: next });
    } catch (error) {
      if (controller.signal.aborted || seq !== reqSeq.current) return;
      setError(error instanceof Error ? error.message : "No se pudo cargar historial Torno");
    } finally {
      if (!controller.signal.aborted && seq === reqSeq.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [query, queryKey, ready]);

  useEffect(() => {
    void load();
    return () => { reqSeq.current += 1; listAbort.current?.abort(); };
  }, [load]);

  const closeDetail = useCallback(() => {
    detailAbort.current?.abort();
    detailAbort.current = null;
    setDetail(null);
    setDetailLoading(false);
  }, []);
  useEffect(() => {
    closeDetail();
    return () => { detailAbort.current?.abort(); };
  }, [closeDetail, defaultFilters.empresaId, defaultFilters.localidadId]);

  const setPage = useCallback((page: number) => {
    setFilters((previous) => ({ ...previous, empresaId: defaultFilters.empresaId, localidadId: defaultFilters.localidadId, page }));
  }, [defaultFilters.empresaId, defaultFilters.localidadId]);
  const setSearch = useCallback((search: string) => {
    setFilters((previous) => ({ ...previous, search, page: 1 }));
  }, []);
  const switchTab = useCallback((next: TornoHistoryTab) => {
    setTab(next);
    setFilters((previous) => ({ ...previous, page: 1 }));
    closeDetail();
  }, [closeDetail]);

  const openDetail = useCallback(async (item: TornoHistoryItem) => {
    detailAbort.current?.abort();
    const controller = new AbortController();
    detailAbort.current = controller;
    setDetail(item);
    setDetailLoading(true);
    try {
      const next = await getTornoHistoryDetail(item.id, { signal: controller.signal, cache: "reload" });
      if (!controller.signal.aborted && detailAbort.current === controller) setDetail(next);
    } catch {
      // The selected summary remains available while a detail request can be retried.
    } finally {
      if (!controller.signal.aborted && detailAbort.current === controller) setDetailLoading(false);
    }
  }, []);

  const visible = snapshot.key === queryKey;
  const result = visible ? snapshot.result : emptyList<TornoHistoryItem>();
  return {
    tab, switchTab, filters: { ...filters, empresaId: defaultFilters.empresaId, localidadId: defaultFilters.localidadId }, setFilters, setPage, setSearch,
    items: result.items, meta: result.meta,
    loading: enabled && (loading || search !== debouncedSearch || (!visible && !error)),
    refreshing: enabled && refreshing, error: enabled ? error : null,
    reload: () => load(true), detail, detailLoading, openDetail, closeDetail,
  };
}

export function useTornoIncidents(options: {
  enabled: boolean;
  filters?: TornoFilters;
}) {
  const { enabled, filters = {} } = options;
  const reqSeq = useRef(0);
  const defaultFiltersKey = JSON.stringify(filters);
  const [listFilters, setListFilters] = useState<TornoFilters>({
    page: 1,
    pageSize: 25,
    ...filters,
  });
  const [result, setResult] = useState<TornoListResult<TornoIncidentParent>>(emptyList);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setListFilters((prev) => ({
      ...prev,
      ...filters,
      page: 1,
    }));
  }, [defaultFiltersKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(
    async (showRefresh = false) => {
      if (!enabled) return;
      const seq = ++reqSeq.current;
      if (showRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const next = await listTornoIncidents(listFilters);
        if (seq !== reqSeq.current) return;
        setResult(next);
      } catch (err: any) {
        if (seq !== reqSeq.current) return;
        setResult(emptyList);
        setError(err?.message ?? "No se pudieron cargar incidentes Torno");
      } finally {
        if (seq === reqSeq.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [enabled, listFilters],
  );

  useEffect(() => {
    load(false);
  }, [load]);

  const createParent = useCallback(
    async (payload: TornoIncidentPayload) => {
      await createParentIncident(payload);
      await load(true);
    },
    [load],
  );

  const addChild = useCallback(
    async (parentId: string | number, payload: TornoIncidentPayload) => {
      await addIncidentChild(parentId, payload);
      await load(true);
    },
    [load],
  );

  const editParent = useCallback(
    async (
      incident: TornoIncidentParent,
      patch: Partial<TornoIncidentPayload> & { status?: string },
    ) => {
      await updateParentIncident(incident, patch);
      await load(true);
    },
    [load],
  );

  const resolveParent = useCallback(
    async (incident: TornoIncidentParent, payload?: TornoResolvePayload) => {
      await resolveParentIncident(incident, payload);
      await load(true);
    },
    [load],
  );

  const reopenParent = useCallback(
    async (incident: TornoIncidentParent, payload?: TornoReopenPayload) => {
      await reopenParentIncident(incident, payload);
      await load(true);
    },
    [load],
  );

  const resolveChild = useCallback(
    async (child: TornoIncidentChild, payload?: TornoResolvePayload) => {
      await resolveChildIncident(child, payload);
      await load(true);
    },
    [load],
  );

  return {
    items: result.items,
    meta: result.meta,
    loading,
    refreshing,
    error,
    reload: () => load(true),
    setPage: (page: number) => setListFilters((prev) => ({ ...prev, page })),
    createParent,
    addChild,
    editParent,
    resolveParent,
    reopenParent,
    resolveChild,
  };
}

export function useNavajaChanges(enabled: boolean, filters: TornoFilters = {}) {
  const reqSeq = useRef(0);
  const defaultFiltersKey = JSON.stringify(filters);
  const [listFilters, setListFilters] = useState<TornoFilters>({
    page: 1,
    pageSize: 25,
    ...filters,
  });
  const [result, setResult] = useState<TornoListResult<TornoNavajaChange>>(emptyList);
  const [stats, setStats] = useState<TornoNavajaStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localidades, setLocalidades] = useState<TornoLocalidadLite[]>([]);

  useEffect(() => {
    setListFilters((prev) => ({
      ...prev,
      ...filters,
      page: 1,
    }));
  }, [defaultFiltersKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(
    async (showRefresh = false) => {
      if (!enabled) return;
      const seq = ++reqSeq.current;
      if (showRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const [next, nextStats] = await Promise.all([
          listNavajaChanges(listFilters),
          getNavajaStats({ localidadId: listFilters.localidadId }),
        ]);
        if (seq !== reqSeq.current) return;
        setResult(next);
        setStats(nextStats);
      } catch (err: any) {
        if (seq !== reqSeq.current) return;
        setResult(emptyList);
        setStats(null);
        setError(err?.message ?? "No se pudo cargar Cambio de Navajas");
      } finally {
        if (seq === reqSeq.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [enabled, listFilters],
  );

  useEffect(() => {
    load(false);
  }, [load]);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    (async () => {
      try {
        const next = await listLocalidadesLite();
        if (alive) setLocalidades(next);
      } catch {
        if (alive) setLocalidades([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [enabled]);

  const createChange = useCallback(
    async (payload: {
      localidadId?: string | number;
      numeroNavaja?: string | number;
      creadoPorId?: string | number;
      fechaCambio?: string;
      comments?: string;
      images?: File[];
    }) => {
      await createNavajaChange(payload);
      await load(true);
    },
    [load],
  );

  const configure = useCallback(
    async (payload: { localidadId?: string | number; cantidad?: string | number }) => {
      await configureNavajas(payload);
      await load(true);
    },
    [load],
  );

  return {
    items: result.items,
    meta: result.meta,
    stats,
    localidades,
    loading,
    refreshing,
    error,
    reload: () => load(true),
    setPage: (page: number) => setListFilters((prev) => ({ ...prev, page })),
    createChange,
    configure,
  };
}
