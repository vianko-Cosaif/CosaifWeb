/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Movimiento } from './../../movimientos/Movimiento';
import ConfirmChoiceAlert from "./../../Components/ui/ConfirmChoiceAlert";
import {
  API_BASE, SECC_BASE, DOUBLE_TAP_MS, Direccion, Posicion, Servicio, Rol, Polo, Via, Seccion, InfoEdicion, EditablePayload, MovementFormData, baseInitialForm
} from './../../movimientos/movimientos.shared';
import { useTrackSelectionConfirmation } from "./../../movimientos/lifeLineConfirmation.shared";
import TornoMeasuresViewerModal from "./../../movimientos/torno/TornoMeasuresViewerModal";
import { parseTornoMedicionFromApi } from "./../../movimientos/torno/tornoMeasureParser";
import { buildBackendTornoMedidas } from "./../../movimientos/crear/tornoSubmit.adapter";
import StepTwoTorno from "./../../movimientos/crear/components/StepTwoTorno";
import MobileGuidedTornoMeasuresStep, {
  getGuidedTornoMeasuresPageCount,
  getGuidedTornoMeasuresPageTitle,
} from "./../../movimientos/crear/components/MobileGuidedTornoMeasuresStep";
import {
  createEmptyTornoRow,
  DEFAULT_TORNO_MEDICION_STATE,
  EMPTY_TORNO_VALUE,
  normalizeTornoMeasureValue,
  sanitizeTornoMeasurePart,
  type TornoMeasurementField,
  type TornoMeasurementPart,
  type TornoMedicionState,
  type TornoWheelCount,
  type TornoWheelPosition,
} from "./../../movimientos/crear/tornoMedicion.types";

/** ======= ESTILOS ======= */
const inputBase =
  "w-full rounded-xl border px-3 py-3 min-h-[48px] text-base sm:text-sm outline-none transition-all duration-200 " +
  "bg-white text-slate-900 placeholder-slate-400 border-slate-200 " +
  "focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/30 " +
  "dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500 dark:border-zinc-700 " +
  "dark:focus:border-emerald-500 dark:focus:ring-emerald-500/20";
const chipBase = "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium";
const serializeTornoMedicion = (value: TornoMedicionState) => JSON.stringify(value);

/** ======= SUBCOMPONENTES ======= */

function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  const { label, error, className, id, ...rest } = props;
  const eid = id || `f_${label.replace(/\s+/g, "_").toLowerCase()}`;
  return (
    <label htmlFor={eid} className="mb-3 block">
      <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-zinc-300">{label}</span>
      <input
        id={eid}
        {...rest}
        aria-invalid={!!error}
        aria-describedby={error ? `${eid}_err` : undefined}
        className={Movimiento.clsx(inputBase, error && "border-rose-500 focus:border-rose-500", className)}
      />
      {error ? <span id={`${eid}_err`} className="mt-1 block text-xs text-rose-600 dark:text-rose-400">{error}</span> : null}
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  error,
  disabled,
}: {
  label: string;
  value: string | number | null | undefined;
  onChange: (v: string) => void;
  options: Array<{ label: string; value: string }>;
  error?: string;
  disabled?: boolean;
}) {
  const id = `sel_${label.replace(/\s+/g, "_").toLowerCase()}`;
  return (
    <label className="mb-3 block" htmlFor={id}>
      <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-zinc-300">{label}</span>
      <select
        id={id}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}_err` : undefined}
        className={Movimiento.clsx(
          inputBase,
          "bg-white dark:bg-slate-900 appearance-none touch-manipulation",
          disabled && "cursor-not-allowed opacity-60",
          error && "border-rose-500 focus:border-rose-500"
        )}
      >
        <option value="">— Selecciona —</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error ? <span id={`${id}_err`} className="mt-1 block text-xs text-rose-600 dark:text-rose-400">{error}</span> : null}
    </label>
  );
}

function Step1Edit({
  readOnly,
  form,
  vias,
  sectionsByVia,
  secLoading,
  selectionMode,
  serviceVia,
  setServiceVia,
  setSelectionMode,
  tapToggle,
  setForm,
  ensureSections,
  viaOrigenId,
  setViaOrigenId,
  viaDestinoId,
  setViaDestinoId,
  fromSection,
  setFromSection,
  toSection,
  setToSection,
  locomotiveNumber,
  setLocomotiveNumber,
  viaName,
  errors,
  empresaLabel,
  localidadLabel,
  visualSection,
}: {
  readOnly: boolean;
  form: MovementFormData;
  vias: Via[];
  sectionsByVia: Record<number, Seccion[]>;
  secLoading: Record<number, boolean>;
  selectionMode: "de_via" | "para_via";
  serviceVia: Servicio | undefined;
  setServiceVia: (v?: Servicio) => void;
  setSelectionMode: (mode: "de_via" | "para_via") => void;
  tapToggle: (key: string, onSingle: () => void, onDouble: () => void) => void;
  setForm: React.Dispatch<React.SetStateAction<MovementFormData>>;
  ensureSections: (viaId: number) => void;
  viaOrigenId: number | null;
  setViaOrigenId: (v: number | null) => void;
  viaDestinoId: number | null;
  setViaDestinoId: (v: number | null) => void;
  fromSection?: number;
  setFromSection: (v?: number) => void;
  toSection?: number;
  setToSection: (v?: number) => void;
  locomotiveNumber: string;
  setLocomotiveNumber: (v: string) => void;
  viaName: (id?: number | null) => string;
  errors: Record<string, string>;
  empresaLabel: string;
  localidadLabel: string;
  visualSection?: "context" | "service" | "locomotive" | "route";
}) {
  const {
    lifeLineModal,
    requestTrackConfirmation,
    closeTrackConfirmation,
    confirmTrackSelection,
    question: lifeLineQuestion,
    contextLabel: lifeLineContextLabel,
  } = useTrackSelectionConfirmation();

  const optionFrom = (v: Via) => (
    <button
      key={v.id}
      disabled={readOnly}
      onClick={() => {
        if (readOnly) return;
        if (viaOrigenId === v.id) {
          setViaOrigenId(null);
          return;
        }
        requestTrackConfirmation(
          "from",
          String(v.nombre),
          () => setViaOrigenId(v.id),
          v.lineaDeVida
        );
      }}
      className={Movimiento.clsx(
        "flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left transition-all duration-200 hover:bg-slate-50 dark:border-zinc-700/60 dark:hover:bg-zinc-800/60",
        viaOrigenId === v.id && "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 ring-1 ring-emerald-500/20"
      )}
    >
      <span className="truncate">Vía {v.nombre}</span>
    </button>
  );
  const optionTo = (v: Via) => {
    const secs = sectionsByVia[v.id];
    const allOcc: boolean | null = Array.isArray(secs) ? secs.length > 0 && secs.every((x) => x.ocupada) : null;
    const label = allOcc === null ? "—" : allOcc ? "SIN SECC. LIBRES" : "HAY LIBRES";
    const tone = allOcc === null ? "text-slate-500" : allOcc ? "text-rose-600" : "text-emerald-600";
    return (
      <button
        key={v.id}
        disabled={readOnly}
        onClick={() => {
          if (readOnly) return;
          if (viaDestinoId === v.id) {
            setViaDestinoId(null);
            return;
          }
          requestTrackConfirmation(
            "to",
            String(v.nombre),
            () => setViaDestinoId(v.id),
            v.lineaDeVida
          );
        }}
        className={Movimiento.clsx(
          "flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left transition-all duration-200 hover:bg-slate-50 dark:border-zinc-700/60 dark:hover:bg-zinc-800/60",
          viaDestinoId === v.id && "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 ring-1 ring-emerald-500/20"
        )}
      >
        <span className="truncate">Vía {v.nombre}</span>
        <span className={Movimiento.clsx("ml-3 text-xs font-semibold", tone)}>{label}</span>
      </button>
    );
  };

  const SectionsPills = ({ kind, viaId }: { kind: "from" | "to"; viaId?: number | null }) => {
    useEffect(() => {
      if (!viaId) return;
      if (!Array.isArray(sectionsByVia[viaId]) && !secLoading[viaId]) ensureSections(viaId);
    }, [viaId]);

    if (!viaId) return null;
    const loading = !!secLoading[viaId];
    const listRaw = sectionsByVia[viaId];
    const hasData = Array.isArray(listRaw);
    const list = (hasData ? listRaw : [])!.filter((s) => (kind === "from" ? true : !s.ocupada));
    const selected = kind === "from" ? fromSection : toSection;

    return (
      <div className="mt-2 text-sm">
        <div className="mb-2 text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">
          Secciones de {viaName(viaId)} {loading || !hasData ? "" : `(${list.length})`}
        </div>

        {loading || !hasData ? (
          <div className="py-2 text-slate-500 dark:text-slate-400 italic">Cargando secciones…</div>
        ) : list.length === 0 ? (
          <div className="py-2 text-slate-500 dark:text-slate-400 italic">
            {kind === "to" ? "No hay secciones libres." : "Esta vía no tiene secciones."}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {list.map((s) => {
              const active = selected === s.numero;
              const color = s.ocupada ? "border-rose-500/50 text-rose-700 dark:text-rose-300 bg-rose-50/50" : "border-emerald-500/50 text-emerald-700 dark:text-emerald-300 bg-emerald-50/50";
              const activeColor = s.ocupada ? "bg-rose-600 text-white border-rose-600" : "bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-500/20";

              return (
                <button
                  key={s.id}
                  disabled={readOnly}
                  onClick={() => (kind === "from" ? setFromSection(active ? undefined : s.numero) : setToSection(active ? undefined : s.numero))}
                  className={Movimiento.clsx(
                    "rounded-xl border px-3 py-1.5 text-xs font-bold transition-all duration-200 active:scale-95",
                    active ? activeColor : color
                  )}
                >
                  #{s.numero}{s.nombre ? ` · ${s.nombre}` : ""}{s.ocupada ? " · OCUP" : ""}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const handlePriorityToggle = (checked: boolean) => {
    // Priority logic can be simplified for edit if user cannot change it extensively without password
    // For now, keep it simple toggle if editable
    if (readOnly) return;
    setForm(p => ({ ...p, priority: checked }));
  };

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {/* Empresa y Localidad (Disabled) */}
      {(!visualSection || visualSection === "context") && (
        <>
          <Field label="Empresa" value={empresaLabel} disabled />
          <Field label="Localidad" value={localidadLabel} disabled />
        </>
      )}

      {(!visualSection || visualSection === "service") && (
      <div className="sm:col-span-2">
        <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Servicio (Opcional)</span>
        <div className="flex flex-wrap gap-2">
          {(["Lavado", "Torno"] as const).map((svc) => {
            const active = serviceVia === svc;
            return (
              <button
                key={svc}
                onClick={() =>
                  tapToggle(
                    `svc:${svc}`,
                    () => { setForm((p) => ({ ...p, service: svc, toTrack: null })); setServiceVia(svc) },
                    () => { setForm((p) => ({ ...p, service: "", toTrack: p.toTrack })); setServiceVia("") }
                  )
                }
                className={Movimiento.clsx(
                  "rounded-xl border px-4 py-2.5 text-sm font-medium transition-all duration-200",
                  active
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300 ring-1 ring-emerald-500/20 shadow-sm"
                    : "border-slate-200 dark:border-zinc-700/60 hover:bg-slate-50 dark:hover:bg-zinc-800/60 bg-white dark:bg-zinc-900"
                )}
              >
                {svc}
              </button>
            );
          })}
          {serviceVia ? <span className="self-center text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">Doble clic para desmarcar</span> : null}
        </div>
      </div>
      )}
      {(!visualSection || visualSection === "service") && (serviceVia || selectionMode) && (
        <div className="sm:col-span-2 animate-in fade-in slide-in-from-top-2 duration-300">
          <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Modo de selección</span>
          <div className="flex flex-wrap gap-2 rounded-xl bg-slate-100 p-1 dark:bg-slate-800/50">
            <button
              onClick={() => setSelectionMode("de_via")}
              className={Movimiento.clsx(
                "rounded-lg px-4 py-2 text-sm font-medium flex-1 transition-all",
                selectionMode === "de_via"
                  ? "bg-white text-emerald-600 shadow-sm dark:bg-zinc-800 dark:text-emerald-400 ring-1 ring-slate-200 dark:ring-zinc-700"
                  : "text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              )}
            >
              De vía
            </button>
            <button
              onClick={() => setSelectionMode("para_via")}
              className={Movimiento.clsx(
                "rounded-lg px-4 py-2 text-sm font-medium flex-1 transition-all",
                selectionMode === "para_via"
                  ? "bg-white text-emerald-600 shadow-sm dark:bg-zinc-800 dark:text-emerald-400 ring-1 ring-slate-200 dark:ring-zinc-700"
                  : "text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              )}
            >
              Para vía
            </button>
          </div>
        </div>
      )}

      {/* Prioridad + Loco */}
      {(!visualSection || visualSection === "locomotive") && (
      <div className="sm:col-span-2 grid sm:grid-cols-2 gap-5 items-end">
        <div>
          <label className="mb-3 mt-1 flex items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 dark:border-zinc-700"
              checked={form.priority}
              onChange={(e) => handlePriorityToggle(e.target.checked)}
              disabled={readOnly}
            />
            <span className="text-sm text-slate-700 dark:text-slate-200 font-medium">Prioridad alta</span>
          </label>
        </div>
        <Field
          label="Número de locomotora"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={locomotiveNumber}
          onChange={(e) => {
            const value = e.target.value;
            if (value === '' || /^\d+$/.test(value)) {
              setLocomotiveNumber(value);
            }
          }}
          disabled={readOnly}
          placeholder="Ej. 4501"
        />
      </div>
      )}

      {/* Origen */}
      {(!visualSection || visualSection === "route") && (selectionMode === "de_via" || !serviceVia) &&
        (<div className="sm:col-span-2 animate-in fade-in slide-in-from-left-2 duration-300">
          <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">De vía (origen)</span>
          <div className="flex gap-2">
            <button
              onClick={() => { /* toggled by list */ }}
              className="min-w-[220px] rounded-xl border border-slate-200 dark:border-zinc-700/60 bg-slate-50 dark:bg-zinc-800/60 px-3 py-2.5 text-left text-slate-700 dark:text-zinc-300 font-medium"
              disabled
              title="Selecciona abajo"
            >
              {viaOrigenId ? `Vía ${viaName(viaOrigenId)}` : "Selecciona una vía..."}
            </button>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 max-h-[240px] overflow-y-auto pr-1 custom-scrollbar">
            {Movimiento.TrackFilter(vias, selectionMode, "de_via", serviceVia).map((v) => (<div key={v.id}>{optionFrom(v)}</div>))}
          </div>
          <SectionsPills kind="from" viaId={viaOrigenId} />
        </div>)}
      {(!visualSection || visualSection === "route") && (selectionMode === "para_via" || !serviceVia) && (<div className="sm:col-span-2 animate-in fade-in slide-in-from-right-2 duration-300">
        <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Para vía (destino)</span>
        <div className="flex gap-2">
          <button
            onClick={() => { /* toggled by list */ }}
            className="min-w-[220px] rounded-xl border border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/60 px-3 py-2.5 text-left text-slate-700 dark:text-slate-300 font-medium"
            disabled
            title="Selecciona abajo"
          >
            {viaDestinoId ? `Vía ${viaName(viaDestinoId)}` : "Selecciona una vía..."}
          </button>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 max-h-[240px] overflow-y-auto pr-1 custom-scrollbar">
          {Movimiento.TrackFilter(vias, selectionMode, "para_via", serviceVia).map((v) => (<div key={v.id}>{optionTo(v)}</div>))}
        </div>
        <SectionsPills kind="to" viaId={viaDestinoId} />
      </div>)}

      <ConfirmChoiceAlert
        open={Boolean(lifeLineModal)}
        question={lifeLineQuestion}
        contextLabel={lifeLineContextLabel}
        onCancel={closeTrackConfirmation}
        onConfirm={confirmTrackSelection}
      />
    </div>
  );
}

function Step2Edit({
  readOnly,
  tipoMovimiento,
  setTipoMovimiento,
  posicionCabina,
  setPosicionCabina,
  posicionChimenea,
  setPosicionChimenea,
  direccionEmpuje,
  setDireccionEmpuje,
  polo,
  setPolo,
  errors,
}: {
  readOnly: boolean;
  tipoMovimiento: "" | "MD_TRABAJANDO" | "REMOLCADA";
  setTipoMovimiento: (v: "MD_TRABAJANDO" | "REMOLCADA" | "") => void;
  posicionCabina: Posicion;
  setPosicionCabina: (v: Posicion) => void;
  posicionChimenea: Posicion;
  setPosicionChimenea: (v: Posicion) => void;
  direccionEmpuje: Direccion;
  setDireccionEmpuje: (v: Direccion) => void;
  polo: "NORTE" | "SUR" | "Sin_Solicitar";
  setPolo: (v: "NORTE" | "SUR" | "Sin_Solicitar") => void;
  errors: Record<string, string>;
}) {
  const Card = ({
    active,
    label,
    onClick,
    disabled,
  }: {
    active: boolean;
    label: string;
    onClick: () => void;
    disabled?: boolean;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={Movimiento.clsx(
        "flex w-full items-center justify-between rounded-xl border px-4 py-3.5 text-left transition-all duration-200",
        "border-slate-200 dark:border-zinc-700/60 hover:bg-slate-50 dark:hover:bg-zinc-800/60",
        active && "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 ring-1 ring-emerald-500/20",
        disabled && "cursor-not-allowed opacity-60"
      )}
    >
      <span className="font-medium text-slate-800 dark:text-zinc-200">{label}</span>
      <span className={Movimiento.clsx("ml-3 rounded-full px-2.5 py-0.5 text-xs font-semibold", active ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400")}>
        {active ? "✓ Seleccionado" : "Elegir"}
      </span>
    </button>
  );

  return (
    <div className="grid gap-6">
      {/* Tipo */}
      <div>
        <div className="mb-2 text-sm font-medium text-slate-700 dark:text-zinc-300">Tipo de movimiento</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Card label="MD Trabajando" active={tipoMovimiento === "MD_TRABAJANDO"} onClick={() => setTipoMovimiento("MD_TRABAJANDO")} disabled={readOnly} />
          <Card label="Remolcada" active={tipoMovimiento === "REMOLCADA"} onClick={() => setTipoMovimiento("REMOLCADA")} disabled={readOnly} />
        </div>
        {errors.tipoMovimiento && <div className="mt-1 text-xs text-rose-600 font-medium">{errors.tipoMovimiento}</div>}
      </div>

      {tipoMovimiento === "REMOLCADA" && (
        <div className="animate-in fade-in slide-in-from-top-2">
          <div className="mb-2 text-sm font-medium text-slate-700 dark:text-zinc-300">Dirección de empuje</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Card label="Empujar" active={direccionEmpuje === "EMPUJAR"} onClick={() => setDireccionEmpuje("EMPUJAR")} disabled={readOnly} />
            <Card label="Jalar" active={direccionEmpuje === "JALAR"} onClick={() => setDireccionEmpuje("JALAR")} disabled={readOnly} />
          </div>
          {errors.direccionEmpuje && <div className="mt-1 text-xs text-rose-600 font-medium">{errors.direccionEmpuje}</div>}
        </div>
      )}

      {/* Cabina/Chimenea */}
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <div className="mb-2 text-sm font-medium text-slate-700 dark:text-zinc-300">Posición Cabina</div>
          <div className="flex flex-col gap-2">
            <Card label="Dentro" active={posicionCabina === "DENTRO"} onClick={() => setPosicionCabina("DENTRO")} disabled={readOnly} />
            <Card label="Afuera" active={posicionCabina === "AFUERA"} onClick={() => setPosicionCabina("AFUERA")} disabled={readOnly} />
            <Card label="Sin solicitar" active={posicionCabina === "Sin_Solicitar"} onClick={() => setPosicionCabina("Sin_Solicitar")} disabled={readOnly} />
          </div>
        </div>
        <div>
          <div className="mb-2 text-sm font-medium text-slate-700 dark:text-zinc-300">Posición Chimenea</div>
          <div className="flex flex-col gap-2">
            <Card label="Dentro" active={posicionChimenea === "DENTRO"} onClick={() => setPosicionChimenea("DENTRO")} disabled={readOnly} />
            <Card label="Afuera" active={posicionChimenea === "AFUERA"} onClick={() => setPosicionChimenea("AFUERA")} disabled={readOnly} />
            <Card label="Sin solicitar" active={posicionChimenea === "Sin_Solicitar"} onClick={() => setPosicionChimenea("Sin_Solicitar")} disabled={readOnly} />
          </div>
        </div>
      </div>

      {/* Polo */}
      <div>
        <div className="mb-2 text-sm font-medium text-slate-700 dark:text-zinc-300">Polo (Opcional)</div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Card label="Norte" active={polo === "NORTE"} onClick={() => setPolo("NORTE")} disabled={readOnly} />
          <Card label="Sur" active={polo === "SUR"} onClick={() => setPolo("SUR")} disabled={readOnly} />
          <Card label="Sin solicitar" active={polo === "Sin_Solicitar"} onClick={() => setPolo("Sin_Solicitar")} disabled={readOnly} />
        </div>
      </div>
    </div>
  );
}

function Step3Edit({
  readOnly,
  instrucciones,
  setInstrucciones,
  resumen,
  metaHint,
  saving,
  onSubmit,
}: {
  readOnly: boolean;
  instrucciones: string;
  setInstrucciones: (v: string) => void;
  resumen: { localidad?: string; origen: string; destino: string; loco: string; tipo: string; dir: string };
  metaHint: string;
  saving: boolean;
  onSubmit: () => void;
}) {
  return (
    <div className="grid gap-6">
      <div className="rounded-lg border p-3 text-sm dark:border-zinc-700">
        <div className="font-semibold mb-2 text-slate-800 dark:text-zinc-100">Resumen</div>
        <ul className="grid gap-1 text-slate-700 dark:text-zinc-300">
          <li>Localidad: {resumen.localidad ?? "—"}</li>
          <li>Origen: {resumen.origen ?? "—"}</li>
          <li>Destino: {resumen.destino ?? "—"}</li>
          <li>Locomotora: {resumen.loco || "—"}</li>
          <li>Tipo: {resumen.tipo || "—"}</li>
          <li>Dirección: {resumen.dir || "—"}</li>
        </ul>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-zinc-300">
          Comentarios / instrucciones
        </label>
        <textarea
          rows={6}
          value={instrucciones}
          onChange={(e) => setInstrucciones(e.target.value)}
          disabled={readOnly}
          className={Movimiento.clsx(inputBase, "min-h-[120px] resize-none")}
          placeholder="Escriba instrucciones específicas..."
        />
        {metaHint && <div className="mt-2 text-xs text-slate-400 font-mono bg-slate-50 dark:bg-zinc-900/50 p-2 rounded border border-slate-100 dark:border-zinc-800 break-all">{metaHint}</div>}
      </div>

      <button
        onClick={onSubmit}
        disabled={readOnly || saving}
        className={Movimiento.clsx(
          "inline-flex items-center justify-center gap-2 rounded-xl px-6 py-4 text-base font-bold text-white shadow-lg transition-all active:scale-[0.98]",
          readOnly
            ? "bg-slate-400 cursor-not-allowed shadow-none"
            : "bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-emerald-500/25",
          saving && "opacity-70 cursor-wait"
        )}
        title={readOnly ? "No editable" : "Guardar cambios"}
      >
        {saving ? (
          <><svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Guardando cambios…</>
        ) : "✓ Guardar Cambios"}
      </button>
    </div>
  );
}

function Badge({ tone, children }: { tone: "ok" | "warn" | "error" | "muted"; children: React.ReactNode }) {
  const map = {
    ok: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-800",
    warn: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-800",
    error: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-200 dark:border-rose-800",
    muted: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
  } as const;
  return <span className={Movimiento.clsx(chipBase, map[tone])}>{children}</span>;
}

function RoleBadge({ rol, canManageAll }: { rol: string; canManageAll: boolean }) {
  const R = String(rol || "").toUpperCase();
  const tone = canManageAll ? "ok" : (R === "SUPERVISOR" ? "warn" : "muted");
  const text =
    canManageAll
      ? `${R} · puede elegir empresa y localidad`
      : `${R} · solo su empresa${R === "CLIENTE" || R === "SUPERVISOR" ? " y localidad asignada" : ""}`;
  return <Badge tone={tone as any}>{text}</Badge>;
}

export default function EditarMovimiento({
  movimientoId,
  onClose,
  onSaved,
}: {
  movimientoId: number | string;
  onClose?: () => void;
  onSaved?: (updated: any) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState<"de_via" | "para_via">("de_via");
  const [serviceVia, setServiceVia] = useState<Servicio | undefined>("");
  const [info, setInfo] = useState<InfoEdicion | null>(null);
  const [vias, setVias] = useState<Via[]>([]);
  const [sectionsByVia, setSectionsByVia] = useState<Record<number, Seccion[]>>({});
  const [secLoading, setSecLoading] = useState<Record<number, boolean>>({});

  // Form local (solo editables)
  const [instrucciones, setInstrucciones] = useState<string>("");
  const [locomotiveNumber, setLocomotiveNumber] = useState<string>("");
  const [viaOrigenId, setViaOrigenId] = useState<number | null>(null);
  const [viaDestinoId, setViaDestinoId] = useState<number | null>(null);
  const [tipoMovimiento, setTipoMovimiento] = useState<"MD_TRABAJANDO" | "REMOLCADA" | "">("");
  const [posicionCabina, setPosicionCabina] = useState<Posicion>("Sin_Solicitar");
  const [posicionChimenea, setPosicionChimenea] = useState<Posicion>("Sin_Solicitar");
  const [direccionEmpuje, setDireccionEmpuje] = useState<Direccion>("Sin_Solicitar");
  const [polo, setPolo] = useState<Polo>("Sin_Solicitar");
  const [form, setForm] = useState<MovementFormData>(baseInitialForm);
  const [tornoMedicion, setTornoMedicion] = useState<TornoMedicionState>(() => ({
    wheelCount: DEFAULT_TORNO_MEDICION_STATE.wheelCount,
    rows: {},
  }));
  const [initialTornoMedicion, setInitialTornoMedicion] = useState<TornoMedicionState>(
    DEFAULT_TORNO_MEDICION_STATE
  );
  const [initialTornoSerialized, setInitialTornoSerialized] = useState<string>(
    serializeTornoMedicion(DEFAULT_TORNO_MEDICION_STATE)
  );
  const [showTornoViewerModal, setShowTornoViewerModal] = useState(false);
  const [editFlowMode, setEditFlowMode] = useState<"mobile" | "classic">("mobile");
  const [tornoEditMode, setTornoEditMode] = useState<"mobile" | "classic">("mobile");
  const [mobileStepOnePage, setMobileStepOnePage] = useState(0);
  const [mobileTornoPage, setMobileTornoPage] = useState(0);
  const lastTap = useRef<Record<string, number>>({});

  // Secciones elegidas para hint META (el backend solo las lee desde instrucciones)
  const [fromSection, setFromSection] = useState<number | undefined>(undefined);
  const [toSection, setToSection] = useState<number | undefined>(undefined);

  // Estado para el flujo de pasos
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const STEP_CFG = [
    { label: "Paso 1 de 3", percent: 33 },
    { label: "Paso 2 de 3", percent: 66 },
    { label: "Paso 3 de 3", percent: 100 },
  ] as const;
  const { label, percent } = STEP_CFG[step - 1];
  const mobileStepOneSections = ["context", "service", "locomotive", "route"] as const;
  const mobileStepOneTitles = ["Empresa y localidad", "Servicio", "Locomotora", "Via y seccion"];
  const mobileStepOneSection = mobileStepOneSections[mobileStepOnePage] ?? "context";

  // Limpiar instrucciones cuando se llega al paso 3
  useEffect(() => {
    if (step === 3) {
      setInstrucciones("");
    }
  }, [step]);

  useEffect(() => {
    if (serviceVia !== "Torno") {
      setMobileTornoPage(0);
    }
  }, [serviceVia]);

  useEffect(() => {
    if (editFlowMode !== "mobile" || step !== 1) {
      setMobileStepOnePage(0);
    }
  }, [editFlowMode, step]);

  // Rol y helpers
  const [rol, setRol] = useState<Rol>("CLIENTE");
  useEffect(() => { const r = String(Movimiento.getCookie("role") || "").toUpperCase() as Rol; if (r) setRol(r); }, []);
  const canManageAll = ["ADMINISTRADOR", "COORDINADOR"].includes(rol);
  const roleToPath = (r?: string) => {
    const R = String(r || "").toUpperCase();
    if (R === "COORDINADOR") return "/coordinador/movimientos";
    if (R === "ADMINISTRADOR") return "/administrador/movimientos";
    if (R === "SUPERVISOR") return "/supervisor/movimientos";
    return "/cliente/movimientos";
  };

  /** Cargar info edición + vías */
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const data = await Movimiento.fetchJSON(`${API_BASE}/movimientos/${movimientoId}/edicion`);
        if (!mounted) return;
        setInfo(data);

        // Prefill
        setInstrucciones(String(data.movimiento.instrucciones ?? ""));
        setLocomotiveNumber(String(data.movimiento.locomotiveNumber ?? ""));
        setViaOrigenId(data.movimiento.viaOrigen?.id ?? null);
        setViaDestinoId(data.movimiento.viaDestino?.id ?? null);
        setTipoMovimiento((data.movimiento.tipoMovimiento as any) || "");
        setPolo(data.movimiento.polo || "Sin_Solicitar");
        setPosicionCabina((data.movimiento.posicionCabina as any) ?? "Sin_Solicitar");
        setPosicionChimenea((data.movimiento.posicionChimenea as any) ?? "Sin_Solicitar");
        setDireccionEmpuje((data.movimiento.direccionEmpuje as any) ?? "Sin_Solicitar");
        setServiceVia((!data.movimiento.Lavado && !data.movimiento.torno) ? "" : (data.movimiento.torno ? "Torno" : "Lavado"));
        const parsedTorno = parseTornoMedicionFromApi(data);
        setTornoMedicion(parsedTorno);
        setInitialTornoMedicion(parsedTorno);
        setInitialTornoSerialized(serializeTornoMedicion(parsedTorno));

        // Prefill secciones desde meta si aplica (el parser expone meta.seccion y meta.destinoId)
        if (data.movimiento.meta?.seccion) setToSection(Number(data.movimiento.meta.seccion));

        // Cargar vías por localidad
        const locId = data.movimiento.localidad?.id;
        if (locId) {
          const list = await Movimiento.fetchJSON(`${API_BASE}/vias/localidad/${locId}`).catch(() => []);
          const vList: Via[] = Array.isArray(list)
            ? list.map((v: any) => ({
                id: v.id,
                nombre: v.nombre,
                lineaDeVida: v.lineaDeVida ?? null,
              }))
            : [];
          vList.sort((a, b) => {
            const numA = Number(a.nombre);
            const numB = Number(b.nombre);
            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
            if (!isNaN(numA)) return -1;
            if (!isNaN(numB)) return 1;
            return String(a.nombre).localeCompare(String(b.nombre));
          });
          setVias(vList);
        }
      } catch (e: any) {
        setError(e?.message || "Error al cargar la información de edición.");
      } finally {
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [movimientoId]);

  /** Secciones por vía (caché) */
  const secLoadingRef = useRef<Record<number, boolean>>({});
  const ensureSections = useCallback(async (viaId: number) => {
    if (!viaId) return;
    if (secLoadingRef.current[viaId]) return;
    if (Array.isArray(sectionsByVia[viaId])) return;

    secLoadingRef.current[viaId] = true;
    setSecLoading((s) => ({ ...s, [viaId]: true }));
    try {
      const raw = await Movimiento.fetchJSON(`${SECC_BASE}/via/${viaId}`);
      const arr: Seccion[] = Array.isArray(raw) ? raw : raw?.secciones ?? [];
      const ordered = arr.slice().sort((a, b) => a.numero - b.numero);
      setSectionsByVia((m) => ({ ...m, [viaId]: ordered }));
    } catch {
      setSectionsByVia((m) => ({ ...m, [viaId]: [] }));
    } finally {
      secLoadingRef.current[viaId] = false;
      setSecLoading((s) => ({ ...s, [viaId]: false }));
    }
  }, [sectionsByVia]);

  /** UI helpers */
  const viaName = (id?: number | null) => (id ? vias.find((v) => v.id === id)?.nombre || "" : "");
  useEffect(() => { if (viaOrigenId) ensureSections(viaOrigenId); }, [viaOrigenId, ensureSections]);
  useEffect(() => { if (viaDestinoId) ensureSections(viaDestinoId); }, [viaDestinoId, ensureSections]);

  /** Validaciones ligeras */
  const [errors, setErrors] = useState<Record<string, string>>({});
  const validateStep2 = () => {
    const e: Record<string, string> = {};
    if (!tipoMovimiento) e.tipoMovimiento = "Selecciona el tipo de movimiento.";
    if (tipoMovimiento === "REMOLCADA" && !["EMPUJAR", "JALAR"].includes(direccionEmpuje)) {
      e.direccionEmpuje = "Selecciona EMPUJAR o JALAR.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  /** Construir descripción automática de vías, secciones y polo igual que en CrearMovimiento */
  const buildAutoDescription = (fromTrackId?: number | null, toTrackId?: number | null, fromSection?: number, toSection?: number, polo?: "NORTE" | "SUR" | "Sin_Solicitar"): string => {
    const partes: string[] = [];
    if (fromTrackId)
      partes.push(`De la vía ${viaName(fromTrackId)}${typeof fromSection === "number" ? ` (sección ${fromSection})` : ""}`);
    if (toTrackId)
      partes.push(`para la vía ${viaName(toTrackId)}${typeof toSection === "number" ? ` (sección ${toSection})` : ""}`);

    // Add polo information if selected
    if (polo && polo !== "Sin_Solicitar") {
      partes.push(`| Posición: ${polo} |`);
    }

    return partes.join(" ");
  };
  const tapToggle = (key: string, onSingle: () => void, onDouble: () => void) => {
    const now = Date.now();
    const last = lastTap.current[key] || 0;
    if (now - last < DOUBLE_TAP_MS) onDouble(); else onSingle();
    lastTap.current[key] = now;
  };
  const setTornoWheelCount = useCallback((count: TornoWheelCount) => {
    setTornoMedicion((prev) => (prev.wheelCount === count ? prev : { ...prev, wheelCount: count }));
  }, []);

  const updateTornoMedicion = useCallback(
    (
      position: TornoWheelPosition,
      field: TornoMeasurementField,
      part: TornoMeasurementPart,
      value: string
    ) => {
      const cleanPartValue = sanitizeTornoMeasurePart(part, value);
      setTornoMedicion((prev) => {
        const prevRow = prev.rows[position] ?? createEmptyTornoRow();
        const prevValue = prevRow[field] ?? EMPTY_TORNO_VALUE;
        const nextValue = normalizeTornoMeasureValue({
          ...prevValue,
          [part]: cleanPartValue,
        });

        if (
          prevValue.whole === nextValue.whole &&
          prevValue.num === nextValue.num &&
          prevValue.den === nextValue.den
        ) {
          return prev;
        }

        return {
          ...prev,
          rows: {
            ...prev.rows,
            [position]: {
              ...prevRow,
              [field]: nextValue,
            },
          },
        };
      });
    },
    []
  );

  const tornoStepForm: MovementFormData = {
    ...baseInitialForm,
    locomotiveNumber,
    movementType: tipoMovimiento,
    direccionEmpuje,
    pushPull: direccionEmpuje === "EMPUJAR" || direccionEmpuje === "JALAR" ? direccionEmpuje : "",
  };

  const setTornoStepForm = useCallback(
    (next: React.SetStateAction<MovementFormData>) => {
      const resolved = typeof next === "function" ? next(tornoStepForm) : next;
      if (resolved.movementType !== undefined) {
        setTipoMovimiento((resolved.movementType as "MD_TRABAJANDO" | "REMOLCADA" | "") || "");
      }
      if (resolved.direccionEmpuje !== undefined) {
        setDireccionEmpuje((resolved.direccionEmpuje as Direccion) || "Sin_Solicitar");
      } else if (resolved.pushPull === "EMPUJAR" || resolved.pushPull === "JALAR") {
        setDireccionEmpuje(resolved.pushPull);
      }
    },
    [tornoStepForm]
  );

  const tornoMobilePageCount = getGuidedTornoMeasuresPageCount();
  const isMobileEditFlow = editFlowMode === "mobile";
  const isMobileTornoEditor = serviceVia === "Torno" && isMobileEditFlow && tornoEditMode === "mobile";
  const tornoEditorSubtitle = isMobileTornoEditor
    ? getGuidedTornoMeasuresPageTitle(mobileTornoPage, tornoMedicion.wheelCount)
    : "Diagnostico torno";
  const mobileTotalUnits = serviceVia === "Torno" ? 7 : 6;
  const mobileCurrentUnit =
    step === 1
      ? mobileStepOnePage + 1
      : step === 2 && serviceVia === "Torno"
        ? 4 + mobileTornoPage + 1
        : step === 2
          ? 5
          : mobileTotalUnits;
  const mobileProgress = isMobileEditFlow
    ? Math.round((mobileCurrentUnit / mobileTotalUnits) * 100)
    : percent;
  const mobileStepTitle = isMobileEditFlow
    ? step === 1
      ? mobileStepOneTitles[mobileStepOnePage] ?? "Datos"
      : step === 2 && serviceVia === "Torno"
        ? getGuidedTornoMeasuresPageTitle(mobileTornoPage, tornoMedicion.wheelCount)
        : step === 2
          ? "Detalles operativos"
          : "Confirmacion"
    : label;
  const mobileTransitionKey = `${editFlowMode}:${step}:${mobileStepOnePage}:${mobileTornoPage}:${serviceVia || "none"}`;

  const goPreviousStep = () => {
    if (isMobileEditFlow && step === 1 && mobileStepOnePage > 0) {
      setMobileStepOnePage((page) => Math.max(0, page - 1));
      return;
    }
    if (step === 2 && isMobileTornoEditor && mobileTornoPage > 0) {
      setMobileTornoPage((page) => Math.max(0, page - 1));
      return;
    }
    if (isMobileEditFlow && step === 2) {
      setMobileStepOnePage(mobileStepOneSections.length - 1);
    }
    if (isMobileEditFlow && step === 3 && serviceVia === "Torno") {
      setMobileTornoPage(Math.max(0, tornoMobilePageCount - 1));
    }
    setStep((s) => (s === 1 ? 1 : ((s - 1) as 1 | 2 | 3)));
  };

  const goNextStep = () => {
    if (isMobileEditFlow && step === 1 && mobileStepOnePage < mobileStepOneSections.length - 1) {
      setMobileStepOnePage((page) => Math.min(mobileStepOneSections.length - 1, page + 1));
      return;
    }
    if (step === 2 && isMobileTornoEditor && mobileTornoPage < tornoMobilePageCount - 1) {
      setMobileTornoPage((page) => Math.min(tornoMobilePageCount - 1, page + 1));
      return;
    }
    if (step === 2 && !validateStep2()) return;
    setStep((s) => ((s + 1) as 1 | 2 | 3));
  };

  const buildPayload = (): EditablePayload => {
    if (!info) return {} as EditablePayload;

    const { editableKeys } = info;
    const payload: EditablePayload = {};

    // Añadir solo los campos editables que han cambiado
    if (editableKeys.includes('locomotiveNumber') && String(locomotiveNumber) !== String(info.movimiento.locomotiveNumber ?? '')) {
      payload.locomotiveNumber = Number(locomotiveNumber) || 0;
    }

    if (editableKeys.includes('viaOrigenId') && viaOrigenId !== info.movimiento.viaOrigen?.id) {
      payload.viaOrigenId = viaOrigenId;
    }

    if (editableKeys.includes('viaDestinoId') && viaDestinoId !== info.movimiento.viaDestino?.id) {
      payload.viaDestinoId = viaDestinoId;
    }

    if (editableKeys.includes('tipoMovimiento') && tipoMovimiento !== (info.movimiento.tipoMovimiento as any)) {
      if (tipoMovimiento) payload.tipoMovimiento = tipoMovimiento;
    }

    if (editableKeys.includes('posicionCabina') && posicionCabina !== (info.movimiento.posicionCabina as any)) {
      payload.posicionCabina = posicionCabina;
    }

    if (editableKeys.includes('posicionChimenea') && posicionChimenea !== (info.movimiento.posicionChimenea as any)) {
      payload.posicionChimenea = posicionChimenea;
    }

    if (editableKeys.includes('direccionEmpuje') && direccionEmpuje !== (info.movimiento.direccionEmpuje as any)) {
      payload.direccionEmpuje = direccionEmpuje;
    }

    if ((editableKeys.includes('torno') && editableKeys.includes('lavado'))) {
      payload.torno = serviceVia === "Torno"
      payload.lavado = serviceVia === "Lavado";
    }

    if (serviceVia === "Torno") {
      const currentTornoSerialized = serializeTornoMedicion(tornoMedicion);
      if (currentTornoSerialized !== initialTornoSerialized) {
        payload.medidasTorno = buildBackendTornoMedidas({
          tornoMedicion,
          companyName: info.movimiento.empresa?.nombre,
        });
      }
    }

    // Polo is now included in the instructions, not in the payload

    // Construir instrucciones con metadatos
    const autoDesc = buildAutoDescription(viaOrigenId, viaDestinoId, fromSection, toSection, polo);
    const metaParts: string[] = [];
    if (typeof toSection === 'number') metaParts.push(`[META DESTINO:${toSection}]`);
    if (typeof fromSection === 'number') metaParts.push(`[META ORIGEN:${fromSection}]`);

    const finalInstr = [metaParts.join(' '), autoDesc, instrucciones?.trim() || '']
      .filter(Boolean)
      .join(' ')
      .trim();

    if (info.editableKeys.includes('instrucciones')) payload.instrucciones = finalInstr;

    return payload;
  };

  /** Guardar */
  const onSubmit = useCallback(async () => {
    if (!info) return;
    if (!validateStep2()) return;

    const payload = buildPayload();
    if (Object.keys(payload).length === 0) {
      alert("No hay cambios por guardar.");
      return;
    }

    try {
      setSaving(true);
      const updated = await Movimiento.fetchJSON(`${API_BASE}/movimientos/${movimientoId}/edicion`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      // Éxito
      onSaved?.(updated);
      const next = roleToPath(rol);
      window.location.assign(next);
    } catch (e: any) {
      alert(e?.message || "Error al guardar cambios.");
    } finally {
      setSaving(false);
    }
  }, [info, movimientoId, rol, validateStep2, buildPayload, onSaved]);


  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white dark:from-slate-950 dark:to-slate-900 flex items-center justify-center p-6">
        <div className="text-slate-600 dark:text-slate-300 animate-pulse">Cargando editor…</div>
      </div>
    );
  }
  if (error || !info) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white dark:from-slate-950 dark:to-slate-900 p-6 flex items-center justify-center">
        <div className="rounded-xl border border-rose-300 bg-rose-50 p-6 text-rose-700 dark:border-rose-700 dark:bg-rose-900/20 dark:text-rose-200 shadow-lg max-w-md text-center">
          <p className="font-medium mb-2">Error</p>
          {error || "No se pudo cargar la información de edición."}
          <button onClick={onClose || (() => window.location.assign(roleToPath(rol)))} className="mt-4 text-sm underline hover:text-rose-900 dark:hover:text-rose-100">
            Volver
          </button>
        </div>
      </div>
    );
  }

  const estadoActual = String(info.movimiento.estado || "").toUpperCase();
  const estadosPermitidos = (info.restricciones?.estadosPermitidos ?? []).map((e) =>
    String(e || "").toUpperCase()
  );
  const overrideEditable =
    estadosPermitidos.includes(estadoActual) ||
    ["DETENIDO", "EN_PROCESO", "CONCLUIDO"].includes(estadoActual);
  const readOnly = !info.editable && !overrideEditable;
  const empresaLabel = info.movimiento.empresa?.nombre ?? "Sin empresa";
  const localidadLabel = info.movimiento.localidad?.nombre ?? "Sin localidad";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white dark:from-slate-950 dark:to-slate-900 text-slate-900 dark:text-white transition-colors duration-200 p-4 md:p-6 lg:p-8">
      {/* Grid Background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.03)_1px,transparent_1px)] bg-[size:24px_24px] dark:opacity-[0.05]"
      />

      <div className="relative z-10 max-w-4xl mx-auto">
        {/* Top Bar */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Badge tone={readOnly ? "warn" : "ok"}>
            {readOnly
              ? info.restricciones.motivo || "No editable"
              : info.editable
                ? "Editable"
                : "Editable (estado permitido)"}
          </Badge>
          <RoleBadge rol={rol} canManageAll={canManageAll} />

          <button
            onClick={() => setEditFlowMode((current) => current === "mobile" ? "classic" : "mobile")}
            className={Movimiento.clsx(
              "rounded-xl border px-3 py-1.5 text-sm font-semibold transition-all active:scale-95",
              isMobileEditFlow
                ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            )}
          >
            {isMobileEditFlow ? "Vista clasica" : "Flujo mobile"}
          </button>

          <button
            onClick={onClose || (() => window.location.assign(roleToPath(rol)))}
            className="ml-auto rounded-xl border border-rose-200 dark:border-rose-800 px-3 py-1.5 text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all active:scale-95"
            title="Volver"
          >
            Salir
          </button>
        </div>

        {/* Header con icono */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/25">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-600 dark:from-slate-100 dark:to-slate-400 bg-clip-text text-transparent">
              Editar Movimiento #{info.movimiento.id}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
          </div>
          {isMobileEditFlow ? (
            <div className="ml-auto rounded-2xl bg-emerald-50 px-3 py-1.5 text-center dark:bg-emerald-950/40">
              <div className="text-lg font-black leading-5 text-emerald-700 dark:text-emerald-300">{mobileProgress}%</div>
              <div className="text-[9px] font-black uppercase tracking-wide text-emerald-700/70 dark:text-emerald-300/70">completado</div>
            </div>
          ) : null}
        </div>

        {/* Stepper */}
        <div className={Movimiento.clsx("mt-5 items-center justify-center gap-0", isMobileEditFlow ? "hidden" : "flex")} aria-label="Progreso">
          {[1, 2, 3].map((s, i) => (
            <React.Fragment key={s}>
              <div className="flex flex-col items-center gap-1">
                <div
                  className={Movimiento.clsx(
                    "flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold transition-all duration-300",
                    s < step
                      ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/30"
                      : s === step
                        ? "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/40 ring-4 ring-emerald-500/20"
                        : "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
                  )}
                >
                  {s < step ? "✓" : s}
                </div>
                <span className={Movimiento.clsx(
                  "text-[10px] font-semibold transition-colors",
                  s <= step ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500"
                )}>
                  {["Datos", "Detalles", "Confirmar"][i]}
                </span>
              </div>
              {i < 2 && (
                <div className="flex-1 mx-2 mb-4">
                  <div className="h-0.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                      style={{ width: s < step ? "100%" : "0%" }}
                    />
                  </div>
                </div>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Card Content */}
        <div className="mt-6 rounded-2xl border border-slate-200/80 dark:border-slate-800/60 bg-white/95 dark:bg-slate-950/90 backdrop-blur-sm p-5 sm:p-6 shadow-xl shadow-slate-200/30 dark:shadow-slate-900/30">
          {isMobileEditFlow ? (
            <div className="mb-4 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">Editar movimiento</p>
                  <h2 className="truncate text-lg font-black text-slate-950 dark:text-white">{mobileStepTitle}</h2>
                </div>
                <div className="rounded-xl bg-white px-3 py-1 text-xs font-black text-emerald-700 shadow-sm dark:bg-slate-950 dark:text-emerald-300">
                  {mobileCurrentUnit}/{mobileTotalUnits}
                </div>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-emerald-100 dark:bg-emerald-950/70">
                <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500 transition-all duration-300" style={{ width: `${mobileProgress}%` }} />
              </div>
            </div>
          ) : null}
          <div key={mobileTransitionKey} className={isMobileEditFlow ? "animate-in fade-in slide-in-from-right-2 duration-200" : undefined}>
          {step === 1 && (
            <Step1Edit
              readOnly={readOnly}
              form={form}
              vias={vias}
              sectionsByVia={sectionsByVia}
              secLoading={secLoading}
              selectionMode={selectionMode}
              serviceVia={serviceVia}
              setServiceVia={setServiceVia}
              setSelectionMode={setSelectionMode}
              ensureSections={ensureSections}
              viaOrigenId={viaOrigenId}
              setViaOrigenId={setViaOrigenId}
              viaDestinoId={viaDestinoId}
              setViaDestinoId={setViaDestinoId}
              fromSection={fromSection}
              setFromSection={setFromSection}
              toSection={toSection}
              setToSection={setToSection}
              locomotiveNumber={locomotiveNumber}
              setLocomotiveNumber={setLocomotiveNumber}
              viaName={viaName}
              tapToggle={tapToggle}
              setForm={setForm}
              errors={errors}
              empresaLabel={empresaLabel}
              localidadLabel={localidadLabel}
              visualSection={isMobileEditFlow ? mobileStepOneSection : undefined}
            />
          )}

          {step === 2 && (
            <div className="space-y-4">
              <Step2Edit
                readOnly={readOnly || saving}
                tipoMovimiento={tipoMovimiento}
                setTipoMovimiento={setTipoMovimiento}
                posicionCabina={posicionCabina}
                setPosicionCabina={setPosicionCabina}
                posicionChimenea={posicionChimenea}
                setPosicionChimenea={setPosicionChimenea}
                direccionEmpuje={direccionEmpuje}
                setDireccionEmpuje={setDireccionEmpuje}
                polo={polo}
                setPolo={setPolo}
                errors={errors}
              />

              {serviceVia === "Torno" ? (
                <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/40">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{tornoEditorSubtitle}</h4>
                      {isMobileTornoEditor ? (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Pagina {mobileTornoPage + 1} de {tornoMobilePageCount}
                        </p>
                      ) : null}
                    </div>
                    <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 text-xs font-bold shadow-sm dark:border-slate-700 dark:bg-slate-950">
                      <button
                        type="button"
                        onClick={() => setTornoEditMode("mobile")}
                        className={Movimiento.clsx(
                          "rounded-lg px-3 py-1.5 transition-all",
                          tornoEditMode === "mobile"
                            ? "bg-emerald-600 text-white shadow-sm"
                            : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                        )}
                      >
                        Mobile
                      </button>
                      <button
                        type="button"
                        onClick={() => setTornoEditMode("classic")}
                        className={Movimiento.clsx(
                          "rounded-lg px-3 py-1.5 transition-all",
                          tornoEditMode === "classic"
                            ? "bg-emerald-600 text-white shadow-sm"
                            : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                        )}
                      >
                        Clasica
                      </button>
                    </div>
                  </div>

                  <div className={Movimiento.clsx(readOnly || saving ? "pointer-events-none opacity-70" : "")}>
                    {isMobileTornoEditor ? (
                      <MobileGuidedTornoMeasuresStep
                        form={tornoStepForm}
                        setForm={setTornoStepForm}
                        tornoMedicion={tornoMedicion}
                        setTornoWheelCount={setTornoWheelCount}
                        updateTornoMedicion={updateTornoMedicion}
                        companyName={info.movimiento.empresa?.nombre}
                        visualPage={mobileTornoPage}
                      />
                    ) : (
                      <StepTwoTorno
                        form={tornoStepForm}
                        setForm={setTornoStepForm}
                        errors={{
                          movementType: errors.tipoMovimiento,
                          direccionEmpuje: errors.direccionEmpuje,
                        }}
                        tornoMedicion={tornoMedicion}
                        initialTornoMedicion={initialTornoMedicion}
                        setTornoWheelCount={setTornoWheelCount}
                        updateTornoMedicion={updateTornoMedicion}
                        companyName={info.movimiento.empresa?.nombre}
                        hideTypeSelector
                      />
                    )}
                  </div>
                </section>
              ) : null}
            </div>
          )}

          {step === 3 && (
            <Step3Edit
              readOnly={readOnly}
              instrucciones={instrucciones}
              setInstrucciones={setInstrucciones}
              resumen={{
                localidad: info.movimiento.localidad?.nombre,
                origen: viaOrigenId ? `Vía ${viaName(viaOrigenId)}${fromSection ? ` (Sección #${fromSection})` : ""}` : "—",
                destino: viaDestinoId ? `Vía ${viaName(viaDestinoId)}${toSection ? ` (Sección #${toSection})` : ""}` : "—",
                loco: locomotiveNumber || "—",
                tipo: tipoMovimiento || "—",
                dir: direccionEmpuje || "—",
              }}
              metaHint={
                (fromSection ? `[META ORIGEN:${fromSection}] ` : "") +
                (toSection ? `[META SECCION:${toSection}]` : "")
              }
              saving={saving}
              onSubmit={onSubmit}
            />
          )}
          </div>
        </div>

        {/* Actions Footer */}
        <div className="mt-5 flex flex-wrap gap-3">
          {(step > 1 || (isMobileEditFlow && step === 1 && mobileStepOnePage > 0)) && (
            <button
              onClick={goPreviousStep}
              className="rounded-xl border border-amber-300 dark:border-amber-700 px-4 py-2.5 text-sm font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all active:scale-[0.97]"
            >
              ← Anterior
            </button>
          )}
          {step < 3 && (
            <button
              onClick={goNextStep}
              className={Movimiento.clsx(
                "rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition-all active:scale-[0.97]",
                readOnly
                  ? "bg-slate-400 cursor-not-allowed shadow-none"
                  : "bg-gradient-to-r from-emerald-500 to-emerald-600 hover:shadow-emerald-500/40 hover:from-emerald-600 hover:to-emerald-700"
              )}
              disabled={readOnly}
            >
              Siguiente →
            </button>
          )}
          <button
            onClick={onClose || (() => window.location.assign(roleToPath(rol)))}
            className="ml-auto rounded-xl border border-rose-200 dark:border-rose-800 px-4 py-2.5 text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all active:scale-95"
            title="Volver"
          >
            Salir
          </button>
        </div>

        <TornoMeasuresViewerModal
          open={showTornoViewerModal}
          onClose={() => setShowTornoViewerModal(false)}
          tornoMedicion={tornoMedicion}
          locomotiveLabel={locomotiveNumber || String(info.movimiento.locomotiveNumber ?? "")}
          companyName={info.movimiento.empresa?.nombre}
        />
      </div>
    </div>
  );
}

