"use client";

import React, { useDeferredValue } from "react";
import {
  AlertTriangle,
  Archive,
  Building2,
  ChevronRight,
  MapPin,
  Route,
  TrainFront,
} from "lucide-react";
import {
  Button,
  DataEmptyState,
  LoadingState,
  PaginationBar,
  StatusBadge,
  cn,
  type StatusTone,
} from "@/app/Components/ui";
import { GuidedTarget } from "@/app/Components/GuidedManualAtom";
import type { IncidenteRow, Meta } from "./types";

function incidentStatusTone(value?: string): StatusTone {
  const status = String(value || "").toLocaleLowerCase("es-MX");
  if (status.includes("atención") || status === "activo" || status === "abierto") return "warning";
  if (status === "resuelto") return "success";
  if (status === "cerrado") return "muted";
  return "neutral";
}

function operationTone(row: IncidenteRow) {
  return row.tipoIncidente?.toLocaleLowerCase("es-MX").includes("arrastre")
    ? "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-200"
    : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200";
}

type Props = {
  data?: IncidenteRow[];
  loading?: boolean;
  meta?: Meta;
  onRowPress?: (row: IncidenteRow) => void;
  onPageChange?: (page: number) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  emptyStateText?: string;
};

function IncidentEmptyState({ loading, emptyStateText, onRefresh, refreshing }: {
  loading: boolean;
  emptyStateText: string;
  onRefresh?: () => void;
  refreshing: boolean;
}) {
  if (loading) return <LoadingState label="Cargando incidentes" className="min-h-[260px] border-0" />;
  return (
    <DataEmptyState
      icon={emptyStateText.toLocaleLowerCase("es-MX").includes("pendiente") ? AlertTriangle : Archive}
      title={emptyStateText}
      description="Prueba con otra zona, tipo de operación o rango de estado."
      className="min-h-[260px] border-0 bg-transparent"
      actions={onRefresh ? <Button onClick={onRefresh} loading={refreshing} variant="primary">Actualizar</Button> : null}
    />
  );
}

function IncidentLocation({ row }: { row: IncidenteRow }) {
  return (
    <div className="min-w-0">
      <p className="truncate font-black text-slate-900 dark:text-white">{row.localidad || row.fuente || "Sin localidad"}</p>
      <p className="mt-0.5 truncate text-xs font-semibold text-slate-500 dark:text-slate-400">{row.fuente || "Operación"}</p>
    </div>
  );
}

function IncidentesTableComp({
  data = [],
  loading = false,
  meta = { page: 1, totalPages: 1 },
  onRowPress,
  onPageChange,
  onRefresh,
  refreshing = false,
  emptyStateText = "No hay incidentes para mostrar",
}: Props) {
  const page = Number(meta.page) || 1;
  const pages = Number(meta.totalPages) || 1;
  const pageSize = Number(meta.pageSize) || Math.max(data.length, 1);
  const totalItems = Number(meta.total) || data.length;
  const deferredData = useDeferredValue(data);
  const isStale = deferredData !== data;
  const empty = <IncidentEmptyState loading={loading} emptyStateText={emptyStateText} onRefresh={onRefresh} refreshing={refreshing} />;

  return (
    <section className="flex flex-col gap-4 p-3 sm:p-5" aria-busy={loading}>
      <div className="lg:hidden">
        {loading || !deferredData.length ? empty : (
          <ul className="space-y-3">
            {deferredData.map((row, index) => (
              <GuidedTarget
                key={`${row.fuente}-${row.tipoIncidente}-${row.id}-${index}`}
                id={index === 0 ? "incidents-open-first-mobile" : `incident-row-mobile-${row.id}-${index}`}
                as="li"
                data-training-incident-id={String(row.id) === "920000041" ? "920000041" : undefined}
              >
                <button
                  type="button"
                  onClick={() => onRowPress?.(row)}
                  className={cn(
                    "w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition active:scale-[.995] dark:border-slate-800 dark:bg-slate-950",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
                    isStale && "opacity-70",
                  )}
                  aria-label={`Ver incidente ${row.id ?? ""} de ${row.localidad || row.fuente || "la operación"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-black text-slate-400">#{row.id ?? "—"}</span>
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${operationTone(row)}`}>{row.tipoIncidente || "Operación"}</span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-base font-black leading-5 text-slate-950 dark:text-white">{row.descripcion || "Sin descripción"}</p>
                    </div>
                    <StatusBadge status={row.estatus} label={row.estatus} tone={incidentStatusTone(row.estatus)} size="sm" dot />
                  </div>

                  <div className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-900 sm:grid-cols-2">
                    <div className="flex min-w-0 items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /><IncidentLocation row={row} /></div>
                    <div className="flex min-w-0 items-start gap-2"><Building2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /><div className="min-w-0"><p className="truncate font-bold text-slate-800 dark:text-slate-100">{row.empresa || "Sin empresa"}</p><p className="mt-0.5 truncate text-xs text-slate-500">{row.locomotora || "Sin equipo identificado"}</p></div></div>
                    <div className="flex min-w-0 items-start gap-2 sm:col-span-2"><Route className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" /><p className="min-w-0 text-xs font-semibold leading-5 text-slate-600 dark:text-slate-300"><span>{row.origen || "—"}</span><span className="px-2 text-slate-400">→</span><span>{row.destino || "—"}</span></p></div>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <span>{row.fecha || "Sin fecha"}</span>
                    <span className="inline-flex items-center gap-1 font-black text-emerald-700 dark:text-emerald-300">Ver detalle <ChevronRight className="h-4 w-4" /></span>
                  </div>
                </button>
              </GuidedTarget>
            ))}
          </ul>
        )}
      </div>

      <div className="hidden lg:block">
        <div className={cn("overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800", isStale && "opacity-70")}>
          <table className="w-full min-w-[1120px] table-fixed text-left text-sm">
            <colgroup>
              <col className="w-[24%]" />
              <col className="w-[12%]" />
              <col className="w-[14%]" />
              <col className="w-[17%]" />
              <col className="w-[20%]" />
              <col className="w-[13%]" />
            </colgroup>
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-black uppercase tracking-[.12em] text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
              <tr><th className="px-4 py-3">Incidente</th><th className="px-4 py-3">Operación</th><th className="px-4 py-3">Ubicación</th><th className="px-4 py-3">Empresa y equipo</th><th className="px-4 py-3">Ruta</th><th className="px-4 py-3">Estado</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
              {loading || !deferredData.length ? (
                <tr><td colSpan={6}>{empty}</td></tr>
              ) : deferredData.map((row, index) => (
                <GuidedTarget
                  key={`${row.fuente}-${row.tipoIncidente}-${row.id}-${index}`}
                  id={index === 0 ? "incidents-open-first-desktop" : `incident-row-desktop-${row.id}-${index}`}
                  as="tr"
                  data-training-incident-id={String(row.id) === "920000041" ? "920000041" : undefined}
                  className="group transition hover:bg-emerald-50/40 dark:hover:bg-emerald-950/10"
                >
                  <td className="p-0">
                    <button type="button" onClick={() => onRowPress?.(row)} className="block w-full px-4 py-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500" aria-label={`Ver incidente ${row.id ?? ""}`}>
                      <div className="flex items-center gap-2"><span className="font-mono text-xs font-black text-emerald-700 dark:text-emerald-300">#{row.id ?? "—"}</span><span className="text-xs font-semibold text-slate-400">{row.fecha || "Sin fecha"}</span></div>
                      <p className="mt-1 line-clamp-2 font-bold leading-5 text-slate-900 dark:text-white">{row.descripcion || "Sin descripción"}</p>
                    </button>
                  </td>
                  <td className="px-4 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${operationTone(row)}`}>{row.tipoIncidente || "Operación"}</span></td>
                  <td className="px-4 py-4"><div className="flex min-w-0 items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /><IncidentLocation row={row} /></div></td>
                  <td className="px-4 py-4"><div className="flex min-w-0 items-start gap-2"><TrainFront className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /><div className="min-w-0"><p className="truncate font-bold text-slate-900 dark:text-white">{row.empresa || "Sin empresa"}</p><p className="mt-1 truncate text-xs font-semibold text-slate-500">{row.locomotora || "Sin equipo"}</p></div></div></td>
                  <td className="px-4 py-4"><p className="line-clamp-2 text-xs font-semibold leading-5 text-slate-600 dark:text-slate-300">{row.origen || "—"}<span className="px-2 text-slate-400">→</span>{row.destino || "—"}</p></td>
                  <td className="px-4 py-4"><div className="flex items-center justify-between gap-2"><StatusBadge status={row.estatus} label={row.estatus} tone={incidentStatusTone(row.estatus)} size="sm" dot /><button type="button" onClick={() => onRowPress?.(row)} className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 transition hover:bg-white hover:text-emerald-700 hover:shadow-sm dark:hover:bg-slate-800" aria-label={`Abrir incidente ${row.id ?? ""}`}><ChevronRight className="h-4 w-4" /></button></div></td>
                </GuidedTarget>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {pages > 1 && onPageChange ? <PaginationBar page={page} totalPages={pages} pageSize={pageSize} totalItems={totalItems} onPageChange={onPageChange} /> : null}
    </section>
  );
}

export default React.memo(IncidentesTableComp);
