"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import { cn } from "../cn";

export type DataEmptyStateProps = {
  title: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  actions?: ReactNode;
  className?: string;
};

export default function DataEmptyState({
  title,
  description,
  icon: Icon = Inbox,
  actions,
  className,
}: DataEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-[260px] flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-slate-200 bg-white/50 px-4 py-10 text-center dark:border-slate-800 dark:bg-slate-950/40",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <div className="grid h-14 w-14 place-items-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-600">
        <Icon className="h-7 w-7" aria-hidden />
      </div>
      <div className="max-w-md">
        <p className="text-sm font-black text-slate-600 dark:text-slate-300">{title}</p>
        {description ? (
          <p className="mt-1 text-xs font-semibold text-slate-400 dark:text-slate-500">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center justify-center gap-2">{actions}</div> : null}
    </div>
  );
}
