/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import IncidentesTable from "./IncidentesTable";
import SmartIncidentBlocker from "./SmartIncidentBlocker";
import type { IncidenteRow, Meta, Role } from "./types";
import {
  AlertTriangle,
  BriefcaseBusiness,
  MapPin,
  RefreshCw,
  Search,
  Clock,
  SlidersHorizontal,
  X,
  Loader2,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { fetchJSON } from "@/lib/api";

/** Base same-origin proxy. Zero CORS. */
const BASE = "/bff";
const INCIDENTES = `${BASE}/incidentes`;
const EMPRESAS = `${BASE}/empresas`;
const LOCALIDADES = `${BASE}/localidades`;

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
type FilterState = {
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
  private cache = new Map<number, { data: any; timestamp: number }>();
  private TTL = 5 * 60 * 1000; // 5 minutos
  set(id: number, data: any) {
    this.cache.set(id, { data, timestamp: Date.now() });
  }
  get(id: number) {
    const entry = this.cache.get(id);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.TTL) {
      this.cache.delete(id);
      return null;
    }
    return entry.data;
  }
  clear() {
    this.cache.clear();
  }
}

const detailCache = new DetailCache();

async function fetchIncidenteDetailsBulk(ids: number[], maxConcurrency = 6): Promise<Record<number, any>> {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  const result: Record<number, any> = {};
  const pendingIds: number[] = [];

  for (const id of uniqueIds) {
    const cached = detailCache.get(id);
    if (cached) result[id] = cached;
    else pendingIds.push(id);
  }

  for (let i = 0; i < pendingIds.length; i += maxConcurrency) {
    const chunk = pendingIds.slice(i, i + maxConcurrency);
    const results = await Promise.all(
      chunk.map(async (id) => {
        try {
          const response = await withCreds<any>(`${INCIDENTES}/${id}`);
          const data = (response as any)?.data ?? response;
          detailCache.set(id, data);
          return { id, data };
        } catch {
          return { id, data: null };
        }
      })
    );
    results.forEach(({ id, data }) => {
      if (data) result[id] = data;
    });
  }
  return result;
}

function formatDate(dateString: string): string {
  try {
    return new Date(dateString).toLocaleDateString("es-ES", { year: "numeric", month: "2-digit", day: "2-digit" });
  } catch {
    return "Fecha inválida";
  }
}

// Hook usuario (lee cookies primero)
function useUserRole(): { role: Role; empresaId: number | null; localidadId: number | null } {
  const [userInfo, setUserInfo] = useState<{ role: Role; empresaId: number | null; localidadId: number | null }>({
    role: "CLIENTE",
    empresaId: null,
    localidadId: null,
  });

  useEffect(() => {
    try {
      const userString = typeof window !== "undefined" ? localStorage.getItem("user") : null;
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
  const [notification, setNotification] = useState<NotificationState>({ show: false, type: "info", message: "" });
  const showNotification = useCallback((type: NotificationState["type"], message: string) => {
    setNotification({ show: true, type, message });
    setTimeout(() => setNotification((prev) => ({ ...prev, show: false })), 5000);
  }, []);
  const hideNotification = useCallback(() => setNotification((prev) => ({ ...prev, show: false })), []);
  return { notification, showNotification, hideNotification };
}

export default function IncidenteController() {
  const { role, empresaId: userEmpresaId, localidadId: userLocalidadId } = useUserRole();
  const { notification, showNotification, hideNotification } = useNotifications();

  const isClient = role === "CLIENTE" || role === "SUPERVISOR";
  const tabs: Tab[] = isClient ? ["Actuales"] : ["Actuales", "Pasados"];
  const [activeTab, setActiveTab] = useState<Tab>("Actuales");

  // Catalogues state
  const [catalogues, setCatalogues] = useState<{ empresas: DropdownOption[]; localidades: DropdownOption[]; loading: boolean }>({
    empresas: [],
    localidades: [],
    loading: false,
  });

  // Filters state
  const [filters, setFilters] = useState<FilterState>({
    empresaId: userEmpresaId,
    localidadId: userLocalidadId,
    searchQuery: "",
  });

  // Data state
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

  // UI state
  const [uiState, setUiState] = useState<{ refreshing: boolean; autoRefresh: boolean; selectedIncident: any | null; blockerVisible: boolean }>({
    refreshing: false,
    autoRefresh: false,
    selectedIncident: null,
    blockerVisible: false,
  });

  const [modalKey, setModalKey] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  // Update filters when user info changes
  useEffect(() => {
    if (isClient) {
      setFilters((prev) => ({ ...prev, empresaId: userEmpresaId, localidadId: userLocalidadId }));
    }
  }, [isClient, userEmpresaId, userLocalidadId]);

  // Load catalogues for ADMINS; for CLIENTE cargar solo sus nombres por id (cookies)
  useEffect(() => {
    const load = async () => {
      setCatalogues((p) => ({ ...p, loading: true }));
      try {
        if (!isClient) {
          const [empresasResponse, localidadesResponse] = await Promise.all([withCreds<any>(EMPRESAS), withCreds<any>(LOCALIDADES)]);
          const empresasArray = Array.isArray(empresasResponse) ? empresasResponse : (empresasResponse as any)?.data;
          const localidadesArray = Array.isArray(localidadesResponse) ? localidadesResponse : (localidadesResponse as any)?.data;
          setCatalogues({
            empresas: (empresasArray || []).map((e: any) => ({ id: e.id, nombre: e.nombre })),
            localidades: (localidadesArray || []).map((l: any) => ({ id: l.id, nombre: l.nombre })),
            loading: false,
          });
        } else {
          const [emp, loc] = await Promise.all([
            userEmpresaId ? withCreds<any>(`${EMPRESAS}/${userEmpresaId}`) : null,
            userLocalidadId ? withCreds<any>(`${LOCALIDADES}/${userLocalidadId}`) : null,
          ]);
          setCatalogues({
            empresas: emp?.id ? [{ id: emp.id, nombre: emp.nombre ?? `Empresa #${emp.id}` }] : [],
            localidades: loc?.id ? [{ id: loc.id, nombre: loc.nombre ?? `Localidad #${loc.id}` }] : [],
            loading: false,
          });
        }
      } catch (error: any) {
        console.warn("Error loading catalogues:", error?.message || error);
        setCatalogues((p) => ({ ...p, loading: false }));
        showNotification("error", "Error al cargar catálogos");
      }
    };
    load();
  }, [isClient, userEmpresaId, userLocalidadId, showNotification]);

  // Build API URL
  const buildApiUrl = useCallback(
    (page = 1) => {
      const estadoParam = isClient || activeTab === "Actuales" ? "ABIERTO" : "PASADOS";
      const searchParams = new URLSearchParams({ page: String(page), pageSize: "20", estado: estadoParam });
      if (filters.empresaId) searchParams.set("empresaId", String(filters.empresaId));
      if (filters.localidadId) searchParams.set("localidadId", String(filters.localidadId));
      return `${INCIDENTES}?${searchParams.toString()}`;
    },
    [isClient, activeTab, filters.empresaId, filters.localidadId]
  );

// Fetch incident data
const fetchIncidents = useCallback(
  async (page = 1, showLoading = true) => {
    try {
      setIncidentData((prev) => ({ ...prev, error: null, loading: showLoading }));
      const url = buildApiUrl(page);
      const response: any = await withCreds(url);

      if (!response?.success || !Array.isArray(response.data)) {
        throw new Error((response as any)?.error || "Formato de respuesta inesperado");
      }

      const incidentIds = response.data.map((x: any) => Number(x.id)).filter(Boolean);
      const detailsMap = await fetchIncidenteDetailsBulk(incidentIds);

      const statusDisplayMap: Record<string, string> = {
        ABIERTO: "Activo",
        CERRADO: "Cerrado",
        RESUELTO: "Resuelto",
      };

      const enrichedIncidents: IncidenteRow[] = response.data.map((incident: any) => {
        const details = detailsMap[incident.id] || {};
        const movement = details.movimiento || incident.movimiento || {};
        return {
          id: incident.id,
          empresa: movement?.empresa?.nombre ?? incident?.movimiento?.empresa?.nombre,
          locomotora: movement?.locomotiveNumber ?? incident?.movimiento?.locomotiveNumber,
          origen: movement?.viaOrigen?.nombre ?? incident?.movimiento?.viaOrigen?.nombre,
          destino: movement?.viaDestino?.nombre ?? incident?.movimiento?.viaDestino?.nombre,
          descripcion: details.descripcion ?? incident.descripcion,
          fecha: incident.fechaInicio ? formatDate(incident.fechaInicio) : "—",
          estatus: statusDisplayMap[incident.estado] || "Desconocido",
          estadoRaw: incident.estado,
          usuario: details?.usuario?.nombre ?? incident?.usuario?.nombre,
          _original: { ...incident, _detalle: details },
        };
      });

      const filteredIncidents: IncidenteRow[] =
        activeTab === "Actuales"
          ? enrichedIncidents.filter((x) => x.estadoRaw === "ABIERTO")
          : enrichedIncidents.filter((x) => x.estadoRaw === "CERRADO" || x.estadoRaw === "RESUELTO");

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

      console.log("Fetched incidents:", filteredIncidents);
    } catch (error: any) {
      setIncidentData((prev) => ({ ...prev, error: error?.message || "Error desconocido", data: [], loading: false }));
      showNotification("error", "Error al cargar incidentes");
    } finally {
      setUiState((prev) => ({ ...prev, refreshing: false }));
    }
  },
  [buildApiUrl, activeTab, showNotification]
);

  // (fix) arreglo del nombre mal escrito en la línea anterior
  const enrichedIncents = undefined as never;

  // Load data when filters change
  useEffect(() => {
    if (isClient && (!filters.empresaId || !filters.localidadId)) return;
    startTransition(() => {
      fetchIncidents(1);
    });
  }, [isClient, filters.empresaId, filters.localidadId, activeTab, fetchIncidents]);

  // Auto-refresh
  useEffect(() => {
    if (!uiState.autoRefresh) return;
    const id = setInterval(() => {
      fetchIncidents(incidentData.meta.page || 1, false);
    }, 30_000);
    return () => clearInterval(id);
  }, [uiState.autoRefresh, fetchIncidents, incidentData.meta.page]);

  // Shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key.toLowerCase() === "r" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        handleRefresh();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [incidentData.meta.page]);

  const handlePageChange = useCallback(
    (page: number) => {
      setUiState((prev) => ({ ...prev, refreshing: true }));
      fetchIncidents(page);
    },
    [fetchIncidents]
  );

  const handleRefresh = useCallback(() => {
    setUiState((prev) => ({ ...prev, refreshing: true }));
    fetchIncidents(incidentData.meta.page);
  }, [fetchIncidents, incidentData.meta.page]);

  const handleTabChange = useCallback((tab: Tab) => setActiveTab(tab), []);
  const handleFilterChange = useCallback((filterKey: keyof FilterState, value: any) => {
    setFilters((prev) => ({ ...prev, [filterKey]: value }));
  }, []);
  const handleClearFilters = useCallback(() => {
    setFilters((prev) => ({ ...prev, empresaId: null, localidadId: null }));
  }, []);

  const handleIncidentSelect = useCallback((incident: any) => {
    setUiState((prev) => ({ ...prev, selectedIncident: incident._original, blockerVisible: true }));
    setModalKey((k) => k + 1);
  }, []);

  const handleIncidentAction = useCallback(
    async (action: "resolve" | "skip", comments?: string) => {
      if (!uiState.selectedIncident) return;
      try {
        setUiState((prev) => ({ ...prev, blockerVisible: false, selectedIncident: null }));
        setModalKey((k) => k + 1);

        if (action === "resolve") {
          await withCreds(`${INCIDENTES}/${uiState.selectedIncident.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ estado: "RESUELTO", comentario: comments }),
          });
          showNotification("success", "Incidente resuelto correctamente");
        } else {
          await withCreds(`${INCIDENTES}/${uiState.selectedIncident.id}/cerrar`, { method: "POST" });
          showNotification("success", "Incidente cerrado");
        }

        detailCache.clear();
        fetchIncidents(incidentData.meta.page);
      } catch {
        showNotification("error", "Error al procesar incidente");
      }
    },
    [uiState.selectedIncident, fetchIncidents, incidentData.meta.page, showNotification]
  );

  // Filter incidents locally by search query
  const filteredIncidents = useMemo(() => {
    if (!filters.searchQuery.trim()) return incidentData.data;
    const searchTerm = filters.searchQuery.toLowerCase();
    return incidentData.data.filter((incident) =>
      [incident.id, incident.fecha, incident.empresa, incident.origen, incident.destino, incident.locomotora, incident.estatus, incident.descripcion]
        .map((v) => String(v ?? "").toLowerCase())
        .some((t) => t.includes(searchTerm))
    );
  }, [incidentData.data, filters.searchQuery]);

  // Notification UI
  const renderNotification = () => {
    if (!notification.show) return null;
    const iconMap = { success: CheckCircle, error: AlertCircle, info: AlertCircle };
    const colorMap = { success: "bg-emerald-50 border-emerald-200 text-emerald-800", error: "bg-rose-50 border-rose-200 text-rose-800", info: "bg-blue-50 border-blue-200 text-blue-800" };
    const Icon = iconMap[notification.type];
    return (
      <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 rounded-xl border p-4 shadow-lg ${colorMap[notification.type]}`}>
        <Icon className="h-5 w-5" />
        <span className="font-medium">{notification.message}</span>
        <button onClick={hideNotification} className="ml-2 rounded p-1 hover:bg-black/10">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  };

  const hasActiveFilters = filters.empresaId || filters.localidadId;

  return (
    <div className="min-h-dvh w-full bg-gradient-to-b from-slate-50 to-slate-100 flex flex-col">
      {renderNotification()}

      {/* Top bar */}
      <div className="sticky top-0 z-30 border-b bg-white/95 backdrop-blur-sm w-full shadow-sm">
        <div className="w-full px-3 sm:px-6 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex overflow-hidden rounded-xl bg-slate-100 p-1">
                {tabs.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => handleTabChange(tab)}
                    className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
                      activeTab === tab ? "bg-white text-emerald-700 shadow-sm" : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {hasActiveFilters && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1.5 text-sm font-medium text-emerald-700">
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Filtros activos
                </span>
              )}

              {incidentData.lastUpdated && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-600">
                  <Clock className="h-3.5 w-3.5" />
                  {incidentData.lastUpdated.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}

              {uiState.refreshing && (
                <span className="inline-flex items-center gap-2 text-sm text-emerald-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Actualizando...
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  ref={searchRef}
                  value={filters.searchQuery}
                  onChange={(e) => handleFilterChange("searchQuery", e.target.value)}
                  placeholder="Buscar incidentes... (/)"
                  className="h-11 w-64 sm:w-80 rounded-xl border border-slate-300 bg-white pl-10 pr-4 text-sm shadow-sm transition-colors outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  aria-label="Buscar incidentes"
                />
              </div>

              <button
                onClick={() => setUiState((prev) => ({ ...prev, autoRefresh: !prev.autoRefresh }))}
                className={`h-11 rounded-xl border px-4 text-sm font-semibold transition-colors ${
                  uiState.autoRefresh ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
                aria-pressed={uiState.autoRefresh}
                title="Auto refresh cada 30 segundos"
              >
                <div className="inline-flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4" />
                  <span className="hidden sm:inline">Auto</span>
                </div>
              </button>

              <button
                onClick={handleRefresh}
                disabled={uiState.refreshing}
                className="h-11 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                title="Actualizar (Ctrl/⌘+R)"
              >
                <div className="inline-flex items-center gap-2">
                  <RefreshCw className={`h-4 w-4 ${uiState.refreshing ? "animate-spin" : ""}`} />
                  <span className="hidden sm:inline">Actualizar</span>
                </div>
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {/* Empresa */}
            <div className="flex flex-col">
              <label className="mb-2 text-xs font-bold text-slate-700 uppercase tracking-wide">Empresa</label>
              {isClient ? (
                <div className="h-11 rounded-xl border border-slate-300 bg-slate-50 px-4 flex items-center text-sm text-slate-600">
                  <BriefcaseBusiness className="h-4 w-4 text-emerald-600 mr-3 flex-shrink-0" />
                  <span className="truncate">
                    {filters.empresaId ? catalogues.empresas.find((o) => o.id === filters.empresaId)?.nombre || `Empresa #${filters.empresaId}` : "Todas las empresas"}
                  </span>
                </div>
              ) : (
                <select
                  value={filters.empresaId ?? ""}
                  onChange={(e) => handleFilterChange("empresaId", e.target.value === "" ? null : Number(e.target.value))}
                  className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm shadow-sm transition-colors outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  disabled={catalogues.loading}
                >
                  <option value="">Todas las empresas</option>
                  {catalogues.empresas.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.nombre}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Localidad */}
            <div className="flex flex-col">
              <label className="mb-2 text-xs font-bold text-slate-700 uppercase tracking-wide">Localidad</label>
              {isClient ? (
                <div className="h-11 rounded-xl border border-slate-300 bg-slate-50 px-4 flex items-center text-sm text-slate-600">
                  <MapPin className="h-4 w-4 text-emerald-600 mr-3 flex-shrink-0" />
                  <span className="truncate">
                    {filters.localidadId ? catalogues.localidades.find((o) => o.id === filters.localidadId)?.nombre || `Localidad #${filters.localidadId}` : "Todas las localidades"}
                  </span>
                </div>
              ) : (
                <select
                  value={filters.localidadId ?? ""}
                  onChange={(e) => handleFilterChange("localidadId", e.target.value === "" ? null : Number(e.target.value))}
                  className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm shadow-sm transition-colors outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  disabled={catalogues.loading}
                >
                  <option value="">Todas las localidades</option>
                  {catalogues.localidades.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.nombre}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {!isClient && (filters.empresaId || filters.localidadId) && (
              <div className="flex flex-col justify-end">
                <button
                  onClick={handleClearFilters}
                  className="h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-600 px-4 text-sm font-semibold text-white hover:bg-slate-700 transition-colors"
                >
                  <RefreshCw className="h-4 w-4" />
                  Limpiar filtros
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 w-full px-3 sm:px-6 py-6">
        {incidentData.error ? (
          <div className="flex flex-col items-center justify-center gap-6 rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50 to-rose-100 p-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-100">
              <AlertTriangle className="h-8 w-8 text-rose-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-rose-800 mb-2">Error de conectividad</h3>
              <p className="text-rose-600 mb-4 max-w-md">No se pudieron cargar los incidentes. Verifique su conexión e intente nuevamente.</p>
              <details className="text-left">
                <summary className="cursor-pointer text-sm text-rose-500 hover:text-rose-600 mb-2">Ver detalles técnicos</summary>
                <pre className="text-xs bg-rose-50 p-3 rounded-lg overflow-auto max-h-32 text-rose-700">{prettyError(incidentData.error)}</pre>
              </details>
            </div>
            <button
              onClick={() => fetchIncidents(incidentData.meta.page)}
              disabled={incidentData.loading}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {incidentData.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Reintentar
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden relative">
            {(incidentData.loading || isPending) && (
              <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                  <span className="text-sm font-medium text-slate-600">Cargando incidentes...</span>
                </div>
              </div>
            )}

            {incidentData.data.length > 0 && (
              <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-slate-700">
                      {filteredIncidents.length === incidentData.data.length
                        ? `${incidentData.data.length} incidente${incidentData.data.length !== 1 ? "s" : ""}`
                        : `${filteredIncidents.length} de ${incidentData.data.length} incidentes`}
                    </span>
                    {filters.searchQuery && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                        <Search className="h-3 w-3" />
                        Filtrado por: "{filters.searchQuery}"
                      </span>
                    )}
                  </div>
                  {incidentData.meta.total && (
                    <span className="text-xs text-slate-500">
                      Página {incidentData.meta.page} de {incidentData.meta.totalPages} ({incidentData.meta.total} total)
                    </span>
                  )}
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
                  emptyStateText={activeTab === "Actuales" ? "No hay incidentes activos en este momento" : "No hay incidentes pasados registrados"}
                />
              </div>
            </div>
          </div>
        )}

        {incidentData.data.length > 0 && !incidentData.error && (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl bg-white border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Total</p>
                  <p className="text-2xl font-bold text-slate-900">{incidentData.data.length}</p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-slate-600" />
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-white border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-emerald-600 uppercase tracking-wide">Activos</p>
                  <p className="text-2xl font-bold text-emerald-700">{incidentData.data.filter((i) => i.estadoRaw === "ABIERTO").length}</p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-emerald-600" />
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-white border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-blue-600 uppercase tracking-wide">Resueltos</p>
                  <p className="text-2xl font-bold text-blue-700">{incidentData.data.filter((i) => i.estadoRaw === "RESUELTO").length}</p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-white border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Empresas</p>
                  <p className="text-2xl font-bold text-slate-900">{new Set(incidentData.data.map((i) => i.empresa).filter(Boolean)).size}</p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center">
                  <BriefcaseBusiness className="h-5 w-5 text-slate-600" />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {uiState.blockerVisible && uiState.selectedIncident && (
        <SmartIncidentBlocker
          key={`${uiState.selectedIncident.id}-${modalKey}`}
          incident={uiState.selectedIncident}
          operatorComment={uiState.selectedIncident.operadorComentario}
          onResolve={(comments) => handleIncidentAction("resolve", comments)}
          onContinue={() => {
            setUiState((prev) => ({ ...prev, blockerVisible: false, selectedIncident: null }));
            setModalKey((k) => k + 1);
          }}
          onSkip={() => handleIncidentAction("skip")}
        />
      )}
    </div>
  );
}
