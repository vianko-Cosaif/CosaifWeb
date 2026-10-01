"use client";

import { CalendarClock, ChevronLeft, ChevronRight, Eye, RefreshCw, TrainFront, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import type { TornoHistoryItem, TornoPagination } from "../lib/types";

function cn(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

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
  if (key === "CANCELADO") return "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200";
  return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200";
}

function statusDot(status?: string) {
  const key = String(status || "").toUpperCase();
  if (key === "SOLICITADO") return "bg-amber-500";
  if (key === "EN_PROCESO") return "bg-cyan-500";
  if (key === "CONCLUIDO") return "bg-emerald-500";
  if (key === "DETENIDO") return "bg-rose-500";
  if (key === "CANCELADO") return "bg-zinc-500";
  return "bg-slate-400";
}

export default function HistorialTable({
  items,
  loading,
  refreshing,
  meta,
  onView,
  onRefresh,
  onPageChange,
}: {
  items: TornoHistoryItem[];
  loading: boolean;
  refreshing: boolean;
  meta: TornoPagination;
  onView: (item: TornoHistoryItem) => void;
  onRefresh: () => void;
  onPageChange: (page: number) => void;
}) {
  const canPrev = meta.page > 1;
  const canNext = meta.page < meta.totalPages;

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-3 py-3 dark:border-slate-800">
        <div className="min-w-0">
          <div className="text-base font-black text-slate-950 dark:text-slate-100">
            {loading ? "Cargando servicios" : `${meta.total || items.length} servicios`}
          </div>
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Historial Torno sin datos de movimiento
          </div>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing || loading}
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-700 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900"
          title="Actualizar"
          aria-label="Actualizar historial"
        >
          <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
        </button>
      </div>

      <div className="md:hidden">
        {loading ? (
          <div className="space-y-3 p-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-44 animate-pulse rounded-md border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map((item) => (
              <article key={String(item.id)} className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-black uppercase", statusClasses(item.status))}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", statusDot(item.status))} />
                      {item.status || "—"}
                    </span>
                    <div className="mt-2 flex min-w-0 items-center gap-2 text-xl font-black text-slate-950 dark:text-slate-100">
                      <TrainFront className="h-5 w-5 shrink-0 text-cyan-600 dark:text-cyan-300" />
                      <span className="truncate">{item.locomotive ?? "—"}</span>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-black text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                    {item.service ?? "Torno"}
                  </span>
                </div>

                <div className="mt-3 grid gap-2">
                  <MobileFact label="Inicio" value={formatDate(item.startAt)} />
                  <MobileFact label="Fin" value={formatDate(item.endAt)} />
                  <MobileFact label="Fecha" value={formatDate(item.date)} />
                  <MobileFact label="Tornero" value={item.operator || "—"} icon={<UserRound className="h-3.5 w-3.5" />} />
                </div>

                <button
                  type="button"
                  onClick={() => onView(item)}
                  className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-black text-white shadow-sm transition hover:bg-cyan-700 dark:bg-white dark:text-slate-950 dark:hover:bg-cyan-100"
                  aria-label={`Ver detalle de servicio ${item.id}`}
                >
                  <Eye className="h-4 w-4" />
                  Ver detalle
                </button>
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="hidden max-h-[68vh] overflow-auto md:block">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] uppercase text-slate-500 shadow-[0_1px_0_rgba(148,163,184,0.30)] dark:bg-slate-900 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3 font-black">Estado</th>
              <th className="px-4 py-3 font-black">Locomotora</th>
              <th className="px-4 py-3 font-black">Servicio</th>
              <th className="px-4 py-3 font-black">Inicio</th>
              <th className="px-4 py-3 font-black">Fin</th>
              <th className="px-4 py-3 font-black">Fecha</th>
              <th className="px-4 py-3 font-black">Tornero</th>
              <th className="sticky right-0 bg-slate-50 px-4 py-3 text-right font-black dark:bg-slate-900">Accion</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? (
              Array.from({ length: 6 }).map((_, index) => (
                <tr key={index} className="animate-pulse">
                  {Array.from({ length: 8 }).map((__, col) => (
                    <td key={col} className="px-4 py-4">
                      <div className="h-4 rounded bg-slate-100 dark:bg-slate-800" />
                    </td>
                  ))}
                </tr>
              ))
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={8}>
                  <EmptyState />
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={String(item.id)} className="group hover:bg-cyan-50/40 dark:hover:bg-slate-900/70">
                  <td className="px-4 py-3">
                    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-black uppercase", statusClasses(item.status))}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", statusDot(item.status))} />
                      {item.status || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="inline-flex items-center gap-2 font-black text-slate-950 dark:text-slate-100">
                      <TrainFront className="h-4 w-4 text-cyan-600 dark:text-cyan-300" />
                      {item.locomotive ?? "—"}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                      {item.service ?? "Torno"}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">{formatDate(item.startAt)}</td>
                  <td className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">{formatDate(item.endAt)}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatDate(item.date)}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    <span className="inline-flex max-w-[260px] items-center gap-2 truncate">
                      <UserRound className="h-4 w-4 shrink-0 text-slate-400" />
                      <span className="truncate">{item.operator || "—"}</span>
                    </span>
                  </td>
                  <td className="sticky right-0 bg-white px-4 py-3 text-right shadow-[-10px_0_16px_-16px_rgba(15,23,42,0.5)] group-hover:bg-cyan-50 dark:bg-slate-950 dark:group-hover:bg-slate-900">
                    <button
                      type="button"
                      onClick={() => onView(item)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-slate-950 text-white shadow-sm transition hover:bg-cyan-700 dark:bg-white dark:text-slate-950 dark:hover:bg-cyan-100"
                      title="Ver detalle"
                      aria-label={`Ver detalle de servicio ${item.id}`}
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
          Pagina {meta.page} de {meta.totalPages}
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

function EmptyState() {
  return (
    <div className="p-3 md:p-8">
      <div className="mx-auto max-w-sm rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900">
        <div className="font-bold text-slate-700 dark:text-slate-200">Sin servicios de Torno</div>
        <div className="mt-1 text-xs">No hay registros para el filtro actual.</div>
      </div>
    </div>
  );
}

function MobileFact({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[88px_minmax(0,1fr)] items-center gap-2 rounded-md border border-slate-100 bg-slate-50 px-2.5 py-2 dark:border-slate-800 dark:bg-slate-900">
      <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-slate-400">
        {icon ?? <CalendarClock className="h-3.5 w-3.5" />}
        {label}
      </span>
      <span className="min-w-0 truncate text-right text-xs font-black text-slate-700 dark:text-slate-200">{value}</span>
    </div>
  );
}
