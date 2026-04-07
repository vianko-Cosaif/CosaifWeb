"use client";

import React from "react";
import SectionTitle from "../../../components/SectionTitle";
import { fmtMaybeDec, fmtMaybeInt, fmtMaybePct } from "../../../lib/utils";

type DeltaMetric = {
  actual?: number;
  anterior?: number;
  delta?: number;
  deltaPct?: number;
};

export default function ComparativoResumen({
  resumen,
}: {
  resumen: Record<string, DeltaMetric> | undefined;
}) {
  const entries = Object.entries(resumen ?? {});
  if (!entries.length) return null;

  return (
    <div className="space-y-4">
      <SectionTitle title="Resumen Comparativo" subtitle="Actual vs periodo anterior" />
      <section className="grid grid-cols-12 gap-4">
        {entries.map(([key, metric]) => {
          const delta = metric?.delta ?? 0;
          const isUp = delta >= 0;
          return (
            <div
              key={key}
              className="col-span-12 md:col-span-6 xl:col-span-4 rounded-2xl border border-[var(--stroke)] bg-[var(--panel)] p-4 shadow-[var(--shadow)]"
            >
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                {key.replace(/([A-Z])/g, " $1").trim()}
              </div>
              <div className="mt-2 text-2xl font-black text-[var(--text)]">
                {fmtMaybeInt(metric?.actual)}
              </div>
              <div className="mt-1 text-xs text-[var(--muted)]">
                Anterior: {fmtMaybeInt(metric?.anterior)}
              </div>
              <div
                className={`mt-2 inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
                  isUp ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                }`}
              >
                {isUp ? "▲" : "▼"} {fmtMaybeInt(metric?.delta)} · {fmtMaybePct(metric?.deltaPct)}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
