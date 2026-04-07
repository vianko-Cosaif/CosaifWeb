"use client";

import React, { useMemo } from "react";
import type { DayBucket } from "../lib/types";
import { fmtDec, fmtInt, hasArray, n } from "../lib/utils";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import ChartCard from "../components/ChartCard";

export default function OperacionesSection({
  movimientosDia,
  meanDia,
  peakDia,
  estadosGeneral,
}: {
  movimientosDia: DayBucket[];
  meanDia: number;
  peakDia: DayBucket | null;
  estadosGeneral: Record<string, number>;
}) {
  const estadosData = useMemo(() => {
    const entries = Object.entries(estadosGeneral ?? {});
    return entries.map(([estado, total]) => ({ estado, total }));
  }, [estadosGeneral]);

  return (
    <div className="space-y-6">
      {hasArray(movimientosDia) ? (
        <section className="grid grid-cols-12 gap-4">
          <div className="col-span-12">
            <ChartCard title="Movimientos por día" subtitle="Semana" accent="emerald">
              <div className="mb-3 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
                <span className="rounded-full border border-[var(--stroke)] bg-[var(--panel)] px-3 py-1 text-[var(--muted)]">
                  Media: {fmtDec.format(meanDia)}
                </span>
                <span className="rounded-full border border-[var(--stroke)] bg-[var(--panel)] px-3 py-1 text-[var(--muted)]">
                  Pico: {peakDia ? `${peakDia.dia} · ${fmtInt.format(n(peakDia.movimientos))}` : "--"}
                </span>
              </div>
              <div className="chart-block h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={movimientosDia} barGap={8} margin={{ top: 18, left: 0, right: 16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="4 8" stroke="#e2e8f0" />
                    <XAxis dataKey="dia" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} />
                    <Tooltip />
                    <ReferenceLine y={meanDia} stroke="#94a3b8" strokeDasharray="6 6" />
                    <Bar dataKey="movimientos" name="Movimientos" fill="#10b981" radius={6} />
                    <Line type="monotone" dataKey="movimientos" name="Tendencia" stroke="#065f46" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          </div>
        </section>
      ) : null}

      {hasArray(estadosData) ? (
        <section className="grid grid-cols-12 gap-4">
          <div className="col-span-12">
            <ChartCard title="Estados generales" subtitle="Distribución operativa" accent="indigo">
              <div className="chart-block h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={estadosData} barGap={8} margin={{ top: 18, left: 0, right: 16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="4 8" stroke="#e2e8f0" />
                    <XAxis dataKey="estado" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Bar dataKey="total" name="Total" fill="#6366f1" radius={6} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          </div>
        </section>
      ) : null}
    </div>
  );
}
