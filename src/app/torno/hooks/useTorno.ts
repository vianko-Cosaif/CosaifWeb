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

type UserSession = {
  id?: number;
  nombre?: string;
  rol?: string;
  empresaId?: number | null;
  localidadId?: number | null;
};

export type TornoSession = {
  mounted: boolean;
  user: UserSession | null;
  role: TornoRole;
  permissions: TornoPermissions;
  empresaId: number | null;
  localidadId: number | null;
};

function parseNumber(value?: string | number | null): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function readLocalUser(): UserSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function useTornoSession(): TornoSession {
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<UserSession | null>(null);

  useEffect(() => {
    const localUser = readLocalUser();
    setUser(localUser);
    setMounted(true);
  }, []);

  const role = useMemo(() => {
    const cookieRole = getClientCookie("role");
    return normalizeTornoRole(cookieRole ?? user?.rol);
  }, [user?.rol]);

  const empresaId = useMemo(
    () => parseNumber(getClientCookie("empresaId")) ?? parseNumber(user?.empresaId ?? null),
    [user?.empresaId],
  );
  const localidadId = useMemo(
    () => parseNumber(getClientCookie("locId")) ?? parseNumber(user?.localidadId ?? null),
    [user?.localidadId],
  );

  return {
    mounted,
    user,
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

export function useTornoHistory(defaultFilters: TornoFilters = {}) {
  const reqSeq = useRef(0);
  const defaultEmpresaId = defaultFilters.empresaId;
  const defaultLocalidadId = defaultFilters.localidadId;
  const [tab, setTab] = useState<TornoHistoryTab>("activos");
  const [filters, setFilters] = useState<TornoFilters>({
    page: 1,
    pageSize: 25,
    ...defaultFilters,
  });
  const [result, setResult] = useState<TornoListResult<TornoHistoryItem>>(emptyList);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<TornoHistoryItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      empresaId: defaultEmpresaId,
      localidadId: defaultLocalidadId,
      page: 1,
    }));
  }, [defaultEmpresaId, defaultLocalidadId]);

  const load = useCallback(
    async (showRefresh = false) => {
      const seq = ++reqSeq.current;
      if (showRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const next = await listTornoHistory(tab, filters);
        if (seq !== reqSeq.current) return;
        setResult(next);
      } catch (err: any) {
        if (seq !== reqSeq.current) return;
        setResult(emptyList);
        setError(err?.message ?? "No se pudo cargar historial Torno");
      } finally {
        if (seq === reqSeq.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [filters, tab],
  );

  useEffect(() => {
    load(false);
  }, [load]);

  const setPage = useCallback((page: number) => {
    setFilters((prev) => ({ ...prev, page }));
  }, []);

  const setSearch = useCallback((search: string) => {
    setFilters((prev) => ({ ...prev, search, page: 1 }));
  }, []);

  const switchTab = useCallback((next: TornoHistoryTab) => {
    setTab(next);
    setFilters((prev) => ({ ...prev, page: 1 }));
    setDetail(null);
  }, []);

  const openDetail = useCallback(async (item: TornoHistoryItem) => {
    setDetail(item);
    setDetailLoading(true);
    try {
      const next = await getTornoHistoryDetail(item.id);
      setDetail(next);
    } catch {
      setDetail(item);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  return {
    tab,
    switchTab,
    filters,
    setFilters,
    setPage,
    setSearch,
    items: result.items,
    meta: result.meta,
    loading,
    refreshing,
    error,
    reload: () => load(true),
    detail,
    detailLoading,
    openDetail,
    closeDetail: () => setDetail(null),
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
