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

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="min-w-[840px]">
          <div className="grid grid-cols-7 bg-emerald-800 px-2 py-3 text-center text-white text-sm font-bold">
            <div>ID</div>
            <div>Fecha</div>
            <div>Estado</div>
            <div>Empresa</div>
            <div>Origen</div>
            <div>Destino</div>
            <div>Locomotora</div>
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center p-10 text-slate-500">
                Cargando incidentes…
              </div>
            ) : data.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-slate-500">
                {emptyStateText.includes("activos") ? (
                  <AlertCircle className="h-12 w-12 text-slate-300" />
                ) : (
                  <Archive className="h-12 w-12 text-slate-300" />
                )}
                <p className="mt-3 font-medium">{emptyStateText}</p>
                {onRefresh && (
                  <button
                    onClick={onRefresh}
                    className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-white text-sm font-semibold hover:bg-emerald-700"
                    disabled={refreshing}
                  >
                    {refreshing ? "Actualizando…" : "Actualizar"}
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {data.map((row, i) => {
                  const c = statusColors(row.estatus);
                  return (
                    <button
                      key={`${row.id}-${i}`}
                      onClick={() => onRowPress?.(row)}
                      className={clsx(
                        "grid w-full grid-cols-7 px-2 py-3 text-center hover:bg-slate-50",
                        i % 2 === 0 && "bg-slate-50/40"
                      )}
                    >
                      <div className="truncate font-bold text-emerald-800">{row.id ?? "—"}</div>
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

      {pages > 1 && onPageChange && (
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <button
            onClick={() => page > 1 && onPageChange(page - 1)}
            disabled={page === 1}
            className={clsx(
              "inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-semibold",
              page === 1
                ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                : "border-slate-200 bg-slate-50 text-emerald-700 hover:bg-slate-100"
            )}
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </button>

          <div className="text-sm font-semibold text-slate-600">
            Página {page} de {pages}
            {meta.total ? ` (${meta.total} total)` : ""}
          </div>

          <button
            onClick={() => page < pages && onPageChange(page + 1)}
            disabled={page === pages}
            className={clsx(
              "inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-semibold",
              page === pages
                ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                : "border-slate-200 bg-slate-50 text-emerald-700 hover:bg-slate-100"
            )}
          >
            Siguiente
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
