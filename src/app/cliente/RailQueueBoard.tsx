"use client";

import { useEffect, useMemo, useRef, useState, startTransition, Fragment } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { S } from "./RailQueueBoardCliente.styles";
import QueueSegmentedFilter, { type QueueSegmentedFilterOption } from "./components/QueueSegmentedFilter";
import { useRealtimeBoardRefresh } from "../hooks/useRealtimeBoardRefresh";
import { useTornoMeasuresModal } from "@/features/torno-measures";
import {
  API_XAPI_BASE,
  codeFrom,
  fetchJson,
  fmtLoco as formatLoco,
  formatQueueDate as fmtDate,
  movementIdFrom,
} from "@/features/rail-queue/utils";
import {
  useLocalStorageBoolean,
  useToasts,
  useVisibleInterval,
} from "@/features/rail-queue/hooks";
import type {
  QueueEntityKind,
  QueueStatusKind,
  Ronda,
  RondaInfo,
} from "@/features/rail-queue/types";
import { peekCachedJson } from "@/lib/clientRequestCache";

const API_BASE = API_XAPI_BASE;
const fmtLoco = (value: unknown) => formatLoco(value, "—");

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
const TornoMeasuresViewerModal = dynamic(
  () => import("../movimientos/torno/TornoMeasuresViewerModal"),
  { ssr: false }
);

const ENTITY_OPTIONS: QueueSegmentedFilterOption<QueueEntityKind>[] = [
  { label: "Movimientos", value: "movimientos" },
  { label: "Torneados", value: "torneados" },
];

const STATUS_OPTIONS: QueueSegmentedFilterOption<QueueStatusKind>[] = [
  { label: "Pendientes", value: "pendientes" },
];

/* ═══════════ MAIN COMPONENT ═══════════ */
export default function RailQueueBoard({
  localidadId,
  autoMs = 120_000,
}: {
  localidadId: number;
  autoMs?: number;
}) {
  const [activeEntity, setActiveEntity] = useState<QueueEntityKind>("movimientos");
  const [activeStatus, setActiveStatus] = useState<QueueStatusKind>("pendientes");
  const roundsUrl = `/api/cliente/rondas?localidadId=${localidadId}&estado=${activeStatus}&entity=${activeEntity}`;
  const initialItems = peekCachedJson<Ronda[]>(roundsUrl) ?? [];
  const [items, setItems] = useState<Ronda[]>(() => initialItems);
  const [info, setInfo] = useState<Record<number, RondaInfo>>({});
  const [loading, setLoading] = useState(initialItems.length === 0);
  const [refreshing, setRefreshing] = useState(false);
  const [openEditor, setOpenEditor] = useState(false);
  const [polling, setPolling] = useLocalStorageBoolean("rail-queue:polling", true);
  const [soundOn, setSoundOn] = useLocalStorageBoolean("rail-queue:soundOn", false);

  const bellRef = useRef<HTMLAudioElement | null>(null);
  const { toasts, push: pushToast, dismiss } = useToasts();
  const { measuresModal, openMeasuresModal, closeMeasuresModal } =
    useTornoMeasuresModal(API_BASE);
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
      const responseData = await fetchJson<Ronda[]>(
        roundsUrl,
        ac.signal,
        { force: showRefreshing, ttlMs: 20_000 }
      );
      const data = [...responseData];
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

  const realtimeStatus = useRealtimeBoardRefresh({
    enabled: Boolean(localidadId),
    realtimeLocalidadId: localidadId,
    scopeLocalidadId: localidadId,
    onRefresh: () => load(true),
  });

  useEffect(() => {
    firstLoad.current = true;
    prevIdsRef.current = [];
    if (!items.length) setLoading(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localidadId, activeStatus, activeEntity]);

  useVisibleInterval(
    () => polling && load(),
    polling && realtimeStatus !== "connected" ? Math.min(autoMs, 30_000) : null,
    [autoMs, localidadId, polling, activeStatus, activeEntity, realtimeStatus]
  );

  useEffect(() => {
    const curId = items[0]?.id ?? null;
    if (soundOn && curId && lastCurrentId.current && curId !== lastCurrentId.current) bellRef.current?.play().catch(() => { });
    lastCurrentId.current = curId;
  }, [items, soundOn]);

  const entityItems = items;
  const entityOptions = useMemo<QueueSegmentedFilterOption<QueueEntityKind>[]>(
    () => ENTITY_OPTIONS.map((option) => ({
      ...option,
      count: option.value === activeEntity ? items.length : undefined,
    })),
    [activeEntity, items.length]
  );
  const statusOptions = useMemo<QueueSegmentedFilterOption<QueueStatusKind>[]>(
    () => STATUS_OPTIONS.map((option) => ({
      ...option,
      count: option.value === activeStatus ? items.length : undefined,
    })),
    [activeStatus, items.length]
  );
  const current = entityItems[0];
  const curInfo = current ? info[current.id] : undefined;
  const nextItems = useMemo(() => entityItems.slice(1), [entityItems]);
  const isHistoricalView = activeStatus === "terminados";
  const emptyMessage =
    activeEntity === "torneados"
      ? `No hay torneados ${activeStatus === "pendientes" ? "pendientes" : "terminados"}.`
      : `No hay movimientos ${activeStatus === "pendientes" ? "pendientes" : "terminados"}.`;

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
          {activeEntity === "movimientos" ? (
            <button onClick={() => setOpenEditor(true)} className={S.Header.btnEdit}>
              <Ic.Pen /> <span className="hidden sm:inline">Editar</span>
            </button>
          ) : null}
        </div>
      </header>

      {/* ─── CONTENT ─── */}
      <div className={S.Layout.main}>
        <section className="flex flex-col gap-2 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-2 shadow-[var(--app-shadow-sm)] sm:flex-row sm:items-center sm:justify-between lg:col-span-12">
          <QueueSegmentedFilter
            ariaLabel="Tipo de listado"
            options={entityOptions}
            value={activeEntity}
            onChange={setActiveEntity}
          />
          <QueueSegmentedFilter
            ariaLabel="Estado del listado"
            options={statusOptions}
            value={activeStatus}
            onChange={setActiveStatus}
          />
        </section>
        {/* LEFT — Hero */}
        {isHistoricalView ? (
          <section className="lg:col-span-12">
            <div className="mb-3 flex items-center justify-between px-0.5">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  {activeEntity === "torneados" ? "Historial de torneados" : "Historial de movimientos"}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Registros concluidos, fuera de ronda operativa.
                </p>
              </div>
              <span className={S.List.count}>{items.length}</span>
            </div>
            {loading ? (
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="h-44 rounded-lg border border-slate-200 bg-slate-100 dark:border-white/[0.06] dark:bg-white/[0.03] animate-pulse" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="flex min-h-[300px] flex-col items-center justify-center rounded-lg border border-dashed border-[var(--app-border-strong)] bg-[var(--app-surface)] p-8 text-center shadow-[var(--app-shadow-sm)]">
                <div className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Sin registros</div>
                <div className="text-lg font-semibold text-slate-800 dark:text-slate-100">{emptyMessage}</div>
                <button type="button" onClick={() => load(true)} className="mt-5 rounded-md bg-[var(--app-accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--app-accent-hover)]">
                  Actualizar
                </button>
              </div>
            ) : (
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                <AnimatePresence initial={false}>
                  {items.map((item, index) => (
                    <QueueCard
                      key={item.id}
                      item={item}
                      info={info[item.id]}
                      prev={null}
                      idx={index}
                      onViewMeasures={openMeasuresModal}
                      showRoundDivider={false}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </section>
        ) : (
          <>
        <section className={S.Layout.colLeft}>
          <AnimatePresence mode="wait">
            {loading ? (
              <div className={S.Layout.skeleton} />
            ) : !current ? (
              <div className="flex min-h-[360px] flex-col items-center justify-center rounded-lg border border-dashed border-[var(--app-border-strong)] bg-[var(--app-surface)] p-8 text-center shadow-[var(--app-shadow-sm)]">
                <div className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Sin registros</div>
                <div className="text-lg font-semibold text-slate-800 dark:text-slate-100">{emptyMessage}</div>
                <button type="button" onClick={() => load(true)} className="mt-5 rounded-md bg-[var(--app-accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--app-accent-hover)]">
                  Actualizar
                </button>
              </div>
            ) : (
              <HeroCard key={current.id} item={current} info={curInfo} onViewMeasures={openMeasuresModal} />
            )}
          </AnimatePresence>
        </section>

        {/* RIGHT — Queue */}
        <aside className={S.Layout.colRight}>
          <div className={S.List.header}>
            <span className={S.List.title}>
              {activeEntity === "torneados" ? "Cola de torneados" : "Cola de movimientos"}
            </span>
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
          </>
        )}
      </div>

      {/* ─── MODAL ─── */}
      {openEditor && (
        <div className={S.Modal.overlay} onClick={() => setOpenEditor(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="h-[90vh] w-full max-w-5xl overflow-hidden rounded-lg bg-[var(--app-surface)] shadow-[var(--app-shadow-md)]"
            onClick={e => e.stopPropagation()}
          >
            <EditRondas localidadId={localidadId} onClose={() => setOpenEditor(false)} onSaved={() => { setOpenEditor(false); load(true); }} />
          </motion.div>
        </div>
      )}

      <audio ref={bellRef} src="/sounds/notification.mp3" preload="none" />

      {measuresModal.open && !measuresModal.loading && !measuresModal.error ? (
        <TornoMeasuresViewerModal
          open
          onClose={closeMeasuresModal}
          tornoMedicion={measuresModal.tornoMedicion}
          locomotiveLabel={measuresModal.locomotiveLabel}
          companyName={measuresModal.companyName}
        />
      ) : null}
      {measuresModal.open && (measuresModal.loading || measuresModal.error) ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-md rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-[var(--app-shadow-md)]">
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
  const movementId = movementIdFrom(item, info);
  const canViewMeasures = Boolean(info?.movimiento?.torno && movementId);

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
          {canViewMeasures && (
            <button
              type="button"
              onClick={() => onViewMeasures({
                movementId,
                locomotiveLabel: loco,
                companyName: info?.empresa?.nombre,
              })}
              className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200 dark:hover:bg-emerald-900/40"
            >
              Ver mediciones
            </button>
          )}
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
  onViewMeasures,
  showRoundDivider = true,
}: {
  item: Ronda;
  info?: RondaInfo;
  prev: Ronda | null;
  idx: number;
  onViewMeasures: (args: { movementId?: number | null; locomotiveLabel?: string; companyName?: string }) => void;
  showRoundDivider?: boolean;
}) {
  const hi = info?.movimiento?.prioridad === "ALTA";
  const newRound = idx === 0 || item.rondaNumero !== prev?.rondaNumero;
  const loco = fmtLoco(info?.movimiento?.locomotora || info?.movimiento?.locomotiveNumber);
  const movementId = movementIdFrom(item, info);
  const canViewMeasures = Boolean(info?.movimiento?.torno && movementId);

  return (
    <Fragment>
      {showRoundDivider && newRound && (
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
        {canViewMeasures && (
          <button
            type="button"
            onClick={() => onViewMeasures({
              movementId,
              locomotiveLabel: loco,
              companyName: info?.empresa?.nombre,
            })}
            className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Ver mediciones
          </button>
        )}
      </motion.div>
    </Fragment>
  );
}
