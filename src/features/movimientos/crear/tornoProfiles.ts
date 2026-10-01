import type { TornoMeasurementField } from "./tornoMedicion.types";

/** Perfil visual por empresa para la captura de Torno. */
export type TornoProfileId = "wabtec" | "altom" | "progress" | "default";

export type TornoFieldDef = {
  key: TornoMeasurementField;
  label: string;
};

/** Normaliza nombre para comparaciones robustas. */
function normalizeCompanyName(name?: string): string {
  return String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Resuelve perfil visual a partir del nombre de empresa. */
export function resolveTornoProfile(companyName?: string): TornoProfileId {
  const name = normalizeCompanyName(companyName);
  const hasKeyword = (...keywords: string[]) =>
    keywords.some((keyword) => name.includes(normalizeCompanyName(keyword)));

  if (!name) return "default";
  if (hasKeyword("wabtec")) return "wabtec";
  if (hasKeyword("alstom", "altom")) return "altom";
  if (hasKeyword("progress", "progress rail")) return "progress";

  return "default";
}

export const TORNO_PROFILE_META: Record<TornoProfileId, { title: string; description: string }> = {
  wabtec: {
    title: "Formato Wabtec",
    description: "Vista separada por lado (izquierdo/derecho) con captura operativa esencial.",
  },
  altom: {
    title: "Formato Alstom",
    description: "Calificacion de entrada/salida con columnas de inspeccion tecnica.",
  },
  progress: {
    title: "Formato Progress Rail",
    description: "Hoja de medicion de ruedas con tramo de mancuerna y lectura.",
  },
  default: {
    title: "Formato Estandar",
    description: "Plantilla generica cuando la empresa no tiene formato dedicado.",
  },
};

const WABTEC_FIELDS: TornoFieldDef[] = [
  { key: "desgastePisada", label: "Pisada" },
  { key: "espesorCeja", label: "Espesor" },
  { key: "alturaCeja", label: "Altura" },
];

const ALTOM_FIELDS: TornoFieldDef[] = [
  { key: "espesorCeja", label: "Espesor de Ceja" },
  { key: "alturaCeja", label: "Altura de Ceja" },
  { key: "caidaVertical", label: "Caida Vertical" },
  { key: "espesorPestana", label: "Espesor de Pestana" },
  { key: "trazoEntreCaras", label: "Trazado Entre Caras" },
  { key: "diametroPromedio", label: "Diametro Promedio" },
];

const PROGRESS_FIELDS: TornoFieldDef[] = [
  { key: "alturaCeja", label: "Altura de Ceja" },
  { key: "espesorCeja", label: "Espesor de Ceja" },
  { key: "gruesoRueda", label: "Grueso de Rueda" },
  { key: "desgastePisada", label: "Desgaste de Pisada" },
  { key: "tramoMancuerna", label: "Tramo de Mancuerna" },
  { key: "diametroRueda", label: "Diametro de Rueda" },
  { key: "lectura", label: "Lectura" },
];

const DEFAULT_FIELDS: TornoFieldDef[] = [
  { key: "alturaCeja", label: "Altura de Ceja" },
  { key: "espesorCeja", label: "Espesor de Ceja" },
  { key: "gruesoRueda", label: "Grueso de Rueda" },
  { key: "desgastePisada", label: "Desgaste de Pisada" },
  { key: "diametroRueda", label: "Diametro de Rueda" },
];

/** Campos por perfil (ordenados para pintar literal cada formato). */
export const TORNO_PROFILE_FIELDS: Record<TornoProfileId, TornoFieldDef[]> = {
  wabtec: WABTEC_FIELDS,
  altom: ALTOM_FIELDS,
  progress: PROGRESS_FIELDS,
  default: DEFAULT_FIELDS,
};
