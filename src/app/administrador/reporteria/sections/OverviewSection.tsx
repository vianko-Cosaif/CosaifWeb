import React from "react";
import type { Bucket, HourBucket, Kpis } from "../lib/types";
import { fmtDec, fmtInt, fmtPct, n, fmtMaybeInt, fmtMaybeDec, fmtMaybePct } from "../lib/utils";
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

export default function OverviewSection({
  kpis,
  totalMov,
  conInicioFin,
  sinFin,
  completionPct,
  sinFinPct,
  sparkData,
  ejecucionData,
  execMax,
  meanExec,
  movimientosHora,
  meanHora,
  peakHora,
}: {
  kpis: Kpis;
  totalMov: number;
  conInicioFin: number;
  sinFin: number;
  completionPct: number;
  sinFinPct: number;
  sparkData: Array<{ x: string | number; y: number }>;
  ejecucionData: Bucket[];
  execMax: Bucket | null;
  meanExec: number;
  movimientosHora: HourBucket[];
  meanHora: number;
  peakHora: HourBucket | null;
}) {
  return (
    <div className="space-y-6">
      <SectionTitle title="Resumen Ejecutivo" subtitle="KPIs clave y ejecucion operativa" />
      <section className="grid grid-cols-12 gap-4">
        <div className="col-span-12 md:col-span-4 xl:col-span-3">
          <KpiCard title="Total movimientos" value={fmtMaybeInt(totalMov)} accent="indigo" spark={sparkData} />
        </div>
        <div className="col-span-12 md:col-span-4 xl:col-span-3">
          <KpiCard
            title="Con inicio/fin"
            value={fmtMaybeInt(conInicioFin)}
            accent="emerald"
            progress={completionPct}
            progressLabel="Completado"
          />
        </div>
        <div className="col-span-12 md:col-span-4 xl:col-span-3">
          <KpiCard
            title="Sin fin"
            value={fmtMaybeInt(sinFin)}
            accent="rose"
            progress={sinFinPct}
            progressLabel="Pendiente"
          />
        </div>
        <div className="col-span-12 md:col-span-4 xl:col-span-3">
          <KpiCard title="Incidentes" value={fmtMaybeInt(kpis.totalIncidentes)} accent="amber" />
        </div>
        <div className="col-span-12 md:col-span-4 xl:col-span-3">
          <KpiCard title="Exec media (min)" value={fmtMaybeDec(kpis.execMeanMin)} hint="Promedio" accent="sky" />
        </div>
        <div className="col-span-12 md:col-span-4 xl:col-span-3">
          <KpiCard title="Exec mediana (min)" value={fmtMaybeDec(kpis.execMedianMin)} hint="50%" accent="indigo" />
        </div>
        <div className="col-span-12 md:col-span-4 xl:col-span-3">
          <KpiCard title="Exec P90 (min)" value={fmtMaybeDec(kpis.execP90Min)} hint="90%" accent="amber" />
        </div>
        <div className="col-span-12 md:col-span-4 xl:col-span-3">
          <KpiCard
            title="Mov. con incidente"
            value={`${fmtMaybeInt(kpis.movimientosConIncidente)} · ${fmtMaybePct(kpis.movimientosConIncidentePct)}`}
            accent="rose"
          />
        </div>
        <div className="col-span-12 md:col-span-4 xl:col-span-3">
          <KpiCard title="Criticos total" value={fmtMaybeInt(kpis.criticosTotal)} accent="amber" />
        </div>
        <div className="col-span-12 md:col-span-4 xl:col-span-3">
          <KpiCard title="Criticos < 2 min" value={fmtMaybeInt(kpis.criticosLt2)} accent="emerald" />
        </div>
        <div className="col-span-12 md:col-span-4 xl:col-span-3">
          <KpiCard title="Criticos ≥ 90 min" value={fmtMaybeInt(kpis.criticosGte90)} accent="rose" />
        </div>
        <div className="col-span-12 md:col-span-4 xl:col-span-3">
          <KpiCard title="Indice operativo" value={fmtMaybeInt(kpis.indiceOperativo)} accent="sky" />
        </div>
      </section>

      <section className="grid grid-cols-12 gap-4">
        <div className="col-span-12 xl:col-span-7">
        <ChartCard title="Ejecucion por rango (min)" subtitle="0–9, 10–89, 90+" accent="indigo">
          <div className="mb-3 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
            <span className="rounded-full border border-[var(--stroke)] bg-[var(--panel)] px-3 py-1 text-[var(--muted)]">
              Pico: {execMax?.label ?? "--"} · {fmtInt.format(n(execMax?.movimientos))}
            </span>
            <span className="rounded-full border border-[var(--stroke)] bg-[var(--panel)] px-3 py-1 text-[var(--muted)]">
              Share: {fmtPct.format(n(execMax?.pct))}%
            </span>
            <span className="rounded-full border border-[var(--stroke)] bg-[var(--panel)] px-3 py-1 text-[var(--muted)]">
              Media: {fmtDec.format(meanExec)}
            </span>
          </div>
                  <div className="chart-block h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={ejecucionData} barGap={8} margin={{ top: 18, left: 0, right: 16, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="4 8" stroke="#e2e8f0" />
                        <XAxis dataKey="label" tickLine={false} axisLine={false} />
                        <YAxis yAxisId="left" tickLine={false} axisLine={false} />
                        <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                        <Tooltip content={<CustomTooltip />} />
                        <ReferenceLine yAxisId="left" y={meanExec} stroke="#94a3b8" strokeDasharray="6 6" />
                        <Bar
                          yAxisId="left"
                          dataKey="movimientos"
                          name="Movimientos"
                          fill="#6366f1"
                          radius={0}
                          shape={(props) => <Bar3DShape {...props} color="#6366f1" />}
                        />
                        <Line yAxisId="right" type="monotone" dataKey="pct" name="% del total" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </ChartCard>
        </div>
        <div className="col-span-12 xl:col-span-5">
        <ChartCard title="Movimientos por hora" subtitle="Distribucion diaria por hora" accent="sky">
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
                  <linearGradient id="hourArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 8" stroke="#e2e8f0" />
                <XAxis dataKey="hora" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={meanHora} stroke="#94a3b8" strokeDasharray="6 6" />
                <Area type="monotone" dataKey="movimientos" stroke="#0ea5e9" fill="url(#hourArea)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
        </div>
      </section>
    </div>
  );
}
