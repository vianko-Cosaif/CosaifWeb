/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useVisibleInterval } from "./useVisibleInterval";
import { useAuthErrorHandler } from "./useAuthErrorHandler";

const DEFAULT_API_BASE =
  process.env.NEXT_PUBLIC_INCIDENT_API_BASE || "/api";

export type IncidenteEmergente = {
  id: number;
  descripcion: string;
  estado: "ABIERTO" | "RESUELTO" | "CERRADO";
  fechaInicio: string;
  empresa?: string;
  locomotora?: string;
  origen?: string;
  destino?: string;
  imagen1?: string;
  imagen2?: string;
  imagen3?: string;
  imagen4?: string;
  imagenes?: string[];
  movimiento?: {
    empresa?: { nombre?: string };
    locomotiveNumber?: string;
    localidadId?: number | string;
    viaOrigen?: { nombre?: string };
    viaDestino?: { nombre?: string };
  };
  _original?: any;
};

export interface UseIncidentMonitorArgs {
  apiBase?: string;
  intervalMs?: number; // Intervalo en milisegundos (por defecto 60000)
  enabled?: boolean; // Si el monitoreo está activo
  onIncidentDetected?: (incident: IncidenteEmergente) => void; // Callback cuando se detecta un incidente
  empresaId?: number | null;
  localidadId?: number | null;
}

export interface UseIncidentMonitorReturn {
  // Estado
  isMonitoring: boolean;
  lastCheck: Date | null;
  error: string | null;

  // Datos
  activeIncidents: IncidenteEmergente[];
  hasNewIncidents: boolean;

  // Acciones
  startMonitoring: () => void;
  stopMonitoring: () => void;
  checkNow: () => Promise<void>;
  markAsSeen: () => void;
  clearError: () => void;
}

/* =============== Hook =============== */

export function useIncidentMonitor({
  apiBase = DEFAULT_API_BASE,
  intervalMs = 60000, // 1 minuto por defecto
  enabled = true,
  onIncidentDetected,
  empresaId = null,
  localidadId = null,
}: UseIncidentMonitorArgs = {}): UseIncidentMonitorReturn {
  // Estado del monitoreo
  const [isMonitoring, setIsMonitoring] = useState(enabled);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Datos de incidentes
  const [activeIncidents, setActiveIncidents] = useState<IncidenteEmergente[]>([]);
  const [hasNewIncidents, setHasNewIncidents] = useState(false);
  const [, setLastIncidentIds] = useState<Set<number>>(new Set());

  // Referencias para control de requests
  const requestSeq = useRef(0);
  const isMounted = useRef(true);
  const requestControllerRef = useRef<AbortController | null>(null);
  const inFlightRequestRef = useRef<Promise<void> | null>(null);
  const onIncidentDetectedRef = useRef(onIncidentDetected);

  const { handleFetchRequest } = useAuthErrorHandler();

  /* ---- Asegurar bandera de montaje correcta ---- */
  useEffect(() => {
    onIncidentDetectedRef.current = onIncidentDetected;
  }, [onIncidentDetected]);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      requestControllerRef.current?.abort();
      requestControllerRef.current = null;
      inFlightRequestRef.current = null;
    };
  }, []);

  // Función para obtener headers de autenticación
  const getAuthHeaders = useCallback((): HeadersInit => {
    if (typeof document === "undefined") return {};
    const match = document.cookie.match(/(?:^|;\s*)token=([^;]+)/);
    return match ? { Authorization: `Bearer ${decodeURIComponent(match[1])}` } : {};
  }, []);

  // Función para adaptar incidente de la API
  const adaptIncidente = useCallback((incident: any): IncidenteEmergente => {
    const movement = incident.movimiento || {};
    return {
      id: incident.id,
      descripcion: incident.descripcion || incident.motivo || "Sin descripción",
      estado: incident.estado || "ABIERTO",
      fechaInicio: incident.fechaInicio || new Date().toISOString(),
      empresa: movement?.empresa?.nombre || incident?.empresa,
      locomotora: movement?.locomotiveNumber || incident?.locomotora,
      origen: movement?.viaOrigen?.nombre || incident?.origen,
      destino: movement?.viaDestino?.nombre || incident?.destino,
      imagen1: incident.imagen1,
      imagen2: incident.imagen2,
      imagen3: incident.imagen3,
      imagen4: incident.imagen4,
      imagenes: incident.imagenes,
      movimiento: movement,
      _original: incident,
    };
  }, []);

  // Función para consultar incidentes activos
  const runIncidentCheck = useCallback(async (): Promise<void> => {
    if (!isMounted.current) return;

    const mySeq = ++requestSeq.current;
    const controller = new AbortController();
    requestControllerRef.current = controller;
    const timeoutId = window.setTimeout(() => controller.abort(), 10_000);
    setError(null);

    try {
      // Construir URL con parámetros
      const params = new URLSearchParams();
      params.append("estado", "ABIERTO");
      params.append("page", "1");
      params.append("pageSize", "50"); // Obtener hasta 50 incidentes activos

      if (empresaId) params.append("empresaId", String(empresaId));
      if (localidadId) params.append("localidadId", String(localidadId));

      // Buster anti-cache
      params.append("_", Date.now().toString());

      const url = `${apiBase}/incidentes?${params.toString()}`;

      // console.log("🔍 Verificando incidentes en:", url);

      const response = await handleFetchRequest(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        credentials: "include",
        cache: "no-store",
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }

      const data = await response.json();

      // Verificar si este request sigue siendo válido
      if (mySeq !== requestSeq.current || !isMounted.current) return;

      // Procesar respuesta
      let incidents: any[] = [];
      if (data?.success && Array.isArray(data.data)) {
        incidents = data.data;
      } else if (Array.isArray(data)) {
        incidents = data;
      } else if (data?.data && Array.isArray(data.data)) {
        incidents = data.data;
      }

      // Filtrar solo incidentes ABIERTOS
      const activeIncidentsData = incidents.filter((inc) => inc.estado === "ABIERTO");

      // Adaptar incidentes
      const adaptedIncidents = activeIncidentsData.map(adaptIncidente);

      // Detectar nuevos IDs vs. últimos conocidos
      setLastIncidentIds((prevIds) => {
        const currentIds = new Set(adaptedIncidents.map((inc) => inc.id));
        const newIds = [...currentIds].filter((id) => !prevIds.has(id));

        if (newIds.length > 0) {
          setHasNewIncidents(true);

          // Llamar callback para cada nuevo incidente
          newIds.forEach((id) => {
            const incident = adaptedIncidents.find((inc) => inc.id === id);
            if (incident && onIncidentDetectedRef.current) {
              onIncidentDetectedRef.current(incident);
            }
          });
        } else if (currentIds.size === 0) {
          // Si la lista está vacía, ya no hay "nuevos" por atender
          setHasNewIncidents(false);
        }

        return currentIds;
      });

      // Actualizar estado
      setActiveIncidents(adaptedIncidents);
      setLastCheck(new Date());
    } catch (err: any) {
      if (mySeq === requestSeq.current && isMounted.current) {
        const timedOut = controller.signal.aborted;
        setError(timedOut ? "La consulta de incidentes tardó demasiado" : err?.message || "Error al consultar incidentes");
        if (!timedOut) console.error("Error en useIncidentMonitor:", err);
      }
    } finally {
      window.clearTimeout(timeoutId);
      if (requestControllerRef.current === controller) requestControllerRef.current = null;
    }
  }, [apiBase, empresaId, localidadId, getAuthHeaders, adaptIncidente, handleFetchRequest]);

  const checkIncidents = useCallback((): Promise<void> => {
    if (inFlightRequestRef.current) return inFlightRequestRef.current;

    const pendingRequest = runIncidentCheck().finally(() => {
      if (inFlightRequestRef.current === pendingRequest) inFlightRequestRef.current = null;
    });
    inFlightRequestRef.current = pendingRequest;
    return pendingRequest;
  }, [runIncidentCheck]);

  // Función para verificar ahora (manual)
  const checkNow = useCallback(async (): Promise<void> => {
    await checkIncidents();
  }, [checkIncidents]);

  // Función para marcar como vistos
  const markAsSeen = useCallback(() => {
    setHasNewIncidents(false);
  }, []);

  // Función para limpiar error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Iniciar monitoreo. El efecto de monitoreo realiza una sola consulta inicial.
  const startMonitoring = useCallback(() => {
    setIsMonitoring(true);
  }, []);

  // Detener monitoreo
  const stopMonitoring = useCallback(() => {
    setIsMonitoring(false);
    requestControllerRef.current?.abort();
  }, []);

  useEffect(() => {
    setIsMonitoring(enabled);
  }, [enabled]);

  // Una sola verificación inicial por ámbito; al cambiar de ámbito se cancela la anterior.
  useEffect(() => {
    if (enabled && isMonitoring) {
      void checkIncidents();
    }
    return () => {
      requestSeq.current += 1;
      requestControllerRef.current?.abort();
      requestControllerRef.current = null;
      inFlightRequestRef.current = null;
    };
  }, [enabled, isMonitoring, checkIncidents]);

  // Re-verificar al recuperar foco o visibilidad (p. ej., al volver a /cliente)
  useEffect(() => {
    const onFocus = () => {
      if (enabled && isMonitoring) checkIncidents();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible" && enabled && isMonitoring) {
        checkIncidents();
      }
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, isMonitoring, checkIncidents]);

  // Hook para intervalo visible (solo ejecuta cuando la pestaña está visible)
  useVisibleInterval(
    () => {
      if (enabled && isMonitoring) {
        checkIncidents();
      }
    },
    enabled && isMonitoring ? intervalMs : null
  );

  return {
    // Estado
    isMonitoring,
    lastCheck,
    error,

    // Datos
    activeIncidents,
    hasNewIncidents,

    // Acciones
    startMonitoring,
    stopMonitoring,
    checkNow,
    markAsSeen,
    clearError,
  };
}
