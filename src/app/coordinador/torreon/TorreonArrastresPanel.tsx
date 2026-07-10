"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ClipboardList,
  Hash,
  RefreshCw,
  Search,
} from "lucide-react";
import Button from "@/app/Components/ui/Button";
import FieldShell from "@/app/Components/ui/FieldShell";
import FilterPanel from "@/app/Components/ui/FilterPanel";
import LoadingState from "@/app/Components/ui/LoadingState";
import ModuleHeader from "@/app/Components/ui/ModuleHeader";
import PaginationBar from "@/app/Components/ui/PaginationBar";
import SearchInput from "@/app/Components/ui/SearchInput";
import SegmentedControl from "@/app/Components/ui/SegmentedControl";
import {
  ArrastreOperationalTable,
  ArrastreAirportBoard,
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
import { useRealtimeBoardRefresh } from "@/app/hooks/useRealtimeBoardRefresh";
import { TorreonRealtimeBadge } from "@/features/torreon/components/TorreonRealtimeBadge";
import { isTorreonArrastreEvent, realtimeArrastreSnapshot } from "@/features/torreon/realtime";
import TorreonIncidentDetailModal, { type TorreonIncidentDetail } from "./TorreonIncidentDetailModal";

type Props = {
  localidadId: number;
  variant?: "dashboard" | "movimientos";
  embedded?: boolean;
};

export default function TorreonArrastresPanel({ localidadId, variant = "dashboard", embedded = false }: Props) {
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
    arrastreId: number;
    incident: TorreonIncidentDetail;
    title: string;
    subtitle?: string;
  } | null>(null);
  const [resolvingIncident, setResolvingIncident] = useState(false);
  const [priorityBusyId, setPriorityBusyId] = useState<number | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const load = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const buildUrl = (vista: "activos" | "historial", pageSize: number) => {
        const params = new URLSearchParams({
          localidadId: String(localidadId),
          vista,
          page: "1",
          pageSize: String(pageSize),
          includeFotos: "0",
        });
        return `/api/cliente/torreon/arrastres?${params.toString()}`;
      };

      const [activeData, historyData] = await Promise.all([
        fetch(buildUrl("activos", variant === "dashboard" ? 80 : 160), {
          cache: "no-store",
          credentials: "include",
        }).then((response) => response.json()).catch(() => []),
        variant === "dashboard"
          ? Promise.resolve([])
          : fetch(buildUrl("historial", 160), {
              cache: "no-store",
              credentials: "include",
            }).then((response) => response.json()).catch(() => []),
      ]);

      setArrastres(sortArrastres([
        ...extractArray<Arrastre>(activeData),
        ...extractArray<Arrastre>(historyData),
      ]));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [localidadId, variant]);

  const refreshArrastreById = useCallback(async (arrastreId: number) => {
    if (!Number.isFinite(arrastreId) || arrastreId <= 0) {
      await load(true);
      return;
    }

    setRefreshing(true);
    try {
      const params = new URLSearchParams({
        localidadId: String(localidadId),
        id: String(arrastreId),
        includeFotos: "0",
      });
      const response = await fetch(`/api/cliente/torreon/arrastres?${params.toString()}`, {
        cache: "no-store",
        credentials: "include",
      });
      if (!response.ok) throw new Error("No se pudo refrescar arrastre");
      const data = await response.json();
      const next = (Array.isArray(data) ? data[0] : data) as Arrastre | null;
      if (!next?.id) {
        await load(true);
        return;
      }

      setArrastres((prev) => {
        const merged = new Map<number, Arrastre>();
        for (const item of prev) merged.set(item.id, item);
        merged.set(next.id, next);
        return sortArrastres(Array.from(merged.values()));
      });
    } catch {
      await load(true);
    } finally {
      setRefreshing(false);
    }
  }, [load, localidadId]);

  useEffect(() => {
    void load();
  }, [load]);

  const realtimeStatus = useRealtimeBoardRefresh({
    enabled: true,
    realtimeLocalidadId: localidadId,
    scopeLocalidadId: localidadId,
    matchesEvent: isTorreonArrastreEvent,
    onRefresh: ({ event }) => {
      const snapshot = realtimeArrastreSnapshot(event);
      if (snapshot) {
        setArrastres((current) => sortArrastres([snapshot, ...current.filter((item) => item.id !== snapshot.id)]));
        return;
      }
      const arrastreId = Number(event.arrastreId || 0);
      if (String(event.type || "").startsWith("torreon.arrastre") && arrastreId > 0) {
        return refreshArrastreById(arrastreId);
      }
      return load(true);
    },
  });

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

  const hasOpenIncidentInQueue = useMemo(
    () => arrastres.some((arrastre) => isLiveArrastre(arrastre) && (arrastre.incidentes || []).some((incident) => normalizeStatus(incident.estado) === "ABIERTO")),
    [arrastres]
  );

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

  const resolveSelectedIncident = useCallback(async (solucion: string) => {
    if (!selectedIncident?.arrastreId || !selectedIncident.incident.id) return;
    setResolvingIncident(true);
    try {
      const response = await fetch("/api/cliente/torreon/arrastres/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "RESOLVER_INCIDENTE",
          arrastreId: selectedIncident.arrastreId,
          incidenteId: selectedIncident.incident.id,
          solucion,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "No se pudo resolver el incidente");
      }

      setSelectedIncident(null);
      await load(true);
    } finally {
      setResolvingIncident(false);
    }
  }, [load, selectedIncident]);

  const prioritizeArrastre = useCallback(async (arrastre: Arrastre) => {
    setActionMessage(null);
    setPriorityBusyId(arrastre.id);
    try {
      const response = await fetch("/api/cliente/torreon/arrastres/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "PRIORIZAR_SOLICITUD",
          arrastreId: arrastre.id,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "No se pudo subir la solicitud al frente");
      }

      setActionMessage({ type: "ok", text: "Solicitud subida al frente de la cola operativa." });
      await load(true);
    } catch (error) {
      setActionMessage({ type: "error", text: error instanceof Error ? error.message : "No se pudo subir la solicitud al frente" });
    } finally {
      setPriorityBusyId(null);
    }
  }, [load]);

  return (
    <section className={embedded ? "min-w-0" : "overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"}>
      {!embedded ? <div className="border-b border-slate-200 bg-white px-4 py-4 dark:border-slate-800 dark:bg-slate-950 sm:px-5">
        <ModuleHeader
          eyebrow="Torreon"
          title={variant === "dashboard" ? "Arrastres activos" : "Arrastres"}
          subtitle={variant === "dashboard" ? `Cola viva · ${fmtDateKey(todayKey)}` : "Consulta operativa e historial de arrastres"}
          icon={ClipboardList}
          actions={
            <>
              {variant === "dashboard" ? <TorreonRealtimeBadge status={realtimeStatus} /> : null}
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
      </div> : null}

      <div className={embedded ? "space-y-3" : "space-y-4 p-4 sm:p-5"}>
        {embedded && variant === "movimientos" ? (
          <div className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <SegmentedControl
                ariaLabel="Ámbito de arrastres"
                value={scope}
                options={scopeOptions}
                onChange={setScope}
              />
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <TorreonRealtimeBadge status={realtimeStatus} />
                <span className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-100 px-3 text-xs font-black text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  <Hash className="h-3.5 w-3.5 text-emerald-600" />
                  {headerCount} registro{headerCount === 1 ? "" : "s"}
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => load(true)}
                  loading={refreshing}
                  leftIcon={<RefreshCw className="h-4 w-4" aria-hidden />}
                >
                  Actualizar
                </Button>
              </div>
            </div>
            <SearchInput
              value={search}
              onChange={setSearch}
              onClear={() => setSearch("")}
              placeholder="Buscar por folio, arrastre, vagón o estado"
              label="Buscar arrastres"
              inputClassName="min-h-[44px] rounded-xl border-slate-200 bg-white/90 text-[16px] focus:border-emerald-400 focus:ring-emerald-500/40 dark:border-slate-700 dark:bg-slate-900/90 sm:text-sm"
            />
          </div>
        ) : null}

        {!embedded ? <ArrastreStatusStrip stats={stats} operational={variant === "dashboard"} /> : null}

        {variant === "movimientos" && !embedded && (
          <SegmentedControl
            ariaLabel="Ambito de arrastres"
            value={scope}
            options={scopeOptions}
            onChange={setScope}
          />
        )}

        {actionMessage ? (
          <div className={`rounded-xl border px-3 py-2 text-sm font-bold ${
            actionMessage.type === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
              : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200"
          }`}>
            {actionMessage.text}
          </div>
        ) : null}

        {variant === "movimientos" ? <FilterPanel
          title="Filtros de arrastre"
          count={`${selectedRows.length} visibles`}
          collapsible
          defaultOpen={embedded}
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
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-12">
            {!embedded ? (
              <FieldShell className="md:col-span-2 xl:col-span-4" label="Buscar" icon={<Search className="h-4 w-4" aria-hidden />}>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
                  placeholder="Folio, ID, vagon, estado..."
                />
              </FieldShell>
            ) : null}
            <FieldShell className="xl:col-span-2" label="Estado">
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
            <FieldShell className="xl:col-span-2" label="Vagones">
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
            <FieldShell className="xl:col-span-2" label="Fecha base">
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
            <FieldShell className="xl:col-span-3" label="Desde" icon={<CalendarDays className="h-4 w-4" aria-hidden />}>
              <input
                type="datetime-local"
                value={desde}
                onChange={(event) => setDesde(event.target.value)}
                className="min-w-0 flex-1 bg-transparent font-semibold text-slate-700 outline-none dark:text-slate-100"
              />
            </FieldShell>
            <FieldShell className="xl:col-span-3" label="Hasta" icon={<CalendarDays className="h-4 w-4" aria-hidden />}>
              <input
                type="datetime-local"
                value={hasta}
                onChange={(event) => setHasta(event.target.value)}
                className="min-w-0 flex-1 bg-transparent font-semibold text-slate-700 outline-none dark:text-slate-100"
              />
            </FieldShell>
            <FieldShell className="xl:col-span-2" label="Por pagina">
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
        </FilterPanel> : null}

        {embedded ? <ArrastreStatusStrip stats={stats} operational={false} /> : null}

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-black uppercase tracking-wide text-slate-700 dark:text-slate-200">
                {selectedMode === "history" ? "Historial de arrastres" : "Cola operativa"}
              </h3>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {selectedMode === "history"
                  ? "Arrastres concluidos y cancelados."
                  : "Arrastres solicitados, en proceso o detenidos."}
              </p>
            </div>
            <span className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              {rows.length} registro{rows.length === 1 ? "" : "s"}
            </span>
          </div>
          {loading ? (
            <LoadingState className="h-48" />
          ) : variant === "dashboard" ? (
            <ArrastreAirportBoard
              rows={paginatedRows}
              dailyCounters={dailyCounters}
              onIncidentSelect={(incident, arrastre) => setSelectedIncident({
                arrastreId: arrastre.id,
                incident,
                title: `Arrastre ${buildArrastreFolio(arrastre, dailyCounters.get(arrastre.id))}`,
                subtitle: `Movimiento de arrastre #${arrastre.id}`,
              })}
            />
          ) : rows.length ? (
            <ArrastreOperationalTable
              rows={paginatedRows}
              dailyCounters={dailyCounters}
              mode={selectedMode}
              busyArrastreId={priorityBusyId}
              canPrioritizeByIncident={hasOpenIncidentInQueue}
              onPrioritizeArrastre={selectedMode === "active" ? prioritizeArrastre : undefined}
              onIncidentSelect={(incident, arrastre) => setSelectedIncident({
                arrastreId: arrastre.id,
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
          resolving={resolvingIncident}
          onResolve={resolveSelectedIncident}
          onClose={() => setSelectedIncident(null)}
        />
      )}
    </section>
  );
}
