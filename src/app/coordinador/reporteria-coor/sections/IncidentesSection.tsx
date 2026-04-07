"use client";

import React from "react";
import type { DayIncidents, HourIncidents, Kpis } from "../lib/types";
import { fmtDec, fmtInt, fmtMaybeInt, fmtMaybePct, hasArray, hasNumber, n } from "../lib/utils";
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

export default function IncidentesSection({
  kpis,
  incidentesHora,
  incidentesDia,
  meanIncHora,
  meanIncDia,
  peakIncHora,
  peakIncDia,
}: {
  kpis: Kpis;
  incidentesHora: HourIncidents[];
  incidentesDia: DayIncidents[];
  meanIncHora: number;
  meanIncDia: number;
  peakIncHora: HourIncidents | null;
  peakIncDia: DayIncidents | null;
}) {
  const cards = [
    hasNumber(kpis.totalIncidentes) ? { key: "inc", label: "Incidentes", value: fmtMaybeInt(kpis.totalIncidentes), accent: "rose" } : null,
    hasNumber(kpis.movimientosConIncidente)
      ? { key: "movInc", label: "Mov. con incidente", value: `${fmtMaybeInt(kpis.movimientosConIncidente)} · ${fmtMaybePct(kpis.movimientosConIncidentePct)}`, accent: "amber" }
      : null,
    hasNumber(kpis.cancelados) ? { key: "cancelados", label: "Cancelados", value: fmtMaybeInt(kpis.cancelados), accent: "amber" } : null,
    hasNumber(kpis.canceladosConIncidente)
      ? { key: "canceladosInc", label: "Cancelados con incidente", value: fmtMaybeInt(kpis.canceladosConIncidente), accent: "rose" }
      : null,
  ].filter(Boolean) as Array<{ key: string; label: string; value: string; accent: any }>;

  return (
    <div className="space-y-6">
      {cards.length ? (
        <section className="grid grid-cols-12 gap-4">
          {cards.map((c) => (
            <div key={c.key} className="col-span-12 md:col-span-6 xl:col-span-3">
              <KpiCard title={c.label} value={c.value} accent={c.accent} />
            </div>
          ))}
        </section>
      ) : null}

      {hasArray(incidentesHora) || hasArray(incidentesDia) ? (
        <section className="grid grid-cols-12 gap-4">
          {hasArray(incidentesHora) && (
            <div className="col-span-12 xl:col-span-6">
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
                        <linearGradient id="coorIncHour" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#fb7185" stopOpacity={0.5} />
                          <stop offset="100%" stopColor="#fb7185" stopOpacity={0.08} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="4 8" stroke="#e2e8f0" />
                      <XAxis dataKey="hora" tickLine={false} axisLine={false} />
                      <YAxis tickLine={false} axisLine={false} />
                      <Tooltip />
                      <ReferenceLine y={meanIncHora} stroke="#94a3b8" strokeDasharray="6 6" />
                      <Area type="monotone" dataKey="incidentes" name="Incidentes" stroke="#f43f5e" fill="url(#coorIncHour)" strokeWidth={3} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>
            </div>
          )}
          {hasArray(incidentesDia) && (
            <div className="col-span-12 xl:col-span-6">
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
                    <ComposedChart data={incidentesDia} barGap={8} margin={{ top: 18, left: 0, right: 16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="4 8" stroke="#e2e8f0" />
                      <XAxis dataKey="dia" tickLine={false} axisLine={false} />
                      <YAxis tickLine={false} axisLine={false} />
                      <Tooltip />
                      <ReferenceLine y={meanIncDia} stroke="#94a3b8" strokeDasharray="6 6" />
                      <Bar dataKey="incidentes" name="Incidentes" fill="#f59e0b" radius={6} />
                      <Line type="monotone" dataKey="incidentes" name="Tendencia" stroke="#92400e" strokeWidth={2} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
