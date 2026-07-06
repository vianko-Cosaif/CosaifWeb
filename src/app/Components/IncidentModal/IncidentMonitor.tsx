/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useCallback, useEffect, useState, useRef } from "react";
import { useAuthErrorHandler } from '@/app/hooks/useAuthErrorHandler';
import { useIncidentMonitor, type IncidenteEmergente } from "@/app/hooks/useIncidentMonitor";
import {
  useRealtimeMovimientos,
  type RealtimeMovementEvent,
} from "@/app/hooks/useRealtimeMovimientos";
import IncidentModal from "./IncidentModal";
import { motion, AnimatePresence } from "framer-motion";
import { Maximize2, Minimize2, GripHorizontal, Activity, AlertTriangle } from "lucide-react";

const DEFAULT_API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL || "/bff";

/* ========== Helpers cookies/auth ========== */
const getCookie = (name: string) => {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
};

const getAuthHeaders = (): HeadersInit => {
  const token = getCookie("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
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
  const eventEmpresaId = Number(event.empresaId ?? NaN);
  const eventLocalidadId = Number(event.localidadId ?? NaN);

  if (empresaId && Number.isFinite(eventEmpresaId) && eventEmpresaId !== empresaId) return false;
  if (localidadId && Number.isFinite(eventLocalidadId) && eventLocalidadId !== localidadId) return false;
  return true;
};

const realtimeNoticeForEvent = (event: RealtimeMovementEvent) => {
  const estado = String(event.estado ?? "").toUpperCase();
  const movementId = event.movimientoId ? `#${event.movimientoId}` : "movimiento";
  const incidentId = event.incidenteId ? `Incidente #${event.incidenteId}` : "Incidente";
  const loco = event.locomotiveNumber ? ` · Loco ${event.locomotiveNumber}` : "";

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
        title: estado === "RESUELTO" ? "Incidente resuelto" : "Incidente cerrado",
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

const realtimeNoticeToneClass = (tone: "emerald" | "sky" | "rose" | "amber") => {
  if (tone === "emerald") {
    return "border-emerald-200 text-emerald-800 dark:border-emerald-800 dark:text-emerald-200";
  }
  if (tone === "sky") {
    return "border-sky-200 text-sky-800 dark:border-sky-800 dark:text-sky-200";
  }
  if (tone === "amber") {
    return "border-amber-200 text-amber-800 dark:border-amber-800 dark:text-amber-200";
  }
  return "border-rose-200 text-rose-800 dark:border-rose-800 dark:text-rose-200";
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
  mobileMaxWidth?: number;
  autoOpenNewIncidents?: boolean;
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
  mobileMaxWidth = 768,
  autoOpenNewIncidents = true,
}: IncidentMonitorProps) {
  // Keep first client render identical to SSR; resolve cookie-based fallback after mount.
  const [empresaId, setEmpresaId] = useState<number | null>(empresaIdProp ?? null);

  const { handleFetchRequest } = useAuthErrorHandler();

  const [currentIncident, setCurrentIncident] = useState<IncidenteEmergente | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [processedIncidents, setProcessedIncidents] = useState<Set<number>>(new Set());
  const [isMobile, setIsMobile] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [realtimeNotice, setRealtimeNotice] = useState<{
    id: string;
    title: string;
    description: string;
    tone: "emerald" | "sky" | "rose" | "amber";
    icon: "movement" | "incident";
  } | null>(null);

  // Floating widget state
  const [isMinimized, setIsMinimized] = useState(false);
  const constraintsRef = useRef(null);
  const realtimeCheckTimerRef = useRef<number | null>(null);
  const browserNoticeIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setEmpresaId(empresaIdProp ?? getEmpresaIdFromCookie());
  }, [empresaIdProp]);

  useEffect(() => {
    const check = () => setIsMobile(typeof window !== "undefined" && window.innerWidth <= mobileMaxWidth);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [mobileMaxWidth]);

  useEffect(() => {
    if (!isMobile) setIsSheetOpen(false);
  }, [isMobile]);

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

  const { isMonitoring, lastCheck, error, activeIncidents, checkNow } = useIncidentMonitor({
    apiBase,
    intervalMs,
    enabled,
    empresaId,        // ya filtra por empresa en el polling
    localidadId,
    onIncidentDetected: handleNewIncident,
  });

  const activeCount = Array.isArray(activeIncidents) ? activeIncidents.length : 0;

  const scheduleRealtimeIncidentCheck = useCallback(() => {
    if (typeof window === "undefined") return;
    if (realtimeCheckTimerRef.current != null) return;

    const jitterMs = 500 + Math.floor(Math.random() * 1_500);
    realtimeCheckTimerRef.current = window.setTimeout(() => {
      realtimeCheckTimerRef.current = null;
      checkNow();
    }, jitterMs);
  }, [checkNow]);

  useRealtimeMovimientos({
    enabled,
    localidadId,
    onEvent: (event) => {
      if (!eventMatchesScope(event, empresaId, localidadId)) return;

      if (event.type === "realtime.ready" || event.type === "realtime.resume") {
        scheduleRealtimeIncidentCheck();
        return;
      }

      if (event.type === "movimiento.incidente" || event.type === "incidente.estado") {
        const notice = realtimeNoticeForEvent(event);
        if (notice) {
          const id = event.eventId ?? `${event.type}:${event.movimientoId}:${event.incidenteId}:${event.estado}:${Date.now()}`;
          setRealtimeNotice({
            ...notice,
            id,
          });
          if (!browserNoticeIdsRef.current.has(id)) {
            browserNoticeIdsRef.current.add(id);
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
          setRealtimeNotice({
            ...notice,
            id,
          });
          if (!browserNoticeIdsRef.current.has(id)) {
            browserNoticeIdsRef.current.add(id);
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
      }
    };
  }, []);

  const handleResolve = useCallback(
    async (incident: IncidenteEmergente, comments?: string) => {
      try {
        const response = await handleFetchRequest(`${apiBase}/incidentes/${incident.id}/resuelto`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
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
    [apiBase, onIncidentResolved, handleFetchRequest]
  );

  const handleSkip = useCallback(
    async (incident: IncidenteEmergente) => {
      try {
        const response = await handleFetchRequest(`${apiBase}/incidentes/${incident.id}/cerrar`, {
          method: "POST",
          headers: { ...getAuthHeaders() },
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
    [apiBase, onIncidentSkipped, handleFetchRequest]
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
      <AnimatePresence>
        {realtimeNotice ? (
          <motion.div
            key={realtimeNotice.id}
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            className={`fixed right-4 top-4 z-[1060] w-[min(92vw,360px)] rounded-xl border bg-white/95 p-3 shadow-xl backdrop-blur dark:bg-zinc-900/95 ${realtimeNoticeToneClass(realtimeNotice.tone)}`}
          >
            <div className="flex items-start gap-2">
              {realtimeNotice.icon === "incident" ? (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <Activity className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <div className="min-w-0">
                <div className="text-sm font-bold">{realtimeNotice.title}</div>
                <div className="truncate text-xs opacity-80">{realtimeNotice.description}</div>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

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

      {!isMobile && (
        <div className="fixed inset-0 pointer-events-none z-[1040]" ref={constraintsRef}>
          <motion.div
            drag
            dragMomentum={false}
            dragConstraints={constraintsRef}
            initial={{ x: 20, y: 20 }}
            className="pointer-events-auto absolute right-6 bottom-6 flex flex-col overflow-hidden rounded-xl bg-white/80 backdrop-blur-xl shadow-lg border border-white/20 dark:bg-zinc-900/80 dark:border-white/5 ring-1 ring-black/5 dark:ring-white/10"
            style={{ width: isMinimized ? "auto" : 260 }}
            animate={{
              width: isMinimized ? "auto" : 260,
              height: "auto",
            }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          >
            {/* Header / Drag Handle */}
            <div className="flex items-center justify-between pl-3 pr-2 py-1.5 cursor-move border-b border-black/5 dark:border-white/5 select-none bg-white/40 dark:bg-black/20">
              <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300">
                <GripHorizontal className="h-3 w-3 opacity-50" />
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">Monitor</span>
              </div>
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="rounded-md p-1 text-zinc-400 hover:bg-black/5 hover:text-zinc-700 dark:hover:bg-white/10 dark:hover:text-zinc-200 transition-colors"
                title={isMinimized ? "Expandir" : "Minimizar"}
              >
                {isMinimized ? <Maximize2 className="h-3 w-3" /> : <Minimize2 className="h-3 w-3" />}
              </button>
            </div>

            {/* Content */}
            <AnimatePresence mode="wait">
              {!isMinimized ? (
                <motion.div
                  key="content"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-3"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`h-1.5 w-1.5 rounded-full ${isMonitoring ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-zinc-300 dark:bg-zinc-700"}`} />
                        <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                          {isMonitoring ? "Activo" : "Inactivo"}
                        </span>
                      </div>
                      <span className="text-[9px] font-mono text-zinc-400">
                        {lastCheck?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || "--:--"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-3 p-2 rounded-lg bg-white/50 border border-black/5 dark:bg-white/5 dark:border-white/5">
                      <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Incidentes</span>
                      <span className={`text-sm font-bold ${activeCount > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-400 dark:text-zinc-600"}`}>
                        {activeCount}
                      </span>
                    </div>

                    {error && (
                      <div className="text-[10px] text-red-500 font-medium text-center">
                        ⚠️ Error de conexión
                      </div>
                    )}

                    <div className="text-[9px] text-zinc-400/80 dark:text-zinc-600 flex justify-between pt-1">
                      <span>E: {empresaId || "*"}</span>
                      <span>L: {localidadId || "*"}</span>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="minimized"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="px-2.5 py-1.5 flex items-center gap-2 bg-white/60 dark:bg-black/40 backdrop-blur-md"
                >
                  <Activity className={`h-3 w-3 ${isMonitoring ? "text-emerald-500" : "text-zinc-400"}`} />
                  {activeCount > 0 && <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">{activeCount}</span>}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      )}

      {isMobile && (
        <>
          <button
            type="button"
            aria-label={isSheetOpen ? "Ocultar monitor de incidentes" : `Mostrar monitor de incidentes${activeCount > 0 ? ` (${activeCount} activos)` : ""}`}
            aria-expanded={isSheetOpen}
            aria-controls="incident-monitor-sheet"
            onClick={() => setIsSheetOpen((v) => !v)}
            className={`fixed right-4 bottom-4 z-[1030] grid place-items-center w-12 h-12 rounded-full bg-white/90 backdrop-blur-md dark:bg-zinc-900/90 shadow-[0_8px_24px_rgba(0,0,0,0.15)] border border-white/20 dark:border-white/10 transition-transform ${isSheetOpen ? "scale-95" : "scale-100"}`}
          >
            <Activity className="h-5 w-5 text-zinc-700 dark:text-white" />
            {activeCount > 0 && (
              <span
                aria-label={`${activeCount} incidentes activos`}
                className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center shadow-sm ring-2 ring-white dark:ring-zinc-900"
              >
                {activeCount > 99 ? "99+" : activeCount}
              </span>
            )}
          </button>

          {isSheetOpen && (
            <div className="fixed inset-0 z-[1035] bg-black/20 backdrop-blur-sm" role="presentation" onClick={() => setIsSheetOpen(false)}>
              <section
                id="incident-monitor-sheet"
                role="dialog"
                aria-modal="true"
                aria-label="Monitor de Incidentes"
                className="fixed bottom-0 inset-x-0 z-[1040] bg-white dark:bg-zinc-900 rounded-t-2xl shadow-[0_-12px_32px_rgba(0,0,0,0.25)] max-h-[80vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-zinc-800 dark:text-zinc-100">Monitor</span>
                    {isMonitoring ? (
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-100/50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                        Activo
                      </span>
                    ) : null}
                  </div>
                  <button type="button" className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors" aria-label="Cerrar monitor de incidentes" onClick={() => setIsSheetOpen(false)}>
                    <Minimize2 className="h-4 w-4 text-zinc-500" />
                  </button>
                </div>

                <div className="px-4 py-3 overflow-auto text-sm text-zinc-700 dark:text-zinc-200">
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Última verificación:</span>
                      <span className="font-mono">{lastCheck?.toLocaleTimeString() || "—"}</span>
                    </div>
                    {error && <div className="text-red-500 font-medium">⚠️ Error de conexión</div>}
                  </div>

                  {activeIncidents.length > 0 ? (
                    <div className="mt-4 space-y-3">
                      <div className="text-xs font-bold uppercase tracking-wider text-zinc-400">Incidentes ({activeIncidents.length})</div>
                      <ul className="space-y-2">
                        {activeIncidents.map((it: any, idx: number) => (
                          <li key={it.id ?? `${it?.titulo ?? it?.nombre ?? it?.tipo ?? "incidente"}-${idx}`} className="p-3 rounded-xl bg-zinc-50 border border-zinc-100 dark:bg-zinc-800/50 dark:border-zinc-800/50">
                            <div className="font-semibold text-zinc-900 dark:text-zinc-100">#{it.id ?? "—"} {it.titulo ?? it.nombre ?? it.tipo ?? "Incidente"}</div>
                            {it.descripcion && <div className="text-zinc-500 dark:text-zinc-400 text-xs mt-1 line-clamp-2">{it.descripcion}</div>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div className="py-8 text-center text-zinc-400 text-xs italic">
                      No hay incidentes activos en este momento.
                    </div>
                  )}

                  <p className="mt-4 text-[10px] text-zinc-400 text-center max-w-[200px] mx-auto opacity-70">
                    El monitor notifica automáticamente cuando se detectan incidentes relevantes para tu empresa.
                  </p>
                </div>
              </section>
            </div>
          )}
        </>
      )}
    </>
  );
}
