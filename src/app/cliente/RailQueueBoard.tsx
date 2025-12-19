"use client";

import { useEffect, useMemo, useRef, useState, startTransition, Fragment } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";

/* =========================================
   1. TIPOS Y DEFINICIONES
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

// Formato de fecha más robusto
function formatDateTimeMX(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    day: "numeric",
    month: "short",
    hour12: true
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

function useVisibleInterval(fn: () => void, delay: number | null, deps: React.DependencyList = []) {
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
  Train: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="3" width="16" height="16" rx="2"/><path d="M4 11h16"/><path d="M12 3v8"/><path d="m8 19-2 3"/><path d="m18 22-2-3"/><circle cx="8" cy="15" r="1"/><circle cx="16" cy="15" r="1"/></svg>
  ),
  Refresh: ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
  ),
  Edit: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
  ),
  Droplet: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22a7 7 0 0 0 7-7c0-2-2-3-2-3L12 2 7 12s-2 1-2 3a7 7 0 0 0 7 7z"/></svg>
  ),
  Gear: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
  ),
  Bell: ({ on }: { on: boolean }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {on ? (
        <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></>
      ) : (
        <><path d="M8.26 8.26A6 6 0 0 1 18 8c0 7 3 9 3 9h-6"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/><path d="m2 2 20 20"/></>
      )}
    </svg>
  )
};

const EditRondas = dynamic(() => import("../Components/EditRondas"), {
  ssr: false,
  loading: () => <div className="p-10 text-center">Cargando editor...</div>
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
  const boardRef = useRef<HTMLDivElement | null>(null);
  
  const [items, setItems] = useState<Ronda[]>([]);
  const [info, setInfo] = useState<Record<number, RondaInfo>>({});
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isFs, setIsFs] = useState(false);
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
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error(err);
      } 
    } finally {
      if (mySeq === reqSeq.current) {
        setLoading(false);
        setRefreshing(false);
        firstLoad.current = false;
      }
    }
  }

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

  useEffect(() => {
    const onChange = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) boardRef.current?.requestFullscreen().catch(() => {});
    else document.exitFullscreen().catch(() => {});
  };

  const current = items[0];
  const curInfo = current ? info[current.id] : undefined;
  // AQUI APLICAMOS EL LÍMITE DE 5 ELEMENTOS
  const nextItems = useMemo(() => items.slice(1, 6), [items]);

  return (
    <div
      ref={boardRef}
      className="min-h-screen bg-[#f3f4f6] dark:bg-[#0a0a0a] text-slate-900 dark:text-slate-100 font-sans transition-colors duration-300 pb-10"
    >
      {/* HEADER COMPACTO PARA MÓVIL */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-black/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-3 md:px-6 h-14 md:h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-lg md:text-xl font-bold text-slate-800 dark:text-white leading-none">
            Control de Patio
          </h1>
          <span className="hidden xs:inline-block w-2 h-2 rounded-full bg-emerald-500 ml-1"></span>
        </div>

        <div className="flex items-center gap-2">
          {/* Botones Pequeños */}
          <button
            onClick={() => setPolling(!polling)}
            className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors border
              ${polling 
                ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/30 dark:border-emerald-800' 
                : 'bg-white text-slate-400 border-slate-200 dark:bg-slate-800 dark:border-slate-700'
              }`}
          >
             <div className={`w-2 h-2 rounded-full ${polling ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
          </button>

          <button
            onClick={() => setSoundOn(!soundOn)}
            className={`w-8 h-8 flex items-center justify-center rounded-full border transition-colors ${soundOn ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-white border-slate-200 text-slate-400 dark:bg-slate-800 dark:border-slate-700'}`}
          >
            <Icons.Bell on={soundOn} />
          </button>

          <button
            onClick={() => load(true)}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
          >
            <Icons.Refresh className={refreshing ? "animate-spin" : ""} />
          </button>

          <button
            onClick={() => setOpenEditor(true)}
            className="ml-1 flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-full text-xs font-bold shadow-md hover:bg-indigo-700 transition-transform active:scale-95"
          >
            <Icons.Edit /> <span>Editar</span>
          </button>
        </div>
      </header>

      {/* CONTENIDO */}
      <main className="max-w-[1920px] mx-auto p-3 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* COLUMNA IZQUIERDA (Tarjeta Principal) */}
        <section className="lg:col-span-7 xl:col-span-8 flex flex-col gap-4">
          <div className="flex justify-between items-end px-1">
             <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">En Proceso</h2>
          </div>

          <AnimatePresence mode="wait">
            {!current ? (
              <div className="h-[400px] w-full bg-white dark:bg-slate-900 rounded-3xl animate-pulse border border-slate-200 dark:border-slate-800" />
            ) : (
              <motion.div
                key={current.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="bg-white dark:bg-[#111] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden relative"
              >
                 {/* Borde Superior */}
                 <div className={`h-1.5 w-full ${curInfo?.movimiento?.prioridad === 'ALTA' ? 'bg-red-500' : 'bg-emerald-500'}`} />

                 <div className="p-4 md:p-8 space-y-6">
                    {/* Header: Locomotora (RESPONSIVE) */}
                    <div className="flex flex-col md:flex-row gap-4 justify-between items-start">
                       <div className="flex items-center gap-4 w-full">
                          <div className="w-14 h-14 md:w-20 md:h-20 flex-shrink-0 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-3xl md:text-4xl">
                             🚆
                          </div>
                          <div className="min-w-0 flex-1">
                             <div className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest">
                                Locomotora
                             </div>
                             {/* TEXTO LOCOMOTORA: Ajustable para móvil */}
                             <div className="text-5xl sm:text-6xl md:text-7xl font-black text-slate-900 dark:text-white tabular-nums tracking-tighter leading-none break-all">
                                {fmtLoco(curInfo?.movimiento?.locomotora || curInfo?.movimiento?.locomotiveNumber)}
                             </div>
                             <div className="text-sm md:text-lg font-medium text-slate-500 dark:text-slate-400 mt-1 truncate">
                                {curInfo?.empresa?.nombre}
                             </div>
                          </div>
                       </div>
                    </div>

                    {/* Origen / Destino */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                       <BigDataBox label="Vía Origen" value={curInfo?.movimiento?.viaOrigen?.nombre} icon="↖" />
                       <BigDataBox label="Vía Destino" value={curInfo?.movimiento?.viaDestino?.nombre} icon="↘" />
                       
                       {/* Servicios */}
                       <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 md:p-4 flex flex-col justify-center">
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                             <Icons.Gear /> Servicios
                          </div>
                          <div className="flex flex-wrap gap-2">
                             <ServicePill active={!!curInfo?.movimiento?.lavado} label="Lavado" icon={<Icons.Droplet />} />
                             <ServicePill active={!!curInfo?.movimiento?.torno} label="Torno" icon={<Icons.Gear />} />
                          </div>
                       </div>
                    </div>

                    {/* Estado / Prioridad */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                       <StatusBox label="Estado" value={curInfo?.movimiento?.estado || "SOLICITADO"} icon="📌" />
                       <StatusBox label="Prioridad" value={curInfo?.movimiento?.prioridad || "BAJA"} isHigh={curInfo?.movimiento?.prioridad === 'ALTA'} icon="🚩" />
                       <StatusBox label="Nº Orden" value={current.orden.toString()} icon="#" />
                       <StatusBox label="Ronda" value={current.rondaNumero.toString()} icon="🔁" />
                    </div>

                    {/* Footer Verde (Detalles + FECHA DESTACADA) */}
                    <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl p-4 md:p-6 relative">
                       <p className="text-sm md:text-xl font-medium text-slate-800 dark:text-slate-200 mb-4 leading-relaxed">
                          Mover locomotora <span className="font-bold text-blue-600 dark:text-blue-400">{fmtLoco(curInfo?.movimiento?.locomotora || curInfo?.movimiento?.locomotiveNumber)}</span> desde <span className="font-bold text-emerald-700 dark:text-emerald-400">{curInfo?.movimiento?.viaOrigen?.nombre || "?"}</span> hacia <span className="font-bold text-emerald-700 dark:text-emerald-400">{curInfo?.movimiento?.viaDestino?.nombre || "?"}</span>.
                       </p>

                       {/* Instrucciones */}
                       <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20 rounded-xl p-3 mb-6">
                          <div className="text-[10px] font-bold text-amber-700 dark:text-amber-500 mb-1">
                             INSTRUCCIONES
                          </div>
                          <div className="text-xs md:text-sm text-slate-700 dark:text-slate-300 italic font-medium">
                             {curInfo?.movimiento?.instrucciones || "Sin instrucciones adicionales."}
                          </div>
                       </div>
                       
                       {/* FECHA CREADA (GRANDE Y LLAMATIVA) */}
                       <div className="flex items-center justify-between p-3 bg-white/60 dark:bg-black/40 rounded-xl border border-emerald-200/50 dark:border-emerald-900/30">
                          <span className="text-xs font-black uppercase tracking-widest text-emerald-800 dark:text-emerald-500">
                             📅 Creado
                          </span>
                          <span className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tabular-nums">
                             {formatDateTimeMX(current.createdAt)}
                          </span>
                       </div>
                    </div>
                 </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* COLUMNA DERECHA */}
        <aside className="lg:col-span-5 xl:col-span-4 flex flex-col gap-4">
           <div className="flex items-center justify-between px-1">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                 Siguientes (5)
              </h2>
              <span className="bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                 {items.length > 1 ? items.length - 1 : 0} pendientes
              </span>
           </div>

           <div className="flex flex-col gap-3 pb-20">
              <AnimatePresence initial={false}>
                 {nextItems.map((item, index) => {
                    const inf = info[item.id];
                    const isHigh = inf?.movimiento?.prioridad === 'ALTA';
                    const prevItem = index > 0 ? nextItems[index - 1] : null;
                    const isNewRound = index === 0 || item.rondaNumero !== prevItem?.rondaNumero;

                    return (
                       <Fragment key={item.id}>
                          {isNewRound && (
                             <div className="sticky top-14 z-10 py-2 bg-[#f3f4f6]/95 dark:bg-[#0a0a0a]/95 backdrop-blur-sm">
                                <div className="flex items-center gap-3">
                                   <div className="bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest">
                                      Ronda {item.rondaNumero}
                                   </div>
                                   <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800"></div>
                                </div>
                             </div>
                          )}

                          <motion.div
                             initial={{ opacity: 0, x: 20 }}
                             animate={{ opacity: 1, x: 0 }}
                             exit={{ opacity: 0 }}
                             className={`bg-white dark:bg-[#111] rounded-2xl p-4 border shadow-sm relative overflow-hidden
                                ${isHigh ? 'border-red-200 dark:border-red-900/30' : 'border-slate-200 dark:border-slate-800'}
                             `}
                          >
                             {isHigh && <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500"></div>}

                             <div className="flex justify-between items-start mb-3 pl-2">
                                <div className="flex items-center gap-3">
                                   <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-lg">
                                      🚆
                                   </div>
                                   <div>
                                      <div className="text-xl md:text-2xl font-black text-slate-900 dark:text-white leading-none">
                                         {fmtLoco(inf?.movimiento?.locomotora || inf?.movimiento?.locomotiveNumber)}
                                      </div>
                                      <div className="text-[10px] text-slate-400 font-bold uppercase">
                                         {inf?.empresa?.nombre}
                                      </div>
                                   </div>
                                </div>
                                <div className="text-right">
                                   <div className="text-[10px] text-slate-400 font-bold uppercase">Código</div>
                                   <div className="text-base font-bold text-slate-700 dark:text-slate-300">
                                      {codeFrom(inf, item.id)}
                                   </div>
                                </div>
                             </div>

                             <div className="grid grid-cols-2 gap-2 mb-2 pl-2">
                                <MiniBox label="Origen" value={inf?.movimiento?.viaOrigen?.nombre} />
                                <MiniBox label="Destino" value={inf?.movimiento?.viaDestino?.nombre} highlight />
                             </div>

                             <div className="grid grid-cols-2 gap-2 mb-3 pl-2">
                                <MiniBox label="Estado" value={inf?.movimiento?.estado || "SOLICITADO"} bold />
                                <MiniBox label="Prioridad" value={inf?.movimiento?.prioridad || "BAJA"} textColor={isHigh ? 'text-red-600' : 'text-emerald-600'} bold />
                             </div>

                             {/* Instrucciones y Footer */}
                             <div className="pl-2 space-y-2">
                                {inf?.movimiento?.instrucciones && (
                                   <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20 p-2 rounded-lg">
                                      <p className="text-[10px] text-amber-800 dark:text-amber-500 italic">
                                         {inf.movimiento.instrucciones}&quot;
                                      </p>
                                   </div>
                                )}
                                
                                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                                   <div className="flex gap-1">
                                      {inf?.movimiento?.lavado && <Badge label="Lav" icon="💧" />}
                                      {inf?.movimiento?.torno && <Badge label="Tor" icon="⚙️" />}
                                   </div>
                                   <div className="text-xs font-bold text-slate-900 dark:text-white">
                                      {item.createdAt ? formatDateTimeMX(item.createdAt) : ''}
                                   </div>
                                </div>
                             </div>
                          </motion.div>
                       </Fragment>
                    );
                 })}
              </AnimatePresence>
           </div>
        </aside>
      </main>

      {/* MODAL EDITOR */}
      {openEditor && (
         <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-2">
            <motion.div 
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               className="bg-white dark:bg-[#121214] w-full max-w-5xl h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            >
               <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-[#0a0a0a]">
                  <h3 className="font-bold text-sm md:text-lg dark:text-white flex items-center gap-2">
                     <Icons.Edit /> Editar Rondas
                  </h3>
                  <button onClick={() => setOpenEditor(false)} className="w-8 h-8 flex items-center justify-center hover:bg-slate-200 rounded-full text-slate-500">✕</button>
               </div>
               <div className="flex-1 overflow-auto bg-slate-100 dark:bg-black p-0">
                  <EditRondas localidadId={localidadId} onClose={() => setOpenEditor(false)} onSaved={() => { setOpenEditor(false); load(true); }} />
               </div>
            </motion.div>
         </div>
      )}
      
      <audio ref={bellRef} src="/sounds/notification.mp3" preload="auto" />
      
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
         <AnimatePresence>
            {toasts.map(t => (
               <motion.div
                  key={t.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className={`pointer-events-auto shadow-xl rounded-lg px-3 py-2 flex items-center gap-2 max-w-[280px] border backdrop-blur-md text-xs font-bold
                     ${t.kind === 'move' ? 'bg-emerald-500/95 text-white border-emerald-400' : 'bg-slate-800/95 text-white border-slate-700'}
                  `}
               >
                  <span>{t.kind === 'move' ? '🔄' : 'ℹ️'}</span>
                  <span>{t.text}</span>
               </motion.div>
            ))}
         </AnimatePresence>
      </div>
    </div>
  );
}

/* =========================================
   COMPONENTES UI (BENTO)
   ========================================= */

function BigDataBox({ label, value, icon }: { label: string, value?: string | null, icon?: string }) {
   return (
      <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 md:p-4">
         <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
            <span>{icon}</span> {label}
         </div>
         <div className="text-xl md:text-2xl font-bold text-slate-800 dark:text-slate-100 truncate">
            {value || "—"}
         </div>
      </div>
   );
}

function StatusBox({ label, value, isHigh, icon }: { label: string, value: string, isHigh?: boolean, icon?: string }) {
   return (
      <div className={`rounded-2xl p-3 md:p-4 border flex flex-col items-center justify-center text-center
         ${isHigh ? 'bg-red-50 border-red-200 dark:bg-red-900/20' : 'bg-white border-slate-200 dark:bg-slate-900/40'}
      `}>
         <div className={`text-[9px] font-bold uppercase tracking-widest mb-1 flex items-center gap-1 ${isHigh ? 'text-red-500' : 'text-slate-400'}`}>
            {icon} {label}
         </div>
         <div className={`text-sm md:text-lg font-bold ${isHigh ? 'text-red-700' : 'text-slate-900 dark:text-slate-100'}`}>
            {value}
         </div>
      </div>
   );
}

function ServicePill({ active, label, icon }: { active: boolean, label: string, icon: React.ReactNode }) {
   return (
      <div className={`flex items-center gap-1 px-3 py-1 rounded-full border text-xs font-bold
         ${active ? 'bg-white shadow-sm border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200' : 'bg-slate-100 text-slate-400 border-transparent opacity-50 grayscale'}
      `}>
         {icon} {label}
      </div>
   );
}

function MiniBox({ label, value, highlight, bold, textColor }: { label: string, value?: string | null, highlight?: boolean, bold?: boolean, textColor?: string }) {
   return (
      <div className={`rounded-lg p-2 border
         ${highlight ? 'bg-blue-50/50 border-blue-100 dark:bg-blue-900/10' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100'}
      `}>
         <div className="text-[9px] text-slate-400 font-bold uppercase mb-0.5">{label}</div>
         <div className={`text-xs md:text-sm truncate ${bold ? 'font-bold' : 'font-medium'} ${textColor || 'text-slate-700 dark:text-slate-200'}`}>
            {value || "—"}
         </div>
      </div>
   );
}

function Badge({ label, icon }: { label: string, icon: string }) {
   return (
      <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-[9px] font-bold border border-blue-100">
         {icon} {label}
      </span>
   );
}