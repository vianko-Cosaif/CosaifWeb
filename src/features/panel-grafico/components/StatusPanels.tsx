"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Activity, AlertTriangle, Clock3, Gauge, MapPinned, PauseCircle, Route, TrainFront, Wrench, type LucideIcon } from "lucide-react";
import { type HeaderEvent, type HeaderEventTone, type IncidentRow, type ChangeKind, type MovementRow, type PatioTrackCatalogItem } from "../types";
import { tickerTone, panelClass, listContainerMotion, listItemMotion, panelEase, KPI_PANEL_ROTATION_MS, activeServiceTone, rowTypeTone, rowTypeAccentTone, movementTypeTone, statusTone } from "../styles";
import { incidentSeverityRail } from "../data";
import { PatioFerroviarioCanvas } from "../patio/PatioFerroviarioCanvas";

export function LiveEventTicker({ events, loading }: { events: HeaderEvent[]; loading: boolean }) {
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

export function IncidentColumn({
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

export function WorkArea({
  metrics,
  movements,
  torneados,
  trackCatalog,
  showKpis,
  loading,
  changedKeys,
}: {
  metrics: { totalMovements: number; enProceso: number; detenidos: number; enCola: number; sinDetencionPct: number | null };
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
            <span>{metrics.enProceso + metrics.detenidos} movimientos activos</span>
            <span className="text-emerald-600 dark:text-emerald-300">{metrics.enProceso} operando</span>
            <span className="text-rose-600 dark:text-rose-300">{metrics.detenidos} detenidos</span>
          </div>
          <p className="text-[var(--app-text-muted)]">{trackCatalog.length} vías en catálogo · ocupación física no informada</p>
        </div>
      </div>
    </section>
  );
}

export function KpiCarousel({
  metrics,
  movements,
  torneados,
  active,
}: {
  metrics: { totalMovements: number; enProceso: number; detenidos: number; enCola: number; sinDetencionPct: number | null };
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
        { icon: Clock3, label: "En curso", value: String(metrics.enProceso), note: "movimientos en proceso", noteTone: "text-emerald-600 dark:text-emerald-300" },
        { icon: PauseCircle, label: "Detenidos", value: String(metrics.detenidos), note: "requieren atencion", noteTone: "text-rose-600 dark:text-rose-300" },
        { icon: Gauge, label: "Sin detención", value: metrics.sinDetencionPct == null ? "—" : `${metrics.sinDetencionPct}%`, note: "proporción del tablero", noteTone: "text-emerald-600 dark:text-emerald-300" },
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
  }, [metrics.detenidos, metrics.enCola, metrics.enProceso, metrics.sinDetencionPct, metrics.totalMovements, movements, torneados]);

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

export function RightOperationsPanel({
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

export function OperationsTable({
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

export function KpiBlock({
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

export function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}

export function LoadingRows() {
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

export function AsyncPanelLoader({ visible, label }: { visible: boolean; label: string }) {
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

export function EmptyRows({ text }: { text: string }) {
  return (
    <div className="grid min-h-40 place-items-center p-6 text-center text-sm font-bold text-[var(--app-text-muted)]">
      {text}
    </div>
  );
}
