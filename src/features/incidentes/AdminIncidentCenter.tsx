"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Clock3,
  MapPinned,
  Radio,
  RefreshCw,
  SlidersHorizontal,
  TrainFront,
  X,
} from "lucide-react";
import IncidentesTable from "@/app/incidentes/ui/IncidentesTable";
import SmartIncidentBlocker from "@/app/incidentes/ui/SmartIncidentBlocker";
import type { IncidenteRow, Meta } from "@/app/incidentes/ui/types";
import TorreonIncidentDetailModal from "@/app/coordinador/torreon/TorreonIncidentDetailModal";
import { SearchInput } from "@/app/Components/ui";
import { useRealtimeMovimientos, type RealtimeMovementEvent } from "@/app/hooks/useRealtimeMovimientos";
import { isTorreonLocalidadId } from "@/lib/torreonLocalidad";
import IncidentCatalogSelect from "./components/IncidentCatalogSelect";

type UnknownRecord = Record<string, unknown>;
type Source = "cosaif" | "torreon";
type Scope = "TODOS" | "GDL" | "TORREON";
type OperationKind = "TODOS" | "NATURAL" | "ARRASTRE";
type TimeScope = "ACTUALES" | "HISTORIAL";
type CatalogOption = { id: number; nombre: string };

type ListResponse = {
  success?: boolean;
  data?: unknown;
  error?: string;
  message?: string;
  meta?: { page?: number; pageSize?: number; total?: number; totalPages?: number };
};

const PAGE_SIZE = 24;
const SOURCE_PAGE_SIZE = 100;

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" ? value as UnknownRecord : {};
}

function asArray(value: unknown): UnknownRecord[] {
  if (Array.isArray(value)) return value as UnknownRecord[];
  const record = asRecord(value);
  if (Array.isArray(record.data)) return record.data as UnknownRecord[];
  if (Array.isArray(record.items)) return record.items as UnknownRecord[];
  return [];
}

function positiveNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function status(value: unknown) {
  return text(value).toUpperCase();
}

function sourceOf(incident: UnknownRecord): Source {
  return text(incident._source || incident.source).toLowerCase() === "torreon" ? "torreon" : "cosaif";
}

function kindOf(incident: UnknownRecord): Exclude<OperationKind, "TODOS"> {
  const value = [
    incident._torreonTipo,
    incident.tipoIncidente,
    incident.tipo,
    incident.tipoMovimiento,
    asRecord(incident.movimiento).tipoMovimiento,
  ].map((item) => text(item).toUpperCase()).join(" ");
  return value.includes("ARRASTRE") || incident.arrastre || incident.arrastreId ? "ARRASTRE" : "NATURAL";
}

function incidentKey(incident: UnknownRecord) {
  return `${sourceOf(incident)}:${kindOf(incident)}:${String(incident.id ?? "")}`;
}

function incidentTime(incident: UnknownRecord) {
  return Date.parse(text(incident.fechaInicio || incident.fecha || incident.createdAt)) || 0;
}

function displayDate(value: unknown) {
  const parsed = Date.parse(text(value));
  if (Number.isNaN(parsed)) return "Sin fecha";
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(parsed));
}

function statusLabel(value: unknown) {
  const normalized = status(value);
  if (normalized === "ABIERTO") return "Requiere atención";
  if (normalized === "RESUELTO") return "Resuelto";
  if (normalized === "CERRADO") return "Cerrado";
  return normalized || "Sin estado";
}

function routeName(value: unknown) {
  if (typeof value === "string") return value.trim() || "—";
  const record = asRecord(value);
  return text(record.nombre || record.nombreSnapshot) || "—";
}

async function requestJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, { ...init, credentials: "include", cache: "no-store" });
  const payload = await response.json().catch(() => null) as UnknownRecord | null;
  if (!response.ok) {
    throw new Error(text(payload?.error || payload?.message) || `Error HTTP ${response.status}`);
  }
  return payload as T;
}

async function fetchAllSourcePages(
  source: Source,
  makeUrl: (source: Source, page: number) => string,
  signal: AbortSignal,
): Promise<UnknownRecord[]> {
  const first = await requestJson<ListResponse>(makeUrl(source, 1), { signal });
  if (first.success === false || !Array.isArray(first.data)) {
    throw new Error(first.error || first.message || `No se pudieron cargar incidentes de ${source === "torreon" ? "Torreón" : "Guadalajara"}`);
  }

  const totalPages = Math.max(1, Number(first.meta?.totalPages) || 1);
  const rows = asArray(first.data);
  const remainingPages = Array.from({ length: Math.max(0, totalPages - 1) }, (_, index) => index + 2);

  for (let index = 0; index < remainingPages.length; index += 4) {
    const chunk = remainingPages.slice(index, index + 4);
    const responses = await Promise.all(chunk.map((page) => requestJson<ListResponse>(makeUrl(source, page), { signal })));
    responses.forEach((response) => rows.push(...asArray(response.data)));
  }

  return rows.map((row) => ({ ...row, _source: source }));
}

function detailQuery(incident: UnknownRecord) {
  if (sourceOf(incident) !== "torreon") return "";
  const params = new URLSearchParams({ source: "torreon", tipo: kindOf(incident) });
  const localidadId = positiveNumber(incident.localidadId || asRecord(incident.movimiento).localidadId || asRecord(incident.arrastre).localidadId);
  if (localidadId) params.set("localidadId", String(localidadId));
  return `?${params.toString()}`;
}

function mapIncident(incident: UnknownRecord, localityNames: Map<number, string>): IncidenteRow {
  const source = sourceOf(incident);
  const kind = kindOf(incident);
  const movement = asRecord(incident.movimiento);
  const arrastre = asRecord(incident.arrastre);
  const wagon = asRecord(incident.vagon);
  const company = asRecord(movement.empresa);
  const localidadId = positiveNumber(incident.localidadId || movement.localidadId || arrastre.localidadId);
  const empresaId = positiveNumber(movement.empresaId || arrastre.empresaId || company.id);
  const sourceLabel = source === "torreon" ? "Torreón" : "Guadalajara";
  const locality = localidadId ? localityNames.get(localidadId) : null;
  const rawStatus = status(incident.estado);
  const locomotive = movement.locomotiveNumber || movement.locomotora || incident.locomotiveNumber;
  const wagonName = wagon.numeroVagon || wagon.id || incident.vagonId;

  return {
    id: incident.id as number | string | undefined,
    fecha: displayDate(incident.fechaInicio || incident.fecha || incident.createdAt),
    fechaISO: text(incident.fechaInicio || incident.fecha || incident.createdAt),
    estatus: statusLabel(rawStatus),
    estadoRaw: rawStatus,
    empresa: text(company.nombre || movement.empresaNombreSnapshot || arrastre.empresaNombreSnapshot || incident.empresaNombre) || (empresaId ? `Empresa ${empresaId}` : "Sin empresa"),
    empresaId,
    localidad: locality || sourceLabel,
    localidadId,
    locomotora: kind === "ARRASTRE" ? (wagonName ? `Vagón ${String(wagonName)}` : `Arrastre #${String(arrastre.id || incident.arrastreId || incident.id)}`) : (locomotive as string | number | undefined),
    origen: routeName(movement.viaOrigen || wagon.viaOrigenNombre || wagon.viaOrigenId),
    destino: routeName(movement.viaDestino || wagon.viaDestinoNombre || wagon.viaId),
    descripcion: text(incident.descripcion || incident.motivo) || "Sin descripción",
    usuario: text(asRecord(incident.usuario).nombre) || "—",
    fuente: sourceLabel,
    tipoIncidente: kind === "ARRASTRE" ? "Arrastre" : "Ronda natural",
    _original: incident,
  };
}

function MetricCard({ icon: Icon, label, value, detail, tone = "slate" }: {
  icon: typeof AlertTriangle;
  label: string;
  value: number;
  detail: string;
  tone?: "slate" | "rose" | "emerald" | "sky";
}) {
  const tones = {
    slate: "bg-slate-950 text-white dark:bg-white dark:text-slate-950",
    rose: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-200",
    emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200",
    sky: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-200",
  } as const;
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-slate-400">{label}</p>
          <p className="mt-2 text-3xl font-black tabular-nums text-slate-950 dark:text-white">{value}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{detail}</p>
        </div>
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${tones[tone]}`}><Icon className="h-5 w-5" aria-hidden /></span>
      </div>
    </article>
  );
}

function SegmentedButtons<T extends string>({ value, options, onChange, ariaLabel }: {
  value: T;
  options: Array<{ value: T; label: string; count?: number }>;
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <div className="inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-950" role="group" aria-label={ariaLabel}>
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button key={option.value} type="button" onClick={() => onChange(option.value)} aria-pressed={active} className={`inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg px-3 text-xs font-black transition ${active ? "bg-white text-slate-950 shadow-sm dark:bg-slate-800 dark:text-white" : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"}`}>
            {option.label}
            {typeof option.count === "number" ? <span className="rounded-full bg-slate-200/70 px-1.5 py-0.5 text-[10px] tabular-nums dark:bg-slate-700">{option.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export default function AdminIncidentCenter() {
  const [timeScope, setTimeScope] = useState<TimeScope>("ACTUALES");
  const [scope, setScope] = useState<Scope>("TODOS");
  const [operationKind, setOperationKind] = useState<OperationKind>("TODOS");
  const [empresaId, setEmpresaId] = useState<number | null>(null);
  const [localidadId, setLocalidadId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [rawRows, setRawRows] = useState<UnknownRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [catalogs, setCatalogs] = useState<{ empresas: CatalogOption[]; localidades: CatalogOption[] }>({ empresas: [], localidades: [] });
  const [selectedIncident, setSelectedIncident] = useState<UnknownRecord | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const requestVersionRef = useRef(0);
  const realtimeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([
      requestJson<unknown>("/bff/empresas").catch(() => []),
      requestJson<unknown>("/bff/localidades").catch(() => []),
    ]).then(([companies, localities]) => {
      if (!alive) return;
      setCatalogs({
        empresas: asArray(companies).map((item) => ({ id: Number(item.id), nombre: text(item.nombre) })).filter((item) => item.id > 0 && item.nombre),
        localidades: asArray(localities).map((item) => ({ id: Number(item.id), nombre: text(item.nombre) })).filter((item) => item.id > 0 && item.nombre),
      });
    });
    return () => { alive = false; };
  }, []);

  const localityNames = useMemo(() => new Map(catalogs.localidades.map((item) => [item.id, item.nombre])), [catalogs.localidades]);

  const makeListUrl = useCallback((source: Source, sourcePage: number) => {
    const params = new URLSearchParams({ page: String(sourcePage), pageSize: String(SOURCE_PAGE_SIZE), estado: timeScope === "ACTUALES" ? "ABIERTO" : "PASADOS" });
    if (empresaId) params.set("empresaId", String(empresaId));
    if (localidadId) params.set("localidadId", String(localidadId));
    if (source === "torreon") {
      params.set("source", "torreon");
      params.set("includeFotos", "0");
      if (operationKind !== "TODOS") params.set("tipo", operationKind);
    }
    return `/api/incidentes?${params.toString()}`;
  }, [empresaId, localidadId, operationKind, timeScope]);

  const load = useCallback(async (manual = false) => {
    const requestVersion = requestVersionRef.current + 1;
    requestVersionRef.current = requestVersion;
    const controller = new AbortController();
    if (manual) setRefreshing(true);
    else setLoading(true);
    setError(null);
    setWarning(null);

    try {
      let sources: Source[] = scope === "TODOS" ? ["cosaif", "torreon"] : scope === "TORREON" ? ["torreon"] : ["cosaif"];
      if (localidadId) sources = [isTorreonLocalidadId(localidadId) ? "torreon" : "cosaif"];
      const results = await Promise.allSettled(sources.map((source) => fetchAllSourcePages(source, makeListUrl, controller.signal)));
      if (requestVersion !== requestVersionRef.current) return;
      const fulfilled = results.filter((result): result is PromiseFulfilledResult<UnknownRecord[]> => result.status === "fulfilled");
      const rejected = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
      if (!fulfilled.length) throw new Error(rejected.map((result) => result.reason instanceof Error ? result.reason.message : "Error al consultar incidentes").join(" · "));

      const merged = new Map<string, UnknownRecord>();
      fulfilled.flatMap((result) => result.value).forEach((incident) => merged.set(incidentKey(incident), incident));
      setRawRows(Array.from(merged.values()).sort((left, right) => incidentTime(right) - incidentTime(left)));
      setWarning(rejected.length ? "Una fuente no respondió. Se muestran los incidentes disponibles; puedes reintentar sin perder los filtros." : null);
      setLastUpdated(new Date());
    } catch (loadError) {
      if (requestVersion !== requestVersionRef.current) return;
      setRawRows([]);
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar los incidentes");
    } finally {
      if (requestVersion === requestVersionRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [localidadId, makeListUrl, scope]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = window.setInterval(() => { void load(true); }, 60_000);
    return () => window.clearInterval(interval);
  }, [autoRefresh, load]);

  const realtimeStatus = useRealtimeMovimientos({
    localidadId,
    onEvent: (event: RealtimeMovementEvent) => {
      const type = String(event.type || "");
      if (!type.includes("incidente") && type !== "realtime.ready" && type !== "realtime.resume") return;
      if (realtimeTimerRef.current != null) return;
      realtimeTimerRef.current = window.setTimeout(() => {
        realtimeTimerRef.current = null;
        void load(true);
      }, 650);
    },
  });

  useEffect(() => () => {
    requestVersionRef.current += 1;
    if (realtimeTimerRef.current != null) window.clearTimeout(realtimeTimerRef.current);
  }, []);

  const mappedRows = useMemo(() => rawRows.map((incident) => mapIncident(incident, localityNames)), [localityNames, rawRows]);
  const queryFilteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("es-MX");
    return mappedRows.filter((row) => !normalizedQuery || [row.id, row.descripcion, row.empresa, row.localidad, row.fuente, row.tipoIncidente, row.locomotora, row.origen, row.destino].some((value) => String(value ?? "").toLocaleLowerCase("es-MX").includes(normalizedQuery)));
  }, [mappedRows, query]);

  const filteredRows = useMemo(() => queryFilteredRows.filter((row) => (
    operationKind === "TODOS" ||
    (operationKind === "ARRASTRE" ? row.tipoIncidente === "Arrastre" : row.tipoIncidente === "Ronda natural")
  )), [operationKind, queryFilteredRows]);

  const stats = useMemo(() => ({
    total: filteredRows.length,
    attention: filteredRows.filter((row) => row.estadoRaw === "ABIERTO").length,
    resolved: filteredRows.filter((row) => row.estadoRaw === "RESUELTO").length,
    torreon: queryFilteredRows.filter((row) => row.fuente === "Torreón").length,
    gdl: queryFilteredRows.filter((row) => row.fuente === "Guadalajara").length,
    natural: queryFilteredRows.filter((row) => row.tipoIncidente === "Ronda natural").length,
    arrastre: queryFilteredRows.filter((row) => row.tipoIncidente === "Arrastre").length,
    companies: new Set(filteredRows.map((row) => row.empresaId).filter(Boolean)).size,
    localities: new Set(filteredRows.map((row) => row.localidadId || row.localidad).filter(Boolean)).size,
  }), [filteredRows, queryFilteredRows]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = useMemo(() => filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE), [filteredRows, safePage]);
  const tableMeta: Meta = { page: safePage, pageSize: PAGE_SIZE, total: filteredRows.length, totalPages };
  useEffect(() => { setPage(1); }, [empresaId, localidadId, operationKind, query, scope, timeScope]);

  const availableLocalities = useMemo(() => catalogs.localidades.filter((location) => {
    if (scope === "TORREON") return isTorreonLocalidadId(location.id);
    if (scope === "GDL") return !isTorreonLocalidadId(location.id);
    return true;
  }), [catalogs.localidades, scope]);

  const changeScope = (next: Scope) => {
    setScope(next);
    if (localidadId && ((next === "TORREON" && !isTorreonLocalidadId(localidadId)) || (next === "GDL" && isTorreonLocalidadId(localidadId)))) setLocalidadId(null);
  };

  const clearFilters = () => {
    setScope("TODOS"); setOperationKind("TODOS"); setEmpresaId(null); setLocalidadId(null); setQuery("");
  };

  const selectIncident = useCallback(async (row: IncidenteRow) => {
    const original = asRecord(row._original);
    setSelectedIncident(original);
    try {
      const response = await requestJson<{ data?: unknown }>(`/api/incidentes/${encodeURIComponent(String(original.id))}${detailQuery(original)}`);
      const detail = asRecord(response.data ?? response);
      setSelectedIncident((current) => current && incidentKey(current) === incidentKey(original) ? { ...current, ...detail, _source: sourceOf(original), _detalle: detail } : current);
    } catch {
      // El resumen sigue disponible aunque el detalle ampliado no responda.
    }
  }, []);

  const actOnIncident = useCallback(async (action: "resolve" | "close", comments?: string) => {
    if (!selectedIncident?.id) return;
    setActionBusy(true); setNotice(null);
    try {
      const queryString = detailQuery(selectedIncident);
      const url = action === "resolve" ? `/api/incidentes/${encodeURIComponent(String(selectedIncident.id))}${queryString}` : `/api/incidentes/${encodeURIComponent(String(selectedIncident.id))}/cerrar${queryString}`;
      await requestJson(url, { method: action === "resolve" ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ estado: "RESUELTO", comentario: comments, solucion: comments }) });
      setSelectedIncident(null);
      setNotice({ type: "ok", text: action === "resolve" ? "Incidente resuelto correctamente." : "Incidente cerrado correctamente." });
      await load(true);
    } catch (actionError) {
      const message = actionError instanceof Error ? actionError.message : "No se pudo actualizar el incidente";
      setNotice({ type: "error", text: message });
      throw actionError;
    } finally { setActionBusy(false); }
  }, [load, selectedIncident]);

  const activeFilterCount = [scope !== "TODOS", operationKind !== "TODOS", Boolean(empresaId), Boolean(localidadId), Boolean(query.trim())].filter(Boolean).length;
  const scopeLabel = scope === "TORREON" ? "Torreón" : scope === "GDL" ? "Guadalajara" : "Guadalajara + Torreón";

  return (
    <section className="mx-auto w-full max-w-[1600px] space-y-5">
      <header className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 text-white shadow-xl dark:border-slate-800">
        <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-[.16em] text-emerald-300">Centro de incidentes</span>
              <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ${realtimeStatus === "connected" ? "bg-emerald-400/15 text-emerald-200" : "bg-amber-400/15 text-amber-200"}`}><Radio className={`h-3.5 w-3.5 ${realtimeStatus === "connected" ? "animate-pulse" : ""}`} aria-hidden />{realtimeStatus === "connected" ? "Actualización en vivo" : "Reconectando"}</span>
            </div>
            <h1 className="mt-4 max-w-3xl text-3xl font-black tracking-tight sm:text-4xl">Toda la operación, en una sola vista</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">Consulta Guadalajara y Torreón, rondas naturales y arrastres. Filtra, revisa evidencias y resuelve sin cambiar de módulo.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setAutoRefresh((current) => !current)} className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm font-black ${autoRefresh ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200" : "border-white/15 bg-white/5 text-slate-300"}`}><Clock3 className="h-4 w-4" aria-hidden />{autoRefresh ? "Automático" : "Manual"}</button>
            <button type="button" onClick={() => void load(true)} disabled={refreshing} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-black text-slate-950 transition hover:bg-emerald-200 disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden />{refreshing ? "Actualizando…" : "Actualizar"}</button>
          </div>
        </div>
      </header>

      {notice ? <div role="status" className={`flex items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-sm font-bold ${notice.type === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200" : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-200"}`}><span>{notice.text}</span><button type="button" onClick={() => setNotice(null)} aria-label="Cerrar mensaje"><X className="h-4 w-4" /></button></div> : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard icon={AlertTriangle} label="Resultados" value={stats.total} detail={`${stats.companies} empresas · ${stats.localities} localidades`} />
        <MetricCard icon={timeScope === "ACTUALES" ? Clock3 : CheckCircle2} label={timeScope === "ACTUALES" ? "Por atender" : "Resueltos"} value={timeScope === "ACTUALES" ? stats.attention : stats.resolved} detail={timeScope === "ACTUALES" ? "Requieren seguimiento" : "Cerrados correctamente"} tone={timeScope === "ACTUALES" ? "rose" : "emerald"} />
        <MetricCard icon={TrainFront} label="Rondas naturales" value={stats.natural} detail="Guadalajara y Torreón" tone="emerald" />
        <MetricCard icon={Boxes} label="Arrastres" value={stats.arrastre} detail="Operación de patio" tone="sky" />
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-2">
              <SegmentedButtons value={timeScope} onChange={setTimeScope} ariaLabel="Periodo de incidentes" options={[{ value: "ACTUALES", label: "Por atender" }, { value: "HISTORIAL", label: "Historial" }]} />
              <SegmentedButtons value={scope} onChange={changeScope} ariaLabel="Zona de operación" options={[{ value: "TODOS", label: "Toda la operación" }, { value: "GDL", label: "Guadalajara" }, { value: "TORREON", label: "Torreón" }]} />
              <SegmentedButtons value={operationKind} onChange={setOperationKind} ariaLabel="Tipo de operación" options={[{ value: "TODOS", label: "Todos" }, { value: "NATURAL", label: "Naturales", count: stats.natural }, { value: "ARRASTRE", label: "Arrastres", count: stats.arrastre }]} />
            </div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{lastUpdated ? `Actualizado ${lastUpdated.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}` : "Preparando información"}</span>
          </div>
          <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_220px_220px_auto]">
            <SearchInput value={query} onChange={setQuery} onClear={() => setQuery("")} label="Buscar incidentes" placeholder="ID, empresa, localidad, locomotora, vagón o ruta…" inputClassName="min-h-11 rounded-xl" />
            <IncidentCatalogSelect value={empresaId} onChange={setEmpresaId} options={catalogs.empresas} placeholder="Todas las empresas" fullWidth />
            <IncidentCatalogSelect value={localidadId} onChange={setLocalidadId} options={availableLocalities} placeholder="Todas las localidades" fullWidth />
            <button type="button" onClick={clearFilters} disabled={!activeFilterCount} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-black text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"><SlidersHorizontal className="h-4 w-4" aria-hidden />Limpiar {activeFilterCount ? `(${activeFilterCount})` : ""}</button>
          </div>
        </div>
      </section>

      {warning ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">{warning}</div> : null}
      {error ? (
        <section className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center dark:border-rose-900 dark:bg-rose-950/20"><AlertTriangle className="mx-auto h-10 w-10 text-rose-500" aria-hidden /><h2 className="mt-3 text-lg font-black text-rose-900 dark:text-rose-100">No pudimos cargar los incidentes</h2><p className="mt-1 text-sm text-rose-700 dark:text-rose-300">{error}</p><button type="button" onClick={() => void load()} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-rose-700 px-5 text-sm font-black text-white"><RefreshCw className="h-4 w-4" />Reintentar</button></section>
      ) : (
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:px-5"><div><h2 className="font-black text-slate-950 dark:text-white">{timeScope === "ACTUALES" ? "Incidentes que requieren atención" : "Historial de incidentes"}</h2><p className="mt-0.5 text-xs font-semibold text-slate-500 dark:text-slate-400">{filteredRows.length} resultado{filteredRows.length === 1 ? "" : "s"} · selecciona uno para revisar evidencias y acciones</p></div><span className="inline-flex w-fit items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600 dark:bg-slate-800 dark:text-slate-300"><MapPinned className="h-3.5 w-3.5" />{scopeLabel}</span></div>
          <IncidentesTable data={pageRows} loading={loading} meta={tableMeta} onRowPress={(row) => void selectIncident(row)} onPageChange={setPage} onRefresh={() => void load(true)} refreshing={refreshing} emptyStateText={timeScope === "ACTUALES" ? "No hay incidentes pendientes con estos filtros" : "No hay incidentes en el historial con estos filtros"} />
        </section>
      )}

      {selectedIncident ? sourceOf(selectedIncident) === "torreon" ? (
        <TorreonIncidentDetailModal incident={selectedIncident} title={`${kindOf(selectedIncident) === "ARRASTRE" ? "Arrastre" : "Ronda natural"} · Incidente #${String(selectedIncident.id || "—")}`} subtitle={["Torreón", text(asRecord(asRecord(selectedIncident.movimiento).empresa).nombre), text(selectedIncident.motivo || selectedIncident.descripcion)].filter(Boolean).join(" · ")} resolving={actionBusy} onResolve={(comments) => actOnIncident("resolve", comments)} onCancel={(comments) => actOnIncident("close", comments)} onClose={() => setSelectedIncident(null)} />
      ) : (
        <SmartIncidentBlocker incident={selectedIncident} operatorComment={text(selectedIncident.operadorComentario)} onResolve={(comments) => void actOnIncident("resolve", comments)} onContinue={() => setSelectedIncident(null)} onSkip={() => void actOnIncident("close")} />
      ) : null}
    </section>
  );
}
