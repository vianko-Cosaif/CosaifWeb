/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useIncidentMonitor, type IncidenteEmergente } from "@/app/hooks/useIncidentMonitor";
import IncidentModal from "./IncidentModal";

/* ================= Tipos ================= */
interface IncidentMonitorProps {
  apiBase?: string;
  intervalMs?: number;
  enabled?: boolean;
  empresaId?: number | null;
  localidadId?: number | null;
  onIncidentResolved?: (incident: IncidenteEmergente) => void;
  onIncidentSkipped?: (incident: IncidenteEmergente) => void;
  onIncidentContinued?: (incident: IncidenteEmergente) => void;
}

/* ================= Componente Principal ================= */
export default function IncidentMonitor({
  apiBase = "/bff",
  intervalMs = 60000, // 1 minuto
  enabled = true,
  empresaId = null,
  localidadId = null,
  onIncidentResolved,
  onIncidentSkipped,
  onIncidentContinued,
}: IncidentMonitorProps) {
  const [currentIncident, setCurrentIncident] = useState<IncidenteEmergente | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [processedIncidents, setProcessedIncidents] = useState<Set<number>>(new Set());

  // Función para manejar nuevos incidentes
  const handleNewIncident = useCallback((incident: IncidenteEmergente) => {
    console.log("🔔 Nuevo incidente detectado:", incident); // Debug log
    
    // Solo mostrar si no hemos procesado este incidente antes
    if (!processedIncidents.has(incident.id)) {
      console.log("📋 Mostrando modal para incidente:", incident.id); // Debug log
      setCurrentIncident(incident);
      setIsModalOpen(true);
    } else {
      console.log("⏭️ Incidente ya procesado, omitiendo:", incident.id); // Debug log
    }
  }, [processedIncidents]);

  // Hook para monitorear incidentes
  const {
    isMonitoring,
    lastCheck,
    error,
    activeIncidents,
    hasNewIncidents,
    startMonitoring,
    stopMonitoring,
    checkNow,
    markAsSeen,
    clearError,
  } = useIncidentMonitor({
    apiBase,
    intervalMs,
    enabled,
    empresaId,
    localidadId,
    onIncidentDetected: handleNewIncident,
  });

  // Función para manejar resolución de incidente
  const handleResolve = useCallback(async (incident: IncidenteEmergente, comments?: string) => {
    try {
      // Aquí puedes hacer la llamada a la API para resolver el incidente
      const response = await fetch(`${apiBase}/incidentes/${incident.id}/resuelto`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        credentials: "include",
        body: JSON.stringify({
          estado: "RESUELTO",
          comentario: comments,
        }),
      });

      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }

      // Marcar como procesado
      setProcessedIncidents(prev => new Set([...prev, incident.id]));
      setIsModalOpen(false);
      setCurrentIncident(null);
      
      // Llamar callback
      if (onIncidentResolved) {
        onIncidentResolved(incident);
      }
    } catch (error) {
      console.error("Error al resolver incidente:", error);
      alert("No se pudo resolver el incidente. Inténtalo de nuevo.");
    }
  }, [apiBase, onIncidentResolved]);

  // Función para manejar omisión de incidente
  const handleSkip = useCallback(async (incident: IncidenteEmergente) => {
    try {
      // Aquí puedes hacer la llamada a la API para cerrar el incidente
      const response = await fetch(`${apiBase}/incidentes/${incident.id}/cerrar`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
        },
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }

      // Marcar como procesado
      setProcessedIncidents(prev => new Set([...prev, incident.id]));
      setIsModalOpen(false);
      setCurrentIncident(null);
      
      // Llamar callback
      if (onIncidentSkipped) {
        onIncidentSkipped(incident);
      }
    } catch (error) {
      console.error("Error al omitir incidente:", error);
      alert("No se pudo omitir el incidente. Inténtalo de nuevo.");
    }
  }, [apiBase, onIncidentSkipped]);

  // Función para manejar continuación
  const handleContinue = useCallback((incident: IncidenteEmergente) => {
    // Marcar como procesado temporalmente (se volverá a mostrar si hay cambios)
    setProcessedIncidents(prev => new Set([...prev, incident.id]));
    setIsModalOpen(false);
    setCurrentIncident(null);
    
    // Llamar callback
    if (onIncidentContinued) {
      onIncidentContinued(incident);
    }
  }, [onIncidentContinued]);

  // Función para cerrar modal
  const handleClose = useCallback(() => {
    setIsModalOpen(false);
    setCurrentIncident(null);
  }, []);

  // Función para obtener headers de autenticación
  const getAuthHeaders = useCallback((): HeadersInit => {
    if (typeof document === "undefined") return {};
    const match = document.cookie.match(/(?:^|;\s*)token=([^;]+)/);
    return match ? { Authorization: `Bearer ${decodeURIComponent(match[1])}` } : {};
  }, []);

  // Limpiar incidentes procesados cuando cambien los filtros
  useEffect(() => {
    setProcessedIncidents(new Set());
  }, [empresaId, localidadId]);

  // Mostrar información de debug en desarrollo
  if (process.env.NODE_ENV === "development") {
    console.log("IncidentMonitor estado:", {
      isMonitoring,
      lastCheck,
      error,
      activeIncidentsCount: activeIncidents.length,
      hasNewIncidents,
      currentIncident: currentIncident?.id,
      isModalOpen,
    });
  }

  return (
    <>
      {/* Modal de incidente */}
      {currentIncident && (
        <IncidentModal
          incident={currentIncident}
          isOpen={isModalOpen}
          onClose={handleClose}
          onResolve={handleResolve}
          onSkip={handleSkip}
          onContinue={handleContinue}
        />
      )}

      {/* Indicador de estado (opcional, para debug) */}
      {process.env.NODE_ENV === "development" && (
        <div className="fixed bottom-4 right-4 z-40 rounded-lg bg-slate-800 text-white p-3 text-xs max-w-xs">
          <div className="space-y-2">
            <div className="font-semibold text-green-400">🔍 Monitor de Incidentes</div>
            <div>Estado: {isMonitoring ? " Activo" : " Inactivo"}</div>
            <div>Última verificación: {lastCheck?.toLocaleTimeString() || "Nunca"}</div>
            <div>Incidentes activos: {activeIncidents.length}</div>
            <div>Nuevos incidentes: {hasNewIncidents ? "🆕 Sí" : "❌ No"}</div>
            {error && <div className="text-red-400">❌ Error: {error}</div>}
            <div className="text-xs text-slate-400">
              Empresa: {empresaId || "Todas"} | Localidad: {localidadId || "Todas"}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
