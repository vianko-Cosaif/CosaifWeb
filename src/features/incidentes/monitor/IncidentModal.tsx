"use client";

import React, { useCallback, useEffect, useState, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
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
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import type { IncidenteEmergente } from "@/features/incidentes/useIncidentMonitor";
import { shouldUseIncidentCountdown } from "@/lib/incidentCountdownPolicy";
import { registerDialog } from "@/components/ui/Modal/dialogStack";
import ConfirmationModal from "../../../components/ConfirmationModal";
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
  loadingImages?: boolean;
  imageError?: string | null;
}

/* ================= Constantes ================= */
const WINDOW_DURATION_MS = 10 * 60 * 1000; // 10 minutos

const URGENCY = {
  NORMAL: { max: 50, label: "Tiempo disponible", color: "text-emerald-200", bar: "bg-emerald-300" },
  ALERTA: { max: 85, label: "Requiere atención", color: "text-amber-200", bar: "bg-amber-300" },
  CRITICO: { max: 100, label: "Tiempo por terminar", color: "text-rose-200", bar: "bg-rose-300" },
} as const;

const ESTADO_COLORS = {
  ABIERTO:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
  RESUELTO:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
  CERRADO:
    "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
} as const;

const FOCUSABLE =
  'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

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

/* ================= Componente Timer ================= */
function TimerBar({ leftMs, pct }: { leftMs: number; pct: number }) {
  const u = urgencyFor(pct);
  return (
    <div className="mt-5 rounded-2xl border border-white/15 bg-white/[0.08] px-4 py-3 sm:mt-6">
      <div className="flex flex-wrap items-center justify-between gap-2 text-white">
        <div className="flex items-center gap-2">
          <TimerReset className="h-4 w-4 text-emerald-200" aria-hidden />
          <span className="text-xs font-medium text-white/75">Tiempo para atender</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className={cn("text-lg font-bold tabular-nums", u.color)}>
            {formatTime(leftMs)}
          </span>
          <span className="text-xs text-white/65">restantes</span>
        </div>
      </div>
      <div
        className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-white/20"
        role="progressbar"
        aria-label="Tiempo transcurrido"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn("h-full rounded-full transition-[width] duration-300", u.bar)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className={cn("mt-2 text-right text-[11px] font-semibold", u.color)}>{u.label}</p>
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
  loadingImages = false,
  imageError,
}: IncidentModalProps) {
  const [resolution, setResolution] = useState("");
  const [now, setNow] = useState<number>(Date.now());
  const [isResolving, setIsResolving] = useState(false);
  const [isSkipConfirmOpen, setIsSkipConfirmOpen] = useState(false);
  const [tab, setTab] = useState<0 | 1>(0);
  const [imageIndex, setImageIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const countdownAllowed = countdownEnabled && shouldUseIncidentCountdown(incident);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

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

  // Obtener imágenes
  const images = useMemo(() => {
    let list: string[] = [];
    if (Array.isArray(incident.imagenes) && incident.imagenes.length) {
      list = incident.imagenes;
    } else {
      list = [incident.imagen1, incident.imagen2, incident.imagen3, incident.imagen4].filter(
        Boolean,
      ) as string[];
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

  // El portal evita que el menú lateral recorte o cubra el diálogo.
  useEffect(() => {
    if (!isOpen || !mounted || !overlayRef.current || !dialogRef.current) return;
    const dialog = dialogRef.current;
    const unregister = registerDialog(overlayRef.current);
    const elements = () =>
      [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (element) => element.getClientRects().length && !element.closest("[inert]"),
      );
    const topmost = () => [...document.querySelectorAll("[data-cosaif-dialog]")].at(-1) === dialog;
    (elements()[0] || dialog).focus();
    const onKey = (event: KeyboardEvent) => {
      if (!topmost()) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
      }
      if (event.key !== "Tab") return;
      const focusable = elements();
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first) {
        event.preventDefault();
        dialog.focus();
      } else if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === dialog)
      ) {
        event.preventDefault();
        last?.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || !dialog.contains(document.activeElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    const onFocus = (event: FocusEvent) => {
      if (topmost() && !dialog.contains(event.target as Node)) (elements()[0] || dialog).focus();
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("focusin", onFocus);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("focusin", onFocus);
      unregister();
    };
  }, [isOpen, mounted]);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div
      ref={overlayRef}
      data-guide-id="incident-alert-dialog"
      className="fixed inset-0 z-[150] flex items-end justify-center bg-slate-950/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
    >
      <div
        ref={dialogRef}
        data-cosaif-dialog
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="incident-title"
        className="flex h-dvh min-h-0 w-full max-w-4xl flex-col overflow-hidden bg-[var(--app-surface)] text-[var(--app-text)] shadow-[0_32px_100px_rgba(2,6,23,0.35)] outline-none sm:h-auto sm:max-h-[min(90dvh,860px)] sm:rounded-3xl sm:border sm:border-[var(--app-border)]"
      >
        <header className="relative shrink-0 overflow-hidden bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] text-white sm:px-7 sm:py-6">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(16,185,129,0.26),transparent_55%)]"
          />
          <div className="relative flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3 sm:gap-4">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-emerald-300/20 bg-emerald-300/10 text-emerald-200">
                <AlertTriangle className="h-5 w-5" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200/80">
                  Alerta de operación · #{incident.id}
                </p>
                <h1
                  id="incident-title"
                  className="mt-1 text-xl font-bold leading-tight sm:text-2xl"
                >
                  Incidente reportado
                </h1>
                <p className="mt-1.5 line-clamp-2 max-w-2xl text-sm leading-relaxed text-white/75">
                  {incident.descripcion || "Sin descripción disponible"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
              aria-label="Cerrar ventana sin modificar el incidente"
              title="Cerrar ventana sin modificar el incidente"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
          {showTimer && <TimerBar leftMs={leftMs} pct={pct} />}
        </header>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3 sm:px-7">
          <span
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold",
              ESTADO_COLORS[incident.estado],
            )}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
            {incident.estado === "ABIERTO"
              ? "Abierto · requiere atención"
              : incident.estado === "RESUELTO"
                ? "Resuelto"
                : "Cerrado"}
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs text-[var(--app-text-muted)]">
            <Clock className="h-3.5 w-3.5" aria-hidden />{" "}
            {new Date(incident.fechaInicio).toLocaleString("es-MX", {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>

        {/* Tabs */}
        <div
          className="flex shrink-0 gap-2 border-b border-[var(--app-border)] bg-[var(--app-surface)] px-4 sm:px-7"
          role="tablist"
          aria-label="Contenido del incidente"
        >
          <button
            onClick={() => setTab(0)}
            className={cn(
              "flex min-h-12 flex-1 items-center justify-center gap-2 border-b-2 px-2 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 sm:flex-none sm:px-5",
              tab === 0
                ? "border-emerald-600 text-emerald-700 dark:text-emerald-300"
                : "border-transparent text-[var(--app-text-muted)] hover:text-[var(--app-text)]",
            )}
            type="button"
            role="tab"
            aria-selected={tab === 0}
            aria-controls="incident-details-panel"
          >
            <Info className="h-4 w-4" />
            Detalles
          </button>
          <button
            onClick={() => setTab(1)}
            className={cn(
              "flex min-h-12 flex-1 items-center justify-center gap-2 border-b-2 px-2 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 sm:flex-none sm:px-5",
              tab === 1
                ? "border-emerald-600 text-emerald-700 dark:text-emerald-300"
                : "border-transparent text-[var(--app-text-muted)] hover:text-[var(--app-text)]",
            )}
            type="button"
            role="tab"
            aria-selected={tab === 1}
            aria-controls="incident-images-panel"
          >
            <ImageIcon className="h-4 w-4" />
            Imágenes {hasImages ? `(${images.length})` : ""}
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[var(--app-bg)] p-4 sm:p-6">
          {tab === 0 ? (
            <div id="incident-details-panel" role="tabpanel" className="space-y-4">
              {/* Descripción */}
              <section className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-[var(--app-shadow-sm)] sm:p-5">
                <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--app-text)]">
                  <Info className="h-4 w-4 text-emerald-600" aria-hidden />
                  Qué ocurrió
                </h2>
                <p className="break-words text-sm leading-relaxed text-[var(--app-text-muted)] sm:text-base">
                  {incident.descripcion || "Sin descripción disponible"}
                </p>
              </section>

              <section className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-[var(--app-shadow-sm)] sm:p-5">
                <h2 className="mb-4 text-sm font-semibold text-[var(--app-text)]">
                  Movimiento relacionado
                </h2>
                <dl className="grid gap-4 sm:grid-cols-2">
                  <div className="min-w-0 rounded-xl bg-[var(--app-surface-muted)] p-3">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--app-text-muted)]">
                      Empresa
                    </dt>
                    <dd className="mt-1.5 flex items-start gap-2 break-words text-sm font-medium">
                      <Building className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                      {incident.empresa || "No especificada"}
                    </dd>
                  </div>
                  <div className="min-w-0 rounded-xl bg-[var(--app-surface-muted)] p-3">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--app-text-muted)]">
                      Locomotora
                    </dt>
                    <dd className="mt-1.5 flex items-start gap-2 text-sm font-medium">
                      <Train className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                      {incident.locomotora ? `#${incident.locomotora}` : "No especificada"}
                    </dd>
                  </div>
                  <div className="min-w-0 rounded-xl bg-[var(--app-surface-muted)] p-3">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--app-text-muted)]">
                      Origen
                    </dt>
                    <dd className="mt-1.5 flex items-start gap-2 break-words text-sm font-medium">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                      {incident.origen || "No especificado"}
                    </dd>
                  </div>
                  <div className="min-w-0 rounded-xl bg-[var(--app-surface-muted)] p-3">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--app-text-muted)]">
                      Destino
                    </dt>
                    <dd className="mt-1.5 flex items-start gap-2 break-words text-sm font-medium">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                      {incident.destino || "No especificado"}
                    </dd>
                  </div>
                </dl>
              </section>

              {/* Resolución del incidente */}
              {incident.estado === "ABIERTO" && (
                <section className="rounded-2xl border border-emerald-200 bg-[var(--app-surface)] p-4 shadow-[var(--app-shadow-sm)] dark:border-emerald-900 sm:p-5">
                  <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--app-text)]">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden /> Resolver
                    incidente
                  </h2>
                  <p className="mb-4 text-xs leading-5 text-[var(--app-text-muted)]">
                    Describe la solución aplicada para dejar constancia y marcar el incidente como
                    resuelto.
                  </p>
                  <label
                    htmlFor="incident-resolution"
                    className="mb-1.5 block text-xs font-semibold text-[var(--app-text)]"
                  >
                    Acciones realizadas
                  </label>
                  <textarea
                    id="incident-resolution"
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    rows={3}
                    className="w-full resize-y rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-3 text-sm text-[var(--app-text)] outline-none placeholder:text-[var(--app-text-muted)] focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                    placeholder="Describe las acciones tomadas para resolver el incidente..."
                    maxLength={1000}
                  />
                  <div className="mt-1 text-right text-xs text-[var(--app-text-muted)]">
                    {resolution.length}/1000
                  </div>
                  <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={() => setResolution("")}
                      disabled={!resolution}
                      className={cn(
                        "min-h-11 rounded-xl border border-[var(--app-border)] px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
                        resolution
                          ? "text-[var(--app-text)] hover:bg-[var(--app-surface-muted)]"
                          : "cursor-not-allowed text-[var(--app-text-muted)] opacity-50",
                      )}
                    >
                      Limpiar
                    </button>
                    <button
                      type="button"
                      onClick={handleResolve}
                      disabled={!resolution.trim() || isResolving}
                      className={cn(
                        "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
                        resolution.trim() && !isResolving
                          ? "bg-emerald-700 hover:bg-emerald-800"
                          : "cursor-not-allowed bg-slate-400 opacity-60 dark:bg-slate-700",
                      )}
                    >
                      <CheckCircle2 className="h-4 w-4" aria-hidden />
                      {isResolving ? "Resolviendo..." : "Confirmar resolución"}
                    </button>
                  </div>
                </section>
              )}
            </div>
          ) : (
            <div id="incident-images-panel" role="tabpanel">
              {imageError ? (
                <p
                  role="alert"
                  className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"
                >
                  No se pudieron cargar las imágenes: {imageError}
                </p>
              ) : null}
              {hasImages ? (
                <ImageGallery
                  images={images}
                  index={imageIndex}
                  onChange={setImageIndex}
                  fullscreen={fullscreen}
                  onToggleFullscreen={() => setFullscreen((v) => !v)}
                />
              ) : loadingImages ? (
                <div
                  role="status"
                  className="py-12 text-center text-sm text-[var(--app-text-muted)]"
                >
                  Cargando imágenes del incidente…
                </div>
              ) : !imageError ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-12 text-center">
                  <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-[var(--app-surface-muted)]">
                    <ImageIcon className="h-6 w-6 text-[var(--app-text-muted)]" aria-hidden />
                  </div>
                  <h3 className="mb-2 text-base font-semibold text-[var(--app-text)]">
                    No hay imágenes disponibles
                  </h3>
                  <p className="text-sm text-[var(--app-text-muted)]">
                    Este incidente no tiene imágenes asociadas.
                  </p>
                </div>
              ) : null}
            </div>
          )}
        </div>

        <footer className="flex shrink-0 flex-col gap-2 border-t border-[var(--app-border)] bg-[var(--app-surface)] px-4 pb-[max(.75rem,env(safe-area-inset-bottom))] pt-3 sm:flex-row sm:justify-end sm:px-7 sm:py-4">
          {canActOnIncident && tab === 0 ? (
            <button
              type="button"
              data-guide-action="incident-alert-skip"
              onClick={() => setIsSkipConfirmOpen(true)}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-900 transition-colors hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-950/70"
            >
              <FastForward className="h-4 w-4" aria-hidden />
              Cerrar sin resolver
            </button>
          ) : tab === 0 ? (
            <button
              type="button"
              onClick={handleContinue}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              Continuar
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setTab(0)}
              className="min-h-11 rounded-xl border border-[var(--app-border)] px-4 py-2.5 text-sm font-semibold text-[var(--app-text)] hover:bg-[var(--app-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              Volver a detalles
            </button>
          )}
        </footer>
      </div>
      <ConfirmationModal
        isOpen={isSkipConfirmOpen}
        onClose={() => setIsSkipConfirmOpen(false)}
        onConfirm={handleSkip}
        title="¿Cerrar sin resolver?"
        confirmDataGuideAction="incident-alert-skip-confirm"
      >
        <p>
          Se cerrará como cierre operativo sin registrar una solución. Para liberar el bloqueo con
          solución, usa Resolver incidente.
        </p>
      </ConfirmationModal>
    </div>,
    document.fullscreenElement ?? document.body,
  );
}
