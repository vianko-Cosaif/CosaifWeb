"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useRealtimeBoardRefresh } from "@/app/hooks/useRealtimeBoardRefresh";
import { useVisibleInterval } from "@/features/rail-queue/hooks";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Clock3,
  Gauge,
  MapPinned,
  PauseCircle,
  RefreshCw,
  Route,
  TrainFront,
  Wrench,
  type LucideIcon,
} from "lucide-react";

type PanelGraficoProps = {
  backHref?: string;
  backLabel?: string;
  localidadId?: number | null;
  empresaId?: number | null;
  autoMs?: number;
};

type IncidentSeverity = "CRITICO" | "ALTO" | "MEDIO" | "BAJO";
type MovementStatus = "DETENIDO" | "EN PROCESO" | "SOLICITADO" | "EN COLA" | "EN ESPERA";
type MovementType = "Torno" | "Lavado" | "Normal";

type IncidentRow = {
  key: string;
  id: string;
  severity: IncidentSeverity;
  title: string;
  equipment: string;
  equipmentKey: string;
  time: string;
  occurredAtMs: number;
  rawStatus: string;
  active: boolean;
  signature: string;
};

type MovementRow = {
  key: string;
  equipment: string;
  company: string;
  route: string;
  origin: string;
  destination: string;
  type: MovementType;
  status: MovementStatus;
  time: string;
  requestedAtMs: number;
  rondaNumero: number;
  orden: number;
  activeIncidentCount: number;
  signature: string;
};

type PanelData = {
  incidents: IncidentRow[];
  movements: MovementRow[];
  torneados: MovementRow[];
};

type PanelLoadingState = {
  movements: boolean;
  torneados: boolean;
  incidents: boolean;
  tracks: boolean;
};

type PatioTrackCatalogItem = {
  id: string;
  label: string;
  number: number | null;
  sourceId: number | null;
};

type HeaderEventTone = "incident" | "movement" | "torno" | "lavado" | "state";

type HeaderEvent = {
  key: string;
  label: string;
  detail: string;
  subject: string;
  typeLabel: string;
  company: string;
  time: string;
  occurredAtMs: number;
  tone: HeaderEventTone;
  firstSeenAtMs?: number;
};

type ChangeKind = "updated" | "moved" | "removed";
type PanelRow = MovementRow | IncidentRow;

const EMPTY_DATA: PanelData = { incidents: [], movements: [], torneados: [] };

const statusTone = {
  DETENIDO: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/35 dark:text-rose-200",
  "EN PROCESO": "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/70 dark:bg-blue-950/35 dark:text-blue-200",
  SOLICITADO: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200",
  "EN COLA": "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
  "EN ESPERA": "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200",
} satisfies Record<MovementStatus, string>;

const movementTypeTone = {
  Torno: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/35 dark:text-rose-200",
  Lavado: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/35 dark:text-sky-200",
  Normal: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/35 dark:text-emerald-200",
} satisfies Record<MovementType, string>;

const rowTypeTone = {
  Normal: "border-emerald-200/90 bg-[linear-gradient(90deg,rgba(209,250,229,.92),rgba(236,253,245,.70))] dark:border-emerald-900/65 dark:bg-[linear-gradient(90deg,rgba(6,78,59,.46),rgba(6,95,70,.16))]",
  Torno: "border-rose-200/90 bg-[linear-gradient(90deg,rgba(254,226,226,.94),rgba(255,241,242,.72))] dark:border-rose-900/70 dark:bg-[linear-gradient(90deg,rgba(76,5,25,.55),rgba(127,29,29,.20))]",
  Lavado: "border-sky-200/90 bg-[linear-gradient(90deg,rgba(224,242,254,.94),rgba(240,249,255,.72))] dark:border-sky-900/70 dark:bg-[linear-gradient(90deg,rgba(8,47,73,.56),rgba(12,74,110,.18))]",
} satisfies Record<MovementType, string>;

const rowTypeAccentTone = {
  Normal: "before:bg-emerald-500",
  Torno: "before:bg-rose-500",
  Lavado: "before:bg-sky-500",
} satisfies Record<MovementType, string>;

function activeServiceTone(type: MovementType) {
  if (type === "Torno") {
    return {
      className: "border-rose-300/90 bg-[linear-gradient(90deg,rgba(255,228,230,.98),rgba(255,241,242,.80))] dark:border-rose-800/80 dark:bg-[linear-gradient(90deg,rgba(76,5,25,.74),rgba(127,29,29,.28))]",
      ring: "ring-2 ring-rose-300/80 dark:ring-rose-700/75",
      shadow: "0 12px 30px rgba(225,29,72,0.20)",
      bar: "bg-rose-500 shadow-[0_0_16px_rgba(225,29,72,.55)]",
      dot: "bg-rose-600 dark:bg-rose-300",
    };
  }

  if (type === "Lavado") {
    return {
      className: "border-sky-300/90 bg-[linear-gradient(90deg,rgba(224,242,254,.98),rgba(240,249,255,.80))] dark:border-sky-800/80 dark:bg-[linear-gradient(90deg,rgba(8,47,73,.74),rgba(12,74,110,.28))]",
      ring: "ring-2 ring-sky-300/80 dark:ring-sky-700/75",
      shadow: "0 12px 30px rgba(14,165,233,0.20)",
      bar: "bg-sky-500 shadow-[0_0_16px_rgba(14,165,233,.55)]",
      dot: "bg-sky-600 dark:bg-sky-300",
    };
  }

  return {
    className: "border-emerald-300/90 bg-[linear-gradient(90deg,rgba(209,250,229,.98),rgba(236,253,245,.80))] dark:border-emerald-800/80 dark:bg-[linear-gradient(90deg,rgba(6,78,59,.74),rgba(6,95,70,.28))]",
    ring: "ring-2 ring-emerald-300/80 dark:ring-emerald-700/75",
    shadow: "0 12px 30px rgba(16,185,129,0.20)",
    bar: "bg-emerald-500 shadow-[0_0_16px_rgba(16,185,129,.55)]",
    dot: "bg-emerald-600 dark:bg-emerald-300",
  };
}

const tickerTone = {
  incident: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-200",
  movement: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/35 dark:text-emerald-200",
  torno: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/35 dark:text-rose-200",
  lavado: "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/35 dark:text-sky-200",
  state: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/35 dark:text-blue-200",
} satisfies Record<HeaderEventTone, string>;

function panelClass(extra = "") {
  return `rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] shadow-[0_18px_50px_rgba(15,23,42,0.10)] dark:shadow-[0_18px_50px_rgba(0,0,0,0.35)] ${extra}`;
}

const RIGHT_PANEL_ROTATION_MS = 20_000;
const KPI_PANEL_ROTATION_MS = 20_000;
const panelEase = [0.22, 1, 0.36, 1] as const;
const panelEaseIn = [0.4, 0, 1, 1] as const;

const panelMotion = {
  header: {
    initial: { opacity: 0, y: -20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, ease: panelEase },
  },
  left: {
    initial: { opacity: 0, x: -30 },
    animate: { opacity: 1, x: 0 },
    transition: { duration: 0.5, delay: 0.1, ease: panelEase },
  },
  center: {
    initial: { opacity: 0, scale: 0.965 },
    animate: { opacity: 1, scale: 1 },
    transition: { duration: 0.42, delay: 0.16, ease: panelEase },
  },
  right: {
    initial: { opacity: 0, x: 30 },
    animate: { opacity: 1, x: 0 },
    transition: { duration: 0.5, delay: 0.18, ease: panelEase },
  },
};

const listContainerMotion = {
  hidden: { opacity: 1 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.055, delayChildren: 0.04 },
  },
};

const listItemMotion = {
  hidden: { opacity: 0, y: 10, scale: 0.985 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.26, ease: panelEase } },
  exit: { opacity: 0, x: 18, scale: 0.98, transition: { duration: 0.18, ease: panelEaseIn } },
};

export default function PanelGrafico({
  backHref = "/coordinador",
  backLabel = "Volver",
  localidadId = null,
  empresaId = null,
  autoMs = 120_000,
}: PanelGraficoProps) {
  const [data, setData] = useState<PanelData>(EMPTY_DATA);
  const [sectionLoading, setSectionLoading] = useState<PanelLoadingState>(() => ({
    movements: true,
    torneados: true,
    incidents: true,
    tracks: true,
  }));
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [rightPanelMode, setRightPanelMode] = useState<"movimientos" | "torneados">("movimientos");
  const [rightPanelTimerKey, setRightPanelTimerKey] = useState(0);
  const [showIncidentsPanel, setShowIncidentsPanel] = useState(true);
  const [showKpiPanel, setShowKpiPanel] = useState(true);
  const [rightPanelWidth, setRightPanelWidth] = useState(390);
  const [changedKeys, setChangedKeys] = useState<Map<string, ChangeKind>>(() => new Map());
  const [headerEvents, setHeaderEvents] = useState<HeaderEvent[]>([]);
  const [patioTrackCatalog, setPatioTrackCatalog] = useState<PatioTrackCatalogItem[]>([]);
  const previousSignaturesRef = useRef<Map<string, string>>(new Map());
  const previousPositionsRef = useRef<Map<string, number>>(new Map());
  const previousRowsRef = useRef<Map<string, PanelRow>>(new Map());
  const firstLoadRef = useRef(true);
  const changeTimerRef = useRef<number | null>(null);
  const loading = sectionLoading.movements || sectionLoading.torneados || sectionLoading.incidents || sectionLoading.tracks;

  const startRightPanelResize = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = rightPanelWidth;
    const handleMove = (moveEvent: PointerEvent) => {
      const nextWidth = clampNumber(startWidth - (moveEvent.clientX - startX), 300, Math.min(620, window.innerWidth * 0.48));
      setRightPanelWidth(nextWidth);
    };
    const handleUp = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  }, [rightPanelWidth]);

  const reconcilePanelData = useCallback((nextData: PanelData) => {
    const { signatures, positions, rows } = buildPanelSnapshots(nextData);
    if (!firstLoadRef.current) {
      const changed = new Map<string, ChangeKind>();
      signatures.forEach((signature, key) => {
        if (previousSignaturesRef.current.get(key) !== signature) changed.set(key, "updated");
      });
      positions.forEach((position, key) => {
        if (previousPositionsRef.current.get(key) !== position) changed.set(key, "moved");
      });
      previousSignaturesRef.current.forEach((_, key) => {
        if (!signatures.has(key)) changed.set(key, "removed");
      });
      if (changed.size) {
        setChangedKeys(changed);
        if (changeTimerRef.current) window.clearTimeout(changeTimerRef.current);
        changeTimerRef.current = window.setTimeout(() => setChangedKeys(new Map()), 2200);
      }

      const newEvents = buildRealtimeHeaderEvents({
        nextData,
        previousRows: previousRowsRef.current,
        previousSignatures: previousSignaturesRef.current,
        nextSignatures: signatures,
      });
      if (newEvents.length) {
        setHeaderEvents((current) => dedupeRowsByKey([...newEvents, ...current]).slice(0, 10));
      }
    } else {
      setHeaderEvents(buildHeaderEvents(nextData));
    }

    previousSignaturesRef.current = signatures;
    previousPositionsRef.current = positions;
    previousRowsRef.current = rows;
    firstLoadRef.current = false;
  }, []);

  const load = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    setSectionLoading({ movements: true, torneados: true, incidents: true, tracks: true });
    setError("");

    const query = new URLSearchParams();
    if (localidadId) query.set("localidadId", String(localidadId));
    if (empresaId) query.set("empresaId", String(empresaId));

    const movementQuery = new URLSearchParams(query);
    movementQuery.set("estado", "pendientes");
    movementQuery.set("entity", "movimientos");
    movementQuery.set("alcance", "localidad");

    const torneadoQuery = new URLSearchParams(query);
    torneadoQuery.set("estado", "pendientes");
    torneadoQuery.set("entity", "torneados");
    torneadoQuery.set("alcance", "localidad");

    const incidentQuery = new URLSearchParams(query);
    incidentQuery.set("estado", "ABIERTO");
    incidentQuery.set("page", "1");
    incidentQuery.set("pageSize", "35");

    const inactiveIncidentQuery = new URLSearchParams(query);
    inactiveIncidentQuery.set("estado", "PASADOS");
    inactiveIncidentQuery.set("page", "1");
    inactiveIncidentQuery.set("pageSize", "25");

    const tracksUrl = localidadId ? `/bff/vias/localidad/${encodeURIComponent(String(localidadId))}/lite` : "/bff/vias/lite";
    let nextMovementsRaw: MovementRow[] | null = null;
    let nextTorneadosRaw: MovementRow[] | null = null;
    let nextIncidents: IncidentRow[] | null = null;

    const commitRows = () => {
      setData((current) => {
        const incidents = nextIncidents ?? current.incidents;
        const nextData = {
          incidents,
          movements: nextMovementsRaw ? annotateRowsWithIncidents(nextMovementsRaw, incidents) : annotateRowsWithIncidents(current.movements, incidents),
          torneados: nextTorneadosRaw ? annotateRowsWithIncidents(nextTorneadosRaw, incidents) : annotateRowsWithIncidents(current.torneados, incidents),
        };
        reconcilePanelData(nextData);
        return nextData;
      });
    };

    const tasks = [
      fetch(`/api/cliente/rondas?${movementQuery.toString()}`, { cache: "no-store", credentials: "include" })
        .then(readJsonSafe)
        .then((result) => {
          nextMovementsRaw = (extractArray(result).map(mapMovement).filter(Boolean).slice(0, 30) as MovementRow[]);
          commitRows();
        })
        .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar movimientos."))
        .finally(() => setSectionLoading((current) => ({ ...current, movements: false }))),
      fetch(`/api/cliente/rondas?${torneadoQuery.toString()}`, { cache: "no-store", credentials: "include" })
        .then(readJsonSafe)
        .then((result) => {
          nextTorneadosRaw = (extractArray(result).map(mapMovement).filter(Boolean).slice(0, 30) as MovementRow[]);
          commitRows();
        })
        .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar torneados."))
        .finally(() => setSectionLoading((current) => ({ ...current, torneados: false }))),
      Promise.all([
        fetch(`/api/incidentes?${incidentQuery.toString()}`, { cache: "no-store", credentials: "include" }).then(readJsonSafe),
        fetch(`/api/incidentes?${inactiveIncidentQuery.toString()}`, { cache: "no-store", credentials: "include" }).then(readJsonSafe),
      ])
        .then(([activeResult, inactiveResult]) => {
          nextIncidents = filterRecentIncidents(
            sortIncidentsByState(dedupeRowsByKey([...extractArray(activeResult), ...extractArray(inactiveResult)].map(mapIncident).filter(Boolean) as IncidentRow[]))
          ).slice(0, 40);
          commitRows();
        })
        .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar incidentes."))
        .finally(() => setSectionLoading((current) => ({ ...current, incidents: false }))),
      fetch(tracksUrl, { cache: "no-store", credentials: "include" })
        .then(readJsonSafe)
        .then((result) => {
          setPatioTrackCatalog(dedupePatioTrackCatalog(extractArray(result).map(mapViaToPatioTrack).filter(Boolean) as PatioTrackCatalogItem[]));
        })
        .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar vias."))
        .finally(() => setSectionLoading((current) => ({ ...current, tracks: false }))),
    ];

    void Promise.allSettled(tasks).finally(() => setRefreshing(false));
  }, [empresaId, localidadId, reconcilePanelData]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return () => {
      if (changeTimerRef.current) window.clearTimeout(changeTimerRef.current);
    };
  }, []);

  const realtimeStatus = useRealtimeBoardRefresh({
    enabled: Boolean(localidadId),
    realtimeLocalidadId: localidadId,
    scopeLocalidadId: localidadId,
    minDelayMs: 180,
    maxDelayMs: 650,
    matchesEvent: (event) => {
      const type = String(event.type ?? "");
      return type === "ronda.reordenada" || type.startsWith("movimiento.") || type.startsWith("torno.") || type.includes("incidente") || type.startsWith("torreon.");
    },
    onRefresh: () => load(true),
  });

  useVisibleInterval(
    () => load(true),
    realtimeStatus !== "connected" ? Math.min(autoMs, 30_000) : null,
    [autoMs, localidadId, empresaId, realtimeStatus]
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  const changeRightPanelMode = useCallback((mode: "movimientos" | "torneados") => {
    setRightPanelMode(mode);
    setRightPanelTimerKey((key) => key + 1);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setRightPanelMode((mode) => (mode === "movimientos" ? "torneados" : "movimientos"));
      setRightPanelTimerKey((key) => key + 1);
    }, RIGHT_PANEL_ROTATION_MS);
    return () => window.clearInterval(timer);
  }, []);

  const metrics = useMemo(() => {
    const totalMovements = data.movements.length;
    const enProceso = data.movements.filter((row) => row.status === "EN PROCESO").length;
    const detenidos = data.movements.filter((row) => row.status === "DETENIDO").length;
    const enCola = data.movements.filter((row) => row.status === "EN COLA" || row.status === "SOLICITADO" || row.status === "EN ESPERA").length;
    const sla = totalMovements ? Math.max(0, Math.round(((totalMovements - detenidos) / totalMovements) * 100)) : 100;
    const activeIncidents = data.incidents.filter((row) => row.active);
    const criticos = activeIncidents.filter((row) => row.severity === "CRITICO").length;
    const altos = activeIncidents.filter((row) => row.severity === "ALTO").length;
    return { totalMovements, enProceso, detenidos, enCola, sla, criticos, altos };
  }, [data.incidents, data.movements]);

  const content = (
    <main className="fixed inset-0 z-[2147483647] isolate h-dvh w-screen overflow-hidden bg-[var(--app-bg)] text-[var(--app-text)]">
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,.16),transparent_34%),linear-gradient(135deg,var(--app-bg),var(--app-surface-subtle))]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,.12)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,.10)_1px,transparent_1px)] bg-[size:32px_32px] dark:opacity-20"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.4 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        className="relative flex h-full w-full flex-col gap-3 p-3"
      >
        <motion.header
          layout
          initial={panelMotion.header.initial}
          animate={panelMotion.header.animate}
          transition={panelMotion.header.transition}
          className="flex shrink-0 items-center justify-between gap-3 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)]/95 px-3 py-2.5 shadow-[0_14px_42px_rgba(15,23,42,.12)] backdrop-blur-xl dark:shadow-[0_14px_42px_rgba(0,0,0,.35)]"
        >
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href={backHref}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-3 text-xs font-black text-[var(--app-text)] transition hover:bg-[var(--app-surface-muted)]"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">{backLabel}</span>
            </Link>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[.18em] text-emerald-700 dark:text-emerald-300">
                Operacion en vivo
              </p>
              <h1 className="truncate text-base font-black text-slate-950 dark:text-white sm:text-xl">
                Panel Grafico
              </h1>
            </div>
          </div>
          <LiveEventTicker events={headerEvents} loading={loading} />
          <div className="flex items-center gap-2 text-xs font-black text-[var(--app-text-muted)]">
            <button
              type="button"
              onClick={() => setShowIncidentsPanel((value) => !value)}
              className={`hidden h-9 items-center rounded-xl border px-3 transition sm:inline-flex ${showIncidentsPanel ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/35 dark:text-amber-200" : "border-[var(--app-border)] bg-[var(--app-surface-subtle)] text-[var(--app-text-muted)]"}`}
              aria-pressed={showIncidentsPanel}
            >
              Incidentes
            </button>
            <button
              type="button"
              onClick={() => setShowKpiPanel((value) => !value)}
              className={`hidden h-9 items-center rounded-xl border px-3 transition sm:inline-flex ${showKpiPanel ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/35 dark:text-emerald-200" : "border-[var(--app-border)] bg-[var(--app-surface-subtle)] text-[var(--app-text-muted)]"}`}
              aria-pressed={showKpiPanel}
            >
              KPIs
            </button>
            {error ? (
              <span className="hidden rounded-full bg-rose-50 px-3 py-1 text-rose-700 dark:bg-rose-950/45 dark:text-rose-200 sm:inline-flex">
                {error}
              </span>
            ) : (
              <span className="hidden rounded-full bg-emerald-50 px-3 py-1 text-emerald-700 dark:bg-emerald-950/45 dark:text-emerald-200 sm:inline-flex">
                EN VIVO
              </span>
            )}
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading || refreshing}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] text-[var(--app-text-muted)] transition hover:bg-[var(--app-surface-muted)] disabled:cursor-wait disabled:opacity-60"
              aria-label="Actualizar panel"
            >
              <RefreshCw className={`h-4 w-4 ${loading || refreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
        </motion.header>

        <section
          className="grid min-h-0 flex-1 gap-2"
          style={{
            gridTemplateColumns: `${showIncidentsPanel ? "minmax(210px, min(16vw, 300px)) " : ""}minmax(0, 1fr) minmax(300px, ${rightPanelWidth}px)`,
          }}
        >
          <AnimatePresence initial={false}>
            {showIncidentsPanel ? (
              <motion.div
                key="incidents-panel"
                className="min-h-0"
                initial={{ ...panelMotion.left.initial, width: 0 }}
                animate={{ ...panelMotion.left.animate, width: "auto" }}
                exit={{ opacity: 0, x: -16, width: 0 }}
                transition={panelMotion.left.transition}
              >
                <IncidentColumn incidents={data.incidents} metrics={metrics} loading={sectionLoading.incidents} changedKeys={changedKeys} />
              </motion.div>
            ) : null}
          </AnimatePresence>
          <motion.div className="min-h-0 h-full" {...panelMotion.center}>
            <WorkArea
              metrics={metrics}
              movements={data.movements}
              torneados={data.torneados}
              trackCatalog={patioTrackCatalog}
              showKpis={showKpiPanel}
              loading={sectionLoading.movements || sectionLoading.torneados || sectionLoading.tracks}
              changedKeys={changedKeys}
            />
          </motion.div>
          <motion.div className="relative min-h-0 h-full" {...panelMotion.right}>
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Redimensionar panel derecho"
              onPointerDown={startRightPanelResize}
              className="absolute -left-1.5 top-0 z-20 hidden h-full w-3 cursor-col-resize items-center justify-center xl:flex"
            >
              <span className="h-20 w-1 rounded-full bg-[var(--app-border)] transition hover:bg-emerald-400" />
            </div>
            <RightOperationsPanel
              mode={rightPanelMode}
              movements={data.movements}
              torneados={data.torneados}
              metrics={metrics}
              loading={rightPanelMode === "movimientos" ? sectionLoading.movements : sectionLoading.torneados}
              changedKeys={changedKeys}
              timerKey={rightPanelTimerKey}
              rotationMs={RIGHT_PANEL_ROTATION_MS}
              onModeChange={changeRightPanelMode}
            />
          </motion.div>
        </section>
      </motion.div>
    </main>
  );

  return mounted ? createPortal(content, document.body) : null;
}

function LiveEventTicker({ events, loading }: { events: HeaderEvent[]; loading: boolean }) {
  const [cycleCount, setCycleCount] = useState(0);
  const items = events.length
    ? events
    : [{
        key: "empty",
        label: loading ? "Sincronizando" : "Operacion",
        detail: loading ? "Cargando ultimos eventos del tablero" : "Sin eventos recientes para mostrar",
        subject: loading ? "Panel" : "Sin actividad",
        typeLabel: "Sistema",
        company: "Cosaif",
        time: "ahora",
        occurredAtMs: Date.now(),
        tone: "state" as HeaderEventTone,
      }];
  const loopItems = [...items, ...items];
  const duration = Math.max(42, items.length * 8.5);
  const tickerKey = events.map((event) => event.key).join("|") || "empty";

  useEffect(() => {
    setCycleCount(0);
  }, [tickerKey]);

  useEffect(() => {
    const interval = window.setInterval(() => setCycleCount((current) => current + 1), duration * 1000);
    return () => window.clearInterval(interval);
  }, [duration, tickerKey]);

  return (
    <div className="relative hidden min-w-[220px] flex-1 overflow-hidden rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)]/85 px-2 py-1.5 shadow-inner md:block">
      <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-[var(--app-surface-subtle)] to-transparent" />
      <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-[var(--app-surface-subtle)] to-transparent" />
      <motion.div
        key={tickerKey}
        className="flex w-max items-center gap-2 whitespace-nowrap"
        initial={{ x: "0%" }}
        animate={{ x: "-50%" }}
        transition={{ duration, ease: "linear", repeat: Infinity }}
      >
        {loopItems.map((event, index) => {
          const highlighted = Date.now() - (event.firstSeenAtMs ?? event.occurredAtMs) < 2 * 60 * 60 * 1000 || cycleCount < 15;
          const relativeIndex = index % items.length;
          const ageClass = highlighted
            ? "bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,.16),0_0_16px_rgba(16,185,129,.45)] animate-pulse"
            : relativeIndex < 6
              ? "bg-blue-500/75 shadow-[0_0_0_3px_rgba(59,130,246,.10)]"
              : "bg-slate-400 opacity-55";
          return (
          <span
            key={`${event.key}-${index}`}
            className={`inline-flex max-w-[520px] items-center gap-2 rounded-full border px-2.5 py-1 text-[10px] font-black shadow-sm ${tickerTone[event.tone]}`}
          >
            <span className={`h-2 w-2 shrink-0 rounded-full ${ageClass}`} title={highlighted ? "Evento destacado" : "Evento anterior"} />
            <span className="uppercase tracking-[.12em] opacity-75">{event.label}</span>
            <span className="min-w-0 max-w-[92px] truncate text-[var(--app-text)] dark:text-white">{event.subject}</span>
            <span className="rounded-full bg-white/70 px-1.5 py-0.5 uppercase tracking-wide text-current ring-1 ring-current/10 dark:bg-black/20">{event.typeLabel}</span>
            <span className="min-w-0 max-w-[110px] truncate opacity-80">{event.company}</span>
            <span className="tabular-nums text-[9px] opacity-70">{event.time}</span>
            <span className="sr-only">{event.detail}</span>
          </span>
        );
        })}
      </motion.div>
    </div>
  );
}

function IncidentColumn({
  incidents,
  metrics,
  loading,
  changedKeys,
}: {
  incidents: IncidentRow[];
  metrics: { criticos: number; altos: number };
  loading: boolean;
  changedKeys: Map<string, ChangeKind>;
}) {
  const activeCount = incidents.filter((incident) => incident.active).length;
  return (
    <aside className={`${panelClass("bg-[linear-gradient(180deg,var(--app-surface),var(--app-surface-subtle))]")} flex min-h-0 min-w-0 flex-col overflow-hidden`}>
      <div className="shrink-0 border-b border-[var(--app-border)] px-2.5 py-1.5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="min-w-0 truncate text-xs font-black text-slate-950 dark:text-white 2xl:text-sm">Incidentes</h2>
          <span className="inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 px-1.5 text-sm font-black text-blue-700 ring-1 ring-blue-200 dark:bg-blue-950/60 dark:text-blue-200 dark:ring-blue-900">
            {activeCount}
          </span>
        </div>
        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1 text-[9px] font-black">
          <span title="Criticos" className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-1.5 py-0.5 text-rose-600 ring-1 ring-rose-100 dark:bg-rose-950/35 dark:text-rose-300 dark:ring-rose-900/60">
            <AlertTriangle className="h-3 w-3" />
            {metrics.criticos}
          </span>
          <span title="Altos" className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-amber-700 ring-1 ring-amber-100 dark:bg-amber-950/35 dark:text-amber-200 dark:ring-amber-900/60">
            <Activity className="h-3 w-3" />
            {metrics.altos}
          </span>
          <span title="Inactivos" className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-slate-600 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700">
            <PauseCircle className="h-3 w-3" />
            {incidents.length - activeCount}
          </span>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-1.5">
        {loading ? <LoadingRows /> : null}
        {!loading && incidents.length === 0 ? <EmptyRows text="No hay incidentes registrados." /> : null}
        <motion.div variants={listContainerMotion} initial="hidden" animate="show">
        <AnimatePresence initial={false}>
        {!loading && incidents.map((incident, index) => {
          const rowKey = incident.key;
          const changeKind = changedKeys.get(rowKey);
          const isInactive = !incident.active;
          return (
          <motion.article
            key={rowKey}
            layout
            initial={listItemMotion.hidden}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              backgroundColor: changeKind ? "rgba(245,158,11,0.14)" : "rgba(0,0,0,0)",
              boxShadow:
                changeKind === "moved"
                  ? "0 12px 30px rgba(245,158,11,0.18)"
                  : changeKind === "updated"
                    ? "0 0 0 1px rgba(245,158,11,0.36)"
                    : "0 0 0 0 rgba(0,0,0,0)",
            }}
            exit={listItemMotion.exit}
            transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.8, delay: Math.min(index * 0.035, 0.28) }}
            className={`relative grid min-w-0 grid-cols-[8px_minmax(0,1fr)_34px] items-center gap-1.5 rounded-lg border border-transparent px-1.5 py-1 transition hover:border-[var(--app-border)] hover:bg-[var(--app-surface-muted)] 2xl:grid-cols-[10px_minmax(0,1fr)_40px] 2xl:py-1.5 ${
              isInactive ? "opacity-55 grayscale-[.2]" : ""
            } ${
              incident.severity === "CRITICO" ? "border-rose-100 bg-rose-50/55 dark:border-rose-900/50 dark:bg-rose-950/20" : ""
            }`}
          >
            <span className={`h-8 w-1.5 rounded-full ${incidentSeverityRail(incident.severity)}`} title={incident.severity} />
            <span className="min-w-0 overflow-hidden">
              <span className="flex min-w-0 items-baseline gap-1.5 text-[10px] 2xl:text-[11px]">
                <span className="shrink-0 font-black text-slate-950 dark:text-white">{incident.id}</span>
                <span className="min-w-0 truncate font-bold text-[var(--app-text)]">{incident.title}</span>
              </span>
              <span className="mt-0.5 block truncate text-[10px] font-semibold text-[var(--app-text-muted)]">{incident.equipment}</span>
              {isInactive ? <span className="mt-0.5 inline-flex rounded-full bg-slate-100 px-1 py-px text-[7px] font-black text-slate-500 dark:bg-slate-800 dark:text-slate-300">INACTIVO</span> : null}
            </span>
            <span className="min-w-0 truncate text-right text-[10px] font-black text-orange-600 dark:text-orange-300">{incident.time}</span>
          </motion.article>
        );
        })}
        </AnimatePresence>
        </motion.div>
      </div>
      <div className="shrink-0 truncate border-t border-[var(--app-border)] px-2.5 py-1.5 text-[10px] font-semibold text-[var(--app-text-muted)]">
        Fuente <span className="font-black text-blue-700 dark:text-blue-300">real</span>
      </div>
    </aside>
  );
}

function WorkArea({
  metrics,
  movements,
  torneados,
  trackCatalog,
  showKpis,
  loading,
  changedKeys,
}: {
  metrics: { totalMovements: number; enProceso: number; detenidos: number; enCola: number; sla: number };
  movements: MovementRow[];
  torneados: MovementRow[];
  trackCatalog: PatioTrackCatalogItem[];
  showKpis: boolean;
  loading: boolean;
  changedKeys: Map<string, ChangeKind>;
}) {
  const hasChanges = changedKeys.size > 0;
  return (
    <section className="flex h-full min-h-0 flex-col gap-1">
      <AnimatePresence initial={false}>
        {showKpis ? (
          <motion.div
            key="kpi-carousel"
            initial={{ opacity: 0, y: -12, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -12, height: 0 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <KpiCarousel metrics={metrics} movements={movements} torneados={torneados} active={hasChanges} />
          </motion.div>
        ) : null}
      </AnimatePresence>
      <div className={`${panelClass("bg-[linear-gradient(180deg,var(--app-surface),var(--app-surface-subtle))]")} flex min-h-0 flex-1 flex-col overflow-hidden`}>
        <div className="shrink-0 px-2.5 py-1">
          <div className="flex flex-col gap-1.5 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="text-xs font-black text-slate-950 dark:text-white 2xl:text-sm">Area de trabajo</h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-black text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-950/35 dark:text-emerald-200 dark:ring-emerald-900/50">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit" }).format(new Date())}
              </span>
            </div>
            <div className="flex flex-wrap justify-end gap-x-2.5 gap-y-1 text-[9px] font-bold text-[var(--app-text-muted)]">
              <LegendDot color="bg-emerald-500" label="Operando" />
              <LegendDot color="bg-blue-600" label="En movimiento" />
              <LegendDot color="bg-rose-600" label="Detenido" />
              <LegendDot color="bg-slate-400" label="En espera" />
            </div>
          </div>
        </div>
        <div className="min-h-0 flex-1 px-2.5 pb-1">
          <motion.div
            className="relative h-full min-h-0 overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[radial-gradient(circle_at_center,rgba(16,185,129,.10),transparent_42%),linear-gradient(135deg,var(--app-surface),var(--app-surface-subtle))] shadow-inner"
            initial={{ opacity: 0, scale: 0.985 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.55, delay: 0.2, ease: panelEase }}
          >
            <AsyncPanelLoader visible={loading} label="Sincronizando area de trabajo" />
            <PatioFerroviarioCanvas movements={movements} torneados={torneados} trackCatalog={trackCatalog} changedKeys={changedKeys} />
          </motion.div>
        </div>
        <div className="grid shrink-0 gap-2 border-t border-[var(--app-border)] px-2.5 py-1 text-[10px] font-black text-[var(--app-text)] md:grid-cols-[1fr_1fr]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-blue-50 text-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
              <MapPinned className="h-3.5 w-3.5" />
            </span>
            <span>{metrics.enProceso + metrics.detenidos} vias ocupadas</span>
            <span className="text-emerald-600 dark:text-emerald-300">{metrics.enProceso} operando</span>
            <span className="text-rose-600 dark:text-rose-300">{metrics.detenidos} bloqueadas</span>
          </div>
          <div className="flex items-center gap-3">
            <span>Capacidad</span>
            <span>{Math.min(100, (metrics.enProceso + metrics.detenidos) * 10)}%</span>
            <div className="h-4 flex-1 overflow-hidden rounded-full border border-[var(--app-border)] bg-[var(--app-surface-muted)]">
              <motion.div
                className="h-full rounded-full bg-emerald-500"
                initial={{ width: "0%" }}
                animate={{ width: `${Math.min(100, (metrics.enProceso + metrics.detenidos) * 10)}%` }}
                transition={{ duration: 1, ease: "easeInOut" }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function KpiCarousel({
  metrics,
  movements,
  torneados,
  active,
}: {
  metrics: { totalMovements: number; enProceso: number; detenidos: number; enCola: number; sla: number };
  movements: MovementRow[];
  torneados: MovementRow[];
  active: boolean;
}) {
  const [viewIndex, setViewIndex] = useState(0);
  const [timerKey, setTimerKey] = useState(0);
  const views = useMemo(() => {
    const activeTorneados = torneados.filter((row) => row.status === "EN PROCESO").length;
    const activeLavados = movements.filter((row) => row.type === "Lavado" && row.status === "EN PROCESO").length;
    const normalMovements = movements.filter((row) => row.type === "Normal").length;
    const lavadoMovements = movements.filter((row) => row.type === "Lavado").length;
    const tornoMovements = movements.filter((row) => row.type === "Torno").length;
    const rondaCount = new Set(movements.map((row) => row.rondaNumero).filter(Boolean)).size;

    return [
      [
        { icon: Clock3, label: "En curso", value: String(metrics.enProceso), note: `${Math.max(0, metrics.enProceso - metrics.detenidos)} en tiempo`, noteTone: "text-emerald-600 dark:text-emerald-300" },
        { icon: PauseCircle, label: "Detenidos", value: String(metrics.detenidos), note: "requieren atencion", noteTone: "text-rose-600 dark:text-rose-300" },
        { icon: Gauge, label: "Cumplimiento SLA", value: `${metrics.sla}%`, note: "operacion estable", noteTone: "text-emerald-600 dark:text-emerald-300" },
      ],
      [
        { icon: Route, label: "En cola", value: String(metrics.enCola), note: "por asignar", noteTone: "text-slate-600 dark:text-slate-300" },
        { icon: Activity, label: "Rondas vivas", value: String(rondaCount), note: "con movimientos", noteTone: "text-blue-600 dark:text-blue-300" },
        { icon: TrainFront, label: "Equipos activos", value: String(metrics.totalMovements), note: "en tablero", noteTone: "text-emerald-600 dark:text-emerald-300" },
      ],
      [
        { icon: Wrench, label: "Torneados", value: String(torneados.length || tornoMovements), note: `${activeTorneados} en proceso`, noteTone: "text-rose-600 dark:text-rose-300" },
        { icon: Activity, label: "Lavados", value: String(lavadoMovements), note: `${activeLavados} en proceso`, noteTone: "text-sky-600 dark:text-sky-300" },
        { icon: TrainFront, label: "Normales", value: String(normalMovements), note: "movimientos base", noteTone: "text-emerald-600 dark:text-emerald-300" },
      ],
    ];
  }, [metrics.detenidos, metrics.enCola, metrics.enProceso, metrics.sla, metrics.totalMovements, movements, torneados]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setViewIndex((current) => (current + 1) % views.length);
      setTimerKey((current) => current + 1);
    }, KPI_PANEL_ROTATION_MS);
    return () => window.clearInterval(timer);
  }, [views.length]);

  const currentView = views[viewIndex] ?? views[0];

  return (
    <div className={`${panelClass("shrink-0 overflow-hidden bg-[linear-gradient(135deg,var(--app-surface),var(--app-surface-subtle))]")}`}>
      <div className="h-0.5 w-full overflow-hidden bg-[var(--app-surface-muted)]" aria-label="Rotacion automatica de KPIs">
        <motion.div
          key={`kpi-${viewIndex}-${timerKey}`}
          className="h-full bg-emerald-600"
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          transition={{ duration: KPI_PANEL_ROTATION_MS / 1000, ease: "linear" }}
        />
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={viewIndex}
          initial={{ opacity: 0, y: 8, filter: "blur(5px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -8, filter: "blur(5px)" }}
          transition={{ duration: 0.28, ease: panelEase }}
          className="grid gap-0 divide-y divide-[var(--app-border)] md:grid-cols-3 md:divide-x md:divide-y-0"
        >
          {currentView.map((item) => (
            <KpiBlock
              key={item.label}
              active={active}
              icon={item.icon}
              label={item.label}
              value={item.value}
              note={item.note}
              noteTone={item.noteTone}
            />
          ))}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function RightOperationsPanel({
  mode,
  movements,
  torneados,
  metrics,
  loading,
  changedKeys,
  timerKey,
  rotationMs,
  onModeChange,
}: {
  mode: "movimientos" | "torneados";
  movements: MovementRow[];
  torneados: MovementRow[];
  metrics: { totalMovements: number; enProceso: number; detenidos: number; enCola: number };
  loading: boolean;
  changedKeys: Map<string, ChangeKind>;
  timerKey: number;
  rotationMs: number;
  onModeChange: (mode: "movimientos" | "torneados") => void;
}) {
  const rows = mode === "movimientos" ? movements : torneados;
  const localMetrics = useMemo(() => {
    if (mode === "movimientos") return metrics;
    const totalMovements = torneados.length;
    const enProceso = torneados.filter((row) => row.status === "EN PROCESO").length;
    const detenidos = torneados.filter((row) => row.status === "DETENIDO").length;
    const enCola = torneados.filter((row) => row.status === "EN COLA" || row.status === "SOLICITADO" || row.status === "EN ESPERA").length;
    return { totalMovements, enProceso, detenidos, enCola };
  }, [metrics, mode, torneados]);
  const title = mode === "movimientos" ? "Movimientos activos" : "Torneados activos";
  const emptyText = mode === "movimientos" ? "No hay movimientos activos." : "No hay torneados activos.";
  const accent = mode === "movimientos" ? "emerald" : "rose";
  const panelBackground =
    mode === "movimientos"
      ? "bg-[linear-gradient(180deg,rgba(236,253,245,.96),rgba(255,255,255,.92)_34%,rgba(240,253,244,.82))] dark:bg-[linear-gradient(180deg,rgba(6,78,59,.34),rgba(9,9,11,.94)_34%,rgba(6,95,70,.18))]"
      : "bg-[linear-gradient(180deg,rgba(255,241,242,.96),rgba(255,255,255,.92)_34%,rgba(254,226,226,.78))] dark:bg-[linear-gradient(180deg,rgba(76,5,25,.40),rgba(9,9,11,.94)_34%,rgba(127,29,29,.20))]";

  return (
    <aside className={`${panelClass(panelBackground)} flex min-h-0 min-w-0 flex-col overflow-hidden`}>
      <div className="h-1 w-full overflow-hidden bg-[var(--app-surface-muted)]" aria-label={`Cambio automatico en ${Math.round(rotationMs / 1000)} segundos`}>
        <motion.div
          key={`${mode}-${timerKey}`}
          className={`h-full ${mode === "movimientos" ? "bg-emerald-600" : "bg-rose-600"}`}
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          transition={{ duration: rotationMs / 1000, ease: "linear" }}
        />
      </div>
      <div className="shrink-0 border-b border-[var(--app-border)] px-3 py-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <AnimatePresence mode="wait" initial={false}>
              <motion.h2
                key={title}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className="truncate text-sm font-black text-slate-950 dark:text-white"
              >
                {title}
              </motion.h2>
            </AnimatePresence>
          </div>
          <span className={`inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full px-2 text-sm font-black ring-1 ${
            accent === "emerald"
              ? "bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-200 dark:ring-emerald-900"
              : "bg-rose-100 text-rose-700 ring-rose-200 dark:bg-rose-950/60 dark:text-rose-200 dark:ring-rose-900"
          }`}>
            {localMetrics.totalMovements}
          </span>
        </div>
        <div className="mt-1.5 flex min-w-0 items-center justify-between gap-2">
          <p className="min-w-0 truncate text-[10px] font-black 2xl:text-[11px]">
            <span className="text-blue-700 dark:text-blue-300">{localMetrics.enProceso} en proceso</span>
            <span className="mx-2 text-[var(--app-text-muted)]">-</span>
            <span className="text-rose-600 dark:text-rose-300">{localMetrics.detenidos} detenidos</span>
            <span className="mx-2 text-[var(--app-text-muted)]">-</span>
            <span className="text-slate-700 dark:text-slate-200">{localMetrics.enCola} en cola</span>
          </p>
          <div className="hidden shrink-0 items-center gap-1.5 md:flex">
            <div className="rounded-full border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-0.5 text-[9px] font-black">
              <button
                type="button"
                onClick={() => onModeChange("movimientos")}
                className={`rounded-full px-2 py-1 transition ${mode === "movimientos" ? "bg-emerald-600 text-white shadow-sm" : "text-[var(--app-text-muted)] hover:text-[var(--app-text)]"}`}
              >
                Mov.
              </button>
              <button
                type="button"
                onClick={() => onModeChange("torneados")}
                className={`rounded-full px-2 py-1 transition ${mode === "torneados" ? "bg-rose-600 text-white shadow-sm" : "text-[var(--app-text-muted)] hover:text-[var(--app-text)]"}`}
              >
                Tor.
              </button>
            </div>
          </div>
        </div>
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={mode}
          initial={{ opacity: 0, x: mode === "movimientos" ? -18 : 18, filter: "blur(6px)" }}
          animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, x: mode === "movimientos" ? 18 : -18, filter: "blur(6px)" }}
          transition={{ duration: 0.34, ease: panelEase }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <OperationsTable rows={rows} loading={loading} emptyText={emptyText} changedKeys={changedKeys} showRoundDividers={mode === "movimientos"} />
        </motion.div>
      </AnimatePresence>
    </aside>
  );
}

function OperationsTable({
  rows,
  loading,
  emptyText,
  changedKeys,
  showRoundDividers,
}: {
  rows: MovementRow[];
  loading: boolean;
  emptyText: string;
  changedKeys: Map<string, ChangeKind>;
  showRoundDividers?: boolean;
}) {
  return (
    <>
      <div className="sticky top-0 z-10 grid shrink-0 grid-cols-[minmax(70px,1.05fr)_minmax(56px,.68fr)_minmax(46px,.5fr)_minmax(64px,.68fr)_minmax(42px,.42fr)] gap-1 border-b border-[var(--app-border)] bg-[var(--app-surface)]/95 px-1.5 py-1 text-center text-[8px] font-black text-blue-900 backdrop-blur dark:text-blue-200 2xl:grid-cols-[minmax(88px,1.12fr)_minmax(70px,.78fr)_minmax(56px,.58fr)_minmax(78px,.78fr)_minmax(52px,.48fr)] 2xl:px-2 2xl:text-[9px]">
        <span className="rounded-md bg-slate-100/80 px-1.5 py-0.5 dark:bg-slate-800/70">Equipo</span>
        <span className="rounded-md bg-blue-50 px-1.5 py-0.5 dark:bg-blue-950/35">Ruta</span>
        <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 dark:bg-emerald-950/35">Tipo</span>
        <span className="rounded-md bg-violet-50 px-1.5 py-0.5 dark:bg-violet-950/35">Estado</span>
        <span className="rounded-md bg-amber-50 px-1.5 py-0.5 dark:bg-amber-950/35">Tiempo</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? <LoadingRows /> : null}
        {!loading && rows.length === 0 ? <EmptyRows text={emptyText} /> : null}
        <motion.div variants={listContainerMotion} initial="hidden" animate="show">
        <AnimatePresence initial={false}>
        {!loading && rows.map((movement, index) => {
          const rowKey = movement.key;
          const changeKind = changedKeys.get(rowKey);
          const previous = rows[index - 1];
          const showDivider = showRoundDividers && (!previous || previous.rondaNumero !== movement.rondaNumero);
          const proximity = rows.length <= 1 ? 1 : 1 - index / Math.max(rows.length - 1, 1);
          const isActiveService = movement.status === "EN PROCESO";
          const hasIncident = movement.activeIncidentCount > 0;
          const activeTone = activeServiceTone(movement.type);
          const rowMinHeight = 36 + proximity * 10;
          const rowPaddingY = 2 + proximity * 2;
          const rowPriorityGlow =
            hasIncident
              ? "ring-2 ring-amber-300/90 dark:ring-amber-600/80"
              : isActiveService
                ? activeTone.ring
              : proximity > 0.72
              ? "ring-1 ring-emerald-200/80 dark:ring-emerald-800/55"
              : proximity > 0.38
                ? "ring-1 ring-slate-200/65 dark:ring-slate-800/55"
                : "ring-1 ring-slate-200/35 dark:ring-slate-800/35";
          return (
          <div key={rowKey} className="min-w-0 px-1.5">
            {showDivider ? (
              <motion.div
                layout
                initial={{ opacity: 0, scaleX: 0.9 }}
                animate={{ opacity: 1, scaleX: 1 }}
                className="flex items-center gap-1.5 px-2 py-0.5 text-[8px] font-black uppercase tracking-[.18em] text-[var(--app-text-muted)]"
              >
                <span className="h-px flex-1 bg-[linear-gradient(90deg,transparent,var(--app-border))]" />
                <span className="rounded-full border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-1.5 py-px">Ronda {movement.rondaNumero || 1}</span>
                <span className="h-px flex-1 bg-[linear-gradient(90deg,var(--app-border),transparent)]" />
              </motion.div>
            ) : null}
            <motion.article
              layout
              initial={listItemMotion.hidden}
              animate={{
                opacity: 1,
                y: 0,
                scale: 1,
                boxShadow:
                  hasIncident && changeKind
                    ? "0 14px 34px rgba(245,158,11,0.24)"
                    : hasIncident
                      ? "0 10px 28px rgba(245,158,11,0.18)"
                    : isActiveService
                      ? activeTone.shadow
                    : changeKind === "moved"
                    ? "0 14px 34px rgba(16,185,129,0.22)"
                    : changeKind === "updated"
                      ? "0 0 0 1px rgba(37,99,235,0.24)"
                      : proximity > 0.72
                        ? "0 8px 18px rgba(15,23,42,0.08)"
                        : "0 4px 10px rgba(15,23,42,0.04)",
              }}
              exit={listItemMotion.exit}
              transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.8, delay: Math.min(index * 0.035, 0.28) }}
              style={{ minHeight: rowMinHeight, paddingTop: rowPaddingY, paddingBottom: rowPaddingY }}
              className={`relative mb-1 grid grid-cols-[minmax(70px,1.05fr)_minmax(56px,.68fr)_minmax(46px,.5fr)_minmax(64px,.68fr)_minmax(42px,.42fr)] items-center gap-1 overflow-hidden rounded-lg border px-1.5 text-center text-[10px] transition hover:brightness-[.985] dark:hover:brightness-110 2xl:grid-cols-[minmax(88px,1.12fr)_minmax(70px,.78fr)_minmax(56px,.58fr)_minmax(78px,.78fr)_minmax(52px,.48fr)] 2xl:px-2 2xl:text-[11px] before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-r-full before:content-[''] ${rowTypeTone[movement.type]} ${rowTypeAccentTone[movement.type]} ${isActiveService ? activeTone.className : ""} ${hasIncident ? "after:pointer-events-none after:absolute after:inset-0 after:bg-[radial-gradient(circle_at_14%_50%,rgba(245,158,11,.18),transparent_38%)] after:content-['']" : ""} ${rowPriorityGlow}`}
            >
              {isActiveService ? (
                <span className={`pointer-events-none absolute inset-y-1 left-1 w-1 rounded-full ${activeTone.bar}`}>
                  <span className={`absolute inset-0 animate-pulse rounded-full ${activeTone.bar}`} />
                </span>
              ) : null}
              <span className="min-w-0 rounded-lg bg-slate-50/80 px-1 py-1 text-[12px] font-black leading-tight text-slate-950 ring-1 ring-slate-200/70 dark:bg-slate-900/60 dark:text-white dark:ring-slate-800 2xl:px-1.5 2xl:text-[13px]">
                <span className="flex min-w-0 items-center justify-center gap-1 truncate">
                  {hasIncident ? (
                    <span className="relative inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 ring-1 ring-amber-300 dark:bg-amber-950/70 dark:text-amber-200 dark:ring-amber-700">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-40" />
                      <AlertTriangle className="relative h-2.5 w-2.5" />
                    </span>
                  ) : null}
                  <span className="truncate">{movement.equipment}</span>
                </span>
                <span className="block truncate text-[9px] font-bold text-[var(--app-text-muted)] 2xl:text-[10px]">{movement.company}</span>
              </span>
              <span className="min-w-0 truncate rounded-lg bg-blue-50/85 px-1 py-1 text-[12px] font-black leading-tight text-blue-950 ring-1 ring-blue-100 dark:bg-blue-950/25 dark:text-blue-100 dark:ring-blue-900/50 2xl:px-1.5 2xl:text-[13px]">
                {movement.route}
              </span>
              <span className={`inline-flex min-h-6 min-w-0 items-center justify-center truncate rounded-md border px-1 text-[9px] font-black 2xl:px-1.5 2xl:text-[10px] ${movementTypeTone[movement.type]}`}>
                {movement.type}
              </span>
              <span className={`inline-flex min-h-6 min-w-0 items-center justify-center gap-1 truncate rounded-md border px-1 text-[8px] font-black 2xl:px-1.5 2xl:text-[9px] ${statusTone[movement.status]}`}>
                {isActiveService ? (
                  <span className="relative inline-flex h-2 w-2 shrink-0">
                    <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${activeTone.dot} opacity-70`} />
                    <span className={`relative inline-flex h-2 w-2 rounded-full ${activeTone.dot}`} />
                  </span>
                ) : null}
                <span className="truncate">{movement.status}</span>
              </span>
              <span className="truncate rounded-lg bg-amber-50/80 px-1 py-1 text-[10px] font-black text-amber-800 ring-1 ring-amber-100 dark:bg-amber-950/25 dark:text-amber-200 dark:ring-amber-900/50 2xl:px-1.5 2xl:text-[11px]">
                {hasIncident ? `${movement.activeIncidentCount} inc.` : movement.time}
              </span>
            </motion.article>
          </div>
        );
        })}
        </AnimatePresence>
        </motion.div>
      </div>
    </>
  );
}

function KpiBlock({
  active,
  icon: Icon,
  label,
  value,
  note,
  noteTone,
}: {
  active?: boolean;
  icon: LucideIcon;
  label: string;
  value: string;
  note: string;
  noteTone: string;
}) {
  return (
    <motion.div
      layout
      animate={{ boxShadow: active ? "inset 0 0 0 1px rgba(37,99,235,.25)" : "inset 0 0 0 1px rgba(0,0,0,0)" }}
      transition={{ duration: 0.5 }}
      className="flex items-center justify-between gap-2 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,.12),transparent_50%)] px-2.5 py-1.5"
    >
      <div className="min-w-0">
        <p className="truncate text-[8px] font-black uppercase tracking-wide text-slate-700 dark:text-slate-300 2xl:text-[9px]">{label}</p>
        <motion.p
          key={value}
          initial={{ opacity: 0, y: 8, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: [1, 1.08, 1] }}
          transition={{ duration: 0.42, ease: panelEase }}
          className="text-xl font-black leading-none text-slate-950 dark:text-white 2xl:text-2xl"
        >
          {value}
        </motion.p>
        <p className={`truncate text-[9px] font-black 2xl:text-[10px] ${noteTone}`}>{note}</p>
      </div>
      <motion.span
        initial={{ opacity: 0, rotate: -15, scale: 0.9 }}
        animate={{ opacity: 1, rotate: 0, scale: 1 }}
        transition={{ duration: 0.38, ease: panelEase }}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-blue-100 text-blue-700 ring-1 ring-blue-200 shadow-[0_6px_14px_rgba(37,99,235,.14)] dark:bg-blue-950/45 dark:text-blue-200 dark:ring-blue-900 2xl:h-9 2xl:w-9"
      >
        <Icon className="h-4 w-4 2xl:h-5 2xl:w-5" />
      </motion.span>
    </motion.div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}

type PatioTrackMode = "idle" | "entry" | "exit" | "blocked";
type PatioLocomotiveStatus = "operating" | "moving" | "stopped" | "waiting";
type PatioPlacement = "origin" | "destination" | "both";

type PatioTrack = {
  id: string;
  label: string;
  angle: number;
  mode: PatioTrackMode;
  locomotive: {
    key: string;
    number: string;
    status: PatioLocomotiveStatus;
    type: MovementType;
    activeIncidentCount: number;
    placement: PatioPlacement | null;
    originTrackId: string | null;
    destinationTrackId: string | null;
  } | null;
  locomotives: Array<NonNullable<PatioTrack["locomotive"]>>;
  originTrackId: string | null;
  destinationTrackId: string | null;
  placement: PatioPlacement | null;
};

type PatioRemovedGhost = PatioTrack & {
  removedAt: number;
  locomotive: NonNullable<PatioTrack["locomotive"]>;
};

type PatioServiceActivity = {
  number: string;
  status: PatioLocomotiveStatus;
  type: MovementType;
} | null;

type PatioTrackDefinition = {
  id: string;
  label: string;
  angle: number;
};

const PATIO_TRACK_START_ANGLE = 189;
const PATIO_TRACK_END_ANGLE = 348;

const PATIO_BASE_TRACKS: PatioTrackDefinition[] = [
  { id: "CIL", label: "CIL", angle: 189 },
  { id: "VIA-10", label: "10", angle: 207 },
  { id: "VIA-25", label: "25", angle: 225 },
  { id: "VIA-7", label: "7", angle: 243 },
  { id: "VIA-6", label: "6", angle: 261 },
  { id: "VIA-5", label: "5", angle: 279 },
  { id: "VIA-4", label: "4", angle: 297 },
  { id: "VIA-3", label: "3", angle: 315 },
  { id: "VIA-2", label: "2", angle: 333 },
  { id: "VIA-1", label: "1", angle: 348 },
];

const PATIO_BASE_LABELS = new Map(PATIO_BASE_TRACKS.map((track) => [track.id, track.label]));

const toRad = (degrees: number) => (degrees * Math.PI) / 180;
const clampNumber = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const polarPoint = (layout: ReturnType<typeof patioLayout>, radius: number, angle: number) => ({
  x: layout.center.x + Math.cos(angle) * radius,
  y: layout.center.y + Math.sin(angle) * radius,
});

function PatioFerroviarioCanvas({
  movements,
  torneados,
  trackCatalog,
  changedKeys,
}: {
  movements: MovementRow[];
  torneados: MovementRow[];
  trackCatalog: PatioTrackCatalogItem[];
  changedKeys: Map<string, ChangeKind>;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const previousTracksRef = useRef<PatioTrack[]>([]);
  const removedGhostsRef = useRef<PatioRemovedGhost[]>([]);
  const [selectedTrackId, setSelectedTrackId] = useState("VIA-4");

  const tracks = useMemo(() => buildPatioTracks(movements, trackCatalog), [movements, trackCatalog]);
  const serviceActivity = useMemo(
    () => ({
      torno: buildServiceActivity(torneados, "Torno"),
      lavado: null,
    }),
    [torneados]
  );

  useEffect(() => {
    if (!tracks.some((track) => track.id === selectedTrackId)) setSelectedTrackId(tracks[0]?.id ?? "VIA-4");
  }, [selectedTrackId, tracks]);

  useEffect(() => {
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    const currentKeys = new Set(tracks.map((track) => track.locomotive?.key).filter(Boolean) as string[]);
    const removed = previousTracksRef.current
      .filter((track): track is PatioTrack & { locomotive: NonNullable<PatioTrack["locomotive"]> } => Boolean(track.locomotive?.key))
      .filter((track) => !currentKeys.has(track.locomotive.key))
      .map((track) => ({ ...track, removedAt: now }));

    removedGhostsRef.current = [
      ...removedGhostsRef.current.filter((ghost) => now - ghost.removedAt < 1800),
      ...removed,
    ];
    previousTracksRef.current = tracks;
  }, [tracks]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    let frameId = 0;
    let disposed = false;
    let sizeVersion = 0;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            sizeVersion += 1;
            resizeCanvas(canvas, container);
          })
        : null;
    observer?.observe(container);

    const draw = (time: number) => {
      if (disposed) return;
      void sizeVersion;
      resizeCanvas(canvas, container);
      drawPatioCanvas(context, canvas, {
        tracks,
        serviceActivity,
        selectedTrackId,
        changedKeys,
        removedGhosts: removedGhostsRef.current,
        time,
        reducedMotion,
      });
      frameId = window.requestAnimationFrame(draw);
    };

    frameId = window.requestAnimationFrame(draw);
    return () => {
      disposed = true;
      observer?.disconnect();
      if (frameId) window.cancelAnimationFrame(frameId);
    };
  }, [changedKeys, selectedTrackId, serviceActivity, tracks]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handlePointer = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / Math.max(1, rect.width);
      const scaleY = canvas.height / Math.max(1, rect.height);
      const point = { x: (event.clientX - rect.left) * scaleX, y: (event.clientY - rect.top) * scaleY };
      const layout = patioLayout(canvas.width, canvas.height);
      let nearest = selectedTrackId;
      let nearestDistance = Number.POSITIVE_INFINITY;
      for (const track of tracks) {
        const angle = toRad(track.angle);
        const start = polarPoint(layout, layout.turntableRadius, angle);
        const end = trackEndPoint(layout, track.angle);
        const distance = distanceToSegment(point, start, end);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearest = track.id;
        }
      }
      if (nearestDistance < 44) setSelectedTrackId(nearest);
    };
    canvas.addEventListener("pointerdown", handlePointer);
    return () => canvas.removeEventListener("pointerdown", handlePointer);
  }, [selectedTrackId, tracks]);

  return (
    <div ref={containerRef} className="relative h-full min-h-0 w-full overflow-hidden">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Patio ferroviario interactivo con puente giratorio, vias y locomotoras activas"
        className="h-full w-full cursor-pointer"
      />
    </div>
  );
}

function buildPatioTracks(movements: MovementRow[], catalog: PatioTrackCatalogItem[]): PatioTrack[] {
  const trackDefinitions = buildPatioTrackDefinitions(movements, catalog);
  const assigned = new Map<string, Array<{ movement: MovementRow; placement: PatioPlacement; originTrackId: string | null; destinationTrackId: string | null }>>();
  movements.forEach((movement) => {
    const placement = movementPatioPlacement(movement);
    if (!placement.trackId) return;

    const current = assigned.get(placement.trackId) ?? [];
    if (current.length >= 3) return;
    current.push({ movement, ...placement });
    assigned.set(placement.trackId, current);
  });

  return trackDefinitions.map((track) => {
    const assignments = assigned.get(track.id) ?? [];
    const mainAssignment = assignments[0] ?? null;
    const movement = mainAssignment?.movement ?? null;
    const status = movement ? toPatioStatus(movement.status) : "waiting";
    const mode = assignments.some((item) => item.movement.status === "DETENIDO")
      ? "blocked"
      : assignments.some((item) => item.movement.status === "EN PROCESO")
        ? "entry"
        : "idle";
    const locomotives = assignments.map(({ movement: itemMovement, ...itemPlacement }) => ({
      key: itemMovement.key,
      number: itemMovement.equipment,
      status: toPatioStatus(itemMovement.status),
      type: itemMovement.type,
      activeIncidentCount: itemMovement.activeIncidentCount,
      placement: itemPlacement.placement,
      originTrackId: itemPlacement.originTrackId,
      destinationTrackId: itemPlacement.destinationTrackId,
    }));
    return {
      ...track,
      mode,
      originTrackId: mainAssignment?.originTrackId ?? null,
      destinationTrackId: mainAssignment?.destinationTrackId ?? null,
      placement: mainAssignment?.placement ?? null,
      locomotive: movement
        ? {
            key: movement.key,
            number: movement.equipment,
            status,
            type: movement.type,
            activeIncidentCount: movement.activeIncidentCount,
            placement: mainAssignment?.placement ?? null,
            originTrackId: mainAssignment?.originTrackId ?? null,
            destinationTrackId: mainAssignment?.destinationTrackId ?? null,
          }
        : null,
      locomotives,
    };
  });
}

function buildPatioTrackDefinitions(movements: MovementRow[], catalog: PatioTrackCatalogItem[]): PatioTrackDefinition[] {
  const tracks = new Map<string, PatioTrackDefinition>();
  const addTrack = (trackId: string | null) => {
    if (!trackId || tracks.has(trackId)) return;
    tracks.set(trackId, {
      id: trackId,
      label: trackLabelFromId(trackId),
      angle: 0,
    });
  };

  PATIO_BASE_TRACKS.forEach((track) => tracks.set(track.id, { ...track }));
  catalog.forEach((track) => {
    tracks.set(track.id, {
      id: track.id,
      label: track.label,
      angle: 0,
    });
  });
  movements.forEach((movement) => {
    addTrack(routeToTrackId(movement.origin));
    addTrack(routeToTrackId(movement.destination));
  });

  const ordered = Array.from(tracks.values()).sort(comparePatioTrackDefinitions);
  const angleStep =
    ordered.length > 1 ? (PATIO_TRACK_END_ANGLE - PATIO_TRACK_START_ANGLE) / (ordered.length - 1) : 0;

  return ordered.map((track, index) => ({
    ...track,
    angle: PATIO_TRACK_START_ANGLE + angleStep * index,
  }));
}

function comparePatioTrackDefinitions(left: PatioTrackDefinition, right: PatioTrackDefinition) {
  if (left.id === "CIL") return -1;
  if (right.id === "CIL") return 1;

  const leftNumber = patioTrackNumber(left.id);
  const rightNumber = patioTrackNumber(right.id);
  if (leftNumber !== null && rightNumber !== null) return rightNumber - leftNumber;
  if (leftNumber !== null) return -1;
  if (rightNumber !== null) return 1;
  return left.label.localeCompare(right.label);
}

function patioTrackNumber(trackId: string): number | null {
  const match = /^VIA-(\d+)$/.exec(trackId);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function trackLabelFromId(trackId: string) {
  const baseLabel = PATIO_BASE_LABELS.get(trackId);
  if (baseLabel) return baseLabel;
  const via = patioTrackNumber(trackId);
  if (via !== null) return String(via);
  return trackId.replace(/-/g, " ");
}

function movementPatioPlacement(movement: MovementRow): {
  trackId: string | null;
  placement: PatioPlacement;
  originTrackId: string | null;
  destinationTrackId: string | null;
} {
  const originTrackId = routeToTrackId(movement.origin);
  const destinationTrackId = routeToTrackId(movement.destination);

  if (originTrackId && destinationTrackId) {
    return {
      trackId: originTrackId,
      placement: originTrackId === destinationTrackId ? "origin" : "both",
      originTrackId,
      destinationTrackId,
    };
  }

  if (originTrackId) return { trackId: originTrackId, placement: "origin", originTrackId, destinationTrackId };
  return { trackId: destinationTrackId, placement: "destination", originTrackId, destinationTrackId };
}

function routeToTrackId(route: string): string | null {
  const rawOrigin = String(route ?? "").split("->")[0]?.trim() ?? "";
  const normalized = rawOrigin
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/VIA/g, "")
    .replace(/[^0-9A-Z]/g, "");
  if (!normalized) return null;
  if (normalized === "CIL") return "CIL";
  const via = Number(normalized);
  if (!Number.isFinite(via)) return null;
  return `VIA-${via}`;
}

function buildServiceActivity(rows: MovementRow[], type: MovementType): PatioServiceActivity {
  const active = rows.find((row) => row.type === type && row.status === "EN PROCESO") ?? rows.find((row) => row.type === type);
  return active
    ? {
        number: active.equipment,
        status: toPatioStatus(active.status),
        type: active.type,
      }
    : null;
}

function toPatioStatus(status: MovementStatus): PatioLocomotiveStatus {
  if (status === "DETENIDO") return "stopped";
  if (status === "EN PROCESO") return "moving";
  if (status === "EN ESPERA" || status === "EN COLA" || status === "SOLICITADO") return "waiting";
  return "operating";
}

function resizeCanvas(canvas: HTMLCanvasElement, container: HTMLDivElement) {
  const rect = container.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(600, Math.floor(rect.width * ratio));
  const height = Math.max(360, Math.floor(rect.height * ratio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

function patioLayout(width: number, height: number) {
  const mobile = width < 760;
  const wide = width / Math.max(1, height) > 1.55;
  const sideReserve = mobile ? 76 : clampNumber(width * 0.105, 96, 150);
  const topReserve = mobile ? 42 : clampNumber(height * 0.08, 34, 58);
  const bottomReserve = mobile ? 58 : clampNumber(height * 0.08, 42, 70);
  const availableWidth = Math.max(240, width - sideReserve * 2);
  const availableHeight = Math.max(180, height - topReserve - bottomReserve);
  const radiusByWidth = availableWidth / 2.08;
  const radiusByHeight = availableHeight / (wide ? 1.52 : 1.36);
  const outerRadius = clampNumber(Math.min(radiusByWidth, radiusByHeight), 120, Math.max(130, Math.min(width, height) * 0.82));
  const center = {
    x: mobile ? width * 0.50 : width * 0.49,
    y: clampNumber(topReserve + outerRadius, height * (mobile ? 0.55 : 0.60), height - bottomReserve - outerRadius * 0.24),
  };
  const innerRadius = outerRadius * 0.76;
  const turntableRadius = outerRadius * 0.27;
  return { center, outerRadius, innerRadius, turntableRadius, mobile, width, height };
}

function trackEndPoint(layout: ReturnType<typeof patioLayout>, angle: number) {
  return polarPoint(layout, layout.innerRadius + 12, toRad(angle));
}

function distanceToSegment(point: { x: number; y: number }, start: { x: number; y: number }, end: { x: number; y: number }) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = clampNumber(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared, 0, 1);
  return Math.hypot(point.x - (start.x + dx * t), point.y - (start.y + dy * t));
}

function cssColor(name: string, fallback: string) {
  if (typeof document === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, safeRadius);
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.lineTo(x + width - safeRadius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  ctx.lineTo(x + width, y + height - safeRadius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  ctx.lineTo(x + safeRadius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  ctx.lineTo(x, y + safeRadius);
  ctx.quadraticCurveTo(x, y, x + safeRadius, y);
  ctx.closePath();
}

function drawPatioCanvas(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  options: {
    tracks: PatioTrack[];
    serviceActivity: {
      torno: PatioServiceActivity;
      lavado: PatioServiceActivity;
    };
    selectedTrackId: string;
    changedKeys: Map<string, ChangeKind>;
    removedGhosts: PatioRemovedGhost[];
    time: number;
    reducedMotion: boolean;
  }
) {
  const { width, height } = canvas;
  const layout = patioLayout(width, height);
  const colors = {
    text: cssColor("--app-text", "#0f172a"),
    muted: cssColor("--app-text-muted", "#64748b"),
    border: cssColor("--app-border", "#cbd5e1"),
    surface: cssColor("--app-surface", "#ffffff"),
    surfaceMuted: cssColor("--app-surface-muted", "#f1f5f9"),
    surfaceSubtle: cssColor("--app-surface-subtle", "#f8fafc"),
    rail: "#193b78",
    railSoft: "#94a3b8",
    operating: "#10b981",
    moving: "#2563eb",
    stopped: "#e11d48",
    waiting: "#64748b",
    blocked: "#ef4444",
    bridge: "#4968b0",
    water: "rgba(37,99,235,.08)",
  };

  ctx.clearRect(0, 0, width, height);
  drawCanvasBackground(ctx, width, height);
  drawRoundhouse(ctx, layout, colors);
  drawTracks(ctx, layout, options.tracks, options.selectedTrackId, colors, options.time, options.reducedMotion);
  drawTurntable(ctx, layout, options.tracks, options.selectedTrackId, colors);
  drawMovingTrackArrows(ctx, layout, options.tracks, colors, options.time, options.reducedMotion);
  drawServices(ctx, layout, colors, options.serviceActivity, options.time, options.reducedMotion);
  drawLocomotives(ctx, layout, options.tracks, colors, options.time, options.changedKeys, options.reducedMotion, options.removedGhosts);
}

function drawCanvasBackground(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const gradient = ctx.createRadialGradient(width * 0.5, height * 0.5, 0, width * 0.5, height * 0.5, Math.max(width, height) * 0.65);
  gradient.addColorStop(0, "rgba(37,99,235,.08)");
  gradient.addColorStop(0.52, "rgba(16,185,129,.04)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.strokeStyle = "rgba(148,163,184,.10)";
  ctx.lineWidth = 1;
  for (let x = 0; x < width; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += 48) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawRoundhouse(ctx: CanvasRenderingContext2D, layout: ReturnType<typeof patioLayout>, colors: Record<string, string>) {
  const { center, outerRadius, innerRadius } = layout;
  ctx.save();
  const shellGradient = ctx.createRadialGradient(center.x, center.y, innerRadius, center.x, center.y, outerRadius);
  shellGradient.addColorStop(0, colors.surfaceSubtle);
  shellGradient.addColorStop(1, colors.surfaceMuted);

  ctx.beginPath();
  ctx.arc(center.x, center.y, outerRadius, Math.PI, Math.PI * 2);
  ctx.lineTo(center.x + innerRadius, center.y);
  ctx.arc(center.x, center.y, innerRadius, Math.PI * 2, Math.PI, true);
  ctx.closePath();
  ctx.fillStyle = shellGradient;
  ctx.shadowColor = "rgba(15,23,42,.16)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 8;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = colors.text;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.globalAlpha = 0.34;
  ctx.strokeStyle = colors.border;
  ctx.lineWidth = 1.4;
  for (let index = 0; index <= 10; index += 1) {
    const angle = Math.PI + (index * Math.PI) / 10;
    const inner = polarPoint(layout, innerRadius, angle);
    const outer = polarPoint(layout, outerRadius, angle);
    ctx.beginPath();
    ctx.moveTo(inner.x, inner.y);
    ctx.lineTo(outer.x, outer.y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = colors.text;
  ctx.font = "900 13px Inter, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("NAVE DE", center.x - outerRadius * 1.01, center.y - outerRadius * 0.91);
  ctx.fillText("MANTENIMIENTO", center.x - outerRadius * 1.01, center.y - outerRadius * 0.84);
  ctx.restore();
}

function drawRailSegment(
  ctx: CanvasRenderingContext2D,
  start: { x: number; y: number },
  end: { x: number; y: number },
  colors: Record<string, string>,
  options: { tieSpacing?: number; gap?: number; alpha?: number } = {}
) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  const ux = dx / length;
  const uy = dy / length;
  const px = -uy;
  const py = ux;
  const gap = options.gap ?? 5;

  ctx.save();
  ctx.globalAlpha = options.alpha ?? 0.72;
  ctx.strokeStyle = colors.railSoft;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(start.x + px * gap, start.y + py * gap);
  ctx.lineTo(end.x + px * gap, end.y + py * gap);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(start.x - px * gap, start.y - py * gap);
  ctx.lineTo(end.x - px * gap, end.y - py * gap);
  ctx.stroke();

  ctx.strokeStyle = colors.border;
  ctx.lineWidth = 3;
  for (let distance = 10; distance < length; distance += options.tieSpacing ?? 16) {
    const x = start.x + ux * distance;
    const y = start.y + uy * distance;
    ctx.beginPath();
    ctx.moveTo(x - px * 9, y - py * 9);
    ctx.lineTo(x + px * 9, y + py * 9);
    ctx.stroke();
  }
  ctx.restore();
}

function drawTracks(
  ctx: CanvasRenderingContext2D,
  layout: ReturnType<typeof patioLayout>,
  tracks: PatioTrack[],
  selectedTrackId: string,
  colors: Record<string, string>,
  time: number,
  reducedMotion: boolean
) {
  tracks.forEach((track) => {
    const angle = toRad(track.angle);
    const start = polarPoint(layout, layout.turntableRadius, angle);
    const end = trackEndPoint(layout, track.angle);
    const occupied = Boolean(track.locomotive);
    const selected = track.id === selectedTrackId && occupied;
    const pulse = reducedMotion ? 0 : (Math.sin(time / 420) + 1) / 2;
    const assignedColor = track.locomotive ? patioMovementColor(track.locomotive.type, colors) : colors.operating;
    const prominentAssignment = track.locomotive?.status === "moving" || track.locomotive?.status === "stopped";
    ctx.save();
    ctx.lineCap = "round";
    drawRailSegment(ctx, start, end, colors, { tieSpacing: 16, alpha: selected ? 0.82 : occupied ? 0.58 : 0.28 });

    if (prominentAssignment) {
      ctx.strokeStyle = assignedColor;
      ctx.lineWidth = selected ? 7 : 5.4;
      ctx.globalAlpha = selected ? 0.36 + pulse * 0.18 : 0.28 + pulse * 0.12;
      ctx.shadowColor = assignedColor;
      ctx.shadowBlur = selected ? 18 + pulse * 8 : 12 + pulse * 6;
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.globalAlpha = selected ? 0.95 : 0.82;
      ctx.lineWidth = selected ? 3.2 : 2.5;
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    } else if (occupied) {
      ctx.strokeStyle = assignedColor;
      ctx.lineWidth = selected ? 3.5 : 2.6;
      ctx.globalAlpha = selected ? 0.34 + pulse * 0.18 : 0.22;
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    }

    if (track.mode !== "idle" || selected) {
      ctx.strokeStyle = track.mode === "blocked" ? colors.stopped : selected ? colors.moving : assignedColor;
      ctx.lineWidth = selected ? 4.2 : 3;
      ctx.globalAlpha = selected ? 0.5 + pulse * 0.22 : 0.38;
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    }

    if (track.mode === "entry") {
      const travel = reducedMotion ? 0.62 : (time / 1400) % 1;
      const marker = {
        x: start.x + (end.x - start.x) * travel,
        y: start.y + (end.y - start.y) * travel,
      };
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = colors.operating;
      ctx.shadowColor = colors.operating;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(marker.x, marker.y, 5 + pulse * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    if (track.mode === "blocked") {
      ctx.strokeStyle = colors.stopped;
      ctx.lineWidth = 4;
      ctx.globalAlpha = 0.95;
      ctx.beginPath();
      ctx.moveTo(end.x - 13, end.y - 13);
      ctx.lineTo(end.x + 13, end.y + 13);
      ctx.moveTo(end.x + 13, end.y - 13);
      ctx.lineTo(end.x - 13, end.y + 13);
      ctx.stroke();
    }

    const labelDistance = layout.innerRadius + (layout.outerRadius - layout.innerRadius) * 0.58;
    const label = polarPoint(layout, labelDistance, angle);
    drawTrackLabel(ctx, track, label.x, label.y, colors, time, reducedMotion);
    ctx.restore();
  });
}

function drawTrackLabel(
  ctx: CanvasRenderingContext2D,
  track: PatioTrack,
  x: number,
  y: number,
  colors: Record<string, string>,
  time: number,
  reducedMotion: boolean
) {
  const occupied = Boolean(track.locomotive);
  const status = track.locomotive?.status ?? "waiting";
  const pulse = reducedMotion ? 0 : (Math.sin(time / 620) + 1) / 2;
  const statusColor =
    status === "moving" ? colors.moving : status === "stopped" ? colors.stopped : status === "operating" ? colors.operating : colors.waiting;
  const serviceColor = track.locomotive ? patioMovementColor(track.locomotive.type, colors) : statusColor;
  const badgeColor = status === "waiting" ? serviceColor : statusColor;

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  if (!occupied) {
    ctx.globalAlpha = 0.38;
    ctx.fillStyle = colors.muted;
    ctx.font = "800 10px Inter, Arial, sans-serif";
    ctx.fillText(track.label, x, y);
    ctx.restore();
    return;
  }

  const labelText = track.label;
  const prominentAssignment = status === "moving" || status === "stopped";
  ctx.font = prominentAssignment ? "950 18px Inter, Arial, sans-serif" : "950 14px Inter, Arial, sans-serif";
  const textWidth = Math.max(prominentAssignment ? 32 : 22, ctx.measureText(labelText).width + (prominentAssignment ? 20 : 14));
  const badgeHeight = prominentAssignment ? 30 : 22;
  const badgeRadius = prominentAssignment ? 11 : 8;

  ctx.shadowColor = badgeColor;
  ctx.shadowBlur = prominentAssignment ? 14 + pulse * 9 : 5;
  ctx.fillStyle =
    status === "moving"
      ? "rgba(37,99,235,.16)"
      : status === "stopped"
        ? "rgba(225,29,72,.16)"
        : status === "operating"
          ? "rgba(16,185,129,.14)"
          : track.locomotive?.type === "Torno"
            ? "rgba(225,29,72,.13)"
            : track.locomotive?.type === "Lavado"
              ? "rgba(14,165,233,.13)"
              : "rgba(16,185,129,.13)";
  roundRect(ctx, x - textWidth / 2, y - badgeHeight / 2, textWidth, badgeHeight, badgeRadius);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = badgeColor;
  ctx.globalAlpha = prominentAssignment ? 1 : 0.74;
  ctx.lineWidth = prominentAssignment ? 2.8 : 1.5;
  roundRect(ctx, x - textWidth / 2, y - badgeHeight / 2, textWidth, badgeHeight, badgeRadius);
  ctx.stroke();

  ctx.globalAlpha = 1;
  ctx.fillStyle = colors.text;
  ctx.fillText(labelText, x, y + 1);

  if (prominentAssignment) {
    ctx.fillStyle = badgeColor;
    ctx.beginPath();
    ctx.arc(x + textWidth / 2 - 5, y - badgeHeight / 2 + 5, 5 + pulse * 1.8, 0, Math.PI * 2);
    ctx.fill();
  } else if (track.locomotive?.activeIncidentCount) {
    ctx.fillStyle = "#f59e0b";
    ctx.beginPath();
    ctx.moveTo(x + textWidth / 2 - 8, y - badgeHeight / 2 + 3);
    ctx.lineTo(x + textWidth / 2 - 2, y - badgeHeight / 2 + 13);
    ctx.lineTo(x + textWidth / 2 - 14, y - badgeHeight / 2 + 13);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

function drawMovingTrackArrows(
  ctx: CanvasRenderingContext2D,
  layout: ReturnType<typeof patioLayout>,
  tracks: PatioTrack[],
  colors: Record<string, string>,
  time: number,
  reducedMotion: boolean
) {
  tracks.forEach((track) => {
    if (track.locomotive?.status !== "moving") return;

    const vector = movementArrowVector(layout, tracks, track);
    const { start, end, angle } = vector;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy);
    if (length < 40) return;

    const arrowColor = patioMovementColor(track.locomotive.type, colors);
    const arrowCount = layout.mobile ? 2 : 3;
    const motion = reducedMotion ? 0.25 : (time / 3400) % 1;
    const size = clampNumber(layout.outerRadius * 0.045, layout.mobile ? 11 : 13, layout.mobile ? 17 : 21);
    const gap = 0.16;
    const first = 0.24;
    const travelRange = 0.46;

    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    for (let index = 0; index < arrowCount; index += 1) {
      const raw = first + index * gap + motion * 0.18;
      const progress = first + ((raw - first) % travelRange);
      const x = start.x + dx * progress;
      const y = start.y + dy * progress;
      const wave = reducedMotion ? 0.55 : 0.42 + ((Math.sin(time / 900 + index * 0.85) + 1) / 2) * 0.2;

      drawPatioArrowHead(ctx, x, y, angle, size, arrowColor, wave);
    }

    ctx.restore();
  });
}

function movementArrowVector(layout: ReturnType<typeof patioLayout>, tracks: PatioTrack[], track: PatioTrack) {
  const originTrack = tracks.find((item) => item.id === track.originTrackId) ?? track;
  const destinationTrack = tracks.find((item) => item.id === track.destinationTrackId);
  const originAngle = toRad(originTrack.angle);
  const originPoint = polarPoint(layout, layout.turntableRadius + 26, originAngle);

  if (destinationTrack && destinationTrack.id !== originTrack.id) {
    const destinationPoint = polarPoint(layout, layout.turntableRadius + (layout.innerRadius - layout.turntableRadius) * 0.62, toRad(destinationTrack.angle));
    const angle = Math.atan2(destinationPoint.y - originPoint.y, destinationPoint.x - originPoint.x);
    return { start: originPoint, end: destinationPoint, angle };
  }

  return {
    start: originPoint,
    end: trackEndPoint(layout, originTrack.angle),
    angle: originAngle,
  };
}

function patioMovementColor(type: MovementType, colors: Record<string, string>) {
  if (type === "Torno") return colors.stopped;
  if (type === "Lavado") return "#0ea5e9";
  return colors.operating;
}

function drawPatioArrowHead(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  size: number,
  color: string,
  alpha: number
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.globalAlpha = alpha;
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;

  ctx.beginPath();
  ctx.moveTo(size * 1.08, 0);
  ctx.lineTo(-size * 0.72, -size * 0.78);
  ctx.lineTo(-size * 0.34, 0);
  ctx.lineTo(-size * 0.72, size * 0.78);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(15,23,42,.42)";
  ctx.lineWidth = 1.6;
  ctx.stroke();

  ctx.globalAlpha = Math.min(1, alpha + 0.08);
  ctx.beginPath();
  ctx.moveTo(size * 0.58, 0);
  ctx.lineTo(-size * 0.36, -size * 0.38);
  ctx.lineTo(-size * 0.16, 0);
  ctx.lineTo(-size * 0.36, size * 0.38);
  ctx.closePath();
  ctx.fillStyle = "rgba(255,255,255,.34)";
  ctx.fill();
  ctx.restore();
}

function drawTurntable(ctx: CanvasRenderingContext2D, layout: ReturnType<typeof patioLayout>, tracks: PatioTrack[], selectedTrackId: string, colors: Record<string, string>) {
  const selected =
    tracks.find((track) => track.id === selectedTrackId && track.locomotive) ??
    tracks.find((track) => track.mode === "entry") ??
    tracks.find((track) => track.locomotive) ??
    tracks.find((track) => track.id === selectedTrackId) ??
    tracks[0];
  const angle = toRad(selected.angle);
  const length = layout.turntableRadius * 1.85;
  const dx = Math.cos(angle) * length * 0.5;
  const dy = Math.sin(angle) * length * 0.5;

  ctx.save();
  const gradient = ctx.createRadialGradient(layout.center.x, layout.center.y - layout.turntableRadius * 0.4, 8, layout.center.x, layout.center.y, layout.turntableRadius);
  gradient.addColorStop(0, colors.surfaceSubtle);
  gradient.addColorStop(1, colors.surfaceMuted);
  ctx.fillStyle = gradient;
  ctx.strokeStyle = colors.text;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(layout.center.x, layout.center.y, layout.turntableRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.globalAlpha = 0.62;
  ctx.strokeStyle = colors.railSoft;
  ctx.beginPath();
  ctx.arc(layout.center.x, layout.center.y, layout.turntableRadius - 13, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.strokeStyle = colors.text;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(layout.center.x - dx, layout.center.y - dy);
  ctx.lineTo(layout.center.x + dx, layout.center.y + dy);
  ctx.stroke();

  ctx.fillStyle = colors.surface;
  ctx.strokeStyle = colors.text;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(layout.center.x, layout.center.y, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = colors.text;
  ctx.font = "900 14px Inter, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("PUENTE", layout.center.x, layout.center.y - 22);
  ctx.fillText("GIRATORIO", layout.center.x, layout.center.y + 1);
  ctx.restore();
}

function drawServices(
  ctx: CanvasRenderingContext2D,
  layout: ReturnType<typeof patioLayout>,
  colors: Record<string, string>,
  activity: { torno: PatioServiceActivity; lavado: PatioServiceActivity },
  time: number,
  reducedMotion: boolean
) {
  const lavado = {
    x: clampNumber(layout.center.x - layout.outerRadius - (layout.mobile ? 24 : 52), layout.mobile ? 62 : 76, layout.width - 58),
    y: layout.center.y - layout.outerRadius * (layout.mobile ? 0.26 : 0.34),
  };
  const torno = {
    x: clampNumber(layout.center.x + layout.outerRadius + (layout.mobile ? 36 : 64), 58, layout.width - 58),
    y: layout.center.y - layout.outerRadius * 0.35,
  };
  drawServiceBadge(ctx, lavado.x, lavado.y - 18, "drop", "LAVADO", colors, null, time, reducedMotion, {
    muted: true,
    caption: "MOV. EN VIA",
  });
  drawServiceBadge(ctx, torno.x, torno.y - 18, "gear", "TORNO", colors, activity.torno, time, reducedMotion);
}

function drawServiceBadge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  icon: "drop" | "gear",
  label: string,
  colors: Record<string, string>,
  activity: PatioServiceActivity,
  time: number,
  reducedMotion: boolean,
  options: { muted?: boolean; caption?: string } = {}
) {
  const active = activity?.status === "moving";
  const pulse = reducedMotion ? 0.35 : 0.25 + ((Math.sin(time / 360) + 1) / 2) * 0.35;
  const tone = icon === "gear" ? colors.stopped : "#0ea5e9";
  ctx.save();
  ctx.globalAlpha = options.muted ? 0.74 : 1;
  ctx.shadowColor = active && !options.muted ? tone : "rgba(0,0,0,0)";
  ctx.shadowBlur = active && !options.muted ? 12 + pulse * 16 : 0;
  ctx.fillStyle = icon === "gear" ? "rgba(225,29,72,.12)" : "rgba(59,130,246,.08)";
  ctx.strokeStyle = colors.border;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(x, y, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = active ? tone : colors.text;
  ctx.lineWidth = 2.2;
  if (icon === "drop") {
    ctx.beginPath();
    ctx.moveTo(x, y - 12);
    ctx.bezierCurveTo(x - 12, y + 2, x - 10, y + 13, x, y + 13);
    ctx.bezierCurveTo(x + 10, y + 13, x + 12, y + 2, x, y - 12);
    ctx.stroke();
  } else {
    ctx.beginPath();
    for (let index = 0; index < 12; index += 1) {
      const angle = (index * Math.PI) / 6;
      const radius = index % 2 === 0 ? 14 : 9;
      const px = x + Math.cos(angle) * radius;
      const py = y + Math.sin(angle) * radius;
      if (index === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = colors.text;
  ctx.font = "900 13px Inter, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(label, x, y + 48);
  if (!activity && options.caption) {
    ctx.fillStyle = colors.muted;
    ctx.font = "900 7px Inter, Arial, sans-serif";
    ctx.fillText(options.caption, x, y + 61);
  }
  if (activity) {
    const chipY = y + 66;
    ctx.fillStyle = active ? tone : colors.surface;
    ctx.strokeStyle = active ? tone : colors.border;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.roundRect(x - 34, chipY - 13, 68, 25, 7);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = active ? "#ffffff" : colors.text;
    ctx.font = "900 11px Inter, Arial, sans-serif";
    ctx.fillText(activity.number, x, chipY - 2);
    ctx.font = "800 7px Inter, Arial, sans-serif";
    ctx.fillText(active ? "EN PROCESO" : "EN COLA", x, chipY + 8);
  }
  ctx.restore();
}

function drawLocomotives(
  ctx: CanvasRenderingContext2D,
  layout: ReturnType<typeof patioLayout>,
  tracks: PatioTrack[],
  colors: Record<string, string>,
  time: number,
  changedKeys: Map<string, ChangeKind>,
  reducedMotion: boolean,
  removedGhosts: PatioRemovedGhost[]
) {
  removedGhosts.forEach((ghost) => {
    const age = Math.max(0, time - ghost.removedAt);
    if (age > 1800) return;
    const point = polarPoint(layout, layout.turntableRadius + (layout.innerRadius - layout.turntableRadius) * 0.72, toRad(ghost.angle));
    const progress = reducedMotion ? 1 : age / 1800;
    const alpha = (1 - progress) * 0.72;
    const scale = 1 - progress * 0.16;
    drawLocomotiveChip(ctx, point.x, point.y, ghost, colors, time, new Map(), reducedMotion, { alpha, scale });
  });

  tracks.forEach((track) => {
    const locomotives = track.locomotives?.length ? track.locomotives : track.locomotive ? [track.locomotive] : [];
    const visibleLocomotives = locomotives.slice(0, 3);
    [...visibleLocomotives]
      .sort((left, right) => {
        const priority = (locomotive: NonNullable<PatioTrack["locomotive"]>) =>
          locomotive.status === "moving" || locomotive.status === "stopped" ? 2 : locomotive.status === "operating" ? 1 : 0;
        const priorityDelta = priority(left) - priority(right);
        if (priorityDelta !== 0) return priorityDelta;
        return visibleLocomotives.findIndex((item) => item.key === right.key) - visibleLocomotives.findIndex((item) => item.key === left.key);
      })
      .forEach((locomotive) => {
      const index = visibleLocomotives.findIndex((item) => item.key === locomotive.key);
      const placement = locomotive.placement ?? track.placement;
      const baseRadiusFactor =
        placement === "destination"
          ? 0.86
          : placement === "origin"
            ? 0.58
            : 0.72;
      const radiusOffset = (index - (visibleLocomotives.length - 1) / 2) * 0.085;
      const radiusFactor = clampNumber(baseRadiusFactor + radiusOffset, 0.48, 0.92);
      const point = polarPoint(layout, layout.turntableRadius + (layout.innerRadius - layout.turntableRadius) * radiusFactor, toRad(track.angle));
      drawLocomotiveChip(ctx, point.x, point.y, { ...track, locomotive, placement }, colors, time, changedKeys, reducedMotion, {
        scale: index === 0 ? 1 : 0.92,
      });
      });
  });
}

function drawLocomotiveChip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  track: PatioTrack,
  colors: Record<string, string>,
  time: number,
  changedKeys: Map<string, ChangeKind>,
  reducedMotion: boolean,
  effect?: { alpha?: number; scale?: number }
) {
  const locomotive = track.locomotive;
  if (!locomotive) return;
  const statusColor =
    locomotive.status === "stopped"
      ? colors.stopped
      : locomotive.status === "moving"
        ? colors.moving
        : locomotive.status === "waiting"
          ? colors.waiting
          : colors.operating;
  const glow = reducedMotion ? 0.22 : 0.16 + ((Math.sin(time / 480) + 1) / 2) * 0.18;
  const radius = 28;
  const changeKind = changedKeys.get(locomotive.key);
  const changed = Boolean(changeKind);
  const zoomPulse = changed && !reducedMotion ? (Math.sin(time / 190) + 1) / 2 : 0;
  const statusScale =
    (locomotive.status === "moving" || locomotive.status === "stopped")
      ? 1.3 + (reducedMotion ? 0 : glow * 0.08)
      : locomotive.status === "waiting"
        ? 1
      : changeKind === "updated"
        ? 1.08 + zoomPulse * 0.06
        : changeKind === "moved"
        ? 1.04 + zoomPulse * 0.04
        : 1;
  const scale = effect?.alpha !== undefined ? effect.scale ?? statusScale : statusScale * (effect?.scale ?? 1);

  ctx.save();
  ctx.globalAlpha = effect?.alpha ?? 1;
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.translate(-x, -y);
  ctx.shadowColor = statusColor;
  ctx.shadowBlur = changed ? 22 + zoomPulse * 14 : glow * 32;
  ctx.fillStyle = "rgba(255,255,255,.92)";
  ctx.strokeStyle = statusColor;
  ctx.lineWidth = changed ? 4.5 : 3;
  ctx.beginPath();
  ctx.roundRect(x - 38, y - 18, 76, 36, 8);
  ctx.fill();
  ctx.stroke();

  const placementLabel = track.placement === "destination" ? "PARA" : track.placement === "both" ? "RUTA" : "DE";
  const placementIcon = track.placement === "destination" ? "→" : track.placement === "both" ? "↔" : "•";
  const placementColor =
    track.placement === "destination"
      ? colors.moving
      : track.placement === "both"
        ? "#7c3aed"
        : colors.operating;

  ctx.shadowBlur = 0;
  ctx.fillStyle = placementColor;
  ctx.beginPath();
  ctx.roundRect(x - 38, y - 31, 34, 14, 7);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 7px Inter, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(placementLabel, x - 21, y - 24);

  ctx.fillStyle = placementColor;
  ctx.font = "900 18px Inter, Arial, sans-serif";
  ctx.fillText(placementIcon, x + 34, y - 26);

  ctx.shadowBlur = 0;
  ctx.fillStyle = statusColor;
  ctx.beginPath();
  ctx.arc(x - 23, y, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#0f172a";
  ctx.font = "900 14px Inter, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(locomotive.number, x + 7, y - 2);

  ctx.fillStyle = colors.muted;
  ctx.font = "800 8px Inter, Arial, sans-serif";
  ctx.fillText(locomotive.type.toUpperCase(), x + 7, y + 11);

  ctx.fillStyle = statusColor;
  ctx.font = "900 9px Inter, Arial, sans-serif";
  ctx.fillText(track.label, x, y + radius + 21);

  if (locomotive.activeIncidentCount > 0) {
    const attentionPulse = reducedMotion ? 0.35 : 0.25 + ((Math.sin(time / 360) + 1) / 2) * 0.35;
    ctx.shadowColor = "#f59e0b";
    ctx.shadowBlur = 10 + attentionPulse * 10;
    ctx.fillStyle = "#f59e0b";
    ctx.strokeStyle = "#92400e";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + 31, y - 24);
    ctx.lineTo(x + 42, y - 5);
    ctx.lineTo(x + 20, y - 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#111827";
    ctx.font = "900 11px Inter, Arial, sans-serif";
    ctx.fillText("!", x + 31, y - 11);
  }
  ctx.restore();
}

function LoadingRows() {
  return (
    <motion.div
      className="space-y-2 p-2"
      variants={listContainerMotion}
      initial="hidden"
      animate="show"
    >
      {Array.from({ length: 6 }).map((_, index) => (
        <motion.div
          key={index}
          variants={listItemMotion}
          className="relative h-14 overflow-hidden rounded-md border border-[var(--app-border)] bg-[var(--app-surface-muted)]"
        >
          <span className="absolute inset-0 animate-pulse bg-[linear-gradient(90deg,transparent,rgba(148,163,184,.22),transparent)]" />
          <span className="absolute left-3 top-3 h-3 w-20 rounded-full bg-slate-300/45 dark:bg-slate-700/55" />
          <span className="absolute bottom-3 left-3 h-2 w-28 rounded-full bg-slate-300/35 dark:bg-slate-700/45" />
          <span className="absolute right-3 top-1/2 h-6 w-14 -translate-y-1/2 rounded-lg bg-slate-300/35 dark:bg-slate-700/45" />
        </motion.div>
      ))}
    </motion.div>
  );
}

function AsyncPanelLoader({ visible, label }: { visible: boolean; label: string }) {
  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          className="pointer-events-none absolute right-3 top-3 z-20 inline-flex items-center gap-2 rounded-full border border-[var(--app-border)] bg-[var(--app-surface)]/88 px-3 py-1 text-[10px] font-black text-[var(--app-text-muted)] shadow-lg backdrop-blur-md"
          initial={{ opacity: 0, y: -8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.96 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,.55)]" />
          {label}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function EmptyRows({ text }: { text: string }) {
  return (
    <div className="grid min-h-40 place-items-center p-6 text-center text-sm font-bold text-[var(--app-text-muted)]">
      {text}
    </div>
  );
}

async function readJsonSafe(response: Response) {
  const text = await response.text();
  if (!response.ok) throw new Error(text || `HTTP ${response.status}`);
  try {
    return JSON.parse(text);
  } catch {
    return [];
  }
}

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" ? (value as JsonRecord) : {};
}

function mapViaToPatioTrack(row: unknown): PatioTrackCatalogItem | null {
  const via = asRecord(row);
  const trackId = viaToTrackId(via);
  if (!trackId) return null;
  return {
    id: trackId,
    label: trackLabelFromVia(via, trackId),
    number: patioTrackNumber(trackId),
    sourceId: Number.isFinite(Number(via.id)) ? Number(via.id) : null,
  };
}

function viaToTrackId(via: JsonRecord): string | null {
  const numero = Number(via.numero);
  if (Number.isFinite(numero) && numero > 0) return `VIA-${numero}`;
  return routeToTrackId(text(via.nombre, ""));
}

function trackLabelFromVia(via: JsonRecord, trackId: string) {
  const name = text(via.nombre, "");
  if (name && name !== "-") {
    const normalized = name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/\s+/g, " ")
      .trim();
    if (normalized === "CIL") return "CIL";
    const viaNameMatch = /^VIA\s+(\d+)$/.exec(normalized);
    if (viaNameMatch) return viaNameMatch[1];
  }
  return trackLabelFromId(trackId);
}

function dedupePatioTrackCatalog(rows: PatioTrackCatalogItem[]) {
  const byId = new Map<string, PatioTrackCatalogItem>();
  rows.forEach((row) => {
    if (!byId.has(row.id)) byId.set(row.id, row);
  });
  return Array.from(byId.values());
}

function extractArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  const record = asRecord(value);
  if (Array.isArray(record.data)) return record.data;
  if (Array.isArray(record.items)) return record.items;
  if (Array.isArray(record.rows)) return record.rows;
  return [];
}

function text(value: unknown, fallback = "-") {
  const str = String(value ?? "").trim();
  return str || fallback;
}

function formatLoco(value: unknown) {
  const raw = text(value, "");
  return raw ? raw.padStart(raw.length < 4 ? 4 : raw.length, "0") : "-";
}

function equipmentLookupKey(value: unknown) {
  const raw = String(value ?? "").toUpperCase().replace(/^EQ\.?\s*/i, "").replace(/[^0-9A-Z]/g, "");
  return raw.replace(/^0+(?=\d)/, "") || raw;
}

function isIncidentActiveStatus(value: unknown) {
  const raw = String(value ?? "").toUpperCase();
  return raw.includes("ABIERTO") || raw.includes("ACTIVO") || raw.includes("PROCESO") || raw.includes("PENDIENTE");
}

function normalizeStatus(value: unknown): MovementStatus {
  const raw = String(value ?? "").toUpperCase().replace(/\s+/g, "_");
  if (raw.includes("DETEN") || raw.includes("CANCEL")) return "DETENIDO";
  if (raw.includes("PROCESO")) return "EN PROCESO";
  if (raw.includes("ESPERA")) return "EN ESPERA";
  if (raw.includes("SOLIC")) return "SOLICITADO";
  return "EN COLA";
}

function normalizeSeverity(value: unknown): IncidentSeverity {
  const raw = String(value ?? "").toUpperCase();
  if (raw.includes("CRIT")) return "CRITICO";
  if (raw.includes("ALTO") || raw.includes("ALTA") || raw.includes("URG")) return "ALTO";
  if (raw.includes("BAJO") || raw.includes("BAJA")) return "BAJO";
  return "MEDIO";
}

function incidentSeverityRail(severity: IncidentSeverity) {
  if (severity === "CRITICO") return "bg-rose-600 shadow-[0_0_14px_rgba(225,29,72,.45)]";
  if (severity === "ALTO") return "bg-orange-500 shadow-[0_0_12px_rgba(249,115,22,.36)]";
  if (severity === "BAJO") return "bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,.28)]";
  return "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,.32)]";
}

function filterRecentIncidents(rows: IncidentRow[]) {
  const cutoff = Date.now() - 10 * 24 * 60 * 60 * 1000;
  return rows.filter((row) => Number.isFinite(row.occurredAtMs) && row.occurredAtMs >= cutoff);
}

function elapsedFrom(value: unknown) {
  const date = value ? new Date(String(value)) : null;
  if (!date || Number.isNaN(date.getTime())) return "-";
  const mins = Math.max(0, Math.round((Date.now() - date.getTime()) / 60_000));
  if (mins < 1) return "ahora";
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  if (days < 3 && remainingHours > 0) return `${days} d ${remainingHours} h`;
  if (days < 30) return `${days} d`;
  const months = Math.floor(days / 30);
  const remainingDays = days % 30;
  if (months < 12) return remainingDays > 0 && months < 3 ? `${months} m ${remainingDays} d` : `${months} m`;
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  return remainingMonths > 0 && years < 3 ? `${years} a ${remainingMonths} m` : `${years} a`;
}

function timestampFrom(value: unknown) {
  const date = value ? new Date(String(value)) : null;
  return date && !Number.isNaN(date.getTime()) ? date.getTime() : 0;
}

function normalizeMovementType(movement: JsonRecord): MovementType {
  if (movement.torno === true) return "Torno";
  if (movement.lavado === true) return "Lavado";
  return "Normal";
}

function dedupeRowsByKey<T extends { key: string }>(rows: T[]) {
  return Array.from(new Map(rows.map((row) => [row.key, row])).values());
}

function sortIncidentsByState(rows: IncidentRow[]) {
  const severityRank: Record<IncidentSeverity, number> = { CRITICO: 0, ALTO: 1, MEDIO: 2, BAJO: 3 };
  return [...rows].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return severityRank[a.severity] - severityRank[b.severity];
  });
}

function annotateRowsWithIncidents(rows: MovementRow[], incidents: IncidentRow[]) {
  const activeByEquipment = new Map<string, number>();
  incidents.forEach((incident) => {
    if (!incident.active || !incident.equipmentKey) return;
    activeByEquipment.set(incident.equipmentKey, (activeByEquipment.get(incident.equipmentKey) ?? 0) + 1);
  });

  return rows.map((row) => {
    const activeIncidentCount = activeByEquipment.get(equipmentLookupKey(row.equipment)) ?? 0;
    return {
      ...row,
      activeIncidentCount,
      signature: `${row.signature}|inc:${activeIncidentCount}`,
    };
  });
}

function buildRowLookup(data: PanelData) {
  return new Map<string, PanelRow>([
    ...data.movements.map((row) => [row.key, row] as const),
    ...data.torneados.map((row) => [row.key, row] as const),
    ...data.incidents.map((row) => [row.key, row] as const),
  ]);
}

function buildPanelSnapshots(data: PanelData) {
  const entries = [
    ...data.movements.map((row) => [row.key, row.signature] as const),
    ...data.torneados.map((row) => [row.key, row.signature] as const),
    ...data.incidents.map((row) => [row.key, row.signature] as const),
  ];
  const positions = new Map<string, number>();
  data.movements.forEach((row, index) => positions.set(row.key, index));
  data.torneados.forEach((row, index) => positions.set(row.key, index + 1000));
  data.incidents.forEach((row, index) => positions.set(row.key, index + 2000));
  return {
    signatures: new Map<string, string>(entries),
    positions,
    rows: buildRowLookup(data),
  };
}

function isMovementRow(row: PanelRow | undefined): row is MovementRow {
  return Boolean(row && "equipment" in row && "route" in row && "type" in row && "status" in row);
}

function isIncidentRow(row: PanelRow | undefined): row is IncidentRow {
  return Boolean(row && "severity" in row && "title" in row && "active" in row);
}

function eventTimeLabel(value: number) {
  return new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function movementEventTone(row: MovementRow): HeaderEventTone {
  if (row.type === "Torno") return "torno";
  if (row.type === "Lavado") return "lavado";
  return row.status === "EN PROCESO" || row.status === "DETENIDO" ? "state" : "movement";
}

function movementEventBase(row: MovementRow) {
  return {
    detail: `${row.equipment} - ${row.type} - ${row.route} - ${row.company}`,
    subject: row.equipment,
    typeLabel: row.type,
    company: row.company,
  };
}

function incidentEventBase(row: IncidentRow) {
  return {
    detail: `${row.id} - ${row.equipment} - ${row.title}`,
    subject: row.id,
    typeLabel: row.severity,
    company: row.equipment,
  };
}

function buildRealtimeHeaderEvents({
  nextData,
  previousRows,
  previousSignatures,
  nextSignatures,
}: {
  nextData: PanelData;
  previousRows: Map<string, PanelRow>;
  previousSignatures: Map<string, string>;
  nextSignatures: Map<string, string>;
}) {
  const now = Date.now();
  const nextRows = buildRowLookup(nextData);
  const events: HeaderEvent[] = [];

  nextRows.forEach((row, key) => {
    const previousRow = previousRows.get(key);
    const previousSignature = previousSignatures.get(key);
    const nextSignature = nextSignatures.get(key);
    const wasCreated = !previousSignature;
    const wasUpdated = Boolean(previousSignature && previousSignature !== nextSignature);

    if (isIncidentRow(row) && (wasCreated || (wasUpdated && row.active))) {
      if (!row.active) return;
      events.push({
        key: `event:${now}:incident:${key}`,
        label: "Nuevo incidente",
        ...incidentEventBase(row),
        time: eventTimeLabel(now),
        occurredAtMs: now,
        firstSeenAtMs: now,
        tone: "incident",
      });
      return;
    }

    if (!isMovementRow(row)) return;
    const previousMovement = isMovementRow(previousRow) ? previousRow : null;
    const isTorneado = key.startsWith("torneado:");

    if (wasCreated) {
      events.push({
        key: `event:${now}:created:${key}`,
        label: isTorneado ? "Nuevo torneo" : "Nuevo movimiento",
        ...movementEventBase(row),
        time: eventTimeLabel(now),
        occurredAtMs: now,
        firstSeenAtMs: now,
        tone: movementEventTone(row),
      });
      return;
    }

    if (!isTorneado && row.status === "DETENIDO" && previousMovement?.status !== "DETENIDO") {
      events.push({
        key: `event:${now}:stopped:${key}`,
        label: "Nuevo detenido",
        ...movementEventBase(row),
        time: eventTimeLabel(now),
        occurredAtMs: now,
        firstSeenAtMs: now,
        tone: "state",
      });
      return;
    }

    if (!isTorneado && row.status === "EN PROCESO" && previousMovement?.status !== "EN PROCESO") {
      events.push({
        key: `event:${now}:started:${key}`,
        label: "Nuevo iniciado",
        ...movementEventBase(row),
        time: eventTimeLabel(now),
        occurredAtMs: now,
        firstSeenAtMs: now,
        tone: movementEventTone(row),
      });
      return;
    }

    if (isTorneado && row.status === "EN PROCESO" && previousMovement?.status !== "EN PROCESO") {
      events.push({
        key: `event:${now}:torno-start:${key}`,
        label: "Nuevo torneo",
        ...movementEventBase(row),
        time: eventTimeLabel(now),
        occurredAtMs: now,
        firstSeenAtMs: now,
        tone: "torno",
      });
      return;
    }
  });

  previousRows.forEach((row, key) => {
    if (nextRows.has(key)) return;
    if (isMovementRow(row)) {
      const isTorneado = key.startsWith("torneado:");
      if (!isTorneado || row.status !== "EN PROCESO") return;
      events.push({
        key: `event:${now}:removed:${key}`,
        label: "Torneo finalizado",
        ...movementEventBase(row),
        time: eventTimeLabel(now),
        occurredAtMs: now,
        firstSeenAtMs: now,
        tone: "torno",
      });
    }
  });

  return events
    .sort((a, b) => b.occurredAtMs - a.occurredAtMs)
    .slice(0, 10);
}

function buildHeaderEvents(data: PanelData): HeaderEvent[] {
  const now = Date.now();
  const incidentEvents = data.incidents.filter((incident) => incident.active).slice(0, 12).map((incident, index) => ({
    key: `ticker-${incident.key}`,
    label: "Nuevo incidente",
    ...incidentEventBase(incident),
    time: incident.time,
    occurredAtMs: incident.occurredAtMs || now - index * 60_000,
    tone: "incident" as HeaderEventTone,
  }));

  const movementEvents = data.movements.slice(0, 14).map((movement, index) => ({
    key: `ticker-${movement.key}`,
    label: movement.status === "DETENIDO" ? "Nuevo detenido" : movement.status === "EN PROCESO" ? "Nuevo iniciado" : "Nuevo movimiento",
    ...movementEventBase(movement),
    time: movement.time,
    occurredAtMs: movement.requestedAtMs || now - (index + 12) * 60_000,
    tone: movement.type === "Lavado" ? "lavado" as HeaderEventTone : movement.type === "Torno" ? "torno" as HeaderEventTone : "movement" as HeaderEventTone,
  }));

  const tornoEvents = data.torneados.slice(0, 12).map((torno, index) => ({
    key: `ticker-torno-${torno.key}`,
    label: torno.status === "EN PROCESO" ? "Nuevo torneo" : "Nuevo torneo",
    ...movementEventBase(torno),
    time: torno.time,
    occurredAtMs: torno.requestedAtMs || now - (index + 26) * 60_000,
    tone: "torno" as HeaderEventTone,
  }));

  return [...incidentEvents, ...movementEvents, ...tornoEvents]
    .sort((a, b) => b.occurredAtMs - a.occurredAtMs)
    .slice(0, 10);
}

function mapMovement(row: unknown): MovementRow | null {
  const source = asRecord(row);
  const movement = asRecord(source.movimiento ?? source);
  const empresa = asRecord(source.empresa ?? movement.empresa);
  const viaOrigen = asRecord(movement.viaOrigen);
  const viaDestino = asRecord(movement.viaDestino);
  const localidad = asRecord(source.localidad);
  const stableId = movement.id ?? source.movimientoId ?? movement.movimientoId ?? source.id ?? source.rondaId ?? movement.rondaId;
  const origin = text(viaOrigen.nombre ?? movement.viaOrigenNombre ?? movement.origen ?? movement.viaOrigenId, "-");
  const destination = text(viaDestino.nombre ?? movement.viaDestinoNombre ?? movement.destino ?? movement.viaDestinoId, "-");
  const sourceKind = String(source.source ?? "").toLowerCase().includes("torno") ? "torneado" : "movement";
  const rondaNumero = Number(source.rondaNumero ?? source.ronda ?? 1) || 1;
  const orden = Number(source.orden ?? source.order ?? 0) || 0;
  const requestedAt = movement.fechaSolicitud ?? movement.createdAt ?? source.createdAt;

  const output = {
    key: `${sourceKind}:${stableId ?? `${movement.locomotiveNumber ?? movement.locomotora ?? "unknown"}:${rondaNumero}:${orden}`}`,
    equipment: formatLoco(movement.locomotiveNumber ?? movement.locomotora ?? movement.locomotoraNumero),
    company: text(empresa.nombre ?? movement.empresaNombre ?? source.empresaNombre ?? localidad.nombre, "Default"),
    route: `${origin} -> ${destination}`,
    origin,
    destination,
    type: normalizeMovementType(movement),
    status: normalizeStatus(movement.estado ?? source.estado),
    time: elapsedFrom(movement.fechaInicio ?? movement.fechaSolicitud ?? source.createdAt),
    requestedAtMs: timestampFrom(requestedAt),
    rondaNumero,
    orden,
    activeIncidentCount: 0,
  };
  return {
    ...output,
    signature: [
      output.equipment,
      output.company,
      output.route,
      output.type,
      output.status,
      output.time,
      output.requestedAtMs,
      source.rondaNumero,
      source.orden,
      movement.prioridad,
      movement.torno,
      movement.lavado,
      movement.fechaSolicitud,
      movement.fechaInicio,
      movement.fechaFin,
    ].join("|"),
  };
}

function mapIncident(row: unknown): IncidentRow | null {
  const source = asRecord(row);
  const original = asRecord(source._original);
  const movement = asRecord(source.movimiento ?? original.movimiento);
  const id = source.incidenteId ?? source.id;
  const locomotive = source.locomotora ?? movement.locomotiveNumber ?? movement.locomotora ?? movement.locomotoraNumero;
  const rawStatus = text(source.estado ?? source.estatus, "ABIERTO");
  const occurredAt = source.fechaInicio ?? source.fechaISO ?? source.fecha ?? source.createdAt;
  const output = {
    key: `incident:${id ?? source.eventId ?? occurredAt ?? Math.random()}`,
    id: id ? `#${id}` : "#",
    severity: normalizeSeverity(source.prioridad ?? source.severidad ?? source.nivel ?? source.tipoIncidente),
    title: text(source.descripcion ?? source.motivo ?? source.tipoIncidente ?? source.titulo, "Incidente activo"),
    equipment: `Eq. ${formatLoco(locomotive)}`,
    equipmentKey: equipmentLookupKey(locomotive),
    time: elapsedFrom(occurredAt),
    occurredAtMs: timestampFrom(occurredAt),
    rawStatus,
    active: isIncidentActiveStatus(rawStatus),
  };
  return {
    ...output,
    signature: [
      output.id,
      output.severity,
      output.title,
      output.equipment,
      output.equipmentKey,
      output.time,
      output.occurredAtMs,
      output.rawStatus,
      output.active,
      source.fechaInicio,
      source.fechaResolucion,
      source.descripcion,
      source.motivo,
    ].join("|"),
  };
}

