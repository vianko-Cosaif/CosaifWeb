"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { normalizeTipoMovimiento, formatTipoMovimientoLabel } from "./formatters";

const BADGE_ESTADO: Record<string, { bg: string; dot: string; text: string }> = {
  SOLICITADO: {
    bg: "bg-sky-50 border-sky-200 dark:bg-sky-900/20 dark:border-sky-800",
    dot: "bg-sky-500",
    text: "text-sky-700 dark:text-sky-400",
  },
  EN_PROCESO: {
    bg: "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800",
    dot: "bg-amber-500 animate-pulse",
    text: "text-amber-700 dark:text-amber-400",
  },
  CONCLUIDO: {
    bg: "bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800",
    dot: "bg-emerald-500",
    text: "text-emerald-700 dark:text-emerald-400",
  },
  CANCELADO: {
    bg: "bg-rose-50 border-rose-200 dark:bg-rose-900/20 dark:border-rose-800",
    dot: "bg-rose-500",
    text: "text-rose-700 dark:text-rose-400",
  },
  DETENIDO: {
    bg: "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800",
    dot: "bg-red-500",
    text: "text-red-700 dark:text-red-400",
  },
};

const DEFAULT_BADGE = {
  bg: "bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700",
  dot: "bg-slate-400",
  text: "text-slate-600 dark:text-slate-400",
};

export function BadgeEstado({ estado }: { estado: string }) {
  const badge = BADGE_ESTADO[estado] ?? DEFAULT_BADGE;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide shadow-sm ${badge.bg} ${badge.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
      {estado}
    </span>
  );
}

export function BadgeTipoMovimiento({
  tipo,
  compact = false,
}: {
  tipo: string | null | undefined;
  compact?: boolean;
}) {
  const key = normalizeTipoMovimiento(tipo);
  const label = formatTipoMovimientoLabel(tipo);
  const tone =
    key === "MD_TRABAJANDO" || key === "MD_TRABAJNDO"
      ? "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-900/25 dark:text-indigo-300"
      : key === "REMOLCADA" || key === "REMOLCADO"
        ? "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-800 dark:bg-cyan-900/25 dark:text-cyan-300"
        : "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400";

  return (
    <span
      className={`inline-flex max-w-full items-center rounded-lg border font-bold uppercase tracking-wide shadow-sm ${tone} ${
        compact ? "px-2 py-0.5 text-[9px]" : "px-2.5 py-1.5 text-[10px]"
      }`}
      title={label === "-" ? "Tipo no disponible" : label}
    >
      <span className="truncate">{label}</span>
    </span>
  );
}

export function BooleanChip({
  label,
  type,
}: {
  label: string;
  type: "success" | "danger";
}) {
  const baseClass =
    type === "success"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800"
      : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800";
  const Icon = type === "success" ? CheckCircle2 : AlertTriangle;

  return (
    <span
      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold ${baseClass}`}
    >
      <Icon size={11} /> {label}
    </span>
  );
}
