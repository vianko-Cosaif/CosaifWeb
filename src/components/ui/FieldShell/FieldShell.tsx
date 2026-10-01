"use client";

import type { ReactNode } from "react";
import { cn } from "../cn";

type FieldShellProps = {
  label?: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
};

export default function FieldShell({ label, icon, children, className }: FieldShellProps) {
  return (
    <label className={cn("block min-w-0", className)}>
      {label ? (
        <span className="mb-1.5 block text-xs font-medium text-[var(--app-text-muted)]">
          {label}
        </span>
      ) : null}
      <span className="flex min-h-11 min-w-0 items-center gap-2 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-sm text-[var(--app-text-muted)]">
        {icon ? <span className="shrink-0">{icon}</span> : null}
        {children}
      </span>
    </label>
  );
}
