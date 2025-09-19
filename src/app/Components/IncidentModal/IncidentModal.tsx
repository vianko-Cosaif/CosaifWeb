/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  X,
  Clock,
  Building,
  Train,
  MapPin,
  CheckCircle2,
  FastForward,
  ChevronLeft,
  ChevronRight,
  Info,
  TimerReset,
} from "lucide-react";
import type { IncidenteEmergente } from "@/app/hooks/useIncidentMonitor";
import ConfirmationModal from "../ConfirmationModal";

/* ================= Tipos ================= */
interface IncidentModalProps {
  incident: IncidenteEmergente;
  isOpen: boolean;
  onClose: () => void;
  onResolve: (incident: IncidenteEmergente, comments?: string) => void;
  onSkip: (incident: IncidenteEmergente) => void;
  onContinue: (incident: IncidenteEmergente) => void;
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
}: IncidentModalProps) {
  const [resolution, setResolution] = useState("");
  const [now, setNow] = useState<number>(Date.now());
  const [isResolving, setIsResolving] = useState(false);
  const [isSkipConfirmOpen, setIsSkipConfirmOpen] = useState(false);

  // Timer para actualizar cada segundo
  useEffect(() => {
    if (!isOpen) return;

    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [isOpen]);

  // Calcular tiempo restante
  const startMs = new Date(incident.fechaInicio).getTime();
  const leftMs = Math.max(0, WINDOW_DURATION_MS - (now - startMs));
  const pct = Math.round(((WINDOW_DURATION_MS - leftMs) / WINDOW_DURATION_MS) * 100);
  const showTimer = leftMs > 0 && incident.estado === "ABIERTO";

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

  // Manejar omitir
  const handleSkip = useCallback(async () => {
    try {
      await onSkip(incident);
    } catch (error) {
      console.error("Error al omitir incidente:", error);
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
      className="fixed inset-0 z-50 flex items-stretch sm:items-start justify-center bg-slate-900/70 p-0 sm:p-4"
      role="dialog"
      aria-labelledby="incident-title"
      aria-modal="true"
    >
      <div className="w-full max-h-dvh sm:h-auto sm:mt-6 sm:max-h-[90vh] max-w-5xl bg-white shadow-2xl sm:rounded-lg flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-700 to-emerald-900 px-4 sm:px-5 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className={cn("h-3 w-3 rounded-full flex-shrink-0", urgencyFor(pct).bar)} />
              <h1 id="incident-title" className="truncate text-base sm:text-lg font-bold text-white">
                {truncate(incident.descripcion, 100)}
              </h1>
            </div>
            <button
              onClick={handleClose}
              className="rounded-md p-1 text-white/90 hover:bg-white/10 transition-colors"
              aria-label="Cerrar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          {showTimer && <TimerBar leftMs={leftMs} pct={pct} />}
        </div>

        {/* Status */}
        <div className="flex items-center justify-between border-b px-4 sm:px-5 py-2 bg-slate-50">
          <div className={cn("flex items-center gap-2 text-xs sm:text-sm font-semibold", ESTADO_COLORS[incident.estado])}>
            <Info className="h-4 w-4" />
            <span className="uppercase">{incident.estado}</span>
          </div>
          {showTimer && <div className={cn("text-[10px] sm:text-xs font-semibold", urgencyFor(pct).color)}>{urgencyFor(pct).label}</div>}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-slate-50">
          <div className="space-y-3">
            {/* Descripción */}
            <section className="rounded-lg border bg-white p-3 shadow-sfm">
              <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-800">
                <Info className="h-5 w-5 text-emerald-600" />
                Descripción del Incidente
              </h2>
              <p className="text-slate-700 leading-relaxed">
                {incident.descripcion || "Sin descripción disponible"}
              </p>
            </section>

            {/* Información del Movimiento */}
            <section className="rounded-xl border bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-base font-semibold text-slate-800">Información del Movimiento</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase">Empresa</div>
                  <div className="mt-1 flex items-center gap-2 text-sm font-medium text-slate-700">
                    <Building className="h-4 w-4 text-slate-500" />
                    {incident.empresa || "No especificada"}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase">Locomotora</div>
                  <div className="mt-1 flex items-center gap-2 text-sm font-medium text-slate-700">
                    <Train className="h-4 w-4 text-slate-500" />
                    {incident.locomotora ? `#${incident.locomotora}` : "No especificada"}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase">Origen</div>
                  <div className="mt-1 flex items-center gap-2 text-sm font-medium text-slate-700">
                    <MapPin className="h-4 w-4 text-slate-500" />
                    {incident.origen || "No especificado"}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase">Destino</div>
                  <div className="mt-1 flex items-center gap-2 text-sm font-medium text-slate-700">
                    <MapPin className="h-4 w-4 text-slate-500" />
                    {incident.destino || "No especificado"}
                  </div>
                </div>
              </div>
            </section>

            {/* Fecha y Hora */}
            <section className="rounded-xl border bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-base font-semibold text-slate-800">Información Temporal</h2>
              <div className="flex items-center gap-2 text-sm text-slate-700">
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
              <section className="rounded-xl border bg-white p-4 shadow-sm">
                <h2 className="mb-3 text-base font-semibold text-slate-800">Resolución del incidente</h2>
                <textarea
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  rows={3}
                  className="w-full resize-none rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
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
                      resolution ? "bg-slate-200 text-slate-700 hover:bg-slate-300" : "bg-slate-100 text-slate-400 cursor-not-allowed"
                    )}
                  >
                    Limpiar
                  </button>
                  <button
                    onClick={handleResolve}
                    disabled={!resolution.trim() || isResolving}
                    className={cn(
                      "flex-[2] rounded-lg px-4 py-2 text-sm font-semibold text-white",
                      resolution.trim() && !isResolving ? "bg-emerald-600 hover:bg-emerald-700" : "bg-slate-300 cursor-not-allowed"
                    )}
                  >
                    {isResolving ? "Resolviendo..." : "Confirmar resolución"}
                  </button>
                </div>
              </section>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row gap-2 border-t bg-white px-4 sm:px-5 py-3">
          {showTimer && incident.estado === "ABIERTO" ? (
            <>

              <button
                onClick={() => setIsSkipConfirmOpen(true)}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 font-semibold text-white hover:bg-amber-600"
              >
                <FastForward className="h-5 w-5" />
                Omitir
              </button>
            </>
          ) : (
            <button
              onClick={handleContinue}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white hover:bg-emerald-800"
            >
              Continuar
            </button>
          )}
        </div>
      </div>
      <ConfirmationModal
        isOpen={isSkipConfirmOpen}
        onClose={() => setIsSkipConfirmOpen(false)}
        onConfirm={handleSkip} // Llama a la función original de omitir
        title="¿Estás seguro de omitir?"
      >
        <p>Esta acción podría conllevar una reorganización de los movimientos planificados.</p>
      </ConfirmationModal>
    </div>
  );
}
