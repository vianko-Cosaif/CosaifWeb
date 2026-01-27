// page.tsx
"use client";

import type React from "react";
import { useEffect, useMemo, useRef, useState, startTransition } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { S } from "./RailQueueBoard.styles";

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

    fechaSolicitud?: string | null;
    fechaInicio?: string | null;
    fechaFin?: string | null;
    instrucciones?: string | null;
  } | null;
  movimientoId?: number | null;
  createdAt?: string | null;
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

    fechaSolicitud?: string | null;
    fechaInicio?: string | null;
    fechaFin?: string | null;
    instrucciones?: string | null;
  };
  movimientoId?: number;
};

type ToastKind = "move" | "new" | "done" | "warning";
type Toast = { id: number; text: string; kind: ToastKind };

/* ===== Utils ===== */
const fmtList = new Intl.ListFormat("es", {
  style: "short",
  type: "conjunction",
});

const fmtLoco = (v: unknown) => {
  if (v == null) return "N/D";
  const s = String(v).replace(/\D+/g, "");
  if (!s) return "N/D";
  return s.padStart(4, "0").slice(0, 16);
};

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const r = await fetch(url, {
    cache: "no-store",
    credentials: "include",
    mode: "same-origin",
    signal,
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`${r.status} ${r.statusText} :: ${txt.slice(0, 200)}`);
  }
  return (await r.json()) as T;
}

function useVisibleInterval(
  fn: () => void,
  delay: number | null,
  deps: React.DependencyList = []
) {
  useEffect(() => {
    if (!delay) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") fn();
    }, delay);
    const onVis = () => {
      if (document.visibilityState === "visible") fn();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delay, ...deps]);
}

function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<number[]>([]);
  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    },
    []
  );
  const push = (text: string, kind: ToastKind) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, kind }]);
    const tid = window.setTimeout(
      () => setToasts((t) => t.filter((x) => x.id !== id)),
      5000
    );
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
  useEffect(() => {
    try {
      window.localStorage.setItem(key, v ? "1" : "0");
    } catch {}
  }, [key, v]);
  return [v, setV] as const;
}

function useOnline() {
  const [online, setOnline] = useState<boolean>(
    typeof navigator === "undefined" ? true : navigator.onLine
  );
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
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

// Fecha/hora siempre en horario de México.
function formatDateTimeMX(iso?: string | null) {
  if (!iso) return "Sin fecha";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Sin fecha";
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Mexico_City",
  }).format(d);
}

/* ===== Carga dinámica del editor ===== */
const EditRondas = dynamic(() => import("../Components/EditRondas"), {
  ssr: false,
});

/* ===== Página/Componente ===== */
export default function RailQueueBoardPage({
  localidadId,
  autoMs = 120_000,
  nextCount = 5,
}: {
  localidadId: number;
  autoMs?: number;
  nextCount?: number;
}) {
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

  const [openEditor, setOpenEditor] = useState(false);

  async function load(showRefreshing = false) {
    const mySeq = ++reqSeq.current;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    if (showRefreshing) setRefreshing(true);
    else setLoading(true);

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
          const codes = created.map((id) =>
            String(data.find((r) => r.id === id)?.movimiento?.id ?? id)
          );
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
            fechaSolicitud: mv?.fechaSolicitud ?? null,
            fechaInicio: mv?.fechaInicio ?? null,
            fechaFin: mv?.fechaFin ?? null,
            instrucciones: mv?.instrucciones ?? null,
          },
          movimientoId: (mv?.id ?? r.movimientoId ?? undefined) as number | undefined,
        };
      }

      startTransition(() => setInfo(mapFromList));
      lastOkAt.current = Date.now();
    } catch (err) {
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

  // Shortcuts (deshabilitados cuando el editor está abierto)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (openEditor) return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)
      )
        return;

      if (e.key === "r") {
        e.preventDefault();
        load(true);
      }
      if (e.key === "a") setPolling((p) => !p);
      if (e.key === "s") setSoundOn((s) => !s);
      if (e.key === "f") toggleFullscreen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openEditor]);

  useEffect(() => {
    firstLoad.current = true;
    prevIdsRef.current = [];
    setInfo({});
    setItems([]);
    setLoading(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localidadId]);

  useVisibleInterval(
    () => polling && online && load(),
    polling ? autoMs || null : null,
    [autoMs, localidadId, polling, online]
  );

  useEffect(() => {
    const curId = items[0]?.id ?? null;
    if (soundOn && curId && lastCurrentId.current && curId !== lastCurrentId.current) {
      const el = bellRef.current;
      try {
        el?.pause?.();
        if (el) {
          el.currentTime = 0;
          void el.play();
        }
      } catch {}
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
  const serviceOrigin = curMov?.torno ? "Torno" : curMov?.lavado ? "Lavado" : "";
  const desdeLbl = viaO || serviceOrigin;
  const hasAny = !!(desdeLbl || viaD || hasService);

  const creadoText = formatDateTimeMX(
    current?.createdAt ??
      curMov?.fechaSolicitud ??
      curMov?.fechaInicio ??
      curMov?.fechaFin ??
      null
  );

  return (
    <main ref={boardRef} className={S.main}>
      {/* TOASTS */}
      <div className={S.toastsWrap}>
        <div className={S.toastsList}>
          <AnimatePresence>
            {toasts.map((t) => {
              const bar =
                t.kind === "move"
                  ? "border-l-4 border-emerald-500/80"
                  : t.kind === "new"
                  ? "border-l-4 border-sky-500/80"
                  : t.kind === "warning"
                  ? "border-l-4 border-amber-500/80"
                  : "border-l-4 border-slate-400/70";

              const tone =
                t.kind === "move"
                  ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
                  : t.kind === "new"
                  ? "bg-sky-50 text-sky-900 dark:bg-sky-950/40 dark:text-sky-200"
                  : t.kind === "warning"
                  ? "bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
                  : "bg-slate-50 text-slate-900 dark:bg-slate-800 dark:text-slate-100";

              return (
                <motion.button
                  key={t.id}
                  initial={{ y: 20, opacity: 0, scale: 0.95 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  exit={{ y: 20, opacity: 0, scale: 0.95, transition: { duration: 0.18 } }}
                  role={t.kind === "warning" ? "alert" : "status"}
                  aria-live={t.kind === "warning" ? "assertive" : "polite"}
                  onClick={() => dismiss(t.id)}
                  className={`${S.toastBtn} ${bar} ${tone}`}
                  title="Clic para cerrar"
                >
                  <div className={S.toastRow}>
                    <span className={S.toastIcon}>
                      {t.kind === "move"
                        ? "🔄"
                        : t.kind === "new"
                        ? "🆕"
                        : t.kind === "warning"
                        ? "⚠️"
                        : "✅"}
                    </span>
                    <span className={S.toastText}>{t.text}</span>
                  </div>
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* TOOLBAR */}
      <div className={S.toolbar}>
        <div className={S.toolbarInner}>
          <div className={S.toolbarRow}>
            <div className={S.toolbarLeft}>
              <span className={S.liveChip(polling)}>
                <span className={S.liveDot(polling)} aria-hidden />
                {polling ? "LIVE" : "PAUSED"}
              </span>
              <span className={S.lastUpdate}>Últ. act: {lastAgo}</span>
            </div>

            <div className={S.toolbarRight}>
              {!online && <span className={S.offlineChip}>⚠️ Offline</span>}

              <div className={S.toolbarButtons}>
                <button
                  onClick={() => setSoundOn((s) => !s)}
                  className={S.btnSound(soundOn)}
                  title="Pitido al cambiar la orden actual"
                  aria-pressed={soundOn}
                >
                  <span className={S.btnIcon}>{soundOn ? "🔔" : "🔕"}</span>
                  <span className={S.btnLabel}>{soundOn ? "Sonido" : "Silencio"}</span>
                </button>

                <button
                  onClick={() => setPolling((p) => !p)}
                  className={S.btnCommon}
                  title="Activar/pausar auto-actualización"
                  aria-pressed={polling}
                >
                  <span className={S.btnIcon}>{polling ? "⏸️" : "▶️"}</span>
                  <span className={S.btnLabel}>Auto</span>
                </button>

                <button
                  onClick={() => load(true)}
                  disabled={refreshing}
                  className={`${S.btnCommon} ${S.btnDisabled}`}
                  aria-busy={refreshing}
                  title="Refrescar"
                >
                  <span className={S.btnIcon}>{refreshing ? "⟳" : "↻"}</span>
                  <span className={S.btnLabel}>
                    {refreshing ? "Actualizando…" : "Actualizar"}
                  </span>
                </button>

                <button
                  onClick={toggleFullscreen}
                  className={S.btnCommon}
                  title="Pantalla completa (f)"
                  aria-pressed={isFs}
                >
                  <span className={S.btnIcon}>⤢</span>
                  <span className={S.btnLabel}>{isFs ? "Salir" : "Full"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL */}
      <section className={S.section} aria-busy={loading || refreshing}>
        <div className={S.grid}>
          {/* COLUMNA IZQUIERDA - ORDEN ACTUAL */}
          <div className={S.leftCol}>
            <div className={S.leftHeader}>
              <div>
                <h1 className={S.title}>Tablero de Rondas</h1>
                <div className={S.subtitle}>Orden Actual • Current Move</div>
              </div>

              <button
                onClick={() => load(true)}
                className={S.refreshPill}
                disabled={refreshing}
                aria-busy={refreshing}
                title="Refrescar"
              >
                <span>{refreshing ? "⟳" : "↻"}</span>
                <span>{refreshing ? "Actualizando…" : "Actualizar"}</span>
              </button>
            </div>

            <motion.div
              key={current?.id ?? "empty"}
              initial={{ scale: prefersReduced ? 1 : 0.985, opacity: prefersReduced ? 1 : 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 26 }}
              className={S.currentCard}
            >
              {loading && !current ? (
                <SkeletonCurrent />
              ) : current ? (
                <>
                  {/* Header con locomotora */}
                  <div className={S.currentTop}>
                    <div className={S.currentTopLeft}>
                      <motion.div
                        animate={prefersReduced ? {} : { scale: [1, 1.05, 1] }}
                        transition={prefersReduced ? {} : { repeat: Infinity, duration: 3 }}
                        className={S.locoBubble}
                      >
                        <span className="text-xl sm:text-2xl">🚆</span>
                      </motion.div>

                      <div>
                        <div className={S.companyName}>{curInfo?.empresa?.nombre ?? "—"}</div>
                      </div>
                    </div>

                    <div className={S.currentTopRight}>
                      <div className={S.locoLabel}>LOCOMOTORA</div>
                      <div className={S.locoValue}>{locoText}</div>
                    </div>
                  </div>

                  {/* Grid de información principal */}
                  <div className={S.infoGrid}>
                    <div className={S.infoCard}>
                      <div className={S.infoCardLabel}>
                        <span>↖️</span> Vía Origen
                      </div>
                      <div className={S.infoCardValue}>{viaO || "—"}</div>
                    </div>

                    <div className={S.infoCard}>
                      <div className={S.infoCardLabel}>
                        <span>↘️</span> Vía Destino
                      </div>
                      <div className={S.infoCardValue}>{viaD || "—"}</div>
                    </div>

                    <div className={S.infoCard}>
                      <div className={S.infoCardLabel}>
                        <span>⚙️</span> Servicios
                      </div>
                      <div className={S.serviceRow}>
                        <Chip ok={!!curMov?.lavado} icon="💧">
                          Lavado
                        </Chip>
                        <Chip ok={!!curMov?.torno} icon="⚙️">
                          Torno
                        </Chip>
                      </div>
                    </div>
                  </div>

                  {/* Información secundaria */}
                  <div className={S.badgeGrid}>
                    <InfoBadge label="Estado" value={curMov?.estado ?? "—"} icon="📌" />
                    <InfoBadge label="Prioridad" value={curMov?.prioridad ?? "—"} icon="⚑" />
                    <InfoBadge label="Orden" value={String(current?.orden ?? "—")} icon="№" />
                    <InfoBadge label="Ronda" value={String(current?.rondaNumero ?? "—")} icon="🔁" />
                  </div>

                  {/* Detalle + Fecha Creado + Instrucciones */}
                  <motion.div
                    initial={{ x: prefersReduced ? 0 : -8, opacity: prefersReduced ? 1 : 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: prefersReduced ? 0 : 0.1 }}
                    className={S.detailBox}
                  >
                    <p className={S.detailLabel}>Detalle del movimiento</p>

                    <p className={S.detailText}>
                      {hasAny ? (
                        <>
                          Mover locomotora{" "}
                          <b className="text-sky-700 dark:text-sky-300">{locoText}</b> desde{" "}
                          <b className="text-emerald-700 dark:text-emerald-300">
                            {desdeLbl || "—"}
                          </b>{" "}
                          hacia{" "}
                          <b className="text-emerald-700 dark:text-emerald-300">{viaD || "—"}</b>.
                        </>
                      ) : (
                        <>
                          Mover locomotora{" "}
                          <b className="text-sky-700 dark:text-sky-300">{locoText}</b> entre <b>—</b>{" "}
                          y <b>—</b>.
                        </>
                      )}
                    </p>

                    <div className={S.createdWrap}>
                      <DateBox label="Creado" value={creadoText} />
                    </div>

                    <div className={S.instructions}>
                      <span className="font-semibold">Instrucciones: </span>
                      <span>
                        {curMov?.instrucciones?.trim()
                          ? curMov.instrucciones.trim()
                          : "Sin instrucciones adicionales."}
                      </span>
                    </div>
                  </motion.div>
                </>
              ) : (
                <div className={S.emptyWrap}>
                  <div className={S.emptyIcon}>🗂️</div>
                  <div className={S.emptyTitle}>Sin movimientos pendientes</div>
                  <div className={S.emptyDesc}>No hay órdenes en la cola actualmente</div>
                </div>
              )}
            </motion.div>
          </div>

          {/* COLUMNA DERECHA - PRÓXIMAS ÓRDENES */}
          <aside className={S.aside}>
            <div className={S.asideHeader}>
              <h3 className={S.asideTitle}>
                <span className="text-xl">📋</span> Próximas Órdenes
              </h3>
              <span className={S.asideCount}>
                {next.length}/{nextCount}
              </span>
            </div>

            <div className={S.nextWrap}>
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
                    const loco = fmtLoco(mv?.locomotiveNumber ?? mv?.locomotora); // ✅ por tarjeta

                    const creadoNext = formatDateTimeMX(
                      n.createdAt ?? mv?.fechaSolicitud ?? mv?.fechaInicio ?? mv?.fechaFin ?? null
                    );

                    return (
                      <motion.div
                        key={n.id}
                        initial={{ y: prefersReduced ? 0 : 14, opacity: prefersReduced ? 1 : 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: prefersReduced ? 0 : -14, opacity: prefersReduced ? 1 : 0 }}
                        transition={{
                          duration: prefersReduced ? 0 : 0.25,
                          delay: prefersReduced ? 0 : index * 0.04,
                        }}
                        className={S.nextCard}
                      >
                        <div className={S.nextHeader}>
                          <div className={S.nextIconWrap}>
                            <span className="text-lg">🚆</span>
                          </div>

                          <div className={S.nextMeta}>
                            <div className={S.nextMetaLabel}>Locomotora</div>
                            <div className={S.nextMetaValue}>{loco}</div> {/* ✅ FIX */}
                            <div className={S.nextMetaLabel}>Empresa</div>
                            <div className={S.nextMetaValue}>{inf?.empresa?.nombre ?? "—"}</div>
                          </div>

                          <div className={S.nextRight}>Ronda #{n.rondaNumero}</div>
                        </div>

                        <div className={S.kvGrid}>
                          <div className={S.kvBox}>
                            <div className={S.kvLabel}>Origen</div>
                            <div className={S.kvValue}>{mv?.viaOrigen?.nombre || "—"}</div>
                          </div>
                          <div className={S.kvBox}>
                            <div className={S.kvLabel}>Destino</div>
                            <div className={S.kvValue}>{mv?.viaDestino?.nombre || "—"}</div>
                          </div>
                        </div>

                        <div className={S.kvGrid}>
                          <div className={S.kvBoxStrong}>
                            <div className={S.kvLabel}>Estado</div>
                            <div className="text-sm font-medium">{mv?.estado || "—"}</div>
                          </div>
                          <div className={S.kvBox}>
                            <div className={S.kvLabel}>Prioridad</div>
                            <div
                              className={`text-sm font-medium ${
                                mv?.prioridad === "ALTA"
                                  ? "text-red-600 dark:text-red-400"
                                  : mv?.prioridad === "BAJA"
                                  ? "text-green-600 dark:text-green-400"
                                  : ""
                              }`}
                            >
                              {mv?.prioridad || "—"}
                            </div>
                          </div>
                        </div>

                        <div className={S.footerRow}>
                          <div className={S.footerLeft}>
                            Loco: <span className={S.footerLeftVal}>{loco}</span>
                          </div>
                          <div className={S.footerServices}>
                            <ServiceChip active={!!mv?.lavado} icon="💧" text="Lavado" />
                            <ServiceChip active={!!mv?.torno} icon="⚙️" text="Torno" />
                          </div>
                        </div>

                        <div className={S.nextExtra}>
                          <div>
                            <span className="font-semibold">Instrucciones: </span>
                            <span>
                              {mv?.instrucciones?.trim()
                                ? mv.instrucciones.trim()
                                : "Sin instrucciones."}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 xs:grid-cols-1 gap-1 max-w-xs">
                            <DateBox label="Creado" value={creadoNext} />
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
                    className={S.nextEmpty}
                  >
                    <div className={S.nextEmptyIcon}>📭</div>
                    Sin movimientos pendientes
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </aside>
        </div>
      </section>

      <audio ref={bellRef} preload="auto" aria-hidden="true">
        <source src="/sounds/notification.mp3" type="audio/mp3" />
      </audio>

      {openEditor && (
        <div className={S.modalOverlay}>
          <div className={S.modalCard}>
            <div className={S.modalScroll}>
              <EditRondas
                localidadId={localidadId}
                onClose={() => setOpenEditor(false)}
                onSaved={() => {
                  setOpenEditor(false);
                  load(true);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

/* ===== Subcomponentes ===== */
function InfoBadge({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className={S.infoBadge}>
      <div className={S.infoBadgeLabel}>
        {icon} {label}
      </div>
      <div className={S.infoBadgeValue}>{value}</div>
    </div>
  );
}

function Chip({
  ok,
  icon,
  children,
}: {
  ok: boolean;
  icon: string;
  children: React.ReactNode;
}) {
  return <span className={S.chip(ok)}>{icon} {children}</span>;
}

function ServiceChip({
  active,
  icon,
  text,
}: {
  active: boolean;
  icon: string;
  text: string;
}) {
  return <span className={S.serviceChip(active)}>{icon} {text}</span>;
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

function DateBox({ label, value }: { label: string; value: string }) {
  return (
    <div className={S.dateBox}>
      <div className={S.dateBoxLabel}>{label}</div>
      <div className={S.dateBoxValue}>{value}</div>
    </div>
  );
}
