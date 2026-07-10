"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../cn";

export type ModuleHeaderProps = {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  badge?: ReactNode;
  icon?: LucideIcon;
  iconNode?: ReactNode;
  actions?: ReactNode;
  loading?: boolean;
  className?: string;
};

export default function ModuleHeader({
  eyebrow,
  title,
  subtitle,
  badge,
  icon: Icon,
  iconNode,
  actions,
  loading = false,
  className,
}: ModuleHeaderProps) {
  return (
    <header className={cn("flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="flex min-w-0 items-center gap-3">
        {Icon || iconNode ? (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--app-accent)] text-white shadow-sm">
            {iconNode ?? (Icon ? <Icon className="h-5 w-5" aria-hidden /> : null)}
          </div>
        ) : null}
        <div className="min-w-0">
          {eyebrow ? (
            <p className="truncate text-xs font-black uppercase tracking-wide text-[var(--app-accent)]">
              {eyebrow}
            </p>
          ) : null}
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h1 className="truncate text-xl font-black text-[var(--app-text)] sm:text-2xl">
              {title}
            </h1>
            {badge ? (
              <span className="inline-flex items-center rounded-full bg-[var(--app-surface-muted)] px-2 py-0.5 text-[10px] font-black text-[var(--app-text-muted)]">
                {badge}
              </span>
            ) : null}
          </div>
          {subtitle || loading ? (
            <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-2 text-xs font-semibold text-[var(--app-text-muted)]">
              {subtitle ? <span className="truncate">{subtitle}</span> : null}
              {loading ? (
                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  sincronizando
                </span>
              ) : null}
            </p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
