/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useDeferredValue, useMemo } from "react";
import { ChevronLeft, ChevronRight, Archive, AlertCircle } from "lucide-react";
import type { IncidenteRow, Meta } from "./types";

function clsx(...xs: (string | false | undefined)[]) {
  return xs.filter(Boolean).join(" ");
}

const statusColors = (s?: string) => {
  switch ((s || "").toLowerCase()) {
    case "activo":
      return { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-200" };
    case "cerrado":
      return { bg: "bg-rose-100 dark:bg-rose-900/30", text: "text-rose-700 dark:text-rose-200" };
    case "resuelto":
      return { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-200" };
    default:
      return { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-600 dark:text-slate-300" };
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

  // Suaviza renders cuando llegan lotes grandes (mejor UX en móviles)
  const deferredData = useDeferredValue(data);
  const isStale = deferredData !== data;

  /** ===== Empty / Loading ===== */
  const EmptyOrLoading = (
    <div
      className="flex flex-col items-center justify-center p-10 text-slate-500 dark:text-slate-400"
      role="status"
      aria-live="polite"
    >
      {loading ? (
        <div className="w-full max-w-sm space-y-3">
          <div className="h-4 w-1/3 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
          <div className="h-16 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" />
          <div className="h-16 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" />
        </div>
      ) : (
        <>
          {emptyStateText.toLowerCase().includes("activo") ? (
            <AlertCircle className="h-12 w-12 text-slate-300 dark:text-slate-600" aria-hidden />
          ) : (
            <Archive className="h-12 w-12 text-slate-300 dark:text-slate-600" aria-hidden />
          )}
          <p className="mt-3 font-medium text-center">{emptyStateText}</p>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 dark:bg-emerald-700 dark:hover:bg-emerald-600"
              disabled={refreshing}
            >
              {refreshing ? "Actualizando…" : "Actualizar"}
            </button>
          )}
        </>
      )}
    </div>
  );

  /** ===== Card list (< xl) ===== */
  const MobileCards = (
    <div className="xl:hidden">
      {loading || deferredData.length === 0 ? (
        EmptyOrLoading
      ) : (
        <ul className="space-y-2">
          {deferredData.map((row, i) => {
            const c = statusColors(row.estatus);
            return (
              <li key={`${row.id}-${i}`}>
                <button
                  onClick={() => onRowPress?.(row)}
                  onKeyDown={(e) => e.key === "Enter" && onRowPress?.(row)}
                  className={clsx(
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
                    <span className={clsx("rounded-full px-2.5 py-1 text-[10px] font-bold", c.bg, c.text)}>
                      {row.estatus ?? "—"}
                    </span>
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
        className={clsx(
          "overflow-x-auto rounded-xl border shadow-sm",
          "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900",
          isStale && "opacity-70"
        )}
      >
        <div className="min-w-[900px]">
          {/* sticky header for long scrolls */}
          <div
            className={clsx(
              "grid grid-cols-7 px-3 py-3 text-center text-sm font-bold",
              "bg-emerald-800 text-white dark:bg-emerald-900",
              "sticky top-0 z-10"
            )}
          >
            <div className="text-left">ID</div>
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
                  const c = statusColors(row.estatus);
                  return (
                    <button
                      key={`${row.id}-${i}`}
                      onClick={() => onRowPress?.(row)}
                      onKeyDown={(e) => e.key === "Enter" && onRowPress?.(row)}
                      className={clsx(
                        "grid w-full grid-cols-7 px-3 py-3 text-center",
                        "hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-600 dark:hover:bg-slate-800/60",
                        i % 2 === 0 && "bg-slate-50/40 dark:bg-slate-900"
                      )}
                      aria-label={`Abrir incidente ${row.id ?? ""}`}
                    >
                      <div className="truncate text-left font-bold text-emerald-800 dark:text-emerald-300">{row.id ?? "—"}</div>
                      <div className="truncate text-slate-700 dark:text-slate-300">{row.fecha ?? "—"}</div>
                      <div className="flex items-center justify-center">
                        <span className={clsx("rounded-full px-3 py-1 text-xs font-bold", c.bg, c.text)}>
                          {row.estatus ?? "—"}
                        </span>
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
      <nav
        className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-2 py-2 shadow-sm md:px-4 md:py-3 dark:border-slate-700 dark:bg-slate-900"
        aria-label="Paginación"
      >
        <button
          onClick={() => page > 1 && onPageChange(page - 1)}
          disabled={page === 1}
          aria-label="Anterior"
          className={clsx(
            "inline-flex items-center gap-1 rounded-lg border px-2 py-2 text-sm font-semibold md:px-3",
            page === 1
              ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-600"
              : "border-slate-200 bg-slate-50 text-emerald-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-emerald-300 dark:hover:bg-slate-800"
          )}
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden md:inline">Anterior</span>
        </button>

        <div className="text-xs font-semibold text-slate-600 md:text-sm dark:text-slate-300">
          Página {page} de {pages}
          {meta.total ? ` (${meta.total} total)` : ""}
        </div>

        <button
          onClick={() => page < pages && onPageChange(page + 1)}
          disabled={page === pages}
          aria-label="Siguiente"
          className={clsx(
            "inline-flex items-center gap-1 rounded-lg border px-2 py-2 text-sm font-semibold md:px-3",
            page === pages
              ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-600"
              : "border-slate-200 bg-slate-50 text-emerald-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-emerald-300 dark:hover:bg-slate-800"
          )}
        >
          <span className="hidden md:inline">Siguiente</span>
          <ChevronRight className="h-4 w-4" />
        </button>
      </nav>
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
