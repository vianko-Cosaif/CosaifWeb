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
    <div className="relative min-w-0 overflow-hidden rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 sm:p-5 shadow-sm">
      <div className={`absolute left-0 top-0 h-full w-1.5 bg-gradient-to-b ${toneMap[accent]}`} />
      <div className="pl-4">
        <div className="text-xs font-semibold uppercase tracking-[0.06em] text-[var(--app-text-muted)]">{title}</div>
        <div className="mt-2 break-words text-2xl font-semibold text-[var(--app-text)]">{value}</div>
        {hint ? <div className="mt-1 text-xs text-[var(--app-text-muted)]">{hint}</div> : null}
      </div>
    </div>
  );
}
