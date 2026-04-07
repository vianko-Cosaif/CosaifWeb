"use client";

import React from "react";
import type { HourIncidents, Kpis } from "../../../lib/types";
import { fmtDec, fmtInt, fmtMaybeInt, fmtMaybePct, n } from "../../../lib/utils";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import ChartCard from "../../../components/ChartCard";
import CustomTooltip from "../../../components/CustomTooltip";
import KpiCard from "../../../components/KpiCard";
import SectionTitle from "../../../components/SectionTitle";

export default function TurnosIncidentes({
  kpis,
  incidentesHora,
  meanIncHora,
  peakIncHora,
}: {
  kpis: Kpis;
  incidentesHora: HourIncidents[];
  meanIncHora: number;
  peakIncHora: HourIncidents | null;
}) {
  return (
    <div className="space-y-6">
      <SectionTitle title="Incidentes por turno" subtitle="Impacto operativo y ritmo horario" />

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
          <KpiCard title="Críticos" value={fmtMaybeInt(kpis.criticosTotal)} accent="amber" />
        </div>
        <div className="col-span-12 md:col-span-6 xl:col-span-3">
          <KpiCard title="Cancelados" value={fmtMaybeInt(kpis.cancelados)} accent="rose" />
        </div>
      </section>

      <section className="grid grid-cols-12 gap-4">
        <div className="col-span-12">
          <ChartCard title="Incidentes por hora" subtitle="Distribución horaria" accent="rose">
            <div className="mb-3 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
              <span className="rounded-full border border-[var(--stroke)] bg-[var(--panel)] px-3 py-1 text-[var(--muted)]">
                Media: {fmtDec.format(meanIncHora)}
              </span>
              <span className="rounded-full border border-[var(--stroke)] bg-[var(--panel)] px-3 py-1 text-[var(--muted)]">
                Pico: {peakIncHora ? `${peakIncHora.hora}h · ${fmtInt.format(n(peakIncHora.incidentes))}` : "--"}
              </span>
            </div>
            <div className="chart-block h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={incidentesHora} margin={{ top: 8, left: 0, right: 16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="turnosIncHour" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#fb7185" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#fb7185" stopOpacity={0.08} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 8" stroke="#e2e8f0" />
                  <XAxis dataKey="hora" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={meanIncHora} stroke="#94a3b8" strokeDasharray="6 6" />
                  <Area type="monotone" dataKey="incidentes" name="Incidentes" stroke="#f43f5e" fill="url(#turnosIncHour)" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>
      </section>
    </div>
  );
}
