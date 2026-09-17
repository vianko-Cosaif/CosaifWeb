"use client";
import TornoMeasuresDialog from "@/features/torno-measures/TornoMeasuresDialog";
import { hasRealtimeNotificationConnection } from "@/lib/notificationDelivery";
import { useCallback, useEffect, useMemo, useRef, useState, memo, type ReactNode } from "react";
import dynamic from "next/dynamic";
import LocalityQueue from "../components/LocalityQueue";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Expand,
  Minimize,
  MapPin,
  RefreshCw,
  TrainFront,
  Volume2,
  VolumeX,
  WifiOff,
} from "lucide-react";
import styles from "./RailQueueBoardAdmin.module.css";
import { getClientCookie, setClientCookie } from "@/lib/cookies";
import { isTorreonLocalidadId } from "@/lib/torreonLocalidad";
import { loadAdminRounds, replaceLocalidadRounds, rondaInfoMap, summarizeAdminQueue } from "./data";
import { useRealtimeBoardRefresh } from "../useRealtimeBoardRefresh";
import { useTornoMeasuresModal } from "@/features/torno-measures/useTornoMeasuresModal";
import {
  API_BFF_BASE,
  API_XAPI_BASE,
  codeFrom,
  fetchJson,
  fmtLoco,
  formatDateTimeMX,
  isAbortError,
  railQueueListFormatter,
  timeAgo,
  unwrapArray,
} from "../utils";
import { useLocalStorageBoolean, useOnline, useToasts, useVisibleInterval } from "../hooks";
import { type Localidad, type Ronda, type Toast } from "../types";
import {
  playNotificationSound,
  playOperationConfirmation,
  preloadNotificationSound,
  primeNotificationSound,
} from "@/lib/notificationSound";
const API_BASE = API_BFF_BASE;
const API_MEASURES = API_XAPI_BASE;
const ADMIN_MOVEMENTS_LOCALIDAD_KEY = "administrador:movimientosLocalidadId";
const fmtList = railQueueListFormatter;
const AdminTorreonDashboard = dynamic(
  () => import("../../torreon/coordinador/CoordinatorTorreonDashboard"),
  {
    loading: () => (
      <div className="min-h-[420px] animate-pulse rounded-2xl border border-slate-200 bg-[var(--app-surface)] dark:border-slate-800" />
    ),
  },
);

/* ===== Componente Admin ===== */
export default function RailQueueBoardAdmin({
  autoMs = 120_000,
  nextCount = 5,
}: {
  autoMs?: number;
  nextCount?: number;
}) {
  const online = useOnline();

  const boardRef = useRef<HTMLDivElement | null>(null);
  const [isFs, setIsFs] = useState(false);
  const [fullscreenPending, setFullscreenPending] = useState(false);

  const [items, setItems] = useState<Ronda[]>([]);
  const info = useMemo(() => rondaInfoMap(items), [items]);
  const summary = useMemo(() => summarizeAdminQueue(items), [items]);
  const [error, setError] = useState<string | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [unavailableLocIds, setUnavailableLocIds] = useState<number[]>([]);
  const [loadedLocIds, setLoadedLocIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [polling, setPolling] = useLocalStorageBoolean("rail-queue:polling", true);

  const [soundOn, setSoundOn] = useLocalStorageBoolean("rail-queue:soundOn", false);

  const { toasts, push: pushToast, dismiss } = useToasts();
  const { measuresModal, openMeasuresModal, closeMeasuresModal } =
    useTornoMeasuresModal(API_MEASURES);

  const prevIdsRef = useRef<number[]>([]);
  const lastCurrentId = useRef<number | null>(null);
  const firstLoad = useRef(true);
  const [lastOkAt, setLastOkAt] = useState<number | null>(null);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const pendingReloadRef = useRef(false);

  const reqSeq = useRef(120);
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (soundOn) preloadNotificationSound();
  }, [soundOn]);

  const toggleSound = useCallback(() => {
    const next = !soundOn;
    setSoundOn(next);
    if (!next) return;
    void primeNotificationSound().then((ready) => {
      if (ready) void playNotificationSound("sonido_actualizado");
    });
  }, [setSoundOn, soundOn]);

  /* === Catálogo de localidades y selector === */
  const [localidades, setLocalidades] = useState<Localidad[]>([]);
  const [activeLocId, setActiveLocId] = useState(0);
  const [localidadesReady, setLocalidadesReady] = useState(false);
  useEffect(() => {
    const n = Number(getClientCookie("locId"));
    if (Number.isFinite(n) && n > 0) setActiveLocId(n);
  }, []);
  const activeLoc = useMemo(
    () => localidades.find((l) => l.id === activeLocId) || null,
    [localidades, activeLocId],
  );
  const activeIsTorreon = activeLocId > 0 && isTorreonLocalidadId(activeLocId);

  useEffect(() => {
    try {
      localStorage.setItem(
        ADMIN_MOVEMENTS_LOCALIDAD_KEY,
        activeLocId > 0 ? String(activeLocId) : "todas",
      );
    } catch {}
    if (activeLocId <= 0) return;
    try {
      localStorage.setItem("locId", String(activeLocId));
    } catch {}
    setClientCookie("locId", String(activeLocId), {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    });
    window.dispatchEvent(
      new CustomEvent("cosaif:localidad-change", { detail: { localidadId: activeLocId } }),
    );
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    void import("@/lib/firebase")
      .then(({ syncFirebaseNotificationLocalidad }) =>
        syncFirebaseNotificationLocalidad(activeLocId),
      )
      .catch((error) => {
        console.warn("No se pudo sincronizar localidad FCM.", error);
      });
  }, [activeLocId]);

  const loadLocalidades = useCallback(async (signal?: AbortSignal) => {
    try {
      let raw: unknown;
      try {
        raw = await fetchJson<unknown>(`${API_BASE}/localidades`, signal, { ttlMs: 120_000 });
      } catch (cause) {
        if (signal?.aborted || isAbortError(cause)) return;
        const status =
          cause && typeof cause === "object" && "status" in cause ? cause.status : null;
        if (status !== 404 && status !== 405) throw cause;
        raw = await fetchJson<unknown>(`${API_BASE}/localidades/lite`, signal, { ttlMs: 120_000 });
      }
      if (signal?.aborted) return;
      setLocalidades(unwrapArray<Localidad>(raw).sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setLocalidadesReady(true);
      setCatalogError(null);
    } catch {
      if (!signal?.aborted)
        setCatalogError("No se pudo cargar el catálogo de localidades. Intenta actualizar.");
    }
  }, []);

  /* Results arrive per locality; a slow patio does not hold the others. */
  async function load(showRefreshing = false, force = showRefreshing) {
    if (inFlightRef.current) {
      if (force) pendingReloadRef.current = true;
      return inFlightRef.current;
    }
    if (activeIsTorreon || (activeLocId === 0 && !localidadesReady)) return;
    const mySeq = ++reqSeq.current;
    const ac = new AbortController();
    abortRef.current = ac;
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);
    const requested =
      activeLocId > 0
        ? [
            localidades.find((loc) => loc.id === activeLocId) ?? {
              id: activeLocId,
              nombre: `Localidad #${activeLocId}`,
            },
          ]
        : localidades;

    const pending = (async () => {
      try {
        const result = await loadAdminRounds({
          localidades: requested,
          signal: ac.signal,
          force,
          onLocalidadLoaded: (loc, list) => {
            if (mySeq !== reqSeq.current || ac.signal.aborted) return;
            setItems((previous) => replaceLocalidadRounds(previous, loc.id, list));
            setLoadedLocIds((previous) =>
              previous.includes(loc.id) ? previous : [...previous, loc.id],
            );
            setUnavailableLocIds((previous) => previous.filter((id) => id !== loc.id));
          },
        });
        if (mySeq !== reqSeq.current || ac.signal.aborted) return;
        const unavailable = result.unavailableLocalidades;
        setUnavailableLocIds((previous) => [
          ...previous.filter((id) => !requested.some((loc) => loc.id === id)),
          ...unavailable.map((loc) => loc.id),
        ]);
        setError(
          unavailable.length
            ? `No se pudo actualizar: ${unavailable.map((loc) => loc.nombre).join(", ")}. Los datos anteriores se conservan y pueden haber cambiado.`
            : null,
        );
        if (unavailable.length) return;
        const data = result.items;
        const nextIds = data.map((item) => item.id);
        const prev = prevIdsRef.current;
        if (!firstLoad.current && !hasRealtimeNotificationConnection()) {
          const previousIds = new Set(prev);
          const nextIdSet = new Set(nextIds);
          const created = data.filter((item) => !previousIds.has(item.id));
          const removed = prev.filter((id) => !nextIdSet.has(id));
          if (activeLocId > 0 && prev.length && nextIds[0] && nextIds[0] !== prev[0]) {
            pushToast(
              `Se movió la orden a ${codeFrom(rondaInfoMap([data[0]])[data[0].id], data[0].id)}`,
              "move",
            );
          }
          if (created.length)
            pushToast(
              `Nueva(s): ${fmtList.format(created.map((item) => codeFrom(rondaInfoMap([item])[item.id], item.id)))}`,
              "new",
            );
          if (removed.length) pushToast(`Salió: ${fmtList.format(removed.map(String))}`, "done");
        }
        prevIdsRef.current = nextIds;
        firstLoad.current = false;
        setLastOkAt(Date.now());
      } catch (cause) {
        if (!ac.signal.aborted && !isAbortError(cause) && mySeq === reqSeq.current) {
          setError("No se pudo actualizar el tablero. Intenta de nuevo.");
        }
      } finally {
        if (mySeq === reqSeq.current) {
          setLoading(false);
          setRefreshing(false);
          inFlightRef.current = null;
          const queued = pendingReloadRef.current;
          pendingReloadRef.current = false;
          if (queued && !ac.signal.aborted) void load(true, true);
        }
      }
    })();
    inFlightRef.current = pending;
    return pending;
  }

  useRealtimeBoardRefresh({
    enabled: !activeIsTorreon && polling && online,
    realtimeLocalidadId: null,
    scopeLocalidadId: activeLocId > 0 ? activeLocId : null,
    onRefresh: ({ event }) => {
      if (activeIsTorreon || document.visibilityState !== "visible") return;
      if (activeLocId === 0 && !localidadesReady) return;
      if (
        event.type === "realtime.ready" &&
        (inFlightRef.current || (lastOkAt && Date.now() - lastOkAt < 20_000))
      )
        return;
      // The shared realtime hook coalesces events, so refresh the complete selected scope.
      return load(true, true);
    },
  });

  // init
  useEffect(() => {
    const ac = new AbortController();
    void loadLocalidades(ac.signal);
    return () => ac.abort();
  }, [loadLocalidades]);
  const scopeCatalogReady = activeLocId === 0 ? localidadesReady : true;
  const scopeCatalogKey =
    activeLocId === 0 ? localidades.map((localidad) => localidad.id).join(",") : "single";
  useEffect(() => {
    abortRef.current?.abort();
    reqSeq.current++;
    inFlightRef.current = null;
    pendingReloadRef.current = false;
    firstLoad.current = true;
    prevIdsRef.current = [];
    setItems([]);
    setError(null);
    setLoadedLocIds([]);
    setUnavailableLocIds([]);
    setLastOkAt(null);
    setLoading(true);
    if (activeIsTorreon) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    if (activeLocId === 0 && !localidadesReady) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIsTorreon, activeLocId, scopeCatalogReady, scopeCatalogKey]);

  useVisibleInterval(
    () => !activeIsTorreon && polling && online && load(true, false),
    !activeIsTorreon && polling ? autoMs || null : null,
    [activeIsTorreon, autoMs, activeLocId, polling, online, localidadesReady, localidades.length],
  );

  // sonidos
  useEffect(() => {
    const curId = items[0]?.id ?? null;
    if (soundOn && curId && lastCurrentId.current && curId !== lastCurrentId.current) {
      void playOperationConfirmation("ronda_movimiento_iniciado");
    }
    lastCurrentId.current = curId;
  }, [items, soundOn]);

  // fullscreen
  useEffect(() => {
    const onChange = () => setIsFs(document.fullscreenElement === boardRef.current);
    onChange();
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  const toggleFullscreen = async () => {
    const board = boardRef.current;
    if (!board || fullscreenPending) return;
    setFullscreenPending(true);
    try {
      if (document.fullscreenElement === board) await document.exitFullscreen();
      else await board.requestFullscreen();
    } catch {
      pushToast(
        "No se pudo cambiar la pantalla completa. Puedes seguir usando el tablero e intentarlo de nuevo.",
        "error",
      );
    } finally {
      setFullscreenPending(false);
    }
  };

  // agrupación por localidad para vista “Todas”
  const itemsByLoc = useMemo(() => {
    if (activeLocId > 0) return null;
    const map = new Map<number, Ronda[]>();
    for (const r of items) {
      const key = r.localidadId ?? r.localidad?.id ?? -1;
      const arr = map.get(key) || [];
      arr.push(r);
      map.set(key, arr);
    }
    return map;
  }, [items, activeLocId]);

  return (
    <div ref={boardRef} data-admin-dashboard="true" data-fullscreen={isFs} className={styles.board}>
      {/* TOASTS */}
      <ToastStack toasts={toasts} dismiss={dismiss} />

      <header className={styles.header}>
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-900 text-emerald-300">
            <TrainFront size={22} aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--app-text-muted)]">
              Administración ferroviaria
            </p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">
              Control de operaciones
            </h1>
          </div>
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--app-text-muted)]">
          Rondas, prioridades y órdenes por localidad. Selecciona un patio para consultar su
          operación.
        </p>
      </header>
      {/* TOOLBAR */}
      <div className={styles.toolbar}>
        <div>
          <div className={styles.toolbarInner}>
            {/* selector de localidad */}
            <div className="flex min-w-0 max-w-full flex-wrap items-center gap-3 rounded-2xl border border-slate-200/70 bg-[var(--app-surface)] px-3 py-2 shadow-sm dark:border-slate-800/70">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--app-text-muted)]">
                <MapPin className="h-4 w-4" /> Localidad
              </div>
              <div className="relative min-w-0 flex-1">
                <select
                  value={activeLocId}
                  onChange={(e) => setActiveLocId(Number(e.target.value))}
                  className="w-full max-w-full appearance-none rounded-lg border border-slate-200 bg-[var(--app-surface)] px-3 py-1.5 pr-8 text-sm font-semibold text-slate-700 shadow-sm dark:border-slate-700 dark:text-slate-100"
                  aria-label="Localidad"
                >
                  <option value={0}>Todas</option>
                  {activeLocId > 0 && !activeLoc && (
                    <option value={activeLocId}>Localidad #{activeLocId}</option>
                  )}
                  {localidades.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.nombre} (#{l.id})
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[var(--app-text-muted)]">
                  ▾
                </span>
              </div>

              {activeLocId > 0 && activeLoc?.estado && (
                <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-[var(--app-surface-subtle)] px-3 py-1 text-xs text-[var(--app-text-muted)] dark:border-slate-700 dark:text-slate-200">
                  <MapPin className="h-3.5 w-3.5" />
                  Estado: <span className="font-semibold">{activeLoc?.estado || "Sin estado"}</span>
                </div>
              )}
            </div>

            {/* status derecha */}
            <div className="flex flex-wrap items-center gap-2">
              {activeIsTorreon ? (
                <span className="inline-flex min-h-9 items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
                  <MapPin className="h-3.5 w-3.5" /> Naturales y arrastres de Torreón
                </span>
              ) : (
                <>
                  <LastUpdated live={polling && online} timestamp={lastOkAt} />
                  <Btn
                    onClick={toggleSound}
                    active={soundOn}
                    labelOn="Sonido"
                    labelOff="Silencio"
                    iconOn={<Volume2 size={15} />}
                    iconOff={<VolumeX size={15} />}
                  />
                  <Btn
                    onClick={() => setPolling((p) => !p)}
                    active={polling}
                    labelOn="Auto"
                    labelOff="Auto"
                    iconOn={<Check size={15} />}
                    iconOff={<RefreshCw size={15} />}
                  />
                  <Btn
                    onClick={() => {
                      if (!localidadesReady) void loadLocalidades();
                      else void load(true);
                    }}
                    disabled={refreshing || (loading && !catalogError)}
                    labelOn={refreshing ? "Actualizando…" : "Actualizar"}
                    iconOn={<RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />}
                  />
                </>
              )}
              <Btn
                onClick={toggleFullscreen}
                active={isFs}
                disabled={fullscreenPending}
                labelOn={isFs ? "Salir de pantalla completa" : "Pantalla completa"}
                iconOn={isFs ? <Minimize size={15} /> : <Expand size={15} />}
              />
            </div>
          </div>
        </div>
      </div>

      {/* CONTENIDO */}
      <section className={styles.content} aria-busy={loading || refreshing}>
        {!online && (
          <div
            role="status"
            className="mb-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
          >
            <WifiOff size={17} /> Sin conexión. La información puede haber cambiado.
          </div>
        )}
        {(error || catalogError) && !activeIsTorreon && (
          <div
            role="alert"
            className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
          >
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <span>{error || catalogError}</span>
          </div>
        )}
        {!activeIsTorreon && (
          <QueueSummary
            summary={summary}
            pending={loading}
            partial={unavailableLocIds.length > 0 || (activeLocId === 0 && Boolean(catalogError))}
          />
        )}
        {!activeIsTorreon && activeLocId === 0 && loading && localidades.length > 0 && (
          <p role="status" className="mb-4 text-xs text-[var(--app-text-muted)]">
            Consultando localidades: {loadedLocIds.length} de {localidades.length}. Puedes abrir
            cualquier patio.
          </p>
        )}
        {activeIsTorreon && activeLocId > 0 ? (
          <AdminTorreonDashboard
            key={`admin-torreon-${activeLocId}`}
            localidadId={activeLocId}
            showBanner={false}
            rol="ADMINISTRADOR"
          />
        ) : activeLocId === 0 ? (
          <AllLocalidadesGrid
            localidades={localidades}
            itemsByLoc={itemsByLoc}
            loading={loading}
            loadedLocIds={loadedLocIds}
            unavailableLocIds={unavailableLocIds}
            onSelect={setActiveLocId}
          />
        ) : (
          <LocalityQueue
            items={items}
            info={info}
            loading={loading}
            refreshing={refreshing}
            nextCount={nextCount}
            error={error}
            showTiming
            onRefresh={() => load(true)}
            onViewMeasures={openMeasuresModal}
          />
        )}
      </section>

      <TornoMeasuresDialog state={measuresModal} onClose={closeMeasuresModal} />
    </div>
  );
}

/* ===== Subcomponentes reusados/adaptados ===== */
function LastUpdated({ live, timestamp }: { live: boolean; timestamp: number | null }) {
  const [, tick] = useState(0);
  useVisibleInterval(() => tick((value) => value + 1), 30_000, []);
  return (
    <Badge
      live={live}
      label={timestamp ? `Actualizado hace ${timeAgo(timestamp)}` : "Esperando actualización"}
    />
  );
}

function QueueSummary({
  summary,
  pending,
  partial,
}: {
  summary: ReturnType<typeof summarizeAdminQueue>;
  pending: boolean;
  partial: boolean;
}) {
  const metrics = [
    { label: "Órdenes en ronda", value: summary.total, tone: "text-[var(--app-text)]" },
    {
      label: "Localidades con órdenes",
      value: summary.activeLocalidades,
      tone: "text-[var(--app-text)]",
    },
    {
      label: "Prioridad alta",
      value: summary.highPriority,
      tone: "text-amber-700 dark:text-amber-300",
    },
    {
      label: "Movimientos detenidos",
      value: summary.stopped,
      tone: "text-rose-700 dark:text-rose-300",
    },
  ];
  return (
    <div className="mb-5">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="min-w-0 rounded-xl border border-slate-200 bg-[var(--app-surface)] px-4 py-3 dark:border-slate-800"
          >
            <p className="text-xs leading-5 text-[var(--app-text-muted)]">{metric.label}</p>
            <p className={`mt-2 text-2xl font-semibold tabular-nums ${metric.tone}`}>
              {pending || partial ? "—" : metric.value}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-[var(--app-text-muted)]">
        {partial
          ? "Totales no disponibles: hay localidades sin actualizar."
          : pending
            ? "Los totales estarán disponibles al completar la consulta."
            : "Resumen de las rondas devueltas para la selección actual."}
      </p>
    </div>
  );
}

function Badge({ live, label }: { live: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs
      ${
        live
          ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
          : "border-slate-300 bg-[var(--app-surface-subtle)] text-[var(--app-text-muted)] dark:text-slate-300"
      }`}
    >
      <span
        className={`inline-block h-2 w-2 rounded-full ${live ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`}
        aria-hidden
      />
      {label}
    </span>
  );
}
function Btn({
  onClick,
  active,
  disabled,
  labelOn,
  labelOff,
  iconOn,
  iconOff,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  labelOn: string;
  labelOff?: string;
  iconOn: ReactNode;
  iconOff?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={active ? labelOn : (labelOff ?? labelOn)}
      aria-label={active ? labelOn : (labelOff ?? labelOn)}
      aria-pressed={active}
      className="rounded-lg border border-slate-300 bg-[var(--app-surface)] px-2.5 py-1.5 text-xs transition-colors duration-150 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 flex items-center gap-1"
    >
      <span className="text-sm" aria-hidden>
        {active ? iconOn : (iconOff ?? iconOn)}
      </span>
      <span className="hidden sm:inline">{active ? labelOn : (labelOff ?? labelOn)}</span>
    </button>
  );
}

function ToastStack({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: number) => void }) {
  return (
    <div className="fixed z-50 flex justify-center px-3 inset-x-0 bottom-2 sm:inset-auto sm:right-2 sm:top-2 sm:bottom-auto sm:left-auto sm:px-0 md:bottom-4 md:right-4 md:top-auto">
      <div className="space-y-2 w-full max-w-[min(95vw,420px)]">
        <>
          {toasts.map((t) => {
            const border =
              t.kind === "move"
                ? "border-emerald-500/80"
                : t.kind === "new"
                  ? "border-sky-500/80"
                  : t.kind === "warning"
                    ? "border-amber-500/80"
                    : t.kind === "ok"
                      ? "border-emerald-600/80"
                      : t.kind === "error"
                        ? "border-rose-600/80"
                        : "border-slate-400/70";
            const tone =
              t.kind === "move"
                ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
                : t.kind === "new"
                  ? "bg-sky-50 text-sky-900 dark:bg-sky-950/40 dark:text-sky-200"
                  : t.kind === "warning"
                    ? "bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
                    : t.kind === "ok"
                      ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
                      : t.kind === "error"
                        ? "bg-rose-50 text-rose-900 dark:bg-rose-950/40 dark:text-rose-200"
                        : "bg-[var(--app-surface-subtle)] text-slate-900 dark:text-slate-100";
            return (
              <button
                key={t.id}
                role={t.kind === "warning" || t.kind === "error" ? "alert" : "status"}
                aria-live={t.kind === "warning" || t.kind === "error" ? "assertive" : "polite"}
                onClick={() => dismiss(t.id)}
                className={`w-full text-left rounded-lg px-3 py-2.5 text-sm shadow-lg border-l-4 ${tone} border ${border} hover:scale-[1.02] transition-transform duration-150`}
                title="Cerrar"
              >
                <div className="flex items-center">
                  <span className="mr-2 text-base">
                    {t.kind === "move"
                      ? "🔄"
                      : t.kind === "new"
                        ? "🆕"
                        : t.kind === "warning"
                          ? "⚠️"
                          : t.kind === "ok"
                            ? "✅"
                            : t.kind === "error"
                              ? "⛔"
                              : "ℹ️"}
                  </span>
                  <span className="flex-1">{t.text}</span>
                </div>
              </button>
            );
          })}
        </>
      </div>
    </div>
  );
}

const AllLocalidadesGrid = memo(function AllLocalidadesGrid({
  localidades,
  itemsByLoc,
  loading,
  loadedLocIds,
  unavailableLocIds,
  onSelect,
}: {
  localidades: Localidad[];
  itemsByLoc: Map<number, Ronda[]> | null;
  loading: boolean;
  loadedLocIds: number[];
  unavailableLocIds: number[];
  onSelect: (id: number) => void;
}) {
  const metadata = new Map(localidades.map((loc) => [loc.id, loc]));
  for (const [id, list] of itemsByLoc ?? []) {
    if (!metadata.has(id))
      metadata.set(id, { id, nombre: list[0]?.localidad?.nombre ?? `Localidad #${id}` });
  }
  if (!metadata.size)
    return loading ? (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <SkeletonNext key={index} />
        ))}
      </div>
    ) : (
      <EmptyState />
    );
  const loaded = new Set(loadedLocIds);
  const unavailable = new Set(unavailableLocIds);
  return (
    <div
      className={`grid items-start gap-4 ${metadata.size === 1 ? "grid-cols-1" : metadata.size === 2 ? "md:grid-cols-2" : "md:grid-cols-2 xl:grid-cols-3"}`}
    >
      {Array.from(metadata.values()).map((localidad) => {
        const list = itemsByLoc?.get(localidad.id) ?? [];
        const current = list[0];
        const currentInfo = current ? rondaInfoMap([current])[current.id] : undefined;
        const movement = currentInfo?.movimiento;
        const pending = loading && !loaded.has(localidad.id);
        const failed = unavailable.has(localidad.id);
        const special = isTorreonLocalidadId(localidad.id);
        return (
          <article
            key={localidad.id}
            className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-[var(--app-surface)] dark:border-slate-800"
            style={{ contentVisibility: "auto", containIntrinsicSize: "auto 300px" }}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-4 dark:border-slate-800">
              <div className="min-w-0">
                <h2 className="break-words font-semibold">{localidad.nombre}</h2>
                <p className="mt-1 text-xs text-[var(--app-text-muted)]">
                  {localidad.estado || "Operación ferroviaria"}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-md px-2 py-1 text-[11px] font-medium ${failed ? "bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200" : "bg-[var(--app-surface-muted)] text-[var(--app-text-muted)] dark:text-slate-300"}`}
              >
                {failed
                  ? "Sin actualizar"
                  : pending
                    ? "Consultando"
                    : `${list.length} ${list.length === 1 ? "orden" : "órdenes"}`}
              </span>
            </div>
            <div className="space-y-3 p-4">
              {pending && !current ? (
                <div className="animate-pulse space-y-3 py-2">
                  <div className="h-4 w-2/3 rounded bg-[var(--app-surface-muted)]" />
                  <div className="h-12 rounded bg-[var(--app-surface-muted)]" />
                </div>
              ) : current ? (
                <>
                  <div className="flex items-start gap-2">
                    <TrainFront
                      size={18}
                      className="mt-0.5 shrink-0 text-emerald-700 dark:text-emerald-300"
                    />
                    <div className="min-w-0">
                      <p className="break-words text-base font-semibold">
                        Locomotora {fmtLoco(movement?.locomotiveNumber ?? movement?.locomotora)}
                      </p>
                      <p className="mt-1 break-words text-xs text-[var(--app-text-muted)]">
                        {currentInfo?.empresa?.nombre ?? "—"} · Orden{" "}
                        {codeFrom(currentInfo, current.id)}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-lg bg-[var(--app-surface-subtle)] p-3">
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase text-[var(--app-text-muted)]">Origen</p>
                      <p className="mt-1 break-words text-xs font-medium">
                        {movement?.viaOrigen?.nombre || "—"}
                      </p>
                    </div>
                    <ArrowRight size={15} className="text-[var(--app-text-muted)]" />
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase text-[var(--app-text-muted)]">Destino</p>
                      <p className="mt-1 break-words text-xs font-medium">
                        {movement?.viaDestino?.nombre || "—"}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px]">
                    <span className="rounded border border-slate-200 px-2 py-1 dark:border-slate-700">
                      Ronda {current.rondaNumero} · Posición {current.orden}
                    </span>
                    <span
                      className={`rounded px-2 py-1 ${movement?.estado === "DETENIDO" ? "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300" : "bg-[var(--app-surface-muted)] text-[var(--app-text-muted)] dark:text-slate-300"}`}
                    >
                      {movement?.estado || "Sin estado"}
                    </span>
                    {movement?.prioridad === "ALTA" && (
                      <span className="rounded bg-amber-50 px-2 py-1 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                        Prioridad alta
                      </span>
                    )}
                  </div>
                  <details className="text-xs text-[var(--app-text-muted)]">
                    <summary className="cursor-pointer py-1 font-medium">
                      Instrucciones y fechas
                    </summary>
                    <p className="mt-2 whitespace-pre-wrap break-words leading-5">
                      {movement?.instrucciones?.trim() || "Sin instrucciones."}
                    </p>
                    <p className="mt-2">Solicitud: {formatDateTimeMX(movement?.fechaSolicitud)}</p>
                    <p>Inicio: {formatDateTimeMX(movement?.fechaInicio)}</p>
                    <p>Fin: {formatDateTimeMX(movement?.fechaFin)}</p>
                  </details>
                </>
              ) : (
                <p className="py-5 text-sm leading-6 text-[var(--app-text-muted)]">
                  {failed
                    ? "No se pudo consultar este patio."
                    : special
                      ? "Consulta naturales y arrastres en la operación de Torreón."
                      : "Sin órdenes en ronda."}
                </p>
              )}
              <button
                type="button"
                onClick={() => onSelect(localidad.id)}
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-700 transition-colors hover:border-emerald-300 hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-emerald-950/30"
              >
                Ver operación de {localidad.nombre}
                <ArrowRight size={14} className="shrink-0" />
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
});
function SkeletonNext() {
  return (
    <div className="animate-pulse rounded-lg border border-slate-200 bg-[var(--app-surface-subtle)] p-4 dark:border-slate-800">
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
function EmptyState() {
  return (
    <div className="py-12 text-center">
      <div className="mb-4 text-5xl">🗂️</div>
      <div className="text-lg font-semibold text-[var(--app-text)]">Sin movimientos pendientes</div>
      <div className="text-sm text-[var(--app-text-muted)] mt-2">
        No hay órdenes en la cola actualmente
      </div>
    </div>
  );
}
