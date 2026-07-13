import { CalendarDays, Plus, RefreshCw, Search } from "lucide-react";
import type { Ambito } from "../types";

type Props = {
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
};

export function MovimientoToolbar({
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
}: Props) {
  return (
    <section className="space-y-3 rounded-xl border border-slate-100 bg-gradient-to-b from-slate-50/80 to-white px-2 py-2 shadow-sm sm:rounded-2xl sm:px-4 sm:py-4">
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
