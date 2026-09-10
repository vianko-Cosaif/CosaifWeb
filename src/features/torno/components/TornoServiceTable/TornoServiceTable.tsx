"use client";

import {
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  RefreshCw,
  TrainFront,
} from "lucide-react";
import Button from "@/components/ui/Button";
import { useUp } from "@/hooks/useMediaQuery";
import DataEmptyState from "@/components/ui/DataEmptyState";
import { GuidedTarget } from "@/features/capacitacion";
import TornoStatusBadge from "../TornoStatusBadge/TornoStatusBadge";
import type { TornoHistoryItem, TornoPagination } from "../../lib/types";
import {
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
  // A single representation avoids duplicate rows, actions and training targets.
  const showTable = useUp("xl");
  const canPrev = meta.page > 1;
  const canNext = meta.page < meta.totalPages;

  return (
    <GuidedTarget
      id="torno-services-list"
      as="section"
      className="overflow-hidden rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] shadow-[var(--app-shadow-sm)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--app-border)] p-4 sm:p-5">
        <div>
          <h2 className="text-lg font-semibold text-[var(--app-text)]">
            Servicios de torno
          </h2>
          <p className="text-sm font-medium text-[var(--app-text-muted)]">
            Folio, locomotora, fechas y avance operativo.
          </p>
        </div>
        <Button onClick={onRefresh} loading={refreshing} disabled={loading} leftIcon={<RefreshCw className="h-4 w-4" aria-hidden />}>Actualizar</Button>
      </div>

      {!loading && items.length === 0 ? <EmptyState /> : !showTable ? (
        <ServiceCards items={items} loading={loading} canViewDurations={canViewDurations} onView={onView} />
      ) : (
      <>
      <div role="region" aria-label="Tabla de servicios de torno" tabIndex={0} className="overflow-x-auto overscroll-x-contain focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--app-focus)]">
        <table className="w-full min-w-[1120px] text-left text-sm">
          <thead className="sticky top-0 z-10 bg-[var(--app-surface-subtle)] text-[11px] uppercase text-[var(--app-text-muted)] shadow-[0_1px_0_var(--app-border)]">
            <tr>
              <th className="px-4 py-3 font-semibold">Folio</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
              <th className="px-4 py-3 font-semibold">Locomotora</th>
              <th className="px-4 py-3 font-semibold">Cliente</th>
              <th className="px-4 py-3 font-semibold">Solicitud</th>
              <th className="px-4 py-3 font-semibold">Inicio</th>
              <th className="px-4 py-3 font-semibold">Fin</th>
              {canViewDurations && <th className="px-4 py-3 font-semibold">Tiempo</th>}
              <th className="px-4 py-3 font-semibold">Avance</th>
              <th className="sticky right-0 bg-[var(--app-surface-subtle)] px-4 py-3 text-right font-semibold">Detalle</th>
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
            ) : (
              items.map((item, index) => (
                <tr
                  key={String(item.id)}
                  data-guide-id={index === 0 ? "training-torno-service-row" : undefined}
                  className="group cursor-pointer align-top transition hover:bg-cyan-50/45 dark:hover:bg-slate-900/70"
                  onClick={() => onView(item)}
                >
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-950 dark:text-slate-100">{serviceFolio(item)}</div>
                    <div className="mt-1 text-[11px] font-semibold uppercase text-slate-400">ID {String(item.rondaServicioId ?? item.id)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <TornoStatusBadge status={item.status} />
                    {item.hasIncident && (
                      <div className="mt-1 text-[11px] font-semibold text-orange-600 dark:text-orange-300">
                        {item.activeIncidents ?? 0} incidente(s)
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="inline-flex items-center gap-2 font-semibold text-slate-950 dark:text-slate-100">
                      <TrainFront className="h-4 w-4 text-cyan-600 dark:text-cyan-300" />
                      {item.numeroLocomotora ?? item.locomotive ?? "-"}
                    </div>
                    <div className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                      Ronda {item.rondaNumber ?? "-"}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div title={item.companyName || undefined} className="max-w-[190px] truncate font-medium text-slate-700 dark:text-slate-200">
                      {item.companyName || "-"}
                    </div>
                    <div title={item.localityName || undefined} className="max-w-[190px] truncate text-xs font-semibold text-slate-500 dark:text-slate-400">
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
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">
                        <Clock3 className="h-3.5 w-3.5" />
                        {formatDuration(totalDuration(item))}
                      </span>
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <Progress item={item} />
                  </td>
                  <td className="sticky right-0 bg-[var(--app-surface)] px-4 py-3 text-right shadow-[-10px_0_16px_-16px_rgba(15,23,42,0.5)] group-hover:bg-[var(--app-surface-subtle)]">
                    {index === 0 ? (
                      <GuidedTarget id="torno-open-service-detail" className="inline-flex">
                        <ServiceDetailButton item={item} onView={onView} />
                      </GuidedTarget>
                    ) : (
                      <ServiceDetailButton item={item} onView={onView} />
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      </>
      )}

      <div className="grid gap-3 border-t border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-3 py-3 text-sm sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        <button
          type="button"
          disabled={!canPrev || loading || refreshing}
          onClick={() => onPageChange(meta.page - 1)}
          className="inline-flex min-h-11 items-center justify-center gap-1 rounded-md border border-slate-200 bg-white px-3 font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900 sm:w-fit"
        >
          <ChevronLeft className="h-4 w-4" />
          Anterior
        </button>
        <span className="text-center text-sm font-medium text-slate-500 dark:text-slate-400">
          Página {meta.page} de {meta.totalPages} · {meta.total} registros
        </span>
        <button
          type="button"
          disabled={!canNext || loading || refreshing}
          onClick={() => onPageChange(meta.page + 1)}
          className="inline-flex min-h-11 items-center justify-center gap-1 rounded-md border border-slate-200 bg-white px-3 font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900 sm:ml-auto sm:w-fit"
        >
          Siguiente
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </GuidedTarget>
  );
}

function ServiceCards({ items, loading, canViewDurations, onView }: {
  items: TornoHistoryItem[];
  loading: boolean;
  canViewDurations: boolean;
  onView: (item: TornoHistoryItem) => void;
}) {
  if (loading) {
    return (
      <div role="status" aria-label="Cargando servicios de torno" className="grid gap-3 p-4 sm:p-5">
        <span className="sr-only">Cargando servicios de torno…</span>
        {[0, 1, 2].map((index) => <div key={index} aria-hidden className="h-64 animate-pulse rounded-lg bg-[var(--app-surface-muted)]" />)}
      </div>
    );
  }
  return (
    <ul aria-label="Servicios de torno" className="grid min-w-0 list-none grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] gap-3 p-4 sm:p-5">
      {items.map((item, index) => (
        <li key={String(item.id)} className="min-w-0">
          <article aria-label={`Servicio ${serviceFolio(item)}`} data-guide-id={index === 0 ? "training-torno-service-row" : undefined} className="flex h-full min-w-0 flex-col gap-4 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="break-words text-base font-semibold text-[var(--app-text)]">{serviceFolio(item)}</h3>
                <p className="mt-1 text-xs text-[var(--app-text-muted)]">ID {String(item.rondaServicioId ?? item.id)} · Ronda {item.rondaNumber ?? "—"}</p>
              </div>
              <TornoStatusBadge status={item.status} />
            </div>
            <div className="min-w-0 space-y-1">
              <p className="flex items-center gap-2 text-sm font-semibold text-[var(--app-text)]"><TrainFront className="h-4 w-4 shrink-0 text-[var(--app-accent)]" aria-hidden />Locomotora {item.numeroLocomotora ?? item.locomotive ?? "—"}</p>
              <p className="break-words text-sm text-[var(--app-text)]">{item.companyName || "Empresa sin nombre"}</p>
              <p className="break-words text-xs text-[var(--app-text-muted)]">{item.localityName || "Localidad sin nombre"}</p>
            </div>
            {item.hasIncident && <p className="text-sm font-medium text-amber-700 dark:text-amber-300">{item.activeIncidents ?? 0} incidente(s) activo(s)</p>}
            <dl className="grid min-w-0 grid-cols-2 gap-x-3 gap-y-3 border-y border-[var(--app-border)] py-3">
              <CardDate label="Solicitud" value={item.date} />
              <CardDate label="Inicio" value={item.startAt ?? item.work?.startAt} />
              <CardDate label="Fin" value={item.endAt ?? item.work?.endAt} />
              {canViewDurations && <div className="min-w-0"><dt className="text-xs text-[var(--app-text-muted)]">Tiempo</dt><dd className="mt-1 break-words text-sm font-medium text-[var(--app-text)]">{formatDuration(totalDuration(item))}</dd></div>}
            </dl>
            <div className="min-w-0"><p className="mb-2 text-xs text-[var(--app-text-muted)]">Avance de ruedas</p><Progress item={item} compact /></div>
            <div className="mt-auto">
              {index === 0 ? <GuidedTarget id="torno-open-service-detail"><CardDetailButton item={item} onView={onView} /></GuidedTarget> : <CardDetailButton item={item} onView={onView} />}
            </div>
          </article>
        </li>
      ))}
    </ul>
  );
}

function CardDate({ label, value }: { label: string; value?: string | null }) {
  return <div className="min-w-0"><dt className="text-xs text-[var(--app-text-muted)]">{label}</dt><dd className="mt-1 break-words text-sm font-medium text-[var(--app-text)]">{formatTime(value)}<span className="mt-0.5 block text-xs font-normal text-[var(--app-text-muted)]">{formatDateShort(value)}</span></dd></div>;
}

function CardDetailButton({ item, onView }: { item: TornoHistoryItem; onView: (item: TornoHistoryItem) => void }) {
  return <Button className="w-full" onClick={() => onView(item)} aria-label={`Ver detalle de servicio ${serviceFolio(item)}`} leftIcon={<Eye className="h-4 w-4" aria-hidden />}>Ver detalle</Button>;
}

function ServiceDetailButton({
  item,
  onView,
}: {
  item: TornoHistoryItem;
  onView: (item: TornoHistoryItem) => void;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onView(item);
      }}
      className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 transition hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
      title="Ver detalle"
      aria-label={`Ver detalle de servicio ${serviceFolio(item)}`}
    >
      <Eye className="h-4 w-4" />
    </button>
  );
}

function DateStack({ value }: { value?: string | null }) {
  return (
    <div className="min-w-[118px]">
      <div className="font-semibold text-slate-900 dark:text-slate-100">{formatTime(value)}</div>
      <div className="mt-1 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">{formatDateShort(value)}</div>
    </div>
  );
}

function Progress({ item, compact = false }: { item: TornoHistoryItem; compact?: boolean }) {
  const total = item.work?.totalWheels || item.work?.wheels.length || 0;
  const done = item.work?.completedWheels || 0;
  const percent = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  return (
    <div className={compact ? "min-w-0" : "min-w-[160px]"}>
      <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
        <span>{done}/{total}</span>
        <span className="text-[var(--app-text-muted)]">{percent}%</span>
      </div>
      <div role="progressbar" aria-label="Avance de ruedas" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-valuetext={`${done} de ${total} ruedas terminadas`} className="mt-2 h-2 rounded-full bg-slate-100 dark:bg-slate-800">
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
  return <div className="p-4 sm:p-5"><DataEmptyState title="Sin servicios para mostrar" description="Ajusta la búsqueda, el periodo o las fechas para consultar otros registros." icon={TrainFront} /></div>;
}
