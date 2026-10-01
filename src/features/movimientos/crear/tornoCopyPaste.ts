import type { DynamicCopyPasteScope, DynamicCopyPasteTarget } from "@/components/dynamic-table";
import {
  EMPTY_TORNO_VALUE,
  type TornoMeasurementField,
  type TornoMeasurements,
  type TornoWheelPosition,
} from "./tornoMedicion.types";
import type { TornoAutocompleteUpdate } from "./tornoAutocomplete";

export type TornoCopyState = {
  scope: DynamicCopyPasteScope;
  source: Partial<{ position: TornoWheelPosition; field: TornoMeasurementField }>;
};

export function buildTornoCopyUpdates(
  copy: TornoCopyState,
  targets: readonly DynamicCopyPasteTarget<TornoWheelPosition, TornoMeasurementField>[],
  positions: readonly TornoWheelPosition[],
  fields: readonly TornoMeasurementField[],
  rows: TornoMeasurements,
): TornoAutocompleteUpdate[] {
  const updates: TornoAutocompleteUpdate[] = [];
  const read = (position: TornoWheelPosition, field: TornoMeasurementField) =>
    rows[position]?.[field] ?? EMPTY_TORNO_VALUE;

  if (copy.scope === "cell" && copy.source.position && copy.source.field) {
    const value = read(copy.source.position, copy.source.field);
    for (const target of targets)
      if (target.scope === "cell")
        updates.push({ position: target.position, field: target.field, value });
  }
  if (copy.scope === "row" && copy.source.position) {
    for (const target of targets) {
      if (target.scope !== "row") continue;
      for (const field of fields)
        updates.push({
          position: target.position,
          field,
          value: read(copy.source.position, field),
        });
    }
  }
  if (copy.scope === "column" && copy.source.field) {
    for (const target of targets) {
      if (target.scope !== "column") continue;
      for (const position of positions)
        updates.push({ position, field: target.field, value: read(position, copy.source.field) });
    }
  }
  return updates;
}
