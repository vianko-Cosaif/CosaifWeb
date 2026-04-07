import React from "react";
import type {
  DayIncidents,
  HourIncidents,
  Kpis,
  RankingEmpresa,
  TopCritico,
  TopIncidente,
  TopLocoIncidentes,
} from "../lib/types";
import { fmtDec, fmtInt, n, fmtMaybeInt, fmtMaybePct, fmtMinutes } from "../lib/utils";
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
import ChartCard from "../components/ChartCard";
import KpiCard from "../components/KpiCard";
import CustomTooltip from "../components/CustomTooltip";
import SectionTitle from "../components/SectionTitle";
import ConfigurableTable from "../components/ConfigurableTable";
import Bar3DShape from "../components/Bar3DShape";

const estadoColors = ["#f97316", "#0ea5e9", "#ef4444", "#22c55e", "#a855f7", "#facc15"];

export default function IncidentesSection({
  kpis,
  incidentesHora,
  incidentesDia,
  incidentesEstado,
  meanIncHora,
  meanIncDia,
  peakIncHora,
  peakIncDia,
  topLocos,
  rankingEmpresas,
  topIncidentes,
  topCriticos,
}: {
  kpis: Kpis;
  incidentesHora: HourIncidents[];
  incidentesDia: DayIncidents[];
  incidentesEstado: Array<{ estado: string; total: number }>;
  meanIncHora: number;
  meanIncDia: number;
  peakIncHora: HourIncidents | null;
  peakIncDia: DayIncidents | null;
  topLocos: TopLocoIncidentes[];
  rankingEmpresas: RankingEmpresa[];
  topIncidentes: TopIncidente[];
  topCriticos: TopCritico[];
}) {
  const barMarginTop = 18;
  return (
    <div className="space-y-6">
      <SectionTitle title="Incidentes" subtitle="Severidad, patrones y activos criticos" />
      <section className="grid grid-cols-12 gap-4">
        <div className="col-span-12 md:col-span-6 xl:col-span-3">
          <KpiCard title="Incidentes" value={fmtMaybeInt(kpis.totalIncidentes)} accent="rose" />
        </div>
        <div className="col-span-12 md:col-span-6 xl:col-span-3">
          <KpiCard
            title="Mov. con incidente"
            value={fmtMaybeInt(kpis.movimientosConIncidente)}
            accent="amber"
            progress={n(kpis.movimientosConIncidentePct)}
            progressLabel="Impacto"
          />
        </div>
        <div className="col-span-12 md:col-span-6 xl:col-span-3">
          <KpiCard title="Criticos < 2 min" value={fmtMaybeInt(kpis.criticosLt2)} accent="emerald" />
        </div>
        <div className="col-span-12 md:col-span-6 xl:col-span-3">
          <KpiCard title="Criticos ≥ 90 min" value={fmtMaybeInt(kpis.criticosGte90)} accent="rose" />
        </div>
        <div className="col-span-12 md:col-span-6 xl:col-span-3">
          <KpiCard title="Criticos total" value={fmtMaybeInt(kpis.criticosTotal)} accent="amber" />
        </div>
        <div className="col-span-12 md:col-span-6 xl:col-span-3">
          <KpiCard title="Locos crit. <2" value={fmtMaybeInt(kpis.locomotorasCritLt2)} accent="emerald" />
        </div>
        <div className="col-span-12 md:col-span-6 xl:col-span-3">
          <KpiCard title="Locos crit. ≥90" value={fmtMaybeInt(kpis.locomotorasCritGte90)} accent="rose" />
        </div>
        <div className="col-span-12 md:col-span-6 xl:col-span-3">
          <KpiCard title="Indice operativo" value={fmtMaybeInt(kpis.indiceOperativo)} accent="sky" />
        </div>
      </section>

      <section className="grid grid-cols-12 gap-4">
        <div className="col-span-12 xl:col-span-4">
        <ChartCard title="Incidentes por hora" subtitle="Distribucion por hora" accent="rose">
          <div className="mb-3 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
            <span className="rounded-full border border-[var(--stroke)] bg-[var(--panel)] px-3 py-1 text-[var(--muted)]">
              Media: {fmtDec.format(meanIncHora)}
            </span>
            <span className="rounded-full border border-[var(--stroke)] bg-[var(--panel)] px-3 py-1 text-[var(--muted)]">
              Pico: {peakIncHora ? `${peakIncHora.hora}h · ${fmtInt.format(n(peakIncHora.incidentes))}` : "--"}
            </span>
          </div>
          <div className="chart-block h-60">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={incidentesHora} margin={{ top: 8, left: 0, right: 16, bottom: 0 }}>
                <defs>
                  <linearGradient id="incHourArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fb7185" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#fb7185" stopOpacity={0.08} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 8" stroke="#e2e8f0" />
                <XAxis dataKey="hora" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={meanIncHora} stroke="#94a3b8" strokeDasharray="6 6" />
                <Area type="monotone" dataKey="incidentes" name="Incidentes" stroke="#f43f5e" fill="url(#incHourArea)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
        </div>
        <div className="col-span-12 xl:col-span-4">
        <ChartCard title="Incidentes por dia" subtitle="Semana" accent="amber">
          <div className="mb-3 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
            <span className="rounded-full border border-[var(--stroke)] bg-[var(--panel)] px-3 py-1 text-[var(--muted)]">
              Media: {fmtDec.format(meanIncDia)}
            </span>
            <span className="rounded-full border border-[var(--stroke)] bg-[var(--panel)] px-3 py-1 text-[var(--muted)]">
              Pico: {peakIncDia ? `${peakIncDia.dia} · ${fmtInt.format(n(peakIncDia.incidentes))}` : "--"}
            </span>
          </div>
          <div className="chart-block h-60">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={incidentesDia} barGap={8} margin={{ top: barMarginTop, left: 0, right: 16, bottom: 0 }}>
                <defs>
                  <linearGradient id="incDayBar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.4} />
                  </linearGradient>
                </defs>
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
        <ChartCard title="Incidentes por estado" subtitle="Distribucion" accent="sky">
          {incidentesEstado.length === 0 ? (
            <div className="flex h-60 items-center justify-center text-sm text-[var(--muted)]">
              Sin datos para este periodo
            </div>
          ) : (
            <div className="chart-block h-60">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={incidentesEstado}
                    dataKey="total"
                    nameKey="estado"
                    innerRadius={45}
                    outerRadius={85}
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

      <section className="grid grid-cols-12 gap-4">
        <div className="col-span-12 xl:col-span-6">
        <ConfigurableTable
          title="Locomotoras con mas incidentes"
          subtitle="Top de incidentes por locomotora"
          data={topLocos}
          accent="rose"
          highlightKey="incidentesTotal"
          storageKey="reporteria:top-locos"
          defaultSortKey="incidentesTotal"
          columns={[
            { key: "locomotiveNumber", label: "Locomotora" },
            { key: "incidentesTotal", label: "Inc", format: (v) => fmtInt.format(n(v)) },
            { key: "movimientos", label: "Mov", format: (v) => fmtInt.format(n(v)) },
            { key: "empresas", label: "Empresas", format: (v) => (Array.isArray(v) ? v.join(", ") : "-") },
          ]}
        />
        </div>
        <div className="col-span-12 xl:col-span-6">
        <ConfigurableTable
          title="Empresas con incidentes"
          subtitle="Impacto por empresa"
          data={rankingEmpresas}
          accent="amber"
          highlightKey="incidentesTotal"
          storageKey="reporteria:empresas-inc"
          defaultSortKey="incidentesTotal"
          columns={[
            { key: "empresa", label: "Empresa" },
            { key: "totalMovimientos", label: "Mov", format: (v) => fmtInt.format(n(v)) },
            { key: "incidentesTotal", label: "Inc", format: (v) => fmtInt.format(n(v)) },
            { key: "incidentesPct", label: "% Inc", format: (v) => fmtMaybePct(v) },
          ]}
        />
        </div>
      </section>

      <section className="grid grid-cols-12 gap-4">
        <div className="col-span-12 xl:col-span-6">
        <ConfigurableTable
          title="Top incidentes"
          subtitle="Movimientos con mas incidentes"
          data={topIncidentes}
          accent="rose"
          highlightKey="incidentesCount"
          storageKey="reporteria:top-incidentes"
          defaultSortKey="incidentesCount"
          columns={[
            { key: "id", label: "ID" },
            { key: "empresa", label: "Empresa" },
            { key: "locomotiveNumber", label: "Locomotora" },
            { key: "incidentesCount", label: "Inc", format: (v) => fmtInt.format(n(v)) },
          ]}
        />
        </div>
        <div className="col-span-12 xl:col-span-6">
        <ConfigurableTable
          title="Top criticos"
          subtitle="Tiempos criticos y ejecucion"
          data={topCriticos}
          accent="amber"
          highlightKey="minSolicitudAFin"
          storageKey="reporteria:top-criticos"
          defaultSortKey="minSolicitudAFin"
          columns={[
            { key: "id", label: "ID" },
            { key: "empresa", label: "Empresa" },
            { key: "localidad", label: "Localidad" },
            { key: "estado", label: "Estado" },
            { key: "locomotiveNumber", label: "Locomotora" },
            { key: "tramoMX", label: "Tramo" },
            { key: "minSolicitudAInicio", label: "Min Sol-Start", format: (v) => fmtMinutes(v) },
            { key: "minInicioAFin", label: "Min Start-Fin", format: (v) => fmtMinutes(v) },
            { key: "minSolicitudAFin", label: "Min Sol-Fin", format: (v) => fmtMinutes(v) },
            { key: "incidentesCount", label: "Inc", format: (v) => fmtInt.format(n(v)) },
          ]}
        />
        </div>
      </section>
    </div>
  );
}
