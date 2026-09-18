/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { torreonClientKind } from "@/lib/auth/torreonClientPolicy";

import React, { useCallback, useEffect, useMemo, useId, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { cachedFetchJson, invalidateCachedJson } from "@/lib/http/client";
import {
  detailCache,
  fetchIncidenteDetailsBulk,
  incidentCacheKey,
  incidentRows,
  incidentSourceQuery,
  isTorreonIncident,
  parseIncidentDetail,
  parseIncidentPage,
  type IncidentDetail,
} from "./incidentData";
import type { AuthorizationProfile } from "@/lib/accessControl";
const IncidentesTable = dynamic(() => import("./IncidentesTable"), {
  loading: () => (
    <div role="status" className="min-h-64 p-6 text-sm">
      Preparando la tabla de incidentes…
    </div>
  ),
});
const SmartIncidentBlocker = dynamic(() => import("./SmartIncidentBlocker"));
const TorreonIncidentDetailModal = dynamic(
  () => import("@/features/torreon/coordinador/TorreonIncidentDetailModal"),
);
import type { IncidenteRow, Meta, Role } from "./types";
import {
  AlertTriangle,
  BriefcaseBusiness,
  RefreshCw,
  Clock,
  X,
  CheckCircle,
  AlertCircle,
  Filter,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { fetchJSON } from "@/lib/api";
import { isTorreonLocalidadId } from "@/lib/torreonLocalidad";
import { isTrainingIncidentId } from "@/lib/routePolicy";
import { SearchInput, ModuleHeader, DataEmptyState } from "@/components/ui";
import { GuidedTarget } from "@/features/capacitacion";
import { TRAINING_INCIDENT_ID, useTrainingTour } from "@/features/capacitacion/TrainingTourContext";
import { IncidentCatalogSelect, IncidentStatCard } from "@/features/incidentes";
import {
  useRealtimeMovimientos,
  type RealtimeMovementEvent,
} from "@/features/movimientos/useRealtimeMovimientos";
import { playOperationConfirmation } from "@/lib/notificationSound";

/** Incidentes son locality-aware: Torreon usa ms_torreon y el resto Cosaif normal. */
const INCIDENTES = "/api/incidentes";
const EMPRESAS = "/bff/empresas";
const LOCALIDADES = "/bff/localidades";

const getCookie = (name: string) => {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
};

/** El BFF same-origin agrega la credencial únicamente en servidor. */
const withCreds = <T = any,>(url: string, init: RequestInit = {}) =>
  fetchJSON<T>(url, {
    credentials: "include",
    mode: "same-origin",
    headers: { ...(init.headers as any) },
    ...init,
  });

type DropdownOption = { id: number; nombre: string };
type Tab = "Actuales" | "Pasados";
type IncidentSource = "cosaif" | "torreon";
type TorreonIncidentKind = "TODOS" | "NATURAL" | "ARRASTRE";

type FilterState = {
  source: IncidentSource;
  torreonTipo: TorreonIncidentKind;
  empresaId: number | null;
  localidadId: number | null;
  searchQuery: string;
};

type NotificationState = {
  show: boolean;
  type: "success" | "error" | "info";
  message: string;
};

function prettyError(object: any): string {
  try {
    return typeof object === "string" ? object : JSON.stringify(object, null, 2);
  } catch {
    return String(object);
  }
}

function torreonMovementFolio(incident: any) {
  const movimiento = incident?.movimiento ?? incident?._detalle?.movimiento;
  if (movimiento?.folioLocalidadLabel) return movimiento.folioLocalidadLabel;
  if (movimiento?.folioLocalidad) return `#${movimiento.folioLocalidad}`;
  if (movimiento?.id) return `#${movimiento.id}`;
  return "#—";
}

function torreonIncidentTitle(incident: any) {
  const tipo = String(
    incident?._torreonTipo || incident?.tipoIncidente || incident?._detalle?._torreonTipo || "",
  ).toUpperCase();
  const arrastreId =
    incident?.arrastreId ??
    incident?.arrastre?.id ??
    incident?._detalle?.arrastreId ??
    incident?._detalle?.arrastre?.id;
  if (tipo.includes("ARRASTRE") || arrastreId)
    return `Arrastre #${arrastreId ?? "—"} · Incidente #${incident?.id ?? "—"}`;
  return `Movimiento Torreon ${torreonMovementFolio(incident)} · Incidente #${incident?.id ?? "—"}`;
}

function torreonIncidentSubtitle(incident: any) {
  const tipo = String(
    incident?._torreonTipo || incident?.tipoIncidente || incident?._detalle?._torreonTipo || "",
  ).toUpperCase();
  const empresa =
    incident?.movimiento?.empresa?.nombre ?? incident?._detalle?.movimiento?.empresa?.nombre;
  const destino =
    incident?.movimiento?.viaDestino?.nombre ?? incident?._detalle?.movimiento?.viaDestino?.nombre;
  const label = tipo.includes("ARRASTRE") ? "Incidente de arrastre" : "Incidente natural";
  return [label, empresa, destino].filter(Boolean).join(" · ");
}

// Hook usuario (lee cookies primero)
function useUserRole(authorization?: AuthorizationProfile): {
  role: Role;
  empresaId: number | null;
  localidadId: number | null;
} {
  const [userInfo, setUserInfo] = useState<{
    role: Role;
    empresaId: number | null;
    localidadId: number | null;
  }>({
    role: "CLIENTE",
    empresaId: null,
    localidadId: null,
  });

  useEffect(() => {
    try {
      const userString = typeof window !== "undefined" ? localStorage.getItem("user") : null;
      const user = userString ? JSON.parse(userString) : {};
      const roleCookie = String(getCookie("role") || user.rol || "CLIENTE").toUpperCase() as Role;
      const locFromCookie = Number(getCookie("locId") || "") || null;

      setUserInfo({
        role: roleCookie,
        empresaId: user.empresaId ?? null,
        localidadId: locFromCookie ?? user.localidadId ?? null,
      });
    } catch (error) {
      console.warn("Error parsing user data:", error);
    }
  }, []);

  return authorization
    ? {
        role: authorization.role as Role,
        empresaId: authorization.scope.empresaId,
        localidadId: authorization.scope.localidadId,
      }
    : userInfo;
}

// Hook para notificaciones
function useNotifications() {
  const [notification, setNotification] = useState<NotificationState>({
    show: false,
    type: "info",
    message: "",
  });

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const showNotification = useCallback((type: NotificationState["type"], message: string) => {
    setNotification({ show: true, type, message });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(
      () =>
        setNotification((prev) => ({
          ...prev,
          show: false,
        })),
      5000,
    );
  }, []);

  const hideNotification = useCallback(
    () =>
      setNotification((prev) => ({
        ...prev,
        show: false,
      })),
    [],
  );

  return { notification, showNotification, hideNotification };
}

export default function IncidenteController({
  authorization,
}: { authorization?: AuthorizationProfile } = {}) {
  const trainingTour = useTrainingTour();
  const searchParams = useSearchParams();
  const initialSource: IncidentSource =
    String(searchParams.get("source") || "").toLowerCase() === "torreon" ? "torreon" : "cosaif";
  const initialTipo = String(
    searchParams.get("tipo") || searchParams.get("tipoIncidente") || "",
  ).toUpperCase();
  const initialTorreonTipo: TorreonIncidentKind =
    initialTipo === "ARRASTRE" ? "ARRASTRE" : initialTipo === "NATURAL" ? "NATURAL" : "TODOS";
  const {
    role,
    empresaId: userEmpresaId,
    localidadId: userLocalidadId,
  } = useUserRole(authorization);
  const { notification, showNotification, hideNotification } = useNotifications();
  const clientIncidentKind = torreonClientKind(role);

  const isLimitedClientView = authorization
    ? ["COMPANY", "COMPANY_LOCALITY"].includes(authorization.scope.mode)
    : ["CLIENTE", "CLIENTE_ADMIN", "CLIENTE_COOR", "ARRASTRE_TORREON"].includes(role);
  const isLocalityScopedView = authorization
    ? ["LOCALITY", "COMPANY_LOCALITY"].includes(authorization.scope.mode)
    : ["CLIENTE", "CLIENTE_ADMIN", "CLIENTE_COOR", "COORDINADOR", "SUPERVISOR"].includes(role);

  const tabs: Tab[] = ["Actuales", "Pasados"];
  const [activeTab, setActiveTab] = useState<Tab>("Actuales");

  const [catalogues, setCatalogues] = useState<{
    empresas: DropdownOption[];
    localidades: DropdownOption[];
    loading: boolean;
  }>({
    empresas: [],
    localidades: [],
    loading: false,
  });

  const [filters, setFilters] = useState<FilterState>({
    source: initialSource,
    torreonTipo: initialTorreonTipo,
    empresaId: isLimitedClientView ? userEmpresaId : null,
    localidadId: isLocalityScopedView ? userLocalidadId : null,
    searchQuery: "",
  });
  const isTorreonScope = filters.source === "torreon" || isTorreonLocalidadId(filters.localidadId);

  const filtersPanelId = useId();
  const [filtersOpen, setFiltersOpen] = useState(false); // Collapsible on mobile

  const [snapshot, setIncidentData] = useState<{
    queryKey: string;
    data: IncidenteRow[];
    meta: Meta;
    loading: boolean;
    error: string | null;
    lastUpdated: Date | null;
  }>({
    queryKey: "",
    data: [],
    meta: { page: 1, totalPages: 1 },
    loading: false,
    error: null,
    lastUpdated: null,
  });

  const [uiState, setUiState] = useState<{
    refreshing: boolean;
    autoRefresh: boolean;
    selectedIncident: any | null;
    blockerVisible: boolean;
  }>({
    refreshing: false,
    autoRefresh: false,
    selectedIncident: null,
    blockerVisible: false,
  });

  const [modalKey, setModalKey] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const realtimeRefreshTimerRef = useRef<number | null>(null);
  const realtimeForceRef = useRef(false);
  const needsReloadRef = useRef<string | null>(null);
  const incidentActionLockRef = useRef(false);
  const requestRef = useRef<{ url: string; controller: AbortController } | null>(null);
  const detailAbortRef = useRef<AbortController | null>(null);

  /** Fuerza la localidad de la sesión para cliente, coordinador y supervisor. */
  useEffect(() => {
    if (!isLocalityScopedView && !isLimitedClientView) return;
    setFilters((prev) => ({
      ...prev,
      empresaId: isLimitedClientView ? (userEmpresaId ?? prev.empresaId) : prev.empresaId,
      localidadId: isLocalityScopedView ? userLocalidadId : prev.localidadId,
      source: isLocalityScopedView
        ? isTorreonLocalidadId(userLocalidadId)
          ? "torreon"
          : "cosaif"
        : prev.source,
      torreonTipo:
        isLocalityScopedView && !isTorreonLocalidadId(userLocalidadId) ? "TODOS" : prev.torreonTipo,
    }));
  }, [isLimitedClientView, isLocalityScopedView, userEmpresaId, userLocalidadId]);

  /** Carga catálogos de empresas y localidades */
  useEffect(() => {
    const controller = new AbortController();
    const read = (url: string) =>
      cachedFetchJson<any>(url, { signal: controller.signal }, { ttlMs: 300_000 });
    const load = async () => {
      setCatalogues((p) => ({ ...p, loading: true }));
      try {
        const [empresasResponse, localidadesResponse] = await Promise.all([
          isLimitedClientView
            ? userEmpresaId
              ? read(`${EMPRESAS}/${userEmpresaId}`)
              : null
            : read(EMPRESAS),
          isLocalityScopedView
            ? userLocalidadId
              ? read(`${LOCALIDADES}/${userLocalidadId}`)
              : null
            : read(LOCALIDADES),
        ]);

        const toOptions = (response: any, fallbackPrefix: string): DropdownOption[] => {
          if (!response) return [];
          const data = response.data ?? response;
          const rows = Array.isArray(data) ? data : [data];
          return rows
            .filter((row: any) => Number(row?.id) > 0)
            .map((row: any) => ({
              id: Number(row.id),
              nombre: row.nombre ?? `${fallbackPrefix} #${row.id}`,
            }));
        };

        if (controller.signal.aborted) return;
        setCatalogues({
          empresas: toOptions(empresasResponse, "Empresa"),
          localidades: toOptions(localidadesResponse, "Localidad"),
          loading: false,
        });
      } catch {
        if (controller.signal.aborted) return;
        setCatalogues((p) => ({ ...p, loading: false }));
        showNotification("error", "Error al cargar catálogos");
      }
    };
    void load();
    return () => controller.abort();
  }, [isLimitedClientView, isLocalityScopedView, userEmpresaId, userLocalidadId, showNotification]);

  /** Construye URL del API de incidentes */
  const buildApiUrl = useCallback(
    (page = 1) => {
      const estadoParam = activeTab === "Actuales" ? "ABIERTO" : "PASADOS";

      const searchParams = new URLSearchParams({
        page: String(page),
        pageSize: "20",
        estado: estadoParam,
      });

      if (filters.empresaId) searchParams.set("empresaId", String(filters.empresaId));
      if (filters.localidadId) searchParams.set("localidadId", String(filters.localidadId));
      if (isTorreonScope) {
        searchParams.set("source", "torreon");
        if (clientIncidentKind || filters.torreonTipo !== "TODOS")
          searchParams.set("tipo", clientIncidentKind || filters.torreonTipo);
      }

      return `${INCIDENTES}?${searchParams.toString()}`;
    },
    [
      activeTab,
      filters.empresaId,
      filters.localidadId,
      filters.torreonTipo,
      isTorreonScope,
      clientIncidentKind,
    ],
  );

  const queryKey = buildApiUrl(1);
  const ready =
    (!isLocalityScopedView || Boolean(filters.localidadId)) &&
    (!isLimitedClientView || Boolean(filters.empresaId));
  const incidentData =
    snapshot.queryKey === queryKey
      ? snapshot
      : {
          ...snapshot,
          data: [],
          meta: { page: 1, totalPages: 1 },
          loading: ready,
          error: null,
          lastUpdated: null,
        };

  /** Fetch de incidentes + detalle, con logs de empresas */
  const fetchIncidents = useCallback(
    async (page = 1, showLoading = true, force = false): Promise<void> => {
      if (!ready) return;
      const url = buildApiUrl(page);
      if (requestRef.current?.url === url && !requestRef.current.controller.signal.aborted) {
        if (force) needsReloadRef.current = url;
        return;
      }
      requestRef.current?.controller.abort();
      const controller = new AbortController();
      const request = { url, controller };
      requestRef.current = request;
      const isCurrent = () => requestRef.current === request && !controller.signal.aborted;
      try {
        setIncidentData((prev) => ({
          ...prev,
          queryKey,
          meta: { ...prev.meta, page },
          data: prev.queryKey === queryKey && prev.meta.page === page ? prev.data : [],
          error: null,
          loading: showLoading,
        }));

        const response = parseIncidentPage(
          await cachedFetchJson<unknown>(
            url,
            { signal: controller.signal },
            { ttlMs: 5_000, force },
          ),
        );
        if (!isCurrent()) return;

        // Filtering must never mutate a response shared with another cache consumer.
        const incidents = response.data.filter((incident) =>
          activeTab === "Actuales"
            ? incident.estado === "ABIERTO"
            : ["CERRADO", "RESUELTO"].includes(incident.estado),
        );
        const commit = (detailsMap: Record<string, IncidentDetail>) => {
          if (!isCurrent()) return;
          const filteredIncidents = incidentRows(incidents, detailsMap);

          setIncidentData({
            queryKey,
            data: filteredIncidents,
            meta: {
              page: response.meta?.page ?? page,
              totalPages: response.meta?.totalPages ?? 1,
              total: response.meta?.total ?? filteredIncidents.length,
              pageSize: response.meta?.pageSize ?? 20,
            },
            loading: false,
            error: null,
            lastUpdated: new Date(),
          });
        };
        commit({});
        const details = await fetchIncidenteDetailsBulk(incidents, controller.signal);
        if (Object.keys(details).length) commit(details);
      } catch (error: any) {
        if (!isCurrent()) return;
        setIncidentData((prev) => ({
          ...prev,
          error: error?.message || "Error desconocido",
          loading: false,
        }));
        showNotification("error", "Error al cargar incidentes");
      } finally {
        if (isCurrent()) {
          requestRef.current = null;
          setUiState((prev) => ({ ...prev, refreshing: false }));
          if (needsReloadRef.current === url) {
            needsReloadRef.current = null;
            void fetchIncidents(page, false, true);
          }
        }
      }
    },
    [ready, queryKey, buildApiUrl, activeTab, showNotification],
  );

  const scheduleRealtimeIncidentRefresh = useCallback(
    (force = false) => {
      if (typeof window === "undefined" || document.visibilityState === "hidden") return;
      realtimeForceRef.current ||= force;
      if (realtimeRefreshTimerRef.current != null) return;

      const jitterMs = 450 + Math.floor(Math.random() * 1_250);
      realtimeRefreshTimerRef.current = window.setTimeout(() => {
        realtimeRefreshTimerRef.current = null;
        const pendingForce = realtimeForceRef.current;
        realtimeForceRef.current = false;
        if (document.visibilityState !== "hidden")
          void fetchIncidents(incidentData.meta.page || 1, false, pendingForce);
      }, jitterMs);
    },
    [fetchIncidents, incidentData.meta.page],
  );

  useRealtimeMovimientos({
    enabled: ready && uiState.autoRefresh,
    localidadId: filters.localidadId,
    onEvent: (event: RealtimeMovementEvent) => {
      const type = String(event.type || "");
      if (!type.includes("incidente") && type !== "realtime.ready" && type !== "realtime.resume")
        return;
      const eventLocalidadId = Number(event.localidadId || 0) || null;
      if (filters.localidadId && eventLocalidadId && filters.localidadId !== eventLocalidadId)
        return;
      scheduleRealtimeIncidentRefresh(type.includes("incidente"));
    },
  });

  useEffect(() => {
    return () => {
      if (realtimeRefreshTimerRef.current != null) {
        window.clearTimeout(realtimeRefreshTimerRef.current);
      }
    };
  }, []);

  /** Cancel the preceding query before a new scope can display data. */
  useEffect(() => {
    void fetchIncidents(1);
    return () => {
      requestRef.current?.controller.abort();
      requestRef.current = null;
      needsReloadRef.current = null;
      realtimeForceRef.current = false;
      detailAbortRef.current?.abort();
      if (realtimeRefreshTimerRef.current != null)
        window.clearTimeout(realtimeRefreshTimerRef.current);
      realtimeRefreshTimerRef.current = null;
    };
  }, [fetchIncidents]);

  /** Auto-refresh */
  useEffect(() => {
    const cancelScheduled = () => {
      if (realtimeRefreshTimerRef.current != null)
        window.clearTimeout(realtimeRefreshTimerRef.current);
      realtimeRefreshTimerRef.current = null;
      realtimeForceRef.current = false;
      needsReloadRef.current = null;
    };
    if (!uiState.autoRefresh) {
      cancelScheduled();
      return;
    }
    const refreshVisible = () => {
      if (document.visibilityState !== "hidden")
        void fetchIncidents(incidentData.meta.page || 1, false);
      else cancelScheduled();
    };
    const id = setInterval(refreshVisible, 30_000);
    document.addEventListener("visibilitychange", refreshVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", refreshVisible);
      cancelScheduled();
    };
  }, [uiState.autoRefresh, fetchIncidents, incidentData.meta.page]);

  /** Handlers */
  const handleRefresh = useCallback(() => {
    setUiState((prev) => ({ ...prev, refreshing: true }));
    void fetchIncidents(incidentData.meta.page, true, true);
  }, [fetchIncidents, incidentData.meta.page]);

  const handlePageChange = useCallback(
    (page: number) => {
      setUiState((prev) => ({ ...prev, refreshing: true }));
      fetchIncidents(page);
    },
    [fetchIncidents],
  );

  const handleTabChange = useCallback((tab: Tab) => setActiveTab(tab), []);

  const handleFilterChange = useCallback(
    (filterKey: keyof FilterState, value: any) => {
      setFilters((prev) => {
        if (isLocalityScopedView && (filterKey === "localidadId" || filterKey === "source")) {
          return prev;
        }
        if (isLimitedClientView && filterKey === "empresaId") return prev;
        if (prev[filterKey] === value) return prev;
        const next = { ...prev, [filterKey]: value };
        if (filterKey === "localidadId" && isTorreonLocalidadId(value)) {
          next.source = "torreon";
        }
        if (
          filterKey === "source" &&
          value === "cosaif" &&
          isTorreonLocalidadId(prev.localidadId)
        ) {
          next.localidadId = null;
          next.torreonTipo = "TODOS";
        }
        return next;
      });
    },
    [isLocalityScopedView, isLimitedClientView],
  );

  const handleClearFilters = useCallback(() => {
    setFilters((prev) => ({
      ...prev,
      searchQuery: "",
      empresaId: isLimitedClientView ? userEmpresaId : null,
      localidadId: isLocalityScopedView ? userLocalidadId : null,
      source: isLocalityScopedView && isTorreonLocalidadId(userLocalidadId) ? "torreon" : "cosaif",
      torreonTipo:
        isLocalityScopedView && isTorreonLocalidadId(userLocalidadId) ? prev.torreonTipo : "TODOS",
    }));
  }, [isLimitedClientView, isLocalityScopedView, userEmpresaId, userLocalidadId]);

  const handleIncidentSelect = useCallback(
    (incident: any) => {
      const original = {
        ...incident._original,
        _openedDuringTraining: trainingTour.active,
      };
      setUiState((prev) => ({
        ...prev,
        selectedIncident: original,
        blockerVisible: true,
      }));
      setModalKey((k) => k + 1);

      if (!isTorreonIncident(original)) return;
      const key = incidentCacheKey(original);
      const cached = detailCache.get(key);
      if (cached) {
        setUiState((prev) =>
          prev.selectedIncident && incidentCacheKey(prev.selectedIncident) === key
            ? {
                ...prev,
                selectedIncident: { ...prev.selectedIncident, ...cached, _detalle: cached },
              }
            : prev,
        );
        return;
      }

      detailAbortRef.current?.abort();
      const controller = new AbortController();
      detailAbortRef.current = controller;
      cachedFetchJson<unknown>(
        `${INCIDENTES}/${encodeURIComponent(String(original.id))}${incidentSourceQuery(original)}`,
        { signal: controller.signal },
        { ttlMs: 30_000 },
      )
        .then((response) => {
          if (controller.signal.aborted) return;
          const detail = parseIncidentDetail(response);
          detailCache.set(key, detail);
          setUiState((prev) =>
            prev.selectedIncident && incidentCacheKey(prev.selectedIncident) === key
              ? {
                  ...prev,
                  selectedIncident: { ...prev.selectedIncident, ...detail, _detalle: detail },
                }
              : prev,
          );
        })
        .catch(() => undefined);
    },
    [trainingTour.active],
  );

  const handleIncidentAction = useCallback(
    async (action: "resolve" | "skip", comments?: string) => {
      if (!uiState.selectedIncident || incidentActionLockRef.current) return;
      const selectedIncident = uiState.selectedIncident;
      incidentActionLockRef.current = true;

      try {
        const incidentId = Number(selectedIncident.id ?? selectedIncident.incidenteId);
        const sandboxSelection =
          trainingTour.active || selectedIncident._openedDuringTraining === true;
        if (sandboxSelection || isTrainingIncidentId(incidentId)) {
          if (incidentId !== TRAINING_INCIDENT_ID) {
            showNotification(
              "error",
              "En capacitación sólo puedes actuar sobre SIM-INC-041. No se modificó ningún incidente real.",
            );
            return;
          }

          trainingTour.resolveIncident(action, comments);
          showNotification(
            "success",
            action === "resolve"
              ? "Incidente SIM resuelto sólo en capacitación"
              : "Incidente SIM omitido sólo en capacitación",
          );
          setUiState((previous) => ({
            ...previous,
            refreshing: false,
            blockerVisible: false,
            selectedIncident: null,
          }));
          setModalKey((key) => key + 1);
          return;
        }

        setUiState((prev) => ({ ...prev, refreshing: true }));

        if (action === "resolve") {
          await withCreds(
            `${INCIDENTES}/${selectedIncident.id}${incidentSourceQuery(selectedIncident)}`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                estado: "RESUELTO",
                comentario: comments,
              }),
            },
          );
          showNotification("success", "Incidente resuelto correctamente");
          void playOperationConfirmation("incidente_resuelto");
        } else {
          await withCreds(
            `${INCIDENTES}/${selectedIncident.id}/cerrar${incidentSourceQuery(selectedIncident)}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ comentario: comments }),
            },
          );
          showNotification(
            "success",
            isTorreonIncident(selectedIncident)
              ? "Incidente cerrado y movimiento cancelado"
              : "Incidente cerrado sin resolución",
          );
          void playOperationConfirmation("incidente_cerrado");
        }

        detailCache.clear();
        invalidateCachedJson(INCIDENTES);
        requestRef.current?.controller.abort();
        await fetchIncidents(incidentData.meta.page, true, true);
        setUiState((prev) => ({
          ...prev,
          refreshing: false,
          blockerVisible: false,
          selectedIncident: null,
        }));
        setModalKey((k) => k + 1);
      } catch (error) {
        setUiState((prev) => ({ ...prev, refreshing: false }));
        const message = error instanceof Error ? error.message : "Error al procesar incidente";
        showNotification("error", message);
        throw error;
      } finally {
        incidentActionLockRef.current = false;
      }
    },
    [
      uiState.selectedIncident,
      fetchIncidents,
      incidentData.meta.page,
      showNotification,
      trainingTour,
    ],
  );

  /** Filtro local por búsqueda */
  const filteredIncidents = useMemo(() => {
    const trainingIsInCurrentTab =
      trainingTour.active &&
      (activeTab === "Actuales"
        ? trainingTour.incidentStatus === "ABIERTO"
        : trainingTour.incidentStatus !== "ABIERTO");
    const trainingOriginal = {
      id: TRAINING_INCIDENT_ID,
      incidenteId: TRAINING_INCIDENT_ID,
      descripcion: "SIM-INC-041 · Obstáculo detectado durante una maniobra de capacitación.",
      estado:
        trainingTour.incidentStatus === "ABIERTO"
          ? "ABIERTO"
          : trainingTour.incidentStatus === "RESUELTO"
            ? "RESUELTO"
            : "CERRADO",
      fechaInicio: new Date(Date.now() - 120_000).toISOString(),
      localidadId: filters.localidadId || 1,
      _source: "cosaif",
      imagenes: [],
      operadorComentario:
        "Verifica el área, documenta la acción y elige resolver u omitir conscientemente.",
      movimiento: {
        id: 910_000_204,
        localidadId: filters.localidadId || 1,
        locomotiveNumber: "SIM-L204",
        empresa: { nombre: "Empresa de capacitación" },
      },
    };
    const trainingRow: IncidenteRow = {
      id: TRAINING_INCIDENT_ID,
      fecha: new Date().toLocaleDateString("es-MX"),
      fechaISO: trainingOriginal.fechaInicio,
      estatus:
        trainingOriginal.estado === "ABIERTO"
          ? "Requiere atención"
          : trainingOriginal.estado === "RESUELTO"
            ? "Resuelto"
            : "Cerrado",
      estadoRaw: trainingOriginal.estado,
      empresa: "Empresa de capacitación",
      empresaId: filters.empresaId || 91_001,
      localidad: "Localidad de capacitación",
      localidadId: filters.localidadId || 1,
      locomotora: "SIM-L204",
      origen: "Vía 2",
      destino: "Vía 4",
      descripcion: trainingOriginal.descripcion,
      usuario: "Operador SIM",
      fuente: "Capacitación",
      tipoIncidente: "Natural · SIM",
      _original: trainingOriginal,
    };
    const rows = trainingIsInCurrentTab
      ? [
          trainingRow,
          ...incidentData.data.filter((incident) => Number(incident.id) !== TRAINING_INCIDENT_ID),
        ]
      : incidentData.data;
    if (!filters.searchQuery.trim()) return rows;
    const searchTerm = filters.searchQuery.toLowerCase();
    return rows.filter((incident) =>
      [
        incident.id,
        incident.fecha,
        incident.empresa,
        incident.origen,
        incident.destino,
        incident.locomotora,
        incident.estatus,
        incident.descripcion,
        incident.fuente,
        incident.tipoIncidente,
      ]
        .map((v) => String(v ?? "").toLowerCase())
        .some((t) => t.includes(searchTerm)),
    );
  }, [
    activeTab,
    incidentData.data,
    filters.empresaId,
    filters.localidadId,
    filters.searchQuery,
    trainingTour.active,
    trainingTour.incidentStatus,
  ]);

  // Calculate Stats
  const totalActivos = incidentData.data.filter((i) => i.estadoRaw === "ABIERTO").length;
  const totalResueltos = incidentData.data.filter((i) => i.estadoRaw === "RESUELTO").length;
  // Unique enterprises present in the current view
  const totalEmpresas = new Set(incidentData.data.map((i) => i.empresa).filter(Boolean)).size;

  const renderNotification = () => {
    if (!notification.show) return null;
    const iconMap = {
      success: CheckCircle,
      error: AlertCircle,
      info: AlertCircle,
    };
    const colorMap = {
      success:
        "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200",
      error:
        "bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-200",
      info: "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-200",
    } as const;
    const Icon = iconMap[notification.type];

    return (
      <div
        className={`fixed inset-x-4 top-[max(1rem,env(safe-area-inset-top))] z-50 flex items-start gap-3 rounded-lg border p-4 shadow-lg sm:left-auto sm:max-w-md ${colorMap[notification.type]}`}
      >
        <Icon className="h-5 w-5" />
        <span className="min-w-0 flex-1 break-words text-sm font-medium">
          {notification.message}
        </span>
        <button
          onClick={hideNotification}
          aria-label="Cerrar aviso"
          className="ml-2 rounded p-1 hover:bg-black/10 dark:hover:bg-white/10"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  };

  const hasActiveFilters = Boolean(
    (!isLimitedClientView && filters.empresaId) ||
    (!isLocalityScopedView && (filters.localidadId || isTorreonScope)) ||
    filters.torreonTipo !== "TODOS",
  );

  return (
    <GuidedTarget
      id="incidents-center"
      className="flex min-w-0 w-full flex-col bg-[var(--app-bg)] text-[var(--app-text)]"
    >
      {renderNotification()}

      <div className="border-b border-[var(--app-border)] bg-[var(--app-surface)] p-4 sm:p-5">
        <ModuleHeader
          title="Incidentes"
          icon={AlertTriangle}
          subtitle="Consulta y seguimiento de incidentes de la operación."
          loading={incidentData.loading}
        />
        <p className="mt-3 text-sm text-[var(--app-text-muted)]">
          {isLimitedClientView
            ? "Información de tu empresa"
            : "Información de las empresas autorizadas"}
          {isLocalityScopedView
            ? " en tu localidad asignada."
            : ". Filtra por localidad para consultar una operación."}
        </p>
      </div>

      {/* Filters and period controls */}
      <div className="z-30 w-full border-b border-[var(--app-border)] bg-[var(--app-surface)] lg:sticky lg:top-0">
        <div className="w-full p-4 sm:p-5">
          <div className="flex min-w-0 flex-col gap-4">
            {/* Title / Brand area if needed, otherwise Tabs & Status */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Tabs */}
              <GuidedTarget
                id="incidents-scope-tabs"
                className="inline-flex rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-1"
              >
                {tabs.map((tab) => {
                  const isActive = activeTab === tab;
                  return (
                    <button
                      key={tab}
                      onClick={() => handleTabChange(tab)}
                      aria-pressed={isActive}
                      className={`relative flex min-h-11 items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
                        isActive
                          ? "bg-[var(--app-surface)] text-[var(--app-accent)] shadow-sm"
                          : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                      }`}
                    >
                      {tab}
                    </button>
                  );
                })}
              </GuidedTarget>

              <GuidedTarget
                id="incidents-source-tabs"
                className="inline-flex flex-wrap rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-1"
              >
                {[
                  { value: "cosaif", label: "Cosaif / GDL" },
                  { value: "torreon", label: "Torreón" },
                ].map((option) => {
                  const isActive = (isTorreonScope ? "torreon" : "cosaif") === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleFilterChange("source", option.value)}
                      aria-pressed={isActive}
                      disabled={isLocalityScopedView}
                      title={
                        isLocalityScopedView
                          ? "La fuente depende de tu localidad asignada"
                          : undefined
                      }
                      className={`min-h-11 rounded-md px-3 py-2 text-xs font-semibold transition-colors ${
                        isActive
                          ? "bg-[var(--app-accent-soft)] text-[var(--app-accent)]"
                          : "text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                      } ${isLocalityScopedView ? "cursor-not-allowed opacity-60" : ""}`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </GuidedTarget>

              {isTorreonScope && !clientIncidentKind && (
                <GuidedTarget
                  id="incidents-torreon-type-tabs"
                  className="inline-flex rounded-xl border border-emerald-200 bg-emerald-50/70 p-1 dark:border-emerald-800 dark:bg-emerald-950/30"
                >
                  {[
                    { value: "TODOS", label: "Todos" },
                    { value: "NATURAL", label: "Naturales" },
                    { value: "ARRASTRE", label: "Arrastre" },
                  ].map((option) => {
                    const isActive = filters.torreonTipo === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handleFilterChange("torreonTipo", option.value)}
                        aria-pressed={isActive}
                        className={`min-h-11 rounded-md px-3 py-2 text-xs font-semibold transition-colors ${
                          isActive
                            ? "bg-emerald-600 text-white shadow-sm"
                            : "text-emerald-700 hover:bg-white/70 dark:text-emerald-200 dark:hover:bg-emerald-900/50"
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </GuidedTarget>
              )}

              {/* Last update pill */}
              {incidentData.lastUpdated && (
                <span className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-3 py-1.5 text-xs text-[var(--app-text-muted)]">
                  <Clock className="h-3 w-3" />
                  Actualizado{" "}
                  {incidentData.lastUpdated.toLocaleTimeString("es-ES", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              )}

              {/* Auto Refresh Toggle */}
              <button
                onClick={() => setUiState((p) => ({ ...p, autoRefresh: !p.autoRefresh }))}
                className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  uiState.autoRefresh
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-300"
                    : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-400"
                }`}
                title={
                  uiState.autoRefresh
                    ? "Pausar actualización automática"
                    : "Activar actualización automática"
                }
                aria-pressed={uiState.autoRefresh}
              >
                <RefreshCw
                  className={`h-3 w-3 ${uiState.autoRefresh ? "animate-spin-slow" : ""}`}
                />
                {uiState.autoRefresh ? "Auto" : "Manual"}
              </button>
            </div>

            {/* Search & Actions */}
            <div className="flex w-full min-w-0 flex-wrap items-end gap-3">
              <GuidedTarget id="incidents-search" className="min-w-0 flex-1">
                <SearchInput
                  ref={searchRef}
                  value={filters.searchQuery}
                  onChange={(value) => handleFilterChange("searchQuery", value)}
                  onClear={() => handleFilterChange("searchQuery", "")}
                  placeholder="Buscar en esta página por ID, empresa o vía"
                  label="Buscar incidentes"
                  className="w-full"
                  inputClassName="min-h-11 font-medium"
                />
              </GuidedTarget>

              {/* Mobile Filter Toggle */}
              <button
                aria-label={filtersOpen ? "Ocultar filtros" : "Mostrar filtros"}
                aria-expanded={filtersOpen}
                aria-controls={filtersPanelId}
                onClick={() => setFiltersOpen(!filtersOpen)}
                className={`min-h-11 min-w-11 shrink-0 rounded-lg border p-2.5 transition-colors xl:hidden ${
                  filtersOpen || hasActiveFilters
                    ? "bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-900/20 dark:border-emerald-800"
                    : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-700"
                }`}
              >
                <Filter className="h-4 w-4" />
              </button>

              {/* Desktop Filter Bar (Visible only on LG) */}
              <div className="hidden flex-wrap items-end gap-3 xl:flex">
                {!isLimitedClientView && (
                  <label className="grid gap-1 text-xs text-[var(--app-text-muted)]">
                    Empresa
                    <IncidentCatalogSelect
                      value={filters.empresaId}
                      onChange={(v: number | null) => handleFilterChange("empresaId", v)}
                      options={catalogues.empresas}
                      placeholder="Todas las empresas"
                    />
                  </label>
                )}
                <label className="grid gap-1 text-xs text-[var(--app-text-muted)]">
                  Localidad
                  <IncidentCatalogSelect
                    value={filters.localidadId}
                    onChange={(v: number | null) => handleFilterChange("localidadId", v)}
                    options={catalogues.localidades}
                    placeholder={
                      isLocalityScopedView ? "Localidad asignada" : "Todas las localidades"
                    }
                    disabled={isLocalityScopedView}
                  />
                </label>
                <button
                  onClick={handleRefresh}
                  disabled={uiState.refreshing || incidentData.loading}
                  className="flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-[var(--app-accent)] text-[var(--app-accent-contrast)] transition-opacity hover:opacity-90 disabled:opacity-50"
                  title="Actualizar"
                  aria-label="Actualizar incidentes"
                >
                  <RefreshCw className={`h-4 w-4 ${uiState.refreshing ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>
          </div>

          {/* Mobile Collapsible Filters */}
          <div id={filtersPanelId} hidden={!filtersOpen} className="mt-4 xl:hidden">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {!isLimitedClientView && (
                <label className="grid gap-1 text-xs text-[var(--app-text-muted)]">
                  Empresa
                  <IncidentCatalogSelect
                    value={filters.empresaId}
                    onChange={(v: number | null) => handleFilterChange("empresaId", v)}
                    options={catalogues.empresas}
                    placeholder="Todas las empresas"
                    fullWidth
                  />
                </label>
              )}
              <label className="grid gap-1 text-xs text-[var(--app-text-muted)]">
                Localidad
                <IncidentCatalogSelect
                  value={filters.localidadId}
                  onChange={(v: number | null) => handleFilterChange("localidadId", v)}
                  options={catalogues.localidades}
                  placeholder={
                    isLocalityScopedView ? "Localidad asignada" : "Todas las localidades"
                  }
                  disabled={isLocalityScopedView}
                  fullWidth
                />
              </label>
              <button
                onClick={handleClearFilters}
                className="flex items-center justify-center gap-2 min-h-11 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" /> Limpiar filtros
              </button>
              <button
                onClick={handleRefresh}
                disabled={uiState.refreshing || incidentData.loading}
                className="flex items-center justify-center gap-2 min-h-11 rounded-lg bg-slate-900 text-sm font-medium text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"
              >
                Actualizar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="mx-auto w-full min-w-0 flex-1 space-y-4 p-4 sm:space-y-5 sm:p-5">
        {!ready && (
          <DataEmptyState
            icon={AlertTriangle}
            title="Falta información de tu acceso"
            description="No se pudo identificar la empresa o localidad asignada. Vuelve a iniciar sesión para recuperar tu acceso."
          />
        )}

        {/* Summary describes only the loaded page. */}
        {!incidentData.error && incidentData.data.length > 0 && (
          <GuidedTarget
            id="incidents-summary"
            className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4"
          >
            <IncidentStatCard
              label="Incidentes en esta página"
              value={incidentData.data.length}
              icon={AlertTriangle}
              color="slate"
            />
            <IncidentStatCard label="Activos" value={totalActivos} icon={Clock} color="emerald" />
            <IncidentStatCard
              label="Resueltos"
              value={totalResueltos}
              icon={CheckCircle}
              color="blue"
            />
            <IncidentStatCard
              label="Empresas"
              value={totalEmpresas}
              icon={BriefcaseBusiness}
              color="indigo"
            />
          </GuidedTarget>
        )}

        {/* Error State */}
        {incidentData.error && (
          <div
            role="alert"
            className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-center dark:border-rose-900 dark:bg-rose-950/20 sm:p-5"
          >
            <AlertTriangle className="mx-auto h-10 w-10 text-rose-500 mb-3 block" />
            <h3 className="text-lg font-bold text-rose-800 dark:text-rose-200">
              No se pudieron cargar los incidentes
            </h3>
            <p className="text-rose-600 dark:text-rose-300 mb-6">
              {prettyError(incidentData.error)}
            </p>
            <button
              onClick={() => fetchIncidents(incidentData.meta.page)}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-700"
            >
              <RefreshCw className="h-4 w-4" /> Reintentar
            </button>
          </div>
        )}

        {/* Table Container */}
        {ready && (!incidentData.error || incidentData.data.length > 0) && (
          <GuidedTarget
            id="incidents-list"
            className="relative overflow-hidden rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] shadow-[var(--app-shadow-sm)]"
          >
            <div className="overflow-x-auto">
              <div className="min-w-full">
                <IncidentesTable
                  data={filteredIncidents}
                  loading={incidentData.loading}
                  meta={incidentData.meta}
                  onRowPress={handleIncidentSelect}
                  onPageChange={handlePageChange}
                  onRefresh={handleRefresh}
                  refreshing={uiState.refreshing}
                  emptyStateText={
                    filters.searchQuery.trim()
                      ? "Sin coincidencias en esta página"
                      : activeTab === "Actuales"
                        ? "No hay incidentes activos en esta página"
                        : "No hay incidentes pasados en esta página"
                  }
                />
              </div>
            </div>
          </GuidedTarget>
        )}
      </div>

      {/* Smart Blocker Modal */}
      {uiState.blockerVisible &&
        uiState.selectedIncident &&
        (isTorreonIncident(uiState.selectedIncident) ? (
          <TorreonIncidentDetailModal
            key={`${uiState.selectedIncident.id}-${modalKey}`}
            incident={uiState.selectedIncident}
            title={torreonIncidentTitle(uiState.selectedIncident)}
            subtitle={torreonIncidentSubtitle(uiState.selectedIncident)}
            resolving={uiState.refreshing}
            onResolve={(comments) => handleIncidentAction("resolve", comments)}
            onCancel={(comments) => handleIncidentAction("skip", comments)}
            onClose={() => {
              setUiState((p) => ({ ...p, blockerVisible: false, selectedIncident: null }));
              setModalKey((k) => k + 1);
            }}
          />
        ) : (
          <SmartIncidentBlocker
            key={`${uiState.selectedIncident.id}-${modalKey}`}
            incident={uiState.selectedIncident}
            operatorComment={uiState.selectedIncident.operadorComentario}
            onResolve={(comments) => handleIncidentAction("resolve", comments)}
            onContinue={() => {
              setUiState((p) => ({ ...p, blockerVisible: false, selectedIncident: null }));
              setModalKey((k) => k + 1);
            }}
            onSkip={() => handleIncidentAction("skip")}
          />
        ))}
    </GuidedTarget>
  );
}
