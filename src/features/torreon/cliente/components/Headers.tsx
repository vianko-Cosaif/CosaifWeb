import type { ReactNode } from "react";
import { RefreshCw, type LucideIcon } from "lucide-react";
import Button from "@/components/ui/Button";

export function Header({
  title,
  subtitle,
  refreshing,
  onRefresh,
  action,
}: {
  title: string;
  subtitle: string;
  refreshing?: boolean;
  onRefresh?: () => void;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-[var(--app-border)] pb-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--app-accent)]">{subtitle}</p>
        <h1 className="break-words text-xl font-semibold text-[var(--app-text)] sm:text-2xl">{title}</h1>
      </div>
      <div className="flex flex-wrap gap-2">
        {action}
        {onRefresh ? <Button onClick={onRefresh} loading={refreshing} leftIcon={<RefreshCw className="h-4 w-4" aria-hidden />}>Actualizar</Button> : null}
      </div>
    </div>
  );
}

export function ModuleHeader({
  title,
  subtitle = "Operación ferroviaria",
  chip,
  total,
  icon: Icon,
}: {
  title: string;
  subtitle?: string;
  chip?: string;
  total: number;
  icon: LucideIcon;
}) {
  return (
    <header className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)] text-[var(--app-accent)]">
          <Icon className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <h1 className="break-words text-xl font-semibold tracking-tight text-[var(--app-text)] sm:text-2xl">
            {title}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[var(--app-text-muted)]">
            {subtitle}
            {chip && (
              <span className="inline-flex items-center rounded-full bg-[var(--app-surface-muted)] px-2 py-0.5 text-xs font-medium text-[var(--app-text-muted)]">
                {chip}
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="flex w-fit shrink-0 items-center gap-1.5 rounded-lg bg-[var(--app-surface-muted)] px-3 py-2 text-xs">
        <span className="font-bold tabular-nums text-[var(--app-accent)]">{total}</span>
        <span className="text-[var(--app-text-muted)]">registro{total === 1 ? "" : "s"}</span>
      </div>
    </header>
  );
}
