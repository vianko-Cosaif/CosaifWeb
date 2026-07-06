import type { LucideIcon } from "lucide-react";

export function Metric({ icon: Icon, label, value, sub }: { icon: LucideIcon; label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
        <Icon className="h-4 w-4 text-emerald-600" />
      </div>
      <div className="mt-2 text-2xl font-semibold text-slate-950">{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}
