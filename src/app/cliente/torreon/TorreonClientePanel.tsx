"use client";

import { type ChangeEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Ban,
  Boxes,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clock3,
  FileClock,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  Search,
  Pencil,
  TrainFront,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { DynamicBanner } from "@/app/Components/DynamicBanner";
import { canViewTorreonArrastreRole, normalizeRoleName } from "@/lib/torreonLocalidad";

export type TorreonPanelView = "dashboard" | "movimientos" | "crear" | "incidentes";
type Ambito = "actuales" | "pasados";
type CargaVagon = "VACIO" | "LLENO";
type ActionPayload = {
  action: "CREAR_INCIDENTE" | "RESOLVER_INCIDENTE" | "CANCELAR";
  arrastreId: number;
  vagonId?: number;
  incidenteId?: number;
  motivo?: string;
  solucion?: string;
  fotos?: Array<{ dataUrl: string; tomadaPorId?: number }>;
};

type VagonArrastre = {
  id: number;
  orden: number;
  numeroVagon?: string | null;
  carga: CargaVagon | string;
  estado: string;
  viaId: number;
  seccionId: number;
  fechaSolicitud?: string | null;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  metricas?: {
    esperaMin?: number;
    operacionMin?: number;
    solicitudTotalMin?: number;
  };
};

type IncidenteArrastre = {
  id: number;
  estado: string;
  motivo?: string | null;
  solucion?: string | null;
  vagonId?: number | null;
  fechaInicio?: string | null;
  fechaResolucion?: string | null;
};

type Arrastre = {
  id: number;
  estado: string;
  empresaId: number;
  fechaSolicitud?: string | null;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  instrucciones?: string | null;
  vagones?: VagonArrastre[];
  resumen?: {
    totalVagones?: number;
    pendientes?: number;
    enProceso?: number;
    bloqueados?: number;
    concluidos?: number;
    solicitudTotalMin?: number;
    operacionTotalMin?: number;
    vagonActivoId?: number;
    siguienteVagonSugeridoId?: number;
  };
  incidentes?: IncidenteArrastre[];
};

type VagonDraft = {
  tempId: number;
  numeroVagon: string;
  carga: CargaVagon;
  viaId: string;
  seccionId: string;
};

type FotoDraft = {
  name: string;
  dataUrl: string;
};

type IncidentDraft = {
  motivo: string;
  vagonId: string;
  fotos: FotoDraft[];
  solucion: string;
};

type EditVagonDraft = {
  arrastreId: number;
  vagonId: number;
  numeroVagon: string;
  carga: CargaVagon;
  viaId: string;
  seccionId: string;
};

type TorreonClientePanelProps = {
  localidadId: number;
  empresaId: number | null;
  role: string;
  view?: TorreonPanelView;
};

const emptyIncidentDraft: IncidentDraft = {
  motivo: "",
  vagonId: "",
  fotos: [],
  solucion: "",
};

const makeVagonDraft = (tempId: number): VagonDraft => ({
  tempId,
  numeroVagon: "",
  carga: "VACIO",
  viaId: "",
  seccionId: "",
});

const fmtDate = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const fmtFullDate = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const dateKey = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

function buildDailyCounters(rows: Arrastre[]) {
  const grouped = new Map<string, Arrastre[]>();
  rows.forEach((arrastre) => {
    const key = dateKey(arrastre.fechaSolicitud || arrastre.fechaInicio);
    if (!key) return;
    grouped.set(key, [...(grouped.get(key) || []), arrastre]);
  });

  const counters = new Map<number, { index: number; total: number; date: string }>();
  grouped.forEach((items, date) => {
    const ordered = [...items].sort((a, b) => {
      const aTime = Date.parse(String(a.fechaSolicitud || a.fechaInicio || "")) || 0;
      const bTime = Date.parse(String(b.fechaSolicitud || b.fechaInicio || "")) || 0;
      return aTime - bTime || a.id - b.id;
    });
    ordered.forEach((arrastre, index) => {
      counters.set(arrastre.id, { index: index + 1, total: ordered.length, date });
    });
  });
  return counters;
}

const fmtMinutes = (value?: number | null) => {
  if (value == null || !Number.isFinite(value)) return "-";
  if (value < 60) return `${Math.round(value)} min`;
  const hours = Math.floor(value / 60);
  const minutes = Math.round(value % 60);
  return `${hours}h ${minutes}m`;
};

const normalizeArray = <T,>(value: unknown): T[] => {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object") {
    const record = value as { data?: unknown; items?: unknown; rows?: unknown };
    if (Array.isArray(record.data)) return record.data as T[];
    if (Array.isArray(record.items)) return record.items as T[];
    if (Array.isArray(record.rows)) return record.rows as T[];
  }
  return [];
};

const statusText = (estado?: string | null) => String(estado || "SIN_ESTADO").toUpperCase();
const isClosed = (estado?: string | null) => ["CONCLUIDO", "CANCELADO"].includes(statusText(estado));
const displayStatus = (estado?: string | null) => statusText(estado).replaceAll("_", " ");

function arrastreMatchesSearch(arrastre: Arrastre, query: string) {
  const text = query.trim().toLowerCase();
  if (!text) return true;

  const haystack = [
    arrastre.id,
    arrastre.estado,
    arrastre.instrucciones,
    arrastre.fechaSolicitud,
    ...(arrastre.vagones || []).flatMap((vagon) => [
      vagon.numeroVagon,
      vagon.carga,
      vagon.estado,
      vagon.viaId,
      vagon.seccionId,
    ]),
  ]
    .filter((item) => item != null)
    .join(" ")
    .toLowerCase();

  return haystack.includes(text);
}

function EstadoBadge({ estado }: { estado?: string | null }) {
  const normalized = statusText(estado);
  const tone = normalized.includes("BLOQUEADO") || normalized.includes("DETENIDO")
    ? "border-amber-300 bg-amber-50 text-amber-800"
    : normalized.includes("CONCLUIDO")
      ? "border-emerald-300 bg-emerald-50 text-emerald-800"
      : normalized.includes("CANCELADO")
        ? "border-rose-300 bg-rose-50 text-rose-800"
        : "border-slate-300 bg-white text-slate-700";

  return (
    <span className={`inline-flex min-w-[92px] justify-center rounded-md border px-2 py-1 text-xs font-semibold ${tone}`}>
      {normalized.replaceAll("_", " ")}
    </span>
  );
}

function Metric({ icon: Icon, label, value, sub }: { icon: LucideIcon; label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
        <Icon className="h-4 w-4 text-emerald-600" />
      </div>
      <div className="mt-2 text-2xl font-semibold text-slate-950">{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

function fieldClass() {
  return "h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20";
}

function getOpenIncident(arrastre: Arrastre) {
  return (arrastre.incidentes || []).find((incidente) => statusText(incidente.estado) === "ABIERTO");
}

async function readFilesAsDataUrls(files: FileList | null): Promise<FotoDraft[]> {
  const selected = Array.from(files || []).slice(0, 4);
  return Promise.all(
    selected.map((file) => new Promise<FotoDraft>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ name: file.name, dataUrl: String(reader.result || "") });
      reader.onerror = () => reject(new Error(`No se pudo leer ${file.name}`));
      reader.readAsDataURL(file);
    }))
  );
}

function parseErrorMessage(input: unknown, fallback: string) {
  if (input && typeof input === "object" && "error" in input) {
    return String((input as { error?: unknown }).error || fallback);
  }
  return fallback;
}

function Header({
  title,
  subtitle,
  refreshing,
  onRefresh,
  action,
}: {
  title: string;
  subtitle: string;
  refreshing: boolean;
  onRefresh: () => void;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{subtitle}</p>
        <h1 className="text-2xl font-semibold text-slate-950">{title}</h1>
      </div>
      <div className="flex flex-wrap gap-2">
        {action}
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Actualizar
        </button>
      </div>
    </div>
  );
}

function ModuleHeader({
  title,
  chip,
  total,
  icon: Icon,
}: {
  title: string;
  chip?: string;
  total: number;
  icon: LucideIcon;
}) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between min-w-0">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/30">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-base sm:text-2xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
            {title}
          </h1>
          <p className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
            Gestion ferroviaria
            {chip && (
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                {chip}
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 rounded-xl bg-slate-50 px-3 py-1.5 text-xs">
        <span className="font-bold tabular-nums text-emerald-600">{total}</span>
        <span className="text-slate-500">registro{total === 1 ? "" : "s"}</span>
      </div>
    </header>
  );
}

function MovimientoToolbar({
  ambito,
  search,
  dateFilter,
  refreshing,
  actuales,
  pasados,
  onAmbito,
  onSearch,
  onDateFilter,
  onRefresh,
  onNuevo,
}: {
  ambito: Ambito;
  search: string;
  dateFilter: string;
  refreshing: boolean;
  actuales: number;
  pasados: number;
  onAmbito: (ambito: Ambito) => void;
  onSearch: (value: string) => void;
  onDateFilter: (value: string) => void;
  onRefresh: () => void;
  onNuevo: () => void;
}) {
  return (
    <section className="space-y-3 rounded-xl sm:rounded-2xl border border-slate-100 bg-gradient-to-b from-slate-50/80 to-white px-2 py-2 shadow-sm sm:px-4 sm:py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative inline-flex w-full rounded-xl bg-slate-100/80 p-1 shadow-inner sm:w-auto sm:rounded-2xl">
          <div
            className="absolute bottom-1 top-1 rounded-xl bg-white shadow-md transition-all duration-300"
            style={{ left: ambito === "actuales" ? "4px" : "50%", width: "calc(50% - 4px)" }}
          />
          {(["actuales", "pasados"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onAmbito(item)}
              className={`relative z-10 flex-1 rounded-xl px-5 py-2 text-sm font-semibold transition sm:flex-none ${
                ambito === item ? "text-emerald-700" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <span className="inline-flex items-center gap-2">
                {item === "actuales" ? "Actuales" : "Pasados"}
                <span className="inline-flex h-5 min-w-[1.5rem] items-center justify-center rounded-full bg-slate-100 px-2 text-[10px] font-bold tabular-nums">
                  {item === "actuales" ? actuales : pasados}
                </span>
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between gap-2 sm:justify-end">
          <button
            type="button"
            title="Actualizar"
            onClick={onRefresh}
            disabled={refreshing}
            className="inline-flex min-h-[38px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-emerald-400 hover:text-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">{refreshing ? "Actualizando..." : "Actualizar"}</span>
          </button>

          <button
            type="button"
            onClick={onNuevo}
            className="inline-flex min-h-[38px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-emerald-500/25 transition hover:from-emerald-600 hover:to-emerald-700"
          >
            <Plus className="h-4 w-4" />
            Nuevo
          </button>
        </div>
      </div>

      <div className="grid gap-2 lg:grid-cols-[1fr_210px]">
        <div className="relative">
          <input
            type="search"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Buscar por arrastre, vagon, estado, via..."
            className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white/90 py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/30"
          />
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        </div>
        <label className="relative">
          <CalendarDays className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="date"
            value={dateFilter}
            onChange={(event) => onDateFilter(event.target.value)}
            className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white/90 py-2.5 pl-10 pr-3 text-sm font-semibold text-slate-700 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/30"
          />
        </label>
      </div>
    </section>
  );
}

function EmptyState({ text, hint }: { text: string; hint?: string }) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-xl border border-slate-100 bg-white py-10 text-center">
      <div className="rounded-2xl border-2 border-dashed border-slate-200 p-6">
        <TrainFront className="h-12 w-12 text-slate-300" strokeWidth={1.5} />
      </div>
      <p className="text-sm font-semibold text-slate-500">{text}</p>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function ArrastreCard({
  arrastre,
  dailyInfo,
  readOnly,
  busyAction,
  draft,
  onDraftChange,
  onFiles,
  onAction,
  onEditVagon,
  onCancel,
}: {
  arrastre: Arrastre;
  dailyInfo?: { index: number; total: number; date: string };
  readOnly?: boolean;
  busyAction: string | null;
  draft: IncidentDraft;
  onDraftChange: (draft: IncidentDraft) => void;
  onFiles: (event: ChangeEvent<HTMLInputElement>) => void;
  onAction: (payload: ActionPayload) => void;
  onEditVagon: (arrastre: Arrastre, vagon: VagonArrastre) => void;
  onCancel: (arrastre: Arrastre) => void;
}) {
  const incidenteAbierto = getOpenIncident(arrastre);
  const [expanded, setExpanded] = useState(false);
  const vagones = arrastre.vagones || [];
  const hasVagonEnProceso = vagones.some((vagon) => statusText(vagon.estado) === "EN_PROCESO");
  const canCancel = !readOnly && !hasVagonEnProceso;
  const dailyLabel = dailyInfo ? `Arrastre ${dailyInfo.index} de ${dailyInfo.total}` : `Arrastre`;

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="flex min-w-0 flex-1 items-start gap-3 text-left"
        >
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-slate-500 shadow-sm ring-1 ring-slate-200">
            {expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                {fmtFullDate(arrastre.fechaSolicitud)}
              </span>
              <EstadoBadge estado={arrastre.estado} />
              {incidenteAbierto && (
                <span className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Incidente abierto
                </span>
              )}
            </div>
            <h2 className="mt-1 text-xl font-black text-slate-950">
              {dailyLabel}
              <span className="ml-2 text-sm font-semibold text-slate-400">ID #{arrastre.id}</span>
            </h2>
            <div className="mt-2 flex flex-wrap gap-3 text-xs font-semibold text-slate-500">
              <span>Total {arrastre.resumen?.totalVagones ?? vagones.length} vagones</span>
              <span>Tiempo {fmtMinutes(arrastre.resumen?.solicitudTotalMin)}</span>
              <span>Operacion {fmtMinutes(arrastre.resumen?.operacionTotalMin)}</span>
            </div>
            {arrastre.instrucciones && (
              <p className="mt-2 max-w-4xl truncate text-sm text-slate-600">{arrastre.instrucciones}</p>
            )}
          </div>
        </button>

        <div className="flex flex-wrap gap-2 lg:justify-end">
          {!readOnly && (
            <button
              type="button"
              onClick={() => onCancel(arrastre)}
              disabled={!canCancel || busyAction === `${arrastre.id}:CANCELAR`}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-3 text-sm font-bold text-rose-600 shadow-sm transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
              title={hasVagonEnProceso ? "No se puede cancelar con vagon en proceso" : "Cancelar arrastre"}
            >
              {busyAction === `${arrastre.id}:CANCELAR` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
              Cancelar
            </button>
          )}
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 shadow-sm"
          >
            {expanded ? "Ocultar" : "Ver detalle"}
          </button>
        </div>
      </div>

      {!expanded ? (
        <div className="grid gap-2 px-4 py-3 text-xs font-semibold text-slate-500 sm:grid-cols-4">
          <span>Pendientes {(arrastre.vagones || []).filter((vagon) => statusText(vagon.estado) === "PENDIENTE").length}</span>
          <span>Proceso {(arrastre.vagones || []).filter((vagon) => statusText(vagon.estado) === "EN_PROCESO").length}</span>
          <span>Bloqueados {(arrastre.vagones || []).filter((vagon) => statusText(vagon.estado) === "BLOQUEADO").length}</span>
          <span>Concluidos {(arrastre.vagones || []).filter((vagon) => statusText(vagon.estado) === "CONCLUIDO").length}</span>
        </div>
      ) : (
        <div className="px-4 py-4">
          <div className="overflow-x-auto">
            <table className="min-w-[920px] w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2 pr-3">Vagon</th>
                  <th className="py-2 pr-3">Carga</th>
                  <th className="py-2 pr-3">Zona</th>
                  <th className="py-2 pr-3">Estado</th>
                  <th className="py-2 pr-3">Inicio</th>
                  <th className="py-2 pr-3">Fin</th>
                  <th className="py-2 pr-3">Operacion</th>
                  {!readOnly && <th className="py-2 pr-3">Accion</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vagones.map((vagon) => {
                  const estado = statusText(vagon.estado);
                  const editKey = `edit:${arrastre.id}:${vagon.id}`;
                  const isBusy = busyAction === editKey;
                  const canEditVagon = estado !== "EN_PROCESO";

                  return (
                    <tr key={vagon.id}>
                      <td className="py-2 pr-3 font-medium text-slate-900">{vagon.numeroVagon || `#${vagon.orden}`}</td>
                      <td className="py-2 pr-3 text-slate-700">{vagon.carga}</td>
                      <td className="py-2 pr-3 text-slate-700">Via {vagon.viaId} / Seccion {vagon.seccionId}</td>
                      <td className="py-2 pr-3"><EstadoBadge estado={vagon.estado} /></td>
                      <td className="py-2 pr-3 text-slate-600">{fmtDate(vagon.fechaInicio)}</td>
                      <td className="py-2 pr-3 text-slate-600">{fmtDate(vagon.fechaFin)}</td>
                      <td className="py-2 pr-3 text-slate-600">{fmtMinutes(vagon.metricas?.operacionMin)}</td>
                      {!readOnly && (
                        <td className="py-2 pr-3">
                          {canEditVagon ? (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => onEditVagon(arrastre, vagon)}
                              className="inline-flex h-9 min-w-[92px] items-center justify-center gap-1 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Pencil className="h-3.5 w-3.5" />Editar</>}
                            </button>
                          ) : (
                            <span className="text-xs font-semibold text-slate-500">En proceso</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!readOnly && (
            <div className="mt-4 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
              {incidenteAbierto ? (
                <>
                  <div className="lg:col-span-2">
                    <p className="text-xs font-semibold uppercase text-amber-700">Incidente abierto</p>
                    <p className="mt-1 text-sm text-slate-700">{incidenteAbierto.motivo || "Sin motivo capturado"}</p>
                  </div>
                  <div className="flex min-w-[240px] flex-col gap-2">
                    <input
                      value={draft.solucion}
                      onChange={(event) => onDraftChange({ ...draft, solucion: event.target.value })}
                      className={fieldClass()}
                      placeholder="Resolucion"
                    />
                    <button
                      type="button"
                      disabled={busyAction === `incidente:${arrastre.id}` || draft.solucion.trim().length < 3}
                      onClick={() => onAction({
                        action: "RESOLVER_INCIDENTE",
                        arrastreId: arrastre.id,
                        incidenteId: incidenteAbierto.id,
                        solucion: draft.solucion,
                      })}
                      className="inline-flex h-10 items-center justify-center rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busyAction === `incidente:${arrastre.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : "Resolver y reanudar"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">Incidente</label>
                    <input
                      value={draft.motivo}
                      onChange={(event) => onDraftChange({ ...draft, motivo: event.target.value })}
                      className={fieldClass()}
                      placeholder="Motivo"
                    />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[180px_1fr]">
                    <select
                      value={draft.vagonId}
                      onChange={(event) => onDraftChange({ ...draft, vagonId: event.target.value })}
                      className={fieldClass()}
                    >
                      <option value="">Zona general</option>
                      {vagones.map((vagon) => (
                        <option key={vagon.id} value={vagon.id}>
                          {vagon.numeroVagon || `Vagon ${vagon.orden}`}
                        </option>
                      ))}
                    </select>
                    <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700">
                      <Upload className="h-4 w-4" />
                      4 fotos ({draft.fotos.length}/4)
                      <input type="file" accept="image/*" multiple className="hidden" onChange={onFiles} />
                    </label>
                  </div>
                  <button
                    type="button"
                    disabled={busyAction === `incidente:${arrastre.id}` || draft.motivo.trim().length < 3 || draft.fotos.length !== 4}
                    onClick={() => onAction({
                      action: "CREAR_INCIDENTE",
                      arrastreId: arrastre.id,
                      vagonId: draft.vagonId ? Number(draft.vagonId) : undefined,
                      motivo: draft.motivo,
                      fotos: draft.fotos.map((foto) => ({ dataUrl: foto.dataUrl })),
                    })}
                    className="inline-flex h-10 items-center justify-center rounded-lg bg-amber-600 px-3 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busyAction === `incidente:${arrastre.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : "Detener por incidente"}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function EditVagonModal({
  draft,
  busy,
  onChange,
  onClose,
  onSubmit,
}: {
  draft: EditVagonDraft;
  busy: boolean;
  onChange: (patch: Partial<EditVagonDraft>) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-3 py-6">
      <div className="w-full max-w-2xl rounded-lg border border-slate-200 bg-white p-4 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Arrastre #{draft.arrastreId}</p>
            <h2 className="mt-1 text-lg font-bold text-slate-950">Editar vagon</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 disabled:opacity-50"
          >
            Cerrar
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Numero</label>
            <input
              value={draft.numeroVagon}
              onChange={(event) => onChange({ numeroVagon: event.target.value })}
              className={fieldClass()}
              placeholder="Numero de vagon"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Carga</label>
            <select
              value={draft.carga}
              onChange={(event) => onChange({ carga: event.target.value as CargaVagon })}
              className={fieldClass()}
            >
              <option value="VACIO">Vacio</option>
              <option value="LLENO">Lleno</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Via</label>
            <input
              value={draft.viaId}
              onChange={(event) => onChange({ viaId: event.target.value })}
              className={fieldClass()}
              inputMode="numeric"
              placeholder="Via"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Seccion</label>
            <input
              value={draft.seccionId}
              onChange={(event) => onChange({ seccionId: event.target.value })}
              className={fieldClass()}
              inputMode="numeric"
              placeholder="Seccion"
            />
          </div>
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={busy}
            className="inline-flex h-10 min-w-[150px] items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TorreonClientePanel({ localidadId, role, view = "dashboard" }: TorreonClientePanelProps) {
  const router = useRouter();
  const normalizedRole = normalizeRoleName(role);
  const arrastreOnly = normalizedRole === "ARRASTRE_TORREON";
  const canViewArrastres = canViewTorreonArrastreRole(role);

  const [arrastres, setArrastres] = useState<Arrastre[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [instrucciones, setInstrucciones] = useState("");
  const [draftVagones, setDraftVagones] = useState<VagonDraft[]>([makeVagonDraft(1)]);
  const [incidentDrafts, setIncidentDrafts] = useState<Record<number, IncidentDraft>>({});
  const [ambito, setAmbito] = useState<Ambito>("actuales");
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [editingVagon, setEditingVagon] = useState<EditVagonDraft | null>(null);

  async function load(showRefresh = false) {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const data = canViewArrastres
        ? await fetch(`/api/cliente/torreon/arrastres?localidadId=${localidadId}`, {
            cache: "no-store",
            credentials: "include",
          }).then((response) => response.json()).catch(() => [])
        : [];

      setArrastres(normalizeArray<Arrastre>(data));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();
  }, [localidadId, canViewArrastres]);

  const orderedArrastres = useMemo(() => (
    [...arrastres].sort((a, b) => {
      const aTime = Date.parse(String(a.fechaSolicitud || a.fechaInicio || "")) || 0;
      const bTime = Date.parse(String(b.fechaSolicitud || b.fechaInicio || "")) || 0;
      return bTime - aTime;
    })
  ), [arrastres]);

  const activeArrastres = useMemo(() => orderedArrastres.filter((arrastre) => !isClosed(arrastre.estado)), [orderedArrastres]);
  const pastArrastres = useMemo(() => orderedArrastres.filter((arrastre) => isClosed(arrastre.estado)), [orderedArrastres]);
  const dailyCounters = useMemo(() => buildDailyCounters(orderedArrastres), [orderedArrastres]);
  const visibleArrastres = useMemo(() => (
    (ambito === "actuales" ? activeArrastres : pastArrastres)
      .filter((arrastre) => !dateFilter || dateKey(arrastre.fechaSolicitud || arrastre.fechaInicio) === dateFilter)
      .filter((arrastre) => arrastreMatchesSearch(arrastre, search))
  ), [activeArrastres, ambito, dateFilter, pastArrastres, search]);
  const incidentRows = useMemo(() => (
    orderedArrastres
      .flatMap((arrastre) => (arrastre.incidentes || []).map((incidente) => {
        const vagon = (arrastre.vagones || []).find((item) => item.id === incidente.vagonId);
        return {
          arrastre,
          incidente,
          vagon,
          dailyInfo: dailyCounters.get(arrastre.id),
        };
      }))
      .filter(({ arrastre, incidente, vagon }) => {
        const incidentDate = incidente.fechaInicio || arrastre.fechaSolicitud || arrastre.fechaInicio;
        if (dateFilter && dateKey(incidentDate) !== dateFilter) return false;

        const query = search.trim().toLowerCase();
        if (!query) return true;

        return [
          arrastre.id,
          incidente.id,
          incidente.estado,
          incidente.motivo,
          incidente.solucion,
          vagon?.numeroVagon,
          vagon?.viaId,
          vagon?.seccionId,
          arrastre.instrucciones,
        ]
          .filter((item) => item != null)
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
  ), [dailyCounters, dateFilter, orderedArrastres, search]);
  const nextVagones = useMemo(() => (
    activeArrastres.flatMap((arrastre) => (arrastre.vagones || [])
      .filter((vagon) => statusText(vagon.estado) !== "CONCLUIDO")
      .map((vagon) => ({ arrastre, vagon })))
      .slice(0, 10)
  ), [activeArrastres]);

  const stats = useMemo(() => {
    const vagones = arrastres.flatMap((arrastre) => arrastre.vagones || []);
    return {
      total: arrastres.length,
      solicitados: arrastres.filter((item) => statusText(item.estado) === "SOLICITADO").length,
      proceso: arrastres.filter((item) => statusText(item.estado) === "EN_PROCESO").length,
      detenidos: arrastres.filter((item) => statusText(item.estado) === "DETENIDO").length,
      concluidos: arrastres.filter((item) => statusText(item.estado) === "CONCLUIDO").length,
      pendientesVagon: vagones.filter((item) => ["PENDIENTE", "EN_PROCESO", "BLOQUEADO"].includes(statusText(item.estado))).length,
    };
  }, [arrastres]);

  const draftCapacity = useMemo(() => (
    draftVagones.reduce((total, vagon) => total + (vagon.carga === "LLENO" ? 2 : 1), 0)
  ), [draftVagones]);

  function setIncidentDraft(arrastreId: number, draft: IncidentDraft) {
    setIncidentDrafts((prev) => ({ ...prev, [arrastreId]: draft }));
  }

  function updateDraftVagon(tempId: number, patch: Partial<VagonDraft>) {
    setDraftVagones((prev) => prev.map((vagon) => vagon.tempId === tempId ? { ...vagon, ...patch } : vagon));
  }

  function addDraftVagon() {
    setDraftVagones((prev) => {
      if (prev.length >= 8) return prev;
      const nextId = Math.max(0, ...prev.map((vagon) => vagon.tempId)) + 1;
      return [...prev, makeVagonDraft(nextId)];
    });
  }

  function removeDraftVagon(tempId: number) {
    setDraftVagones((prev) => prev.length === 1 ? prev : prev.filter((vagon) => vagon.tempId !== tempId));
  }

  function openEditVagon(arrastre: Arrastre, vagon: VagonArrastre) {
    const estado = statusText(vagon.estado);
    if (estado === "EN_PROCESO") {
      setMessage({ type: "error", text: "No se puede editar un vagon en proceso" });
      return;
    }

    setEditingVagon({
      arrastreId: arrastre.id,
      vagonId: vagon.id,
      numeroVagon: vagon.numeroVagon || "",
      carga: statusText(vagon.carga) === "LLENO" ? "LLENO" : "VACIO",
      viaId: String(vagon.viaId),
      seccionId: String(vagon.seccionId),
    });
  }

  function updateEditingVagon(patch: Partial<EditVagonDraft>) {
    setEditingVagon((current) => current ? { ...current, ...patch } : current);
  }

  async function submitVagonEdit() {
    if (!editingVagon) return;
    setMessage(null);

    const viaId = Number(editingVagon.viaId);
    const seccionId = Number(editingVagon.seccionId);
    if (!Number.isFinite(viaId) || viaId <= 0 || !Number.isFinite(seccionId) || seccionId <= 0) {
      setMessage({ type: "error", text: "Via y seccion deben ser validas" });
      return;
    }

    const arrastre = arrastres.find((item) => item.id === editingVagon.arrastreId);
    const capacidad = arrastre?.vagones?.reduce((total, vagon) => {
      const carga = vagon.id === editingVagon.vagonId ? editingVagon.carga : statusText(vagon.carga);
      return total + (carga === "LLENO" ? 2 : 1);
    }, 0) ?? 0;
    if (capacidad > 8) {
      setMessage({ type: "error", text: "Capacidad excedida: lleno cuenta 2, vacio cuenta 1, maximo 8" });
      return;
    }

    const actionKey = `edit:${editingVagon.arrastreId}:${editingVagon.vagonId}`;
    setBusyAction(actionKey);

    try {
      const response = await fetch("/api/cliente/torreon/arrastres/action", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "EDITAR_VAGON",
          arrastreId: editingVagon.arrastreId,
          vagonId: editingVagon.vagonId,
          numeroVagon: editingVagon.numeroVagon.trim() || undefined,
          carga: editingVagon.carga,
          viaId,
          seccionId,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(parseErrorMessage(data, "No se pudo editar el vagon"));

      setEditingVagon(null);
      setMessage({ type: "ok", text: "Vagon actualizado" });
      await load(true);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "No se pudo editar el vagon" });
    } finally {
      setBusyAction(null);
    }
  }

  async function submitArrastre() {
    setMessage(null);

    const vagones = draftVagones.map((vagon) => ({
      numeroVagon: vagon.numeroVagon.trim() || undefined,
      carga: vagon.carga,
      viaId: Number(vagon.viaId),
      seccionId: Number(vagon.seccionId),
    }));

    if (vagones.some((vagon) => !Number.isFinite(vagon.viaId) || vagon.viaId <= 0 || !Number.isFinite(vagon.seccionId) || vagon.seccionId <= 0)) {
      setMessage({ type: "error", text: "Cada vagon necesita via y seccion" });
      return;
    }

    const capacidad = vagones.reduce((total, vagon) => total + (vagon.carga === "LLENO" ? 2 : 1), 0);
    if (capacidad > 8) {
      setMessage({ type: "error", text: "Capacidad excedida: lleno cuenta 2, vacio cuenta 1, maximo 8" });
      return;
    }

    setBusyAction("crear");
    try {
      const response = await fetch("/api/cliente/torreon/arrastres", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          localidadId,
          instrucciones,
          vagones,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(parseErrorMessage(data, "No se pudo crear el arrastre"));

      setInstrucciones("");
      setDraftVagones([makeVagonDraft(1)]);
      setMessage({ type: "ok", text: "Arrastre creado" });
      router.push("/cliente/torreon/movimientos");
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "No se pudo crear el arrastre" });
    } finally {
      setBusyAction(null);
    }
  }

  async function runAction(payload: ActionPayload) {
    setMessage(null);
    const actionKey = payload.action.includes("INCIDENTE")
      ? `incidente:${payload.arrastreId}`
      : `${payload.arrastreId}:${payload.vagonId ?? payload.action}`;
    setBusyAction(actionKey);

    try {
      const response = await fetch("/api/cliente/torreon/arrastres/action", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(parseErrorMessage(data, "No se pudo operar el arrastre"));

      setIncidentDrafts((prev) => {
        const next = { ...prev };
        delete next[payload.arrastreId];
        return next;
      });
      setMessage({ type: "ok", text: "Operacion aplicada" });
      await load(true);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "No se pudo operar el arrastre" });
    } finally {
      setBusyAction(null);
    }
  }

  async function cancelArrastre(arrastre: Arrastre) {
    const motivo = window.prompt(`Motivo para cancelar el arrastre ID #${arrastre.id}`, "");
    if (motivo === null) return;
    await runAction({
      action: "CANCELAR",
      arrastreId: arrastre.id,
      motivo: motivo.trim() || undefined,
    });
  }

  async function handleIncidentFiles(arrastreId: number, event: ChangeEvent<HTMLInputElement>) {
    try {
      const fotos = await readFilesAsDataUrls(event.target.files);
      const current = incidentDrafts[arrastreId] || emptyIncidentDraft;
      setIncidentDraft(arrastreId, { ...current, fotos });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "No se pudieron leer las fotos" });
    } finally {
      event.target.value = "";
    }
  }

  if (arrastreOnly && !canViewArrastres) {
    return null;
  }

  const metricGrid = (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <Metric icon={FileClock} label="Solicitados" value={stats.solicitados} />
      <Metric icon={Play} label="En proceso" value={stats.proceso} />
      <Metric icon={AlertTriangle} label="Detenidos" value={stats.detenidos} />
      <Metric icon={CheckCircle2} label="Concluidos" value={stats.concluidos} />
      <Metric icon={Boxes} label="Vagones por mover" value={stats.pendientesVagon} />
    </div>
  );

  const feedback = message && (
    <div className={`rounded-lg border px-3 py-2 text-sm font-medium ${
      message.type === "ok"
        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
        : "border-rose-200 bg-rose-50 text-rose-800"
    }`}>
      {message.text}
    </div>
  );

  return (
    <section className="w-full px-3 py-4 sm:px-5">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6">
        {view === "dashboard" && (
          <>
            <DynamicBanner />
            {feedback}
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-sm">
              <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <h1 className="text-lg font-bold text-slate-900">Control de Patio</h1>
                  <span className="inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-emerald-700">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    En vivo
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => router.push("/cliente/torreon/movimientos")}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm"
                  >
                    <TrainFront className="h-4 w-4" />
                    Movimientos
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push("/cliente/torreon/incidentes")}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm"
                  >
                    <AlertTriangle className="h-4 w-4" />
                    Incidentes
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push("/cliente/torreon/crear")}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 text-sm font-semibold text-white shadow-sm"
                  >
                    <Plus className="h-4 w-4" />
                    Nuevo
                  </button>
                  <button
                    type="button"
                    onClick={() => load(true)}
                    disabled={refreshing}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm disabled:opacity-60"
                    title="Actualizar"
                  >
                    <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                  </button>
                </div>
              </div>

              <div className="space-y-4 p-4">
                {metricGrid}
                <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Por mover</p>
                        <h2 className="mt-1 text-base font-semibold text-slate-950">Cola de vagones</h2>
                      </div>
                      <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold text-slate-500">{nextVagones.length}</span>
                    </div>
                    {loading ? (
                      <div className="mt-4 h-48 animate-pulse rounded-xl bg-slate-100" />
                    ) : nextVagones.length ? (
                      <div className="mt-3 overflow-x-auto">
                        <table className="min-w-[760px] w-full text-left text-sm">
                          <thead className="text-xs uppercase text-slate-500">
                            <tr>
                              <th className="py-2 pr-3">Arrastre</th>
                              <th className="py-2 pr-3">Vagon</th>
                              <th className="py-2 pr-3">Zona</th>
                              <th className="py-2 pr-3">Carga</th>
                              <th className="py-2 pr-3">Estado</th>
                              <th className="py-2 pr-3">Solicitud</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {nextVagones.map(({ arrastre, vagon }) => (
                              <tr key={`${arrastre.id}-${vagon.id}`}>
                                <td className="py-2 pr-3 font-semibold text-slate-900">#{arrastre.id}</td>
                                <td className="py-2 pr-3 text-slate-700">{vagon.numeroVagon || `Vagon ${vagon.orden}`}</td>
                                <td className="py-2 pr-3 text-slate-700">Via {vagon.viaId} / Seccion {vagon.seccionId}</td>
                                <td className="py-2 pr-3 text-slate-700">{vagon.carga}</td>
                                <td className="py-2 pr-3"><EstadoBadge estado={vagon.estado} /></td>
                                <td className="py-2 pr-3 text-slate-600">{fmtDate(vagon.fechaSolicitud || arrastre.fechaSolicitud)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <EmptyState text="No hay vagones pendientes." />
                    )}
                  </div>

                  <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Estados</p>
                      <span className="rounded-lg bg-white px-2 py-1 text-xs font-bold text-slate-500">{stats.total}</span>
                    </div>
                    <div className="mt-4 space-y-3">
                      {[
                        ["Solicitados", stats.solicitados],
                        ["En proceso", stats.proceso],
                        ["Detenidos", stats.detenidos],
                        ["Concluidos", stats.concluidos],
                      ].map(([label, value]) => (
                        <div key={String(label)} className="flex items-center justify-between rounded-xl bg-white px-3 py-3 text-sm shadow-sm">
                          <span className="font-semibold text-slate-600">{label}</span>
                          <span className="font-bold text-slate-950">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}

        {view === "movimientos" && (
          <section className="w-full rounded-2xl border border-slate-200/80 bg-white/95 text-slate-900 shadow-xl shadow-slate-200/50 overflow-hidden">
            <div className="flex min-h-[calc(100svh-7rem)] flex-col gap-5 px-3 py-4 sm:px-5 sm:py-6 lg:px-7">
              <ModuleHeader
                title="Movimientos"
                chip={ambito === "actuales" ? "Actuales" : "Pasados"}
                total={visibleArrastres.length}
                icon={TrainFront}
              />

              <div className="h-px bg-gradient-to-r from-transparent via-emerald-300/40 to-transparent" />

              {feedback}

              <MovimientoToolbar
                ambito={ambito}
                search={search}
                dateFilter={dateFilter}
                refreshing={refreshing}
                actuales={activeArrastres.length}
                pasados={pastArrastres.length}
                onAmbito={setAmbito}
                onSearch={setSearch}
                onDateFilter={setDateFilter}
                onRefresh={() => load(true)}
                onNuevo={() => router.push("/cliente/torreon/crear")}
              />

              <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-slate-100 bg-white px-2 py-3 shadow-sm sm:px-4">
                {loading ? (
                  <div className="h-72 animate-pulse rounded-2xl bg-slate-100" />
                ) : visibleArrastres.length ? (
                  <div className="grid gap-3">
                    {visibleArrastres.map((arrastre) => (
                      <ArrastreCard
                        key={arrastre.id}
                        arrastre={arrastre}
                        dailyInfo={dailyCounters.get(arrastre.id)}
                        readOnly={isClosed(arrastre.estado)}
                        busyAction={busyAction}
                        draft={incidentDrafts[arrastre.id] || emptyIncidentDraft}
                        onDraftChange={(draft) => setIncidentDraft(arrastre.id, draft)}
                        onFiles={(event) => handleIncidentFiles(arrastre.id, event)}
                        onAction={runAction}
                        onEditVagon={openEditVagon}
                        onCancel={cancelArrastre}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    text={ambito === "actuales" ? "No hay movimientos activos" : "No hay movimientos pasados"}
                    hint={search ? "Ajusta la busqueda o cambia de pestana" : "Cuando se soliciten arrastres apareceran aqui"}
                  />
                )}
              </section>
            </div>
          </section>
        )}

        {view === "incidentes" && (
          <section className="w-full rounded-2xl border border-slate-200/80 bg-white/95 text-slate-900 shadow-xl shadow-slate-200/50 overflow-hidden">
            <div className="flex min-h-[calc(100svh-7rem)] flex-col gap-5 px-3 py-4 sm:px-5 sm:py-6 lg:px-7">
              <ModuleHeader
                title="Incidentes de arrastre"
                chip="Ligados al movimiento"
                total={incidentRows.length}
                icon={AlertTriangle}
              />

              <div className="h-px bg-gradient-to-r from-transparent via-amber-300/40 to-transparent" />

              {feedback}

              <section className="space-y-3 rounded-xl sm:rounded-2xl border border-slate-100 bg-gradient-to-b from-slate-50/80 to-white px-2 py-2 shadow-sm sm:px-4 sm:py-4">
                <div className="grid gap-2 lg:grid-cols-[1fr_210px_auto]">
                  <div className="relative">
                    <input
                      type="search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Buscar por arrastre, incidente, vagon, motivo..."
                      className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white/90 py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/30"
                    />
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  </div>
                  <label className="relative">
                    <CalendarDays className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="date"
                      value={dateFilter}
                      onChange={(event) => setDateFilter(event.target.value)}
                      className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white/90 py-2.5 pl-10 pr-3 text-sm font-semibold text-slate-700 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/30"
                    />
                  </label>
                  <button
                    type="button"
                    title="Actualizar"
                    onClick={() => load(true)}
                    disabled={refreshing}
                    className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white/90 px-4 py-2 text-xs font-medium text-slate-600 transition hover:border-emerald-400 hover:text-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                    <span>{refreshing ? "Actualizando..." : "Actualizar"}</span>
                  </button>
                </div>
              </section>

              <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-slate-100 bg-white px-2 py-3 shadow-sm sm:px-4">
                {loading ? (
                  <div className="h-72 animate-pulse rounded-2xl bg-slate-100" />
                ) : incidentRows.length ? (
                  <div className="grid gap-3">
                    {incidentRows.map(({ arrastre, incidente, vagon, dailyInfo }) => {
                      const dailyLabel = dailyInfo ? `Arrastre ${dailyInfo.index} de ${dailyInfo.total}` : "Arrastre";

                      return (
                        <article key={`${arrastre.id}-${incidente.id}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                                {fmtFullDate(incidente.fechaInicio || arrastre.fechaSolicitud)}
                              </p>
                              <h2 className="mt-1 text-xl font-black text-slate-950">
                                {dailyLabel}
                                <span className="ml-2 text-sm font-semibold text-slate-400">ID #{arrastre.id}</span>
                              </h2>
                              <p className="mt-1 text-sm font-semibold text-slate-500">Incidente #{incidente.id}</p>
                            </div>
                            <EstadoBadge estado={incidente.estado} />
                          </div>

                          <div className="mt-4 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
                            <div className="rounded-xl bg-slate-50 px-3 py-3">
                              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Vagon</p>
                              <p className="mt-1 font-semibold text-slate-800">{vagon?.numeroVagon || (vagon ? `Vagon ${vagon.orden}` : "Zona general")}</p>
                            </div>
                            <div className="rounded-xl bg-slate-50 px-3 py-3">
                              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Zona</p>
                              <p className="mt-1 font-semibold text-slate-800">{vagon ? `Via ${vagon.viaId} / Seccion ${vagon.seccionId}` : "General"}</p>
                            </div>
                            <div className="rounded-xl bg-slate-50 px-3 py-3">
                              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Arrastre</p>
                              <p className="mt-1 font-semibold text-slate-800">{displayStatus(arrastre.estado)}</p>
                            </div>
                            <div className="rounded-xl bg-slate-50 px-3 py-3">
                              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Resolucion</p>
                              <p className="mt-1 font-semibold text-slate-800">{fmtDate(incidente.fechaResolucion)}</p>
                            </div>
                          </div>

                          <div className="mt-4 grid gap-3 md:grid-cols-2">
                            <div className="rounded-xl border border-slate-100 px-3 py-3">
                              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Motivo</p>
                              <p className="mt-1 text-sm text-slate-700">{incidente.motivo || "Sin motivo capturado"}</p>
                            </div>
                            <div className="rounded-xl border border-slate-100 px-3 py-3">
                              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Solucion</p>
                              <p className="mt-1 text-sm text-slate-700">{incidente.solucion || "Pendiente"}</p>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState
                    text="No hay incidentes de arrastre"
                    hint={search || dateFilter ? "Ajusta filtros para ver otros incidentes" : "Cuando un arrastre se detenga por incidente aparecera aqui"}
                  />
                )}
              </section>
            </div>
          </section>
        )}

        {view === "crear" && (
          <>
            <Header
              title="Crear movimiento"
              subtitle="Torreon arrastres"
              refreshing={refreshing}
              onRefresh={() => load(true)}
              action={(
                <button
                  type="button"
                  onClick={() => router.push("/cliente/torreon/movimientos")}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm"
                >
                  <TrainFront className="h-4 w-4" />
                  Movimientos
                </button>
              )}
            />
            {feedback}
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="grid gap-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Instrucciones</label>
                  <textarea
                    value={instrucciones}
                    onChange={(event) => setInstrucciones(event.target.value)}
                    className="min-h-[88px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                    placeholder="Notas del arrastre"
                  />
                </div>

                <div className="grid gap-3">
                  {draftVagones.map((vagon, index) => (
                    <div key={vagon.tempId} className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 lg:grid-cols-[1fr_150px_120px_120px_auto] lg:items-end">
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-600">Vagon {index + 1}</label>
                        <input
                          value={vagon.numeroVagon}
                          onChange={(event) => updateDraftVagon(vagon.tempId, { numeroVagon: event.target.value })}
                          className={fieldClass()}
                          placeholder="Numero"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-600">Carga</label>
                        <select
                          value={vagon.carga}
                          onChange={(event) => updateDraftVagon(vagon.tempId, { carga: event.target.value as CargaVagon })}
                          className={fieldClass()}
                        >
                          <option value="VACIO">Vacio</option>
                          <option value="LLENO">Lleno</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-600">Via</label>
                        <input
                          value={vagon.viaId}
                          onChange={(event) => updateDraftVagon(vagon.tempId, { viaId: event.target.value })}
                          className={fieldClass()}
                          inputMode="numeric"
                          placeholder="Via"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-600">Seccion</label>
                        <input
                          value={vagon.seccionId}
                          onChange={(event) => updateDraftVagon(vagon.tempId, { seccionId: event.target.value })}
                          className={fieldClass()}
                          inputMode="numeric"
                          placeholder="Seccion"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeDraftVagon(vagon.tempId)}
                        disabled={draftVagones.length === 1}
                        className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Quitar
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className={`text-sm font-semibold ${draftCapacity > 8 ? "text-rose-700" : "text-slate-600"}`}>
                    Capacidad {draftCapacity}/8
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={addDraftVagon}
                      disabled={draftVagones.length >= 8}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Plus className="h-4 w-4" />
                      Vagon
                    </button>
                    <button
                      type="button"
                      onClick={submitArrastre}
                      disabled={busyAction === "crear" || draftCapacity > 8}
                      className="inline-flex h-10 min-w-[170px] items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busyAction === "crear" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear movimiento"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {editingVagon && (
          <EditVagonModal
            draft={editingVagon}
            busy={busyAction === `edit:${editingVagon.arrastreId}:${editingVagon.vagonId}`}
            onChange={updateEditingVagon}
            onClose={() => setEditingVagon(null)}
            onSubmit={submitVagonEdit}
          />
        )}
      </div>
    </section>
  );
}
