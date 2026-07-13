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
        "flex min-h-[260px] flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-4 py-10 text-center",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <div className="grid h-14 w-14 place-items-center rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)] text-[var(--app-text-soft)]">
        <Icon className="h-7 w-7" aria-hidden />
      </div>
      <div className="max-w-md">
        <p className="text-sm font-black text-[var(--app-text-muted)]">{title}</p>
        {description ? (
          <p className="mt-1 text-xs font-semibold text-[var(--app-text-soft)]">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center justify-center gap-2">{actions}</div> : null}
    </div>
  );
}
