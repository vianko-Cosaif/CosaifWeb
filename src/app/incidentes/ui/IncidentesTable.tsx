"use client";

import React, { useDeferredValue } from "react";
import { Archive, AlertCircle } from "lucide-react";
import {
  Button,
  DataEmptyState,
  LoadingState,
  PaginationBar,
  StatusBadge,
  cn,
  type StatusTone,
} from "@/app/Components/ui";
import type { IncidenteRow, Meta } from "./types";

const incidentStatusTone = (s?: string): StatusTone => {
  switch ((s || "").toLowerCase()) {
    case "activo":
      return "success";
    case "cerrado":
      return "danger";
    case "resuelto":
      return "info";
    default:
      return "neutral";
  }
};

type Props = {
  data?: IncidenteRow[];
  loading?: boolean;
  meta?: Meta;
  onRowPress?: (r: IncidenteRow) => void;
  onPageChange?: (p: number) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  emptyStateText?: string;
};

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

  // Suaviza renders cuando llegan lotes grandes (mejor UX en móviles)
  const deferredData = useDeferredValue(data);
  const isStale = deferredData !== data;

  /** ===== Empty / Loading ===== */
  const EmptyOrLoading = (
    loading ? (
      <LoadingState label="Cargando incidentes" className="min-h-[220px] border-0" />
    ) : (
      <DataEmptyState
        icon={emptyStateText.toLowerCase().includes("activo") ? AlertCircle : Archive}
        title={emptyStateText}
        className="min-h-[220px] border-0 bg-transparent"
        actions={
          onRefresh ? (
            <Button onClick={onRefresh} loading={refreshing} variant="primary">
              Actualizar
            </Button>
          ) : null
        }
      />
    )
  );

  /** ===== Card list (< xl) ===== */
  const MobileCards = (
    <div className="xl:hidden">
      {loading || deferredData.length === 0 ? (
        EmptyOrLoading
      ) : (
        <ul className="space-y-2">
          {deferredData.map((row, i) => {
            return (
              <li key={`${row.id}-${i}`}>
                <button
                  type="button"
                  onClick={() => onRowPress?.(row)}
                  onKeyDown={(e) => e.key === "Enter" && onRowPress?.(row)}
                  className={cn(
                    "w-full rounded-xl border p-3 text-left shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-600",
                    "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900",
                    isStale && "opacity-70"
                  )}
                  aria-label={`Incidente ${row.id ?? ""}, ${row.estatus ?? ""}, ${row.empresa ?? ""}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400">ID</span>
                      <span className="text-sm font-extrabold text-emerald-800 dark:text-emerald-300">{row.id ?? "—"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {row.tipoIncidente ? (
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-black uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {row.tipoIncidente}
                        </span>
                      ) : null}
                      <StatusBadge status={row.estatus} tone={incidentStatusTone(row.estatus)} size="sm" />
                    </div>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:text-sm">
                    <div className="truncate">
                      <span className="text-slate-500 dark:text-slate-400">Fecha: </span>
                      <span className="font-semibold text-slate-800 dark:text-slate-100">{row.fecha ?? "—"}</span>
                    </div>
                    <div className="truncate">
                      <span className="text-slate-500 dark:text-slate-400">Empresa: </span>
                      <span className="font-semibold text-slate-800 dark:text-slate-100">{row.empresa ?? "—"}</span>
                    </div>
                    <div className="col-span-2 truncate">
                      <span className="text-slate-500 dark:text-slate-400">Ruta: </span>
                      <span className="font-semibold text-slate-800 dark:text-slate-100">
                        {row.origen ?? "—"} <span className="px-1">→</span> {row.destino ?? "—"}
                      </span>
                    </div>
                    <div className="truncate">
                      <span className="text-slate-500 dark:text-slate-400">Locomotora: </span>
                      <span className="font-semibold text-blue-800 dark:text-blue-300">{row.locomotora ?? "—"}</span>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );

  /** ===== Table (≥ xl) ===== */
  const DesktopTable = (
    <div className="hidden xl:block">
      <div
        className={cn(
          "overflow-x-auto rounded-xl border shadow-sm",
          "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900",
          isStale && "opacity-70"
        )}
      >
        <div className="min-w-[1040px]">
          {/* sticky header for long scrolls */}
          <div
            className={cn(
              "grid grid-cols-8 px-3 py-3 text-center text-sm font-bold",
              "bg-emerald-800 text-white dark:bg-emerald-900",
              "sticky top-0 z-10"
            )}
          >
            <div className="text-left">ID</div>
            <div>Tipo</div>
            <div>Fecha</div>
            <div>Estado</div>
            <div className="hidden lg:block">Empresa</div>
            <div>Origen</div>
            <div>Destino</div>
            <div className="hidden lg:block">Locomotora</div>
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {loading || deferredData.length === 0 ? (
              EmptyOrLoading
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {deferredData.map((row, i) => {
                  return (
                    <button
                      type="button"
                      key={`${row.id}-${i}`}
                      onClick={() => onRowPress?.(row)}
                      onKeyDown={(e) => e.key === "Enter" && onRowPress?.(row)}
                      className={cn(
                        "grid w-full grid-cols-8 px-3 py-3 text-center",
                        "hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-600 dark:hover:bg-slate-800/60",
                        i % 2 === 0 && "bg-slate-50/40 dark:bg-slate-900"
                      )}
                      aria-label={`Abrir incidente ${row.id ?? ""}`}
                    >
                      <div className="truncate text-left font-bold text-emerald-800 dark:text-emerald-300">{row.id ?? "—"}</div>
                      <div className="flex items-center justify-center">
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-black uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {row.tipoIncidente ?? row.fuente ?? "—"}
                        </span>
                      </div>
                      <div className="truncate text-slate-700 dark:text-slate-300">{row.fecha ?? "—"}</div>
                      <div className="flex items-center justify-center">
                        <StatusBadge status={row.estatus} tone={incidentStatusTone(row.estatus)} />
                      </div>
                      <div className="hidden lg:block truncate text-slate-700 dark:text-slate-300">{row.empresa ?? "—"}</div>
                      <div className="truncate text-slate-700 dark:text-slate-300">{row.origen ?? "—"}</div>
                      <div className="truncate text-slate-700 dark:text-slate-300">{row.destino ?? "—"}</div>
                      <div className="hidden lg:block truncate font-bold text-blue-800 dark:text-blue-300">{row.locomotora ?? "—"}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  /** ===== Pagination ===== */
  const Pagination =
    pages > 1 && onPageChange ? (
      <PaginationBar
        page={page}
        totalPages={pages}
        pageSize={pageSize}
        totalItems={totalItems}
        onPageChange={onPageChange}
      />
    ) : null;

  return (
    <section className="flex flex-col gap-3 p-2 sm:p-4" aria-busy={loading}>
      {MobileCards}
      {DesktopTable}
      {Pagination}
    </section>
  );
}

export default React.memo(IncidentesTableComp);
