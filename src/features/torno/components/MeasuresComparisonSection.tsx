"use client";

import { Gauge } from "lucide-react";
import type { ReactNode } from "react";
import type { TornoMeasurePosition, TornoMeasures } from "../lib/types";

const PAIRS = [
  ["L1", "R1"],
  ["L2", "R2"],
  ["L3", "R3"],
  ["L4", "R4"],
  ["L5", "R5"],
  ["L6", "R6"],
] as const;

type MeasurePart = {
  label: string;
  value: string;
};

function hasValue(value: unknown) {
  if (value == null || value === "") return false;
  return String(value).trim() !== "";
}

function hasMeasures(measures?: TornoMeasures) {
  return Boolean(
    measures &&
      Object.entries(measures).some(([key, value]) => key !== "wheelCount" && hasValue(value)),
  );
}

function measureParts(value: string | number | null | undefined): MeasurePart[] {
  if (!hasValue(value)) return [];
  const raw = String(value).trim();
  if (/^NO[_\s-]?APLICA$/i.test(raw)) return [{ label: "", value: "No aplica" }];

  return raw
    .split(/\s*\|\s*|\n+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const separator = part.indexOf(":");
      if (separator === -1) return { label: "", value: part };
      return {
        label: part.slice(0, separator).trim(),
        value: part.slice(separator + 1).trim() || "-",
      };
    });
}

function sideLabel(position: TornoMeasurePosition) {
  return position.startsWith("L") ? "Izq" : "Der";
}

export default function MeasuresComparisonSection({
  requested,
  final,
}: {
  requested?: TornoMeasures;
  final?: TornoMeasures;
}) {
  const hasAnyMeasure = hasMeasures(requested) || hasMeasures(final);

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/50">
        <h3 className="inline-flex min-w-0 items-center gap-2 text-sm font-black text-slate-900 dark:text-slate-100">
          <Gauge className="h-4 w-4 shrink-0 text-cyan-600 dark:text-cyan-300" />
          <span className="truncate">Comparativo de medidas</span>
        </h3>
        <span className="shrink-0 text-[11px] font-black uppercase text-slate-400">Inicial / Final</span>
      </div>

      {!hasAnyMeasure ? (
        <div className="p-3">
          <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-8 text-center text-sm font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
            Sin medidas registradas
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto p-3">
          <table className="w-full min-w-[980px] border-separate border-spacing-0 text-left text-xs">
            <thead>
              <tr>
                <HeaderCell className="w-[72px] rounded-l-md">Eje</HeaderCell>
                <HeaderCell>L inicial</HeaderCell>
                <HeaderCell>L final</HeaderCell>
                <HeaderCell>R inicial</HeaderCell>
                <HeaderCell className="rounded-r-md">R final</HeaderCell>
              </tr>
            </thead>
            <tbody>
              {PAIRS.map(([left, right]) => (
                <tr key={left}>
                  <td className="border-b border-slate-200 bg-white px-2 py-2 align-top dark:border-slate-800 dark:bg-slate-950">
                    <div className="grid h-full min-h-[76px] place-items-center rounded-md bg-slate-50 text-center dark:bg-slate-900">
                      <span className="text-[10px] font-black uppercase text-slate-400">Eje</span>
                      <span className="text-lg font-black text-slate-950 dark:text-slate-100">{left.slice(1)}</span>
                    </div>
                  </td>
                  <MeasureTd position={left} value={requested?.[left]} tone="initial" />
                  <MeasureTd position={left} value={final?.[left]} tone="final" />
                  <MeasureTd position={right} value={requested?.[right]} tone="initial" />
                  <MeasureTd position={right} value={final?.[right]} tone="final" />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function HeaderCell({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <th className={`border-b border-slate-200 bg-slate-100 px-3 py-2 text-[11px] font-black uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 ${className}`}>
      {children}
    </th>
  );
}

function MeasureTd({
  position,
  value,
  tone,
}: {
  position: TornoMeasurePosition;
  value: string | number | null | undefined;
  tone: "initial" | "final";
}) {
  const parts = measureParts(value);
  const tint =
    tone === "final"
      ? "border-emerald-100 bg-emerald-50/70 text-emerald-950 dark:border-emerald-950 dark:bg-emerald-950/20 dark:text-emerald-100"
      : "border-cyan-100 bg-cyan-50/70 text-cyan-950 dark:border-cyan-950 dark:bg-cyan-950/20 dark:text-cyan-100";
  const badge =
    tone === "final"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-100"
      : "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-100";

  return (
    <td className="border-b border-slate-200 bg-white px-2 py-2 align-top dark:border-slate-800 dark:bg-slate-950">
      <div className={`min-h-[76px] rounded-md border p-2 ${tint}`}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-[11px] font-black uppercase text-slate-500 dark:text-slate-400">{position}</span>
          <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-black uppercase ${badge}`}>
            {sideLabel(position)}
          </span>
        </div>

        {parts.length ? (
          <div className="grid gap-1.5">
            {parts.map((part, index) => (
              <div
                key={`${position}-${tone}-${part.label}-${index}`}
                className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded bg-white/70 px-2 py-1.5 dark:bg-slate-950/60"
              >
                <span className="min-w-0 truncate font-bold text-slate-500 dark:text-slate-400">{part.label || "Medida"}</span>
                <span className="max-w-[110px] truncate text-right font-black">{part.value}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded bg-white/60 px-2 py-2 text-sm font-black text-slate-400 dark:bg-slate-950/50">
            -
          </div>
        )}
      </div>
    </td>
  );
}
