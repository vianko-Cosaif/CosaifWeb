// src/app/Components/movimientos/Filtros.tsx
"use client";

import React, { useMemo, useState } from "react";
import type {
  FiltrosMovimientos,
  OpcionEmpresa,
  OpcionLocalidad,
} from "./useMovimientos";
import { Eraser, Calendar, ChevronDown, SlidersHorizontal, X } from "lucide-react";

export interface FiltrosProps {
  filtros: Pick<
    FiltrosMovimientos,
    "empresaId" | "localidadId" | "desde" | "hasta" | "tamPagina"
  >;
  listaEmpresas: OpcionEmpresa[];
  listaLocalidades: OpcionLocalidad[];
  puedeElegirEmpresa: boolean;

  onCambiarEmpresaId: (id: number | null) => void;
  onCambiarLocalidadId: (id: number | null) => void;
  onCambiarRangoFechas: (desde: string | null, hasta: string | null) => void;
  onCambiarTamPagina: (tam: number) => void;
  onLimpiarFiltros: () => void;

  deshabilitado?: boolean;
}

export default function Filtros({
  filtros,
  listaEmpresas,
  listaLocalidades,
  puedeElegirEmpresa,
  onCambiarEmpresaId,
  onCambiarLocalidadId,
  onCambiarRangoFechas,
  onCambiarTamPagina,
  onLimpiarFiltros,
  deshabilitado = false,
}: FiltrosProps) {
  const [abierto, setAbierto] = useState(false);

  const handleEmpresaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    onCambiarEmpresaId(val === "" ? null : Number(val));
  };

  const handleLocalidadChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!puedeElegirEmpresa) return;
    const val = e.target.value;
    onCambiarLocalidadId(val === "" ? null : Number(val));
  };

  const handleDesdeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nuevoDesde = e.target.value || null;
    onCambiarRangoFechas(nuevoDesde, filtros.hasta ?? null);
  };

  const handleHastaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nuevoHasta = e.target.value || null;
    onCambiarRangoFechas(filtros.desde ?? null, nuevoHasta);
  };

  const handleTamPaginaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const n = Number(e.target.value);
    if (!Number.isNaN(n)) onCambiarTamPagina(n);
  };

  /* Active filter chips */
  const activeFilters = useMemo(() => {
    const chips: { key: string; label: string; onRemove: () => void }[] = [];
    if (filtros.empresaId != null) {
      const emp = listaEmpresas.find((e) => e.id === filtros.empresaId);
      chips.push({
        key: "empresa",
        label: `Empresa: ${emp?.nombre ?? filtros.empresaId}`,
        onRemove: () => onCambiarEmpresaId(null),
      });
    }
    if (filtros.localidadId != null) {
      const loc = listaLocalidades.find((l) => l.id === filtros.localidadId);
      chips.push({
        key: "localidad",
        label: `Localidad: ${loc?.nombre ?? filtros.localidadId}`,
        onRemove: () => onCambiarLocalidadId(null),
      });
    }
    if (filtros.desde) {
      chips.push({
        key: "desde",
        label: `Desde: ${filtros.desde}`,
        onRemove: () => onCambiarRangoFechas(null, filtros.hasta ?? null),
      });
    }
    if (filtros.hasta) {
      chips.push({
        key: "hasta",
        label: `Hasta: ${filtros.hasta}`,
        onRemove: () => onCambiarRangoFechas(filtros.desde ?? null, null),
      });
    }
    return chips;
  }, [filtros, listaEmpresas, listaLocalidades, onCambiarEmpresaId, onCambiarLocalidadId, onCambiarRangoFechas]);

  const cantidadActivos = activeFilters.length;

  const selectClass =
    "w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 min-h-[44px] text-[16px] sm:text-sm text-slate-800 dark:text-slate-100 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-400 dark:focus:ring-emerald-500/30 dark:focus:border-emerald-500 transition-all duration-200 appearance-none";

  const inputClass =
    "w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 pr-9 min-h-[44px] text-[16px] sm:text-sm text-slate-800 dark:text-slate-100 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-400 dark:focus:ring-emerald-500/30 dark:focus:border-emerald-500 transition-all duration-200";

  return (
    <section aria-label="Filtros de movimientos" className="w-full min-w-0">
      {/* Toggle bar */}
      <button
        type="button"
        onClick={() => setAbierto((prev) => !prev)}
        className="w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100/60 dark:hover:bg-slate-800/40 transition-colors duration-150"
      >
        <span className="inline-flex items-center gap-2">
          <SlidersHorizontal size={15} className="text-slate-400 dark:text-slate-500" />
          Filtros
          {cantidadActivos > 0 && (
            <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 px-1.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
              {cantidadActivos}
            </span>
          )}
        </span>
        <ChevronDown
          size={16}
          className={`text-slate-400 transition-transform duration-300 ${abierto ? "rotate-180" : ""}`}
        />
      </button>

      {/* Active filter chips */}
      {cantidadActivos > 0 && !abierto && (
        <div className="flex flex-wrap gap-1.5 px-3 pb-2 mt-1">
          {activeFilters.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300"
            >
              {chip.label}
              <button
                type="button"
                onClick={chip.onRemove}
                className="ml-0.5 p-0.5 rounded hover:bg-emerald-100 dark:hover:bg-emerald-800/40 transition-colors"
                disabled={deshabilitado}
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Collapsible filter panel */}
      <div
        className={`grid transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${abierto ? "grid-rows-[1fr] opacity-100 mt-2" : "grid-rows-[0fr] opacity-0"
          }`}
      >
        <div className="overflow-hidden">
          <div className="rounded-xl border border-slate-100 dark:border-slate-800/60 bg-slate-50/40 dark:bg-slate-900/30 p-3 sm:p-4">
            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-12 items-end">
              {/* Empresa */}
              <div className="min-w-0 xl:col-span-3">
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                  Empresa
                </label>
                <select
                  className={selectClass}
                  disabled={deshabilitado}
                  value={stringOrVacio(filtros.empresaId ?? null)}
                  onChange={handleEmpresaChange}
                >
                  <option value="">Todas</option>
                  {listaEmpresas.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nombre}
                    </option>
                  ))}
                </select>
              </div>

              {/* Localidad */}
              <div className="min-w-0 xl:col-span-3">
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                  Localidad
                </label>
                <select
                  className={selectClass}
                  disabled={!puedeElegirEmpresa || deshabilitado}
                  value={stringOrVacio(filtros.localidadId ?? null)}
                  onChange={handleLocalidadChange}
                >
                  {puedeElegirEmpresa && <option value="">Todas</option>}
                  {listaLocalidades.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.nombre}
                      {"estado" in loc && (loc as any).estado
                        ? ` (${(loc as any).estado})`
                        : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Desde */}
              <div className="min-w-0 xl:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                  Desde
                </label>
                <div className="relative">
                  <input
                    type="date"
                    className={inputClass}
                    disabled={deshabilitado}
                    value={toInputDate(filtros.desde ?? null)}
                    onChange={handleDesdeChange}
                  />
                  <Calendar
                    size={15}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 opacity-50 pointer-events-none text-slate-400 dark:text-slate-500"
                    aria-hidden
                  />
                </div>
              </div>

              {/* Hasta */}
              <div className="min-w-0 xl:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                  Hasta
                </label>
                <div className="relative">
                  <input
                    type="date"
                    className={inputClass}
                    disabled={deshabilitado}
                    value={toInputDate(filtros.hasta ?? null)}
                    onChange={handleHastaChange}
                  />
                  <Calendar
                    size={15}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 opacity-50 pointer-events-none text-slate-400 dark:text-slate-500"
                    aria-hidden
                  />
                </div>
              </div>

              {/* Tamaño de página */}
              <div className="min-w-0 xl:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                  Por página
                </label>
                <select
                  className={selectClass}
                  disabled={deshabilitado}
                  value={filtros.tamPagina}
                  onChange={handleTamPaginaChange}
                >
                  {[10, 25, 50, 100].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>

              {/* Acciones */}
              <div className="min-w-0 col-span-1 sm:col-span-2 xl:col-span-12 flex gap-2 justify-stretch xl:justify-end pt-1">
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 w-full sm:w-auto text-xs font-medium text-slate-600 dark:text-slate-300 hover:border-rose-300 hover:text-rose-600 dark:hover:border-rose-500 dark:hover:text-rose-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 active:scale-[0.97]"
                  onClick={onLimpiarFiltros}
                  disabled={deshabilitado}
                >
                  <Eraser size={15} aria-hidden />
                  Limpiar filtros
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ===== Utilidades locales ===== */
function toInputDate(valor: string | null | undefined): string {
  if (!valor) return "";
  return valor.length >= 10 ? valor.slice(0, 10) : "";
}

function stringOrVacio(id: number | null | undefined): string {
  return typeof id === "number" ? String(id) : "";
}
