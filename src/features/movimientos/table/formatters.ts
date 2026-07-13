"use client";

export function normalizeTipoMovimiento(tipo: string | null | undefined): string {
  return String(tipo ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

function formatGenericTipoMovimiento(tipo: string): string {
  return tipo
    .trim()
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/^\w/, (match) => match.toUpperCase());
}

export function formatTipoMovimientoLabel(tipo: string | null | undefined): string {
  const raw = String(tipo ?? "").trim();
  const key = normalizeTipoMovimiento(raw);

  if (!raw || key === "N/A" || key === "NA") return "-";
  if (key === "MD_TRABAJANDO" || key === "MD_TRABAJNDO") return "MD trabajando";
  if (key === "REMOLCADA" || key === "REMOLCADO") return "Remolcada";
  return formatGenericTipoMovimiento(raw);
}

export const formatoFecha = (iso: string | null): string => {
  if (!iso) return "-";
  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) return iso;
  return new Date(timestamp).toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const formatoDuracionMovimiento = (inicio?: string | null, fin?: string | null): string => {
  if (!inicio || !fin) return "-";
  const start = Date.parse(inicio);
  const end = Date.parse(fin);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return "-";
  const minutes = Math.round((end - start) / 60000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
};
