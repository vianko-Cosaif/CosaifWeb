"use client";

import React from "react";
import { BarChart3, Loader2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// Los reportes vienen de distintos endpoints con formas distintas.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ReportRecord = Record<string, any>;
export type ReportColumnDef = [
  label: string,
  render: (row: ReportRecord) => React.ReactNode,
  align?: "right" | "wide",
];

const CHART_COLORS = ["#0f766e", "#2563eb", "#7c3aed", "#ea580c", "#dc2626", "#0891b2"];

function n(value: unknown) {
  const x = Number(value);
  return Number.isFinite(x) ? x : 0;
}

function fmt(value: unknown) {
  return n(value).toLocaleString("es-MX");
}

export function sumBy(rows: ReportRecord[], key: string) {
  return rows.reduce((acc, row) => acc + n(row?.[key]), 0);
}

export function avgPct(rows: ReportRecord[], key: string) {
  if (!rows.length) return 0;
  return Math.round(rows.reduce((acc, row) => acc + n(row?.[key]), 0) / rows.length);
}

export function MetricGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2 sm:gap-3 xl:grid-cols-4">
      {children}
    </div>
  );
}

export function Kpi({
  icon: Icon,
  label,
  value,
  sub,
  compact,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={`min-w-0 rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-4 ${
        compact ? "" : "min-h-[84px] sm:min-h-[104px]"
      }`}
    >
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 sm:gap-2 sm:text-xs sm:tracking-[0.2em]">
        <Icon className="h-4 w-4" />
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-2 break-words text-2xl font-black leading-tight text-slate-950 dark:text-white sm:mt-3 sm:text-2xl">
        {value}
      </div>
      {sub ? (
        <div className="mt-1 truncate text-xs font-medium text-slate-500 dark:text-slate-400">
          {sub}
        </div>
      ) : null}
    </div>
  );
}

export function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-4">
      <h2 className="mb-3 text-sm font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function ChartPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-4">
      <h2 className="mb-3 text-xs font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400 sm:text-sm sm:tracking-[0.18em]">
        {title}
      </h2>
      <div className="h-[250px] min-w-0 sm:h-[300px]">{children}</div>
    </section>
  );
}

export function BarChartBox({
  data,
  xKey,
  yKey,
  fill,
  prefixX = "",
}: {
  data: ReportRecord[];
  xKey: string;
  yKey: string;
  fill: string;
  prefixX?: string;
}) {
  if (!data.length) return <NoData />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 28 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey={xKey}
          tick={{ fontSize: 11, fill: "#64748b" }}
          angle={-25}
          textAnchor="end"
          height={54}
          tickFormatter={(value) => `${prefixX}${String(value).slice(0, 16)}`}
        />
        <YAxis tick={{ fontSize: 11, fill: "#64748b" }} allowDecimals={false} />
        <Tooltip cursor={{ fill: "rgba(15,23,42,0.05)" }} />
        <Bar dataKey={yKey} fill={fill} radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function LineChartBox({
  data,
  xKey,
  yKey,
  stroke,
}: {
  data: ReportRecord[];
  xKey: string;
  yKey: string;
  stroke: string;
}) {
  if (!data.length) return <NoData />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 18 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: "#64748b" }} />
        <YAxis tick={{ fontSize: 11, fill: "#64748b" }} allowDecimals={false} />
        <Tooltip />
        <Line
          type="monotone"
          dataKey={yKey}
          stroke={stroke}
          strokeWidth={3}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function PieChartBox({ data }: { data: Array<{ name: string; value: number }> }) {
  const clean = data.filter((item) => item.value > 0);
  if (!clean.length) return <NoData />;
  return (
    <div className="grid min-h-[260px] grid-cols-1 items-center gap-3 sm:grid-cols-[1fr_auto]">
      <div className="h-[220px] min-w-0 sm:h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={clean} dataKey="value" nameKey="name" innerRadius={52} outerRadius={86} paddingAngle={3}>
              {clean.map((_, index) => (
                <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs sm:block sm:space-y-2">
        {clean.map((item, index) => (
          <div key={item.name} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
            />
            <span className="font-semibold text-slate-600 dark:text-slate-300">{item.name}</span>
            <span className="font-bold text-slate-950 dark:text-white">{fmt(item.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SimpleTable({
  rows,
  columns,
}: {
  rows: ReportRecord[];
  columns: ReportColumnDef[];
}) {
  return (
    <div className="min-w-0">
      <div className="space-y-2 md:hidden">
        {rows.length ? (
          rows.map((row, index) => (
            <div
              key={String(row.id ?? row.viaId ?? row.usuarioId ?? row.locomotiveNumber ?? index)}
              className="rounded-lg border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/40"
            >
              {columns.map(([label, render, align]) => (
                <div
                  key={label}
                  className="flex items-start justify-between gap-3 border-b border-slate-100 py-1.5 last:border-0 dark:border-slate-800"
                >
                  <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                    {label}
                  </span>
                  <span
                    className={`min-w-0 text-right text-sm text-slate-700 dark:text-slate-200 ${
                      align === "right" ? "font-mono tabular-nums" : ""
                    } ${align === "wide" ? "max-w-[65%] break-words text-xs" : "truncate"}`}
                  >
                    {render(row)}
                  </span>
                </div>
              ))}
            </div>
          ))
        ) : (
          <div className="rounded-lg border border-dashed border-slate-200 px-3 py-8 text-center text-sm text-slate-400 dark:border-slate-800">
            Sin datos para este periodo.
          </div>
        )}
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[680px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800">
              {columns.map(([label, , align]) => (
                <th
                  key={label}
                  className={`px-3 py-2 text-left text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 ${
                    align === "right" ? "text-right" : ""
                  } ${align === "wide" ? "min-w-[220px]" : ""}`}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row, index) => (
                <tr
                  key={String(row.id ?? row.viaId ?? row.usuarioId ?? row.locomotiveNumber ?? index)}
                  className="border-b border-slate-100 last:border-0 dark:border-slate-900"
                >
                  {columns.map(([label, render, align]) => (
                    <td
                      key={label}
                      className={`px-3 py-2 text-slate-700 dark:text-slate-200 ${
                        align === "right" ? "text-right font-mono tabular-nums" : ""
                      } ${align === "wide" ? "min-w-[220px] text-xs" : ""}`}
                    >
                      {render(row)}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="px-3 py-8 text-center text-sm text-slate-400">
                  Sin datos para este periodo.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function LoadingState() {
  return (
    <div className="grid min-h-[360px] place-items-center rounded-lg border border-slate-200 bg-white/80 dark:border-slate-800 dark:bg-slate-950/70">
      <div className="flex items-center gap-3 text-sm font-semibold text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" />
        Cargando reporte
      </div>
    </div>
  );
}

export function EmptyState() {
  return (
    <div className="grid min-h-[360px] place-items-center rounded-lg border border-slate-200 bg-white/80 p-8 text-center dark:border-slate-800 dark:bg-slate-950/70">
      <div className="max-w-sm space-y-2">
        <BarChart3 className="mx-auto h-8 w-8 text-slate-400" />
        <h2 className="text-base font-black text-slate-900 dark:text-white">Sin reporte cargado</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Ajusta el periodo o actualiza la consulta.
        </p>
      </div>
    </div>
  );
}

export function NoData() {
  return (
    <div className="grid h-full place-items-center rounded-lg bg-slate-50 text-sm font-medium text-slate-400 dark:bg-slate-900/50">
      Sin datos
    </div>
  );
}
