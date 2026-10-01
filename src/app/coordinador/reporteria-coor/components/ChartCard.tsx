"use client";

import React from "react";

export default function ChartCard({
  title,
  subtitle,
  accent = "indigo",
  children,
}: {
  title: string;
  subtitle?: string;
  accent?: "indigo" | "emerald" | "rose" | "amber" | "sky";
  children: React.ReactNode;
}) {
  const toneMap: Record<string, string> = {
    indigo: "from-indigo-500/30 to-blue-400/10",
    emerald: "from-emerald-500/30 to-teal-400/10",
    rose: "from-rose-500/30 to-pink-400/10",
    amber: "from-amber-500/30 to-orange-400/10",
    sky: "from-sky-500/30 to-cyan-400/10",
  };
  return (
    <div className="rounded-3xl border border-slate-200/70 bg-white/90 p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          {subtitle ? <div className="text-xs text-slate-500">{subtitle}</div> : null}
        </div>
        <div className={`h-2 w-16 rounded-full bg-gradient-to-r ${toneMap[accent]}`} />
      </div>
      {children}
    </div>
  );
}
