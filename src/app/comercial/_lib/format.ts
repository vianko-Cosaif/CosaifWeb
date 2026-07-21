import type { CommercialPeriod } from "../crmTypes";

export const PERIOD_OPTIONS: Array<{ value: CommercialPeriod; label: string; short: string }> = [
  { value: "WEEK", label: "Semana", short: "Semana" },
  { value: "MONTH", label: "Mes", short: "Mes" },
  { value: "BIMONTH", label: "Bimestre", short: "Bimestre" },
  { value: "SEMESTER", label: "Semestre", short: "Semestre" },
  { value: "YEAR", label: "Año", short: "Año" },
];

export function todayIso() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function formatNumber(value?: number | string | null) {
  return new Intl.NumberFormat("es-MX").format(Number(value || 0));
}

export function formatMoney(value?: number | string | null, currency = "MXN") {
  if (value == null || value === "") return "Monto pendiente";
  return new Intl.NumberFormat("es-MX", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(value));
}

export function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

export function humanize(value?: string | null) {
  if (!value) return "—";
  return value.toLowerCase().replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}
