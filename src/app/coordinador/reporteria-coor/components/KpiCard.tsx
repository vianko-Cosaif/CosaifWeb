"use client";

import React from "react";

export default function KpiCard({
  title,
  value,
  hint,
  accent = "indigo",
}: {
  title: string;
  value: string | number;
  hint?: string;
  accent?: "indigo" | "emerald" | "rose" | "amber" | "sky";
}) {
  const toneMap: Record<string, string> = {
    indigo: "from-indigo-500 to-blue-400",
    emerald: "from-emerald-500 to-teal-400",
    rose: "from-rose-500 to-pink-400",
    amber: "from-amber-500 to-orange-400",
    sky: "from-sky-500 to-cyan-400",
  };
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--stroke)] bg-[var(--panel)] p-4 shadow-[var(--shadow)]">
      <div className={`absolute left-0 top-0 h-full w-1.5 bg-gradient-to-b ${toneMap[accent]}`} />
      <div className="pl-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">{title}</div>
        <div className="mt-2 text-2xl font-black text-[var(--text)]">{value}</div>
        {hint ? <div className="mt-1 text-xs text-[var(--muted)]">{hint}</div> : null}
      </div>
    </div>
  );
}
