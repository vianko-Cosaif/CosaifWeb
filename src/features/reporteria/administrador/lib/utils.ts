import type { PeriodoUI } from "./types";

export const fmtInt = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 });
export const fmtDec = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 });
export const fmtPct = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 });

export function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function clampInt(v: unknown, min: number, max: number) {
  const x = Number.parseInt(String(v), 10);
  if (!Number.isFinite(x)) return min;
  return Math.min(max, Math.max(min, x));
}

export function isYYYYMM(s: string) {
  return /^\d{4}-\d{2}$/.test(s);
}
export function isYYYYMMDD(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export function buildAnchorFecha(params: {
  periodo: PeriodoUI;
  diaISO: string;
  semanaISO: string;
  mesYM: string;
  bimYear: number;
  bimIndex: number;
  semYear: number;
  semIndex: number;
  anio: number;
}) {
  const { periodo } = params;
  if (periodo === "dia") return params.diaISO;
  if (periodo === "semana") return params.semanaISO;
  if (periodo === "mes") return `${params.mesYM}-01`;
  if (periodo === "bimestre") {
    const startMonth = (params.bimIndex - 1) * 2 + 1;
    return `${params.bimYear}-${pad2(startMonth)}-01`;
  }
  if (periodo === "semestre") {
    const startMonth = params.semIndex === 1 ? 1 : 7;
    return `${params.semYear}-${pad2(startMonth)}-01`;
  }
  return `${params.anio}-01-01`;
}

export function n(v: unknown, fallback = 0): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
}

export function fmtMaybeInt(value: unknown): string {
  if (value == null) return "—";
  const num = n(value);
  if (!Number.isFinite(num)) return "—";
  return fmtInt.format(num);
}

export function fmtMaybeDec(value: unknown): string {
  if (value == null) return "—";
  const num = n(value);
  if (!Number.isFinite(num)) return "—";
  return fmtDec.format(num);
}

export function fmtMaybePct(value: unknown): string {
  if (value == null) return "—";
  const num = n(value);
  if (!Number.isFinite(num)) return "—";
  return `${fmtPct.format(num)}%`;
}

export function fmtMinutes(value: unknown): string {
  if (value == null) return "—";
  const total = Math.round(Number(value));
  if (!Number.isFinite(total)) return "—";
  if (total < 60) return `${total}m`;
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours < 24) return `${hours}h ${minutes}m`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return `${days}d ${remHours}h`;
}

export function initials(value: string): string {
  const cleaned = value.trim();
  if (!cleaned) return "--";
  const parts = cleaned.split(/\s+/).filter(Boolean);
  const chars = parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "");
  return chars.join("") || cleaned.slice(0, 2).toUpperCase();
}
