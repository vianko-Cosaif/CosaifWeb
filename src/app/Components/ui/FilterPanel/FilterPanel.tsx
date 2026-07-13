"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { cn } from "../cn";

type FilterPanelProps = {
  title?: ReactNode;
  count?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
};

export default function FilterPanel({
  title = "Filtros",
  count,
  actions,
  footer,
  children,
  className,
  collapsible = false,
  defaultOpen = true,
}: FilterPanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <section
      className={cn(
        "rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-3 shadow-[var(--app-shadow-sm)]",
        className
      )}
    >
      <div className={cn("flex flex-wrap items-center justify-between gap-2", open && "mb-3")}>
        {collapsible ? (
          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            aria-expanded={open}
            aria-controls={contentId}
            className="inline-flex min-h-9 items-center gap-2 rounded-lg px-1 text-xs font-black uppercase tracking-wide text-[var(--app-text-muted)] transition hover:text-[var(--app-accent)]"
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden />
            <span>{title}</span>
            {count !== undefined ? (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                {count}
              </span>
            ) : null}
            <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} aria-hidden />
          </button>
        ) : (
          <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wide text-[var(--app-text-muted)]">
            <SlidersHorizontal className="h-4 w-4" aria-hidden />
            <span>{title}</span>
            {count !== undefined ? (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                {count}
              </span>
            ) : null}
          </div>
        )}
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      <div id={contentId} hidden={!open}>
        {children}
        {footer ? <div className="mt-3 border-t border-[var(--app-border)] pt-3">{footer}</div> : null}
      </div>
    </section>
  );
}
