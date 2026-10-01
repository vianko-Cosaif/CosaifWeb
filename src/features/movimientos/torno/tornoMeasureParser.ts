import {
  DEFAULT_TORNO_MEDICION_STATE,
  EMPTY_TORNO_ROW,
  getTornoPositions,
  normalizeTornoMeasureValue,
  type TornoMeasurementField,
  type TornoMeasurementRow,
  type TornoMeasurementValue,
  type TornoMedicionState,
  type TornoWheelCount,
  type TornoWheelPosition,
} from "../crear/tornoMedicion.types";

const LABEL_TO_FIELD: Record<string, TornoMeasurementField> = {
  altura_de_ceja: "alturaCeja",
  espesor_de_ceja: "espesorCeja",
  caida_vertical: "caidaVertical",
  espesor_de_pestana: "espesorPestana",
  trazo_entre_caras: "trazoEntreCaras",
  trazado_entre_caras: "trazoEntreCaras",
  diametro_promedio: "diametroPromedio",
  grueso_de_rueda: "gruesoRueda",
  desgaste_de_pisada: "desgastePisada",
  tramo_de_mancuerna: "tramoMancuerna",
  diametro_de_rueda: "diametroRueda",
  lectura: "lectura",
};

const parseMaybeJson = (value: unknown): unknown => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
};

const extractTornoSource = (value: unknown): unknown => {
  const rootParsed = parseMaybeJson(value);
  if (!rootParsed || typeof rootParsed !== "object" || Array.isArray(rootParsed)) {
    return rootParsed;
  }

  const root = rootParsed as Record<string, unknown>;
  const movimiento =
    root.movimiento && typeof root.movimiento === "object" && !Array.isArray(root.movimiento)
      ? (root.movimiento as Record<string, unknown>)
      : null;

  const nested =
    root.tornoMedidas ??
    root.medidasTorno ??
    movimiento?.tornoMedidas ??
    movimiento?.medidasTorno ??
    null;

  if (nested == null) return rootParsed;
  return parseMaybeJson(nested);
};

const normalizeLabelKey = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^\w]+/g, "_")
    .replace(/^_+|_+$/g, "");

const normalizePositionKey = (value: string): TornoWheelPosition | null => {
  const clean = value.trim().toUpperCase();
  if (!/^[LR][1-6]$/.test(clean)) return null;
  return clean as TornoWheelPosition;
};

const toWheelCount = (pairCount: number): TornoWheelCount => {
  if (pairCount <= 2) return 4;
  if (pairCount === 3) return 6;
  if (pairCount === 4) return 8;
  return 12;
};

const parseMeasureText = (value: string): TornoMeasurementValue => {
  const raw = value.trim().replace(/"/g, "");
  if (!raw || /^no_aplica$/i.test(raw)) return { whole: "", num: "", den: "" };

  const wholeFractionMatch = raw.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (wholeFractionMatch) {
    return normalizeTornoMeasureValue({
      whole: wholeFractionMatch[1],
      num: wholeFractionMatch[2],
      den: wholeFractionMatch[3],
    });
  }

  const fractionMatch = raw.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (fractionMatch) {
    return normalizeTornoMeasureValue({
      whole: "",
      num: fractionMatch[1],
      den: fractionMatch[2],
    });
  }

  const wholeMatch = raw.match(/^(\d+)$/);
  if (wholeMatch) {
    return normalizeTornoMeasureValue({
      whole: wholeMatch[1],
      num: "",
      den: "",
    });
  }

  return { whole: "", num: "", den: "" };
};

const parseWheelSummary = (value: string): Partial<TornoMeasurementRow> => {
  const output: Partial<TornoMeasurementRow> = {};
  const chunks = value
    .split("|")
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  for (const chunk of chunks) {
    const separatorIndex = chunk.indexOf(":");
    if (separatorIndex < 0) continue;
    const rawLabel = chunk.slice(0, separatorIndex).trim();
    const rawMeasure = chunk.slice(separatorIndex + 1).trim();
    const field = LABEL_TO_FIELD[normalizeLabelKey(rawLabel)];
    if (!field) continue;
    output[field] = parseMeasureText(rawMeasure);
  }

  return output;
};

export const parseTornoMedicionFromApi = (raw: unknown): TornoMedicionState => {
  const source = extractTornoSource(raw);
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return DEFAULT_TORNO_MEDICION_STATE;
  }

  const data = source as Record<string, unknown>;
  const rows: TornoMedicionState["rows"] = {};
  let maxPair = 0;

  const preferredCount = Number(data.wheelCount);
  let wheelCount: TornoWheelCount = DEFAULT_TORNO_MEDICION_STATE.wheelCount;
  if (preferredCount === 4 || preferredCount === 6 || preferredCount === 8 || preferredCount === 12) {
    wheelCount = preferredCount;
  }

  for (const [key, value] of Object.entries(data)) {
    const position = normalizePositionKey(key);
    if (!position) continue;
    if (typeof value !== "string" || !value.trim() || /^no_aplica$/i.test(value.trim())) continue;

    const parsed = parseWheelSummary(value);
    const row: TornoMeasurementRow = { ...EMPTY_TORNO_ROW };
    (Object.keys(parsed) as TornoMeasurementField[]).forEach((field) => {
      const parsedValue = parsed[field];
      if (!parsedValue) return;
      row[field] = parsedValue;
    });
    rows[position] = row;

    const pairNum = Number(position.slice(1));
    if (Number.isFinite(pairNum) && pairNum > maxPair) maxPair = pairNum;
  }

  if (!Object.keys(rows).length) {
    return { ...DEFAULT_TORNO_MEDICION_STATE, wheelCount };
  }

  if (!(preferredCount === 4 || preferredCount === 6 || preferredCount === 8 || preferredCount === 12)) {
    wheelCount = toWheelCount(maxPair);
  }

  const allowedPositions = new Set(getTornoPositions(wheelCount));
  const filteredRows: TornoMedicionState["rows"] = {};
  (Object.keys(rows) as TornoWheelPosition[]).forEach((position) => {
    if (allowedPositions.has(position)) filteredRows[position] = rows[position];
  });

  return { wheelCount, rows: filteredRows };
};

