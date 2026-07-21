"use client";

import React, { useCallback, useEffect, useState, useMemo } from "react";
import {
  X,
  Clock,
  Building,
  Train,
  MapPin,
  FastForward,
  Info,
  TimerReset,
  ImageIcon,
} from "lucide-react";
import type { IncidenteEmergente } from "@/app/hooks/useIncidentMonitor";
import { shouldUseIncidentCountdown } from "@/lib/incidentCountdownPolicy";
import ConfirmationModal from "../ConfirmationModal";
import { ImageGallery } from "./ImageGallery";

/* ================= Tipos ================= */
interface IncidentModalProps {
  incident: IncidenteEmergente;
  isOpen: boolean;
  onClose: () => void;
  onResolve: (incident: IncidenteEmergente, comments?: string) => void;
  onSkip: (incident: IncidenteEmergente) => void;
  onContinue: (incident: IncidenteEmergente) => void;
  countdownEnabled?: boolean;
}

/* ================= Constantes ================= */
const WINDOW_DURATION_MS = 10 * 60 * 1000; // 10 minutos

const URGENCY = {
  NORMAL: { max: 50, label: "NORMAL", color: "text-emerald-300", bar: "bg-emerald-300" },
  ALERTA: { max: 85, label: "ALERTA", color: "text-amber-300", bar: "bg-amber-300" },
  CRITICO: { max: 100, label: "CRITICO", color: "text-rose-300", bar: "bg-rose-300" },
} as const;

const ESTADO_COLORS = {
  ABIERTO: "text-amber-600",
  RESUELTO: "text-emerald-600",
  CERRADO: "text-rose-600",
} as const;

/* ================= Utilidades ================= */
function cn(...xs: (string | false | undefined)[]) {
  return xs.filter(Boolean).join(" ");
}

function formatTime(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

function urgencyFor(pct: number) {
  if (pct < URGENCY.NORMAL.max) return URGENCY.NORMAL;
  if (pct < URGENCY.ALERTA.max) return URGENCY.ALERTA;
  return URGENCY.CRITICO;
}

function truncate(text = "", max = 90) {
  return text.length <= max ? text : `${text.slice(0, max)}…`;
}

/* ================= Componente Timer ================= */
function TimerBar({ leftMs, pct }: { leftMs: number; pct: number }) {
  const u = urgencyFor(pct);
  return (
    <div className="mt-3 sm:mt-4">
      <div className="flex items-center gap-2 text-white">
        <TimerReset className="h-4 w-4" />
        <span className={cn("text-sm sm:text-base font-bold", u.color)}>{formatTime(leftMs)}</span>
        <span className="text-[10px] sm:text-xs opacity-90">restante</span>
        <span className="ml-3 text-[10px] sm:text-xs font-semibold">{u.label}</span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/30">
        <div className={cn("h-2 rounded-full transition-[width] duration-300", u.bar)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ================= Componente Principal ================= */
export default function IncidentModal({
  incident,
  isOpen,
  onClose,
  onResolve,
  onSkip,
  onContinue,
  countdownEnabled = true,
}: IncidentModalProps) {
  const [resolution, setResolution] = useState("");
  const [now, setNow] = useState<number>(Date.now());
  const [isResolving, setIsResolving] = useState(false);
  const [isSkipConfirmOpen, setIsSkipConfirmOpen] = useState(false);
  const [tab, setTab] = useState<0 | 1>(0);
  const [imageIndex, setImageIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const countdownAllowed = countdownEnabled && shouldUseIncidentCountdown(incident);

  // Timer para actualizar cada segundo
  useEffect(() => {
    if (!isOpen || !countdownAllowed) return;

    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [countdownAllowed, isOpen]);

  // Calcular tiempo restante
  const startMs = new Date(incident.fechaInicio).getTime();
  const leftMs = Math.max(0, WINDOW_DURATION_MS - (now - startMs));
  const pct = Math.round(((WINDOW_DURATION_MS - leftMs) / WINDOW_DURATION_MS) * 100);
  const canActOnIncident = incident.estado === "ABIERTO" && (!countdownAllowed || leftMs > 0);
  const showTimer = countdownAllowed && canActOnIncident;
  const statusDotClass = showTimer
    ? urgencyFor(pct).bar
    : incident.estado === "ABIERTO"
      ? "bg-amber-300"
      : incident.estado === "RESUELTO"
        ? "bg-emerald-300"
        : "bg-slate-300";

  // Obtener imágenes
  const images = useMemo(() => {
    let list: string[] = [];
    if (Array.isArray(incident.imagenes) && incident.imagenes.length) {
      list = incident.imagenes;
    } else {
      list = [incident.imagen1, incident.imagen2, incident.imagen3, incident.imagen4].filter(Boolean) as string[];
    }
    return list;
  }, [incident]);

  const hasImages = images.length > 0;

  // Manejar resolución
  const handleResolve = useCallback(async () => {
    if (!resolution.trim()) {
      alert("Por favor, describe la resolución del incidente.");
      return;
    }

    setIsResolving(true);
    try {
      await onResolve(incident, resolution.trim());
      setResolution("");
    } catch (error) {
      console.error("Error al resolver incidente:", error);
    } finally {
      setIsResolving(false);
    }
  }, [incident, resolution, onResolve]);

  // Manejar cierre operativo sin resolución
  const handleSkip = useCallback(async () => {
    try {
      await onSkip(incident);
    } catch (error) {
      console.error("Error al cerrar incidente sin resolver:", error);
    }
  }, [incident, onSkip]);

  // Manejar continuar
  const handleContinue = useCallback(() => {
    onContinue(incident);
  }, [incident, onContinue]);

  // Manejar cerrar
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // Manejar tecla Escape
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        handleClose();
      }
    };

    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch sm:items-start justify-center bg-slate-900/70 dark:bg-black/70 p-0 sm:p-4"
      role="dialog"
      aria-labelledby="incident-title"
      aria-modal="true"
    >
      <div className="w-full max-h-dvh sm:h-auto sm:mt-6 sm:max-h-[90vh] max-w-5xl bg-white dark:bg-slate-900 shadow-2xl sm:rounded-lg flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-700 to-emerald-900 px-4 sm:px-5 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className={cn("h-3 w-3 rounded-full flex-shrink-0", statusDotClass)} />
              <h1 id="incident-title" className="truncate text-base sm:text-lg font-bold text-white">
                {truncate(incident.descripcion, 100)}
              </h1>
            </div>
            <button
              onClick={handleClose}
              className="rounded-md p-1 text-white/90 hover:bg-white/10 transition-colors"
              aria-label="Cerrar ventana sin modificar el incidente"
              title="Cerrar ventana sin modificar el incidente"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          {showTimer && <TimerBar leftMs={leftMs} pct={pct} />}
        </div>

        {/* Status */}
        <div className="flex items-center justify-between border-b px-4 sm:px-5 py-2 bg-slate-50 dark:bg-slate-800">
          <div className={cn("flex items-center gap-2 text-xs sm:text-sm font-semibold", ESTADO_COLORS[incident.estado])}>
            <Info className="h-4 w-4" />
            <span className="uppercase">{incident.estado}</span>
          </div>
          {showTimer && <div className={cn("text-[10px] sm:text-xs font-semibold", urgencyFor(pct).color)}>{urgencyFor(pct).label}</div>}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b px-2 sm:px-4 bg-white dark:bg-slate-900">
          <button
            onClick={() => setTab(0)}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 border-b-4 px-2 sm:px-3 py-2 sm:py-3 text-xs sm:text-sm font-semibold transition-colors",
              tab === 0 ? "border-emerald-600 text-emerald-700 dark:text-emerald-400" : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
            )}
            role="tab"
            aria-selected={tab === 0}
          >
            <Info className="h-4 w-4" />
            Detalles
          </button>
          <button
            onClick={() => setTab(1)}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 border-b-4 px-2 sm:px-3 py-2 sm:py-3 text-xs sm:text-sm font-semibold transition-colors",
              tab === 1 ? "border-emerald-600 text-emerald-700 dark:text-emerald-400" : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
            )}
            role="tab"
            aria-selected={tab === 1}
          >
            <ImageIcon className="h-4 w-4" />
            Imágenes {hasImages ? `(${images.length})` : ""}
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-slate-50 dark:bg-slate-800">
          {tab === 0 ? (
            <div className="space-y-3">
              {/* Descripción */}
              <section className="rounded-lg border bg-white dark:bg-slate-900 p-3 shadow-sfm">
                <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-800 dark:text-slate-200">
                  <Info className="h-5 w-5 text-emerald-600" />
                  Descripción del Incidente
                </h2>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                  {incident.descripcion || "Sin descripción disponible"}
                </p>
              </section>

              {/* Información del Movimiento */}
              <section className="rounded-xl border bg-white dark:bg-slate-900 p-4 shadow-sm">
                <h2 className="mb-3 text-base font-semibold text-slate-800 dark:text-slate-200">Información del Movimiento</h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <div className="text-xs font-semibold text-slate-500 uppercase">Empresa</div>
                    <div className="mt-1 flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                      <Building className="h-4 w-4 text-slate-500" />
                      {incident.empresa || "No especificada"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-500 uppercase">Locomotora</div>
                    <div className="mt-1 flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                      <Train className="h-4 w-4 text-slate-500" />
                      {incident.locomotora ? `#${incident.locomotora}` : "No especificada"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-500 uppercase">Origen</div>
                    <div className="mt-1 flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                      <MapPin className="h-4 w-4 text-slate-500" />
                      {incident.origen || "No especificado"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-500 uppercase">Destino</div>
                    <div className="mt-1 flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                      <MapPin className="h-4 w-4 text-slate-500" />
                      {incident.destino || "No especificado"}
                    </div>
                  </div>
                </div>
              </section>

              {/* Fecha y Hora */}
              <section className="rounded-xl border bg-white dark:bg-slate-900 p-4 shadow-sm">
                <h2 className="mb-3 text-base font-semibold text-slate-800 dark:text-slate-200">Información Temporal</h2>
                <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <Clock className="h-4 w-4 text-slate-500" />
                  <span>
                    Reportado el {new Date(incident.fechaInicio).toLocaleString("es-ES", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </section>

              {/* Resolución del incidente */}
              {incident.estado === "ABIERTO" && (
                <section className="rounded-xl border bg-white dark:bg-slate-900 p-4 shadow-sm">
                  <h2 className="mb-3 text-base font-semibold text-slate-800 dark:text-slate-200">Resolución del incidente</h2>
                  <p className="mb-3 text-xs font-semibold leading-5 text-slate-500 dark:text-slate-400">
                    Resolver registra la solución y cambia el incidente a RESUELTO. Cerrar sin resolver no registra solución.
                  </p>
                  <textarea
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    rows={3}
                    className="w-full resize-none rounded-lg border border-slate-300 bg-slate-50 dark:bg-slate-800 dark:border-slate-600 p-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                    placeholder="Describe las acciones tomadas para resolver el incidente..."
                    maxLength={1000}
                  />
                  <div className="mt-2 text-xs text-slate-500">{resolution.length}/1000</div>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => setResolution("")}
                      disabled={!resolution}
                      className={cn(
                        "flex-1 rounded-lg px-4 py-2 text-sm font-semibold",
                        resolution ? "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600" : "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                      )}
                    >
                      Limpiar
                    </button>
                    <button
                      onClick={handleResolve}
                      disabled={!resolution.trim() || isResolving}
                      className={cn(
                        "flex-[2] rounded-lg px-4 py-2 text-sm font-semibold text-white",
                        resolution.trim() && !isResolving ? "bg-emerald-600 hover:bg-emerald-700" : "bg-slate-300 dark:bg-slate-700 cursor-not-allowed"
                      )}
                    >
                      {isResolving ? "Resolviendo..." : "Confirmar resolución"}
                    </button>
                  </div>
                </section>
              )}
            </div>
          ) : (
            <div>
              {hasImages ? (
                <ImageGallery
                  images={images}
                  index={imageIndex}
                  onChange={setImageIndex}
                  fullscreen={fullscreen}
                  onToggleFullscreen={() => setFullscreen((v) => !v)}
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <ImageIcon className="h-12 w-12 text-slate-400 mb-4" />
                  <h3 className="text-lg font-semibold text-slate-600 dark:text-slate-400 mb-2">No hay imágenes disponibles</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-500">
                    Este incidente no tiene imágenes asociadas.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row gap-2 border-t bg-white dark:bg-slate-900 px-4 sm:px-5 py-3">
          {canActOnIncident && tab === 0 ? (
            <>
              <button
                onClick={() => setIsSkipConfirmOpen(true)}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 font-semibold text-white hover:bg-amber-600"
              >
                <FastForward className="h-5 w-5" />
                Cerrar sin resolver
              </button>
            </>
          ) : tab === 0 ? (
            <button
              onClick={handleContinue}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white hover:bg-emerald-800"
            >
              Continuar
            </button>
          ) : null}
        </div>
      </div>
      <ConfirmationModal
        isOpen={isSkipConfirmOpen}
        onClose={() => setIsSkipConfirmOpen(false)}
        onConfirm={handleSkip}
        title="¿Cerrar sin resolver?"
      >
        <p>Se cerrará como cierre operativo sin registrar una solución. Para liberar el bloqueo con solución, usa Resolver incidente.</p>
      </ConfirmationModal>
    </div>
  );
}
