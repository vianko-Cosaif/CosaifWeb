import React, { useEffect, useMemo, useState } from "react";
import { GuidedTarget } from "@/app/Components/GuidedManualAtom";
import { Movimiento } from "../../Movimiento";
import type { MovementFormData } from "../../movimientos.shared";
import {
  EMPTY_TORNO_ROW,
  EMPTY_TORNO_VALUE,
  formatTornoMeasure,
  getTornoPositions,
  normalizeTornoMeasureValue,
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
} from "../tornoProfiles";
import {
  DynamicTable,
  DynamicTableCopyPasteDialog,
  type DynamicCopyPasteScope,
  type DynamicCopyPasteTarget,
  type DynamicTableColumn,
} from "@/app/Components/dynamic-table";
import { LocomotiveWheelMap } from "@/app/Components/locomotive-wheel-selector/LocomotiveWheelMap";
import TornoMeasurePickerDialog from "../../torno/TornoMeasurePickerDialog";

/**
 * Props del Step 2 especializado para servicio Torno.
 */
type StepTwoTornoProps = {
  form: MovementFormData;
  setForm: React.Dispatch<React.SetStateAction<MovementFormData>>;
  errors: Record<string, string>;
  tornoMedicion: TornoMedicionState;
  initialTornoMedicion?: TornoMedicionState;
  setTornoWheelCount: (count: TornoWheelCount) => void;
  updateTornoMedicion: (
    position: TornoWheelPosition,
    field: TornoMeasurementField,
    part: TornoMeasurementPart,
    value: string
  ) => void;
  companyName?: string;
  hideTypeSelector?: boolean;
  variant?: "classic" | "mobile";
};

type TornoCopyCell = {
  position: TornoWheelPosition;
  field: TornoMeasurementField;
};

type TornoCopyState = {
  scope: DynamicCopyPasteScope;
  source: Partial<TornoCopyCell>;
};

type TornoPasteFeedback = {
  cells: string[];
  token: number;
};

type TornoDesktopRow = {
  position: TornoWheelPosition;
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
  onOpenPicker?: (position: TornoWheelPosition, field: TornoMeasurementField, value: TornoMeasurementValue) => void;
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
        "cosaif-motion-button rounded-lg border px-3 py-1.5 text-xs font-semibold sm:text-sm",
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
    onOpenPicker,
  } = props;

  const selectable = !!copyModeActive && !isCopySource;
  const inputDisabled = !!copyModeActive;
  const passthroughClasses = copyModeActive ? "pointer-events-none" : "";
  const hasMeasure = hasMeasureValue(value);
  const formatted = formatTornoMeasure(value);

  return (
    <div className="flex min-w-0 items-center">
      <div
        onClick={() => {
          if (selectable) onToggleCopyTarget(position, field);
          if (!copyModeActive) onOpenPicker?.(position, field, value);
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          if (selectable) {
            onToggleCopyTarget(position, field);
            return;
          }
          if (!copyModeActive) onOpenPicker?.(position, field, value);
        }}
        role="button"
        tabIndex={0}
        aria-pressed={selectable ? isCopyTarget : undefined}
        className={Movimiento.clsx(
          "relative flex min-w-0 items-center rounded-lg border border-slate-200 bg-white px-2 py-1 transition-all dark:border-slate-700 dark:bg-slate-950",
          hasMeasure && !copyModeActive && "border-emerald-500 ring-1 ring-emerald-500/25 dark:border-emerald-500 dark:ring-emerald-500/25",
          isRecentlyPasted && "paste-feedback border-amber-400 bg-amber-50 ring-2 ring-amber-300/60 dark:border-amber-400 dark:bg-amber-900/30 dark:ring-amber-500/40",
          copyModeActive && !isCopySource && !isCopyTarget && "opacity-55 saturate-75",
          !copyModeActive && "cursor-pointer hover:border-emerald-400 hover:bg-emerald-50 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/30",
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
        {!copyModeActive ? (
          <span
            className={Movimiento.clsx(
              "absolute inset-0 flex items-center justify-center rounded-lg px-2 text-center text-sm font-black",
              formatted
                ? "bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100"
                : "bg-white text-slate-400 dark:bg-slate-950 dark:text-slate-500"
            )}
          >
            {formatted || "Configurar"}
          </span>
        ) : null}
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
    initialTornoMedicion,
    setTornoWheelCount,
    updateTornoMedicion,
    companyName,
    hideTypeSelector = false,
    variant = "classic",
  } = props;
  const isMobileVariant = variant === "mobile";

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

  // Estados para la vista interactiva (Visual)
  const [entryMode, setEntryMode] = useState<"table" | "visual">(
    isMobileVariant ? "visual" : "table"
  );
  const [selectedVisualPosition, setSelectedVisualPosition] = useState<TornoWheelPosition>("L1");
  const [visualViewMode, setVisualViewMode] = useState<"top" | "left" | "right">("top");
  const [measurePicker, setMeasurePicker] = useState<{
    open: boolean;
    position: TornoWheelPosition | null;
    field: TornoMeasurementField | null;
    label: string;
    draft: TornoMeasurementValue;
  }>({
    open: false,
    position: null,
    field: null,
    label: "",
    draft: EMPTY_TORNO_VALUE,
  });

  const [screenOrientation, setScreenOrientation] = useState<"horizontal" | "vertical">("vertical");

  useEffect(() => {
    if (typeof window === "undefined") return;
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

  useEffect(() => {
    if (isMobileVariant) setEntryMode("visual");
  }, [isMobileVariant]);

  function positionToWheelId(pos: TornoWheelPosition): string {
    const side = pos.startsWith("L") ? "L" : "R";
    const axle = Number(pos.slice(1));
    return `A${axle}-${side}`;
  }

  function wheelIdToPosition(id: string): TornoWheelPosition {
    const match = /^A(\d+)-(L|R)$/.exec(id);
    if (!match) return "L1";
    return `${match[2]}${match[1]}` as TornoWheelPosition;
  }

  const hasPositionMeasures = React.useCallback((pos: TornoWheelPosition) => {
    const row = tornoMedicion.rows[pos];
    if (!row) return false;
    return Object.values(row).some((val) => Boolean(val?.whole || val?.num || val?.den));
  }, [tornoMedicion.rows]);

  const wheelOverrides = useMemo(() => {
    return positions.map((pos) => {
      const hasMeasures = hasPositionMeasures(pos);
      return {
        id: positionToWheelId(pos),
        label: pos,
        status: hasMeasures ? ("completed" as const) : ("available" as const),
        observations: hasMeasures ? "Medidas capturadas" : "Pendiente de captura",
      };
    });
  }, [positions, hasPositionMeasures]);

  useEffect(() => {
    if (selectedVisualPosition && !positions.includes(selectedVisualPosition)) {
      setSelectedVisualPosition(positions[0] ?? "L1");
    }
  }, [positions, selectedVisualPosition]);

  useEffect(() => {
    if (!positions.includes(mobilePosition)) {
      setMobilePosition(positions[0] ?? "L1");
    }
  }, [positions, mobilePosition]);

  useEffect(() => {
    setCopyState((current) => {
      if (!current) return null;

      const sourceStillValid = current.scope === "row"
        ? !!current.source.position && positions.includes(current.source.position)
        : current.scope === "column"
          ? !!current.source.field && validFieldKeys.has(current.source.field)
          : !!current.source.position &&
            !!current.source.field &&
            positions.includes(current.source.position) &&
            validFieldKeys.has(current.source.field);

      if (!sourceStillValid) return null;
      return current;
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
    && copyState.scope === "cell"
    && copyState.source.position
    && copyState.source.field
      ? getCopyCellId(copyState.source.position, copyState.source.field)
    : null;
  const selectedTargetIds = useMemo(
    () => new Set<string>(),
    []
  );
  const copySourceValue = copyState
    && copyState.scope === "cell"
    && copyState.source.position
    && copyState.source.field
      ? (tornoMedicion.rows[copyState.source.position]?.[copyState.source.field] ?? EMPTY_TORNO_VALUE)
    : null;
  const fieldLabelByKey = useMemo(
    () => new Map(fieldDefs.map((field) => [field.key, field.label] as const)),
    [fieldDefs]
  );
  const copySourceLabel = copyState?.scope === "row" && copyState.source.position
    ? `Fila ${copyState.source.position}`
    : copyState?.scope === "column" && copyState.source.field
      ? `Columna ${fieldLabelByKey.get(copyState.source.field) ?? copyState.source.field}`
      : copyState?.scope === "cell" && copyState.source.position && copyState.source.field
        ? `${copyState.source.position} / ${fieldLabelByKey.get(copyState.source.field) ?? copyState.source.field}`
        : "";
  const copySourceValueLabel = copyState?.scope === "cell"
    ? (copySourceValue ? formatTornoMeasure(copySourceValue) || "Sin medida" : "Sin medida")
    : copyState?.scope === "row"
      ? "Fila completa"
      : copyState?.scope === "column"
        ? "Columna completa"
        : "";
  const desktopRows = useMemo<TornoDesktopRow[]>(
    () => positions.map((position) => ({ position })),
    [positions]
  );
  const leftDesktopRows = useMemo<TornoDesktopRow[]>(
    () => leftPositions.map((position) => ({ position })),
    [leftPositions]
  );
  const rightDesktopRows = useMemo<TornoDesktopRow[]>(
    () => rightPositions.map((position) => ({ position })),
    [rightPositions]
  );
  const openMeasurePicker = (
    position: TornoWheelPosition,
    field: TornoMeasurementField,
    value: TornoMeasurementValue
  ) => {
    const label = fieldDefs.find((item) => item.key === field)?.label ?? field;
    setMeasurePicker({
      open: true,
      position,
      field,
      label,
      draft: {
        whole: value.whole ?? "",
        num: value.num ?? "",
        den: value.den ?? "",
      },
    });
  };

  const closeMeasurePicker = () => {
    setMeasurePicker((current) => ({ ...current, open: false }));
  };

  const applyMeasurePicker = () => {
    if (!measurePicker.position || !measurePicker.field) {
      closeMeasurePicker();
      return;
    }
    const normalized = normalizeTornoMeasureValue(measurePicker.draft);
    updateTornoMedicion(measurePicker.position, measurePicker.field, "whole", normalized.whole);
    updateTornoMedicion(measurePicker.position, measurePicker.field, "num", normalized.num);
    updateTornoMedicion(measurePicker.position, measurePicker.field, "den", normalized.den);
    closeMeasurePicker();
  };
  const startCopySelection = React.useCallback((position: TornoWheelPosition, field: TornoMeasurementField) => {
    setCopyState({
      scope: "cell",
      source: { position, field },
    });
  }, []);

  const startMobileCopySelection = React.useCallback((position: TornoWheelPosition, field: TornoMeasurementField) => {
    setCopyState({
      scope: "cell",
      source: { position, field },
    });
    setMobileCopyModalOpen(false);
    setMobileAccordionPosition(null);
  }, []);

  const startRowCopySelection = React.useCallback((position: TornoWheelPosition) => {
    setCopyState({
      scope: "row",
      source: { position },
    });
  }, []);

  const startColumnCopySelection = React.useCallback((field: TornoMeasurementField) => {
    setCopyState({
      scope: "column",
      source: { field },
    });
  }, []);

  const toggleCopyTarget = React.useCallback((position: TornoWheelPosition, field: TornoMeasurementField) => {
    void position;
    void field;
  }, []);

  const cancelCopySelection = React.useCallback(() => {
    setCopyState(null);
    setMobileCopyModalOpen(false);
    setMobileAccordionPosition(null);
  }, []);

  const applyCopyTargets = React.useCallback((targets: DynamicCopyPasteTarget<TornoWheelPosition, TornoMeasurementField>[]) => {
    if (!copyState) return;

    const pastedIds: string[] = [];
    const writeMeasure = (position: TornoWheelPosition, field: TornoMeasurementField, value: TornoMeasurementValue) => {
      updateTornoMedicion(position, field, "whole", value.whole);
      updateTornoMedicion(position, field, "num", value.num);
      updateTornoMedicion(position, field, "den", value.den);
      pastedIds.push(getCopyCellId(position, field));
    };

    if (copyState.scope === "cell" && copyState.source.position && copyState.source.field) {
      const source = tornoMedicion.rows[copyState.source.position]?.[copyState.source.field] ?? EMPTY_TORNO_VALUE;
      targets.forEach((target) => {
        if (target.scope === "cell") writeMeasure(target.position, target.field, source);
      });
    }

    if (copyState.scope === "row" && copyState.source.position) {
      targets.forEach((target) => {
        if (target.scope !== "row") return;
        fieldDefs.forEach((field) => {
          const source = tornoMedicion.rows[copyState.source.position!]?.[field.key] ?? EMPTY_TORNO_VALUE;
          writeMeasure(target.position, field.key, source);
        });
      });
    }

    if (copyState.scope === "column" && copyState.source.field) {
      targets.forEach((target) => {
        if (target.scope !== "column") return;
        positions.forEach((position) => {
          const source = tornoMedicion.rows[position]?.[copyState.source.field!] ?? EMPTY_TORNO_VALUE;
          writeMeasure(position, target.field, source);
        });
      });
    }

    setPasteFeedback({
      cells: pastedIds,
      token: Date.now(),
    });
    setCopyState(null);
    setMobileCopyModalOpen(false);
    setMobileAccordionPosition(null);
  }, [copyState, fieldDefs, positions, tornoMedicion.rows, updateTornoMedicion]);

  const desktopColumns = useMemo<DynamicTableColumn<TornoDesktopRow>[]>(() => {
    const baseColumns: DynamicTableColumn<TornoDesktopRow>[] = [
      {
        key: "position",
        title: "Fila",
        width: 120,
        priority: 1,
        render: ({ row }) => (
          <div className="flex w-full items-center justify-between gap-2">
            <span className="font-semibold text-slate-900 dark:text-slate-100">{row.position}</span>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                startRowCopySelection(row.position);
              }}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-sky-700 dark:hover:bg-sky-900/20 dark:hover:text-sky-300"
              aria-label={`Copiar fila ${row.position}`}
              title="Copiar fila"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M8 7h12" />
                <path d="M8 12h12" />
                <path d="M8 17h12" />
                <path d="M4 7h.01" />
                <path d="M4 12h.01" />
                <path d="M4 17h.01" />
              </svg>
            </button>
          </div>
        ),
      },
    ];

    const measureColumns = fieldDefs.map<DynamicTableColumn<TornoDesktopRow>>((field) => ({
      key: field.key,
      title: (
        <div className="flex w-full items-center justify-between gap-2">
          <span className="min-w-0 truncate">{field.label}</span>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              startColumnCopySelection(field.key);
            }}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-sky-700 dark:hover:bg-sky-900/20 dark:hover:text-sky-300"
            aria-label={`Copiar columna ${field.label}`}
            title="Copiar columna"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M8 4v16" />
              <path d="M16 4v16" />
              <path d="M4 8h16" />
              <path d="M4 16h16" />
            </svg>
          </button>
        </div>
      ),
      width: 230,
      priority: 2,
      render: ({ row }) => {
        const cellId = getCopyCellId(row.position, field.key);
        const measure = tornoMedicion.rows[row.position]?.[field.key] ?? EMPTY_TORNO_VALUE;
        return (
          <MeasurePartsInput
            position={row.position}
            field={field.key}
            compact
            value={measure}
            onChange={(part, value) => updateTornoMedicion(row.position, field.key, part, value)}
            copyModeActive={!!copyState}
            isCopySource={copySourceId === cellId}
            isCopyTarget={selectedTargetIds.has(cellId)}
            isRecentlyPasted={pastedCells.has(cellId)}
            onStartCopy={startCopySelection}
            onToggleCopyTarget={toggleCopyTarget}
            onOpenPicker={openMeasurePicker}
          />
        );
      },
    }));

    return [...baseColumns, ...measureColumns];
  }, [
    copySourceId,
    copyState,
    fieldDefs,
    pastedCells,
    selectedTargetIds,
    startColumnCopySelection,
    startCopySelection,
    startRowCopySelection,
    toggleCopyTarget,
    tornoMedicion.rows,
    updateTornoMedicion,
  ]);

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
              Origen: <span className="font-semibold">{copySourceLabel}</span>{" "}
              <span className="text-sky-700 dark:text-sky-300">
                ({copySourceValueLabel})
              </span>
              . Selecciona los destinos en el modal y finaliza para pegar.
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={cancelCopySelection}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : null}

        <div className="cosaif-motion-card mb-4 flex min-w-0 flex-wrap items-start gap-4 rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-950/50">
          <GuidedTarget id="torno-wheel-count">
            <div className="min-w-0">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Ruedas</div>
              <div className="inline-flex max-w-full overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                {TORNO_WHEEL_COUNT_OPTIONS.map((count) => (
                  <button
                    key={count}
                    onClick={() => setTornoWheelCount(count)}
                    className={Movimiento.clsx(
                      "cosaif-motion-button px-3 py-1.5 text-xs font-semibold sm:px-4 sm:text-sm",
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
          </GuidedTarget>

          {!hideTypeSelector ? (
            <GuidedTarget id="torno-movement-type">
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
            </GuidedTarget>
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

        {/* Switcher para cambiar entre tabla y mapa visual */}
        <div className="mb-5 flex gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <button
            type="button"
            onClick={() => setEntryMode("table")}
            className={Movimiento.clsx(
              "cosaif-motion-button px-3 py-2 text-xs font-bold rounded-lg border select-none",
              entryMode === "table"
                ? "border-emerald-600 bg-emerald-600 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            )}
          >
            Tabla
          </button>
          <button
            type="button"
            onClick={() => setEntryMode("visual")}
            className={Movimiento.clsx(
              "cosaif-motion-button px-3 py-2 text-xs font-bold rounded-lg border select-none",
              entryMode === "visual"
                ? "border-emerald-600 bg-emerald-600 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            )}
          >
            Mapa visual
          </button>
        </div>

        <GuidedTarget id="torno-measures-table">
          <div className="min-w-0">
            {entryMode === "table" ? (
              <>
                <div className="min-w-0 lg:hidden">
                  <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                    {positions.map((position) => (
                      <button
                        key={`mobile_${position}`}
                        onClick={() => setMobilePosition(position)}
                        className={Movimiento.clsx(
                          "cosaif-motion-button shrink-0 rounded-full border px-3 py-1 text-xs font-semibold",
                          mobilePosition === position
                            ? "border-emerald-600 bg-emerald-600 text-white"
                            : "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                        )}
                      >
                        {position}
                      </button>
                    ))}
                  </div>
                  <div className="mb-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => startRowCopySelection(mobilePosition)}
                      className="cosaif-motion-button rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      Copiar fila {mobilePosition}
                    </button>
                  </div>

                  <div className="grid min-w-0 gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/60">
                    {fieldDefs.map((field) => {
                      const measure = selectedMobileRow[field.key] ?? EMPTY_TORNO_VALUE;
                      return (
                        <div key={`mobile_field_${field.key}`} className="cosaif-motion-card min-w-0 rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-950/40">
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <span className="min-w-0 flex-1 break-words text-xs font-semibold text-slate-700 dark:text-slate-200">
                              {field.label}
                            </span>
                            <button
                              type="button"
                              onClick={() => startColumnCopySelection(field.key)}
                              className="cosaif-motion-button shrink-0 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                            >
                              Col.
                            </button>
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
                            onOpenPicker={openMeasurePicker}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {profile === "wabtec" ? (
                  <div className="hidden min-w-0 gap-4 lg:grid lg:grid-cols-2">
                    <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/40">
                      <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                        Izquierdo
                      </div>
                      <DynamicTable
                        data={leftDesktopRows}
                        columns={desktopColumns}
                        rowKey={(row) => row.position}
                        height={Math.min(560, 110 + leftDesktopRows.length * 56)}
                        rowHeight={56}
                        headerHeight={44}
                        emptyText="Sin posiciones"
                        stickyFirstColumn
                      />
                    </div>
                    <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/40">
                      <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                        Derecho
                      </div>
                      <DynamicTable
                        data={rightDesktopRows}
                        columns={desktopColumns}
                        rowKey={(row) => row.position}
                        height={Math.min(560, 110 + rightDesktopRows.length * 56)}
                        rowHeight={56}
                        headerHeight={44}
                        emptyText="Sin posiciones"
                        stickyFirstColumn
                      />
                    </div>
                  </div>
                ) : (
                  <div className="hidden min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/40 lg:block">
                    <DynamicTable
                      data={desktopRows}
                      columns={desktopColumns}
                      rowKey={(row) => row.position}
                      height={Math.min(620, 120 + desktopRows.length * 56)}
                      rowHeight={56}
                      headerHeight={46}
                      emptyText="Sin posiciones"
                      getRowType={(row) => (row.position.startsWith("L") ? "left" : "right")}
                      stickyFirstColumn
                    />
                  </div>
                )}
              </>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Panel izquierdo: Diagrama SVG */}
                <div className="cosaif-motion-card lg:col-span-6 border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-900/10">
                  <div className="flex gap-2 mb-4 justify-center">
                    {(["top", "left", "right"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setVisualViewMode(mode)}
                        className={Movimiento.clsx(
                          "cosaif-motion-button px-3 py-1.5 text-xs font-bold rounded-lg border select-none",
                          visualViewMode === mode
                            ? "border-emerald-600 bg-emerald-600 text-white"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                        )}
                      >
                        {mode === "top" ? "Superior" : mode === "left" ? "Costado Izq." : "Costado Der."}
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-center max-w-full overflow-hidden">
                    <LocomotiveWheelMap
                      wheelCount={tornoMedicion.wheelCount}
                      viewMode={visualViewMode}
                      selectedWheelId={selectedVisualPosition ? positionToWheelId(selectedVisualPosition) : undefined}
                      wheels={wheelOverrides}
                      disabled={false}
                      orientation={screenOrientation}
                      locomotiveNumber={form.locomotiveNumber}
                      onWheelSelect={(wheel) => {
                        const nextPos = wheelIdToPosition(wheel.id);
                        if (nextPos) setSelectedVisualPosition(nextPos);
                      }}
                    />
                  </div>
                </div>

                {/* Panel derecho: Formulario de captura de medidas */}
                <div className="cosaif-motion-card lg:col-span-6 border border-slate-200 dark:border-slate-800 rounded-xl p-5 bg-white dark:bg-slate-950">
                  <div className="mb-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 gap-3">
                    <div>
                      <h4 className="text-base font-black text-slate-800 dark:text-slate-200">
                        Capturar Rueda {selectedVisualPosition || "L1"}
                      </h4>
                      <span className="text-xs text-slate-400">
                        Eje {selectedVisualPosition ? selectedVisualPosition.slice(1) : "1"} / {selectedVisualPosition?.startsWith("L") ? "Izquierda" : "Derecha"}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => selectedVisualPosition && startRowCopySelection(selectedVisualPosition)}
                      className="cosaif-motion-button rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      Copiar fila {selectedVisualPosition}
                    </button>
                  </div>

                  <div className="grid gap-3">
                    {fieldDefs.map((field) => {
                      const cellId = getCopyCellId(selectedVisualPosition || "L1", field.key);
                      const measure = (selectedVisualPosition ? tornoMedicion.rows[selectedVisualPosition] : null)?.[field.key] ?? EMPTY_TORNO_VALUE;
                      return (
                        <div 
                          key={`visual_field_${field.key}`}
                          className="cosaif-motion-card flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border border-slate-100 bg-slate-50/50 dark:border-slate-800/60 dark:bg-slate-900/10"
                        >
                          <div className="min-w-0 flex-1">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                              {field.label}
                            </span>
                            <span className="block text-[10px] text-slate-400 mt-0.5">
                              {formatTornoMeasure(measure) || "Sin registrar"}
                            </span>
                          </div>
                          <div className="shrink-0">
                            <MeasurePartsInput
                              position={selectedVisualPosition || "L1"}
                              field={field.key}
                              value={measure}
                              onChange={(part, value) => {
                                if (selectedVisualPosition) {
                                  updateTornoMedicion(selectedVisualPosition, field.key, part, value);
                                }
                              }}
                              copyModeActive={!!copyState}
                              isCopySource={copySourceId === cellId}
                              isCopyTarget={selectedTargetIds.has(cellId)}
                              isRecentlyPasted={pastedCells.has(cellId)}
                              onStartCopy={startCopySelection}
                              onToggleCopyTarget={toggleCopyTarget}
                              onOpenPicker={openMeasurePicker}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </GuidedTarget>

        {copyState ? (
          <DynamicTableCopyPasteDialog<TornoWheelPosition, TornoMeasurementField, TornoMeasurementValue>
            open={!!copyState}
            scope={copyState.scope}
            positions={positions}
            fields={fieldDefs}
            sourcePosition={copyState.source.position ?? null}
            sourceField={copyState.source.field ?? null}
            sourceLabel={copySourceLabel}
            sourceValueLabel={copySourceValueLabel}
            getValueLabel={(position, field) =>
              formatTornoMeasure(tornoMedicion.rows[position]?.[field] ?? EMPTY_TORNO_VALUE)
            }
            title={
              copyState.scope === "row"
                ? "Copiar fila"
                : copyState.scope === "column"
                  ? "Copiar columna"
                  : "Copiar medida"
            }
            onCancel={cancelCopySelection}
            onApply={applyCopyTargets}
          />
        ) : null}

        <TornoMeasurePickerDialog
          open={measurePicker.open}
          title="Seleccion de medida"
          subtitle={`${measurePicker.position ?? "--"} - ${measurePicker.label}`}
          draft={measurePicker.draft}
          onChange={(draft) => setMeasurePicker((current) => ({ ...current, draft }))}
          onCancel={closeMeasurePicker}
          onSave={applyMeasurePicker}
          accent="emerald"
        />

        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          Las medidas son opcionales por campo y se guardan en draft local durante esta solicitud.
        </p>
      </section>
    </div>
  );
}
