/* eslint-disable @next/next/no-img-element, @typescript-eslint/no-explicit-any */
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState, useId } from "react";
import { createPortal } from "react-dom";
import { shouldUseIncidentCountdown } from "@/lib/incidentCountdownPolicy";
import { isTrainingIncidentId } from "@/lib/routePolicy";
import { GuidedTarget } from "@/app/Components/GuidedManualAtom";
import { useTrainingTour } from "@/app/Components/GuidedManualAtom/TrainingTourContext";
import {
  ImageIcon,
  Info,
  TimerReset,
  CheckCircle2,
  FastForward,
  X,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Building,
  Train,
  Maximize2,
  Minimize2,
} from "lucide-react";

/* === TYPES === */
interface Incident {
  id?: string | number;
  incidenteId?: string | number;
  descripcion?: string;
  estado?: "ABIERTO" | "RESUELTO" | "CERRADO";
  fechaInicio?: string | number;
  localidadId?: string | number;
  _source?: string;
  _detalle?: any;
  imagen1?: string;
  imagen2?: string;
  imagen3?: string;
  imagen4?: string;
  imagenes?: string[];
  movimiento?: {
    empresa?: { nombre?: string };
    localidadId?: string | number;
    locomotiveNumber?: string;
  };
}

interface Props {
  incident: Incident;
  onResolve: (comments?: string) => void | Promise<void>;
  onContinue: () => void;
  onSkip: () => void | Promise<void>;
  operatorComment?: string;
}

/* === CONSTANTS === */
const PROXY = "/bff";
const INCIDENTES = "/api/incidentes";
const WINDOW_DURATION_MS = 10 * 60 * 1000;

const URGENCY = {
  NORMAL: { max: 50, label: "NORMAL", color: "text-emerald-300", bar: "bg-emerald-300" },
  ALERTA: { max: 85, label: "ALERTA", color: "text-amber-300", bar: "bg-amber-300" },
  CRITICO: { max: 100, label: "CRITICO", color: "text-rose-300", bar: "bg-rose-300" },
} as const;

const ESTADO_COLORS = {
  ABIERTO: "text-amber-600 dark:text-amber-300",
  RESUELTO: "text-emerald-600 dark:text-emerald-300",
  CERRADO: "text-rose-600 dark:text-rose-300",
} as const;

/* === UTILS === */
const EMPTY_IMAGE =
  "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='600'%3E%3Crect width='100%25' height='100%25' fill='%23ECEFF1'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23546E7A' font-family='sans-serif' font-size='24'%3ESin imagen%3C/text%3E%3C/svg%3E";

function cn(...xs: (string | false | undefined)[]) {
  return xs.filter(Boolean).join(" ");
}
function viaProxy(u: string) {
  if (!u) return "";
  if (u.startsWith(`${PROXY}/`) || u === PROXY) return u;
  if (u.startsWith("/")) return `${PROXY}${u}`;
  if (/^https?:\/\//i.test(u)) {
    try {
      const url = new URL(u);
      return `${PROXY}${url.pathname}${url.search}`;
    } catch {
      return u;
    }
  }
  return `${PROXY}/${u.replace(/^\/+/, "")}`;
}
function sourceQuery(incident?: Incident | null) {
  const source = String(incident?._source || incident?._detalle?._source || "").toLowerCase();
  if (source !== "torreon") return "";
  const params = new URLSearchParams({ source: "torreon" });
  const localidadId = incident?.localidadId || incident?._detalle?.localidadId || incident?.movimiento?.localidadId;
  if (localidadId) params.set("localidadId", String(localidadId));
  return `?${params.toString()}`;
}
function normalizeImageUrl(raw: string, incident?: Incident | null) {
  if (!raw) return "";
  if (raw.startsWith("/api/torreon/imagenes/")) return raw;
  const source = String(incident?._source || incident?._detalle?._source || "").toLowerCase();
  if (source === "torreon" && !/^https?:\/\//i.test(raw) && !raw.startsWith("data:")) {
    const cleaned = raw.replace(/^\/+/, "").replace(/^uploads\/incidentes\/+/i, "").replace(/^incidentes\/+/i, "");
    return `/api/torreon/imagenes/${cleaned.split("/").map(encodeURIComponent).join("/")}`;
  }
  return /^https?:\/\//i.test(raw) ? viaProxy(raw) : viaProxy(`/incidentes/imagen/${encodeURIComponent(raw)}`);
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

/* === IMAGE (auth + abort + dark) === */
type ImageWithAuthProps = {
  src: string;
  alt?: string;
  containerClassName?: string;
  imgClassName?: string;
};

const ImageWithAuth = React.memo(function ImageWithAuth({
  src,
  alt = "",
  containerClassName,
  imgClassName = "object-contain",
}: ImageWithAuthProps) {
  const [url, setUrl] = useState<string>(EMPTY_IMAGE);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    let revoked: string | null = null;

    (async () => {
      try {
        if (!src) {
          setUrl(EMPTY_IMAGE);
          setIsLoading(false);
          return;
        }
        setIsLoading(true);
        setHasError(false);

        const r = await fetch(src, {
          credentials: "include",
          cache: "no-store",
          signal: ac.signal,
        });
        if (!r.ok) throw new Error("img fetch");
        const b = await r.blob();
        const u = URL.createObjectURL(b);
        revoked = u;
        setUrl(u);
      } catch {
        if (ac.signal.aborted) return;
        setUrl(EMPTY_IMAGE);
        setHasError(true);
      } finally {
        if (!ac.signal.aborted) setIsLoading(false);
      }
    })();

    return () => {
      ac.abort();
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [src]);

  return (
    <div className={cn("relative", containerClassName)}>
      <img
        src={url}
        alt={alt}
        draggable={false}
        decoding="async"
        loading="lazy"
        className={cn("block h-full w-full select-none", imgClassName)}
      />
      {isLoading && (
        <div className="absolute inset-0 grid place-items-center bg-slate-100 dark:bg-slate-800/60" aria-busy>
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
        </div>
      )}
      {hasError && !isLoading && (
        <div className="absolute inset-0 grid place-items-center bg-slate-100 text-slate-500 dark:bg-slate-800/60 dark:text-slate-300">
          <AlertTriangle className="h-6 w-6" />
        </div>
      )}
    </div>
  );
});

/* === TIMER === */
const TimerBar = React.memo(function TimerBar({ leftMs, pct }: { leftMs: number; pct: number }) {
  const u = urgencyFor(pct);
  return (
    <div className="mt-3 sm:mt-4">
      <div className="flex items-center gap-2 text-white">
        <TimerReset className="h-4 w-4" />
        <span className={cn("text-sm sm:text-base font-bold", u.color)}>{formatTime(leftMs)}</span>
        <span className="text-[10px] sm:text-xs opacity-90">restante</span>
        <span className="ml-3 text-[10px] sm:text-xs font-semibold">{u.label}</span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/30 dark:bg-white/20">
        <div className={cn("h-2 rounded-full transition-[width] duration-300", u.bar)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
});

/* === GALLERY (responsive + no stretch) === */
const ImageGallery = React.memo(function ImageGallery({
  images,
  index,
  onChange,
  fullscreen,
  onToggleFullscreen,
}: {
  images: string[];
  index: number;
  onChange: (i: number) => void;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
}) {
  const total = images.length;
  const i = Math.min(index, Math.max(0, total - 1));
  const prev = useCallback(() => onChange(Math.max(i - 1, 0)), [i, onChange]);
  const next = useCallback(() => onChange(Math.min(i + 1, total - 1)), [i, onChange, total]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", k, { passive: true });
    return () => window.removeEventListener("keydown", k);
  }, [prev, next]);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Main viewer */}
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border border-white/60 bg-white/80 shadow-[0_20px_45px_rgba(15,23,42,0.12)] backdrop-blur dark:border-slate-700/60 dark:bg-slate-900/80",
          "touch-pan-y touch-pinch-zoom",
          fullscreen
            ? "h-[min(78vh,720px)] sm:h-[min(80vh,820px)]"
            : "h-[clamp(240px,45vh,520px)] sm:h-[clamp(320px,42vh,560px)] md:h-[clamp(360px,46vh,620px)] lg:h-[clamp(420px,50vh,720px)]"
        )}
      >
        {total ? (
          <ImageWithAuth
            src={images[i]}
            alt={`Imagen ${i + 1} de ${total}`}
            containerClassName="h-full w-full bg-slate-50 dark:bg-slate-800"
            imgClassName="object-contain"
          />
        ) : (
          <img src={EMPTY_IMAGE} className="h-full w-full object-contain" alt="" />
        )}

        {/* Controls */}
        <div className="absolute inset-x-0 bottom-3 mx-auto flex w-[220px] items-center justify-between rounded-full bg-slate-950/70 px-3 py-1 text-white shadow-lg backdrop-blur">
          <button
            onClick={prev}
            disabled={i === 0}
            className={cn("rounded p-1 focus:outline-none focus:ring-2 focus:ring-white/50", i === 0 ? "opacity-50 cursor-not-allowed" : "hover:bg-white/20")}
            aria-label="Anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium">
            {i + 1}/{total || 1}
          </span>
          <button
            onClick={next}
            disabled={i === total - 1}
            className={cn(
              "rounded p-1 focus:outline-none focus:ring-2 focus:ring-white/50",
              i === total - 1 ? "opacity-50 cursor-not-allowed" : "hover:bg-white/20"
            )}
            aria-label="Siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <button
          onClick={onToggleFullscreen}
          className="absolute right-3 top-3 rounded-full border border-white/20 bg-slate-950/70 p-2 text-white shadow-lg backdrop-blur hover:bg-slate-950/80 focus:outline-none focus:ring-2 focus:ring-white/50"
          aria-label={fullscreen ? "Salir pantalla completa" : "Pantalla completa"}
          title={fullscreen ? "Salir pantalla completa" : "Pantalla completa"}
        >
          {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
      </div>

      {/* Thumbs */}
      <div className="rounded-2xl border border-white/60 bg-white/80 p-3 sm:p-4 shadow-[0_15px_35px_rgba(15,23,42,0.08)] backdrop-blur dark:border-slate-700/60 dark:bg-slate-900/80">
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 sm:gap-3">
          {(total ? images : Array(4).fill("")).map((src, idx) => {
            const active = idx === i;
            return (
              <button
                key={idx}
                onClick={() => onChange(idx)}
                disabled={!src}
                className={cn(
                  "relative aspect-square overflow-hidden rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-600/40",
                  src ? "hover:border-slate-300 dark:hover:border-slate-500" : "opacity-50 cursor-not-allowed",
                  active ? "border-emerald-600 ring-2 ring-emerald-600/20" : "border-white/60 dark:border-slate-700/60"
                )}
                aria-label={src ? `Ver imagen ${idx + 1}` : "Miniatura no disponible"}
              >
                {src ? (
                  <ImageWithAuth
                    src={src}
                    containerClassName="h-full w-full"
                    imgClassName="object-cover"
                  />
                ) : (
                  <img src={EMPTY_IMAGE} className="h-full w-full object-cover" alt="" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
});

/* === MAIN === */
export default function SmartIncidentBlocker({
  incident,
  onResolve,
  onContinue,
  onSkip,
  operatorComment,
}: Props) {
  const trainingTour = useTrainingTour();
  // El ID reservado nunca debe consultarse ni mutarse en backend, incluso si
  // el modal queda abierto justo cuando termina el tour.
  const isTrainingIncident = isTrainingIncidentId(incident?.id ?? incident?.incidenteId);
  const [tab, setTab] = useState<0 | 1>(0);
  const [visible, setVisible] = useState(true);
  const [resolution, setResolution] = useState("");
  const [fetched, setFetched] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [now, setNow] = useState<number>(Date.now());
  const [fullscreen, setFullscreen] = useState(false);
  const actionLockRef = useRef(false);
  // Captura el modo al abrir. Si el usuario cierra el tour con este modal
  // todavía visible, una acción sobre un incidente real sigue bloqueada.
  const sandboxAtOpenRef = useRef(trainingTour.active);
  const headingId = useId();
  const countdownAllowed = useMemo(
    () => shouldUseIncidentCountdown(incident) && shouldUseIncidentCountdown(fetched),
    [fetched, incident],
  );

  /* Fetch details with abort */
  useEffect(() => {
    if (isTrainingIncident) {
      setFetched(incident);
      setErr(null);
      setLoading(false);
      return;
    }
    const ac = new AbortController();
    (async () => {
      try {
        const id = (incident?.incidenteId ?? incident?.id) as string | number | undefined;
        if (!id) throw new Error("Incidente sin ID válido");
        const r = await fetch(`${INCIDENTES}/${id}${sourceQuery(incident)}`, {
          credentials: "include",
          cache: "no-store",
          signal: ac.signal,
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = await r.json();
        if (j?.success === false) throw new Error(j?.error || "Error");
        if (ac.signal.aborted) return;
        setFetched(j?.data ?? j);
      } catch (e: any) {
        if (ac.signal.aborted) return;
        setErr(e?.message || "Error al cargar incidente");
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    })();
    return () => ac.abort();
  }, [incident, isTrainingIncident]);

  /* Timer tick each 1s */
  useEffect(() => {
    if (!countdownAllowed) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [countdownAllowed]);

  /* Derived */
  const imgs = useMemo(() => {
    const x = (fetched || incident) as Incident;
    let list: string[] = [];
    if (Array.isArray(x.imagenes) && x.imagenes.length) list = x.imagenes;
    else list = [x.imagen1, x.imagen2, x.imagen3, x.imagen4].filter(Boolean) as string[];
    return list.map((p) => normalizeImageUrl(p, x));
  }, [fetched, incident]);

  const startMs = useMemo(
    () => new Date(fetched?.fechaInicio ?? incident?.fechaInicio ?? Date.now()).getTime(),
    [fetched, incident]
  );
  const leftMs = Math.max(0, WINDOW_DURATION_MS - (now - startMs));
  const pct = Math.round(((WINDOW_DURATION_MS - leftMs) / WINDOW_DURATION_MS) * 100);
  const estado = (fetched?.estado || incident?.estado || "ABIERTO") as keyof typeof ESTADO_COLORS;
  const canActOnIncident = estado === "ABIERTO" && (!countdownAllowed || leftMs > 0);
  const showTimer = countdownAllowed && canActOnIncident;

  /* Actions */
  const doResolve = useCallback(async () => {
    if (!resolution.trim()) return alert("Describe la resolución.");
    if (actionLockRef.current) return;
    actionLockRef.current = true;
    try {
      if ((trainingTour.active || sandboxAtOpenRef.current) && !isTrainingIncident) {
        alert("En capacitación sólo puedes resolver SIM-INC-041. No se modificó ningún incidente real.");
        return;
      }
      // El controlador padre es el único dueño de la mutación. Antes este
      // componente hacía POST y después llamaba al padre, duplicando la acción.
      await onResolve(resolution.trim());
      setVisible(false);
    } catch {
      alert("No se pudo resolver el incidente.");
    } finally {
      actionLockRef.current = false;
    }
  }, [isTrainingIncident, onResolve, resolution, trainingTour.active]);

  const doSkip = useCallback(async () => {
    if (actionLockRef.current) return;
    actionLockRef.current = true;
    try {
      if ((trainingTour.active || sandboxAtOpenRef.current) && !isTrainingIncident) {
        alert("En capacitación sólo puedes omitir SIM-INC-041. No se modificó ningún incidente real.");
        return;
      }
      const confirmed = window.confirm(
        isTrainingIncident
          ? "¿Confirmas omitir el incidente SIM? Sólo cambiará el escenario ficticio de capacitación."
          : "¿Confirmas cerrar el incidente sin resolver? Esta decisión queda registrada y puede cancelar el movimiento relacionado."
      );
      if (!confirmed) return;
      await onSkip();
      setVisible(false);
    } catch {
      alert("No se pudo cerrar el incidente sin resolver.");
    } finally {
      actionLockRef.current = false;
    }
  }, [isTrainingIncident, onSkip, trainingTour.active]);

  const close = useCallback(() => setVisible(false), []);
  const continueFn = useCallback(() => {
    setVisible(false);
    onContinue();
  }, [onContinue]);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onEsc, { passive: true });
    return () => window.removeEventListener("keydown", onEsc);
  }, [close]);

  if (!visible) return null;
  const current = fetched || incident;

  const modal = (
    <div className="fixed inset-0 z-[9999]">
      <div className="absolute inset-0 bg-slate-950/70" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.35),transparent_55%),radial-gradient(ellipse_at_bottom,rgba(15,23,42,0.85),transparent_60%)]" />
      <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:28px_28px]" />
      <div className="relative z-10 flex h-full w-full items-stretch justify-center p-0">
        <GuidedTarget id="incident-detail-dialog" className="h-full w-full">
          <div
            className="flex h-full min-h-0 w-full max-w-none flex-col overflow-hidden rounded-none border border-white/10 bg-white/90 shadow-[0_30px_120px_rgba(15,23,42,0.45)] backdrop-blur dark:bg-slate-900/95 dark:text-slate-100"
            role="dialog"
            aria-labelledby={headingId}
            aria-modal="true"
          >
          {/* Header */}
          <div className="relative overflow-hidden bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 px-4 sm:px-6 py-4 sm:py-6">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.35),transparent_55%)] opacity-70" />
            <div className="relative flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3 sm:gap-4">
                <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-400/10 ring-1 ring-emerald-300/30">
                  <AlertTriangle className="h-5 w-5 text-emerald-200" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-emerald-200/70">
                    Incidente
                    {(current?.incidenteId || current?.id) && (
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/80">
                        #{current?.incidenteId ?? current?.id}
                      </span>
                    )}
                  </div>
                  <h1 id={headingId} className="mt-1 truncate text-base sm:text-lg font-bold text-white">
                    {truncate(current?.descripcion || "Incidente", 200)}
                  </h1>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-white/70">
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-1">
                      <Building className="h-3.5 w-3.5" />
                      {current?.movimiento?.empresa?.nombre || "Empresa no especificada"}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-1">
                      <Train className="h-3.5 w-3.5" />
                      {current?.movimiento?.locomotiveNumber ? `#${current.movimiento.locomotiveNumber}` : "Locomotora N/D"}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={close}
                className="rounded-md p-2 text-white/90 hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
                aria-label="Cerrar ventana sin modificar el incidente"
                title="Cerrar ventana sin modificar el incidente"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {showTimer && <TimerBar leftMs={leftMs} pct={pct} />}
          </div>

          {/* Status */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-white/70 px-4 sm:px-6 py-3 text-xs dark:bg-slate-900/70 dark:border-slate-800">
            <div
              className={cn(
                "inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/70 px-3 py-1 font-semibold uppercase tracking-wide dark:border-slate-700/60 dark:bg-slate-900/60",
                ESTADO_COLORS[estado]
              )}
            >
              <Info className="h-4 w-4" />
              <span>{estado}</span>
            </div>
            {showTimer && (
              <div className={cn("text-[10px] sm:text-xs font-semibold", urgencyFor(pct).color)}>
                {urgencyFor(pct).label}
              </div>
            )}
          </div>

          {/* Tabs (mobile only) */}
          <div className="border-b border-white/10 bg-white/80 px-4 py-3 dark:bg-slate-900/80 dark:border-slate-800 md:hidden">
            <div className="relative mx-auto flex w-full max-w-md items-center rounded-full bg-slate-100/90 p-1 shadow-inner dark:bg-slate-800/80">
              <div
                className="absolute inset-y-1 left-1 w-1/2 rounded-full bg-white shadow transition-transform duration-300 dark:bg-slate-900"
                style={{ transform: tab === 0 ? "translateX(0)" : "translateX(100%)" }}
                aria-hidden
              />
              <button
                onClick={() => setTab(0)}
                className={cn(
                  "relative z-10 flex flex-1 items-center justify-center gap-2 rounded-full px-3 py-2 text-xs font-semibold transition-colors",
                  tab === 0 ? "text-emerald-700 dark:text-emerald-300" : "text-slate-500 dark:text-slate-400"
                )}
                role="tab"
                aria-selected={tab === 0}
              >
                <Info className="h-4 w-4 inline-block" />
                Detalles
              </button>
              <button
                onClick={() => setTab(1)}
                className={cn(
                  "relative z-10 flex flex-1 items-center justify-center gap-2 rounded-full px-3 py-2 text-xs font-semibold transition-colors",
                  tab === 1 ? "text-emerald-700 dark:text-emerald-300" : "text-slate-500 dark:text-slate-400"
                )}
                role="tab"
                aria-selected={tab === 1}
              >
                <ImageIcon className="h-4 w-4 inline-block" />
                Imágenes {imgs.length ? `(${imgs.length})` : ""}
              </button>
            </div>
          </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto bg-slate-50 dark:bg-slate-900">
          {loading ? (
            <div className="py-10 text-center">
              <div className="inline-flex items-center gap-3 text-slate-500 dark:text-slate-400">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                Cargando detalles del incidente...
              </div>
            </div>
          ) : err ? (
            <div className="p-4 sm:p-6">
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 shadow-sm dark:border-rose-800 dark:bg-rose-900/20">
                <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300">
                  <AlertTriangle className="h-5 w-5" />
                  <span className="font-semibold">Error</span>
                </div>
                <p className="mt-2 text-rose-700 dark:text-rose-200">{err}</p>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 sm:gap-6 p-4 sm:p-6 md:grid-cols-[1.1fr_0.9fr]">
              <div className={cn(tab === 0 ? "block" : "hidden", "md:block")} role="tabpanel">
                <div className="space-y-4 sm:space-y-5">
                  <section className="rounded-2xl border border-white/60 bg-white/85 p-4 shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur dark:border-slate-700/60 dark:bg-slate-900/80">
                    <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-800 dark:text-slate-100">
                      <Info className="h-5 w-5 text-emerald-600" />
                      Descripción
                    </h2>
                    <p className="text-slate-700 leading-relaxed dark:text-slate-200">
                      {current?.descripcion || "Sin descripción disponible"}
                    </p>
                  </section>

                  <section className="rounded-2xl border border-white/60 bg-white/85 p-4 shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur dark:border-slate-700/60 dark:bg-slate-900/80">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <div>
                        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider dark:text-slate-400">Reportado</div>
                        <div className="mt-1 text-sm font-medium text-slate-700 dark:text-slate-200">
                          {new Date(startMs).toLocaleString("es-ES", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider dark:text-slate-400">Empresa</div>
                        <div className="mt-1 flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                          <Building className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                          {current?.movimiento?.empresa?.nombre || "No especificada"}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider dark:text-slate-400">Locomotora</div>
                        <div className="mt-1 flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                          <Train className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                          {current?.movimiento?.locomotiveNumber ? `#${current.movimiento.locomotiveNumber}` : "No especificada"}
                        </div>
                      </div>
                    </div>
                  </section>

                  {operatorComment && (
                    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm dark:border-amber-800 dark:bg-amber-900/20">
                      <h2 className="mb-3 text-base font-semibold text-amber-800 dark:text-amber-200">Comentario del operador</h2>
                      <p className="text-amber-700 leading-relaxed dark:text-amber-200/90">{operatorComment}</p>
                    </section>
                  )}

                  {estado === "ABIERTO" && (
                    <GuidedTarget
                      id="incident-resolution-panel"
                      as="section"
                      className="rounded-2xl border border-white/60 bg-white/85 p-4 shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur dark:border-slate-700/60 dark:bg-slate-900/80"
                    >
                      <h2 className="mb-3 text-base font-semibold text-slate-800 dark:text-slate-100">Resolución del incidente</h2>
                      <p className="mb-3 text-xs font-semibold leading-5 text-slate-500 dark:text-slate-400">
                        Resolver cambia el incidente a RESUELTO. Cerrar sin resolver lo deja como cierre operativo sin registrar solución.
                      </p>
                      <textarea
                        data-guide-id="incident-resolution-input"
                        value={resolution}
                        onChange={(e) => setResolution(e.target.value)}
                        rows={5}
                        className="w-full resize-none rounded-xl border border-slate-300 bg-slate-50 p-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        placeholder="Describe las acciones tomadas..."
                        maxLength={1000}
                      />
                      <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">{resolution.length}/1000</div>
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        <button
                          onClick={() => setResolution("")}
                          disabled={!resolution}
                          className={cn(
                            "rounded-xl px-4 py-2 text-sm font-semibold transition-colors sm:flex-1",
                            resolution
                              ? "bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
                              : "bg-slate-100 text-slate-400 cursor-not-allowed dark:bg-slate-800 dark:text-slate-600"
                          )}
                        >
                          Limpiar
                        </button>
                        <button
                          onClick={doResolve}
                          disabled={!resolution.trim()}
                          className={cn(
                            "rounded-xl px-4 py-2 text-sm font-semibold text-white transition-colors sm:flex-[2]",
                            resolution.trim()
                              ? "bg-emerald-600 hover:bg-emerald-700"
                              : "bg-slate-300 cursor-not-allowed dark:bg-slate-700"
                          )}
                        >
                          Confirmar resolución
                        </button>
                      </div>
                    </GuidedTarget>
                  )}
                </div>
              </div>

              <div className={cn(tab === 1 ? "block" : "hidden", "md:block")} role="tabpanel">
                <ImageGallery
                  images={imgs}
                  index={idx}
                  onChange={setIdx}
                  fullscreen={fullscreen}
                  onToggleFullscreen={() => setFullscreen((v) => !v)}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <GuidedTarget id="incident-actions" className="flex flex-col gap-2 border-t border-white/10 bg-white/80 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80 sm:flex-row sm:px-6 sm:py-4">
          {canActOnIncident ? (
            <>
              <button
                data-guide-id="incident-resolve-action"
                data-training-incident-resolve={isTrainingIncident ? "true" : undefined}
                onClick={doResolve}
                disabled={!resolution.trim()}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold text-white shadow-lg transition-all",
                  resolution.trim()
                    ? "bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700"
                    : "bg-slate-300 cursor-not-allowed dark:bg-slate-700"
                )}
                      >
                        <CheckCircle2 className="h-5 w-5" />
                Resolver incidente
                      </button>
                      <button
                        data-guide-id="incident-close-action"
                        onClick={doSkip}
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-3 font-semibold text-white shadow-lg hover:from-amber-500 hover:to-amber-700 transition-all"
                      >
                        <FastForward className="h-5 w-5" />
                Cerrar sin resolver
                      </button>
            </>
          ) : (
            <button
              data-guide-id="incident-continue-action"
              onClick={continueFn}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 px-4 py-3 font-semibold text-white shadow-lg hover:from-emerald-600 hover:to-emerald-800 transition-all"
            >
              Continuar
            </button>
          )}
        </GuidedTarget>
          </div>
        </GuidedTarget>
      </div>
    </div>
  );

  if (typeof document === "undefined") return modal;
  return createPortal(modal, document.body);
}
