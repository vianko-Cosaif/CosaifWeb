// src/app/Components/movimientos/Nav.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { Ambito } from "./useMovimientos";
import { Search, RefreshCw, Plus, X, Clock } from "lucide-react";

export interface NavMovimientosProps {
  // Estado
  ambito: Ambito; // "actuales" | "pasados"
  busqueda: string;
  autoActualizacion: boolean;
  estaCargando?: boolean;

  // Métricas opcionales para chips
  contadores?: { actuales: number; pasados: number };

  // Permisos
  puedeCrear?: boolean;

  // Callbacks
  onCambiarAmbito: (nuevo: Ambito) => void;
  onBuscar: (texto: string) => void;
  onToggleAuto: (activo: boolean) => void;
  onRefrescar: () => void;
  onNuevo: () => void;

  // UX
  placeholderBusqueda?: string;
  retardoBusquedaMs?: number; // debounce input → onBuscar. Default 300ms.
}

export default function Nav({
  ambito,
  busqueda,
  autoActualizacion,
  estaCargando = false,
  contadores,
  puedeCrear = false,
  onCambiarAmbito,
  onBuscar,
  onToggleAuto,
  onRefrescar,
  onNuevo,
  placeholderBusqueda = "Buscar por locomotora, estado, etc.",
  retardoBusquedaMs = 300,
}: NavMovimientosProps) {
  // Estado local para debounce del campo de búsqueda
  const [textoBusqueda, setTextoBusqueda] = useState<string>(busqueda ?? "");

  // Sincroniza cambios externos al campo
  useEffect(() => {
    setTextoBusqueda(busqueda ?? "");
  }, [busqueda]);

  // Disparador con debounce
  useEffect(() => {
    const id = setTimeout(() => {
      if (textoBusqueda !== busqueda) onBuscar(textoBusqueda);
    }, retardoBusquedaMs);
    return () => clearTimeout(id);
  }, [textoBusqueda, busqueda, onBuscar, retardoBusquedaMs]);

  const totalActuales = contadores?.actuales;
  const totalPasados = contadores?.pasados;

  const tituloBotonRefrescar = useMemo(
    () => (estaCargando ? "Actualizando…" : "Actualizar"),
    [estaCargando]
  );

  return (
    <nav
      aria-label="Navegación de movimientos"
      className="w-full flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4"
    >
      {/* Tabs ámbito */}
      <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 overflow-hidden shadow-sm">
        <TabBoton
          activo={ambito === "actuales"}
          onClick={() => onCambiarAmbito("actuales")}
          etiqueta="Actuales"
          conteo={totalActuales}
        />
        <TabBoton
          activo={ambito === "pasados"}
          onClick={() => onCambiarAmbito("pasados")}
          etiqueta="Pasados"
          conteo={totalPasados}
        />
      </div>

      {/* Búsqueda */}
      <div className="flex-1 md:mx-4">
        <div className="relative">
          <input
            type="search"
            value={textoBusqueda}
            onChange={(e) => setTextoBusqueda(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setTextoBusqueda("");
              if (e.key === "Enter") onBuscar(textoBusqueda);
            }}
            placeholder={placeholderBusqueda}
            aria-label="Buscar movimientos"
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900 pl-9 pr-10 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/80 focus:border-emerald-500 transition-shadow"
          />
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">
            <Search size={16} aria-hidden />
          </span>
          {textoBusqueda ? (
            <button
              type="button"
              aria-label="Limpiar búsqueda"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500"
              onClick={() => setTextoBusqueda("")}
            >
              <X size={14} aria-hidden />
            </button>
          ) : null}
        </div>
      </div>

      {/* Controles: Auto, Refrescar, Nuevo */}
      <div className="flex items-center gap-2 justify-end">
        <label className="inline-flex items-center gap-2 cursor-pointer select-none text-xs sm:text-sm text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            checked={autoActualizacion}
            onChange={(e) => onToggleAuto(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-emerald-600 focus:ring-emerald-500"
          />
          <span className="inline-flex items-center gap-1">
            <Clock size={16} aria-hidden />
            Auto
          </span>
        </label>

        <button
          type="button"
          title={tituloBotonRefrescar}
          onClick={onRefrescar}
          disabled={estaCargando}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900 px-3 py-2 text-xs sm:text-sm text-slate-700 dark:text-slate-100 hover:border-emerald-500 hover:text-emerald-600 dark:hover:border-emerald-500 dark:hover:text-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <RefreshCw
            size={16}
            aria-hidden
            className={estaCargando ? "animate-spin" : ""}
          />
          <span>{estaCargando ? "Actualizando…" : "Actualizar"}</span>
        </button>

        {puedeCrear && (
          <button
            type="button"
            onClick={onNuevo}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 text-white px-3 py-2 text-xs sm:text-sm font-semibold shadow-sm hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={estaCargando}
          >
            <Plus size={16} aria-hidden />
            <span>Nuevo</span>
          </button>
        )}
      </div>
    </nav>
  );
}

/* ========= Subcomponente interno ========= */
function TabBoton({
  activo,
  onClick,
  etiqueta,
  conteo,
}: {
  activo: boolean;
  onClick: () => void;
  etiqueta: string;
  conteo?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={[
        "px-4 py-2 text-xs sm:text-sm font-semibold transition-colors",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
        activo
          ? "bg-emerald-600 text-white"
          : "bg-transparent text-slate-700 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/70",
      ].join(" ")}
    >
      <span className="inline-flex items-center gap-2">
        {etiqueta}
        {typeof conteo === "number" && (
          <span
            aria-label={`Total ${etiqueta.toLowerCase()}: ${conteo}`}
            className={[
              "inline-flex items-center justify-center",
              "min-w-[1.5rem] h-5 rounded-full px-2 text-[11px] font-bold",
              activo
                ? "bg-white/20 text-white"
                : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-100",
            ].join(" ")}
          >
            {conteo}
          </span>
        )}
      </span>
    </button>
  );
}
