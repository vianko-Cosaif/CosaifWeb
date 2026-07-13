"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { GuidedTarget } from "@/app/Components/GuidedManualAtom";
import { Movimiento } from "../../Movimiento";
import type { MovementFormData } from "../../movimientos.shared";
import {
  EMPTY_TORNO_VALUE,
  formatTornoMeasure,
  getTornoPositions,
  normalizeTornoMeasureValue,
  TORNO_DEN_OPTIONS,
  TORNO_WHEEL_COUNT_OPTIONS,
  type TornoMeasurementField,
  type TornoMeasurementValue,
  type TornoMedicionState,
  type TornoWheelCount,
  type TornoWheelPosition,
} from "../tornoMedicion.types";
import { resolveTornoProfile, TORNO_PROFILE_FIELDS, TORNO_PROFILE_META } from "../tornoProfiles";
import { LocomotiveWheelMap } from "@/app/Components/locomotive-wheel-selector/LocomotiveWheelMap";
import type {
  LocomotiveViewMode,
  WheelCount,
  WheelData,
  WheelOverride,
} from "@/app/Components/locomotive-wheel-selector/core/types";
import TornoMeasureCopyPasteDialog from "./TornoMeasureCopyPasteDialog";

type Props = {
  form: MovementFormData;
  setForm: React.Dispatch<React.SetStateAction<MovementFormData>>;
  tornoMedicion: TornoMedicionState;
  setTornoWheelCount: (count: TornoWheelCount) => void;
  updateTornoMedicion: (
    position: TornoWheelPosition,
    field: TornoMeasurementField,
    part: "whole" | "num" | "den",
    value: string
  ) => void;
  companyName?: string;
  visualPage: number;
};

const emptyValue: TornoMeasurementValue = { whole: "", num: "", den: "" };
const wholeOptions = ["", ...Array.from({ length: 100 }, (_, index) => String(index))];
const views: Array<{ key: LocomotiveViewMode; label: string }> = [
  { key: "top", label: "Superior" },
  { key: "left", label: "Lateral L" },
  { key: "right", label: "Lateral R" },
];

export function getGuidedTornoMeasuresPageCount() {
  return 2;
}

export function getGuidedTornoMeasuresPageTitle(page: number, wheelCount: TornoWheelCount) {
  if (page <= 0) return "Configurar medidas";
  return `Seleccion de ruedas (${wheelCount})`;
}

function positionToWheelId(position: TornoWheelPosition) {
  const side = position.startsWith("L") ? "L" : "R";
  const axle = Number(position.slice(1));
  return `A${axle}-${side}`;
}

function wheelIdToPosition(id: string): TornoWheelPosition | null {
  const match = /^A(\d+)-(L|R)$/.exec(id);
  if (!match) return null;
  return `${match[2]}${match[1]}` as TornoWheelPosition;
}

function hasMeasureValue(value?: TornoMeasurementValue) {
  return Boolean(value?.whole || value?.num || value?.den);
}

function buildWheelOverrides(
  wheelCount: TornoWheelCount,
  enabledPositions: TornoWheelPosition[],
  selectedPosition: TornoWheelPosition | null,
  hasPositionMeasures: (position: TornoWheelPosition) => boolean
) {
  const enabled = new Set(enabledPositions);
  const wheels: WheelOverride[] = [];
  const axleCount = wheelCount / 2;

  for (let axle = 1; axle <= axleCount; axle += 1) {
    (["L", "R"] as const).forEach((side) => {
      const position = `${side}${axle}` as TornoWheelPosition;
      const enabledForStep = enabled.has(position);
      const hasMeasures = hasPositionMeasures(position);
      wheels.push({
        id: positionToWheelId(position),
        label: position,
        status: enabledForStep ? (hasMeasures ? "completed" : "available") : "disabled",
        observations: enabledForStep
          ? hasMeasures
            ? "Medidas capturadas"
            : "Pendiente de captura"
          : "Disponible en otro grupo",
        metadata: { selected: selectedPosition === position, position },
      });
    });
  }

  return wheels;
}

function MeasurePickerModal(props: {
  open: boolean;
  title: string;
  subtitle: string;
  draft: TornoMeasurementValue;
  onChange: (draft: TornoMeasurementValue) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const { open, title, subtitle, draft, onChange, onCancel, onSave } = props;
  const numeratorOptions = useMemo(() => {
    const denominator = Number(draft.den);
    if (Number.isFinite(denominator) && denominator > 0) {
      return ["", ...Array.from({ length: denominator }, (_, index) => String(index))];
    }
    return ["", ...Array.from({ length: 65 }, (_, index) => String(index))];
  }, [draft.den]);
  const preview = formatTornoMeasure(normalizeTornoMeasureValue(draft)) || "Sin medida";

  if (!open) return null;

  const updatePart = (part: keyof TornoMeasurementValue, value: string) => {
    onChange(normalizeTornoMeasureValue({ ...draft, [part]: value }));
  };

  return createPortal(
    <div className="fixed inset-0 z-[100010] flex items-end justify-center overflow-hidden bg-black/50 p-2 sm:items-center sm:p-3">
      <div className="flex max-h-[calc(100dvh-1rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950 sm:rounded-[28px]">
        <div className="shrink-0 border-b border-slate-200 bg-emerald-50 px-3 py-3 dark:border-zinc-800 dark:bg-emerald-950/30 sm:px-5 sm:py-4">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h4 className="break-words text-lg font-black text-slate-950 dark:text-white sm:text-xl">{title}</h4>
              <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-zinc-400">{subtitle}</p>
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-emerald-800 shadow-sm dark:bg-zinc-900 dark:text-emerald-200"
              aria-label="Cerrar"
            >
              x
            </button>
          </div>
          <div className="mt-3 rounded-2xl border border-emerald-200 bg-white px-3 py-2 text-center text-xl font-black text-emerald-800 dark:border-emerald-800 dark:bg-zinc-950 dark:text-emerald-200 sm:mt-4 sm:px-4 sm:py-3 sm:text-2xl">
            {preview}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-5 sm:py-5">
          <div className="grid gap-3 sm:gap-4">
          {[
            ["whole", "Entero", wholeOptions],
            ["num", "Numerador", numeratorOptions],
            ["den", "Denominador", [...TORNO_DEN_OPTIONS]],
          ].map(([key, label, options]) => (
            <label key={String(key)} className="grid gap-2">
              <span className="text-sm font-black uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                {String(label)}
              </span>
              <select
                className="min-h-14 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-lg font-black text-slate-950 outline-none focus:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                value={draft[key as keyof TornoMeasurementValue]}
                onChange={(event) => updatePart(key as keyof TornoMeasurementValue, event.target.value)}
              >
                {(options as string[]).map((option) => (
                  <option key={`${key}_${option || "empty"}`} value={option}>
                    {option || "-"}
                  </option>
                ))}
              </select>
            </label>
          ))}
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 border-t border-slate-200 bg-slate-50 px-3 py-3 dark:border-zinc-800 dark:bg-zinc-900 min-[360px]:flex-row sm:gap-3 sm:px-5 sm:py-4">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm font-black text-emerald-800 dark:border-emerald-800 dark:bg-zinc-950 dark:text-emerald-200"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onSave}
            className="flex-1 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-emerald-500/25"
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function MobileGuidedTornoMeasuresStep({
  form,
  setForm,
  tornoMedicion,
  setTornoWheelCount,
  updateTornoMedicion,
  companyName,
  visualPage,
}: Props) {
  const profile = useMemo(() => resolveTornoProfile(companyName), [companyName]);
  const profileMeta = TORNO_PROFILE_META[profile];
  const fieldDefs = TORNO_PROFILE_FIELDS[profile];
  const allPositions = useMemo(() => getTornoPositions(tornoMedicion.wheelCount), [tornoMedicion.wheelCount]);
  const enabledPositions = visualPage <= 0 ? [] : allPositions;
  const [viewMode, setViewMode] = useState<LocomotiveViewMode>("top");
  const [selectedPosition, setSelectedPosition] = useState<TornoWheelPosition | null>(null);
  const [wheelModalOpen, setWheelModalOpen] = useState(false);
  const [measureModal, setMeasureModal] = useState<{
    open: boolean;
    position: TornoWheelPosition | null;
    field: TornoMeasurementField | null;
    label: string;
    draft: TornoMeasurementValue;
  }>({ open: false, position: null, field: null, label: "", draft: emptyValue });
  const [copyModal, setCopyModal] = useState<{
    open: boolean;
    sourcePosition: TornoWheelPosition | null;
    sourceField: TornoMeasurementField | null;
    sourceLabel: string;
    sourceValue: TornoMeasurementValue;
  }>({ open: false, sourcePosition: null, sourceField: null, sourceLabel: "", sourceValue: emptyValue });
  const [screenOrientation, setScreenOrientation] = useState<"horizontal" | "vertical">("vertical");

  useEffect(() => {
    const updateOrientation = () => {
      setScreenOrientation(window.innerWidth > window.innerHeight ? "horizontal" : "vertical");
    };

    updateOrientation();
    window.addEventListener("resize", updateOrientation);
    window.addEventListener("orientationchange", updateOrientation);
    return () => {
      window.removeEventListener("resize", updateOrientation);
      window.removeEventListener("orientationchange", updateOrientation);
    };
  }, []);

  const hasPositionMeasures = useCallback((position: TornoWheelPosition) => {
    const row = tornoMedicion.rows[position];
    if (!row) return false;
    return Object.values(row).some(hasMeasureValue);
  }, [tornoMedicion.rows]);

  const wheels = useMemo(
    () => buildWheelOverrides(tornoMedicion.wheelCount, enabledPositions, selectedPosition, hasPositionMeasures),
    [enabledPositions, hasPositionMeasures, selectedPosition, tornoMedicion.wheelCount]
  );
  const selectedWheelId = selectedPosition ? positionToWheelId(selectedPosition) : undefined;
  const isLandscape = screenOrientation === "horizontal";

  const selectMovementType = (movementType: "MD_TRABAJANDO" | "REMOLCADA") => {
    if (movementType === "MD_TRABAJANDO") {
      setForm((prev) => ({
        ...prev,
        movementType,
        direccionEmpuje: "Sin_Solicitar",
        pushPull: "",
      }));
      return;
    }
    setForm((prev) => ({ ...prev, movementType }));
  };

  const selectDireccion = (direccion: "EMPUJAR" | "JALAR") => {
    setForm((prev) => ({ ...prev, direccionEmpuje: direccion, pushPull: direccion }));
  };

  const openWheelModal = (position: TornoWheelPosition) => {
    setSelectedPosition(position);
    setWheelModalOpen(true);
  };

  const handleWheelSelect = (wheel: WheelData) => {
    const position = wheelIdToPosition(wheel.id);
    if (!position || !enabledPositions.includes(position)) return;
    openWheelModal(position);
  };

  const openMeasureModal = (
    position: TornoWheelPosition,
    field: TornoMeasurementField,
    label: string,
    value: TornoMeasurementValue
  ) => {
    setMeasureModal({
      open: true,
      position,
      field,
      label,
      draft: { whole: value.whole ?? "", num: value.num ?? "", den: value.den ?? "" },
    });
  };

  const closeMeasureModal = () => setMeasureModal((current) => ({ ...current, open: false }));

  const applyMeasureModal = () => {
    if (!measureModal.position || !measureModal.field) {
      closeMeasureModal();
      return;
    }
    const normalized = normalizeTornoMeasureValue(measureModal.draft);
    updateTornoMedicion(measureModal.position, measureModal.field, "whole", normalized.whole);
    updateTornoMedicion(measureModal.position, measureModal.field, "num", normalized.num);
    updateTornoMedicion(measureModal.position, measureModal.field, "den", normalized.den);
    closeMeasureModal();
  };

  const applyCopyTargets = (
    targets: Array<{ position: TornoWheelPosition; field: TornoMeasurementField }>,
    sourceValue: TornoMeasurementValue
  ) => {
    targets.forEach((target) => {
      updateTornoMedicion(target.position, target.field, "whole", sourceValue.whole);
      updateTornoMedicion(target.position, target.field, "num", sourceValue.num);
      updateTornoMedicion(target.position, target.field, "den", sourceValue.den);
    });
    setCopyModal((current) => ({ ...current, open: false }));
  };

  if (visualPage <= 0) {
    return (
    <div className="grid min-w-0 gap-3 sm:gap-4">
        <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:rounded-[26px] sm:p-5">
          <div className="text-xs font-black uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-300">
            Formato de medicion
          </div>
          <div className="mt-2 text-xl font-black text-slate-950 dark:text-white">{profileMeta.title}</div>
          <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-zinc-400">{profileMeta.description}</p>
        </div>

        <GuidedTarget id="torno-movement-type">
          <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:rounded-[26px] sm:p-5">
            <div className="text-sm font-black text-slate-950 dark:text-white">Tipo de movimiento</div>
            <div className="mt-3 grid grid-cols-1 gap-2 min-[380px]:grid-cols-2 sm:gap-3">
              {(["MD_TRABAJANDO", "REMOLCADA"] as const).map((type) => {
                const selected = form.movementType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => selectMovementType(type)}
                    className={Movimiento.clsx(
                      "min-h-14 rounded-2xl border px-4 text-sm font-black transition-colors",
                      selected
                        ? "border-emerald-600 bg-emerald-600 text-white"
                        : "border-slate-200 bg-slate-50 text-slate-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
                    )}
                  >
                    {type === "MD_TRABAJANDO" ? "MD" : "Remolcada"}
                  </button>
                );
              })}
            </div>
          </div>
        </GuidedTarget>

        {form.movementType === "REMOLCADA" ? (
          <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:rounded-[26px] sm:p-5">
            <div className="text-sm font-black text-slate-950 dark:text-white">Direccion</div>
            <div className="mt-3 grid grid-cols-1 gap-2 min-[380px]:grid-cols-2 sm:gap-3">
              {(["EMPUJAR", "JALAR"] as const).map((direction) => {
                const selected = form.direccionEmpuje === direction;
                return (
                  <button
                    key={direction}
                    type="button"
                    onClick={() => selectDireccion(direction)}
                    className={Movimiento.clsx(
                      "min-h-14 rounded-2xl border px-4 text-sm font-black transition-colors",
                      selected
                        ? "border-emerald-600 bg-emerald-600 text-white"
                        : "border-slate-200 bg-slate-50 text-slate-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
                    )}
                  >
                    {direction === "EMPUJAR" ? "Empujar" : "Jalar"}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <GuidedTarget id="torno-wheel-count">
          <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:rounded-[26px] sm:p-5">
            <div className="text-sm font-black text-slate-950 dark:text-white">Numero de ruedas</div>
            <div className="mt-3 grid grid-cols-2 gap-2 min-[420px]:grid-cols-4">
              {TORNO_WHEEL_COUNT_OPTIONS.map((count) => {
                const selected = tornoMedicion.wheelCount === count;
                return (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setTornoWheelCount(count)}
                    className={Movimiento.clsx(
                      "min-h-14 rounded-2xl border px-2 text-lg font-black transition-colors",
                      selected
                        ? "border-emerald-600 bg-emerald-600 text-white"
                        : "border-slate-200 bg-slate-50 text-slate-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
                    )}
                  >
                    {count}
                  </button>
                );
              })}
            </div>
          </div>
        </GuidedTarget>
      </div>
    );
  }

  return (
    <div className="grid min-w-0 gap-3 sm:gap-4">
      <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 min-[380px]:p-3 sm:rounded-[26px] sm:p-4">
        <div className="mb-3 grid grid-cols-3 gap-2">
          {views.map((view) => {
            const active = viewMode === view.key;
            return (
              <button
                key={view.key}
                type="button"
                onClick={() => setViewMode(view.key)}
                className={Movimiento.clsx(
                  "min-h-11 min-w-0 rounded-xl border px-1 text-[11px] font-black transition-colors min-[380px]:rounded-2xl min-[380px]:px-2 min-[380px]:text-xs",
                  active
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-slate-200 bg-slate-50 text-slate-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                )}
              >
                {view.label}
              </button>
            );
          })}
        </div>
        <div
          className={Movimiento.clsx(
            "grid min-w-0 gap-3",
            isLandscape && "md:grid-cols-[minmax(0,1fr)_minmax(150px,220px)] md:items-start"
          )}
        >
          <div className="overflow-hidden rounded-[22px] border border-slate-200 bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900">
            <LocomotiveWheelMap
              wheelCount={tornoMedicion.wheelCount as WheelCount}
              viewMode={viewMode}
              selectedWheelId={selectedWheelId}
              wheels={wheels}
              showLabels={false}
              orientation={screenOrientation}
              labels={{ instructions: "Selecciona la rueda a capturar." }}
              onWheelSelect={handleWheelSelect}
            />
          </div>
          <div
            className={Movimiento.clsx(
              "flex min-w-0 flex-wrap gap-2",
              isLandscape && "md:max-h-[320px] md:overflow-y-auto md:pr-1"
            )}
          >
            {enabledPositions.map((position) => {
              const selected = selectedPosition === position;
              const hasMeasures = hasPositionMeasures(position);
              return (
                <button
                  key={position}
                  type="button"
                  onClick={() => openWheelModal(position)}
                  className={Movimiento.clsx(
                    "rounded-full border px-3 py-2 text-xs font-black transition-colors",
                    isLandscape && "md:w-full md:justify-start",
                    selected
                      ? "border-emerald-600 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
                      : "border-slate-200 bg-slate-50 text-slate-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                  )}
                >
                  {position} {hasMeasures ? "capturada" : "pendiente"}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:rounded-[26px] sm:p-5">
        <div className="text-sm font-black text-slate-950 dark:text-white">Captura por rueda</div>
        <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-zinc-400">
          Toca una rueda en la locomotora para abrir sus medidas. Puedes regresar a cualquier rueda antes de revisar la solicitud.
        </p>
      </div>

      {wheelModalOpen && selectedPosition ? createPortal(
        <div className="fixed inset-0 z-[100010] flex items-end justify-center overflow-hidden bg-black/50 p-2 sm:items-center sm:p-3">
          <div className="flex max-h-[calc(100dvh-1rem)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950 sm:rounded-[30px]">
            <div className="flex shrink-0 items-start gap-2 border-b border-slate-200 bg-slate-50 px-3 py-3 dark:border-zinc-800 dark:bg-zinc-900 sm:gap-3 sm:px-5 sm:py-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-base font-black text-white sm:h-14 sm:w-14 sm:rounded-2xl sm:text-lg">
                {selectedPosition}
              </div>
              <div className="min-w-0 flex-1">
                <div className="break-words text-lg font-black text-slate-950 dark:text-white sm:text-xl">Rueda {selectedPosition}</div>
                <p className="text-sm font-semibold text-slate-500 dark:text-zinc-400">
                  Selecciona cada propiedad para capturar su medida.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setWheelModalOpen(false)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-emerald-800 shadow-sm dark:bg-zinc-950 dark:text-emerald-200"
                aria-label="Cerrar"
              >
                x
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-5 sm:py-4">
              <div className="grid gap-3">
                {fieldDefs.map((field) => {
                  const value = tornoMedicion.rows[selectedPosition]?.[field.key] ?? EMPTY_TORNO_VALUE;
                  const formatted = formatTornoMeasure(value);
                  const hasValue = formatted.trim() !== "";
                  return (
                    <button
                      key={`${selectedPosition}_${field.key}`}
                      type="button"
                      onClick={() => openMeasureModal(selectedPosition, field.key, field.label, value)}
                      className={Movimiento.clsx(
                        "flex min-w-0 items-center gap-2 rounded-xl border px-3 py-3 text-left transition-colors sm:gap-3 sm:rounded-2xl sm:px-4 sm:py-4",
                        hasValue
                          ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/30"
                          : "border-slate-200 bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900"
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-black text-slate-800 dark:text-zinc-100">{field.label}</div>
                        <div className={Movimiento.clsx("mt-1 text-lg font-black", hasValue ? "text-emerald-800 dark:text-emerald-200" : "text-slate-400 dark:text-zinc-500")}>
                          {formatted || "Configurar"}
                        </div>
                      </div>
                      {hasValue ? (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(event) => {
                            event.stopPropagation();
                            setCopyModal({
                              open: true,
                              sourcePosition: selectedPosition,
                              sourceField: field.key,
                              sourceLabel: field.label,
                              sourceValue: value,
                            });
                          }}
                          onKeyDown={(event) => {
                            if (event.key !== "Enter" && event.key !== " ") return;
                            event.preventDefault();
                            event.stopPropagation();
                            setCopyModal({
                              open: true,
                              sourcePosition: selectedPosition,
                              sourceField: field.key,
                              sourceLabel: field.label,
                              sourceValue: value,
                            });
                          }}
                          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-white text-sm font-black text-emerald-800 dark:border-emerald-800 dark:bg-zinc-950 dark:text-emerald-200"
                        >
                          Cop.
                        </span>
                      ) : null}
                      <span className="text-xl font-black text-emerald-700">{hasValue ? "✓" : "+"}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-3 py-3 dark:border-zinc-800 dark:bg-zinc-900 sm:px-5 sm:py-4">
              <button
                type="button"
                onClick={() => setWheelModalOpen(false)}
                className="min-h-12 w-full rounded-2xl bg-emerald-600 px-4 text-sm font-black text-white shadow-lg shadow-emerald-500/25"
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>,
        document.body
      ) : null}

      <MeasurePickerModal
        open={measureModal.open}
        title="Seleccion de medida"
        subtitle={`${measureModal.position ?? "--"} - ${measureModal.label}`}
        draft={measureModal.draft}
        onChange={(draft) => setMeasureModal((current) => ({ ...current, draft }))}
        onCancel={closeMeasureModal}
        onSave={applyMeasureModal}
      />

      <TornoMeasureCopyPasteDialog
        open={copyModal.open}
        positions={allPositions}
        fields={fieldDefs}
        sourcePosition={copyModal.sourcePosition}
        sourceField={copyModal.sourceField}
        sourceLabel={copyModal.sourceLabel}
        sourceValue={copyModal.sourceValue}
        getValue={(position, field) => tornoMedicion.rows[position]?.[field] ?? emptyValue}
        formatValue={formatTornoMeasure}
        onCancel={() => setCopyModal((current) => ({ ...current, open: false }))}
        onApply={applyCopyTargets}
      />
    </div>
  );
}
