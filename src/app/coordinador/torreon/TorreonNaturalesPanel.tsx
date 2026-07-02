"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock3,
  Eye,
  ImageIcon,
  RefreshCw,
  Search,
  TrainFront,
  X,
} from "lucide-react";

type FotoMovimiento = {
  id?: number | null;
  tipo: string;
  orden: number;
  url: string;
  comentario?: string | null;
  tomadaAt?: string | null;
};

type MovimientoNatural = {
  id: number | string;
  empresaNombre?: string | null;
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
  incidentes?: unknown[];
};

type Props = {
  localidadId: number;
};

type StatusTab = "activos" | "concluidos" | "todos";

const STATUS_TABS: Array<{ value: StatusTab; label: string }> = [
  { value: "activos", label: "Activos" },
  { value: "concluidos", label: "Concluidos" },
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

function statusClass(status: string) {
  if (status === "CONCLUIDO") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "EN_PROCESO") return "border-sky-200 bg-sky-50 text-sky-700";
  if (status === "DETENIDO" || status === "BLOQUEADO") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "CANCELADO") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

export default function TorreonNaturalesPanel({ localidadId }: Props) {
  const [status, setStatus] = useState<StatusTab>("activos");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<MovimientoNatural[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<MovimientoNatural | null>(null);

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

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      [
        row.id,
        row.empresaNombre,
        row.locomotiveNumber,
        row.estado,
        row.viaOrigen,
        row.viaDestino,
        row.tipoMovimiento,
      ]
        .map((value) => String(value ?? "").toLowerCase())
        .some((value) => value.includes(q))
    );
  }, [rows, search]);

  const metrics = useMemo(() => {
    const active = rows.filter((row) => !["CONCLUIDO", "CANCELADO"].includes(normalizeStatus(row.estado))).length;
    const process = rows.filter((row) => normalizeStatus(row.estado) === "EN_PROCESO").length;
    const done = rows.filter((row) => normalizeStatus(row.estado) === "CONCLUIDO").length;
    const withPhotos = rows.filter((row) => (row.fotos || []).length > 0).length;
    return { active, process, done, withPhotos };
  }, [rows]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <TrainFront className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Naturales</p>
            <h2 className="text-xl font-bold text-slate-950">Movimientos del patio</h2>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar ID, empresa, via..."
              className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm font-semibold text-slate-700 outline-none focus:border-emerald-500 sm:w-72"
            />
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Activos" value={metrics.active} icon={Clock3} />
        <Metric label="En proceso" value={metrics.process} icon={TrainFront} />
        <Metric label="Concluidos" value={metrics.done} icon={CheckCircle2} />
        <Metric label="Con evidencias" value={metrics.withPhotos} icon={Camera} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2 rounded-xl bg-slate-100 p-1">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setStatus(tab.value)}
            className={`inline-flex h-9 flex-1 items-center justify-center rounded-lg px-3 text-sm font-bold transition sm:flex-none ${
              status === tab.value
                ? "bg-white text-slate-950 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
        <div className="hidden grid-cols-[90px_1fr_120px_1fr_1fr_120px_120px] bg-slate-900 px-3 py-3 text-xs font-bold uppercase tracking-wide text-white lg:grid">
          <div>ID</div>
          <div>Empresa</div>
          <div>Loco</div>
          <div>Origen</div>
          <div>Destino</div>
          <div>Estado</div>
          <div className="text-right">Imagenes</div>
        </div>

        {loading ? (
          <div className="p-6 text-center text-sm font-semibold text-slate-500">Cargando movimientos...</div>
        ) : error ? (
          <div className="flex items-center justify-center gap-2 p-6 text-sm font-semibold text-rose-600">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="p-6 text-center text-sm font-semibold text-slate-500">Sin movimientos para mostrar.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredRows.map((row) => {
              const state = normalizeStatus(row.estado);
              const fotosCount = (row.fotos || []).length;
              return (
                <div
                  key={String(row.id)}
                  className="grid gap-3 px-3 py-4 text-sm lg:grid-cols-[90px_1fr_120px_1fr_1fr_120px_120px] lg:items-center"
                >
                  <div className="font-black text-slate-950">#{row.id}</div>
                  <div>
                    <p className="font-bold text-slate-800">{row.empresaNombre || "Empresa"}</p>
                    <p className="text-xs text-slate-500">{formatDate(row.fechaSolicitud)}</p>
                  </div>
                  <div className="font-bold text-slate-700">{row.locomotiveNumber || "--"}</div>
                  <div className="text-slate-600">{row.viaOrigen || "--"}</div>
                  <div className="text-slate-600">{row.viaDestino || "--"}</div>
                  <div>
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${statusClass(state)}`}>
                      {state.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="flex justify-start lg:justify-end">
                    <button
                      type="button"
                      onClick={() => setSelected(row)}
                      className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
                    >
                      <Eye className="h-4 w-4" />
                      Ver {fotosCount ? `(${fotosCount})` : ""}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selected && <FotosModal movimiento={selected} onClose={() => setSelected(null)} />}
    </section>
  );
}

function Metric({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Clock3 }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-black text-slate-950">{value}</p>
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
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-4">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Evidencias naturales</p>
            <h3 className="mt-1 text-xl font-black text-slate-950">Movimiento #{movimiento.id}</h3>
            <p className="mt-1 text-sm text-slate-500">
              Loco {movimiento.locomotiveNumber || "--"} · {movimiento.viaOrigen || "--"} a {movimiento.viaDestino || "--"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            aria-label="Cerrar visor de imagenes"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {totalFotos === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 text-slate-500">
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
                      <h4 className="text-sm font-black uppercase tracking-wide text-slate-700">{stage.label}</h4>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">
                        {fotos.length}/2
                      </span>
                    </div>
                    {fotos.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm font-semibold text-slate-400">
                        Sin capturas en esta etapa.
                      </div>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {fotos.map((foto) => (
                          <figure key={`${stage.key}-${foto.id ?? foto.orden}`} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                            <img src={foto.url} alt={`${stage.label} ${foto.orden}`} className="h-64 w-full object-contain bg-slate-950" />
                            <figcaption className="space-y-1 p-3 text-xs text-slate-500">
                              <p className="font-bold text-slate-700">Captura {foto.orden}</p>
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
