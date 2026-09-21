// src/app/Components/movimientos/Filtros.tsx
"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import type {
  Ambito,
  FiltrosMovimientos,
  OpcionEmpresa,
  OpcionLocalidad,
} from "./useMovimientos";
import { CURRENT_QUEUE_STATES, MOVEMENT_STATES } from "./filterRules";
import { Eraser, Calendar, ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { useMediaQuery } from "@/hooks/useMediaQuery";

export interface FiltrosProps {
  filtros: Pick<
    FiltrosMovimientos,
    | "empresaId"
    | "localidadId"
    | "desde"
    | "hasta"
    | "tamPagina"
    | "estado"
    | "prioridad"
    | "locomotiveNumber"
    | "fechaCampo"
  >;
  listaEmpresas: OpcionEmpresa[];
  listaLocalidades: OpcionLocalidad[];
  puedeElegirEmpresa?: boolean;
  puedeElegirLocalidad: boolean;
  ambito?: Ambito;
  actualesCompartidos?: boolean;
  estadosPermitidos?: readonly string[];

  onCambiarEmpresaId: (id: number | null) => void;
  onCambiarLocalidadId: (id: number | null) => void;
  onCambiarRangoFechas: (desde: string | null, hasta: string | null) => void;
  onCambiarEstado: (estado: string | null) => void;
  onCambiarPrioridad: (prioridad: string | null) => void;
  onCambiarLocomotiveNumber: (value: string | null) => void;
  onCambiarFechaCampo: (value: string | null) => void;
  onCambiarTamPagina: (tam: number) => void;
  onLimpiarFiltros: () => void;

  deshabilitado?: boolean;
  mostrarFiltrosTiempo?: boolean;
  expandirPorCapacitacion?: boolean;
}

export default function Filtros({
  filtros,
  listaEmpresas,
  listaLocalidades,
  puedeElegirEmpresa = true,
  puedeElegirLocalidad,
  ambito = "actuales",
  actualesCompartidos = false,
  estadosPermitidos,
  onCambiarEmpresaId,
  onCambiarLocalidadId,
  onCambiarRangoFechas,
  onCambiarEstado,
  onCambiarPrioridad,
  onCambiarLocomotiveNumber,
  onCambiarFechaCampo,
  onCambiarTamPagina,
  onLimpiarFiltros,
  deshabilitado = false,
  mostrarFiltrosTiempo = true,
  expandirPorCapacitacion = false,
}: FiltrosProps) {
  const filterId = useId();
  const panelId = `${filterId}-panel`;
  const advancedId = `${filterId}-advanced`;
  const stateOptionsId = `${filterId}-states`;
  const dateErrorId = `${filterId}-date-error`;
  const stateButtonRef = useRef<HTMLButtonElement>(null);
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [abiertoManual, setAbiertoManual] = useState<boolean | null>(null);
  useEffect(() => {
    if (expandirPorCapacitacion) setAbiertoManual(true);
  }, [expandirPorCapacitacion]);
  const [mostrarAvanzados, setMostrarAvanzados] = useState(() => {
    return Boolean(
      filtros.prioridad ||
      filtros.desde ||
      filtros.hasta ||
      (filtros.tamPagina && filtros.tamPagina !== 25)
    );
  });
  const [showEstadoDropdown, setShowEstadoDropdown] = useState(false);

  const estados = useMemo<readonly string[]>(() => estadosPermitidos ?? (ambito === "pasados"
    ? MOVEMENT_STATES.pasados
    : actualesCompartidos
      ? CURRENT_QUEUE_STATES
      : MOVEMENT_STATES.actuales), [ambito, actualesCompartidos, estadosPermitidos]);
  useEffect(() => {
    const raw = filtros.estado ?? "";
    const next = raw.split(",").map(value => value.trim()).filter(value => estados.includes(value)).join(",");
    if (next !== raw) onCambiarEstado(next || null);
  }, [estados, filtros.estado, onCambiarEstado]);
  const desdeInput = toInputDateTime(filtros.desde);
  const hastaInput = toInputDateTime(filtros.hasta);
  const rangoInvertido = mostrarFiltrosTiempo && Boolean(desdeInput && hastaInput && desdeInput > hastaInput);

  const handleEmpresaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!puedeElegirEmpresa || deshabilitado) return;
    const val = e.target.value;
    onCambiarEmpresaId(val === "" ? null : Number(val));
  };

  const handleLocalidadChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!puedeElegirLocalidad || deshabilitado) return;
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

  const handleEstadoToggle = (estado: string) => {
    if (deshabilitado || !estados.includes(estado)) return;
    const raw = filtros.estado ?? "";
    const set = new Set(
      raw
        .split(",")
        .map((s) => s.trim())
        .filter((value) => estados.includes(value))
    );
    if (set.has(estado)) {
      set.delete(estado);
    } else {
      set.add(estado);
    }
    const next = Array.from(set).join(",");
    onCambiarEstado(next ? next : null);
  };

  const handlePrioridadChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value || null;
    onCambiarPrioridad(val);
  };

  const handleLocoNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value || null;
    onCambiarLocomotiveNumber(val);
  };

  const handleFechaCampoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value || null;
    onCambiarFechaCampo(val);
  };

  const handleTamPaginaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const n = Number(e.target.value);
    if (!Number.isNaN(n)) onCambiarTamPagina(n);
  };

  const applyDatePreset = (field: "solicitud" | "inicio" | "fin" | "creacion", from: Date, to: Date) => {
    onCambiarFechaCampo(field);
    onCambiarRangoFechas(toLocalDateTimeInput(from), toLocalDateTimeInput(to));
  };

  const applyTodayPreset = (field: "inicio" | "fin") => {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 0);
    applyDatePreset(field, from, to);
  };

  const applyLastHoursPreset = (hours: number) => {
    const to = new Date();
    const from = new Date(to.getTime() - hours * 60 * 60 * 1000);
    applyDatePreset("inicio", from, to);
  };

  const clearDateRange = () => {
    onCambiarRangoFechas(null, null);
  };

  /* Active filter chips */
  const activeFilters = useMemo(() => {
    const chips: { key: string; label: string; onRemove?: () => void; locked?: boolean }[] = [];
    if (filtros.empresaId != null) {
      const emp = listaEmpresas.find((e) => e.id === filtros.empresaId);
      chips.push({
        key: "empresa",
        label: `Empresa: ${emp?.nombre ?? filtros.empresaId}`,
        locked: !puedeElegirEmpresa,
        onRemove: puedeElegirEmpresa ? () => onCambiarEmpresaId(null) : undefined,
      });
    }
    if (filtros.localidadId != null) {
      const loc = listaLocalidades.find((l) => l.id === filtros.localidadId);
      chips.push({
        key: "localidad",
        label: `Localidad: ${loc?.nombre ?? filtros.localidadId}`,
        locked: !puedeElegirLocalidad,
        onRemove: !puedeElegirLocalidad
          ? undefined
          : () => onCambiarLocalidadId(null),
      });
    }
    if (mostrarFiltrosTiempo && filtros.desde) {
      chips.push({
        key: "desde",
        label: `Desde: ${formatFilterDate(filtros.desde)}`,
        onRemove: () => onCambiarRangoFechas(null, filtros.hasta ?? null),
      });
    }
    if (mostrarFiltrosTiempo && filtros.hasta) {
      chips.push({
        key: "hasta",
        label: `Hasta: ${formatFilterDate(filtros.hasta)}`,
        onRemove: () => onCambiarRangoFechas(filtros.desde ?? null, null),
      });
    }
    if (filtros.estado) {
      chips.push({
        key: "estado",
        label: `Estado: ${filtros.estado.replaceAll("_", " ")}`,
        onRemove: () => onCambiarEstado(null),
      });
    }
    if (filtros.prioridad) {
      chips.push({
        key: "prioridad",
        label: `Prioridad: ${filtros.prioridad}`,
        onRemove: () => onCambiarPrioridad(null),
      });
    }
    if (filtros.locomotiveNumber) {
      chips.push({
        key: "loco",
        label: `Locomotora: ${filtros.locomotiveNumber}`,
        onRemove: () => onCambiarLocomotiveNumber(null),
      });
    }
    if (mostrarFiltrosTiempo && (filtros.desde || filtros.hasta) && filtros.fechaCampo) {
      chips.push({
        key: "fechaCampo",
        label: `Fecha: ${filtros.fechaCampo}`,
        onRemove: () => onCambiarFechaCampo(null),
      });
    }
    return chips;
  }, [
    filtros,
    listaEmpresas,
    listaLocalidades,
    onCambiarEmpresaId,
    onCambiarLocalidadId,
    onCambiarRangoFechas,
    onCambiarEstado,
    onCambiarPrioridad,
    onCambiarLocomotiveNumber,
    onCambiarFechaCampo,
    puedeElegirEmpresa,
    puedeElegirLocalidad,
    mostrarFiltrosTiempo,
  ]);

  const cantidadActivos = activeFilters.filter((chip) => !chip.locked).length;
  const tieneAjustesManuales = cantidadActivos > 0 || (filtros.tamPagina > 0 && filtros.tamPagina !== 25);
  const abierto = abiertoManual ?? (isDesktop || tieneAjustesManuales || expandirPorCapacitacion);

  const controlClass = "w-full min-w-0 min-h-11 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2.5 text-base text-[var(--app-text)] outline-none disabled:cursor-not-allowed disabled:bg-[var(--app-surface-muted)] disabled:text-[var(--app-text-muted)] focus:border-[var(--app-accent)] focus:ring-2 focus:ring-[var(--app-focus)] sm:text-sm";
  const selectClass = controlClass;
  const inputClass = `${controlClass} pr-9`;
  const inputPlain = controlClass;

  return (
    <section aria-label="Filtros de movimientos" className="w-full min-w-0">
      {/* Toggle bar */}
      <button
        type="button"
        onClick={() => {
          setAbiertoManual(!abierto);
          setShowEstadoDropdown(false);
        }}
        aria-label={abierto ? "Ocultar filtros de movimientos" : "Mostrar filtros de movimientos"}
        aria-expanded={abierto}
        aria-controls={panelId}
        className="w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100/60 dark:hover:bg-slate-800/40 transition-colors duration-150"
      >
        <span className="inline-flex items-center gap-2">
          <SlidersHorizontal size={15} className="text-slate-400 dark:text-slate-500" aria-hidden />
          Filtros
          {cantidadActivos > 0 && (
            <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 px-1.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
              {cantidadActivos}
            </span>
          )}
        </span>
        <ChevronDown
          size={16}
          aria-hidden
          className={`text-slate-400 transition-transform duration-300 ${abierto ? "rotate-180" : ""}`}
        />
      </button>

      {/* Active filter chips */}
      {activeFilters.length > 0 && !abierto && (
        <div className="flex flex-wrap gap-1.5 px-3 pb-2 mt-1">
          {activeFilters.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 max-w-full break-words px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300"
            >
              {chip.label}
              {chip.onRemove ? (
                <button
                  type="button"
                  onClick={chip.onRemove}
                  aria-label={`Quitar filtro ${chip.label}`}
                  className="ml-0.5 p-0.5 rounded hover:bg-emerald-100 dark:hover:bg-emerald-800/40 transition-colors"
                  disabled={deshabilitado}
                >
                  <X size={10} aria-hidden />
                </button>
              ) : (
                <span className="ml-1 text-[9px] uppercase tracking-wider text-emerald-500/80">
                  fijo
                </span>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Collapsible filter panel */}
      <div
        id={panelId}
        inert={!abierto}
        aria-hidden={!abierto}
        className={`grid transition-[grid-template-rows,opacity] duration-200 motion-reduce:transition-none ease-[cubic-bezier(0.4,0,0.2,1)] ${abierto ? "grid-rows-[1fr] opacity-100 mt-2" : "grid-rows-[0fr] opacity-0"
          }`}
      >
        <div className={abierto ? "overflow-visible" : "overflow-hidden"}>
          <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-4 sm:p-5">
            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-12 items-end">
              {/* Empresa */}
              <div className="min-w-0 xl:col-span-3">
                <label htmlFor={`${filterId}-empresa`} className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                  Empresa
                </label>
                <select
                  id={`${filterId}-empresa`}
                  className={selectClass}
                  disabled={!puedeElegirEmpresa || deshabilitado}
                  value={stringOrVacio(filtros.empresaId ?? null)}
                  onChange={handleEmpresaChange}
                >
                  {puedeElegirEmpresa && <option value="">Todas</option>}
                  {!puedeElegirEmpresa && !listaEmpresas.some((empresa) => empresa.id === filtros.empresaId) && (
                    <option value={stringOrVacio(filtros.empresaId)}>
                      {filtros.empresaId == null ? "Empresa asignada" : `Empresa #${filtros.empresaId}`}
                    </option>
                  )}
                  {listaEmpresas.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nombre}
                    </option>
                  ))}
                </select>
              </div>

              {/* Localidad */}
              <div className="min-w-0 xl:col-span-3">
                <label htmlFor={`${filterId}-localidad`} className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                  Localidad
                </label>
                <select
                  id={`${filterId}-localidad`}
                  className={selectClass}
                  disabled={!puedeElegirLocalidad || deshabilitado}
                  value={stringOrVacio(filtros.localidadId ?? null)}
                  onChange={handleLocalidadChange}
                >
                  {puedeElegirLocalidad && <option value="">Todas</option>}
                  {listaLocalidades.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.nombre}
                    </option>
                  ))}
                </select>
              </div>

              {/* Locomotora exacta */}
              <div className="min-w-0 xl:col-span-3">
                <label htmlFor={`${filterId}-locomotora`} className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                  Locomotora
                </label>
                <input
                  id={`${filterId}-locomotora`}
                  type="text"
                  className={inputPlain}
                  disabled={deshabilitado}
                  value={filtros.locomotiveNumber ?? ""}
                  onChange={handleLocoNumberChange}
                  placeholder="Exacto"
                />
              </div>

              {/* Estado */}
              <div className="min-w-0 xl:col-span-3 relative" onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setShowEstadoDropdown(false);
                  stateButtonRef.current?.focus();
                }
              }}>
                <label htmlFor={`${filterId}-estado`} className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                  Estado
                </label>
                <button
                  id={`${filterId}-estado`}
                  ref={stateButtonRef}
                  type="button"
                  aria-expanded={showEstadoDropdown}
                  aria-controls={stateOptionsId}
                  disabled={deshabilitado}
                  onClick={() => setShowEstadoDropdown((prev) => !prev)}
                  className="w-full flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 min-h-[44px] text-left text-[16px] sm:text-sm text-slate-800 dark:text-slate-100 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-400 dark:focus:ring-emerald-500/30 dark:focus:border-emerald-500 transition-all duration-200"
                >
                  <span className="truncate">
                    {filtros.estado
                      ? filtros.estado
                          .split(",")
                          .map((est) => est.replace("_", " "))
                          .join(", ")
                      : "Todos"}
                  </span>
                  <ChevronDown size={16} className="text-slate-400 shrink-0 ml-2" aria-hidden />
                </button>

                {showEstadoDropdown && (
                  <>
                    <button
                      type="button"
                      aria-label="Cerrar selector de estados"
                      tabIndex={-1}
                      onClick={() => setShowEstadoDropdown(false)}
                      className="fixed inset-0 z-[60] cursor-default focus:outline-none"
                    />
                    <div id={stateOptionsId} role="group" aria-label="Estados de movimientos" className="absolute left-0 right-0 mt-1 z-[70] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-2 shadow-lg max-h-60 overflow-y-auto">
                      <div className="flex flex-col gap-1">
                        {estados.map((estado) => {
                          const active = (filtros.estado ?? "")
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean)
                            .includes(estado);
                          return (
                            <label
                              key={estado}
                              className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer select-none text-[13px] text-slate-700 dark:text-slate-300 font-semibold"
                            >
                              <input
                                type="checkbox"
                                disabled={deshabilitado}
                                checked={active}
                                onChange={() => handleEstadoToggle(estado)}
                                className="rounded text-emerald-600 focus:ring-emerald-500/30 h-4 w-4 border-slate-300 dark:border-slate-700 dark:bg-slate-900"
                              />
                              <span>{estado.replace("_", " ")}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Filtros avanzados */}
              {mostrarAvanzados && (
                <div id={advancedId} className="col-span-1 sm:col-span-2 xl:col-span-12 border-t border-slate-200/60 dark:border-slate-800/80 pt-4 mt-1">
                  <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-12 items-end">
                    {/* Prioridad */}
                    <div className="min-w-0 xl:col-span-2">
                      <label htmlFor={`${filterId}-prioridad`} className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                        Prioridad
                      </label>
                      <select
                        id={`${filterId}-prioridad`}
                        className={selectClass}
                        disabled={deshabilitado}
                        value={filtros.prioridad ?? ""}
                        onChange={handlePrioridadChange}
                      >
                        <option value="">Todas</option>
                        <option value="ALTA">ALTA</option>
                        <option value="BAJA">BAJA</option>
                      </select>
                    </div>

                    {mostrarFiltrosTiempo ? (
                      <>
                        {/* Fecha campo */}
                        <div className="min-w-0 xl:col-span-2">
                          <label htmlFor={`${filterId}-fecha-campo`} className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                            Fecha de referencia
                          </label>
                          <select
                            id={`${filterId}-fecha-campo`}
                            className={selectClass}
                            disabled={deshabilitado}
                            value={filtros.fechaCampo ?? ""}
                            onChange={handleFechaCampoChange}
                          >
                            <option value="solicitud">Solicitud</option>
                            <option value="inicio">Inicio</option>
                            <option value="fin">Fin</option>
                            <option value="creacion">Creación</option>
                          </select>
                        </div>

                        {/* Desde */}
                        <div className="min-w-0 xl:col-span-3">
                          <label htmlFor={`${filterId}-desde`} className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                            Desde (fecha/hora)
                          </label>
                          <div className="relative">
                            <input
                              id={`${filterId}-desde`}
                              type="datetime-local"
                              className={inputClass}
                              disabled={deshabilitado}
                              value={desdeInput}
                              max={hastaInput || undefined}
                              aria-invalid={rangoInvertido}
                              aria-describedby={rangoInvertido ? dateErrorId : undefined}
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
                        <div className="min-w-0 xl:col-span-3">
                          <label htmlFor={`${filterId}-hasta`} className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                            Hasta (fecha/hora)
                          </label>
                          <div className="relative">
                            <input
                              id={`${filterId}-hasta`}
                              type="datetime-local"
                              className={inputClass}
                              disabled={deshabilitado}
                              value={hastaInput}
                              min={desdeInput || undefined}
                              aria-invalid={rangoInvertido}
                              aria-describedby={rangoInvertido ? dateErrorId : undefined}
                              onChange={handleHastaChange}
                            />
                            <Calendar
                              size={15}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 opacity-50 pointer-events-none text-slate-400 dark:text-slate-500"
                              aria-hidden
                            />
                          </div>
                        </div>
                      </>
                    ) : null}

                    {/* Tamaño de página */}
                    <div className="min-w-0 xl:col-span-2">
                      <label htmlFor={`${filterId}-page-size`} className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                        Por página
                      </label>
                      <select
                        id={`${filterId}-page-size`}
                        className={selectClass}
                        disabled={deshabilitado}
                        value={filtros.tamPagina}
                        onChange={handleTamPaginaChange}
                      >
                        {[10, 25, 50].map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </div>

                    {mostrarFiltrosTiempo ? (
                      <div className="min-w-0 col-span-1 sm:col-span-2 xl:col-span-12 mt-1">
                        <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
                          <span className="inline-flex items-center px-2 text-[11px] font-black uppercase tracking-wide text-slate-400">
                            Atajos de tiempo
                          </span>
                          <button
                            type="button"
                            onClick={() => applyTodayPreset("inicio")}
                            disabled={deshabilitado}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300"
                          >
                            Inicio hoy
                          </button>
                          <button
                            type="button"
                            onClick={() => applyTodayPreset("fin")}
                            disabled={deshabilitado}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300"
                          >
                            Cierres hoy
                          </button>
                          <button
                            type="button"
                            onClick={() => applyLastHoursPreset(1)}
                            disabled={deshabilitado}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300"
                          >
                            Última hora
                          </button>
                          <button
                            type="button"
                            onClick={() => applyLastHoursPreset(24 * 7)}
                            disabled={deshabilitado}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300"
                          >
                            Últimos 7 días
                          </button>
                          <button
                            type="button"
                            onClick={clearDateRange}
                            disabled={deshabilitado}
                            className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50 dark:border-rose-800 dark:text-rose-300"
                          >
                            Limpiar fechas
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}

              {/* Acciones */}
              <div className="min-w-0 col-span-1 sm:col-span-2 xl:col-span-12 flex flex-col sm:flex-row gap-2 justify-between items-center pt-3 border-t border-slate-100 dark:border-slate-800/60">
                <button
                  type="button"
                  onClick={() => setMostrarAvanzados((prev) => !prev)}
                  aria-expanded={mostrarAvanzados}
                  aria-controls={advancedId}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 w-full sm:w-auto text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all duration-150 active:scale-[0.97]"
                >
                  <SlidersHorizontal size={14} className="text-slate-400" aria-hidden />
                  {mostrarAvanzados ? "Ocultar filtros avanzados" : "Mostrar filtros avanzados"}
                </button>

                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 w-full sm:w-auto text-xs font-bold text-slate-600 dark:text-slate-300 hover:border-rose-300 hover:text-rose-600 dark:hover:border-rose-500 dark:hover:text-rose-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 active:scale-[0.97]"
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
      {rangoInvertido && (
        <p id={dateErrorId} role="alert" className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
          La fecha desde no puede ser posterior a la fecha hasta.
        </p>
      )}
    </section>
  );
}

/* ===== Utilidades locales ===== */
function formatFilterDate(value: string) {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = new Date(dateOnly ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("es-MX", { dateStyle: "short", timeStyle: dateOnly ? undefined : "short" });
}

function toInputDateTime(valor: string | null | undefined): string {
  if (!valor) return "";
  if (/(?:Z|[+-]\d{2}:\d{2})$/.test(valor)) {
    const parsed = new Date(valor);
    return Number.isNaN(parsed.getTime()) ? "" : toLocalDateTimeInput(parsed);
  }
  if (valor.includes("T")) {
    return valor.length >= 16 ? valor.slice(0, 16) : valor;
  }
  const base = valor.length >= 10 ? valor.slice(0, 10) : valor;
  return `${base}T00:00`;
}

function toLocalDateTimeInput(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    "-",
    pad(date.getMonth() + 1),
    "-",
    pad(date.getDate()),
    "T",
    pad(date.getHours()),
    ":",
    pad(date.getMinutes()),
  ].join("");
}

function stringOrVacio(id: number | null | undefined): string {
  return typeof id === "number" ? String(id) : "";
}
