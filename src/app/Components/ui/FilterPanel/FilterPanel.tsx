"use client";

import type { ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";
import { cn } from "../cn";

type FilterPanelProps = {
  title?: ReactNode;
  count?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
};

export default function FilterPanel({
  title = "Filtros",
  count,
  actions,
  footer,
  children,
  className,
}: FilterPanelProps) {
  return (
    <section
      className={cn(
        "rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900",
        className
      )}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
          <SlidersHorizontal className="h-4 w-4" aria-hidden />
          <span>{title}</span>
          {count !== undefined ? (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
              {count}
            </span>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children}
      {footer ? <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">{footer}</div> : null}
    </section>
  );
}
