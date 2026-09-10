/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useCallback, useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";
import { useAuthErrorHandler } from '@/hooks/useAuthErrorHandler';
import { useIncidentMonitor, type IncidenteEmergente } from "@/features/incidentes/useIncidentMonitor";
import { useGuidedManual } from "@/features/capacitacion";
import {
  TRAINING_INCIDENT_ID,
  useTrainingTour,
} from "@/features/capacitacion/TrainingTourContext";
import {
  useRealtimeMovimientos,
  type RealtimeMovementEvent,
} from "@/features/movimientos/useRealtimeMovimientos";
import type { RealtimeIncidentNotice } from "./RealtimeIncidentNotice";

const IncidentModal = dynamic(() => import("./IncidentModal"), { ssr: false });
const RealtimeNotice = dynamic(() => import("./RealtimeIncidentNotice"), { ssr: false });

const DEFAULT_API_BASE =
  process.env.NEXT_PUBLIC_INCIDENT_API_BASE || "/api";

/* ========== Helpers cookies/auth ========== */
const getCookie = (name: string) => {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
};

const incidentSourceQuery = (incident: IncidenteEmergente): string => {
  const original = (incident as any)?._original ?? {};
  const source = String(original?._source || (incident as any)?._source || "").toLowerCase();
  if (source !== "torreon") return "";
  const params = new URLSearchParams({ source: "torreon" });
  const localidadId =
    original?.localidadId ??
    original?.movimiento?.localidadId ??
    (incident as any)?.movimiento?.localidadId;
  if (localidadId) params.set("localidadId", String(localidadId));
  return `?${params.toString()}`;
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
    NaN
  ) || null;

const eventMatchesScope = (
  event: RealtimeMovementEvent,
  empresaId: number | null,
  localidadId: number | null
) => {
  if (event.type === "realtime.ready" || event.type === "realtime.resume") return true;
  const eventEmpresaId = Number(event.empresaId ?? NaN);
  const eventLocalidadId = Number(event.localidadId ?? NaN);

  if (empresaId && (!Number.isFinite(eventEmpresaId) || eventEmpresaId !== empresaId)) return false;
  if (localidadId && (!Number.isFinite(eventLocalidadId) || eventLocalidadId !== localidadId)) return false;
  return true;
};

const realtimeNoticeForEvent = (event: RealtimeMovementEvent) => {
  const eventType = String(event.type ?? "");
  const estado = String(event.estado ?? "").toUpperCase();
  const movementId = event.movimientoId ? `#${event.movimientoId}` : "movimiento";
  const arrastreId = event.arrastreId ? `#${event.arrastreId}` : "arrastre";
  const vagonId = event.vagonId ? ` · Vagón #${event.vagonId}` : "";
  const incidentId = event.incidenteId ? `Incidente #${event.incidenteId}` : "Incidente";
  const loco = event.locomotiveNumber ? ` · Loco ${event.locomotiveNumber}` : "";

  if (eventType.startsWith("torreon.arrastre")) {
    if (eventType.includes("incidente")) {
      return {
        title: event.accion === "resolver_incidente" ? "Incidente de arrastre resuelto" : "Incidente en arrastre",
        description: `${incidentId} · Arrastre ${arrastreId}${vagonId}`,
        tone: event.accion === "resolver_incidente" ? "emerald" as const : "rose" as const,
        icon: "incident" as const,
      };
    }

    if (eventType.endsWith(".vagon")) {
      return {
        title: event.accion === "finalizar_vagon" ? "Vagón finalizado" : "Vagón iniciado",
        description: `Arrastre ${arrastreId}${vagonId}`,
        tone: event.accion === "finalizar_vagon" ? "sky" as const : "emerald" as const,
        icon: "movement" as const,
      };
    }

    if (eventType.endsWith(".orden")) {
      return {
        title: "Orden de arrastre actualizada",
        description: event.arrastreId ? `Arrastre ${arrastreId}` : "La cola fue reorganizada",
        tone: "sky" as const,
        icon: "movement" as const,
      };
    }

    return {
      title:
        estado === "CONCLUIDO" ? "Arrastre concluido" :
        estado === "CANCELADO" ? "Arrastre cancelado" :
        eventType.endsWith(".creado") ? "Arrastre solicitado" :
        "Arrastre actualizado",
      description: `Arrastre ${arrastreId}`,
      tone: estado === "CANCELADO" ? "rose" as const : estado === "CONCLUIDO" ? "emerald" as const : "sky" as const,
      icon: "movement" as const,
    };
  }

  if (eventType.startsWith("torreon.movimiento") || eventType === "torreon.incidente.estado") {
    if (eventType.includes("incidente") || eventType === "torreon.incidente.estado") {
      return {
        title: eventType === "torreon.incidente.estado" ? "Incidente Torreón actualizado" : "Incidente en Torreón",
        description: `${incidentId} en ${movementId}${loco}`,
        tone: eventType === "torreon.incidente.estado" && (estado === "RESUELTO" || estado === "CERRADO") ? "emerald" as const : "rose" as const,
        icon: "incident" as const,
      };
    }

    return {
      title:
        eventType.endsWith(".creado") ? "Movimiento Torreón creado" :
        estado === "CONCLUIDO" ? "Movimiento Torreón concluido" :
        estado === "EN_PROCESO" ? "Movimiento Torreón iniciado" :
        "Movimiento Torreón actualizado",
      description: `${movementId}${loco}`,
      tone: estado === "CONCLUIDO" ? "sky" as const : "emerald" as const,
      icon: "movement" as const,
    };
  }

  if (event.type === "movimiento.creado") {
    return {
      title: "Movimiento creado",
      description: `${movementId}${loco}`,
      tone: "sky" as const,
      icon: "movement" as const,
    };
  }

  if (event.type === "movimiento.incidente") {
    return {
      title: "Incidente reportado",
      description: `${incidentId} en ${movementId}${loco}`,
      tone: "rose" as const,
      icon: "incident" as const,
    };
  }

  if (event.type === "incidente.estado") {
    if (estado === "RESUELTO" || estado === "CERRADO") {
      return {
        title: estado === "RESUELTO" ? "Incidente resuelto" : "Incidente cerrado sin resolución",
        description: `${incidentId} en ${movementId}${loco}`,
        tone: "emerald" as const,
        icon: "incident" as const,
      };
    }

    return {
      title: "Incidente actualizado",
      description: `${incidentId} en ${movementId}${loco}`,
      tone: "amber" as const,
      icon: "incident" as const,
    };
  }

  if (estado === "EN_PROCESO") {
    return {
      title: "Movimiento en proceso",
      description: `${movementId}${loco}`,
      tone: "emerald" as const,
      icon: "movement" as const,
    };
  }

  if (estado === "CONCLUIDO") {
    return {
      title: "Movimiento concluido",
      description: `${movementId}${loco}`,
      tone: "sky" as const,
      icon: "movement" as const,
    };
  }

  if (estado === "CANCELADO") {
    return {
      title: "Movimiento cancelado",
      description: `${movementId}${loco}`,
      tone: "rose" as const,
      icon: "movement" as const,
    };
  }

  return null;
};

function showBrowserRealtimeNotification(params: {
  id: string;
  title: string;
  body: string;
  url?: string;
}) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  try {
    const options: NotificationOptions & Record<string, unknown> = {
      body: params.body,
      icon: "/icons/cosaif-192.png",
      badge: "/icons/cosaif-192.png",
      tag: params.id,
      renotify: true,
      requireInteraction: true,
      data: { url: params.url ?? "/" },
    };
    const notification = new Notification(params.title, options);
    notification.onclick = (event) => {
      event.preventDefault();
      window.focus();
      window.location.assign(params.url ?? "/");
    };
  } catch (error) {
    console.warn("No se pudo mostrar notificacion del navegador.", error);
  }
}

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
  const [processedIncidents, setProcessedIncidents] = useState<Set<number>>(new Set());
  const [realtimeNotice, setRealtimeNotice] = useState<RealtimeIncidentNotice | null>(null);

  const realtimeCheckTimerRef = useRef<number | null>(null);
  const browserNoticeIdsRef = useRef<Set<string>>(new Set());

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
          setCurrentIncident(incident);
          setIsModalOpen(true);
        }
      }
    },
    [processedIncidents, empresaId, autoOpenNewIncidents]
  );

  const { isMonitoring, lastCheck, error, activeIncidents, checkNow, checkIfStale } = useIncidentMonitor({
    apiBase,
    intervalMs,
    enabled: effectiveEnabled,
    empresaId,        // ya filtra por empresa en el polling
    localidadId,
    onIncidentDetected: handleNewIncident,
  });

  const trainingAlertStep = Boolean(
    trainingTour.active && guidedManual?.currentStep?.id?.startsWith("tour-incident-alert")
  );

  useEffect(() => {
    if (!trainingAlertStep) return;
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
    setRealtimeNotice(null);
    if (currentIncident && currentIncident.id !== TRAINING_INCIDENT_ID) {
      setCurrentIncident(null);
      setIsModalOpen(false);
    }
  }, [currentIncident, trainingTour.active]);

  const activeCount = trainingTour.active
    ? 0
    : Array.isArray(activeIncidents) ? activeIncidents.length : 0;

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("cosaif:incident-monitor-status", {
      detail: {
        activeCount,
        // El monitor productivo se pausa intencionalmente durante la
        // capacitación. No lo presentamos como una falla de conexión.
        connected: trainingTour.active || (isMonitoring && !error),
        lastCheck: lastCheck?.toISOString() ?? null,
      },
    }));
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

      if (String(event.type ?? "").startsWith("torreon.")) {
        const notice = realtimeNoticeForEvent(event);
        if (notice) {
          const id = event.eventId ?? `${event.type}:${event.arrastreId}:${event.movimientoId}:${event.vagonId}:${event.incidenteId}:${event.estado}:${Date.now()}`;
          if (document.visibilityState === "visible") {
            setRealtimeNotice({ ...notice, id });
          }
          if (!browserNoticeIdsRef.current.has(id)) {
            browserNoticeIdsRef.current.add(id);
            if (browserNoticeIdsRef.current.size > 500) {
              const oldestId = browserNoticeIdsRef.current.values().next().value;
              if (oldestId !== undefined) browserNoticeIdsRef.current.delete(oldestId);
            }
            const type = String(event.type ?? "");
            showBrowserRealtimeNotification({
              id,
              title: notice.title,
              body: notice.description,
              url: type.includes("incidente") ? "/incidentes?source=torreon" : "/cliente/torreon/movimientos",
            });
          }
        }
        if (String(event.type ?? "").includes("incidente")) scheduleRealtimeIncidentCheck();
        return;
      }

      if (event.type === "movimiento.incidente" || event.type === "incidente.estado") {
        const notice = realtimeNoticeForEvent(event);
        if (notice) {
          const id = event.eventId ?? `${event.type}:${event.movimientoId}:${event.incidenteId}:${event.estado}:${Date.now()}`;
          if (document.visibilityState === "visible") {
            setRealtimeNotice({ ...notice, id });
          }
          if (!browserNoticeIdsRef.current.has(id)) {
            browserNoticeIdsRef.current.add(id);
            if (browserNoticeIdsRef.current.size > 500) {
              const oldestId = browserNoticeIdsRef.current.values().next().value;
              if (oldestId !== undefined) browserNoticeIdsRef.current.delete(oldestId);
            }
            showBrowserRealtimeNotification({
              id,
              title: notice.title,
              body: notice.description,
              url: "/incidentes",
            });
          }
        }
        scheduleRealtimeIncidentCheck();
        return;
      }

      if (event.type === "movimiento.creado" || event.type === "movimiento.estado") {
        const notice = realtimeNoticeForEvent(event);
        if (notice) {
          const id = event.eventId ?? `${event.type}:${event.movimientoId}:${event.estado}:${Date.now()}`;
          if (document.visibilityState === "visible") {
            setRealtimeNotice({ ...notice, id });
          }
          if (!browserNoticeIdsRef.current.has(id)) {
            browserNoticeIdsRef.current.add(id);
            if (browserNoticeIdsRef.current.size > 500) {
              const oldestId = browserNoticeIdsRef.current.values().next().value;
              if (oldestId !== undefined) browserNoticeIdsRef.current.delete(oldestId);
            }
            showBrowserRealtimeNotification({
              id,
              title: notice.title,
              body: notice.description,
              url: "/movimientos",
            });
          }
        }
      }
    },
  });

  useEffect(() => {
    if (!realtimeNotice) return;
    const timer = window.setTimeout(() => setRealtimeNotice(null), 6000);
    return () => clearTimeout(timer);
  }, [realtimeNotice]);

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
        const response = await handleFetchRequest(`${apiBase}/incidentes/${incident.id}/resuelto${incidentSourceQuery(incident)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ estado: "RESUELTO", comentario: comments }),
        });
        if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
        setProcessedIncidents((prev) => new Set(prev).add(incident.id));
        setIsModalOpen(false);
        setCurrentIncident(null);
        onIncidentResolved?.(incident);
      } catch (err) {
        console.error("Error al resolver incidente:", err);
        alert("No se pudo resolver el incidente. Inténtalo de nuevo.");
      }
    },
    [apiBase, onIncidentResolved, handleFetchRequest, trainingTour]
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
        const response = await handleFetchRequest(`${apiBase}/incidentes/${incident.id}/cerrar${incidentSourceQuery(incident)}`, {
          method: "POST",
          credentials: "include",
        });
        if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
        setProcessedIncidents((prev) => new Set(prev).add(incident.id));
        setIsModalOpen(false);
        setCurrentIncident(null);
        onIncidentSkipped?.(incident);
      } catch (err) {
        console.error("Error al omitir incidente:", err);
        alert("No se pudo omitir el incidente. Inténtalo de nuevo.");
      }
    },
    [apiBase, onIncidentSkipped, handleFetchRequest, trainingTour]
  );

  const handleContinue = useCallback(
    (incident: IncidenteEmergente) => {
      setProcessedIncidents((prev) => new Set(prev).add(incident.id));
      setIsModalOpen(false);
      setCurrentIncident(null);
      onIncidentContinued?.(incident);
    },
    [onIncidentContinued]
  );

  const handleClose = useCallback(() => {
    setIsModalOpen(false);
    setCurrentIncident(null);
  }, []);

  useEffect(() => {
    setProcessedIncidents(new Set());
  }, [empresaId, localidadId]);

  return (
    <>
      {realtimeNotice && <RealtimeNotice key={realtimeNotice.id} notice={realtimeNotice} />}

      {currentIncident && (
        <IncidentModal
          incident={currentIncident}
          isOpen={isModalOpen}
          onClose={handleClose}
          onResolve={handleResolve}
          onSkip={handleSkip}
          onContinue={handleContinue}
          countdownEnabled={countdownEnabled}
        />
      )}

    </>
  );
}
