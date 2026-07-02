"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  CalendarDays,
  CircleDot,
  Clock3,
  Hash,
  Loader2,
  RefreshCw,
  Search,
  type LucideIcon,
} from "lucide-react";

type ArrastreStatus = "TODOS" | "SOLICITADO" | "EN_PROCESO" | "DETENIDO" | "CONCLUIDO" | "CANCELADO";
type VagonStatus = "PENDIENTE" | "EN_PROCESO" | "BLOQUEADO" | "CONCLUIDO";

type VagonArrastre = {
  id: number;
  orden: number;
  numeroVagon?: string | null;
  carga?: string | null;
  estado?: string | null;
  viaId?: number | null;
  seccionId?: number | null;
  fechaSolicitud?: string | null;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  metricas?: {
    esperaMin?: number | null;
    operacionMin?: number | null;
    solicitudTotalMin?: number | null;
  } | null;
};

type IncidenteArrastre = {
  id: number;
  estado?: string | null;
  motivo?: string | null;
  solucion?: string | null;
  vagonId?: number | null;
  fechaInicio?: string | null;
  fechaResolucion?: string | null;
};

type Arrastre = {
  id: number;
  estado?: string | null;
  empresaId?: number | null;
  fechaSolicitud?: string | null;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  instrucciones?: string | null;
  vagones?: VagonArrastre[] | null;
  incidentes?: IncidenteArrastre[] | null;
  resumen?: {
    totalVagones?: number | null;
    pendientes?: number | null;
    enProceso?: number | null;
    bloqueados?: number | null;
    concluidos?: number | null;
    solicitudTotalMin?: number | null;
    operacionTotalMin?: number | null;
  } | null;
};

type Props = {
  localidadId: number;
  variant?: "dashboard" | "movimientos";
};

type DailyInfo = {
  index: number;
  total: number;
  date: string;
};

const STATUS_OPTIONS: Array<{ value: ArrastreStatus; label: string }> = [
  { value: "TODOS", label: "Todos" },
  { value: "SOLICITADO", label: "Solicitados" },
  { value: "EN_PROCESO", label: "En proceso" },
  { value: "DETENIDO", label: "Detenidos" },
  { value: "CONCLUIDO", label: "Concluidos" },
  { value: "CANCELADO", label: "Cancelados" },
];

const CLOSED = new Set(["CONCLUIDO", "CANCELADO"]);

function normalizeStatus(value?: string | null) {
  return String(value || "").trim().toUpperCase();
}

function isClosedStatus(value?: string | null) {
  return CLOSED.has(normalizeStatus(value));
}

function extractArray<T>(input: unknown): T[] {
  if (Array.isArray(input)) return input as T[];
  if (input && typeof input === "object") {
    const record = input as { data?: unknown; items?: unknown; rows?: unknown };
    if (Array.isArray(record.data)) return record.data as T[];
    if (Array.isArray(record.items)) return record.items as T[];
    if (Array.isArray(record.rows)) return record.rows as T[];
  }
  return [];
}

function fmtDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function fmtTime(value?: string | null) {
  if (!value) return "--:--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";
  return new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function localDateKey(value?: string | Date | null) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function arrastreDateKey(arrastre: Arrastre) {
  return localDateKey(arrastre.fechaSolicitud || arrastre.fechaInicio || arrastre.fechaFin);
}

function fmtDateKey(value: string) {
  if (!value) return "-";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(date);
}

function fmtMinutes(value?: number | null) {
  if (!Number.isFinite(Number(value))) return "-";
  const minutes = Math.max(0, Math.round(Number(value)));
  if (minutes < 60) return `${minutes} min`;
  const hrs = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem ? `${hrs} h ${rem} min` : `${hrs} h`;
}

function statusTone(status?: string | null) {
  const normalized = normalizeStatus(status);
  if (normalized === "CONCLUIDO") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (normalized === "EN_PROCESO") return "border-blue-200 bg-blue-50 text-blue-700";
  if (normalized === "DETENIDO" || normalized === "BLOQUEADO") return "border-amber-200 bg-amber-50 text-amber-800";
  if (normalized === "CANCELADO") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function StatusBadge({ status }: { status?: string | null }) {
  const normalized = normalizeStatus(status) || "SOLICITADO";
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold ${statusTone(normalized)}`}>
      {normalized.replace("_", " ")}
    </span>
  );
}

function getOpenIncident(arrastre: Arrastre) {
  return (arrastre.incidentes || []).find((incident) => normalizeStatus(incident.estado) === "ABIERTO") || null;
}

function arrastreMatches(arrastre: Arrastre, search: string) {
  const query = search.trim().toLowerCase();
  if (!query) return true;
  const values = [
    arrastre.id,
    arrastre.estado,
    arrastre.empresaId,
    arrastre.instrucciones,
    ...(arrastre.vagones || []).flatMap((vagon) => [
      vagon.numeroVagon,
      vagon.carga,
      vagon.estado,
      vagon.viaId,
      vagon.seccionId,
    ]),
    ...(arrastre.incidentes || []).flatMap((incident) => [incident.id, incident.estado, incident.motivo]),
  ];
  return values.some((value) => String(value ?? "").toLowerCase().includes(query));
}

function sortArrastres(rows: Arrastre[]) {
  return [...rows].sort((a, b) => {
    const aTime = Date.parse(String(a.fechaSolicitud || a.fechaInicio || "")) || 0;
    const bTime = Date.parse(String(b.fechaSolicitud || b.fechaInicio || "")) || 0;
    return bTime - aTime || b.id - a.id;
  });
}

function buildDailyCounters(rows: Arrastre[]) {
  const grouped = new Map<string, Arrastre[]>();
  rows.forEach((arrastre) => {
    const key = arrastreDateKey(arrastre);
    if (!key) return;
    grouped.set(key, [...(grouped.get(key) || []), arrastre]);
  });

  const counters = new Map<number, DailyInfo>();
  grouped.forEach((items, date) => {
    sortArrastres(items).reverse().forEach((arrastre, index) => {
      counters.set(arrastre.id, { index: index + 1, total: items.length, date });
    });
  });
  return counters;
}

function Metric({
  label,
  value,
  icon: Icon,
  tone = "text-slate-700",
  sub,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  tone?: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</span>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50">
          <Icon className={`h-4 w-4 ${tone}`} />
        </span>
      </div>
      <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
      {sub && <p className="mt-1 text-xs font-semibold text-slate-500">{sub}</p>}
    </div>
  );
}

function StatusStrip({ stats }: { stats: Record<"solicitados" | "proceso" | "detenidos" | "concluidos" | "cancelados", number> }) {
  const items = [
    ["Solicitados", stats.solicitados, "bg-slate-100 text-slate-700"],
    ["En proceso", stats.proceso, "bg-blue-50 text-blue-700"],
    ["Detenidos", stats.detenidos, "bg-amber-50 text-amber-800"],
    ["Concluidos", stats.concluidos, "bg-emerald-50 text-emerald-700"],
    ["Cancelados", stats.cancelados, "bg-rose-50 text-rose-700"],
  ] as const;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3">
      <div className="flex flex-wrap items-center gap-2">
        {items.map(([label, value, tone]) => (
          <span key={label} className={`inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-xs font-bold ${tone}`}>
            {label}
            <strong className="text-base leading-none">{value}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}

function VagonStatusRow({ vagones }: { vagones: VagonArrastre[] }) {
  const stats = vagones.reduce<Record<VagonStatus, number>>((acc, vagon) => {
    const status = normalizeStatus(vagon.estado) as VagonStatus;
    if (status in acc) acc[status] += 1;
    return acc;
  }, { PENDIENTE: 0, EN_PROCESO: 0, BLOQUEADO: 0, CONCLUIDO: 0 });

  return (
    <div className="flex flex-wrap gap-2 text-xs">
      {[
        ["Pendientes", stats.PENDIENTE],
        ["En proceso", stats.EN_PROCESO],
        ["Bloqueados", stats.BLOQUEADO],
        ["Concluidos", stats.CONCLUIDO],
      ].map(([label, value]) => (
        <span key={String(label)} className="inline-flex min-h-8 items-center gap-2 rounded-lg bg-slate-50 px-2.5 font-semibold text-slate-500">
          {label}
          <strong className="text-base leading-none text-slate-950">{value}</strong>
        </span>
      ))}
    </div>
  );
}

function ArrastreCard({
  arrastre,
  dailyInfo,
  compact = false,
}: {
  arrastre: Arrastre;
  dailyInfo?: DailyInfo;
  compact?: boolean;
}) {
  const vagones = arrastre.vagones || [];
  const openIncident = getOpenIncident(arrastre);
  const pending = vagones.find((vagon) => normalizeStatus(vagon.estado) === "PENDIENTE");
  const inProgress = vagones.find((vagon) => normalizeStatus(vagon.estado) === "EN_PROCESO");
  const title = dailyInfo ? `Arrastre ${dailyInfo.index} de ${dailyInfo.total}` : `Arrastre #${arrastre.id}`;

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md">
      <div className="grid gap-4 lg:grid-cols-[88px_1fr_auto] lg:items-start">
        <div className="flex h-full min-h-20 flex-row items-center gap-3 rounded-xl bg-slate-50 px-3 py-2 lg:flex-col lg:items-start lg:justify-center">
          <span className="text-lg font-black tabular-nums text-slate-950">{fmtTime(arrastre.fechaSolicitud)}</span>
          <span className="text-xs font-bold uppercase tracking-wide text-slate-400">{fmtDate(arrastre.fechaSolicitud).split(",")[0]}</span>
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={arrastre.estado} />
            {openIncident && (
              <span className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
                <AlertTriangle className="h-3.5 w-3.5" />
                Incidente abierto
              </span>
            )}
          </div>
          <h3 className="mt-2 text-xl font-black text-slate-950">
            {title}
            <span className="ml-2 text-sm font-semibold text-slate-400">ID #{arrastre.id}</span>
          </h3>
          <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
            <span className="inline-flex items-center gap-1 rounded-lg bg-slate-50 px-2.5 py-1">
              <Boxes className="h-3.5 w-3.5" />
              {arrastre.resumen?.totalVagones ?? vagones.length} vagones
            </span>
            <span className="inline-flex items-center gap-1 rounded-lg bg-slate-50 px-2.5 py-1">
              <Clock3 className="h-3.5 w-3.5" />
              Operacion {fmtMinutes(arrastre.resumen?.operacionTotalMin)}
            </span>
            {(inProgress || pending) && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-emerald-700">
                Siguiente {inProgress?.numeroVagon || pending?.numeroVagon || `Vagon ${(inProgress || pending)?.orden ?? "-"}`}
              </span>
            )}
          </div>
          {arrastre.instrucciones && (
            <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600">{arrastre.instrucciones}</p>
          )}
          {openIncident?.motivo && (
            <p className="mt-2 max-w-4xl rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
              {openIncident.motivo}
            </p>
          )}
        </div>

        <div className="min-w-[260px] lg:max-w-[440px]">
          <VagonStatusRow vagones={vagones} />
        </div>
      </div>

      {!compact && (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-[900px] w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2 pr-3">Vagon</th>
                <th className="py-2 pr-3">Carga</th>
                <th className="py-2 pr-3">Zona</th>
                <th className="py-2 pr-3">Estado</th>
                <th className="py-2 pr-3">Inicio</th>
                <th className="py-2 pr-3">Fin</th>
                <th className="py-2 pr-3">Operacion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {vagones.map((vagon) => (
                <tr key={vagon.id}>
                  <td className="py-2 pr-3 font-semibold text-slate-900">{vagon.numeroVagon || `Vagon ${vagon.orden}`}</td>
                  <td className="py-2 pr-3 text-slate-700">{normalizeStatus(vagon.carga) || "VACIO"}</td>
                  <td className="py-2 pr-3 text-slate-700">Via {vagon.viaId ?? "-"} / Seccion {vagon.seccionId ?? "-"}</td>
                  <td className="py-2 pr-3"><StatusBadge status={vagon.estado} /></td>
                  <td className="py-2 pr-3 text-slate-600">{fmtDate(vagon.fechaInicio)}</td>
                  <td className="py-2 pr-3 text-slate-600">{fmtDate(vagon.fechaFin)}</td>
                  <td className="py-2 pr-3 text-slate-600">{fmtMinutes(vagon.metricas?.operacionMin)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}

export default function TorreonArrastresPanel({ localidadId, variant = "dashboard" }: Props) {
  const [arrastres, setArrastres] = useState<Arrastre[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState<ArrastreStatus>("TODOS");
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  async function load(showRefresh = false) {
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
  }

  useEffect(() => {
    void load();
  }, [localidadId]);

  const todayKey = localDateKey(new Date());
  const dashboardArrastres = useMemo(() => (
    arrastres.filter((arrastre) => arrastreDateKey(arrastre) === todayKey)
  ), [arrastres, todayKey]);
  const metricRows = variant === "dashboard" ? dashboardArrastres : arrastres;
  const dailyCounters = useMemo(() => buildDailyCounters(arrastres), [arrastres]);

  const stats = useMemo(() => {
    const vagones = metricRows.flatMap((arrastre) => arrastre.vagones || []);
    const incidentes = metricRows.flatMap((arrastre) => arrastre.incidentes || []);
    return {
      total: metricRows.length,
      solicitados: metricRows.filter((item) => normalizeStatus(item.estado) === "SOLICITADO").length,
      proceso: metricRows.filter((item) => normalizeStatus(item.estado) === "EN_PROCESO").length,
      detenidos: metricRows.filter((item) => normalizeStatus(item.estado) === "DETENIDO").length,
      concluidos: metricRows.filter((item) => normalizeStatus(item.estado) === "CONCLUIDO").length,
      cancelados: metricRows.filter((item) => normalizeStatus(item.estado) === "CANCELADO").length,
      vagonesPendientes: vagones.filter((item) => ["PENDIENTE", "EN_PROCESO", "BLOQUEADO"].includes(normalizeStatus(item.estado))).length,
      incidentesAbiertos: incidentes.filter((item) => normalizeStatus(item.estado) === "ABIERTO").length,
    };
  }, [metricRows]);

  const visible = useMemo(() => (
    (variant === "dashboard" ? dashboardArrastres : arrastres)
      .filter((arrastre) => status === "TODOS" || normalizeStatus(arrastre.estado) === status)
      .filter((arrastre) => !dateFilter || arrastreDateKey(arrastre) === dateFilter)
      .filter((arrastre) => arrastreMatches(arrastre, search))
  ), [arrastres, dashboardArrastres, dateFilter, search, status, variant]);

  const dashboardRows = useMemo(() => (
    visible.filter((arrastre) => !isClosedStatus(arrastre.estado)).slice(0, 5)
  ), [visible]);

  const rows = variant === "dashboard" ? dashboardRows : visible;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-sm">
      <div className="border-b border-slate-200 bg-gradient-to-r from-white via-slate-50 to-white px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Torreon</p>
            <h2 className="mt-1 text-xl font-bold text-slate-950">
              {variant === "dashboard" ? "Arrastres de hoy" : "Arrastres"}
            </h2>
            {variant === "dashboard" && (
              <p className="mt-1 text-xs font-semibold capitalize text-slate-500">Operacion diaria · {fmtDateKey(todayKey)}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 shadow-sm">
              <Hash className="h-4 w-4 text-emerald-600" />
              {stats.total} movimiento{stats.total === 1 ? "" : "s"}
            </span>
            <button
              type="button"
              onClick={() => load(true)}
              disabled={refreshing}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-emerald-300 hover:text-emerald-700 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Actualizar
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        <div className="grid gap-3 md:grid-cols-3">
          <Metric
            label={variant === "dashboard" ? "Movimientos hoy" : "Movimientos"}
            value={stats.total}
            icon={CircleDot}
            tone="text-emerald-600"
            sub={variant === "dashboard" ? "Solo fecha operativa actual" : "Segun filtros activos"}
          />
          <Metric label="Vagones activos" value={stats.vagonesPendientes} icon={Boxes} sub="Pendientes, proceso o bloqueados" />
          <Metric label="Incidentes abiertos" value={stats.incidentesAbiertos} icon={AlertTriangle} tone="text-amber-600" sub="Bloquean operacion" />
        </div>

        <StatusStrip stats={stats} />

        {variant === "movimientos" && (
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setStatus(option.value)}
                  className={`h-10 rounded-lg border px-3 text-sm font-semibold transition ${
                    status === option.value
                      ? "border-slate-950 bg-slate-950 text-white shadow-sm"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="mt-3 grid gap-2 lg:grid-cols-[1fr_220px]">
              <label className="flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-500 shadow-sm">
                <Search className="h-4 w-4" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-slate-900 outline-none"
                  placeholder="Buscar arrastre, vagon, estado"
                />
              </label>
              <label className="flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-500 shadow-sm">
                <CalendarDays className="h-4 w-4" />
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(event) => setDateFilter(event.target.value)}
                  className="min-w-0 flex-1 bg-transparent font-semibold text-slate-700 outline-none"
                />
              </label>
            </div>
          </div>
        )}

        <div>
          {loading ? (
            <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-slate-200 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : rows.length ? (
            <div className="grid gap-3">
              {rows.map((arrastre) => (
                <ArrastreCard
                  key={arrastre.id}
                  arrastre={arrastre}
                  dailyInfo={dailyCounters.get(arrastre.id)}
                  compact={variant === "dashboard"}
                />
              ))}
            </div>
          ) : (
            <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm font-semibold text-slate-500">
              Sin arrastres para mostrar.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
