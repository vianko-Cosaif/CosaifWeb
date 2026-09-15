import {
  EMPTY_TORNO_VALUE,
  formatTornoMeasure,
  normalizeTornoMeasureValue,
  type TornoMeasurementField,
  type TornoMeasurementValue,
  type TornoMeasurements,
  type TornoWheelPosition,
} from "./tornoMedicion.types";
import type { TornoFieldDef } from "./tornoProfiles";

export type TornoAutocompleteMode = "axle" | "measure";

export type TornoAutocompleteUpdate = {
  position: TornoWheelPosition;
  field: TornoMeasurementField;
  value: TornoMeasurementValue;
};

export type TornoAutocompleteConflictOption = {
  key: string;
  value: TornoMeasurementValue;
  label: string;
};

export type TornoAutocompleteConflict = {
  id: string;
  mode: TornoAutocompleteMode;
  label: string;
  description: string;
  targets: Array<{ position: TornoWheelPosition; field: TornoMeasurementField }>;
  options: TornoAutocompleteConflictOption[];
};

export type TornoAutocompletePlan = {
  updates: TornoAutocompleteUpdate[];
  conflicts: TornoAutocompleteConflict[];
};

function readValue(
  rows: TornoMeasurements,
  position: TornoWheelPosition,
  field: TornoMeasurementField
): TornoMeasurementValue {
  return normalizeTornoMeasureValue(rows[position]?.[field] ?? EMPTY_TORNO_VALUE);
}

export function hasTornoAutocompleteValue(value: TornoMeasurementValue): boolean {
  return formatTornoMeasure(value).trim() !== "";
}

function valueKey(value: TornoMeasurementValue): string {
  const normalized = normalizeTornoMeasureValue(value);
  return [normalized.whole, normalized.num, normalized.den].join("/");
}

function sameValue(left: TornoMeasurementValue, right: TornoMeasurementValue): boolean {
  return valueKey(left) === valueKey(right);
}

function uniqueValues(values: TornoMeasurementValue[]): TornoAutocompleteConflictOption[] {
  const seen = new Map<string, TornoAutocompleteConflictOption>();
  values.forEach((value) => {
    const normalized = normalizeTornoMeasureValue(value);
    if (!hasTornoAutocompleteValue(normalized)) return;
    const key = valueKey(normalized);
    if (!seen.has(key)) {
      seen.set(key, { key, value: normalized, label: formatTornoMeasure(normalized) });
    }
  });
  return [...seen.values()];
}

function pushEmptyTargets(
  updates: TornoAutocompleteUpdate[],
  rows: TornoMeasurements,
  targets: Array<{ position: TornoWheelPosition; field: TornoMeasurementField }>,
  value: TornoMeasurementValue
) {
  targets.forEach((target) => {
    const current = readValue(rows, target.position, target.field);
    if (!hasTornoAutocompleteValue(current)) {
      updates.push({ ...target, value });
    }
  });
}

export function buildTornoAutocompleteByAxle(args: {
  positions: readonly TornoWheelPosition[];
  fields: readonly TornoFieldDef[];
  rows: TornoMeasurements;
}): TornoAutocompletePlan {
  const updates: TornoAutocompleteUpdate[] = [];
  const conflicts: TornoAutocompleteConflict[] = [];
  const positionSet = new Set(args.positions);
  const maxAxle = Math.max(...args.positions.map((position) => Number(position.slice(1))).filter(Number.isFinite), 0);

  for (let axle = 1; axle <= maxAxle; axle += 1) {
    const axlePositions = [`L${axle}`, `R${axle}`].filter((position): position is TornoWheelPosition =>
      positionSet.has(position as TornoWheelPosition)
    );
    if (axlePositions.length < 2) continue;

    args.fields.forEach((field) => {
      const targets = axlePositions.map((position) => ({ position, field: field.key }));
      const values = uniqueValues(targets.map((target) => readValue(args.rows, target.position, target.field)));
      if (values.length === 0) return;
      if (values.length === 1) {
        pushEmptyTargets(updates, args.rows, targets, values[0].value);
        return;
      }

      conflicts.push({
        id: `axle:${axle}:${field.key}`,
        mode: "axle",
        label: `Eje ${axle} - ${field.label}`,
        description: `Las ruedas L${axle} y R${axle} tienen medidas distintas.`,
        targets,
        options: values,
      });
    });
  }

  return { updates, conflicts };
}

export function buildTornoAutocompleteByMeasure(args: {
  positions: readonly TornoWheelPosition[];
  field: TornoFieldDef;
  rows: TornoMeasurements;
}): TornoAutocompletePlan {
  const targets = args.positions.map((position) => ({ position, field: args.field.key }));
  const values = uniqueValues(targets.map((target) => readValue(args.rows, target.position, target.field)));
  if (values.length === 0) return { updates: [], conflicts: [] };
  if (values.length === 1) {
    const updates: TornoAutocompleteUpdate[] = [];
    pushEmptyTargets(updates, args.rows, targets, values[0].value);
    return { updates, conflicts: [] };
  }

  return {
    updates: [],
    conflicts: [{
      id: `measure:${args.field.key}`,
      mode: "measure",
      label: args.field.label,
      description: "Esta medida tiene valores distintos entre ruedas.",
      targets,
      options: values,
    }],
  };
}

export function updatesForConflictDecision(
  conflict: TornoAutocompleteConflict,
  selectedKey: string | null
): TornoAutocompleteUpdate[] {
  if (!selectedKey) return [];
  const option = conflict.options.find((item) => item.key === selectedKey);
  if (!option) return [];
  return conflict.targets.map((target) => ({ ...target, value: option.value }));
}

export function mergeTornoAutocompletePlans(...plans: TornoAutocompletePlan[]): TornoAutocompletePlan {
  return plans.reduce<TornoAutocompletePlan>(
    (acc, plan) => ({
      updates: [...acc.updates, ...plan.updates],
      conflicts: [...acc.conflicts, ...plan.conflicts],
    }),
    { updates: [], conflicts: [] }
  );
}

export function countChangedCells(updates: readonly TornoAutocompleteUpdate[], rows: TornoMeasurements): number {
  return updates.filter((update) => !sameValue(readValue(rows, update.position, update.field), update.value)).length;
}
