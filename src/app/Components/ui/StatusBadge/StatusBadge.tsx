"use client";

import type { ReactNode } from "react";
import { cn } from "../cn";

export type StatusTone =
  | "neutral"
  | "success"
  | "info"
  | "warning"
  | "danger"
  | "muted";

export type StatusBadgeSize = "sm" | "md";

export type StatusBadgeProps = {
  status?: string | null;
  label?: ReactNode;
  tone?: StatusTone;
  size?: StatusBadgeSize;
  dot?: boolean;
  className?: string;
};

const toneClasses: Record<StatusTone, string> = {
  neutral:
    "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
  success:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  info:
    "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
  warning:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  danger:
    "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300",
  muted:
    "border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400",
};

const sizeClasses: Record<StatusBadgeSize, string> = {
  sm: "gap-1 px-2 py-0.5 text-[11px]",
  md: "gap-1.5 px-2.5 py-1 text-xs",
};

const dotClasses: Record<StatusTone, string> = {
  neutral: "bg-slate-400",
  success: "bg-emerald-500",
  info: "bg-blue-500",
  warning: "bg-amber-500",
  danger: "bg-rose-500",
  muted: "bg-slate-300 dark:bg-slate-600",
};

export function normalizeStatusLabel(status?: string | null) {
  const normalized = String(status || "").trim().toUpperCase();
  return normalized ? normalized.replaceAll("_", " ") : "SIN ESTADO";
}

export function getStatusTone(status?: string | null): StatusTone {
  const normalized = String(status || "").trim().toUpperCase();
  if (["CONCLUIDO", "COMPLETADO", "RESUELTO", "ACTIVO", "ABIERTO"].includes(normalized)) {
    return "success";
  }
  if (["EN_PROCESO", "PROCESO", "INICIADO"].includes(normalized)) {
    return "info";
  }
  if (["DETENIDO", "BLOQUEADO", "ESPERA", "PENDIENTE", "SOLICITADO"].includes(normalized)) {
    return "warning";
  }
  if (["CANCELADO", "CERRADO", "ERROR", "RECHAZADO"].includes(normalized)) {
    return "danger";
  }
  if (!normalized || normalized === "-") {
    return "muted";
  }
  return "neutral";
}

export default function StatusBadge({
  status,
  label,
  tone,
  size = "md",
  dot = false,
  className,
}: StatusBadgeProps) {
  const resolvedTone = tone ?? getStatusTone(status);

  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-md border font-black uppercase tracking-[0.02em]",
        toneClasses[resolvedTone],
        sizeClasses[size],
        className
      )}
    >
      {dot ? <span className={cn("h-1.5 w-1.5 rounded-full", dotClasses[resolvedTone])} /> : null}
      {label ?? normalizeStatusLabel(status)}
    </span>
  );
}
