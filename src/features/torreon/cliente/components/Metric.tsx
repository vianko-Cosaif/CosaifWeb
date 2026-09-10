import type { LucideIcon } from "lucide-react";

export function Metric({ icon: Icon, label, value, sub }: { icon: LucideIcon; label: string; value: string | number; sub?: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-[var(--app-text-muted)]">{label}</div>
        <Icon className="h-4 w-4 shrink-0 text-[var(--app-accent)]" aria-hidden />
      </div>
      <div className="mt-2 text-2xl font-semibold text-[var(--app-text)]">{value}</div>
      {sub && <div className="mt-1 text-xs text-[var(--app-text-muted)]">{sub}</div>}
    </div>
  );
}
