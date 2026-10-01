"use client";

import { Gauge } from "lucide-react";
import type { TornoMeasures } from "../lib/types";

const PAIRS = [
  ["L1", "R1"],
  ["L2", "R2"],
  ["L3", "R3"],
  ["L4", "R4"],
  ["L5", "R5"],
  ["L6", "R6"],
] as const;

function hasMeasures(measures?: TornoMeasures) {
  return Boolean(measures && Object.values(measures).some((value) => value != null && value !== ""));
}

function formatValue(value: string | number | null | undefined) {
  if (value == null || value === "") return "—";
  return String(value);
}

function measureParts(value: string | number | null | undefined) {
  const raw = formatValue(value);
  if (raw === "—") return [];
  if (/^NO[_\s-]?APLICA$/i.test(raw.trim())) return [{ label: "", value: "No aplica" }];

  return raw
    .split(/\s*\|\s*|\n+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const separator = part.indexOf(":");
      if (separator === -1) return { label: "", value: part };
      return {
        label: part.slice(0, separator).trim(),
        value: part.slice(separator + 1).trim() || "—",
      };
    });
}

export default function MeasuresSection({
  title,
  measures,
}: {
  title: string;
  measures?: TornoMeasures;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/50">
        <h3 className="inline-flex min-w-0 items-center gap-2 text-sm font-black text-slate-900 dark:text-slate-100">
          <Gauge className="h-4 w-4 shrink-0 text-cyan-600 dark:text-cyan-300" />
          <span className="truncate">{title}</span>
        </h3>
        <span className="shrink-0 text-[11px] font-black uppercase text-slate-400">L / R</span>
      </div>

      {!hasMeasures(measures) ? (
        <div className="p-3">
          <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-8 text-center text-sm font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
            Sin medidas registradas
          </p>
        </div>
      ) : (
        <div className="grid gap-2 p-3">
          {PAIRS.map(([left, right]) => (
            <div
              key={left}
              className="grid min-w-0 gap-2 rounded-md border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-900/50 sm:grid-cols-[72px_minmax(0,1fr)_minmax(0,1fr)]"
            >
              <div className="flex items-center justify-between rounded-md bg-white px-2 py-2 text-[11px] font-black uppercase text-slate-500 dark:bg-slate-950 sm:block sm:text-center">
                <span>Eje</span>
                <span className="sm:mt-1 sm:block sm:text-base sm:text-slate-900 sm:dark:text-slate-100">{left.slice(1)}</span>
              </div>
              <MeasureCell label={left} tone="cyan" value={measures?.[left]} />
              <MeasureCell label={right} tone="emerald" value={measures?.[right]} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function MeasureCell({
  label,
  tone,
  value,
}: {
  label: string;
  tone: "cyan" | "emerald";
  value: string | number | null | undefined;
}) {
  const parts = measureParts(value);
  const toneClass =
    tone === "cyan"
      ? "bg-cyan-50 text-cyan-950 dark:bg-cyan-950/40 dark:text-cyan-100"
      : "bg-emerald-50 text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-100";

  return (
    <div className="min-w-0 rounded-md border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-950">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-black uppercase text-slate-400">{label}</span>
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-black uppercase ${toneClass}`}>
          {tone === "cyan" ? "Izq" : "Der"}
        </span>
      </div>

      {parts.length === 0 ? (
        <div className="rounded-md bg-slate-50 px-2 py-2 text-sm font-black text-slate-400 dark:bg-slate-900">—</div>
      ) : parts.length === 1 && !parts[0].label ? (
        <div className={`rounded-md px-2 py-2 text-sm font-black ${toneClass}`}>{parts[0].value}</div>
      ) : (
        <div className="grid gap-1.5">
          {parts.map((part, index) => (
            <div
              key={`${part.label}-${index}`}
              className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-md bg-slate-50 px-2 py-1.5 text-xs dark:bg-slate-900"
            >
              <span className="min-w-0 truncate font-bold text-slate-500 dark:text-slate-400">{part.label || "Medida"}</span>
              <span className={`max-w-[96px] truncate rounded px-1.5 py-0.5 text-right font-black ${toneClass}`}>
                {part.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
