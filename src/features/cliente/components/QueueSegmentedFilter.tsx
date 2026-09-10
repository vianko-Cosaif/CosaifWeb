"use client";

import React from "react";

export type QueueSegmentedFilterOption<T extends string> = {
  label: string;
  value: T;
  count?: number;
};

type QueueSegmentedFilterProps<T extends string> = {
  options: QueueSegmentedFilterOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
};

function QueueSegmentedFilter<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: QueueSegmentedFilterProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex w-full rounded-lg border border-slate-200 bg-slate-100/80 p-1 dark:border-white/[0.06] dark:bg-white/[0.04] sm:w-auto"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={[
              "min-h-8 flex-1 rounded-md px-3 text-xs font-semibold transition-all sm:flex-none",
              "inline-flex items-center justify-center gap-2 whitespace-nowrap",
              active
                ? "bg-white text-slate-950 shadow-sm dark:bg-[#161b22] dark:text-white"
                : "text-slate-500 hover:bg-white/60 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/[0.05] dark:hover:text-slate-200",
            ].join(" ")}
          >
            <span>{option.label}</span>
            {typeof option.count === "number" ? (
              <span
                className={[
                  "rounded px-1.5 py-0.5 text-[10px] tabular-nums",
                  active
                    ? "bg-slate-100 text-slate-600 dark:bg-white/[0.08] dark:text-slate-300"
                    : "bg-white/70 text-slate-500 dark:bg-white/[0.05] dark:text-slate-500",
                ].join(" ")}
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

export default React.memo(QueueSegmentedFilter) as typeof QueueSegmentedFilter;

