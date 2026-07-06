"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../cn";

export type KpiTone = "neutral" | "success" | "info" | "warning" | "danger" | "indigo";

export type KpiCardProps = {
  label: ReactNode;
  value: ReactNode;
  helper?: ReactNode;
  icon?: LucideIcon;
  tone?: KpiTone;
  compact?: boolean;
  className?: string;
};

const toneClasses: Record<KpiTone, { card: string; icon: string; value: string }> = {
  neutral: {
    card: "bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100",
    icon: "text-slate-500 dark:text-slate-400",
    value: "text-slate-950 dark:text-white",
  },
  success: {
    card: "bg-emerald-50/70 text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-100",
    icon: "text-emerald-600 dark:text-emerald-300",
    value: "text-emerald-700 dark:text-emerald-300",
  },
  info: {
    card: "bg-blue-50/70 text-blue-950 dark:bg-blue-950/30 dark:text-blue-100",
    icon: "text-blue-600 dark:text-blue-300",
    value: "text-blue-700 dark:text-blue-300",
  },
  warning: {
    card: "bg-amber-50/70 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100",
    icon: "text-amber-700 dark:text-amber-300",
    value: "text-amber-800 dark:text-amber-300",
  },
  danger: {
    card: "bg-rose-50/70 text-rose-950 dark:bg-rose-950/30 dark:text-rose-100",
    icon: "text-rose-600 dark:text-rose-300",
    value: "text-rose-700 dark:text-rose-300",
  },
  indigo: {
    card: "bg-indigo-50/70 text-indigo-950 dark:bg-indigo-950/30 dark:text-indigo-100",
    icon: "text-indigo-600 dark:text-indigo-300",
    value: "text-indigo-700 dark:text-indigo-300",
  },
};

export default function KpiCard({
  label,
  value,
  helper,
  icon: Icon,
  tone = "neutral",
  compact = false,
  className,
}: KpiCardProps) {
  const toneClass = toneClasses[tone];

  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 shadow-sm dark:border-slate-800",
        compact ? "px-3 py-2" : "px-4 py-3",
        toneClass.card,
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[10px] font-black uppercase tracking-wide text-slate-400 dark:text-slate-500">
            {label}
          </p>
          <div
            className={cn(
              "mt-1 truncate font-black tabular-nums",
              compact ? "text-sm" : "text-2xl",
              toneClass.value
            )}
          >
            {value}
          </div>
        </div>
        {Icon ? <Icon className={cn("h-5 w-5 shrink-0", toneClass.icon)} aria-hidden /> : null}
      </div>
      {helper ? (
        <div className="mt-1 truncate text-xs font-semibold text-slate-500 dark:text-slate-400">
          {helper}
        </div>
      ) : null}
    </div>
  );
}
