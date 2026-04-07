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
    indigo: "from-indigo-500/20 to-blue-400/10",
    emerald: "from-emerald-500/20 to-teal-400/10",
    rose: "from-rose-500/20 to-pink-400/10",
    amber: "from-amber-500/20 to-orange-400/10",
    sky: "from-sky-500/20 to-cyan-400/10",
  };
  return (
    <div className="rounded-2xl border border-[var(--stroke)] bg-[var(--panel)] p-4 shadow-[var(--shadow)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-[var(--text)]">{title}</div>
          {subtitle ? <div className="text-xs text-[var(--muted)]">{subtitle}</div> : null}
        </div>
        <div className={`h-2 w-16 rounded-full bg-gradient-to-r ${toneMap[accent]}`} />
      </div>
      {children}
    </div>
  );
}
