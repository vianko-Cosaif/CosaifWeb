/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useVisibleInterval } from "./useVisibleInterval";

/* ================= Tipos ================= */

export type IncidenteEmergente = {
  id: number;
  descripcion: string;
  estado: "ABIERTO" | "RESUELTO" | "CERRADO";
  fechaInicio: string;
  empresa?: string;
  locomotora?: string;
  origen?: string;
  destino?: string;
  movimiento?: {
    empresa?: { nombre?: string };
    locomotiveNumber?: string;
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
  apiBase = "/bff",
  intervalMs = 60000, // 1 minuto por defecto
  enabled = true,
  onIncidentDetected,
  empresaId = null,
  localidadId = null,
}: UseIncidentMonitorArgs = {}): UseIncidentMonitorReturn {
  // Estado del monitoreo
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Datos de incidentes
  const [activeIncidents, setActiveIncidents] = useState<IncidenteEmergente[]>([]);
  const [hasNewIncidents, setHasNewIncidents] = useState(false);
  const [lastIncidentIds, setLastIncidentIds] = useState<Set<number>>(new Set());

  // Referencias para control de requests
  const requestSeq = useRef(0);
  const isMounted = useRef(true);

  /* ---- Asegurar bandera de montaje correcta ---- */
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
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
      descripcion: incident.descripcion || "Sin descripción",
      estado: incident.estado || "ABIERTO",
      fechaInicio: incident.fechaInicio || new Date().toISOString(),
      empresa: movement?.empresa?.nombre || incident?.empresa,
      locomotora: movement?.locomotiveNumber || incident?.locomotora,
      origen: movement?.viaOrigen?.nombre || incident?.origen,
      destino: movement?.viaDestino?.nombre || incident?.destino,
      movimiento: movement,
      _original: incident,
    };
  }, []);

  // Función para consultar incidentes activos
  const checkIncidents = useCallback(async (): Promise<void> => {
    if (!isMounted.current) return;

    const mySeq = ++requestSeq.current;
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

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        credentials: "include",
        cache: "no-store",
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
            if (incident && onIncidentDetected) {
              onIncidentDetected(incident);
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
        setError(err?.message || "Error al consultar incidentes");
        console.error("❌ Error en useIncidentMonitor:", err);
      }
    }
  }, [apiBase, empresaId, localidadId, getAuthHeaders, adaptIncidente, onIncidentDetected]);

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

  // Iniciar monitoreo y forzar primer check inmediato (evita "nunca")
  const startMonitoring = useCallback(() => {
    setIsMonitoring(true);
    // Verificación inmediata al activar monitoreo
    Promise.resolve().then(() => checkIncidents());
  }, [checkIncidents]);

  // Detener monitoreo
  const stopMonitoring = useCallback(() => {
    setIsMonitoring(false);
  }, []);

  // Verificación inicial cuando está habilitado y monitoreando
  useEffect(() => {
    if (enabled && isMonitoring) {
      checkIncidents();
    }
  }, [enabled, isMonitoring, checkIncidents]);

  // Si lastCheck es null ("nunca"), dispara una verificación
  useEffect(() => {
    if (enabled && isMonitoring && lastCheck === null) {
      checkIncidents();
    }
  }, [enabled, isMonitoring, lastCheck, checkIncidents]);

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

  // Auto-iniciar monitoreo si está habilitado
  useEffect(() => {
    if (enabled && !isMonitoring) {
      startMonitoring();
    }
  }, [enabled, isMonitoring, startMonitoring]);

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
