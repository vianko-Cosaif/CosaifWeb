"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../cn";

export type SegmentOption<TValue extends string> = {
  value: TValue;
  label: ReactNode;
  count?: ReactNode;
  icon?: LucideIcon;
  disabled?: boolean;
};

export type SegmentedControlProps<TValue extends string> = {
  value: TValue;
  options: readonly SegmentOption<TValue>[];
  onChange: (value: TValue) => void;
  ariaLabel: string;
  size?: "sm" | "md";
  className?: string;
};

const sizeClasses = {
  sm: {
    button: "h-9 px-3 text-xs",
    count: "px-1.5 py-0.5 text-[10px]",
    icon: "h-3.5 w-3.5",
  },
  md: {
    button: "h-11 px-4 text-sm",
    count: "px-2 py-0.5 text-xs",
    icon: "h-4 w-4",
  },
} as const;

export default function SegmentedControl<TValue extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  size = "md",
  className,
}: SegmentedControlProps<TValue>) {
  const sizes = sizeClasses[size];

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex max-w-full flex-wrap gap-1 rounded-2xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-800",
        className
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        const Icon = option.icon;

        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex min-w-0 items-center justify-center gap-2 rounded-xl font-black transition",
              sizes.button,
              active
                ? "bg-white text-emerald-700 shadow-sm dark:bg-slate-950 dark:text-emerald-300"
                : "text-slate-500 hover:bg-white/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white",
              option.disabled ? "cursor-not-allowed opacity-50" : ""
            )}
          >
            {Icon ? <Icon className={sizes.icon} aria-hidden /> : null}
            <span className="truncate">{option.label}</span>
            {option.count !== undefined ? (
              <span
                className={cn(
                  "rounded-full font-black tabular-nums",
                  sizes.count,
                  active
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                    : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                )}
              >
                {option.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
