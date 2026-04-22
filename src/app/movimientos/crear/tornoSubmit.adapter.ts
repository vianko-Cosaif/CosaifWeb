import {
  formatTornoMeasure,
  getTornoPositions,
  TORNO_FIELD_KEYS,
  type TornoMeasurementField,
  type TornoMedicionState,
} from "./tornoMedicion.types";
import {
  resolveTornoProfile,
  TORNO_PROFILE_FIELDS,
} from "./tornoProfiles";

export type BackendTornoMedidasPayload = Partial<Record<
  "l1" | "l2" | "l3" | "l4" | "l5" | "l6" | "r1" | "r2" | "r3" | "r4" | "r5" | "r6",
  string
>> & {
  wheelCount: 4 | 6 | 8 | 12;
};

const FIELD_LABELS: Record<TornoMeasurementField, string> = {
  alturaCeja: "Altura de Ceja",
  espesorCeja: "Espesor de Ceja",
  caidaVertical: "Caida Vertical",
  espesorPestana: "Espesor de Pestana",
  trazoEntreCaras: "Trazado Entre Caras",
  diametroPromedio: "Diametro Promedio",
  gruesoRueda: "Grueso de Rueda",
  desgastePisada: "Desgaste de Pisada",
  tramoMancuerna: "Tramo de Mancuerna",
  diametroRueda: "Diametro de Rueda",
  lectura: "Lectura",
};

function toBackendPositionKey(position: string) {
  return position.toLowerCase() as keyof Omit<BackendTornoMedidasPayload, "wheelCount">;
}

function getOrderedFields(companyName?: string): TornoMeasurementField[] {
  const profile = resolveTornoProfile(companyName);
  const profileFields = TORNO_PROFILE_FIELDS[profile].map((field) => field.key);
  const remainingFields = TORNO_FIELD_KEYS.filter((field) => !profileFields.includes(field));
  return [...profileFields, ...remainingFields];
}

function buildWheelSummary(
  row: TornoMedicionState["rows"][keyof TornoMedicionState["rows"]],
  orderedFields: TornoMeasurementField[]
) {
  if (!row) return null;

  const parts: string[] = [];

  for (const field of orderedFields) {
    const formatted = formatTornoMeasure(row[field]);
    if (!formatted) continue;
    parts.push(`${FIELD_LABELS[field]}: ${formatted}`);
  }

  if (parts.length === 0) return null;

  return parts.join(" | ");
}

export function buildBackendTornoMedidas(args: {
  tornoMedicion: TornoMedicionState;
  companyName?: string;
}): BackendTornoMedidasPayload {
  const { tornoMedicion, companyName } = args;
  const orderedFields = getOrderedFields(companyName);
  const positions = getTornoPositions(tornoMedicion.wheelCount);

  const payload: BackendTornoMedidasPayload = {
    wheelCount: tornoMedicion.wheelCount,
  };
  let hasAnyMeasure = false;

  for (const position of positions) {
    const summary = buildWheelSummary(
      tornoMedicion.rows[position],
      orderedFields
    );
    if (!summary) continue;
    hasAnyMeasure = true;
    payload[toBackendPositionKey(position)] = summary;
  }

  if (!hasAnyMeasure) {
    throw new Error("Debe capturar al menos una medida en total.");
  }

  return payload;
}
