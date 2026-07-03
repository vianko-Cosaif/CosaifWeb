"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Camera,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  Hash,
  ImageIcon,
  RefreshCw,
  Search,
  Timer,
  TrainFront,
  UserRound,
  X,
} from "lucide-react";
import TorreonIncidentDetailModal, { type TorreonIncidentDetail } from "./TorreonIncidentDetailModal";

type FotoMovimiento = {
  id?: number | null;
  tipo: string;
  orden: number;
  url: string;
  comentario?: string | null;
  tomadaAt?: string | null;
};

type IncidenteMovimientoNatural = TorreonIncidentDetail;

type MovimientoNatural = {
  id: number | string;
  empresaNombre?: string | null;
  clienteId?: number | null;
  clienteNombre?: string | null;
  supervisorId?: number | null;
  supervisorNombre?: string | null;
  coordinadorId?: number | null;
  coordinadorNombre?: string | null;
  operadorId?: number | null;
  operadorNombre?: string | null;
  creadoPorId?: number | null;
  creadoPorNombre?: string | null;
  iniciadoPorId?: number | null;
  iniciadoPorNombre?: string | null;
  locomotiveNumber?: number | string | null;
  estado?: string | null;
  prioridad?: string | null;
  tipoMovimiento?: string | null;
  viaOrigen?: string | null;
  viaDestino?: string | null;
  fechaSolicitud?: string | null;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  instrucciones?: string | null;
  fotos?: FotoMovimiento[];
  fotosPorTipo?: Record<string, FotoMovimiento[]>;
  incidentes?: IncidenteMovimientoNatural[];
};

type Props = {
  localidadId: number;
};

type StatusTab = "activos" | "concluidos" | "todos";
type FechaCampo = "solicitud" | "inicio" | "fin";
type SortKey = "cronologia" | "solicitud" | "inicio" | "fin" | "id";
type SortDir = "asc" | "desc";

const STATUS_TABS: Array<{ value: StatusTab; label: string }> = [
  { value: "activos", label: "Actuales" },
  { value: "concluidos", label: "Pasados" },
  { value: "todos", label: "Todos" },
];

const STAGES = [
  { key: "ANTES_MOVIMIENTO", label: "Inicio" },
  { key: "PROCESO_MOVIMIENTO", label: "Traslado" },
  { key: "FIN_MOVIMIENTO", label: "Fin" },
] as const;

function normalizeStatus(value?: string | null) {
  return String(value || "").trim().toUpperCase() || "SIN_ESTADO";
}

function formatDate(value?: string | null) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function formatDuration(inicio?: string | null, fin?: string | null) {
  if (!inicio || !fin) return "--";
  const start = Date.parse(inicio);
  const end = Date.parse(fin);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return "--";
  const minutes = Math.round((end - start) / 60000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

function formatMinutes(minutes?: number | null) {
  if (!Number.isFinite(Number(minutes))) return "--";
  const safe = Math.max(0, Math.round(Number(minutes)));
  if (safe < 60) return `${safe} min`;
  const hours = Math.floor(safe / 60);
  const rest = safe % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

function getChronologyStart(row: MovimientoNatural) {
  return row.fechaInicio || row.fechaSolicitud || null;
}

function getChronologyEnd(row: MovimientoNatural) {
  return row.fechaFin || null;
}

function getOperatorLabel(row: MovimientoNatural) {
  const name = row.iniciadoPorNombre || row.operadorNombre || row.creadoPorNombre;
  if (name) return name;
  const id = row.iniciadoPorId || row.operadorId || row.creadoPorId;
  return id ? `Usuario #${id}` : "Sin iniciar";
}

function getClientLabel(row: MovimientoNatural) {
  if (row.clienteNombre) return row.clienteNombre;
  if (row.clienteId) return `Cliente #${row.clienteId}`;
  return row.empresaNombre || "Cliente";
}

function getFechaValue(row: MovimientoNatural, campo: FechaCampo | SortKey) {
  if (campo === "cronologia") return getChronologyStart(row);
  if (campo === "inicio") return row.fechaInicio || null;
  if (campo === "fin") return row.fechaFin || null;
  if (campo === "solicitud") return row.fechaSolicitud || null;
  return null;
}

function toLocalDateTimeInput(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function compareRows(a: MovimientoNatural, b: MovimientoNatural, sortKey: SortKey, sortDir: SortDir) {
  const factor = sortDir === "asc" ? 1 : -1;
  if (sortKey === "id") return String(a.id).localeCompare(String(b.id), "es-MX", { numeric: true }) * factor;
  if (sortKey === "cronologia") {
    const aStart = Date.parse(String(getChronologyStart(a) || "")) || Number.POSITIVE_INFINITY;
    const bStart = Date.parse(String(getChronologyStart(b) || "")) || Number.POSITIVE_INFINITY;
    const startDiff = aStart - bStart;
    if (startDiff) return startDiff * factor;
    const aEnd = Date.parse(String(getChronologyEnd(a) || "")) || Number.POSITIVE_INFINITY;
    const bEnd = Date.parse(String(getChronologyEnd(b) || "")) || Number.POSITIVE_INFINITY;
    const endDiff = aEnd - bEnd;
    if (endDiff) return endDiff * factor;
  }
  const aTime = Date.parse(String(getFechaValue(a, sortKey) || "")) || Number.POSITIVE_INFINITY;
  const bTime = Date.parse(String(getFechaValue(b, sortKey) || "")) || Number.POSITIVE_INFINITY;
  return (aTime - bTime) * factor || String(a.id).localeCompare(String(b.id), "es-MX", { numeric: true }) * factor;
}

function statusClass(status: string) {
  if (status === "CONCLUIDO") return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300";
  if (status === "EN_PROCESO") return "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300";
  if (status === "DETENIDO" || status === "BLOQUEADO") return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300";
  if (status === "CANCELADO") return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300";
  return "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";
}

function getIncidentList(row: MovimientoNatural) {
  return Array.isArray(row.incidentes) ? row.incidentes : [];
}

function getPrimaryIncident(row: MovimientoNatural) {
  const incidentes = getIncidentList(row);
  return incidentes.find((incidente) => normalizeStatus(incidente.estado) === "ABIERTO") || incidentes[0] || null;
}

export default function TorreonNaturalesPanel({ localidadId }: Props) {
  const [status, setStatus] = useState<StatusTab>("activos");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<MovimientoNatural[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<MovimientoNatural | null>(null);
  const [fechaCampo, setFechaCampo] = useState<FechaCampo>("inicio");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortKey, setSortKey] = useState<SortKey>("cronologia");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selectedIncident, setSelectedIncident] = useState<{
    incident: TorreonIncidentDetail;
    title: string;
    subtitle?: string;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        localidadId: String(localidadId),
        status,
      });
      const response = await fetch(`/api/coordinador/torreon/movimientos?${params.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.error || "No se pudieron cargar movimientos");
      }
      setRows(Array.isArray(payload?.data) ? payload.data : []);
    } catch (err) {
      setRows([]);
      setError(err instanceof Error ? err.message : "Error al cargar movimientos");
    } finally {
      setLoading(false);
    }
  }, [localidadId, status]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [status, search, fechaCampo, desde, hasta, pageSize, sortKey, sortDir]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const from = desde ? Date.parse(desde) : null;
    const to = hasta ? Date.parse(hasta) : null;
    return rows
      .filter((row) => {
        if (!q) return true;
        return [
          row.id,
          row.empresaNombre,
          row.locomotiveNumber,
          row.estado,
          row.viaOrigen,
          row.viaDestino,
          row.tipoMovimiento,
          row.clienteNombre,
          row.supervisorNombre,
          row.coordinadorNombre,
          row.operadorNombre,
          row.creadoPorNombre,
          row.iniciadoPorNombre,
        ]
          .map((value) => String(value ?? "").toLowerCase())
          .some((value) => value.includes(q));
      })
      .filter((row) => {
        if (!from && !to) return true;
        const value = getFechaValue(row, fechaCampo);
        if (!value) return false;
        const time = Date.parse(value);
        if (Number.isNaN(time)) return false;
        if (from && time < from) return false;
        if (to && time > to) return false;
        return true;
      })
      .sort((a, b) => compareRows(a, b, sortKey, sortDir));
  }, [desde, fechaCampo, hasta, rows, search, sortDir, sortKey]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedRows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, pageSize, safePage]);

  const metrics = useMemo(() => {
    const active = filteredRows.filter((row) => !["CONCLUIDO", "CANCELADO"].includes(normalizeStatus(row.estado))).length;
    const process = filteredRows.filter((row) => normalizeStatus(row.estado) === "EN_PROCESO").length;
    const done = filteredRows.filter((row) => normalizeStatus(row.estado) === "CONCLUIDO").length;
    const withPhotos = filteredRows.filter((row) => (row.fotos || []).length > 0).length;
    const withIncidents = filteredRows.filter((row) => getIncidentList(row).length > 0).length;
    const durations = filteredRows
      .map((row) => {
        const start = Date.parse(String(row.fechaInicio || ""));
        const end = Date.parse(String(row.fechaFin || ""));
        return Number.isNaN(start) || Number.isNaN(end) || end < start ? null : Math.round((end - start) / 60000);
      })
      .filter((value): value is number => typeof value === "number");
    const avg = durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : null;
    return { active, process, done, withPhotos, withIncidents, avg };
  }, [filteredRows]);

  const chronologyRows = useMemo(() => filteredRows.slice(0, Math.min(filteredRows.length, 6)), [filteredRows]);

  const applyToday = (field: FechaCampo) => {
    const now = new Date();
    setFechaCampo(field);
    setDesde(toLocalDateTimeInput(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0)));
    setHasta(toLocalDateTimeInput(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59)));
  };

  return (
    <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="border-b border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-200 dark:shadow-emerald-950/40">
              <TrainFront className="h-7 w-7" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-400">Torreón</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-black text-slate-950 dark:text-white sm:text-3xl">Movimientos</h2>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {STATUS_TABS.find((tab) => tab.value === status)?.label}
                </span>
              </div>
              <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">Gestión ferroviaria · Torreón</p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
              <span className="text-emerald-600">{filteredRows.length}</span> registros
            </div>
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
              Actualizar
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <div className="rounded-3xl border border-slate-200 bg-slate-50/60 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
        <div className="flex flex-wrap gap-2">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setStatus(tab.value)}
              className={`inline-flex h-9 flex-1 items-center justify-center rounded-lg px-3 text-sm font-bold transition sm:flex-none ${
                status === tab.value
                  ? "bg-slate-950 text-white shadow-sm dark:bg-white dark:text-slate-950"
                  : "border border-slate-200 bg-white text-slate-500 hover:text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative mt-3">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por locomotora, cliente, operador, estado..."
            className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 text-sm font-semibold text-slate-700 outline-none shadow-sm focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>

        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-[160px_1fr_1fr_170px_150px_120px]">
          <label className="space-y-1">
            <span className="text-[11px] font-black uppercase tracking-wide text-slate-400">Fecha filtro</span>
            <select
              value={fechaCampo}
              onChange={(event) => setFechaCampo(event.target.value as FechaCampo)}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="solicitud">Solicitud</option>
              <option value="inicio">Inicio real</option>
              <option value="fin">Fin real</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-[11px] font-black uppercase tracking-wide text-slate-400">Desde</span>
            <div className="relative">
              <CalendarDays className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="datetime-local"
                value={desde}
                onChange={(event) => setDesde(event.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm font-bold text-slate-700 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
          </label>
          <label className="space-y-1">
            <span className="text-[11px] font-black uppercase tracking-wide text-slate-400">Hasta</span>
            <div className="relative">
              <CalendarDays className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="datetime-local"
                value={hasta}
                onChange={(event) => setHasta(event.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm font-bold text-slate-700 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
          </label>
          <label className="space-y-1">
            <span className="text-[11px] font-black uppercase tracking-wide text-slate-400">Orden</span>
            <select
              value={sortKey}
              onChange={(event) => setSortKey(event.target.value as SortKey)}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="cronologia">Cronología operativa</option>
              <option value="inicio">Inicio real</option>
              <option value="fin">Fin real</option>
              <option value="solicitud">Solicitud</option>
              <option value="id">ID</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-[11px] font-black uppercase tracking-wide text-slate-400">Dirección</span>
            <select
              value={sortDir}
              onChange={(event) => setSortDir(event.target.value as SortDir)}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="asc">Ascendente</option>
              <option value="desc">Descendente</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-[11px] font-black uppercase tracking-wide text-slate-400">Por página</span>
            <select
              value={pageSize}
              onChange={(event) => setPageSize(Number(event.target.value))}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              {[10, 25, 50, 100].map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => applyToday("inicio")} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300">
            Inicio hoy
          </button>
          <button type="button" onClick={() => applyToday("fin")} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300">
            Cierres hoy
          </button>
          <button type="button" onClick={() => { setDesde(""); setHasta(""); }} className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-black text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:bg-slate-900 dark:text-rose-300 dark:hover:bg-rose-950/40">
            Limpiar fechas
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Metric label="Activos" value={metrics.active} icon={Clock3} />
        <Metric label="En proceso" value={metrics.process} icon={TrainFront} />
        <Metric label="Concluidos" value={metrics.done} icon={CheckCircle2} />
        <Metric label="Con evidencias" value={metrics.withPhotos} icon={Camera} />
        <Metric label="Con incidente" value={metrics.withIncidents} icon={AlertTriangle} />
        <Metric label="Resolución prom." value={formatMinutes(metrics.avg)} icon={Timer} />
      </div>

      {!loading && !error && chronologyRows.length > 0 && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Orden operativo</p>
              <h3 className="text-lg font-black text-slate-950 dark:text-white">Cronología aplicada</h3>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <Hash className="h-4 w-4 text-emerald-600" />
              {sortKey === "cronologia" ? "Inicio a cierre" : "Orden filtrado"}
            </div>
          </div>
          <div className="mt-3 grid gap-2 xl:grid-cols-3">
            {chronologyRows.map((row, index) => {
              const state = normalizeStatus(row.estado);
              return (
                <div key={`timeline-${row.id}`} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/40">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">
                        #{index + 1} · Movimiento #{row.id}
                      </p>
                      <p className="mt-1 text-sm font-black text-slate-950 dark:text-white">
                        Loco {row.locomotiveNumber || "--"} · {getClientLabel(row)}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-black ${statusClass(state)}`}>
                      {state.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <div className="rounded-xl bg-white px-3 py-2 dark:bg-slate-900">
                      <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Inicio</p>
                      <p className="mt-1 text-xs font-black text-slate-700 dark:text-slate-300">{formatDate(row.fechaInicio)}</p>
                    </div>
                    <div className="rounded-xl bg-white px-3 py-2 dark:bg-slate-900">
                      <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Fin</p>
                      <p className="mt-1 text-xs font-black text-slate-700 dark:text-slate-300">{formatDate(row.fechaFin)}</p>
                    </div>
                    <div className="rounded-xl bg-white px-3 py-2 dark:bg-slate-900">
                      <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Tiempo</p>
                      <p className="mt-1 text-xs font-black text-slate-700 dark:text-slate-300">{formatDuration(row.fechaInicio, row.fechaFin)}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-700 dark:bg-slate-900 dark:text-slate-300">
                    <UserRound className="h-4 w-4 text-emerald-600" />
                    {getOperatorLabel(row)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
        {loading ? (
          <div className="p-6 text-center text-sm font-semibold text-slate-500 dark:text-slate-400">Cargando movimientos...</div>
        ) : error ? (
          <div className="flex items-center justify-center gap-2 p-6 text-sm font-semibold text-rose-600">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="p-6 text-center text-sm font-semibold text-slate-500 dark:text-slate-400">Sin movimientos para mostrar.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1480px] w-full text-left text-sm">
              <thead className="bg-slate-950 text-[11px] uppercase tracking-wide text-white">
                <tr>
                  <th className="px-3 py-3">Orden</th>
                  <th className="px-3 py-3">ID</th>
                  <th className="px-3 py-3">Cliente</th>
                  <th className="px-3 py-3">Loco</th>
                  <th className="px-3 py-3">Inicio por</th>
                  <th className="px-3 py-3">Origen</th>
                  <th className="px-3 py-3">Destino</th>
                  <th className="px-3 py-3">Solicitud</th>
                  <th className="px-3 py-3">Inicio</th>
                  <th className="px-3 py-3">Fin</th>
                  <th className="px-3 py-3">Resolución</th>
                  <th className="px-3 py-3">Estado</th>
                  <th className="px-3 py-3">Incidentes</th>
                  <th className="px-3 py-3 text-right">Imágenes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {paginatedRows.map((row, index) => {
                  const state = normalizeStatus(row.estado);
                  const fotosCount = (row.fotos || []).length;
                  const incidentes = getIncidentList(row);
                  const primaryIncident = getPrimaryIncident(row);
                  return (
                    <tr key={String(row.id)} className="hover:bg-slate-50 dark:hover:bg-slate-900/70">
                      <td className="px-3 py-3 font-mono text-xs font-black text-slate-500 dark:text-slate-400">
                        {(safePage - 1) * pageSize + index + 1}
                      </td>
                      <td className="px-3 py-3 font-black text-slate-950 dark:text-white">#{row.id}</td>
                      <td className="px-3 py-3">
                        <p className="font-bold text-slate-800 dark:text-slate-200">{getClientLabel(row)}</p>
                        <p className="text-xs font-semibold text-slate-400">{row.tipoMovimiento || "Movimiento"}</p>
                      </td>
                      <td className="px-3 py-3 font-bold text-slate-700 dark:text-slate-300">{row.locomotiveNumber || "--"}</td>
                      <td className="px-3 py-3">
                        <p className="font-bold text-slate-800 dark:text-slate-200">{getOperatorLabel(row)}</p>
                        <p className="text-xs font-semibold text-slate-400">
                          {row.supervisorNombre || row.coordinadorNombre || "Sin responsable"}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-slate-600 dark:text-slate-400">{row.viaOrigen || "--"}</td>
                      <td className="px-3 py-3 text-slate-600 dark:text-slate-400">{row.viaDestino || "--"}</td>
                      <td className="px-3 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">{formatDate(row.fechaSolicitud)}</td>
                      <td className="px-3 py-3 text-xs font-black text-emerald-700">{formatDate(row.fechaInicio)}</td>
                      <td className="px-3 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">{formatDate(row.fechaFin)}</td>
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-50 px-2 py-1 text-xs font-black text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          <Timer className="h-3.5 w-3.5 text-slate-400" />
                          {formatDuration(row.fechaInicio, row.fechaFin)}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${statusClass(state)}`}>
                          {state.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        {primaryIncident ? (
                          <button
                            type="button"
                            onClick={() => setSelectedIncident({
                              incident: primaryIncident,
                              title: `Movimiento #${row.id}`,
                              subtitle: `Loco ${row.locomotiveNumber || "--"} · ${row.viaOrigen || "--"} a ${row.viaDestino || "--"}`,
                            })}
                            className="inline-flex h-9 items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 text-xs font-black text-amber-800 transition hover:border-amber-300 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-900/50"
                          >
                            <AlertTriangle className="h-4 w-4" />
                            Ver {incidentes.length}
                          </button>
                        ) : (
                          <span className="text-xs font-bold text-slate-400">--</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setSelected(row)}
                          className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300"
                        >
                          <Eye className="h-4 w-4" />
                          Ver {fotosCount ? `(${fotosCount})` : ""}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && !error && filteredRows.length > 0 && (
        <div className="mt-3 flex flex-col gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Mostrando {(safePage - 1) * pageSize + 1}-{Math.min(safePage * pageSize, filteredRows.length)} de {filteredRows.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              disabled={safePage <= 1}
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-black text-slate-600 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </button>
            <span className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {safePage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              disabled={safePage >= totalPages}
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-black text-slate-600 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
            >
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      </div>

      {selected && <FotosModal movimiento={selected} onClose={() => setSelected(null)} />}
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

function Metric({ label, value, icon: Icon }: { label: string; value: number | string; icon: typeof Clock3 }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/40">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-1 text-2xl font-black text-slate-950 dark:text-white">{value}</p>
        </div>
        <Icon className="h-5 w-5 text-emerald-600" />
      </div>
    </div>
  );
}

function FotosModal({ movimiento, onClose }: { movimiento: MovimientoNatural; onClose: () => void }) {
  const fotosPorTipo = movimiento.fotosPorTipo || {};
  const totalFotos = (movimiento.fotos || []).length;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-4 dark:bg-black/75">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-4 dark:border-slate-800">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Evidencias movimiento</p>
            <h3 className="mt-1 text-xl font-black text-slate-950 dark:text-white">Movimiento #{movimiento.id}</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Loco {movimiento.locomotiveNumber || "--"} · {movimiento.viaOrigen || "--"} a {movimiento.viaDestino || "--"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
            aria-label="Cerrar visor de imagenes"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {totalFotos === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 text-slate-500 dark:border-slate-700 dark:text-slate-400">
              <ImageIcon className="h-10 w-10" />
              <p className="mt-3 text-sm font-bold">Sin imagenes capturadas</p>
            </div>
          ) : (
            <div className="space-y-5">
              {STAGES.map((stage) => {
                const fotos = fotosPorTipo[stage.key] || [];
                return (
                  <section key={stage.key}>
                    <div className="mb-2 flex items-center justify-between">
                      <h4 className="text-sm font-black uppercase tracking-wide text-slate-700 dark:text-slate-200">{stage.label}</h4>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                        {fotos.length}/2
                      </span>
                    </div>
                    {fotos.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm font-semibold text-slate-400 dark:border-slate-700 dark:text-slate-500">
                        Sin capturas en esta etapa.
                      </div>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {fotos.map((foto) => (
                          <figure key={`${stage.key}-${foto.id ?? foto.orden}`} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40">
                            <img src={foto.url} alt={`${stage.label} ${foto.orden}`} className="h-64 w-full object-contain bg-slate-950" />
                            <figcaption className="space-y-1 p-3 text-xs text-slate-500 dark:text-slate-400">
                              <p className="font-bold text-slate-700 dark:text-slate-200">Captura {foto.orden}</p>
                              <p>{formatDate(foto.tomadaAt)}</p>
                              {foto.comentario ? <p>{foto.comentario}</p> : null}
                            </figcaption>
                          </figure>
                        ))}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
