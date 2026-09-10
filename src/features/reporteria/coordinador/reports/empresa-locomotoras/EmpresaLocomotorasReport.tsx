"use client";

import React, { useMemo, useState } from "react";
import { FileDown, FileSpreadsheet, RefreshCw, Train } from "lucide-react";
import ChartCard from "../../components/ChartCard";
import KpiCard from "../../components/KpiCard";
import { fmtMaybeInt, hasArray, n } from "../../lib/utils";
import ModuleHeader from "@/components/ui/ModuleHeader";
import { useEmpresaLocomotorasReport } from "./useEmpresaLocomotorasReport";
import type { Locomotora, Movimiento } from "./types";

type TabKey = "resumen" | "movimientos" | "jesus";

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
    <section className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 sm:p-5 shadow-sm">
      <div className="text-sm font-semibold text-[var(--app-text)]">Concentrado de locomotoras</div>
      <div className="mt-4 w-full overflow-auto rounded-2xl border border-[var(--app-border)]">
        <table className="min-w-[900px] w-full text-sm">
          <thead className="bg-[var(--app-surface-subtle)]">
            <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-[var(--app-text-muted)]">
              <th className="px-4 py-3">Locomotora</th>
              <th className="px-4 py-3">Movimientos</th>
              <th className="px-4 py-3">Estados</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={`${row.locomotiveNumber}-${idx}`} className="border-t border-[var(--app-border)]">
                <td className="px-4 py-3 font-semibold text-[var(--app-text)]">{row.locomotiveNumber}</td>
                <td className="px-4 py-3 text-[var(--app-text)]">{fmtMaybeInt(row.totalMovimientos)}</td>
                <td className="px-4 py-3 text-[var(--app-text-muted)]">{estadosText(row.estados)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MovimientosTable({ rows, title = "Movimientos" }: { rows: Movimiento[]; title?: string }) {
  if (!hasArray(rows)) return null;
  return (
    <section className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 sm:p-5 shadow-sm">
      <div className="text-sm font-semibold text-[var(--app-text)]">{title}</div>
      <div className="mt-4 w-full overflow-auto rounded-2xl border border-[var(--app-border)]">
        <table className="min-w-[1320px] w-full text-sm">
          <thead className="bg-[var(--app-surface-subtle)]">
            <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-[var(--app-text-muted)]">
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Locomotora</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Solicitud</th>
              <th className="px-4 py-3">Inicio</th>
              <th className="px-4 py-3">Fin</th>
              <th className="px-4 py-3">Solicitado por</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Descripción</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-[var(--app-border)]">
                <td className="px-4 py-3 font-semibold text-[var(--app-text)]">{row.id}</td>
                <td className="px-4 py-3 text-[var(--app-text)]">{row.locomotiveNumber ?? "—"}</td>
                <td className="px-4 py-3 text-[var(--app-text)]">{row.estado ?? "—"}</td>
                <td className="px-4 py-3 text-[var(--app-text)]">{row.fechaSolicitudMX ?? "—"}</td>
                <td className="px-4 py-3 text-[var(--app-text)]">{row.fechaInicioMX ?? "—"}</td>
                <td className="px-4 py-3 text-[var(--app-text)]">{row.fechaFinMX ?? "—"}</td>
                <td className="px-4 py-3 text-[var(--app-text)]">{row.solicitadoPor ?? "—"}</td>
                <td className="px-4 py-3 text-[var(--app-text)]">{row.cliente ?? "—"}</td>
                <td className="px-4 py-3 text-[var(--app-text-muted)]">{row.descripcion ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function EmpresaLocomotorasReport({ localidadId }: { localidadId: number }) {
  const report = useEmpresaLocomotorasReport(localidadId);
  const [tab, setTab] = useState<TabKey>("resumen");

  const resumenCards = useMemo(() => {
    const totalMov = report.resumen?.totalMovimientos;
    const totalLocos = report.resumen?.totalLocomotoras;
    const totalUsuario = report.resumen?.totalUsuarioCliente;
    const usuario = report.resumen?.usuarioCliente ?? report.usuarioObjetivo;
    return [
      { title: "Total movimientos", value: fmtMaybeInt(totalMov), accent: "indigo" as const },
      { title: "Total locomotoras", value: fmtMaybeInt(totalLocos), accent: "emerald" as const },
      { title: usuario, value: fmtMaybeInt(totalUsuario), accent: "amber" as const },
    ];
  }, [report.resumen, report.usuarioObjetivo]);

  return (
    <div className="space-y-6">
      <ModuleHeader title={report.empresaNombre || "Alstom"} subtitle="Concentrado de locomotoras y movimientos detallados." eyebrow="Empresa y locomotoras" actions={<>
          <button
            type="button"
            onClick={report.fetchReport}
            disabled={report.loading}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-2 text-sm font-semibold text-[var(--app-text)] shadow-sm transition hover:border-[var(--app-border-strong)] hover:text-[var(--app-text)] disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${report.loading ? "animate-spin" : ""}`} />
            {report.loading ? "Actualizando" : "Actualizar"}
          </button>
          <button
            type="button"
            onClick={report.exportPdf}
            disabled={report.pdfBusy || report.loading || !report.fetchedAt}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--app-accent)] px-4 py-2 text-sm font-semibold text-[var(--app-accent-contrast)] shadow-md transition hover:opacity-90 disabled:opacity-60"
          >
            <FileDown className="h-4 w-4" />
            {report.pdfBusy ? "Descargando…" : "Descargar PDF"}
          </button>
          <button
            type="button"
            onClick={report.exportExcel}
            disabled={report.excelBusy || report.loading || !report.fetchedAt}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-emerald-700 disabled:opacity-60"
          >
            <FileSpreadsheet className="h-4 w-4" />
            {report.excelBusy ? "Descargando…" : "Descargar Excel"}
          </button>
      </>} />

      {report.error ? (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
          {report.error}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 sm:p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--app-text-muted)]">Empresa</p>
            <div className="mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--app-surface-muted)] px-3 py-2 text-sm font-semibold text-[var(--app-text)]">
              <Train className="h-4 w-4" />
              {report.empresaNombre}
            </div>
          </div>
          <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 sm:p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--app-text-muted)]">Rango</p>
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[var(--app-surface-muted)] p-1">
                {(["mes", "fechas"] as const).map((modo) => (
                  <button
                    key={modo}
                    type="button"
                    onClick={() => report.setModoRango(modo)}
                    className={`rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] ${
                      report.modoRango === modo ? "bg-[var(--app-text)] text-[var(--app-surface)] shadow-sm" : "text-[var(--app-text-muted)]"
                    }`}
                  >
                    {modo === "mes" ? "Mes" : "Fechas"}
                  </button>
                ))}
              </div>

              {report.modoRango === "mes" ? (
                <input
                  className="w-full rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm"
                  type="month"
                  value={report.mesYM}
                  onChange={(e) => report.setMesYM(e.target.value)}
                />
              ) : (
                <>
                  <input
                    className="w-full rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm"
                    type="date"
                    aria-label="Fecha inicial"
                    max={report.hasta}
                    value={report.desde}
                    onChange={(e) => report.setDesde(e.target.value)}
                  />
                  <input
                    className="w-full rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm"
                    type="date"
                    aria-label="Fecha final"
                    min={report.desde}
                    value={report.hasta}
                    onChange={(e) => report.setHasta(e.target.value)}
                  />
                </>
              )}

              <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-3 py-2 text-xs font-semibold text-[var(--app-text-muted)]">
                {report.desde} 00:00 → {report.hasta} 23:59
              </div>
            </div>
          </div>
        </aside>

        <div className="space-y-6 min-w-0">
          <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-sm">
            <div className="flex flex-wrap gap-2">
              {(["resumen", "movimientos", "jesus"] as TabKey[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={tab === k}
                  onClick={() => setTab(k)}
                  className={`rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                    tab === k ? "bg-[var(--app-text)] text-[var(--app-surface)]" : "bg-[var(--app-surface-muted)] text-[var(--app-text-muted)]"
                  }`}
                >
                  {k === "resumen" ? "Resumen" : k === "jesus" ? report.usuarioObjetivo : "Movimientos"}
                </button>
              ))}
            </div>
          </div>

          {report.loading && !report.fetchedAt ? <p role="status" className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 sm:p-5 text-sm text-[var(--app-text-muted)]">Cargando los datos del periodo seleccionado…</p> : null}

          {report.fetchedAt && tab === "resumen" && (
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

          {report.fetchedAt && tab === "movimientos" && <MovimientosTable rows={report.movimientos} />}

          {report.fetchedAt && tab === "jesus" && (
            <div className="space-y-4">
              <section className="flex flex-col gap-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 sm:p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-[var(--app-text)]">
                    {report.resumen?.usuarioCliente ?? report.usuarioObjetivo}
                  </div>
                  <div className="mt-1 text-xs text-[var(--app-text-muted)]">
                    {fmtMaybeInt(report.resumen?.totalUsuarioCliente)} movimientos en el rango
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={report.exportUsuarioPdf}
                    disabled={report.pdfUsuarioBusy || report.loading || !report.fetchedAt}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--app-accent)] px-4 py-2 text-sm font-semibold text-[var(--app-accent-contrast)] shadow-sm transition hover:opacity-90 disabled:opacity-60"
                  >
                    <FileDown className="h-4 w-4" />
                    {report.pdfUsuarioBusy ? "Descargando..." : "PDF Jesus"}
                  </button>
                  <button
                    type="button"
                    onClick={report.exportUsuarioExcel}
                    disabled={report.excelUsuarioBusy || report.loading || !report.fetchedAt}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    {report.excelUsuarioBusy ? "Descargando..." : "Excel Jesus"}
                  </button>
                </div>
              </section>
              <MovimientosTable
                title={`Movimientos generados por ${report.resumen?.usuarioCliente ?? report.usuarioObjetivo}`}
                rows={report.movimientosUsuarioCliente}
              />
            </div>
          )}

          <div className="text-xs text-[var(--app-text-muted)]">
            {report.fetchedAt ? `Actualizado: ${report.fetchedAt.toLocaleString("es-MX")}` : "Sin carga inicial"}
          </div>
        </div>
      </div>
    </div>
  );
}
