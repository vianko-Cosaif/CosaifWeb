"use client";

import { ArrowLeft, CalendarClock, CircleGauge, Loader2, TrainFront, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import MeasuresSection from "./MeasuresSection";
import IncidentTree from "./IncidentTree";
import type {
  TornoHistoryItem,
  TornoIncidentChild,
  TornoIncidentParent,
  TornoIncidentPayload,
  TornoPermissions,
  TornoReopenPayload,
  TornoResolvePayload,
} from "../lib/types";

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusClasses(status?: string) {
  const key = String(status || "").toUpperCase();
  if (key === "SOLICITADO") return "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200";
  if (key === "EN_PROCESO") return "border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-200";
  if (key === "CONCLUIDO") return "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200";
  if (key === "DETENIDO") return "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200";
  return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200";
}

export default function HistorialDetailModal({
  item,
  loading,
  permissions,
  createdById,
  onClose,
  onCreateParent,
  onEditParent,
  onAddChild,
  onResolveParent,
  onReopenParent,
  onResolveChild,
  onNavajas,
}: {
  item: TornoHistoryItem | null;
  loading: boolean;
  permissions: TornoPermissions;
  createdById?: string | number;
  onClose: () => void;
  onCreateParent?: (payload: TornoIncidentPayload) => Promise<void>;
  onEditParent?: (
    incident: TornoIncidentParent,
    patch: Partial<TornoIncidentPayload> & { status?: string },
  ) => Promise<void>;
  onAddChild?: (parentId: string | number, payload: TornoIncidentPayload) => Promise<void>;
  onResolveParent?: (incident: TornoIncidentParent, payload?: TornoResolvePayload) => Promise<void>;
  onReopenParent?: (incident: TornoIncidentParent, payload?: TornoReopenPayload) => Promise<void>;
  onResolveChild?: (child: TornoIncidentChild, payload?: TornoResolvePayload) => Promise<void>;
  onNavajas?: () => void;
}) {
  if (!item) return null;

  const details = [
    ["Estado", item.status || "—", null],
    ["Servicio", item.service ?? "Torno", null],
    ["Inicio", formatDate(item.startAt), <CalendarClock key="inicio" className="h-3.5 w-3.5" />],
    ["Fin", formatDate(item.endAt), <CalendarClock key="fin" className="h-3.5 w-3.5" />],
    ["Fecha", formatDate(item.date), <CalendarClock key="fecha" className="h-3.5 w-3.5" />],
    ["Tornero", item.operator || "—", <UserRound key="tornero" className="h-3.5 w-3.5" />],
  ] as const;

  return (
    <section className="min-w-0 space-y-4">
      <header className="sticky top-0 z-20 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/70 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none">
        <div className="grid gap-3 p-3 sm:p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver
            </button>
            <div className="hidden h-10 w-px bg-slate-200 dark:bg-slate-800 sm:block" />
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-slate-950 text-white dark:bg-white dark:text-slate-950">
              <TrainFront className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-wide text-cyan-700 dark:text-cyan-300">
                Detalle Torno
              </p>
              <h2 className="truncate text-xl font-black text-slate-950 dark:text-slate-100">
                Locomotora {item.locomotive ?? "—"}
              </h2>
              <p className="truncate text-xs font-semibold text-slate-500 dark:text-slate-400">
                Servicio {item.service ?? "Torno"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            {loading && (
              <span className="inline-flex h-9 items-center gap-2 rounded-md border border-cyan-200 bg-cyan-50 px-3 text-xs font-black text-cyan-800 dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-100">
                <Loader2 className="h-4 w-4 animate-spin" />
                Actualizando
              </span>
            )}
            <span className={`inline-flex h-9 items-center rounded-full border px-3 text-[11px] font-black uppercase ${statusClasses(item.status)}`}>
              {item.status || "—"}
            </span>
          </div>
        </div>
      </header>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none">
        <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/50">
          <CircleGauge className="h-4 w-4 text-cyan-600 dark:text-cyan-300" />
          <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">Informacion del servicio</h3>
        </div>

        <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {details.map(([label, value, icon]) => (
            <DataTile key={label} label={label} value={value} icon={icon} />
          ))}
        </div>
      </section>

      <div className="grid items-start gap-4 xl:grid-cols-2">
        <MeasuresSection title="Medidas de inicio" measures={item.measuresRequested} />
        <MeasuresSection title="Medidas de fin" measures={item.measuresFinal} />
      </div>

      {permissions.canViewIncidents && (
        <IncidentTree
          incidents={item.incidents ?? []}
          permissions={permissions}
          createdById={createdById}
          incidentContext={{
            rondaServicioId: item.rondaServicioId,
            ruedaSolicitudId: item.servicioId,
            numeroLocomotora: item.numeroLocomotora,
          }}
          onCreateParent={onCreateParent}
          onEditParent={onEditParent}
          onAddChild={onAddChild}
          onResolveParent={onResolveParent}
          onReopenParent={onReopenParent}
          onResolveChild={onResolveChild}
          onNavajas={onNavajas}
        />
      )}
    </section>
  );
}

function DataTile({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-md border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-slate-400">
        {icon}
        {label}
      </div>
      <div className="mt-1 truncate text-sm font-black text-slate-900 dark:text-slate-100">{value}</div>
    </div>
  );
}
