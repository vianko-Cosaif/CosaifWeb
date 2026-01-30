
"use client";

import { useEffect, useMemo, useRef, useState, startTransition, Fragment } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { S } from "./RailQueueBoardCliente.styles";

/* =========================================
   1. TIPOS (Sin cambios en lógica de datos)
   ========================================= */

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

/* =========================================
   2. UTILS
   ========================================= */

const codeFrom = (inf?: RondaInfo, fallbackId?: number) =>
  String(inf?.movimientoId ?? inf?.movimiento?.id ?? fallbackId ?? "—");

const fmtLoco = (v: unknown) => {
  if (v == null) return "N/D";
  const s = String(v).replace(/\D+/g, "");
  return s ? s.padStart(4, "0") : "N/D";
};

function formatDateTimeMX(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    day: "numeric",
    month: "short",
    hour12: true,
    timeZone: "America/Mexico_City",
  }).format(d);
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const r = await fetch(url, {
    cache: "no-store",
    credentials: "include",
    mode: "same-origin",
    signal,
  });
  if (!r.ok) throw new Error(`${r.status}`);
  return (await r.json()) as T;
}

function useVisibleInterval(fn: () => void, delay: number | null, deps: readonly unknown[] = []) {
  useEffect(() => {
    if (!delay) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") fn();
    }, delay);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delay, ...deps]);
}

function useLocalStorageBoolean(key: string, initial = false) {
  const [v, setV] = useState<boolean>(initial);
  useEffect(() => {
    if (typeof window !== "undefined") {
      const item = window.localStorage.getItem(key);
      if (item !== null) setV(item === "1");
    }
  }, [key]);
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(key, v ? "1" : "0");
    }
  }, [key, v]);
  return [v, setV] as const;
}

function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = (text: string, kind: ToastKind) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  };
  const dismiss = (id: number) => setToasts((t) => t.filter((x) => x.id !== id));
  return { toasts, push, dismiss };
}

/* =========================================
   3. ICONOS
   ========================================= */
const Icons = {
  Refresh: ({ className }: { className?: string }) => (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M8 16H3v5" /></svg>
  ),
  Edit: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
  ),
  Droplet: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22a7 7 0 0 0 7-7c0-2-2-3-2-3L12 2 7 12s-2 1-2 3a7 7 0 0 0 7 7z" /></svg>
  ),
  Gear: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
  ),
  Bell: ({ on }: { on: boolean }) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {on ? <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></> : <><path d="M8.26 8.26A6 6 0 0 1 18 8c0 7 3 9 3 9h-6" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /><path d="m2 2 20 20" /></>}
    </svg>
  ),
};

const EditRondas = dynamic(() => import("../Components/EditRondas"), {
  ssr: false,
  loading: () => <div className="p-10 text-center animate-pulse text-slate-400">Cargando editor...</div>,
});

/* =========================================
   4. COMPONENTE PRINCIPAL
   ========================================= */
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

    if (showRefreshing) setRefreshing(true);
    else setLoading(true);

    try {
      const url = `/api/cliente/rondas?localidadId=${localidadId}`;
      const data = await fetchJson<Ronda[]>(url, ac.signal);

      // Ordenar por ronda y luego por orden de ejecución
      data.sort((a, b) => a.rondaNumero - b.rondaNumero || a.orden - b.orden);

      const nextIds = data.map((d) => d.id);
      if (!firstLoad.current) {
        const prev = prevIdsRef.current;
        if (prev.length && nextIds[0] && nextIds[0] !== prev[0]) {
          pushToast(`Orden actual actualizada`, "move");
        }
      }
      prevIdsRef.current = nextIds;

      if (mySeq !== reqSeq.current) return;

      setItems(data);

      // Normalizar datos para UI
      const mapFromList: Record<number, RondaInfo> = {};
      for (const r of data) {
        const mv = r.movimiento || null;
        mapFromList[r.id] = {
          empresa: { id: r.empresa?.id ?? 0, nombre: r.empresa?.nombre ?? "—" },
          movimiento: {
            id: mv?.id,
            viaOrigen: mv?.viaOrigen ?? null,
            viaDestino: mv?.viaDestino ?? null,
            lavado: Boolean(mv?.lavado),
            torno: Boolean(mv?.torno),
            estado: mv?.estado ?? undefined,
            prioridad: mv?.prioridad === "BAJA" || mv?.prioridad === "ALTA" ? mv?.prioridad : undefined,
            locomotiveNumber: mv?.locomotiveNumber ?? mv?.locomotora ?? undefined,
            locomotora: mv?.locomotora ?? undefined,
            fechaSolicitud: mv?.fechaSolicitud,
            fechaInicio: mv?.fechaInicio,
            fechaFin: mv?.fechaFin,
            instrucciones: mv?.instrucciones,
          },
          movimientoId: (mv?.id ?? r.movimientoId) as number | undefined,
        };
      }

      startTransition(() => setInfo(mapFromList));
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") console.error(err);
    } finally {
      if (mySeq === reqSeq.current) {
        setLoading(false);
        setRefreshing(false);
        firstLoad.current = false;
      }
    }
  }

  // --- Effects ---
  useEffect(() => {
    firstLoad.current = true;
    prevIdsRef.current = [];
    setInfo({});
    setItems([]);
    setLoading(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localidadId]);

  useVisibleInterval(() => polling && load(), polling ? autoMs || null : null, [autoMs, localidadId, polling]);

  useEffect(() => {
    const curId = items[0]?.id ?? null;
    if (soundOn && curId && lastCurrentId.current && curId !== lastCurrentId.current) {
      bellRef.current?.play().catch(() => {});
    }
    lastCurrentId.current = curId;
  }, [items, soundOn]);

  // --- Derived Data ---
  const current = items[0];
  const curInfo = current ? info[current.id] : undefined;
  const nextItems = useMemo(() => items.slice(1, 6), [items]);

  return (
    <div className={S.Layout.root}>
      {/* HEADER */}
      <header className={S.Header.root}>
        <div className={S.Header.left}>
          <h1 className={S.Header.title}>Control de Patio</h1>
          <span className={S.Header.dot} />
        </div>

        <div className={S.Header.right}>
          <button onClick={() => setPolling(!polling)} className={S.Header.btnPolling(polling)}>
            <div className={S.Header.pollingDot(polling)} />
          </button>

          <button onClick={() => setSoundOn(!soundOn)} className={S.Header.btnSound(soundOn)}>
            <Icons.Bell on={soundOn} />
          </button>

          <button onClick={() => load(true)} className={S.Header.btnRefresh}>
            <Icons.Refresh className={S.Header.refreshIcon(refreshing)} />
          </button>

          <button onClick={() => setOpenEditor(true)} className={S.Header.btnEdit}>
            <Icons.Edit /> <span>Editar</span>
          </button>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <main className={S.Layout.main}>
        {/* IZQUIERDA: TARJETA PRINCIPAL */}
        <section className={S.Layout.columnLeft}>
          <div className={S.Header.left}> {/* Reusando flex container */}
            <h2 className={S.List.headerLabel}>En Proceso</h2>
          </div>

          <AnimatePresence mode="wait">
            {!current ? (
              <div className={S.Layout.skeleton} />
            ) : (
              <CurrentCardView item={current} info={curInfo} />
            )}
          </AnimatePresence>
        </section>

        {/* DERECHA: LISTA DE SIGUIENTES */}
        <aside className={S.Layout.columnRight}>
          <div className={S.List.header}>
            <h2 className={S.List.headerLabel}>Siguientes</h2>
            <span className={S.List.countBadge}>{items.length > 1 ? items.length - 1 : 0} pendientes</span>
          </div>

          <div className={S.List.wrapper}>
            <AnimatePresence initial={false}>
              {nextItems.map((item, index) => (
                <NextListItem 
                  key={item.id} 
                  item={item} 
                  info={info[item.id]} 
                  prevItem={index > 0 ? nextItems[index - 1] : null}
                  index={index}
                />
              ))}
            </AnimatePresence>
          </div>
        </aside>
      </main>

      {/* MODAL EDITOR */}
      {openEditor && (
        <div className={S.Modal.overlay}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className={S.Modal.card}>
            <div className={S.Modal.header}>
              <h3 className="font-bold text-lg dark:text-white flex items-center gap-2">
                <Icons.Edit /> Editar Rondas
              </h3>
              <button onClick={() => setOpenEditor(false)} className={S.Modal.closeBtn}>
                ✕
              </button>
            </div>
            <div className={S.Modal.body}>
              <EditRondas
                localidadId={localidadId}
                onClose={() => setOpenEditor(false)}
                onSaved={() => {
                  setOpenEditor(false);
                  load(true);
                }}
              />
            </div>
          </motion.div>
        </div>
      )}

      <audio ref={bellRef} src="/sounds/notification.mp3" preload="auto" />

      {/* TOASTS */}
      <div className={S.Toast.wrap}>
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className={S.Toast.item(t.kind)}
              onClick={() => dismiss(t.id)}
            >
              <span className="text-lg">{t.kind === "move" ? "🔄" : "ℹ️"}</span>
              <span>{t.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* =========================================
   5. SUB-COMPONENTES (UI VIEWS)
   ========================================= */

function CurrentCardView({ item, info }: { item: Ronda; info?: RondaInfo }) {
  const isHigh = info?.movimiento?.prioridad === "ALTA";
  const loco = fmtLoco(info?.movimiento?.locomotora || info?.movimiento?.locomotiveNumber);

  return (
    <motion.div
      key={item.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className={S.Card.root}
    >
      <div className={S.Card.priorityBar(isHigh)} />

      <div className={S.Card.inner}>
        {/* Header: Locomotora */}
        <div className={S.Card.header}>
          <div className={S.Card.headerLeft}>
            <div className={S.Card.trainBubble}>🚆</div>
            <div className={S.Card.infoCol}>
              <div className={S.Card.labelSm}>Locomotora</div>
              <div className={S.Card.locoValue}>{loco}</div>
              <div className={S.Card.company}>{info?.empresa?.nombre}</div>
            </div>
          </div>
        </div>

        {/* Origen / Destino / Servicios */}
        <div className={S.Card.gridStats}>
          <BigDataBox label="Vía Origen" value={info?.movimiento?.viaOrigen?.nombre} icon="↖" />
          <BigDataBox label="Vía Destino" value={info?.movimiento?.viaDestino?.nombre} icon="↘" />

          <div className={S.Components.servicesBox}>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
              <Icons.Gear /> Servicios
            </div>
            <div className="flex flex-wrap gap-2">
              <ServicePill active={!!info?.movimiento?.lavado} label="Lavado" icon={<Icons.Droplet />} />
              <ServicePill active={!!info?.movimiento?.torno} label="Torno" icon={<Icons.Gear />} />
            </div>
          </div>
        </div>

        {/* Estado y Metadata */}
        <div className={S.Card.gridStatus}>
          <StatusBox label="Estado" value={info?.movimiento?.estado || "SOLICITADO"} icon="📌" />
          <StatusBox
            label="Prioridad"
            value={info?.movimiento?.prioridad || "BAJA"}
            isHigh={isHigh}
            icon="🚩"
          />
          <StatusBox label="Nº Orden" value={item.orden.toString()} icon="#" />
          <StatusBox label="Ronda" value={item.rondaNumero.toString()} icon="🔁" />
        </div>

        {/* Footer Verde Instrucciones */}
        <div className={S.Components.footerGreen}>
          <p className="text-sm md:text-xl font-medium text-slate-800 dark:text-slate-200 mb-4 leading-relaxed">
            Mover locomotora <span className="font-bold text-blue-600 dark:text-blue-400">{loco}</span> desde{" "}
            <span className="font-bold text-emerald-700 dark:text-emerald-400">
              {info?.movimiento?.viaOrigen?.nombre || "?"}
            </span>{" "}
            hacia{" "}
            <span className="font-bold text-emerald-700 dark:text-emerald-400">
              {info?.movimiento?.viaDestino?.nombre || "?"}
            </span>.
          </p>

          <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20 rounded-xl p-3 mb-6">
            <div className="text-[10px] font-bold text-amber-700 dark:text-amber-500 mb-1">INSTRUCCIONES</div>
            <div className="text-xs md:text-sm text-slate-700 dark:text-slate-300 italic font-medium">
              {info?.movimiento?.instrucciones || "Sin instrucciones adicionales."}
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-white/60 dark:bg-black/40 rounded-xl border border-emerald-200/50 dark:border-emerald-900/30">
            <span className="text-xs font-black uppercase tracking-widest text-emerald-800 dark:text-emerald-500">📅 Creado</span>
            <span className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tabular-nums">
              {formatDateTimeMX(item.createdAt)}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function NextListItem({ item, info, prevItem, index }: { item: Ronda; info?: RondaInfo; prevItem: Ronda | null, index: number }) {
  const isHigh = info?.movimiento?.prioridad === "ALTA";
  const isNewRound = index === 0 || item.rondaNumero !== prevItem?.rondaNumero;
  const loco = fmtLoco(info?.movimiento?.locomotora || info?.movimiento?.locomotiveNumber);

  return (
    <Fragment>
      {isNewRound && (
        <div className={S.List.stickyHeader}>
          <div className={S.List.stickyInner}>
            <div className={S.List.stickyChip}>Ronda {item.rondaNumero}</div>
            <div className={S.List.stickyLine} />
          </div>
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0 }}
        className={S.List.itemCard(isHigh)}
      >
        {isHigh && <div className={S.List.itemHighBar} />}

        <div className={S.List.itemTop}>
          <div className="flex items-center gap-3">
            <div className={S.List.itemBubble}>🚆</div>
            <div>
              <div className={S.List.itemLoco}>{loco}</div>
              <div className={S.List.itemSub}>{info?.empresa?.nombre}</div>
            </div>
          </div>

          <div className="text-right">
            <div className={S.List.itemSub}>Código</div>
            <div className="text-base font-bold text-slate-700 dark:text-slate-300">{codeFrom(info, item.id)}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-2 pl-2">
          <MiniBox label="Origen" value={info?.movimiento?.viaOrigen?.nombre} />
          <MiniBox label="Destino" value={info?.movimiento?.viaDestino?.nombre} highlight />
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3 pl-2">
          <MiniBox label="Estado" value={info?.movimiento?.estado || "SOLICITADO"} bold />
          <MiniBox
            label="Prioridad"
            value={info?.movimiento?.prioridad || "BAJA"}
            textColor={isHigh ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}
            bold
          />
        </div>

        <div className="pl-2 space-y-2">
          {!!info?.movimiento?.instrucciones && (
            <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20 p-2 rounded-lg">
              <p className="text-[10px] text-amber-800 dark:text-amber-500 italic">{info.movimiento.instrucciones}</p>
            </div>
          )}

          <div className={S.List.itemFooter}>
            <div className="flex gap-1">
              {info?.movimiento?.lavado && <Badge label="Lav" icon="💧" />}
              {info?.movimiento?.torno && <Badge label="Tor" icon="⚙️" />}
            </div>
            <div className={S.List.itemDate}>{item.createdAt ? formatDateTimeMX(item.createdAt) : ""}</div>
          </div>
        </div>
      </motion.div>
    </Fragment>
  );
}

/* =========================================
   6. ATOMS
   ========================================= */

function BigDataBox({ label, value, icon }: { label: string; value?: string | null; icon?: string }) {
  return (
    <div className={S.Components.servicesBox}>
      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
        <span>{icon}</span> {label}
      </div>
      <div className="text-xl md:text-2xl font-bold text-slate-800 dark:text-slate-100 truncate">{value || "—"}</div>
    </div>
  );
}

function StatusBox({ label, value, isHigh, icon }: { label: string; value: string; isHigh?: boolean; icon?: string }) {
  return (
    <div className={S.Components.statusBox(isHigh)}>
      <div className={`text-[9px] font-bold uppercase tracking-widest mb-1 flex items-center gap-1 ${isHigh ? "text-red-500" : "text-slate-400"}`}>
        {icon} {label}
      </div>
      <div className={S.Components.statusValue(isHigh)}>{value}</div>
    </div>
  );
}

function ServicePill({ active, label, icon }: { active: boolean; label: string; icon: React.ReactNode }) {
  return <div className={S.Components.pill(active)}>{icon} {label}</div>;
}

function MiniBox({ label, value, highlight, bold, textColor }: { label: string; value?: string | null; highlight?: boolean; bold?: boolean; textColor?: string }) {
  return (
    <div className={`rounded-lg p-2 border ${highlight ? "bg-blue-50/50 border-blue-100 dark:bg-blue-900/10" : "bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800"}`}>
      <div className="text-[9px] text-slate-400 font-bold uppercase mb-0.5">{label}</div>
      <div className={`text-xs md:text-sm truncate ${bold ? "font-bold" : "font-medium"} ${textColor || "text-slate-700 dark:text-slate-200"}`}>
        {value || "—"}
      </div>
    </div>
  );
}

function Badge({ label, icon }: { label: string; icon: string }) {
  return <span className={S.Components.badgeBlue}>{icon} {label}</span>;
}
