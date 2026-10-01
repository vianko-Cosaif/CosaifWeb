import type { TornoMeasurePosition, TornoMeasures, TornoWheelCount } from "./types";

export const MEASURE_POSITIONS: TornoMeasurePosition[] = [
  "L1",
  "R1",
  "L2",
  "R2",
  "L3",
  "R3",
  "L4",
  "R4",
  "L5",
  "R5",
  "L6",
  "R6",
];

function asRecord(input: unknown): Record<string, unknown> {
  return input !== null && typeof input === "object" && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : {};
}

function measureValue(input: unknown): string | number | null {
  if (input == null || input === "") return null;
  if (typeof input === "string" || typeof input === "number") return input;
  const value = asRecord(input);
  const measure = value.valor ?? value.value ?? value.medida ?? value.diametro ?? value.mm;
  return typeof measure === "string" || typeof measure === "number" ? measure : null;
}

function normalizePosition(input: unknown): TornoMeasurePosition | null {
  const value = asRecord(input);
  const raw = String(
    value.posicion ?? value.position ?? value.ubicacion ?? value.key ?? input ?? "",
  )
    .trim()
    .toUpperCase();
  const direct = MEASURE_POSITIONS.find((position) => position === raw);
  if (direct) return direct;
  const side = String(value.lado ?? value.side ?? "")
    .trim()
    .toUpperCase();
  const index = value.eje ?? value.axis ?? value.numero ?? value.index;
  const composed = `${side}${index}`;
  return MEASURE_POSITIONS.find((position) => position === composed) ?? null;
}

export function normalizeWheelCount(input: unknown): TornoWheelCount | undefined {
  const value = Number(input);
  return value === 4 || value === 6 || value === 8 || value === 12 ? value : undefined;
}

export function normalizeMeasures(input: unknown): TornoMeasures {
  const measures: TornoMeasures = {};
  if (Array.isArray(input)) {
    for (const item of input) {
      const position = normalizePosition(item);
      if (position) measures[position] = measureValue(item);
    }
    return measures;
  }

  if (!input || typeof input !== "object") return measures;
  const data = asRecord(input);
  const wheelCount = normalizeWheelCount(
    data.wheelCount ?? data.cantidadRuedas ?? data.totalWheels ?? data.numeroRuedas,
  );
  if (wheelCount) measures.wheelCount = wheelCount;

  for (const position of MEASURE_POSITIONS) {
    const raw = data[position] ?? data[position.toLowerCase()];
    if (raw != null) measures[position] = measureValue(raw);
  }
  for (const [key, value] of Object.entries(data)) {
    const position = normalizePosition(key);
    if (position && measures[position] == null) measures[position] = measureValue(value);
  }
  return measures;
}

export function firstMeasureSource(...sources: unknown[]) {
  return sources.find((source) => Object.keys(normalizeMeasures(source)).length > 0);
}
