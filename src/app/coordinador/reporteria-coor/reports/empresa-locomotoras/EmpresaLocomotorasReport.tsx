"use client";

import React, { useMemo, useState } from "react";
import { FileDown, RefreshCw, Train } from "lucide-react";
import ChartCard from "../../components/ChartCard";
import KpiCard from "../../components/KpiCard";
import { fmtMaybeInt, hasArray, n } from "../../lib/utils";
import { useEmpresaLocomotorasReport } from "./useEmpresaLocomotorasReport";
import type { Locomotora, Movimiento } from "./types";

type TabKey = "resumen" | "movimientos";

function EstadosChart({ estados }: { estados: Record<string, number> }) {
  const data = Object.entries(estados ?? {}).map(([estado, total]) => ({ estado, total: n(total) }));
  if (!data.length) return null;
  return (
    <ChartCard title="Estados generales" subtitle="Distribución operativa" accent="indigo">
      <div className="h-64">
        <svg width="100%" height="100%" viewBox="0 0 600 240" preserveAspectRatio="none">
          {data.map((d, idx) => {
            const barWidth = 600 / data.length;
            const barHeight = Math.max(6, (d.total / Math.max(1, Math.max(...data.map((i) => i.total)))) * 200);
            const x = idx * barWidth + 12;
            const y = 220 - barHeight;
            return (
              <g key={d.estado}>
                <rect x={x} y={y} width={barWidth - 24} height={barHeight} rx="6" fill="#6366f1" opacity="0.85" />
                <text x={x + (barWidth - 24) / 2} y={230} textAnchor="middle" fontSize="10" fill="#64748b">
                  {d.estado}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </ChartCard>
  );
}

function LocomotorasTable({ rows }: { rows: Locomotora[] }) {
  if (!hasArray(rows)) return null;
  const estadosText = (estados?: Record<string, number>) =>
    estados
      ? Object.entries(estados)
          .filter(([, v]) => n(v) > 0)
          .map(([k, v]) => `${k}: ${v}`)
          .join(" · ")
      : "—";

  return (
    <section className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
      <div className="text-sm font-semibold text-slate-900">Concentrado de locomotoras</div>
      <div className="mt-4 w-full overflow-auto rounded-2xl border border-slate-200">
        <table className="min-w-[900px] w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-slate-400">
              <th className="px-4 py-3">Locomotora</th>
              <th className="px-4 py-3">Movimientos</th>
              <th className="px-4 py-3">Estados</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={`${row.locomotiveNumber}-${idx}`} className="border-t border-slate-200">
                <td className="px-4 py-3 font-semibold text-slate-900">{row.locomotiveNumber}</td>
                <td className="px-4 py-3 text-slate-700">{fmtMaybeInt(row.totalMovimientos)}</td>
                <td className="px-4 py-3 text-slate-500">{estadosText(row.estados)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MovimientosTable({ rows }: { rows: Movimiento[] }) {
  if (!hasArray(rows)) return null;
  return (
    <section className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
      <div className="text-sm font-semibold text-slate-900">Movimientos</div>
      <div className="mt-4 w-full overflow-auto rounded-2xl border border-slate-200">
        <table className="min-w-[1100px] w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-slate-400">
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Locomotora</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Solicitud</th>
              <th className="px-4 py-3">Inicio</th>
              <th className="px-4 py-3">Fin</th>
              <th className="px-4 py-3">Descripción</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-slate-200">
                <td className="px-4 py-3 font-semibold text-slate-900">{row.id}</td>
                <td className="px-4 py-3 text-slate-700">{row.locomotiveNumber ?? "—"}</td>
                <td className="px-4 py-3 text-slate-700">{row.estado ?? "—"}</td>
                <td className="px-4 py-3 text-slate-700">{row.fechaSolicitudMX ?? "—"}</td>
                <td className="px-4 py-3 text-slate-700">{row.fechaInicioMX ?? "—"}</td>
                <td className="px-4 py-3 text-slate-700">{row.fechaFinMX ?? "—"}</td>
                <td className="px-4 py-3 text-slate-500">{row.descripcion ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function EmpresaLocomotorasReport() {
  const report = useEmpresaLocomotorasReport();
  const [tab, setTab] = useState<TabKey>("resumen");

  const resumenCards = useMemo(() => {
    const totalMov = report.resumen?.totalMovimientos;
    const totalLocos = report.resumen?.totalLocomotoras;
    return [
      { title: "Total movimientos", value: fmtMaybeInt(totalMov), accent: "indigo" as const },
      { title: "Total locomotoras", value: fmtMaybeInt(totalLocos), accent: "emerald" as const },
    ];
  }, [report.resumen]);

  return (
    <div className="space-y-6">
      <header className="flex w-full flex-col gap-4 rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-sm backdrop-blur lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">Empresa locomotoras</p>
          <h2 className="text-2xl font-black text-slate-900 sm:text-3xl">{report.empresaNombre || "Alstom"}</h2>
          <p className="text-sm text-slate-500">Concentrado de locomotoras y movimientos detallados.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={report.fetchReport}
            disabled={report.loading}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${report.loading ? "animate-spin" : ""}`} />
            {report.loading ? "Actualizando" : "Actualizar"}
          </button>
          <button
            type="button"
            onClick={report.exportPdf}
            disabled={report.pdfBusy}
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-slate-800 disabled:opacity-60"
          >
            <FileDown className="h-4 w-4" />
            {report.pdfBusy ? "Descargando…" : "Descargar PDF"}
          </button>
        </div>
      </header>

      {report.error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {report.error}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Empresa</p>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
              <Train className="h-4 w-4" />
              {report.empresaNombre}
            </div>
          </div>
          <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Rango</p>
            <div className="mt-4 space-y-3">
              <input
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                type="date"
                value={report.desde}
                onChange={(e) => report.setDesde(e.target.value)}
              />
              <input
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                type="date"
                value={report.hasta}
                onChange={(e) => report.setHasta(e.target.value)}
              />
            </div>
          </div>
        </aside>

        <main className="space-y-6 min-w-0">
          <div className="rounded-3xl border border-slate-200/70 bg-white/90 p-4 shadow-sm">
            <div className="flex flex-wrap gap-2">
              {(["resumen", "movimientos"] as TabKey[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setTab(k)}
                  className={`rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                    tab === k ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {k === "resumen" ? "Resumen" : "Movimientos"}
                </button>
              ))}
            </div>
          </div>

          {tab === "resumen" && (
            <div className="space-y-6">
              <section className="grid grid-cols-12 gap-4">
                {resumenCards.map((c) => (
                  <div key={c.title} className="col-span-12 md:col-span-6">
                    <KpiCard title={c.title} value={c.value} accent={c.accent} />
                  </div>
                ))}
              </section>
              <EstadosChart estados={report.resumen?.estadosGeneral ?? {}} />
              <LocomotorasTable rows={report.locomotoras} />
            </div>
          )}

          {tab === "movimientos" && <MovimientosTable rows={report.movimientos} />}

          <div className="text-xs text-slate-400">
            {report.fetchedAt ? `Actualizado: ${report.fetchedAt.toLocaleString("es-MX")}` : "Sin carga inicial"}
          </div>
        </main>
      </div>
    </div>
  );
}
