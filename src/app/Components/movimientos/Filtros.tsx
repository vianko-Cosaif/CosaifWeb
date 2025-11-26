// src/app/Components/movimientos/Filtros.tsx
"use client";

import React from "react";
import type {
  FiltrosMovimientos,
  OpcionEmpresa,
  OpcionLocalidad,
} from "./useMovimientos";
import { Eraser, Calendar } from "lucide-react";

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
  const handleEmpresaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!puedeElegirEmpresa) return;
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

  return (
    <section
      aria-label="Filtros de movimientos"
      className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 p-3 sm:p-4 mb-4 shadow-sm"
    >
      {/* 
        Mobile-first:
        - 1 columna en XS
        - 2 columnas en SM
        - 12 columnas en XL para layout fino de escritorio
      */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-12 items-end">
        {/* Empresa */}
        <div className="min-w-0 xl:col-span-3">
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
            Empresa
          </label>
          <select
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-emerald-500/80 focus:border-emerald-500"
            disabled={!puedeElegirEmpresa || deshabilitado}
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
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
            Localidad
          </label>
          <select
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-emerald-500/80 focus:border-emerald-500"
            disabled={!puedeElegirEmpresa || deshabilitado}
            value={stringOrVacio(filtros.localidadId ?? null)}
            onChange={handleLocalidadChange}
          >
            <option value="">Todas</option>
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
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
            Desde
          </label>
          <div className="relative">
            <input
              type="date"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 pr-9 text-sm text-slate-800 dark:text-slate-100 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-emerald-500/80 focus:border-emerald-500"
              disabled={deshabilitado}
              value={toInputDate(filtros.desde ?? null)}
              onChange={handleDesdeChange}
            />
            <Calendar
              size={16}
              className="absolute right-2 top-1/2 -translate-y-1/2 opacity-70 pointer-events-none text-slate-400 dark:text-slate-500"
              aria-hidden
            />
          </div>
        </div>

        {/* Hasta */}
        <div className="min-w-0 xl:col-span-2">
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
            Hasta
          </label>
          <div className="relative">
            <input
              type="date"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 pr-9 text-sm text-slate-800 dark:text-slate-100 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-emerald-500/80 focus:border-emerald-500"
              disabled={deshabilitado}
              value={toInputDate(filtros.hasta ?? null)}
              onChange={handleHastaChange}
            />
            <Calendar
              size={16}
              className="absolute right-2 top-1/2 -translate-y-1/2 opacity-70 pointer-events-none text-slate-400 dark:text-slate-500"
              aria-hidden
            />
          </div>
        </div>

        {/* Tamaño de página */}
        <div className="min-w-0 xl:col-span-2">
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
            Por página
          </label>
          <select
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-emerald-500/80 focus:border-emerald-500"
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
        <div className="min-w-0 sm:col-span-2 xl:col-span-12 flex gap-2 justify-stretch xl:justify-end">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 w-full sm:w-auto text-xs sm:text-sm text-slate-700 dark:text-slate-100 hover:border-rose-400 hover:text-rose-600 dark:hover:border-rose-500 dark:hover:text-rose-400 disabled:opacity-60 disabled:cursor-not-allowed"
            onClick={onLimpiarFiltros}
            disabled={deshabilitado}
          >
            <Eraser size={16} aria-hidden />
            Limpiar
          </button>
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
