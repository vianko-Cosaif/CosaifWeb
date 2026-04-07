"use client";

import React from "react";
import type { HourBucket, Kpis } from "../lib/types";
import { fmtDec, fmtInt, fmtMaybeInt, fmtMaybePct, hasArray, hasNumber, n } from "../lib/utils";
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
import ChartCard from "../components/ChartCard";
import KpiCard from "../components/KpiCard";

export default function OverviewSection({
  kpis,
  totalMov,
  movimientosHora,
  meanHora,
  peakHora,
}: {
  kpis: Kpis;
  totalMov: number;
  movimientosHora: HourBucket[];
  meanHora: number;
  peakHora: HourBucket | null;
}) {
  const cards = [
    { key: "totalMovimientos", label: "Total movimientos", value: fmtMaybeInt(totalMov), accent: "indigo" },
    hasNumber(kpis.totalConFin)
      ? { key: "conFin", label: "Con fin", value: fmtMaybeInt(kpis.totalConFin), accent: "emerald" }
      : null,
    hasNumber(kpis.totalSinFin) ? { key: "sinFin", label: "Sin fin", value: fmtMaybeInt(kpis.totalSinFin), accent: "rose" } : null,
    hasNumber(kpis.totalIncidentes)
      ? { key: "incidentes", label: "Incidentes", value: fmtMaybeInt(kpis.totalIncidentes), accent: "amber" }
      : null,
    hasNumber(kpis.movimientosConIncidente)
      ? {
          key: "movInc",
          label: "Mov. con incidente",
          value: `${fmtMaybeInt(kpis.movimientosConIncidente)} · ${fmtMaybePct(kpis.movimientosConIncidentePct)}`,
          accent: "rose",
        }
      : null,
    hasNumber(kpis.cancelados) ? { key: "cancelados", label: "Cancelados", value: fmtMaybeInt(kpis.cancelados), accent: "amber" } : null,
    hasNumber(kpis.canceladosConIncidente)
      ? { key: "canceladosInc", label: "Cancelados con incidente", value: fmtMaybeInt(kpis.canceladosConIncidente), accent: "rose" }
      : null,
  ].filter(Boolean) as Array<{ key: string; label: string; value: string; accent: any }>;

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-12 gap-4">
        {cards.map((c) => (
          <div key={c.key} className="col-span-12 md:col-span-4 xl:col-span-3">
            <KpiCard title={c.label} value={c.value} accent={c.accent} />
          </div>
        ))}
      </section>

      {hasArray(movimientosHora) ? (
        <section className="grid grid-cols-12 gap-4">
          <div className="col-span-12">
            <ChartCard title="Movimientos por hora" subtitle="Distribución diaria por hora" accent="sky">
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
                      <linearGradient id="coorHourArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.45} />
                        <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.08} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 8" stroke="#e2e8f0" />
                    <XAxis dataKey="hora" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} />
                    <Tooltip />
                    <ReferenceLine y={meanHora} stroke="#94a3b8" strokeDasharray="6 6" />
                    <Area type="monotone" dataKey="movimientos" stroke="#0ea5e9" fill="url(#coorHourArea)" strokeWidth={3} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          </div>
        </section>
      ) : null}
    </div>
  );
}
