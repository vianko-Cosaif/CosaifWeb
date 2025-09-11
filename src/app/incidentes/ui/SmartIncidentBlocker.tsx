/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  imagen1?: string;
  imagen2?: string;
  imagen3?: string;
  imagen4?: string;
  imagenes?: string[];
  movimiento?: {
    empresa?: { nombre?: string };
    locomotiveNumber?: string;
  };
}

interface Props {
  incident: Incident;
  onResolve: (comments?: string) => void;
  onContinue: () => void;
  onSkip: () => void;
  operatorComment?: string;
}

/* === CONSTANTS === */
const PROXY = "/bff";
const INCIDENTES = `${PROXY}/incidentes`;
const WINDOW_DURATION_MS = 10 * 60 * 1000;

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
function getCookie(name: string): string {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : "";
}
function authHeaders() {
  const t = getCookie("token");
  return t ? ({ Authorization: `Bearer ${t}` } as Record<string, string>) : {};
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

/* === IMAGE (fix stretch by applying class to <img>) === */
type ImageWithAuthProps = {
  src: string;
  alt?: string;
  containerClassName?: string;
  imgClassName?: string; // <- IMPORTANT: allows object-contain/cover on the IMG itself
};

function ImageWithAuth({
  src,
  alt = "",
  containerClassName,
  imgClassName = "object-contain",
}: ImageWithAuthProps) {
  const [url, setUrl] = useState<string>(EMPTY_IMAGE);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let alive = true;
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
          headers: authHeaders(),
          credentials: "include",
          cache: "no-store",
        });
        if (!r.ok) throw new Error("img fetch");
        const b = await r.blob();
        if (!alive) return;
        const u = URL.createObjectURL(b);
        revoked = u;
        setUrl(u);
      } catch {
        if (!alive) return;
        setUrl(EMPTY_IMAGE);
        setHasError(true);
      } finally {
        if (alive) setIsLoading(false);
      }
    })();

    return () => {
      alive = false;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [src]);

  return (
    <div className={cn("relative", containerClassName)}>
      <img
        src={url}
        alt={alt}
        draggable={false}
        className={cn("block h-full w-full select-none", imgClassName)}
      />
      {isLoading && (
        <div className="absolute inset-0 grid place-items-center bg-slate-100">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
        </div>
      )}
      {hasError && !isLoading && (
        <div className="absolute inset-0 grid place-items-center bg-slate-100 text-slate-500">
          <AlertTriangle className="h-6 w-6" />
        </div>
      )}
    </div>
  );
}

/* === TIMER === */
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

/* === GALLERY (responsive + no stretch) === */
function ImageGallery({
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
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [prev, next]);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Main viewer: adapt height per breakpoint, use object-contain on IMG */}
      <div
        className={cn(
          "relative overflow-hidden rounded-xl border bg-white shadow-sm",
          fullscreen ? "h-[70vh] sm:h-[78vh]" : "h-[45vh] sm:h-[380px] lg:h-[480px]"
        )}
      >
        {total ? (
          <ImageWithAuth
            src={images[i]}
            alt={`Imagen ${i + 1} de ${total}`}
            containerClassName="h-full w-full bg-slate-50"
            imgClassName="object-contain"
          />
        ) : (
          <img src={EMPTY_IMAGE} className="h-full w-full object-contain" alt="" />
        )}

        {/* Controls */}
        <div className="absolute inset-x-0 bottom-3 mx-auto flex w-[220px] items-center justify-between rounded-full bg-black/60 px-3 py-1 text-white">
          <button
            onClick={prev}
            disabled={i === 0}
            className={cn("rounded p-1", i === 0 ? "opacity-50 cursor-not-allowed" : "hover:bg-white/20")}
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
              "rounded p-1",
              i === total - 1 ? "opacity-50 cursor-not-allowed" : "hover:bg-white/20"
            )}
            aria-label="Siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <button
          onClick={onToggleFullscreen}
          className="absolute right-3 top-3 rounded-md bg-black/55 p-2 text-white hover:bg-black/70"
          aria-label={fullscreen ? "Salir pantalla completa" : "Pantalla completa"}
          title={fullscreen ? "Salir pantalla completa" : "Pantalla completa"}
        >
          {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
      </div>

      {/* Thumbs: fixed square, images object-cover but contained inside square to avoid warp */}
      <div className="rounded-xl border bg-white p-3 sm:p-4 shadow-sm">
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 sm:gap-3">
          {(total ? images : Array(4).fill("")).map((src, idx) => {
            const active = idx === i;
            return (
              <button
                key={idx}
                onClick={() => onChange(idx)}
                disabled={!src}
                className={cn(
                  "relative aspect-square overflow-hidden rounded-lg border",
                  src ? "hover:border-slate-300" : "opacity-50 cursor-not-allowed",
                  active ? "border-emerald-600 ring-2 ring-emerald-600/20" : "border-slate-200"
                )}
                aria-label={src ? `Ver imagen ${idx + 1}` : "Miniatura no disponible"}
              >
                {src ? (
                  <ImageWithAuth
                    src={src}
                    containerClassName="h-full w-full"
                    imgClassName="object-cover" // cover in thumbnail is ok (square crop)
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
}

/* === MAIN === */
export default function SmartIncidentBlocker({
  incident,
  onResolve,
  onContinue,
  onSkip,
  operatorComment,
}: Props) {
  const [tab, setTab] = useState<0 | 1>(0);
  const [visible, setVisible] = useState(true);
  const [resolution, setResolution] = useState("");
  const [fetched, setFetched] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [now, setNow] = useState<number>(Date.now());
  const [fullscreen, setFullscreen] = useState(false);

  /* Fetch details */
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const id = (incident?.incidenteId ?? incident?.id) as string | number | undefined;
        if (!id) throw new Error("Incidente sin ID válido");
        const r = await fetch(`${INCIDENTES}/${id}`, {
          headers: authHeaders(),
          credentials: "include",
          cache: "no-store",
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = await r.json();
        if (j?.success === false) throw new Error(j?.error || "Error");
        if (!live) return;
        setFetched(j?.data ?? j);
      } catch (e: any) {
        if (!live) return;
        setErr(e?.message || "Error al cargar incidente");
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [incident]);

  /* Timer */
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  /* Derived */
  const imgs = useMemo(() => {
    const x = (fetched || incident) as Incident;
    let list: string[] = [];
    if (Array.isArray(x.imagenes) && x.imagenes.length) list = x.imagenes;
    else list = [x.imagen1, x.imagen2, x.imagen3, x.imagen4].filter(Boolean) as string[];
    return list.map((p) => (/^https?:\/\//i.test(p) ? viaProxy(p) : viaProxy(`/incidentes/imagen/${encodeURIComponent(p)}`)));
  }, [fetched, incident]);

  const startMs = useMemo(
    () => new Date(fetched?.fechaInicio ?? incident?.fechaInicio ?? Date.now()).getTime(),
    [fetched, incident]
  );
  const leftMs = Math.max(0, WINDOW_DURATION_MS - (now - startMs));
  const pct = Math.round(((WINDOW_DURATION_MS - leftMs) / WINDOW_DURATION_MS) * 100);
  const estado = (fetched?.estado || incident?.estado || "ABIERTO") as keyof typeof ESTADO_COLORS;
  const showTimer = leftMs > 0 && estado === "ABIERTO";

  /* Actions */
  const doResolve = useCallback(async () => {
    if (!resolution.trim()) return alert("Describe la resolución.");
    try {
      const id = (fetched?.id ?? incident?.id) as string | number;
      const r = await fetch(`${INCIDENTES}/${id}/resuelto`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        credentials: "include",
        body: JSON.stringify({ estado: "RESUELTO", comentario: resolution.trim() }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setVisible(false);
      onResolve(resolution.trim());
    } catch {
      alert("No se pudo resolver el incidente.");
    }
  }, [fetched, incident, resolution, onResolve]);

  const doSkip = useCallback(async () => {
    try {
      const id = (fetched?.id ?? incident?.id) as string | number;
      const r = await fetch(`${INCIDENTES}/${id}/cerrar`, {
        method: "POST",
        headers: { ...authHeaders() },
        credentials: "include",
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setVisible(false);
      onSkip();
    } catch {
      alert("No se pudo cerrar el incidente.");
    }
  }, [fetched, incident, onSkip]);

  const close = useCallback(() => setVisible(false), []);
  const continueFn = useCallback(() => {
    setVisible(false);
    onContinue();
  }, [onContinue]);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [close]);

  if (!visible) return null;
  const current = fetched || incident;

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch sm:items-start justify-center bg-slate-900/70 p-0 sm:p-4"
      role="dialog"
      aria-labelledby="incident-title"
      aria-modal="true"
    >
      <div className="w-full h-dvh sm:h-auto sm:mt-6 sm:max-h-[92vh] max-w-screen-2xl overflow-hidden bg-white shadow-2xl sm:rounded-2xl flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-700 to-emerald-900 px-4 sm:px-6 py-4 sm:py-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className={cn("h-3 w-3 rounded-full flex-shrink-0", urgencyFor(pct).bar)} />
              <h1 id="incident-title" className="truncate text-base sm:text-lg font-bold text-white">
                {truncate(current?.descripcion || "Incidente", 100)}
              </h1>
            </div>
            <button
              onClick={close}
              className="rounded-md p-1 text-white/90 hover:bg-white/10 transition-colors"
              aria-label="Cerrar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          {showTimer && <TimerBar leftMs={leftMs} pct={pct} />}
        </div>

        {/* Status */}
        <div className="flex items-center justify-between border-b px-4 sm:px-6 py-3 bg-slate-50">
          <div className={cn("flex items-center gap-2 text-xs sm:text-sm font-semibold", ESTADO_COLORS[estado])}>
            <Info className="h-4 w-4" />
            <span className="uppercase">{estado}</span>
          </div>
          {showTimer && <div className={cn("text-[10px] sm:text-xs font-semibold", urgencyFor(pct).color)}>{urgencyFor(pct).label}</div>}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b px-2 sm:px-4 bg-white">
          <button
            onClick={() => setTab(0)}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 border-b-4 px-2 sm:px-3 py-2 sm:py-3 text-xs sm:text-sm font-semibold transition-colors",
              tab === 0 ? "border-emerald-600 text-emerald-700" : "border-transparent text-slate-500 hover:text-slate-700"
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
              tab === 1 ? "border-emerald-600 text-emerald-700" : "border-transparent text-slate-500 hover:text-slate-700"
            )}
            role="tab"
            aria-selected={tab === 1}
          >
            <ImageIcon className="h-4 w-4" />
            Imágenes {imgs.length ? `(${imgs.length})` : ""}
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50">
          {loading ? (
            <div className="py-10 text-center">
              <div className="inline-flex items-center gap-3 text-slate-500">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                Cargando detalles del incidente...
              </div>
            </div>
          ) : err ? (
            <div className="rounded-lg bg-rose-50 border border-rose-200 p-4">
              <div className="flex items-center gap-2 text-rose-800">
                <AlertTriangle className="h-5 w-5" />
                <span className="font-semibold">Error</span>
              </div>
              <p className="mt-2 text-rose-700">{err}</p>
            </div>
          ) : tab === 0 ? (
            <div className="space-y-4" role="tabpanel">
              <section className="rounded-xl border bg-white p-4 shadow-sm">
                <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-800">
                  <Info className="h-5 w-5 text-emerald-600" />
                  Descripción
                </h2>
                <p className="text-slate-700 leading-relaxed">
                  {current?.descripcion || "Sin descripción disponible"}
                </p>
              </section>

              <section className="rounded-xl border bg-white p-4 shadow-sm">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <div className="text-xs font-semibold text-slate-500 uppercase">Reportado</div>
                    <div className="mt-1 text-sm font-medium text-slate-700">
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
                    <div className="text-xs font-semibold text-slate-500 uppercase">Empresa</div>
                    <div className="mt-1 flex items-center gap-2 text-sm font-medium text-slate-700">
                      <Building className="h-4 w-4 text-slate-500" />
                      {current?.movimiento?.empresa?.nombre || "No especificada"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-500 uppercase">Locomotora</div>
                    <div className="mt-1 flex items-center gap-2 text-sm font-medium text-slate-700">
                      <Train className="h-4 w-4 text-slate-500" />
                      {current?.movimiento?.locomotiveNumber ? `#${current.movimiento.locomotiveNumber}` : "No especificada"}
                    </div>
                  </div>
                </div>
              </section>

              {operatorComment && (
                <section className="rounded-xl border bg-amber-50 border-amber-200 p-4 shadow-sm">
                  <h2 className="mb-3 text-base font-semibold text-amber-800">Comentario del operador</h2>
                  <p className="text-amber-700 leading-relaxed">{operatorComment}</p>
                </section>
              )}

              {estado === "ABIERTO" && (
                <section className="rounded-xl border bg-white p-4 shadow-sm">
                  <h2 className="mb-3 text-base font-semibold text-slate-800">Resolución del incidente</h2>
                  <textarea
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    rows={5}
                    className="w-full resize-none rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                    placeholder="Describe las acciones tomadas..."
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
                      onClick={doResolve}
                      disabled={!resolution.trim()}
                      className={cn(
                        "flex-[2] rounded-lg px-4 py-2 text-sm font-semibold text-white",
                        resolution.trim() ? "bg-emerald-600 hover:bg-emerald-700" : "bg-slate-300 cursor-not-allowed"
                      )}
                    >
                      Confirmar resolución
                    </button>
                  </div>
                </section>
              )}
            </div>
          ) : (
            <div role="tabpanel">
              <ImageGallery
                images={imgs}
                index={idx}
                onChange={setIdx}
                fullscreen={fullscreen}
                onToggleFullscreen={() => setFullscreen((v) => !v)}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 border-t bg-white px-4 sm:px-6 py-3 sm:py-4">
          {showTimer && estado === "ABIERTO" ? (
            <>
              <button
                onClick={doResolve}
                disabled={!resolution.trim()}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold text-white",
                  resolution.trim() ? "bg-emerald-600 hover:bg-emerald-700" : "bg-slate-300 cursor-not-allowed"
                )}
              >
                <CheckCircle2 className="h-5 w-5" />
                Resolver
              </button>
              <button
                onClick={doSkip}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 font-semibold text-white hover:bg-amber-600"
              >
                <FastForward className="h-5 w-5" />
                Omitir
              </button>
            </>
          ) : (
            <button
              onClick={continueFn}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white hover:bg-emerald-800"
            >
              Continuar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
