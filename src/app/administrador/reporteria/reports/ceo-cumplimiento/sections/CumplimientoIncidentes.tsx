"use client";

import React from "react";
import type { DayIncidents, HourIncidents, Kpis } from "../../../lib/types";
import { fmtDec, fmtInt, fmtMaybeInt, fmtMaybePct, n } from "../../../lib/utils";
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";
import ChartCard from "../../../components/ChartCard";
import CustomTooltip from "../../../components/CustomTooltip";
import KpiCard from "../../../components/KpiCard";
import SectionTitle from "../../../components/SectionTitle";
import Bar3DShape from "../../../components/Bar3DShape";

const estadoColors = ["#f97316", "#0ea5e9", "#ef4444", "#22c55e", "#a855f7", "#facc15"];

export default function CumplimientoIncidentes({
  kpis,
  incidentesHora,
  incidentesDia,
  incidentesEstado,
  meanIncHora,
  meanIncDia,
  peakIncHora,
  peakIncDia,
}: {
  kpis: Kpis;
  incidentesHora: HourIncidents[];
  incidentesDia: DayIncidents[];
  incidentesEstado: Array<{ estado: string; total: number }>;
  meanIncHora: number;
  meanIncDia: number;
  peakIncHora: HourIncidents | null;
  peakIncDia: DayIncidents | null;
}) {
  const barMarginTop = 18;
  return (
    <div className="space-y-6">
      <SectionTitle title="Incidentes" subtitle="Impacto y distribucion por hora y dia" />

      <section className="grid grid-cols-12 gap-4">
        <div className="col-span-12 md:col-span-6 xl:col-span-3">
          <KpiCard title="Incidentes" value={fmtMaybeInt(kpis.totalIncidentes)} accent="rose" />
        </div>
        <div className="col-span-12 md:col-span-6 xl:col-span-3">
          <KpiCard
            title="Mov. con incidente"
            value={`${fmtMaybeInt(kpis.movimientosConIncidente)} · ${fmtMaybePct(kpis.movimientosConIncidentePct)}`}
            accent="amber"
          />
        </div>
        <div className="col-span-12 md:col-span-6 xl:col-span-3">
          <KpiCard title="Críticos < 2 min" value={fmtMaybeInt(kpis.criticosLt2)} accent="emerald" />
        </div>
        <div className="col-span-12 md:col-span-6 xl:col-span-3">
          <KpiCard title="Críticos ≥ 90 min" value={fmtMaybeInt(kpis.criticosGte90)} accent="rose" />
        </div>
      </section>

      <section className="grid grid-cols-12 gap-4">
        <div className="col-span-12 xl:col-span-4">
          <ChartCard title="Incidentes por hora" subtitle="Distribución horaria" accent="rose">
            <div className="mb-3 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
              <span className="rounded-full border border-[var(--stroke)] bg-[var(--panel)] px-3 py-1 text-[var(--muted)]">
                Media: {fmtDec.format(meanIncHora)}
              </span>
              <span className="rounded-full border border-[var(--stroke)] bg-[var(--panel)] px-3 py-1 text-[var(--muted)]">
                Pico: {peakIncHora ? `${peakIncHora.hora}h · ${fmtInt.format(n(peakIncHora.incidentes))}` : "--"}
              </span>
            </div>
            <div className="chart-block h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={incidentesHora} margin={{ top: 8, left: 0, right: 16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="cumplIncHour" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#fb7185" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#fb7185" stopOpacity={0.08} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 8" stroke="#e2e8f0" />
                  <XAxis dataKey="hora" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={meanIncHora} stroke="#94a3b8" strokeDasharray="6 6" />
                  <Area type="monotone" dataKey="incidentes" name="Incidentes" stroke="#f43f5e" fill="url(#cumplIncHour)" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>
        <div className="col-span-12 xl:col-span-4">
          <ChartCard title="Incidentes por día" subtitle="Semana" accent="amber">
            <div className="mb-3 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
              <span className="rounded-full border border-[var(--stroke)] bg-[var(--panel)] px-3 py-1 text-[var(--muted)]">
                Media: {fmtDec.format(meanIncDia)}
              </span>
              <span className="rounded-full border border-[var(--stroke)] bg-[var(--panel)] px-3 py-1 text-[var(--muted)]">
                Pico: {peakIncDia ? `${peakIncDia.dia} · ${fmtInt.format(n(peakIncDia.incidentes))}` : "--"}
              </span>
            </div>
            <div className="chart-block h-56">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={incidentesDia} barGap={8} margin={{ top: barMarginTop, left: 0, right: 16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="4 8" stroke="#e2e8f0" />
                  <XAxis dataKey="dia" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={meanIncDia} stroke="#94a3b8" strokeDasharray="6 6" />
                  <Bar
                    dataKey="incidentes"
                    name="Incidentes"
                    fill="#f59e0b"
                    radius={0}
                    shape={(props: any) => <Bar3DShape {...props} color="#f59e0b" />}
                  />
                  <Line type="monotone" dataKey="incidentes" name="Tendencia" stroke="#92400e" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>
        <div className="col-span-12 xl:col-span-4">
          <ChartCard title="Incidentes por estado" subtitle="Distribución" accent="sky">
            {incidentesEstado.length === 0 ? (
              <div className="flex h-56 items-center justify-center text-sm text-[var(--muted)]">
                Sin datos para este periodo
              </div>
            ) : (
              <div className="chart-block h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={incidentesEstado}
                      dataKey="total"
                      nameKey="estado"
                      innerRadius={40}
                      outerRadius={75}
                      paddingAngle={3}
                    >
                      {incidentesEstado.map((entry, idx) => (
                        <Cell key={`estado-${entry.estado}-${idx}`} fill={estadoColors[idx % estadoColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>
        </div>
      </section>
    </div>
  );
}
