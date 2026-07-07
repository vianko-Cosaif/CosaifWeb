// src/app/Components/movimientos/Nav.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { Ambito } from "./useMovimientos";
import { Search, RefreshCw, Plus, X, Clock } from "lucide-react";
import { GuidedTarget } from "@/app/Components/GuidedManualAtom";
import { Button, SearchInput } from "@/app/Components/ui";

export interface NavMovimientosProps {
  ambito: Ambito;
  busqueda: string;
  autoActualizacion: boolean;
  estaCargando?: boolean;
  contadores?: { actuales: number; pasados: number };
  puedeCrear?: boolean;
  onCambiarAmbito: (nuevo: Ambito) => void;
  onBuscar: (texto: string) => void;
  onToggleAuto: (activo: boolean) => void;
  onRefrescar: () => void;
  onNuevo: () => void;
  placeholderBusqueda?: string;
  retardoBusquedaMs?: number;
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
  const [textoBusqueda, setTextoBusqueda] = useState<string>(busqueda ?? "");

  useEffect(() => {
    setTextoBusqueda(busqueda ?? "");
  }, [busqueda]);

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
      className="w-full flex flex-col gap-2 sm:gap-3 touch-manipulation"
    >
      {/* Row 1: Tabs + Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Animated Pill Tabs */}
        <div className="relative inline-flex rounded-xl sm:rounded-2xl bg-slate-100/80 dark:bg-slate-800/60 p-0.5 sm:p-1 shadow-inner w-full sm:w-auto">
          {/* Animated indicator */}
          <div
            className="absolute top-0.5 sm:top-1 bottom-0.5 sm:bottom-1 rounded-lg sm:rounded-xl bg-white dark:bg-slate-700 shadow-md transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
            style={{
              left: ambito === "actuales" ? "2px" : "50%",
              width: "calc(50% - 2px)",
            }}
          />
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

        {/* Controls */}
        <div className="flex items-center gap-2 sm:gap-2 justify-between sm:justify-end">
          <label className="inline-flex items-center gap-2 cursor-pointer select-none text-xs text-slate-500 dark:text-slate-400 group min-h-[44px] sm:min-h-0 px-2 touch-manipulation">
            <div className="relative">
              <input
                type="checkbox"
                checked={autoActualizacion}
                onChange={(e) => onToggleAuto(e.target.checked)}
                className="peer sr-only"
              />
              <div className="h-5 w-9 rounded-full bg-slate-200 dark:bg-slate-700 peer-checked:bg-emerald-500 transition-colors duration-200" />
              <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 peer-checked:translate-x-4" />
            </div>
            <span className="inline-flex items-center gap-1 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors">
              <Clock size={16} aria-hidden className={autoActualizacion ? "text-emerald-500" : ""} />
              <span className="hidden xs:inline">Auto</span>
            </span>
          </label>

          <Button
            type="button"
            title={tituloBotonRefrescar}
            onClick={onRefrescar}
            loading={estaCargando}
            variant="secondary"
            size="md"
            className="min-h-[44px] sm:min-h-[38px]"
            leftIcon={<RefreshCw size={18} aria-hidden />}
          >
            <span className="hidden sm:inline">{estaCargando ? "Actualizando…" : "Actualizar"}</span>
          </Button>

          {puedeCrear && (
            <GuidedTarget id="movimientos-new-button" className="inline-flex">
              <GuidedTarget id="client-new-movement" className="inline-flex">
                <Button
                  type="button"
                  onClick={onNuevo}
                  variant="primary"
                  size="md"
                  className="min-h-[44px] sm:min-h-[38px]"
                  disabled={estaCargando}
                  leftIcon={<Plus size={18} aria-hidden />}
                >
                  <span>Nuevo</span>
                </Button>
              </GuidedTarget>
            </GuidedTarget>
          )}
        </div>
      </div>

      {/* Row 2: Search */}
      <div className="relative">
        <SearchInput
          value={textoBusqueda}
          onChange={setTextoBusqueda}
          onClear={() => setTextoBusqueda("")}
          onKeyDown={(event) => {
            if (event.key === "Escape") setTextoBusqueda("");
            if (event.key === "Enter") onBuscar(textoBusqueda);
          }}
          placeholder={placeholderBusqueda}
          label="Buscar movimientos"
          inputClassName="rounded-lg sm:rounded-xl border-slate-200 bg-white/90 backdrop-blur-sm min-h-[44px] text-[16px] sm:text-sm focus:ring-emerald-500/40 focus:border-emerald-400 dark:border-slate-700 dark:bg-slate-900/90 dark:focus:ring-emerald-500/30 dark:focus:border-emerald-500"
        />

        {/* Loading shimmer bar */}
        {estaCargando && (
          <div className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full overflow-hidden">
            <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-emerald-500 to-transparent animate-[shimmer_1.5s_infinite]" />
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
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
        "relative z-10 flex-1 sm:flex-none px-4 sm:px-5 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all duration-200 text-center",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2",
        activo
          ? "text-emerald-700 dark:text-emerald-300"
          : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200",
      ].join(" ")}
    >
      <span className="inline-flex items-center justify-center gap-2">
        {etiqueta}
        {typeof conteo === "number" && (
          <span
            aria-label={`Total ${etiqueta.toLowerCase()}: ${conteo}`}
            className={[
              "inline-flex items-center justify-center",
              "min-w-[1.5rem] h-5 rounded-full px-2 text-[10px] font-bold tabular-nums",
              "transition-all duration-200",
              activo
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                : "bg-slate-200/80 text-slate-600 dark:bg-slate-600/50 dark:text-slate-300",
            ].join(" ")}
          >
            {conteo}
          </span>
        )}
      </span>
    </button>
  );
}
