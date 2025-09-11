/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import React from "react";
import { ChevronLeft, ChevronRight, Archive, AlertCircle } from "lucide-react";
import type { IncidenteRow, Meta } from "./types";

function clsx(...xs: (string | false | undefined)[]) {
  return xs.filter(Boolean).join(" ");
}

const statusColors = (s?: string) => {
  switch ((s || "").toLowerCase()) {
    case "activo":
      return { bg: "bg-emerald-100", text: "text-emerald-700" };
    case "cerrado":
      return { bg: "bg-rose-100", text: "text-rose-700" };
    case "resuelto":
      return { bg: "bg-blue-100", text: "text-blue-700" };
    default:
      return { bg: "bg-slate-100", text: "text-slate-600" };
  }
};

export default function IncidentesTable({
  data = [],
  loading = false,
  meta = { page: 1, totalPages: 1 },
  onRowPress,
  onPageChange,
  onRefresh,
  refreshing = false,
  emptyStateText = "No hay incidentes para mostrar",
}: {
  data?: IncidenteRow[];
  loading?: boolean;
  meta?: Meta;
  onRowPress?: (r: IncidenteRow) => void;
  onPageChange?: (p: number) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  emptyStateText?: string;
}) {
  const page = Number(meta.page) || 1;
  const pages = Number(meta.totalPages) || 1;

  /** ===== Empty / Loading ===== */
  const EmptyOrLoading = (
    <div className="flex flex-col items-center justify-center p-10 text-slate-500">
      {loading ? (
        <div className="w-full max-w-sm space-y-3">
          <div className="h-4 w-1/3 animate-pulse rounded bg-slate-200" />
          <div className="h-16 animate-pulse rounded-lg bg-slate-200" />
          <div className="h-16 animate-pulse rounded-lg bg-slate-200" />
        </div>
      ) : (
        <>
          {emptyStateText.includes("activos") ? (
            <AlertCircle className="h-12 w-12 text-slate-300" />
          ) : (
            <Archive className="h-12 w-12 text-slate-300" />
          )}
          <p className="mt-3 font-medium text-center">{emptyStateText}</p>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-white text-sm font-semibold hover:bg-emerald-700"
              disabled={refreshing}
            >
              {refreshing ? "Actualizando…" : "Actualizar"}
            </button>
          )}
        </>
      )}
    </div>
  );

  /** ===== Card list for mobile ===== */
  const MobileCards = (
    <div className="md:hidden">
      {loading || data.length === 0 ? (
        EmptyOrLoading
      ) : (
        <ul className="space-y-2">
          {data.map((row, i) => {
            const c = statusColors(row.estatus);
            return (
              <li key={`${row.id}-${i}`}>
                <button
                  onClick={() => onRowPress?.(row)}
                  onKeyDown={(e) => e.key === "Enter" && onRowPress?.(row)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-500">ID</span>
                      <span className="text-sm font-extrabold text-emerald-800">{row.id ?? "—"}</span>
                    </div>
                    <span className={clsx("rounded-full px-2.5 py-1 text-[10px] font-bold", c.bg, c.text)}>
                      {row.estatus ?? "—"}
                    </span>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:text-sm">
                    <div className="truncate">
                      <span className="text-slate-500">Fecha: </span>
                      <span className="font-semibold text-slate-800">{row.fecha ?? "—"}</span>
                    </div>
                    <div className="truncate">
                      <span className="text-slate-500">Empresa: </span>
                      <span className="font-semibold text-slate-800">{row.empresa ?? "—"}</span>
                    </div>
                    <div className="col-span-2 truncate">
                      <span className="text-slate-500">Ruta: </span>
                      <span className="font-semibold text-slate-800">
                        {row.origen ?? "—"} <span className="px-1">→</span> {row.destino ?? "—"}
                      </span>
                    </div>
                    <div className="truncate">
                      <span className="text-slate-500">Locomotora: </span>
                      <span className="font-semibold text-blue-800">{row.locomotora ?? "—"}</span>
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

  /** ===== Table for ≥ md ===== */
  const DesktopTable = (
    <div className="hidden md:block">
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="min-w-[960px]">
          <div className="grid grid-cols-7 bg-emerald-800 px-3 py-3 text-center text-white text-sm font-bold">
            <div className="text-left">ID</div>
            <div>Fecha</div>
            <div>Estado</div>
            <div>Empresa</div>
            <div>Origen</div>
            <div>Destino</div>
            <div>Locomotora</div>
          </div>

          <div className="max-h-[520px] overflow-y-auto">
            {loading || data.length === 0 ? (
              EmptyOrLoading
            ) : (
              <div className="divide-y divide-slate-100">
                {data.map((row, i) => {
                  const c = statusColors(row.estatus);
                  return (
                    <button
                      key={`${row.id}-${i}`}
                      onClick={() => onRowPress?.(row)}
                      onKeyDown={(e) => e.key === "Enter" && onRowPress?.(row)}
                      className={clsx(
                        "grid w-full grid-cols-7 px-3 py-3 text-center hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-600",
                        i % 2 === 0 && "bg-slate-50/40"
                      )}
                    >
                      <div className="truncate text-left font-bold text-emerald-800">{row.id ?? "—"}</div>
                      <div className="truncate text-slate-700">{row.fecha ?? "—"}</div>
                      <div className="flex items-center justify-center">
                        <span className={clsx("rounded-full px-3 py-1 text-xs font-bold", c.bg, c.text)}>
                          {row.estatus ?? "—"}
                        </span>
                      </div>
                      <div className="truncate text-slate-700">{row.empresa ?? "—"}</div>
                      <div className="truncate text-slate-700">{row.origen ?? "—"}</div>
                      <div className="truncate text-slate-700">{row.destino ?? "—"}</div>
                      <div className="truncate font-bold text-blue-800">{row.locomotora ?? "—"}</div>
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
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-2 py-2 shadow-sm md:px-4 md:py-3">
        <button
          onClick={() => page > 1 && onPageChange(page - 1)}
          disabled={page === 1}
          aria-label="Anterior"
          className={clsx(
            "inline-flex items-center gap-1 rounded-lg border px-2 py-2 text-sm font-semibold md:px-3",
            page === 1
              ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
              : "border-slate-200 bg-slate-50 text-emerald-700 hover:bg-slate-100"
          )}
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden md:inline">Anterior</span>
        </button>

        <div className="text-xs font-semibold text-slate-600 md:text-sm">
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
              ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
              : "border-slate-200 bg-slate-50 text-emerald-700 hover:bg-slate-100"
          )}
        >
          <span className="hidden md:inline">Siguiente</span>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    ) : null;

  return (
    <div className="flex flex-col gap-3 p-2 sm:p-4">
      {MobileCards}
      {DesktopTable}
      {Pagination}
    </div>
  );
}
