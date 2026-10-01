"use client";
import { cachedFetchJson } from "@/lib/http/client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useRealtimeBoardRefresh } from "@/features/rail-queue/useRealtimeBoardRefresh";
import { useVisibleInterval } from "@/features/rail-queue/hooks";
import { ArrowLeft, Eye, EyeOff, RefreshCw } from "lucide-react";
import { type PanelGraficoProps, type PanelData, type PanelLoadingState, type ChangeKind, type HeaderEvent, type PatioTrackCatalogItem, type PanelRow, type MovementRow, type IncidentRow } from "./types";
import { EMPTY_DATA, RIGHT_PANEL_ROTATION_MS, panelMotion } from "./styles";
import { clampNumber } from "./patio/geometry";
import { buildPanelSnapshots, buildRealtimeHeaderEvents, dedupeRowsByKey, buildHeaderEvents, annotateRowsWithIncidents, extractArray, mapMovement, filterRecentIncidents, sortIncidentsByState, mapIncident, dedupePatioTrackCatalog, mapViaToPatioTrack } from "./data";
import { LiveEventTicker, IncidentColumn, WorkArea, RightOperationsPanel } from "./components/StatusPanels";
import { isTornoModuleEnabled } from "@/lib/tornoFeature";

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
  const [showWorkArea, setShowWorkArea] = useState(true);
  const [rightPanelWidth, setRightPanelWidth] = useState(390);
  const [changedKeys, setChangedKeys] = useState<Map<string, ChangeKind>>(() => new Map());
  const [headerEvents, setHeaderEvents] = useState<HeaderEvent[]>([]);
  const [patioTrackCatalog, setPatioTrackCatalog] = useState<PatioTrackCatalogItem[]>([]);
  const previousSignaturesRef = useRef<Map<string, string>>(new Map());
  const previousPositionsRef = useRef<Map<string, number>>(new Map());
  const previousRowsRef = useRef<Map<string, PanelRow>>(new Map());
  const firstLoadRef = useRef(true);
  const requestRef = useRef<AbortController | null>(null);
  const changeTimerRef = useRef<number | null>(null);
  const loading = sectionLoading.movements || (isTornoModuleEnabled && sectionLoading.torneados) || sectionLoading.incidents || sectionLoading.tracks;

  const startRightPanelResize = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = rightPanelWidth;
    const handleMove = (moveEvent: PointerEvent) => {
      const nextWidth = clampNumber(startWidth - (moveEvent.clientX - startX), 300, Math.max(300, window.innerWidth * 0.6));
      setRightPanelWidth(nextWidth);
    };
    const handleUp = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  }, [rightPanelWidth]);

  useEffect(() => {
    const handleResize = () => {
      setRightPanelWidth((width) => clampNumber(width, 300, Math.max(300, window.innerWidth * 0.6)));
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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
    requestRef.current?.abort();
    const controller = new AbortController(); requestRef.current = controller;
    const queryJson = (url: string, ttlMs = 1000) => cachedFetchJson<unknown>(url, { credentials: "include", signal: controller.signal }, { ttlMs, force: showRefreshing && ttlMs < 2000 });
    if (showRefreshing) setRefreshing(true);
    setSectionLoading({ movements: true, torneados: isTornoModuleEnabled, incidents: true, tracks: true });
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
      if (controller.signal.aborted) return;
      setData((current) => {
        const incidents = nextIncidents ?? current.incidents;
        const nextData = {
          incidents,
          movements: nextMovementsRaw ? annotateRowsWithIncidents(nextMovementsRaw, incidents) : annotateRowsWithIncidents(current.movements, incidents),
          torneados: isTornoModuleEnabled
            ? (nextTorneadosRaw ? annotateRowsWithIncidents(nextTorneadosRaw, incidents) : annotateRowsWithIncidents(current.torneados, incidents))
            : [],
        };
        reconcilePanelData(nextData);
        return nextData;
      });
    };

    const tasks = [
      queryJson(`/api/cliente/rondas?${movementQuery.toString()}`)
        .then((result) => {
          nextMovementsRaw = (extractArray(result).map(mapMovement).filter(Boolean).slice(0, 30) as MovementRow[]);
          commitRows();
        })
        .catch((loadError) => { if (!controller.signal.aborted) setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar movimientos."); })
        .finally(() => { if (!controller.signal.aborted) setSectionLoading((current) => ({ ...current, movements: false })); }),
      ...(isTornoModuleEnabled ? [queryJson(`/api/cliente/rondas?${torneadoQuery.toString()}`)
        .then((result) => {
          nextTorneadosRaw = (extractArray(result).map(mapMovement).filter(Boolean).slice(0, 30) as MovementRow[]);
          commitRows();
        })
        .catch((loadError) => { if (!controller.signal.aborted) setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar torneados."); })
        .finally(() => { if (!controller.signal.aborted) setSectionLoading((current) => ({ ...current, torneados: false })); })] : []),
      Promise.all([
        queryJson(`/api/incidentes?${incidentQuery.toString()}`),
        queryJson(`/api/incidentes?${inactiveIncidentQuery.toString()}`),
      ])
        .then(([activeResult, inactiveResult]) => {
          nextIncidents = filterRecentIncidents(
            sortIncidentsByState(dedupeRowsByKey([...extractArray(activeResult), ...extractArray(inactiveResult)].map(mapIncident).filter(Boolean) as IncidentRow[]))
          ).slice(0, 40);
          commitRows();
        })
        .catch((loadError) => { if (!controller.signal.aborted) setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar incidentes."); })
        .finally(() => { if (!controller.signal.aborted) setSectionLoading((current) => ({ ...current, incidents: false })); }),
      queryJson(tracksUrl, 60_000)
        .then((result) => {
          if (controller.signal.aborted) return;
          setPatioTrackCatalog(dedupePatioTrackCatalog(extractArray(result).map(mapViaToPatioTrack).filter(Boolean) as PatioTrackCatalogItem[]));
        })
        .catch((loadError) => { if (!controller.signal.aborted) setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar vias."); })
        .finally(() => { if (!controller.signal.aborted) setSectionLoading((current) => ({ ...current, tracks: false })); }),
    ];

    await Promise.allSettled(tasks);
    if (!controller.signal.aborted) setRefreshing(false);
  }, [empresaId, localidadId, reconcilePanelData]);

  useEffect(() => {
    void load();
    return () => requestRef.current?.abort();
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
      if (!isTornoModuleEnabled) return;
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
    const sinDetencionPct = totalMovements ? Math.max(0, Math.round(((totalMovements - detenidos) / totalMovements) * 100)) : null;
    const activeIncidents = data.incidents.filter((row) => row.active);
    const criticos = activeIncidents.filter((row) => row.severity === "CRITICO").length;
    const altos = activeIncidents.filter((row) => row.severity === "ALTO").length;
    return { totalMovements, enProceso, detenidos, enCola, sinDetencionPct, criticos, altos };
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
              onClick={() => setShowWorkArea((value) => !value)}
              className={`hidden h-9 items-center gap-1.5 rounded-xl border px-3 transition sm:inline-flex ${showWorkArea ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/70 dark:bg-blue-950/35 dark:text-blue-200" : "border-[var(--app-border)] bg-[var(--app-surface-subtle)] text-[var(--app-text-muted)]"}`}
              aria-pressed={showWorkArea}
              title={showWorkArea ? "Ocultar area de trabajo" : "Mostrar area de trabajo"}
            >
              {showWorkArea ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              Area
            </button>
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
            gridTemplateColumns: showWorkArea
              ? `${showIncidentsPanel ? "minmax(210px, min(16vw, 300px)) " : ""}minmax(0, 1fr) minmax(300px, ${rightPanelWidth}px)`
              : `${showIncidentsPanel ? "minmax(210px, min(16vw, 300px)) " : ""}minmax(320px, 1fr)`,
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
          <AnimatePresence initial={false}>
            {showWorkArea ? (
              <motion.div
                key="work-area"
                className="min-h-0 h-full"
                initial={{ opacity: 0, scale: 0.985 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.985 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                <WorkArea
                  metrics={metrics}
                  movements={data.movements}
                  torneados={isTornoModuleEnabled ? data.torneados : []}
                  trackCatalog={patioTrackCatalog}
                  showKpis={showKpiPanel}
                  loading={sectionLoading.movements || (isTornoModuleEnabled && sectionLoading.torneados) || sectionLoading.tracks}
                  changedKeys={changedKeys}
                  showTorneados={isTornoModuleEnabled}
                />
              </motion.div>
            ) : null}
          </AnimatePresence>
          <motion.div className="relative min-h-0 h-full" {...panelMotion.right}>
            {showWorkArea ? (
              <div
                role="separator"
                aria-orientation="vertical"
                aria-label="Redimensionar panel derecho"
                onPointerDown={startRightPanelResize}
                className="absolute -left-1.5 top-0 z-20 hidden h-full w-3 cursor-col-resize items-center justify-center xl:flex"
              >
                <span className="h-20 w-1 rounded-full bg-[var(--app-border)] transition hover:bg-emerald-400" />
              </div>
            ) : null}
            <RightOperationsPanel
              mode={rightPanelMode}
              movements={data.movements}
              torneados={isTornoModuleEnabled ? data.torneados : []}
              metrics={metrics}
              loading={rightPanelMode === "movimientos" ? sectionLoading.movements : sectionLoading.torneados}
              changedKeys={changedKeys}
              timerKey={rightPanelTimerKey}
              rotationMs={RIGHT_PANEL_ROTATION_MS}
              onModeChange={changeRightPanelMode}
              showTorneados={isTornoModuleEnabled}
            />
          </motion.div>
        </section>
      </motion.div>
    </main>
  );

  return mounted ? createPortal(content, document.body) : null;
}
