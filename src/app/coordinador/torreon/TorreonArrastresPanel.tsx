"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ClipboardList,
  Hash,
  RefreshCw,
  Search,
} from "lucide-react";
import {
  Button,
  FieldShell,
  FilterPanel,
  LoadingState,
  ModuleHeader,
  PaginationBar,
  SegmentedControl,
} from "@/app/Components/ui";
import {
  ArrastreOperationalTable,
  ArrastreStatusStrip,
  STATUS_OPTIONS,
  VAGON_STATUS_OPTIONS,
  arrastreMatches,
  buildArrastreFolio,
  buildDailyCounters,
  extractArray,
  fmtDateKey,
  getArrastreDateValue,
  isHistoryArrastre,
  isLiveArrastre,
  localDateKey,
  normalizeStatus,
  sortArrastres,
  sortByFolioOrder,
  toLocalDateTimeInput,
  type Arrastre,
  type ArrastreFechaCampo,
  type ArrastreStatus,
  type VagonStatusFilter,
} from "@/features/torreon/arrastres";
import TorreonIncidentDetailModal, { type TorreonIncidentDetail } from "./TorreonIncidentDetailModal";

type Props = {
  localidadId: number;
  variant?: "dashboard" | "movimientos";
};

export default function TorreonArrastresPanel({ localidadId, variant = "dashboard" }: Props) {
  const [arrastres, setArrastres] = useState<Arrastre[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [scope, setScope] = useState<"actuales" | "pasados">("actuales");
  const [status, setStatus] = useState<ArrastreStatus>("TODOS");
  const [vagonStatus, setVagonStatus] = useState<VagonStatusFilter>("TODOS");
  const [search, setSearch] = useState("");
  const [fechaCampo, setFechaCampo] = useState<ArrastreFechaCampo>("solicitud");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedIncident, setSelectedIncident] = useState<{
    incident: TorreonIncidentDetail;
    title: string;
    subtitle?: string;
  } | null>(null);

  const load = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const response = await fetch(`/api/cliente/torreon/arrastres?localidadId=${localidadId}`, {
        cache: "no-store",
        credentials: "include",
      });
      const data = await response.json().catch(() => []);
      setArrastres(sortArrastres(extractArray<Arrastre>(data)));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [localidadId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [scope, status, vagonStatus, search, fechaCampo, desde, hasta, pageSize, variant]);

  const todayKey = localDateKey(new Date());
  const dashboardArrastres = useMemo(() => arrastres.filter(isLiveArrastre), [arrastres]);
  const metricRows = variant === "dashboard" ? dashboardArrastres : arrastres;
  const dailyCounters = useMemo(() => buildDailyCounters(arrastres), [arrastres]);

  const stats = useMemo(() => {
    const vagonesActivos = metricRows.filter(isLiveArrastre).flatMap((arrastre) => arrastre.vagones || []);
    const incidentes = metricRows.flatMap((arrastre) => arrastre.incidentes || []);
    return {
      total: metricRows.length,
      solicitados: metricRows.filter((item) => normalizeStatus(item.estado) === "SOLICITADO").length,
      proceso: metricRows.filter((item) => normalizeStatus(item.estado) === "EN_PROCESO").length,
      detenidos: metricRows.filter((item) => normalizeStatus(item.estado) === "DETENIDO").length,
      concluidos: metricRows.filter((item) => normalizeStatus(item.estado) === "CONCLUIDO").length,
      cancelados: metricRows.filter((item) => normalizeStatus(item.estado) === "CANCELADO").length,
      vagonesPendientes: vagonesActivos.filter((item) => ["PENDIENTE", "EN_PROCESO", "BLOQUEADO"].includes(normalizeStatus(item.estado))).length,
      incidentesAbiertos: incidentes.filter((item) => normalizeStatus(item.estado) === "ABIERTO").length,
    };
  }, [metricRows]);

  const visible = useMemo(() => {
    const from = desde ? Date.parse(desde) : null;
    const to = hasta ? Date.parse(hasta) : null;
    return (variant === "dashboard" ? dashboardArrastres : arrastres)
      .filter((arrastre) => status === "TODOS" || normalizeStatus(arrastre.estado) === status)
      .filter((arrastre) => (
        vagonStatus === "TODOS" ||
        (arrastre.vagones || []).some((vagon) => normalizeStatus(vagon.estado) === vagonStatus)
      ))
      .filter((arrastre) => {
        if (!from && !to) return true;
        const value = getArrastreDateValue(arrastre, fechaCampo);
        if (!value) return false;
        const time = Date.parse(value);
        if (Number.isNaN(time)) return false;
        if (from && time < from) return false;
        if (to && time > to) return false;
        return true;
      })
      .filter((arrastre) => {
        const query = search.trim().toLowerCase();
        if (!query) return true;
        const folio = buildArrastreFolio(arrastre, dailyCounters.get(arrastre.id)).toLowerCase();
        return folio.includes(query) || arrastreMatches(arrastre, search);
      })
  }, [arrastres, dashboardArrastres, dailyCounters, desde, fechaCampo, hasta, search, status, vagonStatus, variant]);

  const activeRows = useMemo(() => (
    sortByFolioOrder(visible.filter(isLiveArrastre), dailyCounters)
  ), [dailyCounters, visible]);
  const historyRows = useMemo(() => (
    sortArrastres(visible.filter(isHistoryArrastre))
  ), [visible]);
  const dashboardRows = useMemo(() => activeRows.slice(0, 8), [activeRows]);

  const selectedRows = variant === "movimientos" && scope === "pasados" ? historyRows : activeRows;
  const rows = variant === "dashboard" ? dashboardRows : selectedRows;
  const selectedMode: "active" | "history" = variant === "movimientos" && scope === "pasados" ? "history" : "active";
  const scopeOptions = useMemo(() => [
    { value: "actuales" as const, label: "Actuales", count: activeRows.length },
    { value: "pasados" as const, label: "Pasados", count: historyRows.length },
  ], [activeRows.length, historyRows.length]);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedRows = useMemo(() => {
    if (variant === "dashboard") return rows;
    const start = (safePage - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [pageSize, rows, safePage, variant]);
  const headerCount = variant === "dashboard" ? rows.length : selectedRows.length;

  const applyToday = (field: ArrastreFechaCampo) => {
    const now = new Date();
    setFechaCampo(field);
    setDesde(toLocalDateTimeInput(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0)));
    setHasta(toLocalDateTimeInput(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59)));
  };

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white/95 shadow-sm dark:border-slate-800 dark:bg-slate-950/90">
      <div className="border-b border-slate-200 bg-white px-4 py-4 dark:border-slate-800 dark:bg-slate-950 sm:px-5">
        <ModuleHeader
          eyebrow="Torreon"
          title={variant === "dashboard" ? "Arrastres activos" : "Arrastres"}
          subtitle={variant === "dashboard" ? `Cola viva · ${fmtDateKey(todayKey)}` : "Consulta operativa e historial de arrastres"}
          icon={ClipboardList}
          actions={
            <>
              {variant === "dashboard" ? (
                <span className="inline-flex h-10 items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-black uppercase tracking-wide text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Live
                </span>
              ) : null}
              <span className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
                <Hash className="h-4 w-4 text-emerald-600" />
                {headerCount} movimiento{headerCount === 1 ? "" : "s"}
            </span>
            <Button
              onClick={() => load(true)}
              loading={refreshing}
              leftIcon={<RefreshCw className="h-4 w-4" aria-hidden />}
              >
                Actualizar
              </Button>
            </>
          }
        />
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        <ArrastreStatusStrip stats={stats} />

        {variant === "movimientos" && (
          <SegmentedControl
            ariaLabel="Ambito de arrastres"
            value={scope}
            options={scopeOptions}
            onChange={setScope}
          />
        )}

        <FilterPanel
          title="Filtros de arrastre"
          count={`${selectedRows.length} visibles`}
          footer={
            <div className="flex flex-wrap items-center gap-1.5">
              <Button size="sm" onClick={() => applyToday("solicitud")}>
                Solicitudes hoy
              </Button>
              <Button size="sm" onClick={() => applyToday("inicio")}>
                Inicios hoy
              </Button>
              <Button size="sm" onClick={() => applyToday("fin")}>
                Cierres hoy
              </Button>
              <Button size="sm" variant="danger" onClick={() => { setDesde(""); setHasta(""); }}>
                Limpiar fechas
              </Button>
              <span className="ml-auto inline-flex h-8 items-center rounded-lg bg-slate-50 px-3 text-xs font-black text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                Activos {activeRows.length} · Historial {historyRows.length}
              </span>
            </div>
          }
        >
          <div className="grid gap-2 xl:grid-cols-[minmax(240px,1fr)_145px_150px_130px_190px_190px_90px]">
            <FieldShell label="Buscar" icon={<Search className="h-4 w-4" aria-hidden />}>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
                placeholder="Folio, ID, vagon, estado..."
              />
            </FieldShell>
            <FieldShell label="Estado">
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as ArrastreStatus)}
                className="w-full bg-transparent font-black text-slate-700 outline-none dark:text-slate-100"
                aria-label="Estado de arrastre"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </FieldShell>
            <FieldShell label="Vagones">
              <select
                value={vagonStatus}
                onChange={(event) => setVagonStatus(event.target.value as VagonStatusFilter)}
                className="w-full bg-transparent font-black text-slate-700 outline-none dark:text-slate-100"
                aria-label="Estado de vagon"
              >
                {VAGON_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </FieldShell>
            <FieldShell label="Fecha base">
              <select
                value={fechaCampo}
                onChange={(event) => setFechaCampo(event.target.value as ArrastreFechaCampo)}
                className="w-full bg-transparent font-black text-slate-700 outline-none dark:text-slate-100"
                aria-label="Fecha base de arrastre"
              >
                <option value="solicitud">Solicitud</option>
                <option value="inicio">Inicio</option>
                <option value="fin">Fin</option>
              </select>
            </FieldShell>
            <FieldShell label="Desde" icon={<CalendarDays className="h-4 w-4" aria-hidden />}>
              <input
                type="datetime-local"
                value={desde}
                onChange={(event) => setDesde(event.target.value)}
                className="min-w-0 flex-1 bg-transparent font-semibold text-slate-700 outline-none dark:text-slate-100"
              />
            </FieldShell>
            <FieldShell label="Hasta" icon={<CalendarDays className="h-4 w-4" aria-hidden />}>
              <input
                type="datetime-local"
                value={hasta}
                onChange={(event) => setHasta(event.target.value)}
                className="min-w-0 flex-1 bg-transparent font-semibold text-slate-700 outline-none dark:text-slate-100"
              />
            </FieldShell>
            <FieldShell label="Por pagina">
              <select
                value={pageSize}
                onChange={(event) => setPageSize(Number(event.target.value))}
                className="w-full bg-transparent font-black text-slate-700 outline-none dark:text-slate-100"
                aria-label="Arrastres por página"
              >
                {[10, 25, 50, 100].map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </FieldShell>
          </div>
        </FilterPanel>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-black uppercase tracking-wide text-slate-700 dark:text-slate-200">
                {selectedMode === "history" ? "Historial de arrastres" : "Cola operativa"}
              </h3>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {selectedMode === "history"
                  ? "Arrastres detenidos, concluidos y cancelados."
                  : "Arrastres solicitados o en proceso."}
              </p>
            </div>
            <span className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              {rows.length} registro{rows.length === 1 ? "" : "s"}
            </span>
          </div>
          {loading ? (
            <LoadingState className="h-48" />
          ) : rows.length ? (
            <ArrastreOperationalTable
              rows={paginatedRows}
              dailyCounters={dailyCounters}
              compact={variant === "dashboard"}
              mode={selectedMode}
              onIncidentSelect={(incident, arrastre) => setSelectedIncident({
                incident,
                title: `Arrastre ${buildArrastreFolio(arrastre, dailyCounters.get(arrastre.id))}`,
                subtitle: `Movimiento de arrastre #${arrastre.id}`,
              })}
            />
          ) : (
            <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm font-semibold text-slate-500 dark:border-slate-700 dark:text-slate-400">
              {selectedMode === "history" ? "Sin arrastres pasados para mostrar." : "Sin arrastres vivos para mostrar."}
            </div>
          )}
        </div>

        {variant === "movimientos" && !loading && rows.length > 0 && (
          <PaginationBar
            page={safePage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={rows.length}
            onPageChange={setPage}
          />
        )}
      </div>
      {selectedIncident && (
        <TorreonIncidentDetailModal
          incident={selectedIncident.incident}
          title={selectedIncident.title}
          subtitle={selectedIncident.subtitle}
          onClose={() => setSelectedIncident(null)}
        />
      )}
    </section>
  );
}
