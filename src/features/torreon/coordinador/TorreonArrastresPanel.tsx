"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { readTorreonJson, useTorreonCollection } from "../useTorreonCollection";
import { arrastreListUrl, parseArrastrePage, arrastreDateError } from "../arrastres/listQuery";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { movementDateBoundary } from "@/lib/dateBoundary";
import s from "../presentation/rail.module.scss";
import ArrastreFocus from "../arrastres/components/ArrastreFocus";
import { HISTORY_STATUSES, OPERATIONAL_STATUSES } from "../arrastres/constants";
import { CalendarDays, ClipboardList, ArrowRight, Hash, RefreshCw, Search } from "lucide-react";
import Button from "@/components/ui/Button";
import FieldShell from "@/components/ui/FieldShell";
import FilterPanel from "@/components/ui/FilterPanel";
import LoadingState from "@/components/ui/LoadingState";
import ModuleHeader from "@/components/ui/ModuleHeader";
import PaginationBar from "@/components/ui/PaginationBar";
import SearchInput from "@/components/ui/SearchInput";
import SegmentedControl from "@/components/ui/SegmentedControl";
import {
  ArrastreOperationalTable,
  ArrastreAuditModal,
  ArrastreAirportBoard,
  ArrastreStatusStrip,
  STATUS_OPTIONS,
  VAGON_STATUS_OPTIONS,
  buildArrastreFolio,
  buildDailyCounters,
  fmtDateKey,
  extractArray,
  isHistoryArrastre,
  isLiveArrastre,
  localDateKey,
  normalizeStatus,
  toLocalDateTimeInput,
  type Arrastre,
  type ArrastreEditAudit,
  type ArrastreFechaCampo,
  type ArrastreStatus,
  type VagonArrastre,
  type VagonStatusFilter,
} from "@/features/torreon/arrastres";
import { useRealtimeBoardRefresh } from "@/features/rail-queue/useRealtimeBoardRefresh";
import { TorreonRealtimeBadge } from "@/features/torreon/components/TorreonRealtimeBadge";
import { isTorreonArrastreEvent } from "@/features/torreon/realtime";
import { playOperationConfirmation } from "@/lib/notificationSound";
import TorreonIncidentDetailModal, {
  type TorreonIncidentDetail,
} from "./TorreonIncidentDetailModal";

type Props = {
  localidadId: number;
  variant?: "summary" | "dashboard" | "movimientos";
  embedded?: boolean;
  onOpen?: () => void;
  rol?: "ADMINISTRADOR" | "COORDINADOR";
};

export default function TorreonArrastresPanel({
  localidadId,
  variant = "dashboard",
  embedded = false,
  onOpen,
  rol = "COORDINADOR",
}: Props) {
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
  const [busyVagonKey, setBusyVagonKey] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: "ok" | "error"; text: string } | null>(
    null,
  );
  const [auditState, setAuditState] = useState<{
    arrastreId: number;
    entries: ArrastreEditAudit[];
    loading: boolean;
    error: string | null;
  } | null>(null);

  const deferredSearch = useDebouncedValue(search, 300);
  const filterKey = JSON.stringify([
    scope,
    status,
    vagonStatus,
    deferredSearch,
    fechaCampo,
    desde,
    hasta,
    pageSize,
    variant,
  ]);
  const [pageFilterKey, setPageFilterKey] = useState(filterKey);
  const requestedPage = pageFilterKey === filterKey ? page : 1;
  useEffect(() => {
    setPage(1);
    setPageFilterKey(filterKey);
  }, [filterKey]);
  const dateError = arrastreDateError(desde, hasta);
  const listUrl = arrastreListUrl({
    localidadId,
    page: requestedPage,
    pageSize: variant === "movimientos" ? pageSize : 8,
    history: variant === "movimientos" && scope === "pasados",
    q: deferredSearch,
    estado: status,
    vagonEstado: vagonStatus,
    fechaCampo,
    desde: desde ? (movementDateBoundary(desde) ?? undefined) : undefined,
    hasta: hasta ? (movementDateBoundary(hasta, true) ?? undefined) : undefined,
  });
  const fetchArrastres = useCallback(
    async (signal: AbortSignal, force: boolean) =>
      parseArrastrePage(await readTorreonJson<unknown>(listUrl, signal, force)),
    [listUrl],
  );
  const {
    rows: arrastres,
    meta,
    loading,
    refreshing,
    error: collectionError,
    load,
  } = useTorreonCollection<Arrastre>({
    queryKey: `${rol}:${listUrl}`,
    fetchRows: fetchArrastres,
    enabled: !dateError,
  });
  const loadError = dateError || collectionError;
  const realtimeStatus = useRealtimeBoardRefresh({
    enabled: true,
    realtimeLocalidadId: localidadId,
    scopeLocalidadId: localidadId,
    matchesEvent: isTorreonArrastreEvent,
    onRefresh: ({ event }) =>
      load(!["realtime.ready", "realtime.resume"].includes(String(event.type))),
  });
  useEffect(() => {
    if (meta && requestedPage > meta.totalPages) setPage(meta.totalPages);
  }, [meta, requestedPage]);

  const changeScope = useCallback((next: "actuales" | "pasados") => {
    setScope(next);
    setStatus("TODOS");
    setPage(1);
  }, []);
  const periodStatuses = scope === "actuales" ? OPERATIONAL_STATUSES : HISTORY_STATUSES;

  const todayKey = localDateKey(new Date());
  const dashboardArrastres = useMemo(() => arrastres.filter(isLiveArrastre), [arrastres]);
  const metricRows = variant === "movimientos" ? arrastres : dashboardArrastres;
  const dailyCounters = useMemo(() => buildDailyCounters(arrastres), [arrastres]);

  const stats = useMemo(() => {
    const vagonesActivos = metricRows
      .filter(isLiveArrastre)
      .flatMap((arrastre) => arrastre.vagones || []);
    const incidentes = metricRows.flatMap((arrastre) => arrastre.incidentes || []);
    return {
      total: meta?.total ?? metricRows.length,
      solicitados:
        meta?.statusCounts?.SOLICITADO ??
        metricRows.filter((item) => normalizeStatus(item.estado) === "SOLICITADO").length,
      proceso:
        meta?.statusCounts?.EN_PROCESO ??
        metricRows.filter((item) => normalizeStatus(item.estado) === "EN_PROCESO").length,
      detenidos:
        meta?.statusCounts?.DETENIDO ??
        metricRows.filter((item) => normalizeStatus(item.estado) === "DETENIDO").length,
      concluidos:
        meta?.statusCounts?.CONCLUIDO ??
        metricRows.filter((item) => normalizeStatus(item.estado) === "CONCLUIDO").length,
      cancelados:
        meta?.statusCounts?.CANCELADO ??
        metricRows.filter((item) => normalizeStatus(item.estado) === "CANCELADO").length,
      vagonesPendientes:
        meta?.pendingWagons ??
        vagonesActivos.filter((item) =>
          ["PENDIENTE", "EN_PROCESO", "BLOQUEADO"].includes(normalizeStatus(item.estado)),
        ).length,
      incidentesAbiertos:
        meta?.openIncidents ??
        incidentes.filter((item) => normalizeStatus(item.estado) === "ABIERTO").length,
    };
  }, [meta, metricRows]);

  const hasOpenIncidentInQueue = useMemo(
    () =>
      meta?.canPrioritize ??
      arrastres.some(
        (arrastre) =>
          isLiveArrastre(arrastre) &&
          (arrastre.incidentes || []).some(
            (incident) => normalizeStatus(incident.estado) === "ABIERTO",
          ),
      ),
    [arrastres, meta],
  );

  const activeRows = useMemo(() => arrastres.filter(isLiveArrastre), [arrastres]);
  const historyRows = useMemo(() => arrastres.filter(isHistoryArrastre), [arrastres]);
  const selectedRows = variant === "movimientos" && scope === "pasados" ? historyRows : activeRows;
  const rows = selectedRows;
  const selectedMode: "active" | "history" =
    variant === "movimientos" && scope === "pasados" ? "history" : "active";
  const scopeOptions = [
    {
      value: "actuales" as const,
      label: "Actuales",
      count: scope === "actuales" ? meta?.total : undefined,
    },
    {
      value: "pasados" as const,
      label: "Pasados",
      count: scope === "pasados" ? meta?.total : undefined,
    },
  ];
  const totalPages = meta?.totalPages ?? 1;
  const safePage = requestedPage;
  const paginatedRows = rows;
  const headerCount = meta?.total ?? rows.length;

  const applyToday = (field: ArrastreFechaCampo) => {
    const now = new Date();
    setFechaCampo(field);
    setDesde(
      toLocalDateTimeInput(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0)),
    );
    setHasta(
      toLocalDateTimeInput(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59)),
    );
  };

  const resolveSelectedIncident = useCallback(
    async (solucion: string) => {
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
          throw new Error(
            typeof data?.error === "string" ? data.error : "No se pudo resolver el incidente",
          );
        }

        setSelectedIncident(null);
        void playOperationConfirmation("arrastre_incidente_resuelto");
        await load(true);
      } finally {
        setResolvingIncident(false);
      }
    },
    [load, selectedIncident],
  );

  const prioritizeArrastre = useCallback(
    async (arrastre: Arrastre) => {
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
          throw new Error(
            typeof data?.error === "string"
              ? data.error
              : "No se pudo subir la solicitud al frente",
          );
        }

        setActionMessage({ type: "ok", text: "Solicitud subida al frente de la cola operativa." });
        void playOperationConfirmation("arrastre_prioridad_actualizada");
        await load(true);
      } catch (error) {
        setActionMessage({
          type: "error",
          text: error instanceof Error ? error.message : "No se pudo subir la solicitud al frente",
        });
      } finally {
        setPriorityBusyId(null);
      }
    },
    [load],
  );

  const operateVagon = useCallback(
    async (
      action: "INICIAR_VAGON" | "FINALIZAR_VAGON",
      arrastre: Arrastre,
      vagon: VagonArrastre,
    ) => {
      const key = `${arrastre.id}:${vagon.id}`;
      setBusyVagonKey(key);
      setActionMessage(null);
      try {
        const response = await fetch("/api/cliente/torreon/arrastres/action", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, arrastreId: arrastre.id, vagonId: vagon.id }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok)
          throw new Error(
            typeof data?.error === "string" ? data.error : "No se pudo actualizar el vagón",
          );
        setActionMessage({
          type: "ok",
          text:
            action === "INICIAR_VAGON"
              ? "Vagón iniciado. La cola ya está actualizada."
              : "Vagón finalizado. Se mostró el siguiente pendiente.",
        });
        void playOperationConfirmation(action);
        await load(true);
      } catch (error) {
        setActionMessage({
          type: "error",
          text: error instanceof Error ? error.message : "No se pudo actualizar el vagón",
        });
      } finally {
        setBusyVagonKey(null);
      }
    },
    [load],
  );

  const openAudit = useCallback(
    async (arrastre: Arrastre) => {
      setAuditState({ arrastreId: arrastre.id, entries: [], loading: true, error: null });
      try {
        const params = new URLSearchParams({
          localidadId: String(localidadId),
          auditId: String(arrastre.id),
        });
        const response = await fetch(`/api/cliente/torreon/arrastres?${params.toString()}`, {
          cache: "no-store",
          credentials: "include",
        });
        const data = await response.json().catch(() => []);
        if (!response.ok) {
          const record = data && typeof data === "object" ? (data as { error?: unknown }) : {};
          throw new Error(String(record.error || "No se pudo cargar la bitácora"));
        }
        setAuditState({
          arrastreId: arrastre.id,
          entries: extractArray<ArrastreEditAudit>(data),
          loading: false,
          error: null,
        });
      } catch (error) {
        setAuditState({
          arrastreId: arrastre.id,
          entries: [],
          loading: false,
          error: error instanceof Error ? error.message : "No se pudo cargar la bitácora",
        });
      }
    },
    [localidadId],
  );

  const loadFeedback = loadError && (
    <div
      role="alert"
      className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200"
    >
      {loadError} {arrastres.length > 0 && "Se conserva la última consulta disponible."}
      <button
        type="button"
        disabled={loading || refreshing}
        onClick={() => load(true)}
        className="ml-3 font-semibold underline"
      >
        Reintentar
      </button>
    </div>
  );

  if (variant === "summary") {
    const attention = stats.detenidos + stats.incidentesAbiertos;
    return (
      <section className={s.summaryCard}>
        <div className={s.summaryHeading}>
          <div>
            <p className={s.eyebrow}>
              <ClipboardList size={16} aria-hidden />
              Vagones
            </p>
            <h2 className="mt-2">Arrastres</h2>
          </div>
          <TorreonRealtimeBadge status={realtimeStatus} />
        </div>
        <p className={s.subtitle}>Solicitudes, composición del tren y avance por vagón.</p>
        {loadFeedback}
        <div className={s.summaryNumbers}>
          <div>
            <strong>{stats.solicitados}</strong>
            <span>En espera</span>
          </div>
          <div>
            <strong>{stats.proceso}</strong>
            <span>En movimiento</span>
          </div>
          <div>
            <strong>{attention}</strong>
            <span>Alertas y pausas</span>
          </div>
        </div>
        <button type="button" onClick={onOpen} className={s.primaryButton}>
          Ver cola de arrastres
          <ArrowRight size={16} aria-hidden />
        </button>
      </section>
    );
  }

  return (
    <section className={embedded ? "min-w-0" : s.workspace}>
      {!embedded ? (
        <div className={s.pageHeader}>
          <ModuleHeader
            eyebrow="Torreón"
            title={variant === "dashboard" ? "Cola de arrastres" : "Seguimiento de arrastres"}
            subtitle={
              variant === "dashboard"
                ? `Operación actual · ${fmtDateKey(todayKey)}`
                : "Solicitudes activas e historial"
            }
            icon={ClipboardList}
            actions={
              <>
                <TorreonRealtimeBadge status={realtimeStatus} />
                <span className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
                  <Hash className="h-4 w-4 text-emerald-600" />
                  {headerCount} solicitud{headerCount === 1 ? "" : "es"}
                </span>
                {realtimeStatus !== "connected" ? (
                  <Button
                    onClick={() => load(true)}
                    loading={refreshing}
                    leftIcon={<RefreshCw className="h-4 w-4" aria-hidden />}
                  >
                    Reintentar
                  </Button>
                ) : null}
              </>
            }
          />
        </div>
      ) : null}

      <div className={s.workspace}>
        {loadFeedback}

        {embedded && variant === "movimientos" ? (
          <div className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <SegmentedControl
                ariaLabel="Ámbito de arrastres"
                value={scope}
                options={scopeOptions}
                onChange={changeScope}
              />
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <TorreonRealtimeBadge status={realtimeStatus} />
                <span className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-100 px-3 text-xs font-black text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  <Hash className="h-3.5 w-3.5 text-emerald-600" />
                  {headerCount} registro{headerCount === 1 ? "" : "s"}
                </span>
                {realtimeStatus !== "connected" ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => load(true)}
                    loading={refreshing}
                    leftIcon={<RefreshCw className="h-4 w-4" aria-hidden />}
                  >
                    Reintentar
                  </Button>
                ) : null}
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

        {!embedded ? (
          <ArrastreStatusStrip stats={stats} operational={variant === "dashboard"} />
        ) : null}

        {variant === "dashboard" && !loading ? <ArrastreFocus rows={rows} /> : null}

        {variant === "movimientos" && !embedded && (
          <SegmentedControl
            ariaLabel="Ambito de arrastres"
            value={scope}
            options={scopeOptions}
            onChange={changeScope}
          />
        )}

        {actionMessage ? (
          <div
            className={`rounded-xl border px-3 py-2 text-sm font-bold ${
              actionMessage.type === "ok"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200"
            }`}
          >
            {actionMessage.text}
          </div>
        ) : null}

        {variant === "movimientos" ? (
          <FilterPanel
            title="Filtros de arrastre"
            count={`${meta?.total ?? selectedRows.length} resultados`}
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
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => {
                    setDesde("");
                    setHasta("");
                  }}
                >
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
                <FieldShell
                  className="md:col-span-2 xl:col-span-4"
                  label="Buscar"
                  icon={<Search className="h-4 w-4" aria-hidden />}
                >
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
                  {STATUS_OPTIONS.filter(
                    (option) => option.value === "TODOS" || periodStatuses.has(option.value),
                  ).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
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
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
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
              <FieldShell
                className="xl:col-span-3"
                label="Desde"
                icon={<CalendarDays className="h-4 w-4" aria-hidden />}
              >
                <input
                  type="datetime-local"
                  value={desde}
                  onChange={(event) => setDesde(event.target.value)}
                  className="min-w-0 flex-1 bg-transparent font-semibold text-slate-700 outline-none dark:text-slate-100"
                />
              </FieldShell>
              <FieldShell
                className="xl:col-span-3"
                label="Hasta"
                icon={<CalendarDays className="h-4 w-4" aria-hidden />}
              >
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
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </FieldShell>
            </div>
          </FilterPanel>
        ) : null}

        {embedded ? <ArrastreStatusStrip stats={stats} operational={false} /> : null}

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-black uppercase tracking-wide text-slate-700 dark:text-slate-200">
                {selectedMode === "history" ? "Historial de arrastres" : "Cola operativa"}
              </h3>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {selectedMode === "history"
                  ? "Arrastres finalizados y cancelados."
                  : "Arrastres en espera, en movimiento o pausados."}
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
              onIncidentSelect={(incident, arrastre) =>
                setSelectedIncident({
                  arrastreId: arrastre.id,
                  incident,
                  title: `Arrastre ${buildArrastreFolio(arrastre, dailyCounters.get(arrastre.id))}`,
                  subtitle: `Movimiento de arrastre #${arrastre.id}`,
                })
              }
              onAuditSelect={rol === "ADMINISTRADOR" ? openAudit : undefined}
            />
          ) : rows.length ? (
            <ArrastreOperationalTable
              rows={paginatedRows}
              dailyCounters={dailyCounters}
              mode={selectedMode}
              busyArrastreId={priorityBusyId}
              canPrioritizeByIncident={hasOpenIncidentInQueue}
              onPrioritizeArrastre={selectedMode === "active" ? prioritizeArrastre : undefined}
              busyVagonKey={busyVagonKey}
              onStartVagon={
                rol === "COORDINADOR" && selectedMode === "active"
                  ? (arrastre, vagon) => operateVagon("INICIAR_VAGON", arrastre, vagon)
                  : undefined
              }
              onFinishVagon={
                rol === "COORDINADOR" && selectedMode === "active"
                  ? (arrastre, vagon) => operateVagon("FINALIZAR_VAGON", arrastre, vagon)
                  : undefined
              }
              onIncidentSelect={(incident, arrastre) =>
                setSelectedIncident({
                  arrastreId: arrastre.id,
                  incident,
                  title: `Arrastre ${buildArrastreFolio(arrastre, dailyCounters.get(arrastre.id))}`,
                  subtitle: `Movimiento de arrastre #${arrastre.id}`,
                })
              }
              onAuditSelect={rol === "ADMINISTRADOR" ? openAudit : undefined}
            />
          ) : (
            <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm font-semibold text-slate-500 dark:border-slate-700 dark:text-slate-400">
              {selectedMode === "history"
                ? "No hay arrastres en el historial."
                : "No hay arrastres activos en este momento."}
            </div>
          )}
        </div>

        {(variant === "movimientos" || totalPages > 1) && !loading && rows.length > 0 && (
          <PaginationBar
            page={safePage}
            totalPages={totalPages}
            pageSize={variant === "movimientos" ? pageSize : 8}
            totalItems={meta?.total ?? rows.length}
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
      {auditState ? (
        <ArrastreAuditModal
          arrastreId={auditState.arrastreId}
          entries={auditState.entries}
          loading={auditState.loading}
          error={auditState.error}
          onClose={() => setAuditState(null)}
        />
      ) : null}
    </section>
  );
}
