/**
 * MODULO: tornoMedicion.types
 *
 * Responsabilidad:
 * - Definir el contrato tipado del subflujo de medicion para servicio Torno.
 * - Mantener este estado aislado del payload principal de movimiento.
 *
 * Nota de arquitectura:
 * - Este estado es de UI/draft local.
 * - No forma parte del contrato persistente del backend.
 */

/** Cantidad de ruedas soportada por la pantalla de medicion. */
export type TornoWheelCount = 4 | 6 | 8 | 12;

/** Campos medidos por posicion de rueda (union global para todos los formatos empresa). */
export type TornoMeasurementField =
  | "alturaCeja"
  | "espesorCeja"
  | "caidaVertical"
  | "espesorPestana"
  | "trazoEntreCaras"
  | "diametroPromedio"
  | "gruesoRueda"
  | "desgastePisada"
  | "tramoMancuerna"
  | "diametroRueda"
  | "lectura";

/** Partes editables de una fraccion de medida. */
export type TornoMeasurementPart = "whole" | "num" | "den";

/** Posiciones renderizables maximas (hasta 12 ruedas = 6 ejes por lado). */
export type TornoWheelPosition =
  | "L1" | "R1"
  | "L2" | "R2"
  | "L3" | "R3"
  | "L4" | "R4"
  | "L5" | "R5"
  | "L6" | "R6";

/** Valor fraccional guiado: entero opcional + numerador + denominador. */
export type TornoMeasurementValue = {
  whole: string;
  num: string;
  den: string;
};

/** Registro de medidas para una sola posicion de rueda. */
export type TornoMeasurementRow = Record<TornoMeasurementField, TornoMeasurementValue>;

/** Mapa parcial de posiciones capturadas por el usuario. */
export type TornoMeasurements = Partial<Record<TornoWheelPosition, TornoMeasurementRow>>;

/** Estado integral del Step de medicion de ruedas. */
export type TornoMedicionState = {
  wheelCount: TornoWheelCount;
  rows: TornoMeasurements;
};

/** Opciones visuales de selector de cantidad de ruedas. */
export const TORNO_WHEEL_COUNT_OPTIONS: readonly TornoWheelCount[] = [8, 12] as const;

/** Type guard para validar cantidades soportadas de ruedas. */
export function isTornoWheelCount(value: unknown): value is TornoWheelCount {
  return value === 4 || value === 6 || value === 8 || value === 12;
}

/** Denominadores sugeridos para reducir errores de captura. */
export const TORNO_DEN_OPTIONS = ["", "2", "4", "8", "16", "32", "64"] as const;

/** Orden canonico de campos para transformaciones y persistencia. */
export const TORNO_FIELD_KEYS: readonly TornoMeasurementField[] = [
  "alturaCeja",
  "espesorCeja",
  "caidaVertical",
  "espesorPestana",
  "trazoEntreCaras",
  "diametroPromedio",
  "gruesoRueda",
  "desgastePisada",
  "tramoMancuerna",
  "diametroRueda",
  "lectura",
] as const;

/** Orden canonico de posiciones de ruedas. */
export const TORNO_POSITION_KEYS: readonly TornoWheelPosition[] = [
  "L1", "R1",
  "L2", "R2",
  "L3", "R3",
  "L4", "R4",
  "L5", "R5",
  "L6", "R6",
] as const;

/** Plantilla vacia de valor de medida. */
export const EMPTY_TORNO_VALUE: TornoMeasurementValue = {
  whole: "",
  num: "",
  den: "",
};

/** Plantilla vacia de fila para inicializacion segura. */
export const EMPTY_TORNO_ROW: TornoMeasurementRow = {
  alturaCeja: { ...EMPTY_TORNO_VALUE },
  espesorCeja: { ...EMPTY_TORNO_VALUE },
  caidaVertical: { ...EMPTY_TORNO_VALUE },
  espesorPestana: { ...EMPTY_TORNO_VALUE },
  trazoEntreCaras: { ...EMPTY_TORNO_VALUE },
  diametroPromedio: { ...EMPTY_TORNO_VALUE },
  gruesoRueda: { ...EMPTY_TORNO_VALUE },
  desgastePisada: { ...EMPTY_TORNO_VALUE },
  tramoMancuerna: { ...EMPTY_TORNO_VALUE },
  diametroRueda: { ...EMPTY_TORNO_VALUE },
  lectura: { ...EMPTY_TORNO_VALUE },
};

/** Crea una fila vacia nueva para evitar compartir referencias entre ruedas. */
export function createEmptyTornoRow(): TornoMeasurementRow {
  return TORNO_FIELD_KEYS.reduce((row, field) => {
    row[field] = { ...EMPTY_TORNO_VALUE };
    return row;
  }, {} as TornoMeasurementRow);
}

/** Estado inicial recomendado para el flujo Torno. */
export const DEFAULT_TORNO_MEDICION_STATE: TornoMedicionState = {
  wheelCount: 8,
  rows: {},
};

const SIDES = ["L", "R"] as const;

/** Construye el orden de posiciones segun cantidad de ruedas seleccionada. */
export function getTornoPositions(wheelCount: TornoWheelCount): TornoWheelPosition[] {
  const perSide = wheelCount / 2;
  const out: TornoWheelPosition[] = [];

  for (let index = 1; index <= perSide; index += 1) {
    for (const side of SIDES) {
      out.push(`${side}${index}` as TornoWheelPosition);
    }
  }

  return out;
}

/** Sanitiza un segmento numerico individual de la medida. */
export function sanitizeTornoMeasurePart(part: TornoMeasurementPart, raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";

  if (part === "whole") return digits.slice(0, 2);
  if (part === "num") return digits.slice(0, 2);

  const normalized = digits.slice(0, 2);
  return TORNO_DEN_OPTIONS.includes(normalized as (typeof TORNO_DEN_OPTIONS)[number]) ? normalized : "";
}

/** Normaliza una medida para evitar fracciones invalidas (num >= den). */
export function normalizeTornoMeasureValue(value: TornoMeasurementValue): TornoMeasurementValue {
  const next = {
    whole: sanitizeTornoMeasurePart("whole", value.whole),
    num: sanitizeTornoMeasurePart("num", value.num),
    den: sanitizeTornoMeasurePart("den", value.den),
  };

  if (next.num && next.den) {
    const n = Number(next.num);
    const d = Number(next.den);
    if (Number.isFinite(n) && Number.isFinite(d) && d > 0 && n >= d) {
      next.num = String(Math.max(0, d - 1));
    }
  }

  return next;
}

/** Formato final legible: `1 3/16"` o `3/16"` o vacio. */
export function formatTornoMeasure(value: TornoMeasurementValue): string {
  const hasWhole = value.whole.trim() !== "";
  const hasFraction = value.num.trim() !== "" && value.den.trim() !== "";

  if (!hasWhole && !hasFraction) return "";
  if (hasWhole && hasFraction) return `${value.whole} ${value.num}/${value.den}"`;
  if (hasWhole) return `${value.whole}"`;
  return `${value.num}/${value.den}"`;
}
