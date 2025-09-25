"use client";
import { useEffect, useMemo, useRef, useState, startTransition } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

/* ===== Tipos ===== */
type Ronda = {
  id: number;
  rondaNumero: number;
  orden: number;
  concluido: boolean;
  // Campos opcionales que vienen en /rondas y usamos para construir info
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
  console.log("[fetchJson] GET", url);
  const r = await fetch(url, {
    cache: "no-store",
    credentials: "include",
    mode: "same-origin",
    signal,
  });
  console.log("[fetchJson] status", r.status, r.statusText);
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`${r.status} ${r.statusText} :: ${txt.slice(0, 200)}`);
  }
  const data = (await r.json()) as T;
  console.log("[fetchJson] data", data);
  return data;
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
export default function RailQueueBoard({
  localidadId,
  autoMs = 20_000,
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

  const reqSeq = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    console.log("[RailQueueBoard] mount localidadId:", localidadId);
  }, [localidadId]);

  async function load(showRefreshing = false) {
    const mySeq = ++reqSeq.current;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    showRefreshing ? setRefreshing(true) : setLoading(true);

    try {
      const url = `/api/cliente/rondas?localidadId=${localidadId}`;
      console.log("[RailQueueBoard] fetching rondas:", url);
      const data = await fetchJson<Ronda[]>(url, ac.signal);
      console.log("[RailQueueBoard] rondas data:", data);

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

      // ===== mapear info directamente del listado =====
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
    } catch (e) {
      console.warn("[RailQueueBoard] fullscreen error", e);
    }
  };

  // Keyboard shortcuts: r refresh, a auto, s sound, f fullscreen
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

  // === lógica pedida: usar servicio como "origen" si no hay vía origen ===
  const hasService = !!(curMov?.torno || curMov?.lavado);
  const serviceOrigin = curMov?.torno ? "Torno" : (curMov?.lavado ? "Lavado" : "");
  const desdeLbl = viaO || serviceOrigin; // prioridad: vía origen > servicio
  const hasAny = !!(desdeLbl || viaD || hasService);

  return (
    <div ref={boardRef} className="contents">
      {/* TOASTS */}
      <div className="fixed right-4 top-4 z-50 space-y-2 max-w-[min(92vw,420px)] sm:bottom-auto sm:top-4 sm:right-4 bottom-4">
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
                initial={{ x: 100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 100, opacity: 0, transition: { duration: 0.18 } }}
                role={t.kind === "warning" ? "alert" : "status"}
                aria-live={t.kind === "warning" ? "assertive" : "polite"}
                onClick={() => dismiss(t.id)}
                className={`w-full text-left rounded-md px-4 py-3 text-sm shadow border ${bar} ${tone}`}
                title="Clic para cerrar"
              >
                <span className="mr-2">
                  {t.kind === "move" ? "🔄" : t.kind === "new" ? "🆕" : t.kind === "warning" ? "⚠️" : "✅"}
                </span>
                {t.text}
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>

      {/* TOOLBAR */}
      <div className="mx-auto my-2 flex w-full max-w-screen-2xl items-center justify-end gap-2 px-4">
        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] tabular-nums ${
          polling ? "border-emerald-300 text-emerald-700 dark:text-emerald-300" : "border-slate-300 text-slate-600 dark:text-slate-300"
        }`} title="Estado de actualización">
          <span className={`inline-block h-2 w-2 rounded-full ${polling ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} aria-hidden />
          LIVE
        </span>
        <span className="hidden sm:inline text-xs text-slate-500 dark:text-slate-400" aria-live="polite">
          Últ. act: {lastAgo}
        </span>
        {!online && (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200" title="Sin conexión">
            ⚠️ Offline
          </span>
        )}
        <button
          onClick={() => setSoundOn((s) => !s)}
          className={`rounded-md border px-3 py-2 text-sm shadow-sm transition hover:bg-slate-50 dark:hover:bg-slate-800 ${soundOn ? "border-emerald-400 text-emerald-700 dark:text-emerald-300" : ""}`}
          title="Pitido al cambiar la orden actual"
          aria-pressed={soundOn}
        >
          {soundOn ? "🔔 Sonido" : "🔕 Silencio"}
        </button>
        <button
          onClick={() => setPolling((p) => !p)}
          className="rounded-md border px-3 py-2 text-sm shadow-sm transition hover:bg-slate-50 dark:hover:bg-slate-800"
          title="Activar/pausar auto-actualización"
          aria-pressed={polling}
        >
          {polling ? "⏸️ Auto" : "▶️ Auto"}
        </button>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="rounded-md border px-3 py-2 text-sm shadow-sm transition hover:bg-slate-50 disabled:opacity-60 dark:hover:bg-slate-800"
          aria-busy={refreshing}
          title="Refrescar"
        >
          {refreshing ? "⟳ Actualizando…" : "↻ Actualizar"}
        </button>
        <button
          onClick={toggleFullscreen}
          className="rounded-md border px-3 py-2 text-sm shadow-sm transition hover:bg-slate-50 dark:hover:bg-slate-800"
          title="Pantalla completa (f)"
          aria-pressed={isFs}
        >
          {isFs ? "⤢ Salir" : "⤢ Full"}
        </button>
      </div>

      <div className="mx-auto w-full max-w-screen-2xl p-4" aria-busy={loading || refreshing}>
        <div className="grid gap-6 lg:grid-cols-3">
          {/* IZQUIERDA */}
          <div className="lg:col-span-2 rounded-2xl p-6 bg-gradient-to-br from-white via-sky-50 to-white text-slate-800 shadow border border-slate-200
                          dark:from-slate-900 dark:via-slate-900 dark:to-slate-900 dark:text-slate-100 dark:border-slate-700">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Tablero de Rondas</h1>
                <div className="mt-1 text-[11px] tracking-widest font-medium text-slate-500 dark:text-slate-400">
                  ORDEN ACTUAL • CURRENT MOVE
                </div>
              </div>
              <button
                onClick={() => load(true)}
                className="text-xs rounded-full px-3 py-2 border bg-white hover:bg-slate-50 transition dark:bg-slate-800 dark:hover:bg-slate-700 dark:border-slate-700"
                disabled={refreshing}
                aria-busy={refreshing}
                title="Refrescar"
              >
                {refreshing ? "⟳ Actualizando…" : "↻ Actualizar"}
              </button>
            </div>

            <motion.div
              key={current?.id ?? "empty"}
              initial={{ scale: prefersReduced ? 1 : 0.985, opacity: prefersReduced ? 1 : 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 26 }}
              className="rounded-xl bg-white p-4 sm:p-6 border shadow-sm border-slate-200 dark:bg-slate-900 dark:border-slate-700 min-h-[180px]"
            >
              {loading && !current ? (
                <SkeletonCurrent />
              ) : current ? (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <motion.div
                        animate={prefersReduced ? {} : { scale: [1, 1.05, 1] }}
                        transition={prefersReduced ? {} : { repeat: Infinity, duration: 3 }}
                        className="grid h-14 w-14 place-items-center rounded-full bg-sky-50 border border-slate-200 dark:bg-slate-800 dark:border-slate-700"
                      >
                        <span className="text-2xl">🚆</span>
                      </motion.div>
                      <div>
                        <div className="text-[11px] uppercase tracking-widest text-slate-500 dark:text-slate-400">Locomotora</div>
                        <div className="text-lg font-semibold">{locoText}</div>
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{curInfo?.empresa?.nombre ?? "—"}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">Código</div>
                      <div
                        className="font-black tracking-widest bg-gradient-to-r from-sky-600 to-emerald-600 bg-clip-text text-transparent"
                        style={{ fontSize: "clamp(28px,8vw,72px)" }}
                      >
                        {codeFrom(curInfo, current.id)}
                      </div>
                    </div>
                  </div>

                  {/* Origen/Destino + chips condicionados */}
                  <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                    {viaO && !viaD && (
                      <>
                        <CardStat label="Vía origen" value={viaO} icon="↖️" />
                        <div className="md:col-span-2 flex items-center gap-3 justify-end">
                          <Chip ok={!!curMov?.lavado} icon="💧">Lavado</Chip>
                          <Chip ok={!!curMov?.torno} icon="⚙️">Torno</Chip>
                        </div>
                      </>
                    )}
                    {viaD && !viaO && (
                      <>
                        <CardStat label="Vía destino" value={viaD} icon="↘️" />
                        <div className="md:col-span-2 flex items-center gap-3 justify-end">
                          <Chip ok={!!curMov?.lavado} icon="💧">Lavado</Chip>
                          <Chip ok={!!curMov?.torno} icon="⚙️">Torno</Chip>
                        </div>
                      </>
                    )}
                    {(!viaO && !viaD) && (
                      <>
                        <CardStat label="Vía origen" value="—" icon="↖️" />
                        <CardStat label="Vía destino" value="—" icon="↘️" />
                        <div className="flex items-center gap-3 justify-end">
                          <Chip ok={!!curMov?.lavado} icon="💧">Lavado</Chip>
                          <Chip ok={!!curMov?.torno} icon="⚙️">Torno</Chip>
                        </div>
                      </>
                    )}
                    {(viaO && viaD) && (
                      <>
                        <CardStat label="Vía origen" value={viaO} icon="↖️" />
                        <CardStat label="Vía destino" value={viaD} icon="↘️" />
                        <div className="flex items-center gap-3 justify-end">
                          <Chip ok={!!curMov?.lavado} icon="💧">Lavado</Chip>
                          <Chip ok={!!curMov?.torno} icon="⚙️">Torno</Chip>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Estado, Prioridad, Orden, Ronda */}
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4">
                    <CardStat label="Estado" value={curMov?.estado ?? "—"} icon="📌" />
                    <CardStat label="Prioridad" value={curMov?.prioridad ?? "—"} icon="⚑" />
                    <CardStat label="Orden" value={String(current?.orden ?? "—")} icon="№" />
                    <CardStat label="Ronda" value={String(current?.rondaNumero ?? "—")} icon="🔁" />
                  </div>

                  {/* instrucción */}
                  <motion.div
                    initial={{ x: prefersReduced ? 0 : -8, opacity: prefersReduced ? 1 : 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: prefersReduced ? 0 : 0.1 }}
                    className="mt-6 rounded-lg bg-gradient-to-r from-sky-100 to-emerald-100 text-slate-900 p-4 border border-slate-200 dark:from-slate-800 dark:to-slate-800 dark:text-slate-100 dark:border-slate-700"
                  >
                    <p className="text-sm">
                      {hasAny ? (
                        <>
                          Mover locomotora <b>{locoText}</b> desde <b>{desdeLbl || "—"}</b> hacia <b>{viaD || "—"}</b>.
                        </>
                      ) : (
                        <>
                          Mover locomotora <b>{locoText}</b> entre <b>—</b> y <b>—</b>.
                        </>
                      )}
                    </p>
                  </motion.div>
                </>
              ) : (
                <div className="py-14 text-center">
                  <div className="mb-3 text-5xl">🗂️</div>
                  <div className="text-base font-semibold text-slate-700 dark:text-slate-300">Sin movimientos pendientes</div>
                </div>
              )}
            </motion.div>
          </div>

          {/* DERECHA */}
          <div className="rounded-2xl bg-white text-slate-900 shadow border border-slate-200 p-4 sm:p-5 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-semibold">
                <span>📋</span> Próximas órdenes
              </h3>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {next.length} de {nextCount}
              </span>
            </div>

            <div className="space-y-3">
              <AnimatePresence initial={false}>
                {loading && next.length === 0 ? (
                  <>
                    {Array.from({ length: nextCount }).map((_, i) => (
                      <SkeletonNext key={i} />
                    ))}
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
                        className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 transition hover:bg-white dark:border-slate-700 dark:bg-slate-800/60 dark:hover:bg-slate-800"
                      >
                        <div className="flex items-center gap-3">
                          <div className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                            <span className="text-lg">🚆</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">Código</div>
                            <div className="truncate font-semibold tracking-wide">{codeFrom(inf, n.id)}</div>
                            <div className="truncate text-[11px] text-slate-500 dark:text-slate-400">{inf?.empresa?.nombre ?? "—"}</div>
                          </div>
                          <div className="whitespace-nowrap text-[11px] text-slate-500 dark:text-slate-400">
                            Ronda #{n.rondaNumero}
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                          {/* Origen/Destino condicionados */}
                          {mv?.viaOrigen?.nombre && !mv?.viaDestino?.nombre && (
                            <div className="rounded border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
                              <div className="text-slate-500 dark:text-slate-400">Origen</div>
                              <div className="truncate font-medium">{mv.viaOrigen.nombre}</div>
                            </div>
                          )}
                          {mv?.viaDestino?.nombre && !mv?.viaOrigen?.nombre && (
                            <div className="rounded border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
                              <div className="text-slate-500 dark:text-slate-400">Destino</div>
                              <div className="truncate font-medium">{mv.viaDestino.nombre}</div>
                            </div>
                          )}
                          {mv?.viaOrigen?.nombre && mv?.viaDestino?.nombre && (
                            <>
                              <div className="rounded border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
                                <div className="text-slate-500 dark:text-slate-400">Origen</div>
                                <div className="truncate font-medium">{mv.viaOrigen.nombre}</div>
                              </div>
                              <div className="rounded border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
                                <div className="text-slate-500 dark:text-slate-400">Destino</div>
                                <div className="truncate font-medium">{mv.viaDestino.nombre}</div>
                              </div>
                            </>
                          )}
                          {!mv?.viaOrigen?.nombre && !mv?.viaDestino?.nombre && (
                            <>
                              <div className="rounded border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
                                <div className="text-slate-500 dark:text-slate-400">Origen</div>
                                <div className="truncate font-medium">—</div>
                              </div>
                              <div className="rounded border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
                                <div className="text-slate-500 dark:text-slate-400">Destino</div>
                                <div className="truncate font-medium">—</div>
                              </div>
                            </>
                          )}
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                          <div className="rounded border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
                            <div className="text-slate-500 dark:text-slate-400">Estado</div>
                            <div className="font-medium">{mv?.estado ?? "—"}</div>
                          </div>
                          <div className="rounded border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
                            <div className="text-slate-500 dark:text-slate-400">Prioridad</div>
                            <div className="font-medium">{mv?.prioridad ?? "—"}</div>
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">Loco: <span className="font-medium text-slate-700 dark:text-slate-200">{loco}</span></div>
                          <div className="flex gap-2">
                            <span className={`${mv?.lavado
                                ? "rounded-full border px-2 py-1 border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200"
                                : "rounded-full border px-2 py-1 border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                            }`}>
                              💧 Lavado
                            </span>
                            <span className={`${mv?.torno
                                ? "rounded-full border px-2 py-1 border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200"
                                : "rounded-full border px-2 py-1 border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                            }`}>
                              ⚙️ Torno
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })
                )}
                {!loading && next.length === 0 && (
                  <motion.div initial={{ opacity: prefersReduced ? 1 : 0 }} animate={{ opacity: 1 }} className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                    Sin movimientos pendientes
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* audio */}
      <audio ref={bellRef} preload="auto" aria-hidden="true">
        <source src="/sounds/notification.mp3" type="audio/mp3" />
      </audio>
    </div>
  );
}

/* ===== Subcomponentes ===== */
function CardStat({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center gap-1 text-[11px] uppercase tracking-widest text-slate-500 dark:text-slate-400">
        {icon} {label}
      </div>
      <div className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100">{value}</div>
    </div>
  );
}
function Chip({ ok, icon, children }: { ok: boolean; icon: string; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium border ${
        ok
          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200"
          : "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
      }`}
    >
      {icon} {children}
    </span>
  );
}
function SkeletonCurrent() {
  return (
    <div className="animate-pulse">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-slate-200 dark:bg-slate-800" />
          <div>
            <div className="h-3 w-24 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="mt-2 h-4 w-40 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="mt-2 h-3 w-28 rounded bg-slate-200 dark:bg-slate-800" />
          </div>
        </div>
        <div className="h-10 w-36 rounded bg-slate-200 dark:bg-slate-800" />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 rounded-lg bg-slate-200 dark:bg-slate-800" />
        ))}
      </div>
      <div className="mt-6 h-14 rounded bg-slate-200 dark:bg-slate-800" />
    </div>
  );
}
function SkeletonNext() {
  return (
    <div className="animate-pulse rounded-lg border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-800/60">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-slate-200 dark:bg-slate-700" />
        <div className="h-4 w-40 rounded bg-slate-200 dark:bg-slate-700" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="h-10 rounded bg-slate-200 dark:bg-slate-700" />
        <div className="h-10 rounded bg-slate-200 dark:bg-slate-700" />
      </div>
    </div>
  );
}
