"use client";
import { useCallback, useEffect, useMemo, useRef, useState, startTransition, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { MapPin, Sparkles } from "lucide-react";
import { getClientCookie, setClientCookie } from "@/lib/cookies";
import { syncFirebaseNotificationLocalidad } from "@/lib/firebase";
import { isTorreonLocalidadId } from "@/lib/torreonLocalidad";
import TornoMeasuresViewerModal from "../movimientos/torno/TornoMeasuresViewerModal";
import { useRealtimeBoardRefresh } from "../hooks/useRealtimeBoardRefresh";
import { useTornoMeasuresModal } from "@/features/torno-measures";
import {
  API_BFF_BASE,
  API_XAPI_BASE,
  attachLocalidad,
  codeFrom,
  fetchJson,
  fmtLoco,
  formatDateTimeMX,
  isAbortError,
  movementIdFrom,
  railQueueListFormatter,
  timeAgo,
  unwrapArray,
  useLocalStorageBoolean,
  useOnline,
  useRelativeClock,
  useToasts,
  useVisibleInterval,
  type Localidad,
  type Ronda,
  type RondaInfo,
  type Toast,
} from "@/features/rail-queue";
import {
  playNotificationSound,
  preloadNotificationSound,
  primeNotificationSound,
} from "@/lib/notificationSound";

const API_BASE = API_BFF_BASE;
const API_MEASURES = API_XAPI_BASE;
const ADMIN_MOVEMENTS_LOCALIDAD_KEY = "administrador:movimientosLocalidadId";
const fmtList = railQueueListFormatter;
const AdminTorreonDashboard = dynamic(
  () => import("../coordinador/torreon/CoordinatorTorreonDashboard"),
  {
    loading: () => (
      <div className="min-h-[420px] animate-pulse rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" />
    ),
  }
);

/* ===== Componente Admin ===== */
export default function RailQueueBoardAdmin({ autoMs = 120_000, nextCount = 5 }: { autoMs?: number; nextCount?: number }) {
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

  const { toasts, push: pushToast, dismiss } = useToasts();
  const { measuresModal, openMeasuresModal, closeMeasuresModal } =
    useTornoMeasuresModal(API_MEASURES);

  const prevIdsRef = useRef<number[]>([]);
  const lastCurrentId = useRef<number | null>(null);
  const firstLoad = useRef(true);
  const lastOkAt = useRef<number | null>(null);

  const reqSeq = useRef(120);
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => preloadNotificationSound(), []);

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
  const [activeLocId, setActiveLocId] = useState<number | 0>(() => {
    const ck = getClientCookie("locId");
    const n = Number(ck);
    return Number.isFinite(n) && n > 0 ? n : 0; // 0 = TODAS
  });
  const activeLoc = useMemo(() => localidades.find(l => l.id === activeLocId) || null, [localidades, activeLocId]);
  const activeIsTorreon = activeLocId > 0 && isTorreonLocalidadId(activeLocId);

  useEffect(() => {
    try {
      localStorage.setItem(
        ADMIN_MOVEMENTS_LOCALIDAD_KEY,
        activeLocId > 0 ? String(activeLocId) : "todas"
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
    window.dispatchEvent(new CustomEvent("cosaif:localidad-change", { detail: { localidadId: activeLocId } }));
    void syncFirebaseNotificationLocalidad(activeLocId).catch((error) => {
      console.warn("No se pudo sincronizar localidad FCM.", error);
    });
  }, [activeLocId]);

  async function loadLocalidades() {
    try {
      const raw = await fetchJson<unknown>(`${API_BASE}/localidades`);
      const data = unwrapArray<Localidad>(raw);
      if (data.length) {
        setLocalidades(data.sort((a, b) => a.nombre.localeCompare(b.nombre)));
        return;
      }
      throw new Error("localidades vacías");
    } catch {
      const raw = await fetchJson<unknown>(`${API_BASE}/localidades/lite`);
      const data = unwrapArray<Localidad>(raw);
      setLocalidades(data.sort((a, b) => a.nombre.localeCompare(b.nombre)));
    }
  }

  /* ====== Carga de rondas ====== */
  async function load(showRefreshing = false) {
    const mySeq = ++reqSeq.current;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    if (showRefreshing) setRefreshing(true);
    else setLoading(true);

    try {
      let data: Ronda[] = [];

      if (activeLocId > 0) {
        const url = `/api/cliente/rondas?localidadId=${activeLocId}`;
        data = await fetchJson<Ronda[]>(url, ac.signal);
        const loc = localidades.find((l) => l.id === activeLocId);
        if (loc) data = attachLocalidad(data, loc);
      } else {
        try {
          data = await fetchJson<Ronda[]>("/api/admin/rondas?all=1", ac.signal);
        } catch {
          const res = await Promise.allSettled(
            localidades.map((loc) =>
              fetchJson<Ronda[]>(`/api/cliente/rondas?localidadId=${loc.id}`, ac.signal).then((list) =>
                attachLocalidad(list, loc)
              )
            )
          );
          const merged: Ronda[] = [];
          res.forEach((r) => {
            if (r.status === "fulfilled") merged.push(...r.value);
          });
          data = merged;
        }
      }

      if (localidades.length) {
        data = data.map((r) => {
          if (r.localidad?.nombre || !r.localidadId) return r;
          const loc = localidades.find((l) => l.id === r.localidadId);
          return loc ? { ...r, localidad: { id: loc.id, nombre: loc.nombre } } : r;
        });
      }

      data.sort((a, b) => {
        if (a.rondaNumero !== b.rondaNumero) return a.rondaNumero - b.rondaNumero;
        if (a.orden !== b.orden) return a.orden - b.orden;
        return (a.id || 0) - (b.id || 0);
      });

      const prev = prevIdsRef.current;
      const nextIds = data.map((d) => d.id);

      if (!firstLoad.current) {
        if (prev.length && nextIds[0] && nextIds[0] !== prev[0]) {
          const curR = data[0];
          const curCode =
            curR.movimiento?.folioLocalidadLabel ??
            (curR.movimiento?.folioLocalidad ? `#${curR.movimiento.folioLocalidad}` : String(curR.movimiento?.id ?? curR.movimientoId ?? curR.id));
          pushToast(`Se movió la orden a ${curCode}`, "move");
        }
        const prevSet = new Set(prev);
        const created = nextIds.filter((id) => !prevSet.has(id));
        const removed = prev.filter((id) => !nextIds.includes(id));
        if (created.length) {
          const codes = created.map((id) => {
            const ronda = data.find((r) => r.id === id);
            return String(
              ronda?.movimiento?.folioLocalidadLabel ??
              (ronda?.movimiento?.folioLocalidad ? `#${ronda.movimiento.folioLocalidad}` : ronda?.movimiento?.id ?? id)
            );
          });
          pushToast(`Nueva(s): ${fmtList.format(codes)}`, "new");
        }
        if (removed.length) {
          const codes = removed.map((id) => String(id));
          pushToast(`Salió: ${fmtList.format(codes)}`, "done");
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
            idTecnico: mv?.idTecnico ?? mv?.id ?? null,
            folioLocalidad: mv?.folioLocalidad ?? null,
            folioLocalidadLabel: mv?.folioLocalidadLabel ?? null,
            viaOrigen: mv?.viaOrigen ?? null,
            viaDestino: mv?.viaDestino ?? null,
            lavado: Boolean(mv?.lavado),
            torno: Boolean(mv?.torno),
            estado: mv?.estado ?? undefined,
            prioridad: (mv?.prioridad as "BAJA" | "ALTA" | undefined) ?? undefined,
            locomotiveNumber: mv?.locomotiveNumber ?? mv?.locomotora ?? undefined,
            locomotora: mv?.locomotora ?? undefined,
            fechaSolicitud: mv?.fechaSolicitud ?? undefined,
            fechaInicio: mv?.fechaInicio ?? undefined,
            fechaFin: mv?.fechaFin ?? undefined,
            instrucciones: mv?.instrucciones ?? undefined,
          },
          movimientoId: (mv?.id ?? r.movimientoId ?? undefined) as number | undefined,
        };
      }
      startTransition(() => setInfo(mapFromList));
      lastOkAt.current = Date.now();
    } catch (err) {
      if (isAbortError(err) || ac.signal.aborted) return;
      console.error("[RailQueueBoardAdmin] load error", err);
    } finally {
      if (mySeq === reqSeq.current) {
        setLoading(false);
        setRefreshing(false);
        firstLoad.current = false;
      }
    }
  }

  useRealtimeBoardRefresh({
    enabled: !activeIsTorreon,
    realtimeLocalidadId: null,
    scopeLocalidadId: activeLocId > 0 ? activeLocId : null,
    onRefresh: () => {
      if (activeIsTorreon) return;
      if (activeLocId === 0 && localidades.length === 0) return;
      return load(true);
    },
  });

  // init
  useEffect(() => { loadLocalidades(); }, []);
  useEffect(() => {
    abortRef.current?.abort();
    firstLoad.current = true; prevIdsRef.current = []; setInfo({}); setItems([]); setLoading(true);
    if (activeIsTorreon) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    if (activeLocId === 0 && localidades.length === 0) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIsTorreon, activeLocId, localidades.map(l => l.id).join(",")]);

  useVisibleInterval(
    () => !activeIsTorreon && polling && online && load(),
    !activeIsTorreon && polling ? autoMs || null : null,
    [activeIsTorreon, autoMs, activeLocId, polling, online, localidades.length]
  );

  // sonidos
  useEffect(() => {
    const curId = items[0]?.id ?? null;
    if (soundOn && curId && lastCurrentId.current && curId !== lastCurrentId.current) {
      void playNotificationSound("ronda_movimiento_iniciado");
    }
    lastCurrentId.current = curId;
  }, [items, soundOn]);

  const current = items[0];
  const curInfo = current ? info[current.id] : undefined;
  const next = useMemo(() => items.slice(1, nextCount + 1), [items, nextCount]);
  const curMov = curInfo?.movimiento;
  const locoText = fmtLoco(curMov?.locomotiveNumber ?? curMov?.locomotora);
  const viaO = curMov?.viaOrigen?.nombre || "";
  const viaD = curMov?.viaDestino?.nombre || "";

  const hasAny = !!((viaO || "") || (viaD || "") || (curMov?.torno || curMov?.lavado));
  const solicitudText = formatDateTimeMX(curMov?.fechaSolicitud ?? null);
  const inicioText = formatDateTimeMX(curMov?.fechaInicio ?? null);
  const finText = formatDateTimeMX(curMov?.fechaFin ?? null);
  const creadoText = formatDateTimeMX(
    curMov?.fechaSolicitud ?? curMov?.fechaInicio ?? curMov?.fechaFin ?? null
  );
  const instruccionesText = curMov?.instrucciones?.trim()
    ? curMov.instrucciones.trim()
    : "Sin comentarios del coordinador.";

  // fullscreen
  useEffect(() => {
    const onChange = () => setIsFs(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  const toggleFullscreen = () => {
    try { if (document.fullscreenElement) document.exitFullscreen(); else boardRef.current?.requestFullscreen(); } catch {}
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
    <div ref={boardRef} className="min-h-svh md:min-h-dvh text-slate-900 dark:text-slate-100">
      {/* TOASTS */}
      <ToastStack toasts={toasts} dismiss={dismiss} />

      {/* TOOLBAR */}
      <div className="sticky top-0 z-40 border-b border-slate-200/60 bg-white/90 backdrop-blur-md dark:border-slate-800/60 dark:bg-neutral-950/90 pt-[env(safe-area-inset-top)]">
        <div className="mx-auto w-full max-w-screen-2xl">
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 sm:gap-4 sm:px-4 md:px-6 md:py-3">
            {/* selector de localidad */}
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200/70 bg-white/90 px-3 py-2 shadow-[0_12px_30px_rgba(15,23,42,0.12)] dark:border-slate-800/70 dark:bg-slate-900/80">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                <MapPin className="h-4 w-4" /> Localidad
              </div>
              <div className="relative">
                <select
                  value={activeLocId}
                  onChange={(e) => setActiveLocId(Number(e.target.value))}
                  className="appearance-none rounded-full border border-slate-200 bg-white px-3 py-1.5 pr-8 text-sm font-semibold text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  title="Localidad"
                >
                  <option value={0}>Todas</option>
                  {localidades.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.nombre} (#{l.id})
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                  ▾
                </span>
              </div>

              {activeLocId > 0 && (
                <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  <Sparkles className="h-3.5 w-3.5" />
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
                  <Badge live={polling} label={`Últ. act: ${timeAgo(lastOkAt.current)}`} />
                  <Btn onClick={toggleSound} active={soundOn} labelOn="Sonido" labelOff="Silencio" iconOn="🔔" iconOff="🔕" />
                  <Btn onClick={() => setPolling((p) => !p)} active={polling} labelOn="Auto" labelOff="Auto" iconOn="⏸️" iconOff="▶️" />
                  <Btn onClick={() => load(true)} disabled={refreshing} labelOn={refreshing ? "Actualizando…" : "Actualizar"} iconOn={refreshing ? "⟳" : "↻"} />
                </>
              )}
              <Btn onClick={toggleFullscreen} active={isFs} labelOn={isFs ? "Salir" : "Full"} iconOn="⤢" />
            </div>
          </div>
        </div>
      </div>

      {/* CONTENIDO */}
      <section className="mx-auto w-full max-w-screen-2xl px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8 pb-[env(safe-area-inset-bottom)]" aria-busy={loading || refreshing}>
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
            info={info}
            loading={loading}
            prefersReduced={prefersReduced ?? false}
          />
        ) : (
          <SingleLocalidadBoard
            {...{
              prefersReduced: prefersReduced ?? false,
              loading,
              refreshing,
              nextCount,
              current,
              curInfo,
              locoText,
              viaO,
              viaD,
              hasAny,
              solicitudText,
              inicioText,
              finText,
              creadoText,
              instruccionesText,
              info,
              next,
              load,
              onViewMeasures: openMeasuresModal,
            }}
          />
        )}
      </section>

      <TornoMeasuresViewerModal
        open={measuresModal.open && !measuresModal.loading && !measuresModal.error}
        onClose={closeMeasuresModal}
        tornoMedicion={measuresModal.tornoMedicion}
        locomotiveLabel={measuresModal.locomotiveLabel}
        companyName={measuresModal.companyName}
      />
      {measuresModal.open && (measuresModal.loading || measuresModal.error) ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            {measuresModal.loading ? (
              <p className="text-sm text-slate-600 dark:text-slate-300">Cargando medidas de torno...</p>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-rose-600 dark:text-rose-300">{measuresModal.error}</p>
                <button
                  type="button"
                  onClick={closeMeasuresModal}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
                >
                  Cerrar
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ===== Subcomponentes reusados/adaptados ===== */
function Badge({ live, label }: { live: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs
      ${live ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
             : "border-slate-300 bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>
      <span className={`inline-block h-2 w-2 rounded-full ${live ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} aria-hidden />
      {label}
    </span>
  );
}
function Btn({ onClick, active, disabled, labelOn, labelOff, iconOn, iconOff }:
  { onClick: () => void; active?: boolean; disabled?: boolean; labelOn: string; labelOff?: string; iconOn: string; iconOff?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 flex items-center gap-1"
    >
      <span className="text-sm">{active ? iconOn : (iconOff ?? iconOn)}</span>
      <span className="hidden sm:inline">{active ? labelOn : (labelOff ?? labelOn)}</span>
    </button>
  );
}

function ToastStack({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: number) => void; }) {
  return (
    <div className="fixed z-50 flex justify-center px-3 inset-x-0 bottom-2 sm:inset-auto sm:right-2 sm:top-2 sm:bottom-auto sm:left-auto sm:px-0 md:bottom-4 md:right-4 md:top-auto">
      <div className="space-y-2 w-full max-w-[min(95vw,420px)]">
        <AnimatePresence>
          {toasts.map((t) => {
            const border =
              t.kind === "move" ? "border-emerald-500/80" :
              t.kind === "new" ? "border-sky-500/80" :
              t.kind === "warning" ? "border-amber-500/80" :
              t.kind === "ok" ? "border-emerald-600/80" :
              t.kind === "error" ? "border-rose-600/80" : "border-slate-400/70";
            const tone =
              t.kind === "move" ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200" :
              t.kind === "new" ? "bg-sky-50 text-sky-900 dark:bg-sky-950/40 dark:text-sky-200" :
              t.kind === "warning" ? "bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200" :
              t.kind === "ok" ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200" :
              t.kind === "error" ? "bg-rose-50 text-rose-900 dark:bg-rose-950/40 dark:text-rose-200" :
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
                className={`w-full text-left rounded-lg px-3 py-2.5 text-sm shadow-lg border-l-4 ${tone} border ${border} hover:scale-[1.02] transition-transform duration-150`}
                title="Cerrar"
              >
                <div className="flex items-center">
                  <span className="mr-2 text-base">
                    {t.kind === "move" ? "🔄" : t.kind === "new" ? "🆕" : t.kind === "warning" ? "⚠️" : t.kind === "ok" ? "✅" : t.kind === "error" ? "⛔" : "ℹ️"}
                  </span>
                  <span className="flex-1">{t.text}</span>
                </div>
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ===== Vista UNA localidad ===== */
function SingleLocalidadBoard(props: {
  prefersReduced: boolean;
  loading: boolean;
  refreshing: boolean;
  nextCount: number;
  current?: Ronda;
  curInfo?: RondaInfo;
  locoText: string;
  viaO: string;
  viaD: string;
  hasAny: boolean;
  solicitudText: string;
  inicioText: string;
  finText: string;
  creadoText: string;
  instruccionesText: string;
  info: Record<number, RondaInfo>;
  next: Ronda[];
  load: (show?: boolean) => void;
  onViewMeasures: (args: { movementId?: number | null; locomotiveLabel?: string; companyName?: string }) => void;
}) {
  const {
    prefersReduced,
    loading,
    refreshing,
    nextCount,
    current,
    curInfo,
    locoText,
    viaO,
    viaD,
    hasAny,
    solicitudText,
    inicioText,
    finText,
    creadoText,
    instruccionesText,
    info,
    next,
    load,
    onViewMeasures,
  } = props;

  return (
    <div className="grid gap-4 md:gap-6 lg:gap-8 lg:grid-cols-3">
      {/* Izquierda: actual */}
      <div className="lg:col-span-2 rounded-2xl p-4 sm:p-6 bg-gradient-to-br from-white via-sky-50 to-white text-slate-800 shadow-lg border border-slate-200 dark:from-neutral-900 dark:via-neutral-800 dark:to-neutral-900 dark:text-slate-100 dark:border-slate-700">
        <div className="mb-4 flex flex-col xs:flex-row xs:items-center xs:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-sky-600 to-emerald-600 bg-clip-text text-transparent">
              Tablero de Rondas
            </h1>
            <div className="mt-1 text-xs tracking-widest font-medium text-slate-500 dark:text-slate-400 uppercase">
              Orden Actual
            </div>
          </div>
          <button
            onClick={() => load(true)}
            className="text-xs rounded-full px-4 py-2 border bg-white hover:bg-slate-50 transition-all duration-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:border-slate-600 hover:scale-105 active:scale-95 flex items-center gap-2"
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
          className="rounded-xl bg-white p-4 sm:p-6 border shadow-sm border-slate-200 dark:bg-slate-900 dark:border-slate-700 min-h-[200px]"
        >
          {loading && !current ? (
            <SkeletonCurrent />
          ) : current ? (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="grid h-12 w-12 sm:h-14 sm:w-14 place-items-center rounded-full bg-gradient-to-br from-sky-100 to-emerald-100 border border-slate-200 dark:from-slate-800 dark:to-slate-700 dark:border-slate-600">
                    <span className="text-xl sm:text-2xl">🚆</span>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">Locomotora</div>
                    <div className="text-lg font-bold text-slate-900 dark:text-slate-100">{locoText}</div>
                    <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">{curInfo?.empresa?.nombre ?? "—"}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500 dark:text-slate-400">Código</div>
                  <div className="font-black tracking-widest bg-gradient-to-r from-sky-600 to-emerald-600 bg-clip-text text-transparent text-3xl xs:text-4xl sm:text-5xl md:text-6xl lg:text-7xl">
                    {codeFrom(curInfo, current.id)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                <KV title="Vía Origen" value={viaO || "—"} prefix="↖️" />
                <KV title="Vía Destino" value={viaD || "—"} prefix="↘️" />
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                    <span>⚙️</span> Servicios
                  </div>
                  <div className="flex gap-2">
                    <Chip ok={!!curInfo?.movimiento?.lavado} icon="💧">Lavado</Chip>
                    <Chip ok={!!curInfo?.movimiento?.torno} icon="⚙️">Torno</Chip>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
                <InfoBadge label="Estado" value={curInfo?.movimiento?.estado ?? "—"} icon="📌" />
                <InfoBadge label="Prioridad" value={curInfo?.movimiento?.prioridad ?? "—"} icon="⚑" />
                <InfoBadge label="Orden" value={String(current?.orden ?? "—")} icon="№" />
                <InfoBadge label="Ronda" value={String(current?.rondaNumero ?? "—")} icon="🔁" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-4">
                <DateBox label="Solicitud" value={solicitudText} />
                <DateBox label="Inicio" value={inicioText} />
                <DateBox label="Fin" value={finText} />
              </div>

              <div className="mb-6 rounded-xl border border-slate-200 bg-white/70 p-4 text-slate-800 shadow-sm dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-100">
                <div className="text-[11px] uppercase tracking-[0.25em] text-slate-400 mb-2">
                  Comentarios / Instrucciones
                </div>
                <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                  {instruccionesText}
                </p>
              </div>

              <motion.div
                initial={{ x: prefersReduced ? 0 : -8, opacity: prefersReduced ? 1 : 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: prefersReduced ? 0 : 0.1 }}
                className="rounded-xl bg-gradient-to-r from-sky-100 to-emerald-100 text-slate-900 p-4 border border-slate-200 dark:from-slate-800 dark:to-slate-700 dark:text-slate-100 dark:border-slate-600"
              >
                <p className="text-sm font-medium">
                  {hasAny ? (
                    <>Mover locomotora <b className="text-sky-700 dark:text-sky-300">{locoText}</b> desde <b className="text-emerald-700 dark:text-emerald-300">{viaO || "—"}</b> hacia <b className="text-emerald-700 dark:text-emerald-300">{viaD || "—"}</b>.</>
                  ) : (
                    <>Mover locomotora <b className="text-sky-700 dark:text-sky-300">{locoText}</b> entre <b>—</b> y <b>—</b>.</>
                  )}
                </p>
                <div className="mt-3">
                  <DateBox label="Creado" value={creadoText} />
                </div>
                {null}
              </motion.div>
            </>
          ) : (
            <EmptyState />
          )}
        </motion.div>
      </div>

      {/* Derecha: próximas */}
      <aside className="rounded-2xl bg-white text-slate-900 shadow-lg border border-slate-200 p-4 sm:p-6 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700 h-fit max-h-[calc(100vh-200px)] overflow-y-auto">
        <div className="mb-4 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-900 pb-2">
          <h3 className="flex items-center gap-2 font-bold text-lg"><span className="text-xl">📋</span> Próximas Órdenes</h3>
          <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {next.length}/{nextCount}
          </span>
        </div>
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {loading && next.length === 0 ? (
              Array.from({ length: nextCount }).map((_, i) => <SkeletonNext key={i} />)
            ) : (
              next.map((n, index) => {
                const inf = info[n.id];
                const mv = inf?.movimiento;
                const loco = fmtLoco(mv?.locomotiveNumber ?? mv?.locomotora);
                return (
                  <motion.div
                    key={n.id}
                    layout
                    initial={{ y: prefersReduced ? 0 : 14, opacity: prefersReduced ? 1 : 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: prefersReduced ? 0 : -14, opacity: prefersReduced ? 1 : 0 }}
                    transition={{ duration: prefersReduced ? 0 : 0.25, delay: prefersReduced ? 0 : index * 0.04 }}
                    className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 transition-all duration-200 hover:bg-white hover:shadow-md hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800/60 dark:hover:bg-slate-800"
                  >
                    <CardNext n={n} inf={inf} loco={loco} onViewMeasures={onViewMeasures} />
                  </motion.div>
                );
              })
            )}
            {!loading && next.length === 0 && (
              <motion.div initial={{ opacity: prefersReduced ? 1 : 0 }} animate={{ opacity: 1 }} className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                <div className="text-3xl mb-2">📭</div>
                Sin movimientos pendientes
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </aside>
    </div>
  );
}

function KV({ title, value, prefix }: { title: string; value: string; prefix: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
        <span>{prefix}</span> {title}
      </div>
      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{value}</div>
    </div>
  );
}

function CardNext({
  n,
  inf,
  loco,
  onViewMeasures,
}: {
  n: Ronda;
  inf?: RondaInfo;
  loco: string;
  onViewMeasures: (args: { movementId?: number | null; locomotiveLabel?: string; companyName?: string }) => void;
}) {
  const mv = inf?.movimiento;
  const solicitudText = formatDateTimeMX(mv?.fechaSolicitud ?? null);
  const inicioText = formatDateTimeMX(mv?.fechaInicio ?? null);
  const finText = formatDateTimeMX(mv?.fechaFin ?? null);
  const instrText = mv?.instrucciones?.trim() ? mv.instrucciones.trim() : "Sin instrucciones.";
  const movementId = movementIdFrom(n, inf);
  const canViewMeasures = Boolean(mv?.torno && movementId);
  return (
    <>
      <div className="flex items-center gap-3 mb-3">
        <div className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
          <span className="text-lg">🚆</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs text-slate-500 dark:text-slate-400">Código</div>
          <div className="truncate font-bold tracking-wide text-slate-900 dark:text-slate-100">{codeFrom(inf, n.id)}</div>
          <div className="truncate text-xs text-slate-500 dark:text-slate-400">{inf?.empresa?.nombre ?? "—"}</div>
        </div>
        <div className="whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">Ronda #{n.rondaNumero}</div>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <Cell title="Origen" value={mv?.viaOrigen?.nombre || "—"} />
        <Cell title="Destino" value={mv?.viaDestino?.nombre || "—"} />
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <Cell title="Estado" value={mv?.estado || "—"} solid />
        <Cell title="Prioridad" value={mv?.prioridad || "—"} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-slate-500 dark:text-slate-400">Loco: <span className="font-medium text-slate-700 dark:text-slate-200">{loco}</span></div>
        <div className="flex gap-1">
          <ServiceChip active={!!mv?.lavado} icon="💧" text="Lavado" />
          <ServiceChip active={!!mv?.torno} icon="⚙️" text="Torno" />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2">
        <div className="rounded-lg border border-slate-200 bg-white/70 p-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200">
          <span className="font-semibold text-slate-500 dark:text-slate-400">Instrucciones:</span>{" "}
          {instrText}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <DateBox label="Solicitud" value={solicitudText} />
          <DateBox label="Inicio" value={inicioText} />
          <DateBox label="Fin" value={finText} />
        </div>
      </div>
      {canViewMeasures && (
        <button
          type="button"
          onClick={() => onViewMeasures({
            movementId,
            locomotiveLabel: loco,
            companyName: inf?.empresa?.nombre,
          })}
          className="mt-3 w-full rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200 dark:hover:bg-emerald-900/40"
        >
          Ver mediciones
        </button>
      )}
    </>
  );
}

function Cell({ title, value, solid }: { title: string; value: string; solid?: boolean }) {
  return (
    <div className={`rounded-lg border ${solid ? "border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900" : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"} p-2`}>
      <div className="text-xs text-slate-500 dark:text-slate-400">{title}</div>
      <div className="truncate text-sm font-medium">{value}</div>
    </div>
  );
}

function AllLocalidadesGrid({
  localidades, itemsByLoc, info, loading, prefersReduced,
}: {
  localidades: Localidad[];
  itemsByLoc: Map<number, Ronda[]> | null;
  info: Record<number, RondaInfo>;
  loading: boolean;
  prefersReduced: boolean;
}) {
  return (
    <div className="grid gap-4 md:gap-6 lg:gap-8 lg:grid-cols-3">
      {loading && (!itemsByLoc || itemsByLoc.size === 0) ? (
        Array.from({ length: 6 }).map((_, i) => <SkeletonNext key={i} />)
      ) : (
        Array.from(itemsByLoc?.entries() ?? []).map(([key, list]) => {
          const cur = list[0];
          const inf = cur ? info[cur.id] : undefined;
          const mv = inf?.movimiento;
          const loco = fmtLoco(mv?.locomotiveNumber ?? mv?.locomotora);
          const locId = cur?.localidadId ?? cur?.localidad?.id ?? key;
          const locMeta = localidades.find((l) => l.id === locId);
          const locName = cur?.localidad?.nombre ?? locMeta?.nombre ?? (locId > 0 ? `Localidad #${locId}` : "Sin localidad");
          const locEstado = locMeta?.estado || "Sin estado";
          const solicitudText = formatDateTimeMX(mv?.fechaSolicitud ?? null);
          const inicioText = formatDateTimeMX(mv?.fechaInicio ?? null);
          const finText = formatDateTimeMX(mv?.fechaFin ?? null);
          const instrText = mv?.instrucciones?.trim() ? mv.instrucciones.trim() : "Sin instrucciones.";
          return (
            <motion.div
              key={key}
              layout
              initial={{ y: prefersReduced ? 0 : 14, opacity: prefersReduced ? 1 : 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs uppercase tracking-[0.25em] text-slate-400">Localidad</div>
                  <div className="text-base font-semibold text-slate-900 dark:text-slate-100">{locName}</div>
                </div>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  {locEstado}
                </span>
              </div>
              {cur ? (
                <>
                  <div className="font-semibold">{inf?.empresa?.nombre ?? "—"}</div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    Código {codeFrom(inf, cur.id)} · Loco {loco}
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    Ronda #{cur.rondaNumero} · Orden {cur.orden}
                  </div>
                  <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/70 p-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200">
                    <span className="font-semibold text-slate-500 dark:text-slate-400">Instrucciones:</span>{" "}
                    {instrText}
                  </div>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <DateBox label="Solicitud" value={solicitudText} />
                    <DateBox label="Inicio" value={inicioText} />
                    <DateBox label="Fin" value={finText} />
                  </div>
                  {null}
                </>
              ) : (
                <div className="text-sm text-slate-500 dark:text-slate-400">Sin órdenes</div>
              )}
            </motion.div>
          );
        })
      )}
    </div>
  );
}

/* ===== Reusables originales ===== */
function InfoBadge({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2 text-center dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {icon} {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{value}</div>
    </div>
  );
}
function Chip({ ok, icon, children }: { ok: boolean; icon: string; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium border transition-all duration-200 ${
      ok ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200"
         : "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"}`}>
      {icon} {children}
    </span>
  );
}
function ServiceChip({ active, icon, text }: { active: boolean; icon: string; text: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] border ${
      active ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200"
             : "border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"}`}>
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
        {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 rounded-xl bg-slate-200 dark:bg-slate-800" />)}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-12 rounded-lg bg-slate-200 dark:bg-slate-800" />)}
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
    <div className="rounded-xl border border-slate-200 bg-white/80 p-3 text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200">
      <div className="text-[10px] uppercase tracking-[0.25em] text-slate-400">{label}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}
function EmptyState() {
  return (
    <div className="py-12 text-center">
      <div className="mb-4 text-5xl">🗂️</div>
      <div className="text-lg font-semibold text-slate-700 dark:text-slate-300">Sin movimientos pendientes</div>
      <div className="text-sm text-slate-500 dark:text-slate-400 mt-2">No hay órdenes en la cola actualmente</div>
    </div>
  );
}
