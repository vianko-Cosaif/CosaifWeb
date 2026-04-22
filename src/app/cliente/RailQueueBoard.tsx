"use client";

import { useEffect, useMemo, useRef, useState, startTransition, Fragment } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { S } from "./RailQueueBoardCliente.styles";
import TornoMeasuresViewerModal from "../movimientos/torno/TornoMeasuresViewerModal";
import { parseTornoMedicionFromApi } from "../movimientos/torno/tornoMeasureParser";
import { DEFAULT_TORNO_MEDICION_STATE, type TornoMedicionState } from "../movimientos/crear/tornoMedicion.types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/xapi";

/* ═══════════ TYPES ═══════════ */
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

type MeasuresModalState = {
  open: boolean;
  loading: boolean;
  error: string | null;
  tornoMedicion: TornoMedicionState;
  locomotiveLabel?: string;
  companyName?: string;
};

/* ═══════════ UTILS ═══════════ */
const codeFrom = (inf?: RondaInfo, fallbackId?: number) =>
  String(inf?.movimientoId ?? inf?.movimiento?.id ?? fallbackId ?? "—");

const fmtLoco = (v: unknown) => {
  if (v == null) return "—";
  const s = String(v).replace(/\D+/g, "");
  return s ? s.padStart(4, "0") : "—";
};

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit", minute: "2-digit", day: "numeric", month: "short",
    hour12: true, timeZone: "America/Mexico_City",
  }).format(d);
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const r = await fetch(url, { cache: "no-store", credentials: "include", mode: "same-origin", signal });
  if (!r.ok) throw new Error(`${r.status}`);
  return (await r.json()) as T;
}

function useVisibleInterval(fn: () => void, delay: number | null, deps: readonly unknown[] = []) {
  useEffect(() => {
    if (!delay) return;
    const id = window.setInterval(() => { if (document.visibilityState === "visible") fn(); }, delay);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delay, ...deps]);
}

function useLocalStorageBoolean(key: string, initial = false) {
  const [v, setV] = useState<boolean>(initial);
  useEffect(() => { if (typeof window !== "undefined") { const item = window.localStorage.getItem(key); if (item !== null) setV(item === "1"); } }, [key]);
  useEffect(() => { if (typeof window !== "undefined") window.localStorage.setItem(key, v ? "1" : "0"); }, [key, v]);
  return [v, setV] as const;
}

function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = (text: string, kind: ToastKind) => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, text, kind }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 5000);
  };
  const dismiss = (id: number) => setToasts(t => t.filter(x => x.id !== id));
  return { toasts, push, dismiss };
}

/* ═══════════ SVG ICONS ═══════════ */
// All monochrome, 16px default, currentColor
const Ic = {
  Train: (p: { className?: string }) => (
    <svg className={p.className || "w-4 h-4"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="3" width="16" height="16" rx="2" /><path d="M4 11h16" /><path d="M12 3v8" /><circle cx="8" cy="21" r="1" /><circle cx="16" cy="21" r="1" /><path d="M8 19h8" />
    </svg>
  ),
  Refresh: (p: { className?: string }) => (
    <svg className={p.className || "w-4 h-4"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M8 16H3v5" /></svg>
  ),
  Pen: (p: { className?: string }) => (
    <svg className={p.className || "w-3.5 h-3.5"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg>
  ),
  Bell: (p: { on: boolean }) => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {p.on ? <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></> : <><path d="M13.73 21a2 2 0 0 1-3.46 0" /><path d="M18.63 13A17.89 17.89 0 0 1 18 8" /><path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14" /><path d="M18 8a6 6 0 0 0-9.33-5" /><line x1="1" y1="1" x2="23" y2="23" /></>}
    </svg>
  ),
  X: () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
  ),
  Arrow: (p: { up?: boolean; className?: string }) => (
    <svg className={p.className || "w-3 h-3"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      {p.up ? <polyline points="18 15 12 9 6 15" /> : <polyline points="6 9 12 15 18 9" />}
    </svg>
  ),
  Droplet: () => <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22a7 7 0 0 0 7-7c0-2-2-3-2-3L12 2 7 12s-2 1-2 3a7 7 0 0 0 7 7z" /></svg>,
  Gear: () => <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4a1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.16.38.25.8.25 1.22H21a2 2 0 0 1 0 4h-.09c-.38.16-.79.25-1.22.25z" /></svg>,
  File: () => <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>,
  Calendar: () => <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>,
};

const EditRondas = dynamic(() => import("../Components/EditRondas"), {
  ssr: false,
  loading: () => <div className="p-10 text-center text-sm text-slate-500">Cargando editor...</div>,
});

/* ═══════════ MAIN COMPONENT ═══════════ */
export default function RailQueueBoard({
  localidadId,
  autoMs = 120_000,
}: {
  localidadId: number;
  autoMs?: number;
}) {
  const [items, setItems] = useState<Ronda[]>([]);
  const [info, setInfo] = useState<Record<number, RondaInfo>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [openEditor, setOpenEditor] = useState(false);
  const [polling, setPolling] = useLocalStorageBoolean("rail-queue:polling", true);
  const [soundOn, setSoundOn] = useLocalStorageBoolean("rail-queue:soundOn", false);

  const bellRef = useRef<HTMLAudioElement | null>(null);
  const { toasts, push: pushToast, dismiss } = useToasts();
  const [measuresModal, setMeasuresModal] = useState<MeasuresModalState>({
    open: false,
    loading: false,
    error: null,
    tornoMedicion: DEFAULT_TORNO_MEDICION_STATE,
  });
  const prevIdsRef = useRef<number[]>([]);
  const lastCurrentId = useRef<number | null>(null);
  const firstLoad = useRef(true);
  const reqSeq = useRef(120);
  const abortRef = useRef<AbortController | null>(null);

  async function load(showRefreshing = false) {
    const mySeq = ++reqSeq.current;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    if (showRefreshing) setRefreshing(true); else setLoading(true);

    try {
      const data = await fetchJson<Ronda[]>(`/api/cliente/rondas?localidadId=${localidadId}`, ac.signal);
      data.sort((a, b) => a.rondaNumero - b.rondaNumero || a.orden - b.orden);

      const nextIds = data.map(d => d.id);
      if (!firstLoad.current && prevIdsRef.current.length && nextIds[0] && nextIds[0] !== prevIdsRef.current[0]) {
        pushToast("Orden actualizada", "move");
      }
      prevIdsRef.current = nextIds;
      if (mySeq !== reqSeq.current) return;
      setItems(data);

      const map: Record<number, RondaInfo> = {};
      for (const r of data) {
        const mv = r.movimiento || null;
        map[r.id] = {
          empresa: { id: r.empresa?.id ?? 0, nombre: r.empresa?.nombre ?? "—" },
          movimiento: {
            id: mv?.id, viaOrigen: mv?.viaOrigen ?? null, viaDestino: mv?.viaDestino ?? null,
            lavado: Boolean(mv?.lavado), torno: Boolean(mv?.torno),
            estado: mv?.estado ?? undefined, prioridad: mv?.prioridad === "BAJA" || mv?.prioridad === "ALTA" ? mv?.prioridad : undefined,
            locomotiveNumber: mv?.locomotiveNumber ?? mv?.locomotora ?? undefined, locomotora: mv?.locomotora ?? undefined,
            fechaSolicitud: mv?.fechaSolicitud, fechaInicio: mv?.fechaInicio, fechaFin: mv?.fechaFin, instrucciones: mv?.instrucciones,
          },
          movimientoId: (mv?.id ?? r.movimientoId) as number | undefined,
        };
      }
      startTransition(() => setInfo(map));
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") console.error(err);
    } finally {
      if (mySeq === reqSeq.current) { setLoading(false); setRefreshing(false); firstLoad.current = false; }
    }
  }

  useEffect(() => {
    firstLoad.current = true; prevIdsRef.current = []; setInfo({}); setItems([]); setLoading(true); load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localidadId]);

  useVisibleInterval(() => polling && load(), polling ? autoMs || null : null, [autoMs, localidadId, polling]);

  useEffect(() => {
    const curId = items[0]?.id ?? null;
    if (soundOn && curId && lastCurrentId.current && curId !== lastCurrentId.current) bellRef.current?.play().catch(() => { });
    lastCurrentId.current = curId;
  }, [items, soundOn]);

  const closeMeasuresModal = () => {
    setMeasuresModal((prev) => ({ ...prev, open: false, error: null }));
  };

  const openMeasuresModal = async (args: {
    movementId?: number | null;
    locomotiveLabel?: string;
    companyName?: string;
  }) => {
    const movementId = Number(args.movementId);
    if (!Number.isFinite(movementId) || movementId <= 0) return;

    setMeasuresModal({
      open: true,
      loading: true,
      error: null,
      tornoMedicion: DEFAULT_TORNO_MEDICION_STATE,
      locomotiveLabel: args.locomotiveLabel,
      companyName: args.companyName,
    });

    try {
      const response = await fetch(`${API_BASE}/movimientos/${movementId}/edicion`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`No se pudo cargar medidas (${response.status}).`);
      const payload = await response.json();
      setMeasuresModal((prev) => ({
        ...prev,
        loading: false,
        tornoMedicion: parseTornoMedicionFromApi(payload),
        locomotiveLabel: String(payload?.movimiento?.locomotiveNumber ?? args.locomotiveLabel ?? ""),
        companyName: payload?.movimiento?.empresa?.nombre ?? args.companyName,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudieron cargar las medidas.";
      setMeasuresModal((prev) => ({ ...prev, loading: false, error: message }));
    }
  };

  const current = items[0];
  const curInfo = current ? info[current.id] : undefined;
  const nextItems = useMemo(() => items.slice(1), [items]);

  return (
    <div className={S.Layout.root}>
      {/* ─── HEADER ─── */}
      <header className={S.Layout.header}>
        <div className={S.Header.left}>
          <h1 className={S.Header.title}>Control de Patio</h1>
          <span className={S.Header.liveBadge}><span className={S.Header.liveDot} /> EN VIVO</span>
        </div>
        <div className={S.Header.right}>
          <button onClick={() => setPolling(!polling)} className={S.Header.btn(polling)} title="Auto-refresh">
            <span className={`w-1.5 h-1.5 rounded-full ${polling ? "bg-emerald-500 dark:bg-emerald-400 animate-pulse" : "bg-slate-300 dark:bg-slate-600"}`} />
          </button>
          <button onClick={() => setSoundOn(!soundOn)} className={S.Header.btn(soundOn)} title="Sonido">
            <Ic.Bell on={soundOn} />
          </button>
          <button onClick={() => load(true)} className={S.Header.btn()} title="Actualizar">
            <Ic.Refresh className={refreshing ? "w-4 h-4 animate-spin" : "w-4 h-4"} />
          </button>
          <button onClick={() => setOpenEditor(true)} className={S.Header.btnEdit}>
            <Ic.Pen /> <span className="hidden sm:inline">Editar</span>
          </button>
        </div>
      </header>

      {/* ─── CONTENT ─── */}
      <main className={S.Layout.main}>
        {/* LEFT — Hero */}
        <section className={S.Layout.colLeft}>
          <AnimatePresence mode="wait">
            {!current ? (
              <div className={S.Layout.skeleton} />
            ) : (
              <HeroCard key={current.id} item={current} info={curInfo} onViewMeasures={openMeasuresModal} />
            )}
          </AnimatePresence>
        </section>

        {/* RIGHT — Queue */}
        <aside className={S.Layout.colRight}>
          <div className={S.List.header}>
            <span className={S.List.title}>Cola de operaciones</span>
            <span className={S.List.count}>{nextItems.length}</span>
          </div>
          <div className="flex flex-col gap-2 pb-16 overflow-y-auto max-h-[calc(100vh-120px)] pr-1">
            <AnimatePresence initial={false}>
              {nextItems.map((item, i) => (
                <QueueCard
                  key={item.id}
                  item={item}
                  info={info[item.id]}
                  prev={i > 0 ? nextItems[i - 1] : null}
                  idx={i}
                  onViewMeasures={openMeasuresModal}
                />
              ))}
            </AnimatePresence>
          </div>
        </aside>
      </main>

      {/* ─── MODAL ─── */}
      {openEditor && (
        <div className={S.Modal.overlay} onClick={() => setOpenEditor(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-5xl h-[90vh] shadow-2xl rounded-xl overflow-hidden bg-white dark:bg-slate-900"
            onClick={e => e.stopPropagation()}
          >
            <EditRondas localidadId={localidadId} onClose={() => setOpenEditor(false)} onSaved={() => { setOpenEditor(false); load(true); }} />
          </motion.div>
        </div>
      )}

      <audio ref={bellRef} src="/sounds/notification.mp3" preload="auto" />

      <TornoMeasuresViewerModal
        open={measuresModal.open && !measuresModal.loading && !measuresModal.error}
        onClose={closeMeasuresModal}
        tornoMedicion={measuresModal.tornoMedicion}
        locomotiveLabel={measuresModal.locomotiveLabel}
        companyName={measuresModal.companyName}
      />
      {measuresModal.open && (measuresModal.loading || measuresModal.error) ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/35 p-4">
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

      {/* ─── TOASTS ─── */}
      <div className={S.Toast.wrap}>
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div key={t.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 16 }}
              className={S.Toast.item(t.kind)} onClick={() => dismiss(t.id)}>{t.text}</motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ═══════════ HERO CARD ═══════════ */
function HeroCard({
  item,
  info,
  onViewMeasures,
}: {
  item: Ronda;
  info?: RondaInfo;
  onViewMeasures: (args: { movementId?: number | null; locomotiveLabel?: string; companyName?: string }) => void;
}) {
  const hi = info?.movimiento?.prioridad === "ALTA";
  const loco = fmtLoco(info?.movimiento?.locomotora || info?.movimiento?.locomotiveNumber);
  const orig = info?.movimiento?.viaOrigen?.nombre || "—";
  const dest = info?.movimiento?.viaDestino?.nombre || "—";

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={S.Card.root}>
      <div className={S.Card.accent(hi)} />

      <div className={S.Card.body}>
        {/* Top row: loco + route */}
        <div className={S.Card.topRow}>
          <div className={S.Card.locoWrap}>
            <div className={S.Card.locoIcon}><Ic.Train className="w-5 h-5 text-slate-400" /></div>
            <div>
              <div className={S.Card.locoNum}>{loco}</div>
              <div className={S.Card.locoCompany}>{info?.empresa?.nombre}</div>
            </div>
          </div>
          <div className={S.Card.routeTag}>
            <span className="text-emerald-600 dark:text-emerald-400">{orig}</span>
            <span className={S.Card.routeArrow}>→</span>
            <span className="text-blue-600 dark:text-blue-400">{dest}</span>
          </div>
        </div>

        {/* Stats grid: origin / destination / services */}
        <div className={S.Card.statsGrid}>
          <div className={S.Card.statBox}>
            <div className={S.Card.statLabel}><Ic.Arrow up className="w-3 h-3 text-emerald-600 dark:text-emerald-400 inline mr-1" />Vía origen</div>
            <div className={S.Card.statValue}>{orig}</div>
          </div>
          <div className={S.Card.statBox}>
            <div className={S.Card.statLabel}><Ic.Arrow className="w-3 h-3 text-blue-600 dark:text-blue-400 inline mr-1" />Vía destino</div>
            <div className={S.Card.statValue}>{dest}</div>
          </div>
          <div className={S.Services.wrap}>
            <div className={S.Services.label}>Servicios</div>
            <div className={S.Services.pillWrap}>
              <span className={S.Services.pill(!!info?.movimiento?.lavado)}><Ic.Droplet /> Lavado</span>
              <span className={S.Services.pill(!!info?.movimiento?.torno)}><Ic.Gear /> Torno</span>
            </div>
          </div>
        </div>

        {/* Status chips */}
        <div className={S.Card.statusRow}>
          <div className={S.Card.statusChip(hi ? "red" : "")}>
            <div className={S.Card.chipLabel}>Estado</div>
            <div className={S.Card.chipValue}>{info?.movimiento?.estado || "SOLICITADO"}</div>
          </div>
          <div className={S.Card.statusChip(hi ? "red" : "emerald")}>
            <div className={S.Card.chipLabel}>Prioridad</div>
            <div className={S.Card.chipValue}>{info?.movimiento?.prioridad || "BAJA"}</div>
          </div>
          <div className={S.Card.statusChip("")}>
            <div className={S.Card.chipLabel}>Orden</div>
            <div className={S.Card.chipValue}>{item.orden}</div>
          </div>
          <div className={S.Card.statusChip("")}>
            <div className={S.Card.chipLabel}>Ronda</div>
            <div className={S.Card.chipValue}>{item.rondaNumero}</div>
          </div>
        </div>

        {/* Footer */}
        <div className={S.Card.footer}>
          <div className={S.Card.footerRoute}>
            Mover <strong className="text-slate-900 dark:text-white">{loco}</strong> ·{" "}
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{orig}</span> → <span className="text-blue-600 dark:text-blue-400 font-semibold">{dest}</span>
          </div>

          {info?.movimiento?.instrucciones && (
            <div className={S.Card.instrBox}>
              <div className={S.Card.instrLabel}>Instrucciones</div>
              <div className={S.Card.instrText}>{info.movimiento.instrucciones}</div>
            </div>
          )}

          <div className={S.Card.dateRow}>
            <span className="flex items-center gap-1"><Ic.Calendar /> Creado</span>
            <span className="font-semibold tabular-nums">{fmtDate(item.createdAt)}</span>
          </div>
          {null}
        </div>
      </div>
    </motion.div>
  );
}

/* ═══════════ QUEUE CARD ═══════════ */
function QueueCard({
  item,
  info,
  prev,
  idx,
  onViewMeasures: _onViewMeasures,
}: {
  item: Ronda;
  info?: RondaInfo;
  prev: Ronda | null;
  idx: number;
  onViewMeasures: (args: { movementId?: number | null; locomotiveLabel?: string; companyName?: string }) => void;
}) {
  const hi = info?.movimiento?.prioridad === "ALTA";
  const newRound = idx === 0 || item.rondaNumero !== prev?.rondaNumero;
  const loco = fmtLoco(info?.movimiento?.locomotora || info?.movimiento?.locomotiveNumber);

  return (
    <Fragment>
      {newRound && (
        <div className={S.List.divider}>
          <div className={S.List.dividerLabel}>Ronda {item.rondaNumero}</div>
          <div className={S.List.dividerLine} />
        </div>
      )}

      <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className={S.List.card(hi)}>
        {hi && <div className={S.List.highBar} />}

        <div className={S.List.topRow}>
          <div className="flex items-center gap-2">
            <div className={S.List.itemIcon}><Ic.Train className="w-3.5 h-3.5 text-slate-500" /></div>
            <div>
              <div className={S.List.itemLoco}>{loco}</div>
              <div className={S.List.itemSub}>{info?.empresa?.nombre}</div>
            </div>
          </div>
          <div className="text-right">
            <div className={S.List.itemSub}>Código</div>
            <div className="text-sm font-semibold text-slate-900 dark:text-white tabular-nums">{codeFrom(info, item.id)}</div>
          </div>
        </div>

        <div className={S.List.miniGrid}>
          <div className={S.List.miniCell}>
            <div className={S.List.miniLabel}>Origen</div>
            <div className={S.List.miniValue(false, "text-emerald-600 dark:text-emerald-400")}>{info?.movimiento?.viaOrigen?.nombre || "—"}</div>
          </div>
          <div className={S.List.miniCell}>
            <div className={S.List.miniLabel}>Destino</div>
            <div className={S.List.miniValue(false, "text-blue-600 dark:text-blue-400")}>{info?.movimiento?.viaDestino?.nombre || "—"}</div>
          </div>
        </div>

        <div className={S.List.miniGrid}>
          <div className={S.List.miniCell}>
            <div className={S.List.miniLabel}>Estado</div>
            <div className={S.List.miniValue(true)}>{info?.movimiento?.estado || "SOLICITADO"}</div>
          </div>
          <div className={S.List.miniCell}>
            <div className={S.List.miniLabel}>Prioridad</div>
            <div className={S.List.miniValue(true, hi ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400")}>{info?.movimiento?.prioridad || "BAJA"}</div>
          </div>
        </div>

        {info?.movimiento?.instrucciones && (
          <div className={S.List.instrPreview}>{info.movimiento.instrucciones}</div>
        )}

        <div className={S.List.bottom}>
          <div className="flex gap-1">
            {info?.movimiento?.lavado && <span className={S.List.badge}>LAV</span>}
            {info?.movimiento?.torno && <span className={S.List.badge}>TOR</span>}
          </div>
          <span className={S.List.date}>{fmtDate(item.createdAt)}</span>
        </div>
        {null}
      </motion.div>
    </Fragment>
  );
}


