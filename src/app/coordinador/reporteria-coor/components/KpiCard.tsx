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
    <div className="relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white/90 p-5 shadow-sm">
      <div className={`absolute left-0 top-0 h-full w-1.5 bg-gradient-to-b ${toneMap[accent]}`} />
      <div className="pl-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-400">{title}</div>
        <div className="mt-2 text-2xl font-black text-slate-900">{value}</div>
        {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
      </div>
    </div>
  );
}
