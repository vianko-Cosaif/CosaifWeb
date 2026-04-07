import React from "react";
import { initials, n } from "../lib/utils";

export default function RankingTable<T extends Record<string, any>>({
  title,
  subtitle,
  data,
  columns,
  accent = "indigo",
  highlightKey,
  controls,
  compact = false,
}: {
  title: string;
  subtitle?: string;
  data: T[];
  columns: Array<{ key: keyof T; label: string; format?: (value: any, row: T) => string }>;
  accent?: "indigo" | "emerald" | "amber" | "rose" | "sky";
  highlightKey?: keyof T;
  controls?: React.ReactNode;
  compact?: boolean;
}) {
  const inferredKey = (() => {
    if (highlightKey) return highlightKey;
    const sample = data[0];
    if (!sample) return null;
    if ("totalMovimientos" in sample) return "totalMovimientos" as keyof T;
    if ("incidentesTotal" in sample) return "incidentesTotal" as keyof T;
    const numericColumn = columns.find((c) => typeof sample[c.key] === "number");
    return numericColumn?.key ?? null;
  })();

  const maxHighlight = inferredKey ? Math.max(1, ...data.map((row) => n(row[inferredKey]))) : 1;

  const accentMap: Record<string, string> = {
    indigo: "from-indigo-500 to-blue-500",
    emerald: "from-emerald-500 to-teal-500",
    amber: "from-amber-500 to-orange-500",
    rose: "from-rose-500 to-pink-500",
    sky: "from-sky-500 to-cyan-500",
  };

  return (
    <div className="rounded-2xl border border-[var(--stroke)] bg-[var(--panel)] p-5 shadow-[var(--shadow)]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-black text-[var(--text)]">{title}</h3>
          {subtitle ? <p className="text-xs text-[var(--muted)]">{subtitle}</p> : null}
        </div>
        <div className="flex items-center gap-2">
          {controls}
          <span className="text-[11px] uppercase tracking-[0.2em] text-[var(--muted)]">
            {data.length ? `Top ${data.length}` : "Sin datos"}
          </span>
        </div>
      </div>

      <div className="mt-4 overflow-auto">
        {data.length === 0 ? (
          <div className="text-sm text-[var(--muted)]">No hay registros</div>
        ) : (
          <table className={`min-w-full ${compact ? "text-xs" : "text-sm"}`}>
            <thead className="sticky top-0 z-10 bg-[var(--panel)]">
              <tr className="text-left text-[11px] uppercase tracking-[0.15em] text-[var(--muted)]">
                <th className={`${compact ? "py-2 pr-2" : "py-2 pr-3"}`}>#</th>
                {columns.map((c) => (
                  <th key={String(c.key)} className={`${compact ? "py-2 pr-2" : "py-2 pr-3"}`}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--stroke)]">
              {data.map((row, i) => {
                const isTop = i < 3;
                const rowTone =
                  i === 0
                    ? "from-amber-50/70 to-transparent"
                    : i === 1
                      ? "from-slate-100/70 to-transparent"
                      : "from-rose-50/60 to-transparent";
                return (
                  <tr
                    key={i}
                    className={`group ${isTop ? `bg-gradient-to-r ${rowTone}` : ""} hover:bg-[var(--panel-2)]`}
                  >
                    <td className={`${compact ? "py-2 pr-2" : "py-3 pr-3"}`}>
                      <span
                        className={`inline-flex ${compact ? "h-7 w-7 text-[10px]" : "h-8 w-8 text-xs"} items-center justify-center rounded-full font-black ${
                          isTop
                            ? `bg-gradient-to-br ${accentMap[accent]} text-white`
                            : "bg-[var(--panel-2)] text-[var(--muted)]"
                        }`}
                      >
                        {i + 1}
                      </span>
                    </td>
                    {columns.map((c) => {
                      const raw = row[c.key];
                      const value = c.format ? c.format(raw, row) : String(raw ?? "-");
                      const isHighlight = inferredKey && c.key === inferredKey;
                      const pct = inferredKey ? (n(raw) / maxHighlight) * 100 : 0;
                      const keyName = String(c.key).toLowerCase();
                      const isNameCell =
                        keyName.includes("nombre") ||
                        keyName.includes("operador") ||
                        keyName.includes("locomotive") ||
                        keyName.includes("empresa") ||
                        keyName.includes("cliente") ||
                        keyName.includes("supervisor") ||
                        keyName.includes("coordinador") ||
                        keyName.includes("localidad");
                      const rawText = raw == null ? "" : String(raw);
                      return (
                        <td key={String(c.key)} className={`${compact ? "py-2 pr-2" : "py-3 pr-3"} text-[var(--text)]`}>
                          {isHighlight ? (
                            <div className="flex flex-col gap-2">
                              <div className="font-semibold">{value}</div>
                              <div className="h-1.5 w-full rounded-full bg-[var(--panel-2)]">
                                <div
                                  className={`h-1.5 rounded-full bg-gradient-to-r ${accentMap[accent]}`}
                                  style={{ width: `${Math.min(100, Math.max(4, pct))}%` }}
                                />
                              </div>
                            </div>
                          ) : isNameCell ? (
                            <div className="flex items-center gap-3">
                              <div
                                className={`flex ${compact ? "h-7 w-7 text-[10px]" : "h-8 w-8 text-[11px]"} items-center justify-center rounded-full font-black ${
                                  isTop
                                    ? `bg-gradient-to-br ${accentMap[accent]} text-white`
                                    : "bg-[var(--panel-2)] text-[var(--muted)]"
                                }`}
                              >
                                {initials(rawText)}
                              </div>
                              <div className="font-semibold">{value}</div>
                            </div>
                          ) : (
                            value
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
