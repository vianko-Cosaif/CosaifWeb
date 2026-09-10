import React from "react";

export default function ChartCard({
  title,
  subtitle,
  children,
  accent = "indigo",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  accent?: "indigo" | "emerald" | "amber" | "rose" | "sky";
}) {
  const accentMap: Record<string, string> = {
    indigo: "from-indigo-500/25 via-indigo-500/5 to-transparent",
    emerald: "from-emerald-500/25 via-emerald-500/5 to-transparent",
    amber: "from-amber-500/25 via-amber-500/5 to-transparent",
    rose: "from-rose-500/25 via-rose-500/5 to-transparent",
    sky: "from-sky-500/25 via-sky-500/5 to-transparent",
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--stroke)] bg-[var(--panel)] p-5 shadow-[var(--shadow)]">
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${accentMap[accent]}`} />
      <div className="relative">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-base font-black text-[var(--text)]">{title}</h3>
            {subtitle ? <p className="text-xs text-[var(--muted)]">{subtitle}</p> : null}
          </div>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
