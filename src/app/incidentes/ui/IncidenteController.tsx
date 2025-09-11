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
  AlertCircle
} from "lucide-react";
import { fetchJSON } from "@/lib/api";

/** Base same-origin proxy. Zero CORS. */
const BASE = "/api/passthrough";
const INCIDENTES = `${BASE}/incidentes`;
const EMPRESAS = `${BASE}/empresas`;
const LOCALIDADES = `${BASE}/localidades`;

/** Read token from non-HttpOnly cookie and build Authorization header. */
function authFromCookie(): HeadersInit {
  if (typeof document === "undefined") return {};
  const match = document.cookie.match(/(?:^|;\s*)token=([^;]+)/);
  return match ? { Authorization: `Bearer ${decodeURIComponent(match[1])}` } : {};
}

/** Helper: always same-origin + credentials + optional Authorization. */
const withCreds = <T = any>(url: string, init: RequestInit = {}) =>
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
  type: 'success' | 'error' | 'info';
  message: string;
};

function prettyError(obj: any): string {
  try { 
    return typeof obj === "string" ? obj : JSON.stringify(obj, null, 2); 
  } catch { 
    return String(obj); 
  }
}

// Cache optimizado con TTL
class DetailCache {
  private cache = new Map<number, { data: any; timestamp: number }>();
  private TTL = 5 * 60 * 1000; // 5 minutos

  set(id: number, data: any): void {
    this.cache.set(id, { data, timestamp: Date.now() });
  }

  get(id: number): any | null {
    const entry = this.cache.get(id);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > this.TTL) {
      this.cache.delete(id);
      return null;
    }
    
    return entry.data;
  }

  has(id: number): boolean {
    return this.get(id) !== null;
  }

  clear(): void {
    this.cache.clear();
  }
}

const detailCache = new DetailCache();

async function fetchIncidenteDetailsBulk(ids: number[], maxConcurrency = 6): Promise<Record<number, any>> {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  const result: Record<number, any> = {};
  const pendingIds: number[] = [];

  // Check cache first
  for (const id of uniqueIds) {
    const cached = detailCache.get(id);
    if (cached) {
      result[id] = cached;
    } else {
      pendingIds.push(id);
    }
  }

  if (!pendingIds.length) return result;

  // Process pending in chunks
  for (let i = 0; i < pendingIds.length; i += maxConcurrency) {
    const chunk = pendingIds.slice(i, i + maxConcurrency);
    const promises = chunk.map(async (id) => {
      try {
        const response = await withCreds<any>(`${INCIDENTES}/${id}`);
        const data = response?.data ?? response;
        detailCache.set(id, data);
        return { id, data };
      } catch (error) {
        console.warn(`Failed to fetch details for incident ${id}:`, error);
        return { id, data: null };
      }
    });

    const results = await Promise.all(promises);
    results.forEach(({ id, data }) => {
      if (data) result[id] = data;
    });
  }

  return result;
}

function formatDate(dateString: string): string {
  try { 
    return new Date(dateString).toLocaleDateString("es-ES", {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }); 
  } catch { 
    return "Fecha inválida"; 
  }
}

// Hook personalizado para manejo de usuario
function useUserRole(): { role: Role; empresaId: number | null; localidadId: number | null } {
  const [userInfo, setUserInfo] = useState<{ role: Role; empresaId: number | null; localidadId: number | null }>({
    role: "CLIENTE",
    empresaId: null,
    localidadId: null
  });

  useEffect(() => {
    try {
      const userString = typeof window !== "undefined" ? localStorage.getItem("user") : null;
      if (!userString) return;
      
      const user = JSON.parse(userString);
      const role = (user.rol as Role) || "CLIENTE";
      
      setUserInfo({
        role,
        empresaId: (role === "CLIENTE" || role === "SUPERVISOR") ? user.empresaId ?? null : null,
        localidadId: (role === "CLIENTE" || role === "SUPERVISOR") ? user.localidadId ?? null : null
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
    type: 'info',
    message: ''
  });

  const showNotification = useCallback((type: NotificationState['type'], message: string) => {
    setNotification({ show: true, type, message });
    setTimeout(() => {
      setNotification(prev => ({ ...prev, show: false }));
    }, 5000);
  }, []);

  const hideNotification = useCallback(() => {
    setNotification(prev => ({ ...prev, show: false }));
  }, []);

  return { notification, showNotification, hideNotification };
}

export default function IncidenteController() {
  const { role, empresaId: userEmpresaId, localidadId: userLocalidadId } = useUserRole();
  const { notification, showNotification, hideNotification } = useNotifications();
  
  const tabs: Tab[] = role === "CLIENTE" || role === "SUPERVISOR" ? ["Actuales"] : ["Actuales", "Pasados"];
  const [activeTab, setActiveTab] = useState<Tab>("Actuales");

  // Catalogues state
  const [catalogues, setCatalogues] = useState<{
    empresas: DropdownOption[];
    localidades: DropdownOption[];
    loading: boolean;
  }>({
    empresas: [],
    localidades: [],
    loading: false
  });

  // Filters state
  const [filters, setFilters] = useState<FilterState>({
    empresaId: userEmpresaId,
    localidadId: userLocalidadId,
    searchQuery: ""
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
    lastUpdated: null
  });

  // UI state
  const [uiState, setUiState] = useState<{
    refreshing: boolean;
    autoRefresh: boolean;
    selectedIncident: any | null;
    blockerVisible: boolean;
  }>({
    refreshing: false,
    autoRefresh: false,
    selectedIncident: null,
    blockerVisible: false
  });

  // clave para forzar remount del modal
  const [modalKey, setModalKey] = useState(0);

  const searchRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  // Update filters when user info changes
  useEffect(() => {
    if (role === "CLIENTE" || role === "SUPERVISOR") {
      setFilters(prev => ({
        ...prev,
        empresaId: userEmpresaId,
        localidadId: userLocalidadId
      }));
    }
  }, [role, userEmpresaId, userLocalidadId]);

  // Load catalogues
  useEffect(() => {
    if (role === "CLIENTE") return;

    const loadCatalogues = async () => {
      setCatalogues(prev => ({ ...prev, loading: true }));
      
      try {
        const [empresasResponse, localidadesResponse] = await Promise.all([
          withCreds<any>(EMPRESAS),
          withCreds<any>(LOCALIDADES),
        ]);
        
        const empresasArray = Array.isArray(empresasResponse) ? empresasResponse : empresasResponse?.data;
        const localidadesArray = Array.isArray(localidadesResponse) ? localidadesResponse : localidadesResponse?.data;
        
        const empresasOptions = Array.isArray(empresasArray) 
          ? empresasArray.map((e: any) => ({ id: e.id, nombre: e.nombre }))
          : [];
        const localidadesOptions = Array.isArray(localidadesArray) 
          ? localidadesArray.map((l: any) => ({ id: l.id, nombre: l.nombre }))
          : [];

        setCatalogues({
          empresas: empresasOptions,
          localidades: localidadesOptions,
          loading: false
        });

        // Load user's empresa if not in the list
        if (userEmpresaId && !empresasOptions.some(o => o.id === userEmpresaId)) {
          try {
            const empresaResponse = await withCreds<any>(`${EMPRESAS}/${userEmpresaId}`);
            const empresa = empresaResponse?.data ?? empresaResponse;
            if (empresa?.id) {
              setCatalogues(prev => ({
                ...prev,
                empresas: [...prev.empresas, { 
                  id: empresa.id, 
                  nombre: empresa.nombre ?? `Empresa #${empresa.id}` 
                }]
              }));
            }
          } catch (error) {
            console.warn("Error loading user empresa:", error);
          }
        }
      } catch (error: any) {
        console.warn("Error loading catalogues:", error?.message || error);
        setCatalogues(prev => ({ ...prev, loading: false }));
        showNotification('error', 'Error al cargar catálogos');
      }
    };

    loadCatalogues();
  }, [role, userEmpresaId, showNotification]);

  // Build API URL
  const buildApiUrl = useCallback((page = 1) => {
    const estadoParam = role === "CLIENTE" || activeTab === "Actuales" ? "ABIERTO" : "PASADOS";
    const searchParams = new URLSearchParams({
      page: String(page),
      pageSize: "20",
      estado: estadoParam,
    });
    
    if (filters.empresaId) searchParams.set("empresaId", String(filters.empresaId));
    if (filters.localidadId) searchParams.set("localidadId", String(filters.localidadId));
    
    return `${INCIDENTES}?${searchParams.toString()}`;
  }, [role, activeTab, filters.empresaId, filters.localidadId]);

  // Fetch incident data
  const fetchIncidents = useCallback(async (page = 1, showLoading = true) => {
    try {
      setIncidentData(prev => ({ 
        ...prev, 
        error: null, 
        loading: showLoading 
      }));

      const url = buildApiUrl(page);
      const response: any = await withCreds(url);
      
      if (!response.success || !Array.isArray(response.data)) {
        throw new Error(response.error || "Formato de respuesta inesperado");
      }

      const incidentIds = response.data.map((x: any) => Number(x.id)).filter(Boolean);
      const detailsMap = await fetchIncidenteDetailsBulk(incidentIds);

      const statusDisplayMap: Record<string, string> = { 
        ABIERTO: "Activo", 
        CERRADO: "Cerrado", 
        RESUELTO: "Resuelto" 
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

      const filteredIncidents = activeTab === "Actuales"
        ? enrichedIncidents.filter((x) => x.estadoRaw === "ABIERTO")
        : enrichedIncidents.filter((x) => x.estadoRaw === "CERRADO" || x.estadoRaw === "RESUELTO");

      setIncidentData({
        data: filteredIncidents,
        meta: {
          page: response.meta.page,
          totalPages: response.meta.totalPages,
          total: response.meta.total,
          pageSize: response.meta.pageSize,
        },
        loading: false,
        error: null,
        lastUpdated: new Date()
      });

    } catch (error: any) {
      setIncidentData(prev => ({
        ...prev,
        error: error?.message || "Error desconocido",
        data: [],
        loading: false
      }));
      showNotification('error', 'Error al cargar incidentes');
    } finally {
      setUiState(prev => ({ ...prev, refreshing: false }));
    }
  }, [buildApiUrl, activeTab, showNotification]);

  // Load data when filters change
  useEffect(() => {
    if (role === "CLIENTE" && (!filters.empresaId || !filters.localidadId)) return;
    
    startTransition(() => {
      fetchIncidents(1);
    });
  }, [role, filters.empresaId, filters.localidadId, activeTab, fetchIncidents]);

  // Auto-refresh functionality
  useEffect(() => {
    if (!uiState.autoRefresh) return;
    
    const intervalId = setInterval(() => {
      fetchIncidents(incidentData.meta.page || 1, false);
    }, 30_000);
    
    return () => clearInterval(intervalId);
  }, [uiState.autoRefresh, fetchIncidents, incidentData.meta.page]);

  // Keyboard shortcuts
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

  // Event handlers
  const handlePageChange = useCallback((page: number) => {
    setUiState(prev => ({ ...prev, refreshing: true }));
    fetchIncidents(page);
  }, [fetchIncidents]);

  const handleRefresh = useCallback(() => {
    setUiState(prev => ({ ...prev, refreshing: true }));
    fetchIncidents(incidentData.meta.page);
  }, [fetchIncidents, incidentData.meta.page]);

  const handleTabChange = useCallback((tab: Tab) => {
    setActiveTab(tab);
  }, []);

  const handleFilterChange = useCallback((filterKey: keyof FilterState, value: any) => {
    setFilters(prev => ({ ...prev, [filterKey]: value }));
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters(prev => ({ ...prev, empresaId: null, localidadId: null }));
  }, []);

  const handleIncidentSelect = useCallback((incident: any) => {
    setUiState(prev => ({
      ...prev,
      selectedIncident: incident._original,
      blockerVisible: true
    }));
    setModalKey(k => k + 1); // fuerza remount del modal
  }, []);

  const handleIncidentAction = useCallback(async (action: 'resolve' | 'skip', comments?: string) => {
    if (!uiState.selectedIncident) return;
    
    try {
      // cerrar y limpiar selección
      setUiState(prev => ({ ...prev, blockerVisible: false, selectedIncident: null }));
      setModalKey(k => k + 1); // próximo remount limpio
      
      if (action === 'resolve') {
        await withCreds(`${INCIDENTES}/${uiState.selectedIncident.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ estado: "RESUELTO", comentario: comments }),
        });
        showNotification('success', 'Incidente resuelto correctamente');
      } else if (action === 'skip') {
        await withCreds(`${INCIDENTES}/${uiState.selectedIncident.id}/cerrar`, { 
          method: "POST" 
        });
        showNotification('success', 'Incidente cerrado');
      }
      
      // limpiar cache y refrescar
      detailCache.clear();
      fetchIncidents(incidentData.meta.page);
      
    } catch (error) {
      showNotification('error', 'Error al procesar incidente');
      console.error('Error processing incident:', error);
    }
  }, [uiState.selectedIncident, fetchIncidents, incidentData.meta.page, showNotification]);

  // Filter incidents locally by search query
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
        incident.descripcion
      ]
        .map((value) => String(value ?? "").toLowerCase())
        .some((text) => text.includes(searchTerm))
    );
  }, [incidentData.data, filters.searchQuery]);

  // Render notification
  const renderNotification = () => {
    if (!notification.show) return null;

    const iconMap = {
      success: CheckCircle,
      error: AlertCircle,
      info: AlertCircle
    };

    const colorMap = {
      success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
      error: 'bg-rose-50 border-rose-200 text-rose-800',
      info: 'bg-blue-50 border-blue-200 text-blue-800'
    };

    const Icon = iconMap[notification.type];

    return (
      <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 rounded-xl border p-4 shadow-lg ${colorMap[notification.type]}`}>
        <Icon className="h-5 w-5" />
        <span className="font-medium">{notification.message}</span>
        <button
          onClick={hideNotification}
          className="ml-2 rounded p-1 hover:bg-black/10"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  };

  const hasActiveFilters = filters.empresaId || filters.localidadId;
  const isClient = role === "CLIENTE";

  return (
    <div className="min-h-dvh w-full bg-gradient-to-b from-slate-50 to-slate-100 flex flex-col">
      {/* Notification */}
      {renderNotification()}

      {/* Top bar - sticky and full width */}
      <div className="sticky top-0 z-30 border-b bg-white/95 backdrop-blur-sm w-full shadow-sm">
        <div className="w-full px-3 sm:px-6 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            {/* Left section - tabs and status */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Tab switcher */}
              <div className="inline-flex overflow-hidden rounded-xl bg-slate-100 p-1">
                {tabs.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => handleTabChange(tab)}
                    className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
                      activeTab === tab 
                        ? "bg-white text-emerald-700 shadow-sm" 
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Status indicators */}
              {hasActiveFilters && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1.5 text-sm font-medium text-emerald-700">
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Filtros activos
                </span>
              )}

              {incidentData.lastUpdated && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-600">
                  <Clock className="h-3.5 w-3.5" />
                  {incidentData.lastUpdated.toLocaleTimeString('es-ES', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </span>
              )}

              {uiState.refreshing && (
                <span className="inline-flex items-center gap-2 text-sm text-emerald-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Actualizando...
                </span>
              )}
            </div>

            {/* Right section - controls */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Search input */}
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  ref={searchRef}
                  value={filters.searchQuery}
                  onChange={(e) => handleFilterChange('searchQuery', e.target.value)}
                  placeholder="Buscar incidentes... (/)"
                  className="h-11 w-64 sm:w-80 rounded-xl border border-slate-300 bg-white pl-10 pr-4 text-sm shadow-sm transition-colors outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  aria-label="Buscar incidentes"
                />
              </div>

              {/* Auto refresh toggle */}
              <button
                onClick={() => setUiState(prev => ({ ...prev, autoRefresh: !prev.autoRefresh }))}
                className={`h-11 rounded-xl border px-4 text-sm font-semibold transition-colors ${
                  uiState.autoRefresh
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
                aria-pressed={uiState.autoRefresh}
                title="Auto refresh cada 30 segundos"
              >
                <div className="inline-flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4" />
                  <span className="hidden sm:inline">Auto</span>
                </div>
              </button>

              {/* Manual refresh */}
              <button
                onClick={handleRefresh}
                disabled={uiState.refreshing}
                className="h-11 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                title="Actualizar (Ctrl/⌘+R)"
              >
                <div className="inline-flex items-center gap-2">
                  <RefreshCw className={`h-4 w-4 ${uiState.refreshing ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Actualizar</span>
                </div>
              </button>
            </div>
          </div>

          {/* Filters section */}
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {/* Company filter */}
            <div className="flex flex-col">
              <label className="mb-2 text-xs font-bold text-slate-700 uppercase tracking-wide">
                Empresa
              </label>
              {isClient ? (
                <div className="h-11 rounded-xl border border-slate-300 bg-slate-50 px-4 flex items-center text-sm text-slate-600">
                  <BriefcaseBusiness className="h-4 w-4 text-emerald-600 mr-3 flex-shrink-0" />
                  <span className="truncate">
                    {filters.empresaId 
                      ? catalogues.empresas.find(o => o.id === filters.empresaId)?.nombre || `Empresa #${filters.empresaId}`
                      : "Todas las empresas"
                    }
                  </span>
                </div>
              ) : (
                <select
                  value={filters.empresaId ?? ""}
                  onChange={(e) => handleFilterChange('empresaId', e.target.value === "" ? null : Number(e.target.value))}
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

            {/* Location filter */}
            <div className="flex flex-col">
              <label className="mb-2 text-xs font-bold text-slate-700 uppercase tracking-wide">
                Localidad
              </label>
              {isClient ? (
                <div className="h-11 rounded-xl border border-slate-300 bg-slate-50 px-4 flex items-center text-sm text-slate-600">
                  <MapPin className="h-4 w-4 text-emerald-600 mr-3 flex-shrink-0" />
                  <span className="truncate">
                    {filters.localidadId
                      ? catalogues.localidades.find(o => o.id === filters.localidadId)?.nombre || `Localidad #${filters.localidadId}`
                      : "Todas las localidades"
                    }
                  </span>
                </div>
              ) : (
                <select
                  value={filters.localidadId ?? ""}
                  onChange={(e) => handleFilterChange('localidadId', e.target.value === "" ? null : Number(e.target.value))}
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

            {/* Clear filters button */}
            {!isClient && hasActiveFilters && (
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

      {/* Main content area */}
      <div className="flex-1 w-full px-3 sm:px-6 py-6">
        {incidentData.error ? (
          <div className="flex flex-col items-center justify-center gap-6 rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50 to-rose-100 p-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-100">
              <AlertTriangle className="h-8 w-8 text-rose-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-rose-800 mb-2">Error de conectividad</h3>
              <p className="text-rose-600 mb-4 max-w-md">
                No se pudieron cargar los incidentes. Verifique su conexión e intente nuevamente.
              </p>
              <details className="text-left">
                <summary className="cursor-pointer text-sm text-rose-500 hover:text-rose-600 mb-2">
                  Ver detalles técnicos
                </summary>
                <pre className="text-xs bg-rose-50 p-3 rounded-lg overflow-auto max-h-32 text-rose-700">
                  {prettyError(incidentData.error)}
                </pre>
              </details>
            </div>
            <button
              onClick={() => fetchIncidents(incidentData.meta.page)}
              disabled={incidentData.loading}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {incidentData.loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Reintentar
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            {/* Loading overlay */}
            {(incidentData.loading || isPending) && (
              <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                  <span className="text-sm font-medium text-slate-600">Cargando incidentes...</span>
                </div>
              </div>
            )}

            {/* Results summary */}
            {incidentData.data.length > 0 && (
              <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-slate-700">
                      {filteredIncidents.length === incidentData.data.length 
                        ? `${incidentData.data.length} incidente${incidentData.data.length !== 1 ? 's' : ''}`
                        : `${filteredIncidents.length} de ${incidentData.data.length} incidentes`
                      }
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
                      Página {incidentData.meta.page} de {incidentData.meta.totalPages} 
                      ({incidentData.meta.total} total)
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Table container with responsive scroll */}
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
                  emptyStateText={
                    activeTab === "Actuales" 
                      ? "No hay incidentes activos en este momento" 
                      : "No hay incidentes pasados registrados"
                  }
                />
              </div>
            </div>
          </div>
        )}

        {/* Data insights - only show when we have data */}
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
                  <p className="text-2xl font-bold text-emerald-700">
                    {incidentData.data.filter(i => i.estadoRaw === 'ABIERTO').length}
                  </p>
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
                  <p className="text-2xl font-bold text-blue-700">
                    {incidentData.data.filter(i => i.estadoRaw === 'RESUELTO').length}
                  </p>
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
                  <p className="text-2xl font-bold text-slate-900">
                    {new Set(incidentData.data.map(i => i.empresa).filter(Boolean)).size}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center">
                  <BriefcaseBusiness className="h-5 w-5 text-slate-600" />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal for incident details */}
      {uiState.blockerVisible && uiState.selectedIncident && (
        <SmartIncidentBlocker
          key={`${uiState.selectedIncident.id}-${modalKey}`}
          incident={uiState.selectedIncident}
          operatorComment={uiState.selectedIncident.operadorComentario}
          onResolve={(comments) => handleIncidentAction('resolve', comments)}
          onContinue={() => {
            setUiState(prev => ({ ...prev, blockerVisible: false, selectedIncident: null }));
            setModalKey(k => k + 1); // garantiza remount en próxima apertura
          }}
          onSkip={() => handleIncidentAction('skip')}
        />
      )}
    </div>
  );
}
