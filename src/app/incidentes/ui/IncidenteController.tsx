/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import IncidentesTable from "./IncidentesTable";
import SmartIncidentBlocker from "./SmartIncidentBlocker";
import TorreonIncidentDetailModal from "@/app/coordinador/torreon/TorreonIncidentDetailModal";
import type { IncidenteRow, Meta, Role } from "./types";
import {
  AlertTriangle,
  BriefcaseBusiness,
  RefreshCw,
  Clock,
  X,
  Loader2,
  CheckCircle,
  AlertCircle,
  Filter,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { fetchJSON } from "@/lib/api";
import { isTorreonLocalidadId } from "@/lib/torreonLocalidad";
import { SearchInput } from "@/app/Components/ui";
import { IncidentCatalogSelect, IncidentStatCard } from "@/features/incidentes";
import { useRealtimeMovimientos, type RealtimeMovementEvent } from "@/app/hooks/useRealtimeMovimientos";

/** Incidentes son locality-aware: Torreon usa ms_torreon y el resto Cosaif normal. */
const INCIDENTES = "/api/incidentes";
const EMPRESAS = "/bff/empresas";
const LOCALIDADES = "/bff/localidades";

/** Read token from non-HttpOnly cookie and build Authorization header. */
function authFromCookie(): HeadersInit {
  if (typeof document === "undefined") return {};
  const match = document.cookie.match(/(?:^|;\s*)token=([^;]+)/);
  return match ? { Authorization: `Bearer ${decodeURIComponent(match[1])}` } : {};
}

const getCookie = (name: string) => {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
};

/** Helper: always same-origin + credentials + optional Authorization. */
const withCreds = <T = any,>(url: string, init: RequestInit = {}) =>
  fetchJSON<T>(url, {
    credentials: "include",
    mode: "same-origin",
    headers: { ...(init.headers as any), ...authFromCookie() },
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

// Cache optimizado con TTL
class DetailCache {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private TTL = 5 * 60 * 1000; // 5 minutos

  set(key: string, data: any) {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  get(key: string) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.TTL) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  clear() {
    this.cache.clear();
  }
}

const detailCache = new DetailCache();

function incidentSourceQuery(incident: any): string {
  const source = String(incident?._source || incident?.source || incident?._detalle?._source || "").toLowerCase();
  if (source !== "torreon") return "";
  const params = new URLSearchParams({ source: "torreon" });
  const tipo = String(
    incident?._torreonTipo ||
    incident?.tipoIncidente ||
    incident?._detalle?._torreonTipo ||
    incident?._detalle?.tipoIncidente ||
    ""
  ).toUpperCase();
  if (tipo.includes("ARRASTRE")) params.set("tipo", "ARRASTRE");
  if (tipo.includes("NATURAL")) params.set("tipo", "NATURAL");
  const localidadId =
    incident?.localidadId ??
    incident?.movimiento?.localidadId ??
    incident?._detalle?.localidadId ??
    incident?._detalle?.movimiento?.localidadId;
  if (localidadId) params.set("localidadId", String(localidadId));
  return `?${params.toString()}`;
}

function incidentCacheKey(incident: any) {
  const tipo = String(incident?._torreonTipo || incident?.tipoIncidente || "general").toLowerCase();
  return `${String(incident?._source || incident?.source || "cosaif").toLowerCase()}:${tipo}:${Number(incident?.id) || incident?.id}`;
}

async function fetchIncidenteDetailsBulk(
  incidents: any[],
  maxConcurrency = 6
): Promise<Record<string, any>> {
  const result: Record<string, any> = {};
  const uniqueIncidents = Array.from(
    new Map(
      incidents
        .filter((incident) => incident?.id)
        .filter((incident) => !isTorreonIncident(incident))
        .map((incident) => [incidentCacheKey(incident), incident])
    ).values()
  );
  const pending: any[] = [];

  for (const incident of uniqueIncidents) {
    const key = incidentCacheKey(incident);
    const cached = detailCache.get(key);
    if (cached) result[key] = cached;
    else pending.push(incident);
  }

  for (let i = 0; i < pending.length; i += maxConcurrency) {
    const chunk = pending.slice(i, i + maxConcurrency);
    await Promise.all(
      chunk.map(async (incident) => {
        const id = Number(incident.id);
        const key = incidentCacheKey(incident);
        try {
          const response = await withCreds<any>(`${INCIDENTES}/${encodeURIComponent(String(incident.id))}${incidentSourceQuery(incident)}`);
          const data = (response as any)?.data ?? response;
          detailCache.set(key, data);
          result[key] = data;
          return { id, data };
        } catch {
          return { id, data: null };
        }
      })
    );
  }
  return result;
}

function formatDate(dateString: string): string {
  try {
    return new Date(dateString).toLocaleDateString("es-ES", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return "Fecha inválida";
  }
}

function isTorreonIncident(incident: any) {
  return String(incident?._source || incident?.source || incident?._detalle?._source || "").toLowerCase() === "torreon";
}

function torreonMovementFolio(incident: any) {
  const movimiento = incident?.movimiento ?? incident?._detalle?.movimiento;
  if (movimiento?.folioLocalidadLabel) return movimiento.folioLocalidadLabel;
  if (movimiento?.folioLocalidad) return `#${movimiento.folioLocalidad}`;
  if (movimiento?.id) return `#${movimiento.id}`;
  return "#—";
}

function torreonIncidentTitle(incident: any) {
  const tipo = String(incident?._torreonTipo || incident?.tipoIncidente || incident?._detalle?._torreonTipo || "").toUpperCase();
  const arrastreId = incident?.arrastreId ?? incident?.arrastre?.id ?? incident?._detalle?.arrastreId ?? incident?._detalle?.arrastre?.id;
  if (tipo.includes("ARRASTRE") || arrastreId) return `Arrastre #${arrastreId ?? "—"} · Incidente #${incident?.id ?? "—"}`;
  return `Movimiento Torreon ${torreonMovementFolio(incident)} · Incidente #${incident?.id ?? "—"}`;
}

function torreonIncidentSubtitle(incident: any) {
  const tipo = String(incident?._torreonTipo || incident?.tipoIncidente || incident?._detalle?._torreonTipo || "").toUpperCase();
  const empresa = incident?.movimiento?.empresa?.nombre ?? incident?._detalle?.movimiento?.empresa?.nombre;
  const destino = incident?.movimiento?.viaDestino?.nombre ?? incident?._detalle?.movimiento?.viaDestino?.nombre;
  const label = tipo.includes("ARRASTRE") ? "Incidente de arrastre" : "Incidente natural";
  return [label, empresa, destino].filter(Boolean).join(" · ");
}

// Hook usuario (lee cookies primero)
function useUserRole(): {
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
      const userString =
        typeof window !== "undefined" ? localStorage.getItem("user") : null;
      const user = userString ? JSON.parse(userString) : {};
      const roleCookie = (getCookie("role") || user.rol || "CLIENTE") as Role;
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

  return userInfo;
}

// Hook para notificaciones
function useNotifications() {
  const [notification, setNotification] = useState<NotificationState>({
    show: false,
    type: "info",
    message: "",
  });

  const showNotification = useCallback(
    (type: NotificationState["type"], message: string) => {
      setNotification({ show: true, type, message });
      setTimeout(
        () =>
          setNotification((prev) => ({
            ...prev,
            show: false,
          })),
        5000
      );
    },
    []
  );

  const hideNotification = useCallback(
    () =>
      setNotification((prev) => ({
        ...prev,
        show: false,
      })),
    []
  );

  return { notification, showNotification, hideNotification };
}

export default function IncidenteController() {
  const searchParams = useSearchParams();
  const initialSource: IncidentSource =
    String(searchParams.get("source") || "").toLowerCase() === "torreon" ? "torreon" : "cosaif";
  const initialTipo = String(searchParams.get("tipo") || searchParams.get("tipoIncidente") || "").toUpperCase();
  const initialTorreonTipo: TorreonIncidentKind =
    initialTipo === "ARRASTRE" ? "ARRASTRE" : initialTipo === "NATURAL" ? "NATURAL" : "TODOS";
  const { role, empresaId: userEmpresaId, localidadId: userLocalidadId } =
    useUserRole();
  const { notification, showNotification, hideNotification } =
    useNotifications();

  const isLimitedClientView = role === "CLIENTE";
  // const canSeeEverything = ["ADMINISTRADOR", "SUPERVISOR", "COORDINADOR"].includes(role);

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
    localidadId: isLimitedClientView ? userLocalidadId : null,
    searchQuery: "",
  });
  const isTorreonScope = filters.source === "torreon" || isTorreonLocalidadId(filters.localidadId);

  const [filtersOpen, setFiltersOpen] = useState(false); // Collapsible on mobile

  const [incidentData, setIncidentData] = useState<{
    data: IncidenteRow[];
    meta: Meta;
    loading: boolean;
    error: string | null;
    lastUpdated: Date | null;
  }>({
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
  const [isPending, startTransition] = useTransition();

  /** Sincroniza filtros iniciales cuando llegue user info (solo cliente) */
  useEffect(() => {
    if (isLimitedClientView) {
      setFilters((prev) => ({
        ...prev,
        empresaId: userEmpresaId ?? prev.empresaId,
        localidadId: userLocalidadId ?? prev.localidadId,
      }));
    }
  }, [isLimitedClientView, userEmpresaId, userLocalidadId]);

  /** Carga catálogos de empresas y localidades */
  useEffect(() => {
    const load = async () => {
      setCatalogues((p) => ({ ...p, loading: true }));
      try {
        if (!isLimitedClientView) {
          const [empresasResponse, localidadesResponse] = await Promise.all([
            withCreds<any>(EMPRESAS),
            withCreds<any>(LOCALIDADES),
          ]);

          const empresasArray = Array.isArray(empresasResponse)
            ? empresasResponse
            : (empresasResponse as any)?.data;
          const localidadesArray = Array.isArray(localidadesResponse)
            ? localidadesResponse
            : (localidadesResponse as any)?.data;

          setCatalogues({
            empresas: (empresasArray || []).map((e: any) => ({
              id: e.id,
              nombre: e.nombre,
            })),
            localidades: (localidadesArray || []).map((l: any) => ({
              id: l.id,
              nombre: l.nombre,
            })),
            loading: false,
          });
        } else {
          const [empRes, locRes] = await Promise.all([
            userEmpresaId ? withCreds<any>(`${EMPRESAS}/${userEmpresaId}`) : null,
            userLocalidadId
              ? withCreds<any>(`${LOCALIDADES}/${userLocalidadId}`)
              : null,
          ]);

          const unwrapSingle = (res: any) => {
            if (!res) return null;
            const data = res.data ?? res;
            if (Array.isArray(data)) return data[0] ?? null;
            return data;
          };

          const emp = unwrapSingle(empRes);
          const loc = unwrapSingle(locRes);

          setCatalogues({
            empresas: emp?.id
              ? [
                {
                  id: emp.id,
                  nombre: emp.nombre ?? `Empresa #${emp.id}`,
                },
              ]
              : [],
            localidades: loc?.id
              ? [
                {
                  id: loc.id,
                  nombre: loc.nombre ?? `Localidad #${loc.id}`,
                },
              ]
              : [],
            loading: false,
          });
        }
      } catch {
        setCatalogues((p) => ({ ...p, loading: false }));
        showNotification("error", "Error al cargar catálogos");
      }
    };
    load();
  }, [isLimitedClientView, userEmpresaId, userLocalidadId, showNotification]);

  /** Construye URL del API de incidentes */
  const buildApiUrl = useCallback(
    (page = 1) => {
      const estadoParam = activeTab === "Actuales" ? "ABIERTO" : "PASADOS";

      const searchParams = new URLSearchParams({
        page: String(page),
        pageSize: "20",
        estado: estadoParam,
      });

      if (filters.empresaId)
        searchParams.set("empresaId", String(filters.empresaId));
      if (filters.localidadId)
        searchParams.set("localidadId", String(filters.localidadId));
      if (isTorreonScope) {
        searchParams.set("source", "torreon");
        if (filters.torreonTipo !== "TODOS") searchParams.set("tipo", filters.torreonTipo);
      }

      return `${INCIDENTES}?${searchParams.toString()}`;
    },
    [activeTab, filters.empresaId, filters.localidadId, filters.torreonTipo, isTorreonScope]
  );

  /** Fetch de incidentes + detalle, con logs de empresas */
  const fetchIncidents = useCallback(
    async (page = 1, showLoading = true) => {
      try {
        setIncidentData((prev) => ({
          ...prev,
          error: null,
          loading: showLoading,
        }));

        const url = buildApiUrl(page);
        const response: any = await withCreds(url);

        if (!response?.success || !Array.isArray(response.data)) {
          throw new Error(
            (response as any)?.error || "Formato de respuesta inesperado"
          );
        }

        const detailsMap = await fetchIncidenteDetailsBulk(response.data);

        const statusDisplayMap: Record<string, string> = {
          ABIERTO: "Activo",
          CERRADO: "Cerrado",
          RESUELTO: "Resuelto",
        };

        const enrichedIncidents: IncidenteRow[] = response.data.map(
          (incident: any) => {
            const details = detailsMap[incidentCacheKey(incident)] || {};
            const movement = details.movimiento || incident.movimiento || {};
            const original = { ...incident, ...details, _detalle: details };
            const torreon = isTorreonIncident(original);
            const tipoIncidente = String(
              original?._torreonTipo || original?.tipoIncidente || details?._torreonTipo || ""
            ).toUpperCase();

            return {
              id: incident.id,
              empresa:
                movement?.empresa?.nombre ??
                incident?.movimiento?.empresa?.nombre,
              locomotora:
                movement?.locomotiveNumber ??
                incident?.movimiento?.locomotiveNumber,
              origen:
                movement?.viaOrigen?.nombre ??
                incident?.movimiento?.viaOrigen?.nombre,
              destino:
                movement?.viaDestino?.nombre ??
                incident?.movimiento?.viaDestino?.nombre,
              descripcion: details.descripcion ?? details.motivo ?? incident.descripcion ?? incident.motivo,
              fecha: incident.fechaInicio
                ? formatDate(incident.fechaInicio)
                : "—",
              estatus: statusDisplayMap[incident.estado] || "Desconocido",
              estadoRaw: incident.estado,
              usuario:
                details?.usuario?.nombre ?? incident?.usuario?.nombre,
              fuente: torreon ? "Torreón" : "Cosaif",
              tipoIncidente: torreon ? (tipoIncidente === "ARRASTRE" ? "Arrastre" : "Natural") : "GDL",
              _original: original,
            };
          }
        );

        const filteredIncidents: IncidenteRow[] =
          activeTab === "Actuales"
            ? enrichedIncidents.filter((x) => x.estadoRaw === "ABIERTO")
            : enrichedIncidents.filter(
              (x) =>
                x.estadoRaw === "CERRADO" || x.estadoRaw === "RESUELTO"
            );

        setIncidentData({
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
      } catch (error: any) {
        setIncidentData((prev) => ({
          ...prev,
          error: error?.message || "Error desconocido",
          data: [],
          loading: false,
        }));
        showNotification("error", "Error al cargar incidentes");
      } finally {
        setUiState((prev) => ({ ...prev, refreshing: false }));
      }
    },
    [buildApiUrl, activeTab, showNotification]
  );

  const scheduleRealtimeIncidentRefresh = useCallback(() => {
    if (typeof window === "undefined") return;
    if (realtimeRefreshTimerRef.current != null) return;

    const jitterMs = 450 + Math.floor(Math.random() * 1_250);
    realtimeRefreshTimerRef.current = window.setTimeout(() => {
      realtimeRefreshTimerRef.current = null;
      fetchIncidents(incidentData.meta.page || 1, false);
    }, jitterMs);
  }, [fetchIncidents, incidentData.meta.page]);

  useRealtimeMovimientos({
    enabled: true,
    localidadId: filters.localidadId,
    onEvent: (event: RealtimeMovementEvent) => {
      const type = String(event.type || "");
      if (!type.includes("incidente") && type !== "realtime.ready" && type !== "realtime.resume") return;
      const eventLocalidadId = Number(event.localidadId || 0) || null;
      if (filters.localidadId && eventLocalidadId && filters.localidadId !== eventLocalidadId) return;
      scheduleRealtimeIncidentRefresh();
    },
  });

  useEffect(() => {
    return () => {
      if (realtimeRefreshTimerRef.current != null) {
        window.clearTimeout(realtimeRefreshTimerRef.current);
      }
    };
  }, []);

  /** Carga datos cuando cambian filtros / tab */
  useEffect(() => {
    if (isLimitedClientView && (!filters.empresaId || !filters.localidadId))
      return;

    startTransition(() => {
      fetchIncidents(1);
    });
  }, [
    isLimitedClientView,
    filters.empresaId,
    filters.localidadId,
    activeTab,
    fetchIncidents,
  ]);

  /** Auto-refresh */
  useEffect(() => {
    if (!uiState.autoRefresh) return;
    const id = setInterval(() => {
      fetchIncidents(incidentData.meta.page || 1, false);
    }, 30_000);
    return () => clearInterval(id);
  }, [uiState.autoRefresh, fetchIncidents, incidentData.meta.page]);

  /** Handlers */
  const handleRefresh = useCallback(() => {
    setUiState((prev) => ({ ...prev, refreshing: true }));
    fetchIncidents(incidentData.meta.page);
  }, [fetchIncidents, incidentData.meta.page]);

  const handlePageChange = useCallback(
    (page: number) => {
      setUiState((prev) => ({ ...prev, refreshing: true }));
      fetchIncidents(page);
    },
    [fetchIncidents]
  );

  const handleTabChange = useCallback((tab: Tab) => setActiveTab(tab), []);

  const handleFilterChange = useCallback(
    (filterKey: keyof FilterState, value: any) => {
      setFilters((prev) => {
        const next = { ...prev, [filterKey]: value };
        if (filterKey === "localidadId" && isTorreonLocalidadId(value)) {
          next.source = "torreon";
        }
        if (filterKey === "source" && value === "cosaif" && isTorreonLocalidadId(prev.localidadId)) {
          next.localidadId = null;
          next.torreonTipo = "TODOS";
        }
        return next;
      });
    },
    []
  );

  const handleClearFilters = useCallback(() => {
    setFilters((prev) => ({
      ...prev,
      empresaId: null,
      localidadId: null,
      torreonTipo: "TODOS",
    }));
  }, []);

  const handleIncidentSelect = useCallback((incident: any) => {
    const original = incident._original;
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
      setUiState((prev) => (
        prev.selectedIncident?.id === original.id
          ? { ...prev, selectedIncident: { ...prev.selectedIncident, ...cached, _detalle: cached } }
          : prev
      ));
      return;
    }

    withCreds<any>(`${INCIDENTES}/${encodeURIComponent(String(original.id))}${incidentSourceQuery(original)}`)
      .then((response) => {
        const detail = (response as any)?.data ?? response;
        detailCache.set(key, detail);
        setUiState((prev) => (
          prev.selectedIncident?.id === original.id
            ? { ...prev, selectedIncident: { ...prev.selectedIncident, ...detail, _detalle: detail } }
            : prev
        ));
      })
      .catch(() => undefined);
  }, []);

  const handleIncidentAction = useCallback(
    async (action: "resolve" | "skip", comments?: string) => {
      if (!uiState.selectedIncident) return;
      const selectedIncident = uiState.selectedIncident;

      try {
        setUiState((prev) => ({ ...prev, refreshing: true }));

        if (action === "resolve") {
          await withCreds(`${INCIDENTES}/${selectedIncident.id}${incidentSourceQuery(selectedIncident)}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              estado: "RESUELTO",
              comentario: comments,
            }),
          });
          showNotification("success", "Incidente resuelto correctamente");
        } else {
          await withCreds(
            `${INCIDENTES}/${selectedIncident.id}/cerrar${incidentSourceQuery(selectedIncident)}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ comentario: comments }),
            }
          );
          showNotification("success", isTorreonIncident(selectedIncident)
            ? "Incidente cerrado y movimiento cancelado"
            : "Incidente cerrado sin resolución");
        }

        detailCache.clear();
        await fetchIncidents(incidentData.meta.page);
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
      }
    },
    [uiState.selectedIncident, fetchIncidents, incidentData.meta.page, showNotification]
  );

  /** Filtro local por búsqueda */
  const filteredIncidents = useMemo(() => {
    if (!filters.searchQuery.trim()) return incidentData.data;
    const searchTerm = filters.searchQuery.toLowerCase();
    return incidentData.data.filter((incident) =>
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
        .some((t) => t.includes(searchTerm))
    );
  }, [incidentData.data, filters.searchQuery]);


  // Calculate Stats
  const totalActivos = incidentData.data.filter(i => i.estadoRaw === "ABIERTO").length;
  const totalResueltos = incidentData.data.filter(i => i.estadoRaw === "RESUELTO").length;
  // Unique enterprises present in the current view
  const totalEmpresas = new Set(incidentData.data.map(i => i.empresa).filter(Boolean)).size;

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
      info:
        "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-200",
    } as const;
    const Icon = iconMap[notification.type];

    return (
      <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 rounded-xl border p-4 shadow-lg animate-in slide-in-from-top-4 fade-in duration-300 ${colorMap[notification.type]}`}>
        <Icon className="h-5 w-5" />
        <span className="font-medium">{notification.message}</span>
        <button
          onClick={hideNotification}
          className="ml-2 rounded p-1 hover:bg-black/10 dark:hover:bg-white/10"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  };

  const hasActiveFilters = Boolean(
    filters.empresaId ||
    filters.localidadId ||
    isTorreonScope ||
    filters.torreonTipo !== "TODOS"
  );

  return (
    <div className="flex w-full flex-col min-h-screen bg-slate-50/50 dark:bg-slate-950/50">
      {renderNotification()}

      {/* Header Bar */}
      <div className="sticky top-0 z-30 w-full border-b bg-white/80 backdrop-blur-md shadow-sm dark:bg-slate-900/80 dark:border-slate-800 transition-all duration-300">
        <div className="w-full px-4 sm:px-6 py-3">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            {/* Title / Brand area if needed, otherwise Tabs & Status */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Tabs */}
              <div className="inline-flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
                {tabs.map((tab) => {
                  const isActive = activeTab === tab;
                  // const count = tab === "Actuales" ? totalActivos : (incidentData.meta.total || 0) - totalActivos; // Roughly
                  return (
                    <button
                      key={tab}
                      onClick={() => handleTabChange(tab)}
                      className={`relative flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${isActive
                        ? "bg-white text-slate-800 shadow-sm dark:bg-slate-700 dark:text-white"
                        : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                        }`}
                    >
                      {tab}
                
                      <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] ${isActive ? 'bg-slate-100 dark:bg-slate-600' : 'bg-slate-200 dark:bg-slate-700'}`}>
                      
                      </span> 
                    </button>
                  );
                })}
              </div>

              <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-700 dark:bg-slate-900">
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
                      className={`rounded-lg px-3 py-2 text-xs font-black uppercase tracking-wide transition ${isActive
                        ? "bg-slate-950 text-white shadow-sm dark:bg-white dark:text-slate-950"
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                        }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>

              {isTorreonScope && (
                <div className="inline-flex rounded-xl border border-emerald-200 bg-emerald-50/70 p-1 dark:border-emerald-800 dark:bg-emerald-950/30">
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
                        className={`rounded-lg px-3 py-2 text-xs font-black uppercase tracking-wide transition ${isActive
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "text-emerald-700 hover:bg-white/70 dark:text-emerald-200 dark:hover:bg-emerald-900/50"
                          }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Last update pill */}
              {incidentData.lastUpdated && (
                <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-slate-50 border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400">
                  <Clock className="h-3 w-3" />
                  {incidentData.lastUpdated.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}

              {/* Auto Refresh Toggle */}
              <button
                onClick={() => setUiState(p => ({ ...p, autoRefresh: !p.autoRefresh }))}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors ${uiState.autoRefresh
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-300"
                  : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-400"
                  }`}
                title="Auto refresh"
              >
                <RefreshCw className={`h-3 w-3 ${uiState.autoRefresh ? "animate-spin-slow" : ""}`} />
                {uiState.autoRefresh ? "Auto" : "Manual"}
              </button>
            </div>

            {/* Search & Actions */}
            <div className="flex flex-1 items-center justify-end gap-3 w-full xl:w-auto">
              <SearchInput
                ref={searchRef}
                value={filters.searchQuery}
                onChange={(value) => handleFilterChange("searchQuery", value)}
                onClear={() => handleFilterChange("searchQuery", "")}
                placeholder="Buscar por ID, empresa, via..."
                label="Buscar incidentes"
                className="w-full max-w-md"
                inputClassName="h-10 bg-slate-50/50 font-medium focus:border-emerald-500 focus:bg-white focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800/50 dark:focus:bg-slate-900"
              />

              {/* Mobile Filter Toggle */}
              <button
                onClick={() => setFiltersOpen(!filtersOpen)}
                className={`xl:hidden p-2.5 rounded-xl border transition-colors ${filtersOpen || hasActiveFilters
                  ? "bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-900/20 dark:border-emerald-800"
                  : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-700"
                  }`}
              >
                <Filter className="h-4 w-4" />
              </button>

              {/* Desktop Filter Bar (Visible only on LG) */}
              <div className="hidden xl:flex items-center gap-2">
                {!isLimitedClientView && (
                  <>
                    <IncidentCatalogSelect
                      value={filters.empresaId}
                      onChange={(v: number | null) => handleFilterChange("empresaId", v)}
                      options={catalogues.empresas}
                      placeholder="Todas las Empresas"
                    />
                    <IncidentCatalogSelect
                      value={filters.localidadId}
                      onChange={(v: number | null) => handleFilterChange("localidadId", v)}
                      options={catalogues.localidades}
                      placeholder="Todas las Localidades"
                    />
                  </>
                )}
                <button
                  onClick={handleRefresh}
                  disabled={uiState.refreshing}
                  className="h-10 w-10 flex items-center justify-center rounded-xl bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-70 transition-colors dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 shadow-sm"
                  title="Actualizar"
                >
                  <RefreshCw className={`h-4 w-4 ${uiState.refreshing ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>
          </div>

          {/* Mobile Collapsible Filters */}
          <div className={`overflow-hidden transition-all duration-300 ease-in-out xl:hidden ${filtersOpen ? "max-h-60 opacity-100 mt-4" : "max-h-0 opacity-0"}`}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-2">
              {!isLimitedClientView && (
                <>
                  <IncidentCatalogSelect
                    value={filters.empresaId}
                    onChange={(v: number | null) => handleFilterChange("empresaId", v)}
                    options={catalogues.empresas}
                    placeholder="Todas las Empresas"
                    fullWidth
                  />
                  <IncidentCatalogSelect
                    value={filters.localidadId}
                    onChange={(v: number | null) => handleFilterChange("localidadId", v)}
                    options={catalogues.localidades}
                    placeholder="Todas las Localidades"
                    fullWidth
                  />
                </>
              )}
              <button
                onClick={handleClearFilters}
                className="flex items-center justify-center gap-2 h-10 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" /> Limpiar filtros
              </button>
              <button
                onClick={handleRefresh}
                className="flex items-center justify-center gap-2 h-10 rounded-xl bg-slate-900 text-sm font-medium text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"
              >
                Actualizar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 w-full max-w-[1920px] mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* STATS CARDS - Placed ABOVE table */}
        {!incidentData.error && incidentData.data.length > 0 && (
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <IncidentStatCard
              label="Total Incidentes"
              value={incidentData.data.length}
              icon={AlertTriangle}
              color="slate"
            />
            <IncidentStatCard
              label="Activos"
              value={totalActivos}
              icon={Clock}
              color="emerald"
            />
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
          </div>
        )}

        {/* Error State */}
        {incidentData.error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center dark:border-rose-900 dark:bg-rose-950/20">
            <AlertTriangle className="mx-auto h-10 w-10 text-rose-500 mb-3 block" />
            <h3 className="text-lg font-bold text-rose-800 dark:text-rose-200">Error de conexión</h3>
            <p className="text-rose-600 dark:text-rose-300 mb-6">{prettyError(incidentData.error)}</p>
            <button
              onClick={() => fetchIncidents(incidentData.meta.page)}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-700"
            >
              <RefreshCw className="h-4 w-4" /> Reintentar
            </button>
          </div>
        )}

        {/* Table Container */}
        {!incidentData.error && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden relative dark:border-slate-800 dark:bg-slate-900 animate-in fade-in duration-700">
            {(incidentData.loading || isPending) && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 backdrop-blur-[2px] dark:bg-slate-900/60">
                <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-xl flex flex-col items-center gap-3 border border-slate-100 dark:border-slate-700">
                  <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Cargando...</span>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <div className="min-w-full">
                <IncidentesTable
                  data={filteredIncidents}
                  loading={incidentData.loading || isPending}
                  meta={incidentData.meta}
                  onRowPress={handleIncidentSelect}
                  onPageChange={handlePageChange}
                  onRefresh={handleRefresh}
                  refreshing={uiState.refreshing}
                  emptyStateText={activeTab === "Actuales" ? "No hay incidentes activos" : "No hay incidentes pasados"}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Smart Blocker Modal */}
      {uiState.blockerVisible && uiState.selectedIncident && (
        isTorreonIncident(uiState.selectedIncident) ? (
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
        )
      )}
    </div>
  );
}
