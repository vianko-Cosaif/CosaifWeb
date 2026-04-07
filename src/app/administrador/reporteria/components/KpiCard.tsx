import React from "react";
import { ResponsiveContainer, LineChart, Line } from "recharts";
import { fmtPct } from "../lib/utils";

export default function KpiCard({
  title,
  value,
  hint,
  accent = "indigo",
  progress,
  progressLabel,
  spark,
}: {
  title: string;
  value: string;
  hint?: string;
  accent?: "indigo" | "emerald" | "amber" | "rose" | "sky";
  progress?: number | null;
  progressLabel?: string;
  spark?: Array<{ x: string | number; y: number }>;
}) {
  const accentMap: Record<string, string> = {
    indigo: "from-indigo-500 to-blue-500",
    emerald: "from-emerald-500 to-teal-500",
    amber: "from-amber-500 to-orange-500",
    rose: "from-rose-500 to-pink-500",
    sky: "from-sky-500 to-cyan-500",
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--stroke)] bg-[var(--panel)] p-4 shadow-[var(--shadow)]">
      <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${accentMap[accent]}`} />
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
        {title}
      </div>
      <div className="mt-2 text-2xl font-black text-[var(--text)]">{value}</div>
      {hint ? <div className="mt-1 text-xs text-[var(--muted)]">{hint}</div> : null}
      {typeof progress === "number" ? (
        <div className="mt-3">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
            <span>{progressLabel ?? "Avance"}</span>
            <span>{fmtPct.format(progress)}%</span>
          </div>
          <div className="mt-1 h-2 w-full rounded-full bg-[var(--panel-2)]">
            <div
              className={`h-2 rounded-full bg-gradient-to-r ${accentMap[accent]}`}
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        </div>
      ) : null}
      {spark && spark.length > 1 ? (
        <div className="mt-3 h-12">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={spark}>
              <Line type="monotone" dataKey="y" stroke="#6366f1" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : null}
    </div>
  );
}
