import React from "react";
import { fmtInt, fmtPct, n } from "../lib/utils";

export default function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<any>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const items = payload.filter((p) => p && p.value != null);
  return (
    <div className="rounded-xl border border-[var(--stroke)] bg-[var(--panel)] px-3 py-2 text-xs text-[var(--text)] shadow-[var(--shadow)]">
      <div className="text-xs font-semibold">{label}</div>
      <div className="mt-2 space-y-1">
        {items.map((item, idx) => {
          const key = String(item.dataKey ?? item.name ?? "");
          const isPct = key.toLowerCase().includes("pct");
          const formatted = isPct
            ? `${fmtPct.format(n(item.value))}%`
            : fmtInt.format(n(item.value));
          return (
            <div key={`${key}-${idx}`} className="flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: item.color ?? "#6366f1" }}
              />
              <span className="text-[var(--muted)]">{item.name ?? key}</span>
              <span className="ml-auto font-semibold text-[var(--text)]">
                {formatted}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
