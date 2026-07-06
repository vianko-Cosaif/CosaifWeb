"use client";

import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  RefreshCw,
  TrainFront,
} from "lucide-react";
import TornoStatusBadge from "../TornoStatusBadge/TornoStatusBadge";
import type { TornoHistoryItem, TornoPagination } from "../../lib/types";
import {
  cn,
  formatDateShort,
  formatDuration,
  formatTime,
  serviceFolio,
} from "../../lib/tornoFormat";

export default function TornoServiceTable({
  items,
  loading,
  refreshing,
  meta,
  canViewDurations,
  onView,
  onRefresh,
  onPageChange,
}: {
  items: TornoHistoryItem[];
  loading: boolean;
  refreshing: boolean;
  meta: TornoPagination;
  canViewDurations: boolean;
  onView: (item: TornoHistoryItem) => void;
  onRefresh: () => void;
  onPageChange: (page: number) => void;
}) {
  const canPrev = meta.page > 1;
  const canNext = meta.page < meta.totalPages;

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/70 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-3 py-3 dark:border-slate-800">
        <div>
          <h2 className="text-base font-black text-slate-950 dark:text-slate-100">
            Servicios de torno
          </h2>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Folio, locomotora, fechas y avance operativo.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing || loading}
          className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
        >
          <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          Actualizar
        </button>
      </div>

      <div className="overflow-auto">
        <table className="w-full min-w-[1120px] text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500 shadow-[0_1px_0_rgba(148,163,184,0.30)] dark:bg-slate-900 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3 font-black">Folio</th>
              <th className="px-4 py-3 font-black">Estado</th>
              <th className="px-4 py-3 font-black">Locomotora</th>
              <th className="px-4 py-3 font-black">Cliente</th>
              <th className="px-4 py-3 font-black">Solicitud</th>
              <th className="px-4 py-3 font-black">Inicio</th>
              <th className="px-4 py-3 font-black">Fin</th>
              {canViewDurations && <th className="px-4 py-3 font-black">Tiempo</th>}
              <th className="px-4 py-3 font-black">Avance</th>
              <th className="sticky right-0 bg-slate-50 px-4 py-3 text-right font-black dark:bg-slate-900">Detalle</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <tr key={index} className="animate-pulse">
                  {Array.from({ length: canViewDurations ? 10 : 9 }).map((__, col) => (
                    <td key={col} className="px-4 py-4">
                      <div className="h-4 rounded bg-slate-100 dark:bg-slate-800" />
                    </td>
                  ))}
                </tr>
              ))
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={canViewDurations ? 10 : 9}>
                  <EmptyState />
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr
                  key={String(item.id)}
                  className="group cursor-pointer align-top transition hover:bg-cyan-50/45 dark:hover:bg-slate-900/70"
                  onClick={() => onView(item)}
                >
                  <td className="px-4 py-3">
                    <div className="font-black text-slate-950 dark:text-slate-100">{serviceFolio(item)}</div>
                    <div className="mt-1 text-[11px] font-black uppercase text-slate-400">ID {String(item.rondaServicioId ?? item.id)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <TornoStatusBadge status={item.status} />
                    {item.hasIncident && (
                      <div className="mt-1 text-[11px] font-black text-orange-600 dark:text-orange-300">
                        {item.activeIncidents ?? 0} incidente(s)
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="inline-flex items-center gap-2 font-black text-slate-950 dark:text-slate-100">
                      <TrainFront className="h-4 w-4 text-cyan-600 dark:text-cyan-300" />
                      {item.numeroLocomotora ?? item.locomotive ?? "-"}
                    </div>
                    <div className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                      Ronda {item.rondaNumber ?? "-"}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="max-w-[190px] truncate font-bold text-slate-700 dark:text-slate-200">
                      {item.companyName || "-"}
                    </div>
                    <div className="max-w-[190px] truncate text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {item.localityName || "-"}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <DateStack value={item.date} />
                  </td>
                  <td className="px-4 py-3">
                    <DateStack value={item.startAt ?? item.work?.startAt} />
                  </td>
                  <td className="px-4 py-3">
                    <DateStack value={item.endAt ?? item.work?.endAt} />
                  </td>
                  {canViewDurations && (
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">
                        <Clock3 className="h-3.5 w-3.5" />
                        {formatDuration(totalDuration(item))}
                      </span>
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <Progress item={item} />
                  </td>
                  <td className="sticky right-0 bg-white px-4 py-3 text-right shadow-[-10px_0_16px_-16px_rgba(15,23,42,0.5)] group-hover:bg-cyan-50 dark:bg-slate-950 dark:group-hover:bg-slate-900">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onView(item);
                      }}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 transition hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                      title="Ver detalle"
                      aria-label="Ver detalle"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="grid gap-2 border-t border-slate-200 bg-slate-50 px-3 py-3 text-sm dark:border-slate-800 dark:bg-slate-900/50 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        <button
          type="button"
          disabled={!canPrev}
          onClick={() => onPageChange(meta.page - 1)}
          className="inline-flex min-h-10 items-center justify-center gap-1 rounded-md border border-slate-200 bg-white px-3 font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900 sm:w-fit"
        >
          <ChevronLeft className="h-4 w-4" />
          Anterior
        </button>
        <span className="text-center text-xs font-black uppercase text-slate-500 dark:text-slate-400">
          Pagina {meta.page} de {meta.totalPages} - {meta.total} registros
        </span>
        <button
          type="button"
          disabled={!canNext}
          onClick={() => onPageChange(meta.page + 1)}
          className="inline-flex min-h-10 items-center justify-center gap-1 rounded-md border border-slate-200 bg-white px-3 font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900 sm:ml-auto sm:w-fit"
        >
          Siguiente
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}

function DateStack({ value }: { value?: string | null }) {
  return (
    <div className="min-w-[118px]">
      <div className="font-black text-slate-900 dark:text-slate-100">{formatTime(value)}</div>
      <div className="mt-1 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">{formatDateShort(value)}</div>
    </div>
  );
}

function Progress({ item }: { item: TornoHistoryItem }) {
  const total = item.work?.totalWheels || item.work?.wheels.length || 0;
  const done = item.work?.completedWheels || 0;
  const percent = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  return (
    <div className="min-w-[160px]">
      <div className="flex items-center justify-between gap-2 text-xs font-black text-slate-700 dark:text-slate-200">
        <span>{done}/{total}</span>
        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
      </div>
      <div className="mt-2 h-2 rounded-full bg-slate-100 dark:bg-slate-800">
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function totalDuration(item: TornoHistoryItem) {
  const wheelSeconds = item.work?.wheels.reduce((sum, wheel) => sum + (wheel.durationSeconds ?? 0), 0) ?? 0;
  if (wheelSeconds > 0) return wheelSeconds;
  const start = item.startAt ? new Date(item.startAt).getTime() : 0;
  const end = item.endAt ? new Date(item.endAt).getTime() : 0;
  if (!start || !end || end <= start) return 0;
  return Math.round((end - start) / 1000);
}

function EmptyState() {
  return (
    <div className="p-6 text-center">
      <div className="mx-auto max-w-md rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-10 dark:border-slate-700 dark:bg-slate-900">
        <div className="font-black text-slate-800 dark:text-slate-100">Sin servicios para mostrar</div>
        <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
          Ajusta busqueda, estado o fechas para revisar otros registros.
        </p>
      </div>
    </div>
  );
}
