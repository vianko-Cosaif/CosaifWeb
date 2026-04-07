"use client";

export const fmtInt = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 });
export const fmtDec = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 });

export function n(value: unknown) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

export function fmtMaybeInt(value: unknown) {
  if (value == null || value === "" || Number.isNaN(Number(value))) return "—";
  return fmtInt.format(Number(value));
}

export function fmtMaybeDec(value: unknown) {
  if (value == null || value === "" || Number.isNaN(Number(value))) return "—";
  return fmtDec.format(Number(value));
}

export function fmtMaybePct(value: unknown) {
  if (value == null || value === "" || Number.isNaN(Number(value))) return "—";
  return `${fmtDec.format(Number(value))}%`;
}

export function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isYYYYMMDD(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function isYYYYMM(value: string) {
  return /^\d{4}-\d{2}$/.test(value);
}

export function clampInt(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.floor(value)));
}

export function buildAnchorFecha({
  periodo,
  diaISO,
  semanaISO,
  mesYM,
  bimYear,
  bimIndex,
  semYear,
  semIndex,
  anio,
}: {
  periodo: "dia" | "semana" | "mes" | "bimestre" | "semestre" | "anual";
  diaISO: string;
  semanaISO: string;
  mesYM: string;
  bimYear: number;
  bimIndex: number;
  semYear: number;
  semIndex: number;
  anio: number;
}) {
  if (periodo === "dia") return diaISO;
  if (periodo === "semana") return semanaISO;
  if (periodo === "mes") return `${mesYM}-01`;
  if (periodo === "bimestre") return `${bimYear}-${String((bimIndex - 1) * 2 + 1).padStart(2, "0")}-01`;
  if (periodo === "semestre") return `${semYear}-${semIndex === 1 ? "01" : "07"}-01`;
  return `${anio}-01-01`;
}

export function hasNumber(value: unknown) {
  return value != null && value !== "" && Number.isFinite(Number(value));
}

export function hasArray(value: unknown) {
  return Array.isArray(value) && value.length > 0;
}
