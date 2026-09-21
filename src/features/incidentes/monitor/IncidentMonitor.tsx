/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useCallback, useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";
import { useAuthErrorHandler } from "@/hooks/useAuthErrorHandler";
import {
  useIncidentMonitor,
  type IncidenteEmergente,
} from "@/features/incidentes/useIncidentMonitor";
import { useGuidedManual } from "@/features/capacitacion";
import { TRAINING_INCIDENT_ID, useTrainingTour } from "@/features/capacitacion/TrainingTourContext";
import {
  useRealtimeMovimientos,
  type RealtimeMovementEvent,
} from "@/features/movimientos/useRealtimeMovimientos";
import { fetchTorreonIncidentDetail } from "@/features/torreon/incidents/incidentDetail";
import {
  torreonIncidentRequest,
  torreonIncidentSourceQuery,
  withTorreonIncidentDetail,
} from "./torreonIncidentDetail";

const IncidentModal = dynamic(() => import("./IncidentModal"), { ssr: false });

const DEFAULT_API_BASE = process.env.NEXT_PUBLIC_INCIDENT_API_BASE || "/api";

/* ========== Helpers cookies/auth ========== */
const getCookie = (name: string) => {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
};

/** empresaId tolerante a typos comunes en cookie */
const getEmpresaIdFromCookie = (): number | null => {
  const raw = getCookie("empresaId") ?? getCookie("empresald") ?? getCookie("empresaID");
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
};

/** intenta leer empresaId del incidente en distintas formas */
const getIncidentEmpresaId = (inc: any): number | null =>
  Number(
    inc?.empresaId ??
      inc?.empresa?.id ??
      inc?.movimiento?.empresa?.id ??
      inc?._original?.empresaId ??
      inc?._original?.movimiento?.empresa?.id ??
      NaN,
  ) || null;

const eventMatchesScope = (
  event: RealtimeMovementEvent,
  empresaId: number | null,
  localidadId: number | null,
) => {
  if (event.type === "realtime.ready" || event.type === "realtime.resume") return true;
  const eventEmpresaId = Number(event.empresaId ?? NaN);
  const eventLocalidadId = Number(event.localidadId ?? NaN);

  if (empresaId && (!Number.isFinite(eventEmpresaId) || eventEmpresaId !== empresaId)) return false;
  if (localidadId && (!Number.isFinite(eventLocalidadId) || eventLocalidadId !== localidadId))
    return false;
  return true;
};

/* ========== Tipos ========== */
interface IncidentMonitorProps {
  apiBase?: string;
  intervalMs?: number;
  enabled?: boolean;
  empresaId?: number | null;
  localidadId?: number | null;
  onIncidentResolved?: (incident: IncidenteEmergente) => void;
  onIncidentSkipped?: (incident: IncidenteEmergente) => void;
  onIncidentContinued?: (incident: IncidenteEmergente) => void;
  autoOpenNewIncidents?: boolean;
  countdownEnabled?: boolean;
}

/* ========== Componente ========== */
export default function IncidentMonitor({
  apiBase = DEFAULT_API_BASE,
  intervalMs = 120000, // 2 minutos
  enabled = true,
  empresaId: empresaIdProp = null,
  localidadId = null,
  onIncidentResolved,
  onIncidentSkipped,
  onIncidentContinued,
  autoOpenNewIncidents = true,
  countdownEnabled = true,
}: IncidentMonitorProps) {
  const trainingTour = useTrainingTour();
  const guidedManual = useGuidedManual();
  const effectiveEnabled = enabled && !trainingTour.active;
  // Keep first client render identical to SSR; resolve cookie-based fallback after mount.
  const [empresaId, setEmpresaId] = useState<number | null>(empresaIdProp ?? null);

  const { handleFetchRequest } = useAuthErrorHandler();

  const [currentIncident, setCurrentIncident] = useState<IncidenteEmergente | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loadingImages, setLoadingImages] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [processedIncidents, setProcessedIncidents] = useState<Set<number>>(new Set());

  const realtimeCheckTimerRef = useRef<number | null>(null);
  const incidentDetailControllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => incidentDetailControllerRef.current?.abort(), []);

  useEffect(() => {
    setEmpresaId(empresaIdProp ?? getEmpresaIdFromCookie());
  }, [empresaIdProp]);

  /* ---- Nuevo: validar empresa antes de abrir modal ---- */
  const handleNewIncident = useCallback(
    (incident: IncidenteEmergente) => {
      const userEmp = empresaId ?? getEmpresaIdFromCookie();
      const incEmp = getIncidentEmpresaId(incident);

      if (userEmp && incEmp && userEmp !== incEmp) {
        setProcessedIncidents((prev) => new Set(prev).add(incident.id)); // marcar y no mostrar
        return;
      }
      if (!processedIncidents.has(incident.id)) {
        if (autoOpenNewIncidents) {
          incidentDetailControllerRef.current?.abort();
          setCurrentIncident(incident);
          setIsModalOpen(true);
          setImageError(null);
          const request = torreonIncidentRequest(incident, localidadId);
          setLoadingImages(Boolean(request));
          if (request) {
            const controller = new AbortController();
            incidentDetailControllerRef.current = controller;
            void fetchTorreonIncidentDetail(request, controller.signal)
              .then((detail) => {
                if (controller.signal.aborted) return;
                setCurrentIncident((current) =>
                  current?.id === incident.id ? withTorreonIncidentDetail(current, detail) : current,
                );
                setLoadingImages(false);
              })
              .catch((error: unknown) => {
                if (controller.signal.aborted) return;
                setImageError(error instanceof Error ? error.message : "No se pudieron cargar las imágenes.");
                setLoadingImages(false);
              })
              .finally(() => {
                if (incidentDetailControllerRef.current === controller) incidentDetailControllerRef.current = null;
              });
          }
        }
      }
    },
    [processedIncidents, empresaId, autoOpenNewIncidents, localidadId],
  );

  const { isMonitoring, lastCheck, error, activeIncidents, checkNow, checkIfStale } =
    useIncidentMonitor({
      apiBase,
      intervalMs,
      enabled: effectiveEnabled,
      empresaId, // ya filtra por empresa en el polling
      localidadId,
      onIncidentDetected: handleNewIncident,
    });

  const trainingAlertStep = Boolean(
    trainingTour.active && guidedManual?.currentStep?.id?.startsWith("tour-incident-alert"),
  );

  useEffect(() => {
    if (!trainingAlertStep) return;
    incidentDetailControllerRef.current?.abort();
    setLoadingImages(false);
    setImageError(null);
    setCurrentIncident({
      id: TRAINING_INCIDENT_ID,
      descripcion: "SIM-INC-041 · Obstáculo detectado en la vía de capacitación",
      estado: "ABIERTO",
      fechaInicio: new Date().toISOString(),
      empresa: "Empresa de capacitación",
      locomotora: "SIM-L204",
      origen: "Vía 2",
      destino: "Vía 4",
      imagenes: [],
    });
    setIsModalOpen(true);
  }, [trainingAlertStep]);

  useEffect(() => {
    if (!trainingTour.active) return;
    if (currentIncident && currentIncident.id !== TRAINING_INCIDENT_ID) {
      setCurrentIncident(null);
      setIsModalOpen(false);
    }
  }, [currentIncident, trainingTour.active]);

  const activeCount = trainingTour.active
    ? 0
    : Array.isArray(activeIncidents)
      ? activeIncidents.length
      : 0;

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("cosaif:incident-monitor-status", {
        detail: {
          activeCount,
          // El monitor productivo se pausa intencionalmente durante la
          // capacitación. No lo presentamos como una falla de conexión.
          connected: trainingTour.active || (isMonitoring && !error),
          lastCheck: lastCheck?.toISOString() ?? null,
        },
      }),
    );
  }, [activeCount, error, isMonitoring, lastCheck, trainingTour.active]);

  const scheduleRealtimeIncidentCheck = useCallback(() => {
    if (document.visibilityState !== "visible") return;
    if (realtimeCheckTimerRef.current != null) return;

    const jitterMs = 500 + Math.floor(Math.random() * 1_500);
    realtimeCheckTimerRef.current = window.setTimeout(() => {
      realtimeCheckTimerRef.current = null;
      if (document.visibilityState === "visible") void checkNow();
    }, jitterMs);
  }, [checkNow]);

  useRealtimeMovimientos({
    enabled: effectiveEnabled,
    localidadId,
    onEvent: (event) => {
      if (!eventMatchesScope(event, empresaId, localidadId)) return;

      if (event.type === "realtime.ready" || event.type === "realtime.resume") {
        if (document.visibilityState === "visible") void checkIfStale();
        return;
      }

      // El centro de actividad es el único presentador de eventos realtime.
      // Este monitor sólo actualiza incidentes y conserva sus acciones/modal.
      if (String(event.type ?? "").includes("incidente")) scheduleRealtimeIncidentCheck();
    },
  });

  useEffect(() => {
    return () => {
      if (realtimeCheckTimerRef.current != null) {
        clearTimeout(realtimeCheckTimerRef.current);
        realtimeCheckTimerRef.current = null;
      }
    };
  }, [effectiveEnabled, empresaId, localidadId]);

  const handleResolve = useCallback(
    async (incident: IncidenteEmergente, comments?: string) => {
      try {
        if (trainingTour.active) {
          if (incident.id !== TRAINING_INCIDENT_ID) {
            alert("En capacitación no se puede modificar una alerta real.");
            return;
          }
          trainingTour.resolveIncident("resolve", comments);
          setProcessedIncidents((prev) => new Set(prev).add(incident.id));
          setIsModalOpen(false);
          setCurrentIncident(null);
          onIncidentResolved?.(incident);
          return;
        }
        const sourceQuery = torreonIncidentSourceQuery(incident, localidadId);
        const response = await handleFetchRequest(
          `${sourceQuery ? "/api" : apiBase}/incidentes/${incident.id}/resuelto${sourceQuery}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ estado: "RESUELTO", comentario: comments }),
          },
        );
        if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
        incidentDetailControllerRef.current?.abort();
        setProcessedIncidents((prev) => new Set(prev).add(incident.id));
        setIsModalOpen(false);
        setCurrentIncident(null);
        onIncidentResolved?.(incident);
      } catch (err) {
        console.error("Error al resolver incidente:", err);
        alert("No se pudo resolver el incidente. Inténtalo de nuevo.");
      }
    },
    [apiBase, onIncidentResolved, handleFetchRequest, trainingTour, localidadId],
  );

  const handleSkip = useCallback(
    async (incident: IncidenteEmergente) => {
      try {
        if (trainingTour.active) {
          if (incident.id !== TRAINING_INCIDENT_ID) {
            alert("En capacitación no se puede cerrar una alerta real.");
            return;
          }
          // Esta primera simulación enseña el cierre sin resolver, pero se
          // reinicia inmediatamente para que el usuario también practique la
          // resolución desde la bandeja en los pasos siguientes.
          setProcessedIncidents((prev) => new Set(prev).add(incident.id));
          setIsModalOpen(false);
          setCurrentIncident(null);
          onIncidentSkipped?.(incident);
          return;
        }
        const sourceQuery = torreonIncidentSourceQuery(incident, localidadId);
        const response = await handleFetchRequest(
          `${sourceQuery ? "/api" : apiBase}/incidentes/${incident.id}/cerrar${sourceQuery}`,
          {
            method: "POST",
            credentials: "include",
          },
        );
        if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
        incidentDetailControllerRef.current?.abort();
        setProcessedIncidents((prev) => new Set(prev).add(incident.id));
        setIsModalOpen(false);
        setCurrentIncident(null);
        onIncidentSkipped?.(incident);
      } catch (err) {
        console.error("Error al omitir incidente:", err);
        alert("No se pudo omitir el incidente. Inténtalo de nuevo.");
      }
    },
    [apiBase, onIncidentSkipped, handleFetchRequest, trainingTour, localidadId],
  );

  const handleContinue = useCallback(
    (incident: IncidenteEmergente) => {
      incidentDetailControllerRef.current?.abort();
      setProcessedIncidents((prev) => new Set(prev).add(incident.id));
      setIsModalOpen(false);
      setCurrentIncident(null);
      onIncidentContinued?.(incident);
    },
    [onIncidentContinued],
  );

  const handleClose = useCallback(() => {
    incidentDetailControllerRef.current?.abort();
    setLoadingImages(false);
    setIsModalOpen(false);
    setCurrentIncident(null);
  }, []);

  useEffect(() => {
    setProcessedIncidents(new Set());
  }, [empresaId, localidadId]);

  return (
    <>
      {currentIncident && (
        <IncidentModal
          incident={currentIncident}
          isOpen={isModalOpen}
          onClose={handleClose}
          onResolve={handleResolve}
          onSkip={handleSkip}
          onContinue={handleContinue}
          countdownEnabled={countdownEnabled}
          loadingImages={loadingImages}
          imageError={imageError}
        />
      )}
    </>
  );
}
