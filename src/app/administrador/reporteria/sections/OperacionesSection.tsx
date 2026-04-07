import React from "react";
import type { Bucket, DayBucket, Kpis } from "../lib/types";
import { fmtDec, fmtInt, fmtPct, n, fmtMaybeDec } from "../lib/utils";
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
import ChartCard from "../components/ChartCard";
import KpiCard from "../components/KpiCard";
import CustomTooltip from "../components/CustomTooltip";
import SectionTitle from "../components/SectionTitle";
import Bar3DShape from "../components/Bar3DShape";

export default function OperacionesSection({
  kpis,
  movimientosDia,
  meanDia,
  peakDia,
  ejecucionData,
  meanPct,
}: {
  kpis: Kpis;
  movimientosDia: DayBucket[];
  meanDia: number;
  peakDia: DayBucket | null;
  ejecucionData: Bucket[];
  meanPct: number;
}) {
  const barMarginTop = 18;
  return (
    <div className="space-y-6">
      <SectionTitle title="Operaciones" subtitle="Distribucion, eficiencia y tiempos" />
      <section className="grid grid-cols-12 gap-4">
        <div className="col-span-12 md:col-span-6 xl:col-span-3">
          <KpiCard title="Espera media (min)" value={fmtMaybeDec(kpis.esperaMeanMin)} accent="amber" />
        </div>
        <div className="col-span-12 md:col-span-6 xl:col-span-3">
          <KpiCard title="Espera P90 (min)" value={fmtMaybeDec(kpis.esperaP90Min)} accent="rose" />
        </div>
        <div className="col-span-12 md:col-span-6 xl:col-span-3">
          <KpiCard title="Lead media (min)" value={fmtMaybeDec(kpis.leadMeanMin)} accent="indigo" />
        </div>
        <div className="col-span-12 md:col-span-6 xl:col-span-3">
          <KpiCard title="Lead P90 (min)" value={fmtMaybeDec(kpis.leadP90Min)} accent="sky" />
        </div>
      </section>

      <section className="grid grid-cols-12 gap-4">
        <div className="col-span-12 xl:col-span-7">
        <ChartCard title="Movimientos por dia" subtitle="Semana" accent="emerald">
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
              <ComposedChart data={movimientosDia} barGap={8} margin={{ top: barMarginTop, left: 0, right: 16, bottom: 0 }}>
                <defs>
                  <linearGradient id="dayBar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.4} />
                  </linearGradient>
                </defs>
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
                  shape={(props) => <Bar3DShape {...props} color="#10b981" />}
                />
                <Line type="monotone" dataKey="movimientos" name="Tendencia" stroke="#065f46" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
        </div>
        <div className="col-span-12 xl:col-span-5">
        <ChartCard title="Ejecucion (%)" subtitle="Participacion por rango" accent="amber">
          <div className="mb-3 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
            <span className="rounded-full border border-[var(--stroke)] bg-[var(--panel)] px-3 py-1 text-[var(--muted)]">
              Media: {fmtPct.format(meanPct)}%
            </span>
          </div>
          <div className="chart-block h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={ejecucionData} margin={{ top: 8, left: 0, right: 16, bottom: 0 }}>
                <defs>
                  <linearGradient id="execPctArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.08} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 8" stroke="#e2e8f0" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={meanPct} stroke="#94a3b8" strokeDasharray="6 6" />
                <Area type="monotone" dataKey="pct" name="% del total" stroke="#f59e0b" fill="url(#execPctArea)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
        </div>
      </section>
    </div>
  );
}
