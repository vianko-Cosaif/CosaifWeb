"use client";

import React from "react";
import type { Bucket, DayBucket, HourBucket } from "../../../lib/types";
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

export default function TraficoTendencias({
  movimientosHora,
  movimientosDia,
  ejecucionData,
  meanHora,
  peakHora,
  meanDia,
  peakDia,
  meanPct,
}: {
  movimientosHora: HourBucket[];
  movimientosDia: DayBucket[];
  ejecucionData: Bucket[];
  meanHora: number;
  peakHora: HourBucket | null;
  meanDia: number;
  peakDia: DayBucket | null;
  meanPct: number;
}) {
  return (
    <div className="space-y-6">
      <SectionTitle title="Tendencias de tráfico" subtitle="Ritmo horario, semanal y ejecución" />

      <section className="grid grid-cols-12 gap-4">
        <div className="col-span-12 xl:col-span-7">
          <ChartCard title="Movimientos por día" subtitle="Distribución semanal" accent="emerald">
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
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={meanDia} stroke="#94a3b8" strokeDasharray="6 6" />
                  <Bar
                    dataKey="movimientos"
                    name="Movimientos"
                    fill="#10b981"
                    radius={0}
                    shape={(props: any) => <Bar3DShape {...props} color="#10b981" />}
                  />
                  <Line type="monotone" dataKey="movimientos" name="Tendencia" stroke="#065f46" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>
        <div className="col-span-12 xl:col-span-5">
          <ChartCard title="Ejecución (%)" subtitle="Participación por rango" accent="amber">
            <div className="mb-3 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
              <span className="rounded-full border border-[var(--stroke)] bg-[var(--panel)] px-3 py-1 text-[var(--muted)]">
                Media: {fmtPct.format(meanPct)}%
              </span>
            </div>
            <div className="chart-block h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={ejecucionData} margin={{ top: 8, left: 0, right: 16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="traficoExecArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.08} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 8" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={meanPct} stroke="#94a3b8" strokeDasharray="6 6" />
                  <Area type="monotone" dataKey="pct" name="% del total" stroke="#f59e0b" fill="url(#traficoExecArea)" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>
      </section>

      <section className="grid grid-cols-12 gap-4">
        <div className="col-span-12">
          <ChartCard title="Movimientos por hora" subtitle="Distribución diaria" accent="sky">
            <div className="mb-3 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
              <span className="rounded-full border border-[var(--stroke)] bg-[var(--panel)] px-3 py-1 text-[var(--muted)]">
                Media: {fmtDec.format(meanHora)}
              </span>
              <span className="rounded-full border border-[var(--stroke)] bg-[var(--panel)] px-3 py-1 text-[var(--muted)]">
                Pico: {peakHora ? `${peakHora.hora}h · ${fmtInt.format(n(peakHora.movimientos))}` : "--"}
              </span>
            </div>
            <div className="chart-block h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={movimientosHora} margin={{ top: 8, left: 0, right: 16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="traficoHourArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.08} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 8" stroke="#e2e8f0" />
                  <XAxis dataKey="hora" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={meanHora} stroke="#94a3b8" strokeDasharray="6 6" />
                  <Area type="monotone" dataKey="movimientos" name="Movimientos" stroke="#0ea5e9" fill="url(#traficoHourArea)" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>
      </section>
    </div>
  );
}
