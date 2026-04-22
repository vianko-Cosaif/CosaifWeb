import React, { useEffect, useMemo, useState } from "react";
import { Movimiento } from "../../Movimiento";
import type { MovementFormData } from "../../movimientos.shared";
import {
  EMPTY_TORNO_ROW,
  EMPTY_TORNO_VALUE,
  formatTornoMeasure,
  getTornoPositions,
  TORNO_DEN_OPTIONS,
  TORNO_WHEEL_COUNT_OPTIONS,
  type TornoMeasurementField,
  type TornoMeasurementPart,
  type TornoMedicionState,
  type TornoMeasurementValue,
  type TornoWheelCount,
  type TornoWheelPosition,
} from "../tornoMedicion.types";
import {
  resolveTornoProfile,
  TORNO_PROFILE_FIELDS,
  TORNO_PROFILE_META,
  type TornoFieldDef,
} from "../tornoProfiles";

/**
 * Props del Step 2 especializado para servicio Torno.
 */
type StepTwoTornoProps = {
  form: MovementFormData;
  setForm: React.Dispatch<React.SetStateAction<MovementFormData>>;
  errors: Record<string, string>;
  tornoMedicion: TornoMedicionState;
  setTornoWheelCount: (count: TornoWheelCount) => void;
  updateTornoMedicion: (
    position: TornoWheelPosition,
    field: TornoMeasurementField,
    part: TornoMeasurementPart,
    value: string
  ) => void;
  companyName?: string;
  hideTypeSelector?: boolean;
};

type TornoCopyCell = {
  position: TornoWheelPosition;
  field: TornoMeasurementField;
};

type TornoCopyState = {
  source: TornoCopyCell;
  targets: string[];
};

type TornoPasteFeedback = {
  cells: string[];
  token: number;
};

type MeasurePartsInputProps = {
  position: TornoWheelPosition;
  field: TornoMeasurementField;
  value: TornoMeasurementValue;
  onChange: (part: TornoMeasurementPart, value: string) => void;
  compact?: boolean;
  copyModeActive?: boolean;
  isCopySource?: boolean;
  isCopyTarget?: boolean;
  isRecentlyPasted?: boolean;
  onStartCopy: (position: TornoWheelPosition, field: TornoMeasurementField) => void;
  onToggleCopyTarget: (position: TornoWheelPosition, field: TornoMeasurementField) => void;
};

type PositionRowProps = {
  position: TornoWheelPosition;
  fieldDefs: TornoFieldDef[];
  row: TornoMedicionState["rows"][TornoWheelPosition] | undefined;
  updateTornoMedicion: StepTwoTornoProps["updateTornoMedicion"];
  copyModeActive: boolean;
  copySourceId: string | null;
  selectedTargetIds: Set<string>;
  pastedCells: Set<string>;
  onStartCopy: (position: TornoWheelPosition, field: TornoMeasurementField) => void;
  onToggleCopyTarget: (position: TornoWheelPosition, field: TornoMeasurementField) => void;
};

type SideTableProps = {
  title: string;
  positions: TornoWheelPosition[];
  fieldDefs: TornoFieldDef[];
  rows: TornoMedicionState["rows"];
  updateTornoMedicion: StepTwoTornoProps["updateTornoMedicion"];
  copyModeActive: boolean;
  copySourceId: string | null;
  selectedTargetIds: Set<string>;
  pastedCells: Set<string>;
  onStartCopy: (position: TornoWheelPosition, field: TornoMeasurementField) => void;
  onToggleCopyTarget: (position: TornoWheelPosition, field: TornoMeasurementField) => void;
};

const PASTE_FEEDBACK_STYLES = `
  @keyframes pasteFeedbackPop {
    0% {
      transform: scale(1);
      background-color: rgba(251, 191, 36, 0);
      box-shadow: 0 0 0 rgba(251, 191, 36, 0);
    }
    35% {
      transform: scale(1.045);
      background-color: rgba(254, 240, 138, 0.55);
      box-shadow: 0 0 0 6px rgba(251, 191, 36, 0.18);
    }
    100% {
      transform: scale(1);
      background-color: rgba(251, 191, 36, 0);
      box-shadow: 0 0 0 rgba(251, 191, 36, 0);
    }
  }

  :global(.dark) .paste-feedback {
    animation: pasteFeedbackPop 850ms ease-out;
  }

  .paste-feedback {
    animation: pasteFeedbackPop 850ms ease-out;
    will-change: transform, background-color, box-shadow;
  }
`;

function getCopyCellId(position: TornoWheelPosition, field: TornoMeasurementField): string {
  return `${position}::${field}`;
}

function hasMeasureValue(value: TornoMeasurementValue): boolean {
  return (
    value.whole.trim() !== "" ||
    value.num.trim() !== "" ||
    value.den.trim() !== ""
  );
}

function CompactChoice(props: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  const { active, label, onClick } = props;
  return (
    <button
      onClick={onClick}
      className={Movimiento.clsx(
        "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors duration-200 sm:text-sm",
        active
          ? "border-emerald-600 bg-emerald-600 text-white"
          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
      )}
    >
      {label}
    </button>
  );
}

const MeasurePartsInput = React.memo(function MeasurePartsInput(props: MeasurePartsInputProps) {
  const {
    position,
    field,
    value,
    onChange,
    compact,
    copyModeActive,
    isCopySource,
    isCopyTarget,
    isRecentlyPasted,
    onStartCopy,
    onToggleCopyTarget,
  } = props;

  const selectable = !!copyModeActive && !isCopySource;
  const inputDisabled = !!copyModeActive;
  const passthroughClasses = copyModeActive ? "pointer-events-none" : "";
  const hasMeasure = hasMeasureValue(value);

  return (
    <div className="flex min-w-0 items-center">
      <div
        onClick={() => {
          if (selectable) onToggleCopyTarget(position, field);
        }}
        onKeyDown={(event) => {
          if (!selectable) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onToggleCopyTarget(position, field);
          }
        }}
        role={selectable ? "button" : undefined}
        tabIndex={selectable ? 0 : undefined}
        aria-pressed={selectable ? isCopyTarget : undefined}
        className={Movimiento.clsx(
          "flex min-w-0 items-center rounded-lg border border-slate-200 bg-white px-1.5 py-1 transition-all dark:border-slate-700 dark:bg-slate-950",
          hasMeasure && !copyModeActive && "border-emerald-500 ring-1 ring-emerald-500/25 dark:border-emerald-500 dark:ring-emerald-500/25",
          isRecentlyPasted && "paste-feedback border-amber-400 bg-amber-50 ring-2 ring-amber-300/60 dark:border-amber-400 dark:bg-amber-900/30 dark:ring-amber-500/40",
          copyModeActive && !isCopySource && !isCopyTarget && "opacity-55 saturate-75",
          selectable && "cursor-pointer hover:border-sky-400 hover:bg-sky-100/80 hover:opacity-100 dark:hover:border-sky-500 dark:hover:bg-sky-900/30",
          isCopySource && "border-emerald-600 bg-emerald-100 shadow-md ring-2 ring-emerald-500/40 opacity-100 dark:border-emerald-500 dark:bg-emerald-900/35",
          isCopyTarget && "border-sky-600 bg-sky-200 shadow-md ring-2 ring-sky-500/40 opacity-100 dark:border-sky-500 dark:bg-sky-800/60",
          compact ? "w-[172px]" : "w-full"
        )}
      >
        <input
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="in"
          value={value.whole}
          onChange={(e) => onChange("whole", e.target.value)}
          disabled={inputDisabled}
          className={Movimiento.clsx(
            "h-7 w-12 shrink-0 rounded-md border border-slate-200 bg-white px-1.5 text-center text-xs text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100",
            passthroughClasses,
            copyModeActive && !isCopySource && !isCopyTarget && "opacity-75",
            isCopyTarget && "border-sky-500 bg-white dark:border-sky-400 dark:bg-sky-950/30",
            isCopySource && "border-emerald-500 bg-white dark:border-emerald-400 dark:bg-emerald-950/30"
          )}
          aria-label="Pulgadas enteras"
        />
        <div className={Movimiento.clsx("mx-2 h-6 w-px shrink-0 bg-slate-200 dark:bg-slate-700", passthroughClasses)} aria-hidden="true" />
        <div className="flex min-w-0 flex-1 items-center">
          <input
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="num"
            value={value.num}
            onChange={(e) => onChange("num", e.target.value)}
            disabled={inputDisabled}
            className={Movimiento.clsx(
              "h-7 min-w-0 w-10 flex-1 rounded-md border border-slate-200 bg-white px-1 text-center text-xs text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100",
              passthroughClasses,
              copyModeActive && !isCopySource && !isCopyTarget && "opacity-75",
              isCopyTarget && "border-sky-500 bg-white dark:border-sky-400 dark:bg-sky-950/30",
              isCopySource && "border-emerald-500 bg-white dark:border-emerald-400 dark:bg-emerald-950/30"
            )}
            aria-label="Numerador de fracción"
          />
          <span className={Movimiento.clsx(
            "px-1 text-xs font-semibold text-slate-400 dark:text-slate-400",
            passthroughClasses,
            copyModeActive && !isCopySource && !isCopyTarget && "opacity-60",
            isCopyTarget && "text-sky-600 dark:text-sky-300",
            isCopySource && "text-emerald-600 dark:text-emerald-300"
          )}>/</span>
          <select
            value={value.den}
            onChange={(e) => onChange("den", e.target.value)}
            disabled={inputDisabled}
            className={Movimiento.clsx(
              "h-7 w-12 shrink-0 rounded-md border border-slate-200 bg-white px-1 text-center text-xs text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100",
              passthroughClasses,
              copyModeActive && !isCopySource && !isCopyTarget && "opacity-75",
              isCopyTarget && "border-sky-500 bg-white dark:border-sky-400 dark:bg-sky-950/30",
              isCopySource && "border-emerald-500 bg-white dark:border-emerald-400 dark:bg-emerald-950/30"
            )}
            aria-label="Denominador de fracción"
          >
            {TORNO_DEN_OPTIONS.map((option) => (
              <option key={option || "empty"} value={option}>
                {option || "--"}
              </option>
            ))}
          </select>
        </div>
        <span className={Movimiento.clsx(
          "ml-1 shrink-0 text-xs font-semibold text-slate-400 dark:text-slate-400",
          passthroughClasses,
          copyModeActive && !isCopySource && !isCopyTarget && "opacity-60",
          isCopyTarget && "text-sky-600 dark:text-sky-300",
          isCopySource && "text-emerald-600 dark:text-emerald-300"
        )}>&quot;</span>
      </div>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onStartCopy(position, field);
        }}
        className={Movimiento.clsx(
          "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-r-lg border transition-colors",
          isCopySource
            ? "border-emerald-500 bg-emerald-600 text-white shadow-sm"
            : "border-slate-200 bg-white text-slate-500 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-emerald-700 dark:hover:bg-emerald-900/20 dark:hover:text-emerald-300"
        )}
        aria-label={`Copiar medida de ${position}`}
        title="Copiar esta medida"
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="9" y="9" width="11" height="11" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      </button>
    </div>
  );
});

const PositionRow = React.memo(function PositionRow(props: PositionRowProps) {
  const {
    position,
    fieldDefs,
    row,
    updateTornoMedicion,
    copyModeActive,
    copySourceId,
    selectedTargetIds,
    pastedCells,
    onStartCopy,
    onToggleCopyTarget,
  } = props;

  return (
    <tr className="border-t border-slate-800">
      <td className="sticky left-0 z-[1] border-r border-slate-200 bg-slate-50 px-3 py-2 font-semibold text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100">
        {position}
      </td>
      {fieldDefs.map((field) => {
        const cellId = getCopyCellId(position, field.key);
        const measure = row?.[field.key] ?? EMPTY_TORNO_VALUE;
        return (
          <td key={`${position}_${field.key}`} className="px-3 py-2">
            <MeasurePartsInput
              position={position}
              field={field.key}
              compact
              value={measure}
              onChange={(part, value) => updateTornoMedicion(position, field.key, part, value)}
              copyModeActive={copyModeActive}
              isCopySource={copySourceId === cellId}
              isCopyTarget={selectedTargetIds.has(cellId)}
              isRecentlyPasted={pastedCells.has(cellId)}
              onStartCopy={onStartCopy}
              onToggleCopyTarget={onToggleCopyTarget}
            />
          </td>
        );
      })}
    </tr>
  );
});

const SideTable = React.memo(function SideTable(props: SideTableProps) {
  const {
    title,
    positions,
    fieldDefs,
    rows,
    updateTornoMedicion,
    copyModeActive,
    copySourceId,
    selectedTargetIds,
    pastedCells,
    onStartCopy,
    onToggleCopyTarget,
  } = props;

  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/40">
      <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
        {title}
      </div>
      <div className="overflow-x-auto overflow-y-auto">
        <table className="w-full min-w-[620px] text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur dark:bg-slate-900/95">
            <tr>
              <th className="sticky left-0 z-20 border-r border-slate-200 bg-slate-50/95 px-3 py-2 text-left font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-900/95 dark:text-slate-300">Pos.</th>
              {fieldDefs.map((field) => (
                <th key={field.key} className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">
                  {field.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {positions.map((position) => (
              <PositionRow
                key={`${title}_${position}`}
                position={position}
                fieldDefs={fieldDefs}
                row={rows[position] ?? EMPTY_TORNO_ROW}
                updateTornoMedicion={updateTornoMedicion}
                copyModeActive={copyModeActive}
                copySourceId={copySourceId}
                selectedTargetIds={selectedTargetIds}
                onStartCopy={onStartCopy}
                onToggleCopyTarget={onToggleCopyTarget}
                pastedCells={pastedCells}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});

/**
 * Step 2 (Torno):
 * - Plantillas por empresa (Wabtec / Altom / Progress / Default).
 * - Captura fraccional guiada y responsiva.
 */
export default function StepTwoTorno(props: StepTwoTornoProps) {
  const {
    form,
    setForm,
    errors,
    tornoMedicion,
    setTornoWheelCount,
    updateTornoMedicion,
    companyName,
    hideTypeSelector = false,
  } = props;

  const profile = useMemo(() => resolveTornoProfile(companyName), [companyName]);
  const profileMeta = TORNO_PROFILE_META[profile];
  const fieldDefs = TORNO_PROFILE_FIELDS[profile];
  const validFieldKeys = useMemo(
    () => new Set(fieldDefs.map((field) => field.key)),
    [fieldDefs]
  );

  const positions = useMemo(
    () => getTornoPositions(tornoMedicion.wheelCount),
    [tornoMedicion.wheelCount]
  );

  const leftPositions = useMemo(
    () => positions.filter((position) => position.startsWith("L")),
    [positions]
  );

  const rightPositions = useMemo(
    () => positions.filter((position) => position.startsWith("R")),
    [positions]
  );

  const [mobilePosition, setMobilePosition] = useState<TornoWheelPosition>("L1");
  const [copyState, setCopyState] = useState<TornoCopyState | null>(null);
  const [pasteFeedback, setPasteFeedback] = useState<TornoPasteFeedback | null>(null);
  const [mobileCopyModalOpen, setMobileCopyModalOpen] = useState(false);
  const [mobileAccordionPosition, setMobileAccordionPosition] = useState<TornoWheelPosition | null>(null);

  useEffect(() => {
    if (!positions.includes(mobilePosition)) {
      setMobilePosition(positions[0] ?? "L1");
    }
  }, [positions, mobilePosition]);

  useEffect(() => {
    setCopyState((current) => {
      if (!current) return null;

      const sourceStillValid =
        positions.includes(current.source.position) &&
        validFieldKeys.has(current.source.field);

      if (!sourceStillValid) return null;

      const nextTargets = current.targets.filter((targetId) => {
        const [position, field] = targetId.split("::") as [TornoWheelPosition, TornoMeasurementField];
        return positions.includes(position) && validFieldKeys.has(field);
      });

      if (nextTargets.length === current.targets.length) return current;
      return { ...current, targets: nextTargets };
    });
  }, [positions, validFieldKeys]);

  useEffect(() => {
    if (!pasteFeedback) return;

    const timeoutId = window.setTimeout(() => {
      setPasteFeedback((current) =>
        current?.token === pasteFeedback.token ? null : current
      );
    }, 1100);

    return () => window.clearTimeout(timeoutId);
  }, [pasteFeedback]);

  useEffect(() => {
    if (!copyState) {
      setMobileCopyModalOpen(false);
      setMobileAccordionPosition(null);
    }
  }, [copyState]);

  const selectedMobileRow = tornoMedicion.rows[mobilePosition] ?? EMPTY_TORNO_ROW;
  const pastedCells = useMemo(
    () => new Set(pasteFeedback?.cells ?? []),
    [pasteFeedback]
  );
  const copySourceId = copyState
    ? getCopyCellId(copyState.source.position, copyState.source.field)
    : null;
  const selectedTargetIds = useMemo(
    () => new Set(copyState?.targets ?? []),
    [copyState]
  );
  const copySourceValue = copyState
    ? (tornoMedicion.rows[copyState.source.position]?.[copyState.source.field] ?? EMPTY_TORNO_VALUE)
    : null;
  const fieldLabelByKey = useMemo(
    () => new Map(fieldDefs.map((field) => [field.key, field.label] as const)),
    [fieldDefs]
  );
  const copySourceLabel = copyState
    ? fieldLabelByKey.get(copyState.source.field) ?? copyState.source.field
    : "";

  const startCopySelection = React.useCallback((position: TornoWheelPosition, field: TornoMeasurementField) => {
    setCopyState({
      source: { position, field },
      targets: [],
    });
  }, []);

  const startMobileCopySelection = React.useCallback((position: TornoWheelPosition, field: TornoMeasurementField) => {
    setCopyState({
      source: { position, field },
      targets: [],
    });
    setMobileCopyModalOpen(true);
    setMobileAccordionPosition(position);
  }, []);

  const toggleCopyTarget = React.useCallback((position: TornoWheelPosition, field: TornoMeasurementField) => {
    const targetId = getCopyCellId(position, field);
    setCopyState((current) => {
      if (!current) return current;
      if (current.source.position === position && current.source.field === field) return current;

      const exists = current.targets.includes(targetId);
      return {
        ...current,
        targets: exists
          ? current.targets.filter((id) => id !== targetId)
          : [...current.targets, targetId],
      };
    });
  }, []);

  const cancelCopySelection = React.useCallback(() => {
    setCopyState(null);
    setMobileCopyModalOpen(false);
    setMobileAccordionPosition(null);
  }, []);

  const applyCopySelection = React.useCallback(() => {
    if (!copyState || !copySourceValue) return;

    const targetIds = [...copyState.targets];

    for (const targetId of targetIds) {
      const [position, field] = targetId.split("::") as [TornoWheelPosition, TornoMeasurementField];
      updateTornoMedicion(position, field, "whole", copySourceValue.whole);
      updateTornoMedicion(position, field, "num", copySourceValue.num);
      updateTornoMedicion(position, field, "den", copySourceValue.den);
    }

    setPasteFeedback({
      cells: targetIds,
      token: Date.now(),
    });
    setCopyState(null);
    setMobileCopyModalOpen(false);
    setMobileAccordionPosition(null);
  }, [copySourceValue, copyState, updateTornoMedicion]);

  return (
    <div className="grid min-w-0 gap-4">
      <style jsx>{PASTE_FEEDBACK_STYLES}</style>
      <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 shadow-xl shadow-slate-200/30 dark:border-slate-800 dark:bg-slate-950/90 dark:text-slate-100 dark:shadow-zinc-900/30 sm:p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Registro de Medidas</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">{profileMeta.description}</p>
            <span className="mt-1 inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-semibold text-slate-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200">
              {profileMeta.title}
            </span>
          </div>
          <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700 dark:border-emerald-600/60 dark:bg-emerald-500/10 dark:text-emerald-300">
            Locomotora: {form.locomotiveNumber || "-"}
          </div>
        </div>

        {copyState ? (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-sky-200 bg-sky-50/90 px-3 py-2 text-sm text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100">
            <div className="min-w-0 flex-1">
              <span className="font-semibold">Modo copiado activo.</span>{" "}
              Origen: <span className="font-semibold">{copyState.source.position}</span> /{" "}
              <span className="font-semibold">{copySourceLabel}</span>{" "}
              <span className="text-sky-700 dark:text-sky-300">
                ({copySourceValue ? formatTornoMeasure(copySourceValue) || "Sin medida" : "Sin medida"})
              </span>
              . Selecciona los destinos y finaliza para pegar.
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-sky-300 px-2.5 py-1 text-xs font-semibold dark:border-sky-700">
                {copyState.targets.length} destino(s)
              </span>
              <button
                type="button"
                onClick={cancelCopySelection}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={applyCopySelection}
                disabled={copyState.targets.length === 0}
                className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Finalizar y pegar
              </button>
            </div>
          </div>
        ) : null}

        <div className="mb-4 flex min-w-0 flex-wrap items-start gap-4 rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-950/50">
          <div className="min-w-0">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Ruedas</div>
            <div className="inline-flex max-w-full overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
              {TORNO_WHEEL_COUNT_OPTIONS.map((count) => (
                <button
                  key={count}
                  onClick={() => setTornoWheelCount(count)}
                  className={Movimiento.clsx(
                    "px-3 py-1.5 text-xs font-semibold transition-colors duration-200 sm:px-4 sm:text-sm",
                    tornoMedicion.wheelCount === count
                      ? "bg-emerald-600 text-white"
                      : "bg-white text-slate-700 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  )}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>

          {!hideTypeSelector ? (
            <div className="min-w-0">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Tipo</div>
              <div className="flex max-w-full flex-wrap gap-2">
                <CompactChoice
                  label="MD Trabajando"
                  active={form.movementType === "MD_TRABAJANDO"}
                  onClick={() => setForm((p) => ({ ...p, movementType: "MD_TRABAJANDO", direccionEmpuje: "Sin_Solicitar", pushPull: "" }))}
                />
                <CompactChoice
                  label="Remolcada"
                  active={form.movementType === "REMOLCADA"}
                  onClick={() => setForm((p) => ({ ...p, movementType: "REMOLCADA" }))}
                />
              </div>
              {errors.movementType ? <div className="mt-1 text-xs text-rose-600 dark:text-rose-400">{errors.movementType}</div> : null}
            </div>
          ) : null}

          {form.movementType === "REMOLCADA" ? (
            <div className="min-w-0">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Direccion</div>
              <div className="flex max-w-full flex-wrap gap-2">
                <CompactChoice
                  label="Empujar"
                  active={form.direccionEmpuje === "EMPUJAR"}
                  onClick={() => setForm((p) => ({ ...p, direccionEmpuje: "EMPUJAR", pushPull: "EMPUJAR" }))}
                />
                <CompactChoice
                  label="Jalar"
                  active={form.direccionEmpuje === "JALAR"}
                  onClick={() => setForm((p) => ({ ...p, direccionEmpuje: "JALAR", pushPull: "JALAR" }))}
                />
              </div>
              {errors.direccionEmpuje ? <div className="mt-1 text-xs text-rose-600 dark:text-rose-400">{errors.direccionEmpuje}</div> : null}
            </div>
          ) : null}
        </div>

        <div className="min-w-0 lg:hidden">
          <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
            {positions.map((position) => (
              <button
                key={`mobile_${position}`}
                onClick={() => setMobilePosition(position)}
                className={Movimiento.clsx(
                  "shrink-0 rounded-full border px-3 py-1 text-xs font-semibold",
                  mobilePosition === position
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                )}
              >
                {position}
              </button>
            ))}
          </div>

          <div className="grid min-w-0 gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/60">
            {fieldDefs.map((field) => {
              const measure = selectedMobileRow[field.key] ?? EMPTY_TORNO_VALUE;
              return (
                <div key={`mobile_field_${field.key}`} className="min-w-0 rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-950/40">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="min-w-0 flex-1 break-words text-xs font-semibold text-slate-700 dark:text-slate-200">
                      {field.label}
                    </span>
                    <span className="shrink-0 text-[11px] text-slate-500 dark:text-slate-400">{formatTornoMeasure(measure) || "-"}</span>
                  </div>
                  <MeasurePartsInput
                    position={mobilePosition}
                    field={field.key}
                    value={measure}
                    onChange={(part, value) => updateTornoMedicion(mobilePosition, field.key, part, value)}
                    copyModeActive={false}
                    isCopySource={mobileCopyModalOpen && copySourceId === getCopyCellId(mobilePosition, field.key)}
                    isCopyTarget={false}
                    isRecentlyPasted={pastedCells.has(getCopyCellId(mobilePosition, field.key))}
                    onStartCopy={startMobileCopySelection}
                    onToggleCopyTarget={toggleCopyTarget}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {mobileCopyModalOpen && copyState ? (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-3 lg:hidden sm:items-center">
            <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">Pegar medida en varias celdas</div>
                    <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                      Origen: <span className="font-semibold">{copyState.source.position}</span> /{" "}
                      <span className="font-semibold">{copySourceLabel}</span>{" "}
                      <span className="text-emerald-700 dark:text-emerald-300">
                        ({copySourceValue ? formatTornoMeasure(copySourceValue) || "Sin medida" : "Sin medida"})
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={cancelCopySelection}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                    aria-label="Cerrar selector de copiado"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M18 6 6 18" />
                      <path d="m6 6 12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="max-h-[65vh] overflow-y-auto px-3 py-3">
                <div className="mb-3 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100">
                  Marca los destinos desde la lista. Toca una casilla para seleccionar o deseleccionar.
                </div>

                <div className="grid gap-2">
                  {positions.map((position) => {
                    const isOpen = mobileAccordionPosition === position;
                    const selectedCount = fieldDefs.filter((field) =>
                      selectedTargetIds.has(getCopyCellId(position, field.key))
                    ).length;

                    return (
                      <div key={`mobile_copy_${position}`} className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/40">
                        <button
                          type="button"
                          onClick={() => setMobileAccordionPosition((current) => (current === position ? null : position))}
                          className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-900"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{position}</div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              {selectedCount > 0 ? `${selectedCount} seleccionado(s)` : "Sin destinos seleccionados"}
                            </div>
                          </div>
                          <span className={Movimiento.clsx(
                            "rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                            selectedCount > 0
                              ? "border-sky-300 bg-sky-100 text-sky-700 dark:border-sky-700 dark:bg-sky-900/30 dark:text-sky-200"
                              : "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
                          )}>
                            {selectedCount}
                          </span>
                          <svg
                            viewBox="0 0 24 24"
                            className={Movimiento.clsx(
                              "h-4 w-4 shrink-0 text-slate-400 transition-transform dark:text-slate-500",
                              isOpen && "rotate-180"
                            )}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="m6 9 6 6 6-6" />
                          </svg>
                        </button>

                        {isOpen ? (
                          <div className="border-t border-slate-200 px-3 py-2 dark:border-slate-800">
                            <div className="grid gap-2">
                              {fieldDefs.map((field) => {
                                const cellId = getCopyCellId(position, field.key);
                                const isSourceCell = copySourceId === cellId;
                                const checked = selectedTargetIds.has(cellId);
                                const targetMeasure = tornoMedicion.rows[position]?.[field.key] ?? EMPTY_TORNO_VALUE;

                                return (
                                  <label
                                    key={`mobile_copy_field_${position}_${field.key}`}
                                    className={Movimiento.clsx(
                                      "flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors",
                                      isSourceCell
                                        ? "cursor-not-allowed border-emerald-200 bg-emerald-50/80 dark:border-emerald-800 dark:bg-emerald-900/20"
                                        : checked
                                          ? "cursor-pointer border-sky-300 bg-sky-50 dark:border-sky-700 dark:bg-sky-900/20"
                                          : "cursor-pointer border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900"
                                    )}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      disabled={isSourceCell}
                                      onChange={() => toggleCopyTarget(position, field.key)}
                                      className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 dark:border-slate-700"
                                    />
                                    <div className="min-w-0 flex-1">
                                      <div className="text-sm font-medium text-slate-800 dark:text-slate-100">
                                        {field.label}
                                      </div>
                                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                        {isSourceCell
                                          ? "Medida origen"
                                          : formatTornoMeasure(targetMeasure) || "Sin medida capturada"}
                                      </div>
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
                <span className="text-xs text-slate-600 dark:text-slate-300">
                  {copyState.targets.length} destino(s) seleccionado(s)
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={cancelCopySelection}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={applyCopySelection}
                    disabled={copyState.targets.length === 0}
                    className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Finalizar y pegar
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {profile === "wabtec" ? (
          <div className="hidden min-w-0 gap-4 lg:grid lg:grid-cols-2">
            <SideTable
              title="Izquierdo"
              positions={leftPositions}
              fieldDefs={fieldDefs}
              rows={tornoMedicion.rows}
              updateTornoMedicion={updateTornoMedicion}
              copyModeActive={!!copyState}
              copySourceId={copySourceId}
              selectedTargetIds={selectedTargetIds}
              onStartCopy={startCopySelection}
              onToggleCopyTarget={toggleCopyTarget}
              pastedCells={pastedCells}
            />
            <SideTable
              title="Derecho"
              positions={rightPositions}
              fieldDefs={fieldDefs}
              rows={tornoMedicion.rows}
              updateTornoMedicion={updateTornoMedicion}
              copyModeActive={!!copyState}
              copySourceId={copySourceId}
              selectedTargetIds={selectedTargetIds}
              onStartCopy={startCopySelection}
              onToggleCopyTarget={toggleCopyTarget}
              pastedCells={pastedCells}
            />
          </div>
        ) : (
          <div className="hidden min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/40 lg:block">
            <div className="max-h-[54vh] overflow-x-auto overflow-y-auto">
              <table className="w-full min-w-[1080px] text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur dark:bg-slate-900/95">
                  <tr>
                    <th className="sticky left-0 z-20 border-r border-slate-200 bg-slate-50/95 px-3 py-3 text-left font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-900/95 dark:text-slate-300">Posicion</th>
                    {fieldDefs.map((field) => (
                      <th key={field.key} className="px-3 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">
                        {field.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {positions.map((position) => (
                    <PositionRow
                      key={`desktop_${position}`}
                      position={position}
                      fieldDefs={fieldDefs}
                      row={tornoMedicion.rows[position] ?? EMPTY_TORNO_ROW}
                      updateTornoMedicion={updateTornoMedicion}
                      copyModeActive={!!copyState}
                      copySourceId={copySourceId}
                      selectedTargetIds={selectedTargetIds}
                      onStartCopy={startCopySelection}
                      onToggleCopyTarget={toggleCopyTarget}
                      pastedCells={pastedCells}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          Las medidas son opcionales por campo y se guardan en draft local durante esta solicitud.
        </p>
      </section>
    </div>
  );
}
