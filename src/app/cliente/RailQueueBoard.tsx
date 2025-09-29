"use client";
import { useEffect, useMemo, useRef, useState, startTransition } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

/* ===== Tipos ===== */
type Ronda = {
  id: number;
  rondaNumero: number;
  orden: number;
  concluido: boolean;
  empresa?: { id: number; nombre: string } | null;
  movimiento?: {
    id?: number;
    viaOrigen?: { nombre?: string | null } | null;
    viaDestino?: { nombre?: string | null } | null;
    lavado?: boolean;
    torno?: boolean;
    estado?: string | null;
    prioridad?: "BAJA" | "ALTA" | null;
    locomotiveNumber?: number | string | null;
    locomotora?: string | null;
  } | null;
  movimientoId?: number | null;
};

type RondaInfo = {
  empresa: { id: number; nombre: string };
  movimiento: {
    id?: number;
    viaOrigen?: { nombre?: string | null } | null;
    viaDestino?: { nombre?: string | null } | null;
    lavado: boolean;
    torno: boolean;
    estado?: string;
    prioridad?: "BAJA" | "ALTA";
    locomotiveNumber?: number | string;
    locomotora?: string | null;
  };
  movimientoId?: number;
};

type ToastKind = "move" | "new" | "done" | "warning";
type Toast = { id: number; text: string; kind: ToastKind };

/* ===== Utils ===== */
const fmtList = new Intl.ListFormat("es", { style: "short", type: "conjunction" });
const codeFrom = (inf?: RondaInfo, fallbackId?: number) =>
  String(inf?.movimientoId ?? inf?.movimiento?.id ?? fallbackId ?? "—");

const fmtLoco = (v: unknown) => {
  if (v == null) return "N/D";
  const s = String(v).replace(/\D+/g, "");
  if (!s) return "N/D";
  return s.padStart(4, "0").slice(0, 16);
};

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const r = await fetch(url, { cache: "no-store", credentials: "include", mode: "same-origin", signal });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`${r.status} ${r.statusText} :: ${txt.slice(0, 200)}`);
  }
  return (await r.json()) as T;
}

function useVisibleInterval(fn: () => void, delay: number | null, deps: React.DependencyList = []) {
  useEffect(() => {
    if (!delay) return;
    const id = window.setInterval(() => { if (document.visibilityState === "visible") fn(); }, delay);
    const onVis = () => { if (document.visibilityState === "visible") fn(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delay, ...deps]);
}
function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<number[]>([]);
  useEffect(() => () => { timers.current.forEach(clearTimeout); timers.current = []; }, []);
  const push = (text: string, kind: ToastKind) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, kind }]);
    const tid = window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
    timers.current.push(tid);
  };
  const dismiss = (id: number) => setToasts((t) => t.filter((x) => x.id !== id));
  return { toasts, push, dismiss, setToasts };
}
function useLocalStorageBoolean(key: string, initial = false) {
  const [v, setV] = useState<boolean>(() => {
    if (typeof window === "undefined") return initial;
    const raw = window.localStorage.getItem(key);
    return raw === null ? initial : raw === "1";
  });
  useEffect(() => { try { window.localStorage.setItem(key, v ? "1" : "0"); } catch {} }, [key, v]);
  return [v, setV] as const;
}
function useOnline() {
  const [online, setOnline] = useState<boolean>(typeof navigator === "undefined" ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  return online;
}
function useRelativeClock(periodMs = 30_000) {
  const [, force] = useState(0);
  useVisibleInterval(() => force((x) => x + 1), periodMs, [periodMs]);
}
function timeAgo(ts?: number | null) {
  if (!ts) return "—";
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h`;
}

/* ===== Componente ===== */
export default function RailQueueBoard(
  {
  localidadId,
  autoMs = 120_000,
  nextCount = 5,
}: { localidadId: number; autoMs?: number; nextCount?: number }) {
  const prefersReduced = useReducedMotion();
  const online = useOnline();
  useRelativeClock();

  const boardRef = useRef<HTMLDivElement | null>(null);
  const [isFs, setIsFs] = useState(false);

  const [items, setItems] = useState<Ronda[]>([]);
  const [info, setInfo] = useState<Record<number, RondaInfo>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [polling, setPolling] = useLocalStorageBoolean("rail-queue:polling", true);

  const [soundOn, setSoundOn] = useLocalStorageBoolean("rail-queue:soundOn", false);
  const bellRef = useRef<HTMLAudioElement | null>(null);

  const { toasts, push: pushToast, dismiss } = useToasts();

  const prevIdsRef = useRef<number[]>([]);
  const lastCurrentId = useRef<number | null>(null);
  const firstLoad = useRef(true);
  const lastOkAt = useRef<number | null>(null);

  const reqSeq = useRef(120);
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    // mount
  }, [localidadId]);

  async function load(showRefreshing = false) {
    const mySeq = ++reqSeq.current;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    if (showRefreshing) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const url = `/api/cliente/rondas?localidadId=${localidadId}`;
      const data = await fetchJson<Ronda[]>(url, ac.signal);
      data.sort((a, b) => a.rondaNumero - b.rondaNumero || a.orden - b.orden);

      const prev = prevIdsRef.current;
      const nextIds = data.map((d) => d.id);

      if (!firstLoad.current) {
        if (prev.length && nextIds[0] && nextIds[0] !== prev[0]) {
          const curR = data[0];
          const curCode = String(curR.movimiento?.id ?? curR.movimientoId ?? curR.id);
          pushToast(`Se movió la orden a ${curCode}`, "move");
        }
        const prevSet = new Set(prev);
        const created = nextIds.filter((id) => !prevSet.has(id));
        const removed = prev.filter((id) => !nextIds.includes(id));
        if (created.length) {
          const codes = created.map((id) => String(data.find((r) => r.id === id)?.movimiento?.id ?? id));
          pushToast(`Nueva(s) orden(es): ${fmtList.format(codes)}`, "new");
        }
        if (removed.length) {
          const codes = removed.map((id) => String(id));
          pushToast(`Orden(es) ${fmtList.format(codes)} salió`, "done");
        }
      }

      prevIdsRef.current = nextIds;
      if (mySeq !== reqSeq.current) return;

      setItems(data);

      // map info
      const mapFromList: Record<number, RondaInfo> = {};
      for (const r of data) {
        const mv = (r.movimiento ?? null) as Ronda["movimiento"];
        const emp = r.empresa ?? null;
        mapFromList[r.id] = {
          empresa: { id: emp?.id ?? 0, nombre: emp?.nombre ?? "—" },
          movimiento: {
            id: mv?.id,
            viaOrigen: mv?.viaOrigen ?? null,
            viaDestino: mv?.viaDestino ?? null,
            lavado: Boolean(mv?.lavado),
            torno: Boolean(mv?.torno),
            estado: mv?.estado ?? undefined,
            prioridad: (mv?.prioridad as "BAJA" | "ALTA" | undefined) ?? undefined,
            locomotiveNumber: mv?.locomotiveNumber ?? mv?.locomotora ?? undefined,
            locomotora: mv?.locomotora ?? undefined,
          },
          movimientoId: (mv?.id ?? r.movimientoId ?? undefined) as number | undefined,
        };
      }
      startTransition(() => setInfo(mapFromList));
      lastOkAt.current = Date.now();
    } catch (err) {
      if (mySeq === reqSeq.current) pushToast(online ? "Error al cargar datos" : "Sin conexión", "warning");
      console.error("[RailQueueBoard] load error", err);
    } finally {
      if (mySeq === reqSeq.current) {
        setLoading(false);
        setRefreshing(false);
        firstLoad.current = false;
      }
    }
  }

  // Fullscreen control
  useEffect(() => {
    const onChange = () => setIsFs(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  const toggleFullscreen = () => {
    try {
      if (document.fullscreenElement) document.exitFullscreen();
      else boardRef.current?.requestFullscreen();
    } catch {}
  };

  // Shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === "r") { e.preventDefault(); load(true); }
      if (e.key === "a") setPolling((p) => !p);
      if (e.key === "s") setSoundOn((s) => !s);
      if (e.key === "f") toggleFullscreen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => { firstLoad.current = true; prevIdsRef.current = []; setInfo({}); setItems([]); setLoading(true); load(); }, [localidadId]);
  useVisibleInterval(() => polling && online && load(), polling ? autoMs || null : null, [autoMs, localidadId, polling, online]);

  useEffect(() => {
    const curId = items[0]?.id ?? null;
    if (soundOn && curId && lastCurrentId.current && curId !== lastCurrentId.current) {
      const el = bellRef.current;
      try { el?.pause?.(); if (el) { el.currentTime = 0; void el.play(); } } catch {}
    }
    lastCurrentId.current = curId;
  }, [items, soundOn]);

  const current = items[0];
  const curInfo = current ? info[current.id] : undefined;
  const next = useMemo(() => items.slice(1, nextCount + 1), [items, nextCount]);

  const lastAgo = timeAgo(lastOkAt.current);

  const curMov = curInfo?.movimiento;
  const locoText = fmtLoco(curMov?.locomotiveNumber ?? curMov?.locomotora);
  const viaO = curMov?.viaOrigen?.nombre || "";
  const viaD = curMov?.viaDestino?.nombre || "";

  const hasService = !!(curMov?.torno || curMov?.lavado);
  const serviceOrigin = curMov?.torno ? "Torno" : (curMov?.lavado ? "Lavado" : "");
  const desdeLbl = viaO || serviceOrigin;
  const hasAny = !!(desdeLbl || viaD || hasService);

  return (
    <main 
      ref={boardRef} 
      className="min-h-svh md:min-h-dvh bg-white text-slate-900 dark:bg-neutral-950 dark:text-slate-100"
    >
      {/* TOASTS: Responsive positioning */}
      <div className="fixed z-50 flex justify-center px-3 
                      inset-x-0 bottom-2 
                      sm:inset-auto sm:right-2 sm:top-2 sm:bottom-auto sm:left-auto sm:px-0
                      md:bottom-4 md:right-4 md:top-auto">
        <div className="space-y-2 w-full max-w-[min(95vw,420px)]">
          <AnimatePresence>
            {toasts.map((t) => {
              const bar =
                t.kind === "move" ? "border-l-4 border-emerald-500/80" :
                t.kind === "new"  ? "border-l-4 border-sky-500/80" :
                t.kind === "warning" ? "border-l-4 border-amber-500/80" :
                "border-l-4 border-slate-400/70";
              const tone =
                t.kind === "move" ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200" :
                t.kind === "new"  ? "bg-sky-50 text-sky-900 dark:bg-sky-950/40 dark:text-sky-200" :
                t.kind === "warning" ? "bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200" :
                "bg-slate-50 text-slate-900 dark:bg-slate-800 dark:text-slate-100";
              return (
                <motion.button
                  key={t.id}
                  initial={{ y: 20, opacity: 0, scale: 0.95 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  exit={{ y: 20, opacity: 0, scale: 0.95, transition: { duration: 0.18 } }}
                  role={t.kind === "warning" ? "alert" : "status"}
                  aria-live={t.kind === "warning" ? "assertive" : "polite"}
                  onClick={() => dismiss(t.id)}
                  className={`w-full text-left rounded-lg px-3 py-2.5 text-sm shadow-lg border ${bar} ${tone} 
                             hover:scale-[1.02] transition-transform duration-150`}
                  title="Clic para cerrar"
                >
                  <div className="flex items-center">
                    <span className="mr-2 text-base">
                      {t.kind === "move" ? "🔄" : t.kind === "new" ? "🆕" : t.kind === "warning" ? "⚠️" : "✅"}
                    </span>
                    <span className="flex-1">{t.text}</span>
                  </div>
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* TOOLBAR - Completamente responsive */}
      <div className="sticky top-0 z-40 border-b border-slate-200/60 bg-white/90 backdrop-blur-md 
                      dark:border-slate-800/60 dark:bg-neutral-950/90
                      pt-[env(safe-area-inset-top)]">
        <div className="mx-auto w-full max-w-screen-2xl">
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 
                          sm:justify-end sm:gap-3 sm:px-4 
                          md:px-6 md:py-2">
            
            {/* Left side - Status info */}
            <div className="flex items-center gap-2 flex-1 min-w-[150px]">
              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs
                                ${polling ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300" 
                                          : "border-slate-300 bg-slate-50 text-slate-600 dark:bg-slate-800/50 dark:text-slate-300"}`}>
                <span className={`inline-block h-2 w-2 rounded-full ${polling ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} aria-hidden />
                {polling ? "LIVE" : "PAUSED"}
              </span>
              
              <span className="hidden xs:inline text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                Últ. act: {lastAgo}
              </span>
            </div>

            {/* Right side - Controls */}
            <div className="flex items-center gap-1 flex-wrap justify-end">
              {!online && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
                  ⚠️ Offline
                </span>
              )}

              {/* Mobile first button sizing */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setSoundOn((s) => !s)}
                  className={`rounded-lg border px-2.5 py-1.5 text-xs transition-all duration-200 flex items-center gap-1
                             ${soundOn 
                                ? "border-emerald-400 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300" 
                                : "border-slate-300 bg-white text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                             } hover:scale-105 active:scale-95`}
                  title="Pitido al cambiar la orden actual"
                  aria-pressed={soundOn}
                >
                  <span className="text-sm">{soundOn ? "🔔" : "🔕"}</span>
                  <span className="hidden sm:inline">{soundOn ? "Sonido" : "Silencio"}</span>
                </button>

                <button
                  onClick={() => setPolling((p) => !p)}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs transition-all duration-200 
                             hover:scale-105 active:scale-95 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300
                             flex items-center gap-1"
                  title="Activar/pausar auto-actualización"
                  aria-pressed={polling}
                >
                  <span className="text-sm">{polling ? "⏸️" : "▶️"}</span>
                  <span className="hidden sm:inline">Auto</span>
                </button>

                <button
                  onClick={() => load(true)}
                  disabled={refreshing}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs transition-all duration-200 
                             hover:scale-105 active:scale-95 disabled:opacity-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300
                             flex items-center gap-1"
                  aria-busy={refreshing}
                  title="Refrescar"
                >
                  <span className="text-sm">{refreshing ? "⟳" : "↻"}</span>
                  <span className="hidden sm:inline">{refreshing ? "Actualizando…" : "Actualizar"}</span>
                </button>

                <button
                  onClick={toggleFullscreen}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs transition-all duration-200 
                             hover:scale-105 active:scale-95 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300
                             flex items-center gap-1"
                  title="Pantalla completa (f)"
                  aria-pressed={isFs}
                >
                  <span className="text-sm">{isFs ? "⤢" : "⤢"}</span>
                  <span className="hidden sm:inline">{isFs ? "Salir" : "Full"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL */}
      <section
        className="mx-auto w-full max-w-screen-2xl
                   px-3 sm:px-4 md:px-6 lg:px-8
                   py-4 sm:py-6 md:py-8
                   pb-[env(safe-area-inset-bottom)]"
        aria-busy={loading || refreshing}
      >
        <div className="grid gap-4 md:gap-6 lg:gap-8 lg:grid-cols-3">
          
          {/* COLUMNA IZQUIERDA - ORDEN ACTUAL */}
          <div className="lg:col-span-2 rounded-2xl p-4 sm:p-6 
                          bg-gradient-to-br from-white via-sky-50 to-white text-slate-800 
                          shadow-lg border border-slate-200
                          dark:from-neutral-900 dark:via-neutral-800 dark:to-neutral-900 dark:text-slate-100 dark:border-slate-700">
            
            {/* Header */}
            <div className="mb-4 flex flex-col xs:flex-row xs:items-center xs:justify-between gap-3">
              <div>
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-sky-600 to-emerald-600 bg-clip-text text-transparent">
                  Tablero de Rondas
                </h1>
                <div className="mt-1 text-xs tracking-widest font-medium text-slate-500 dark:text-slate-400 uppercase">
                  Orden Actual • Current Move
                </div>
              </div>
              
              <button
                onClick={() => load(true)}
                className="text-xs rounded-full px-4 py-2 border bg-white hover:bg-slate-50 transition-all duration-200 
                           dark:bg-slate-800 dark:hover:bg-slate-700 dark:border-slate-600
                           hover:scale-105 active:scale-95 flex items-center gap-2"
                disabled={refreshing}
                aria-busy={refreshing}
                title="Refrescar"
              >
                <span>{refreshing ? "⟳" : "↻"}</span>
                <span>{refreshing ? "Actualizando…" : "Actualizar"}</span>
              </button>
            </div>

            {/* Contenido de la orden actual */}
            <motion.div
              key={current?.id ?? "empty"}
              initial={{ scale: prefersReduced ? 1 : 0.985, opacity: prefersReduced ? 1 : 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 26 }}
              className="rounded-xl bg-white p-4 sm:p-6 border shadow-sm border-slate-200 
                         dark:bg-slate-900 dark:border-slate-700 min-h-[200px]"
            >
              {loading && !current ? (
                <SkeletonCurrent />
              ) : current ? (
                <>
                  {/* Header con locomotora y código */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3 sm:gap-4">
                      <motion.div
                        animate={prefersReduced ? {} : { scale: [1, 1.05, 1] }}
                        transition={prefersReduced ? {} : { repeat: Infinity, duration: 3 }}
                        className="grid h-12 w-12 sm:h-14 sm:w-14 place-items-center rounded-full 
                                   bg-gradient-to-br from-sky-100 to-emerald-100 border border-slate-200 
                                   dark:from-slate-800 dark:to-slate-700 dark:border-slate-600"
                      >
                        <span className="text-xl sm:text-2xl">🚆</span>
                      </motion.div>
                      <div>
                        <div className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">
                          Locomotora
                        </div>
                        <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
                          {locoText}
                        </div>
                        <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                          {curInfo?.empresa?.nombre ?? "—"}
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-xs text-slate-500 dark:text-slate-400">Código</div>
                      <div className="font-black tracking-widest bg-gradient-to-r from-sky-600 to-emerald-600 bg-clip-text text-transparent
                                     text-3xl xs:text-4xl sm:text-5xl md:text-6xl lg:text-7xl">
                        {codeFrom(curInfo, current.id)}
                      </div>
                    </div>
                  </div>

                  {/* Grid de información principal */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                    {/* Vía Origen */}
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 
                                    dark:border-slate-700 dark:bg-slate-800/50">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                        <span>↖️</span> Vía Origen
                      </div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {viaO || "—"}
                      </div>
                    </div>

                    {/* Vía Destino */}
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 
                                    dark:border-slate-700 dark:bg-slate-800/50">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                        <span>↘️</span> Vía Destino
                      </div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {viaD || "—"}
                      </div>
                    </div>

                    {/* Servicios */}
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 
                                    dark:border-slate-700 dark:bg-slate-800/50">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                        <span>⚙️</span> Servicios
                      </div>
                      <div className="flex gap-2">
                        <Chip ok={!!curMov?.lavado} icon="💧">Lavado</Chip>
                        <Chip ok={!!curMov?.torno} icon="⚙️">Torno</Chip>
                      </div>
                    </div>
                  </div>

                  {/* Información secundaria */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
                    <InfoBadge label="Estado" value={curMov?.estado ?? "—"} icon="📌" />
                    <InfoBadge label="Prioridad" value={curMov?.prioridad ?? "—"} icon="⚑" />
                    <InfoBadge label="Orden" value={String(current?.orden ?? "—")} icon="№" />
                    <InfoBadge label="Ronda" value={String(current?.rondaNumero ?? "—")} icon="🔁" />
                  </div>

                  {/* Instrucción */}
                  <motion.div
                    initial={{ x: prefersReduced ? 0 : -8, opacity: prefersReduced ? 1 : 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: prefersReduced ? 0 : 0.1 }}
                    className="rounded-xl bg-gradient-to-r from-sky-100 to-emerald-100 text-slate-900 
                               p-4 border border-slate-200 dark:from-slate-800 dark:to-slate-700 
                               dark:text-slate-100 dark:border-slate-600"
                  >
                    <p className="text-sm font-medium">
                      {hasAny ? (
                        <>Mover locomotora <b className="text-sky-700 dark:text-sky-300">{locoText}</b> desde <b className="text-emerald-700 dark:text-emerald-300">{desdeLbl || "—"}</b> hacia <b className="text-emerald-700 dark:text-emerald-300">{viaD || "—"}</b>.</>
                      ) : (
                        <>Mover locomotora <b className="text-sky-700 dark:text-sky-300">{locoText}</b> entre <b>—</b> y <b>—</b>.</>
                      )}
                    </p>
                  </motion.div>
                </>
              ) : (
                <div className="py-12 text-center">
                  <div className="mb-4 text-5xl">🗂️</div>
                  <div className="text-lg font-semibold text-slate-700 dark:text-slate-300">
                    Sin movimientos pendientes
                  </div>
                  <div className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                    No hay órdenes en la cola actualmente
                  </div>
                </div>
              )}
            </motion.div>
          </div>

          {/* COLUMNA DERECHA - PRÓXIMAS ÓRDENES */}
          <aside className="rounded-2xl bg-white text-slate-900 shadow-lg border border-slate-200 
                            p-4 sm:p-6 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700
                            h-fit max-h-[calc(100vh-200px)] overflow-y-auto">
            
            {/* Header del aside */}
            <div className="mb-4 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-900 pb-2">
              <h3 className="flex items-center gap-2 font-bold text-lg">
                <span className="text-xl">📋</span> Próximas Órdenes
              </h3>
              <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs 
                               text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {next.length}/{nextCount}
              </span>
            </div>

            {/* Lista de próximas órdenes */}
            <div className="space-y-3">
              <AnimatePresence initial={false}>
                {loading && next.length === 0 ? (
                  <>
                    {Array.from({ length: nextCount }).map((_, i) => <SkeletonNext key={i} />)}
                  </>
                ) : (
                  next.map((n, index) => {
                    const inf = info[n.id];
                    const mv = inf?.movimiento;
                    const loco = fmtLoco(mv?.locomotiveNumber ?? mv?.locomotora);
                    return (
                      <motion.div
                        key={n.id}
                        initial={{ y: prefersReduced ? 0 : 14, opacity: prefersReduced ? 1 : 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: prefersReduced ? 0 : -14, opacity: prefersReduced ? 1 : 0 }}
                        transition={{ duration: prefersReduced ? 0 : 0.25, delay: prefersReduced ? 0 : index * 0.04 }}
                        className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 transition-all duration-200 
                                   hover:bg-white hover:shadow-md hover:border-slate-300
                                   dark:border-slate-700 dark:bg-slate-800/60 dark:hover:bg-slate-800"
                      >
                        {/* Header de la tarjeta */}
                        <div className="flex items-center gap-3 mb-3">
                          <div className="grid h-10 w-10 place-items-center rounded-full 
                                         border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
                            <span className="text-lg">🚆</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs text-slate-500 dark:text-slate-400">Código</div>
                            <div className="truncate font-bold tracking-wide text-slate-900 dark:text-slate-100">
                              {codeFrom(inf, n.id)}
                            </div>
                            <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                              {inf?.empresa?.nombre ?? "—"}
                            </div>
                          </div>
                          <div className="whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
                            Ronda #{n.rondaNumero}
                          </div>
                        </div>

                        {/* Vías */}
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          <div className="rounded-lg border border-slate-200 bg-white p-2 
                                         dark:border-slate-700 dark:bg-slate-900">
                            <div className="text-xs text-slate-500 dark:text-slate-400">Origen</div>
                            <div className="truncate text-sm font-medium">
                              {mv?.viaOrigen?.nombre || "—"}
                            </div>
                          </div>
                          <div className="rounded-lg border border-slate-200 bg-white p-2 
                                         dark:border-slate-700 dark:bg-slate-900">
                            <div className="text-xs text-slate-500 dark:text-slate-400">Destino</div>
                            <div className="truncate text-sm font-medium">
                              {mv?.viaDestino?.nombre || "—"}
                            </div>
                          </div>
                        </div>

                        {/* Estado y Prioridad */}
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          <div className="rounded-lg border border-slate-300 bg-white p-2 
                                         dark:border-slate-600 dark:bg-slate-900">
                            <div className="text-xs text-slate-500 dark:text-slate-400">Estado</div>
                            <div className="text-sm font-medium">{mv?.estado || "—"}</div>
                          </div>
                          <div className="rounded-lg border border-slate-200 bg-white p-2 
                                         dark:border-slate-700 dark:bg-slate-900">
                            <div className="text-xs text-slate-500 dark:text-slate-400">Prioridad</div>
                            <div className={`text-sm font-medium ${
                              mv?.prioridad === 'ALTA' ? 'text-red-600 dark:text-red-400' : 
                              mv?.prioridad === 'BAJA' ? 'text-green-600 dark:text-green-400' : ''
                            }`}>
                              {mv?.prioridad || "—"}
                            </div>
                          </div>
                        </div>

                        {/* Footer */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            Loco: <span className="font-medium text-slate-700 dark:text-slate-200">{loco}</span>
                          </div>
                          <div className="flex gap-1">
                            <ServiceChip active={!!mv?.lavado} icon="💧" text="Lavado" />
                            <ServiceChip active={!!mv?.torno} icon="⚙️" text="Torno" />
                          </div>
                        </div>
                      </motion.div>
                    );
                  })
                )}
                {!loading && next.length === 0 && (
                  <motion.div 
                    initial={{ opacity: prefersReduced ? 1 : 0 }} 
                    animate={{ opacity: 1 }} 
                    className="py-8 text-center text-sm text-slate-500 dark:text-slate-400"
                  >
                    <div className="text-3xl mb-2">📭</div>
                    Sin movimientos pendientes
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </aside>
        </div>
      </section>

      {/* Audio para notificaciones */}
      <audio ref={bellRef} preload="auto" aria-hidden="true">
        <source src="/sounds/notification.mp3" type="audio/mp3" />
      </audio>
    </main>
  );
}

/* ===== Subcomponentes Mejorados ===== */
function InfoBadge({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2 text-center
                    dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wider 
                      text-slate-500 dark:text-slate-400">
        {icon} {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
        {value}
      </div>
    </div>
  );
}

function Chip({ ok, icon, children }: { ok: boolean; icon: string; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium border transition-all duration-200 ${
        ok
          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200"
          : "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
      }`}
    >
      {icon} {children}
    </span>
  );
}

function ServiceChip({ active, icon, text }: { active: boolean; icon: string; text: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] border ${
      active
        ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200"
        : "border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
    }`}>
      {icon} {text}
    </span>
  );
}

function SkeletonCurrent() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-slate-200 dark:bg-slate-800" />
          <div className="space-y-2">
            <div className="h-3 w-20 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-4 w-32 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-3 w-24 rounded bg-slate-200 dark:bg-slate-800" />
          </div>
        </div>
        <div className="h-8 sm:h-12 w-full sm:w-32 rounded bg-slate-200 dark:bg-slate-800" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 rounded-xl bg-slate-200 dark:bg-slate-800" />
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-12 rounded-lg bg-slate-200 dark:bg-slate-800" />
        ))}
      </div>
      <div className="h-16 rounded-xl bg-slate-200 dark:bg-slate-800" />
    </div>
  );
}

function SkeletonNext() {
  return (
    <div className="animate-pulse rounded-lg border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/60">
      <div className="flex items-center gap-3 mb-3">
        <div className="h-10 w-10 rounded-full bg-slate-200 dark:bg-slate-700" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-3/4 rounded bg-slate-200 dark:bg-slate-700" />
          <div className="h-2 w-1/2 rounded bg-slate-200 dark:bg-slate-700" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="h-10 rounded bg-slate-200 dark:bg-slate-700" />
        <div className="h-10 rounded bg-slate-200 dark:bg-slate-700" />
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="h-8 rounded bg-slate-200 dark:bg-slate-700" />
        <div className="h-8 rounded bg-slate-200 dark:bg-slate-700" />
      </div>
      <div className="flex justify-between">
        <div className="h-4 w-20 rounded bg-slate-200 dark:bg-slate-700" />
        <div className="flex gap-1">
          <div className="h-6 w-12 rounded-full bg-slate-200 dark:bg-slate-700" />
          <div className="h-6 w-12 rounded-full bg-slate-200 dark:bg-slate-700" />
        </div>
      </div>
    </div>
  );
}