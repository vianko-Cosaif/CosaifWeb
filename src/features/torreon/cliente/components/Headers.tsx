import type { ReactNode } from "react";
import { RefreshCw, type LucideIcon } from "lucide-react";

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
    <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{subtitle}</p>
        <h1 className="text-2xl font-semibold text-slate-950">{title}</h1>
      </div>
      <div className="flex flex-wrap gap-2">
        {action}
        {onRefresh ? <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Actualizar
        </button> : null}
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
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/30">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h1 className="bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-base font-bold tracking-tight text-transparent sm:text-2xl">
            {title}
          </h1>
          <p className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
            {subtitle}
            {chip && (
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                {chip}
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 rounded-xl bg-slate-50 px-3 py-1.5 text-xs">
        <span className="font-bold tabular-nums text-emerald-600">{total}</span>
        <span className="text-slate-500">registro{total === 1 ? "" : "s"}</span>
      </div>
    </header>
  );
}
