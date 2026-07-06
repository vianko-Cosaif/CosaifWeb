"use client";

import type { LucideIcon } from "lucide-react";

type IncidentStatColor = "slate" | "emerald" | "blue" | "indigo";

type IncidentStatCardProps = {
  label: string;
  value: number;
  icon: LucideIcon;
  color: IncidentStatColor;
};

const styles: Record<IncidentStatColor, string> = {
  slate: "from-slate-500 to-slate-700 shadow-slate-500/20",
  emerald: "from-emerald-500 to-emerald-700 shadow-emerald-500/20",
  blue: "from-blue-500 to-blue-700 shadow-blue-500/20",
  indigo: "from-indigo-500 to-indigo-700 shadow-indigo-500/20",
};

export default function IncidentStatCard({ label, value, icon: Icon, color }: IncidentStatCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <div className="absolute right-0 top-0 p-3 opacity-10 transition-transform group-hover:scale-110">
        <Icon className="h-24 w-24" aria-hidden />
      </div>

      <div className="relative z-10 flex items-start justify-between">
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-500 opacity-80 dark:text-slate-400">
            {label}
          </p>
          <p className="text-3xl font-black tracking-tight text-slate-800 dark:text-white">{value}</p>
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${styles[color]} text-white shadow-lg`}>
          <Icon className="h-6 w-6" aria-hidden />
        </div>
      </div>

      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
    </div>
  );
}
