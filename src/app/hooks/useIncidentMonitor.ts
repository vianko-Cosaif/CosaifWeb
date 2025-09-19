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
  intervalMs?: number; // Intervalo en milisegundos, por defecto 60000 (1 minuto)
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
  intervalMs = 5000, // 5 segundos por defecto
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

      const url = `${apiBase}/incidentes?${params.toString()}`;

      console.log("🔍 Verificando incidentes en:", url); // Debug log

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

      console.log("📊 Respuesta de incidentes:", data); // Debug log

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
      const activeIncidentsData = incidents.filter(inc => inc.estado === "ABIERTO");

      console.log("🚨 Incidentes activos encontrados:", activeIncidentsData.length); // Debug log

      // Adaptar incidentes
      const adaptedIncidents = activeIncidentsData.map(adaptIncidente);

      // Obtener IDs actuales para comparar
      setLastIncidentIds(prevIds => {
        const currentIds = new Set(adaptedIncidents.map(inc => inc.id));
        const newIds = [...currentIds].filter(id => !prevIds.has(id));

        console.log("🆕 Nuevos incidentes detectados:", newIds.length); // Debug log

        if (newIds.length > 0) {
          setHasNewIncidents(true);

          // Llamar callback para cada nuevo incidente
          newIds.forEach(id => {
            const incident = adaptedIncidents.find(inc => inc.id === id);
            if (incident && onIncidentDetected) {
              console.log("🔔 Llamando callback para incidente:", incident.id); // Debug log
              onIncidentDetected(incident);
            }
          });
        } else if (currentIds.size === 0) {
          // Si no hay nuevos IDs Y la lista actual de incidentes está vacía,
          // entonces ya no hay "nuevos incidentes" que atender.
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

  // Función para iniciar monitoreo
  const startMonitoring = useCallback(() => {
    setIsMonitoring(true);
  }, []);

  // Función para detener monitoreo
  const stopMonitoring = useCallback(() => {
    setIsMonitoring(false);
  }, []);

  // Efecto para verificación inicial inmediata
  useEffect(() => {
    if (enabled && isMonitoring) {
      console.log("🚀 Iniciando verificación de incidentes..."); // Debug log
      checkIncidents();
    }
  }, [enabled, isMonitoring, checkIncidents]);

  // Hook para intervalo visible (solo ejecuta cuando la pestaña está visible)
  useVisibleInterval(
    () => {
      if (enabled && isMonitoring) {
        console.log("⏰ Verificación periódica de incidentes..."); // Debug log
        checkIncidents();
      }
    },
    enabled && isMonitoring ? intervalMs : null
  );

  // Auto-iniciar monitoreo si está habilitado
  useEffect(() => {
    if (enabled && !isMonitoring) {
      console.log("🔄 Auto-iniciando monitoreo de incidentes..."); // Debug log
      startMonitoring();
    }
  }, [enabled, isMonitoring, startMonitoring]);

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

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
