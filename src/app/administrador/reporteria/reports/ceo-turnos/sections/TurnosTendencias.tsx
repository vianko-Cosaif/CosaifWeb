"use client";

import React from "react";
import type { Bucket, HourBucket } from "../../../lib/types";
import { fmtDec, fmtInt, fmtPct, n } from "../../../lib/utils";
import {
  Area,
  AreaChart,
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
import ChartCard from "../../../components/ChartCard";
import CustomTooltip from "../../../components/CustomTooltip";
import SectionTitle from "../../../components/SectionTitle";
import Bar3DShape from "../../../components/Bar3DShape";

export default function TurnosTendencias({
  movimientosHora,
  ejecucionData,
  meanHora,
  peakHora,
  meanPct,
  execMax,
}: {
  movimientosHora: HourBucket[];
  ejecucionData: Bucket[];
  meanHora: number;
  peakHora: HourBucket | null;
  meanPct: number;
  execMax: Bucket | null;
}) {
  return (
    <div className="space-y-6">
      <SectionTitle title="Ritmo operativo" subtitle="Rango de ejecución y ritmo por hora" />

      <section className="grid grid-cols-12 gap-4">
        <div className="col-span-12 xl:col-span-5">
          <ChartCard title="Ejecución por rango" subtitle="0–9, 10–89, 90+" accent="amber">
            <div className="mb-3 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
              <span className="rounded-full border border-[var(--stroke)] bg-[var(--panel)] px-3 py-1 text-[var(--muted)]">
                Pico: {execMax?.label ?? "--"} · {fmtInt.format(n(execMax?.movimientos))}
              </span>
              <span className="rounded-full border border-[var(--stroke)] bg-[var(--panel)] px-3 py-1 text-[var(--muted)]">
                Share: {fmtPct.format(n(execMax?.pct))}%
              </span>
            </div>
            <div className="chart-block h-56">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={ejecucionData} barGap={8} margin={{ top: 18, left: 0, right: 16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="4 8" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar
                    dataKey="movimientos"
                    name="Movimientos"
                    fill="#f59e0b"
                    radius={0}
                    shape={(props) => <Bar3DShape {...props} color="#f59e0b" />}
                  />
                  <Line type="monotone" dataKey="pct" name="% del total" stroke="#fb7185" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>
        <div className="col-span-12 xl:col-span-7">
          <ChartCard title="Movimientos por hora" subtitle="Ritmo del turno" accent="sky">
            <div className="mb-3 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
              <span className="rounded-full border border-[var(--stroke)] bg-[var(--panel)] px-3 py-1 text-[var(--muted)]">
                Media: {fmtDec.format(meanHora)}
              </span>
              <span className="rounded-full border border-[var(--stroke)] bg-[var(--panel)] px-3 py-1 text-[var(--muted)]">
                Pico: {peakHora ? `${peakHora.hora}h · ${fmtInt.format(n(peakHora.movimientos))}` : "--"}
              </span>
            </div>
            <div className="chart-block h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={movimientosHora} margin={{ top: 8, left: 0, right: 16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="turnosHourArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.08} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 8" stroke="#e2e8f0" />
                  <XAxis dataKey="hora" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={meanHora} stroke="#94a3b8" strokeDasharray="6 6" />
                  <Area type="monotone" dataKey="movimientos" name="Movimientos" stroke="#0ea5e9" fill="url(#turnosHourArea)" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>
      </section>
    </div>
  );
}
