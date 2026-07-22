"use client";

import { BarChart3, CircleCheckBig, CirclePause, MapPin, TrainFront, TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import CommercialPeriodBar from "../_components/CommercialPeriodBar";
import { LoadingPanel, MetricCard, ModuleHeader, Notice, Pagination, StateBadge } from "../_components/CommercialUi";
import { useCommercialData } from "../_components/CommercialDataProvider";
import { formatDate, formatNumber, humanize } from "../_lib/format";

export default function GeneralReportPage() {
  const { analytics, loading, error, setFilters } = useCommercialData();
  function changeLocality(localidadId: number, name: string) {
    setFilters({ localidadId, origin: isTorreon(name) ? undefined : "NATURAL" });
  }
  return <div className="space-y-5">
    <ModuleHeader eyebrow="Inteligencia comercial" title="Reporte general por periodo y localidad" description="Aquí se analiza volumen real. Semana, mes, bimestre, semestre o año; cada patio se presenta por separado y la operación sigue siendo de solo lectura." icon={BarChart3}/>
    <CommercialPeriodBar showOrigin/>
    {error ? <Notice tone="rose" title="No se pudo consultar la operación" text={error}/> : null}
    {loading && !analytics ? <LoadingPanel/> : null}
    {analytics ? <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard icon={TrainFront} label="Operaciones" value={formatNumber(analytics.kpis.operations)} detail={analytics.meta.periodLabel} tone="blue"/>
        <MetricCard icon={CircleCheckBig} label="Concluidas" value={formatNumber(analytics.kpis.completed)} detail={`${analytics.kpis.completedGrowthPct}% vs periodo anterior`} tone="emerald"/>
        <MetricCard icon={CirclePause} label="Detenidas" value={formatNumber(analytics.kpis.stopped)} detail={`${analytics.kpis.cancelled} canceladas`} tone="amber"/>
        <MetricCard icon={TrendingUp} label="Cambio de volumen" value={`${analytics.kpis.periodGrowthPct}%`} detail={`${formatNumber(analytics.kpis.previousPeriod)} en el periodo anterior`} tone={analytics.kpis.periodGrowthPct >= 0 ? "emerald" : "rose"}/>
        <MetricCard icon={MapPin} label="Servicios" value={`${formatNumber(analytics.kpis.wash)} / ${formatNumber(analytics.kpis.turning)}`} detail="Lavados / torneados" tone="slate"/>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.35fr_.65fr]">
        <article className="commercial-card p-5"><div><p className="commercial-label">Comportamiento dentro del periodo</p><h2 className="text-xl font-black text-[var(--app-text)]">Naturales, arrastre, lavado y torno</h2></div><div className="mt-4 h-[340px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={analytics.trend}><CartesianGrid strokeDasharray="3 3" opacity={.35}/><XAxis dataKey="label" tick={{ fontSize: 10 }}/><YAxis allowDecimals={false} tick={{ fontSize: 10 }}/><Tooltip contentStyle={{ borderRadius: 14 }}/><Legend/><Bar name="Naturales" dataKey="natural" stackId="volume" fill="#059669"/><Bar name="Arrastre" dataKey="arrastre" stackId="volume" fill="#2563eb"/><Bar name="Lavado" dataKey="wash" fill="#0891b2"/><Bar name="Torno" dataKey="turning" fill="#d97706"/></BarChart></ResponsiveContainer></div></article>
        <article className="commercial-card p-5"><p className="commercial-label">Separación obligatoria</p><h2 className="text-xl font-black text-[var(--app-text)]">Volumen por localidad</h2><div className="mt-4 space-y-3">{analytics.yards.map((yard) => <button key={yard.id} type="button" onClick={() => changeLocality(yard.id, yard.name)} className="w-full rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] p-4 text-left transition hover:border-emerald-400"><div className="flex items-center justify-between"><p className="font-black text-[var(--app-text)]">{yard.name}</p><p className="text-xl font-black text-[var(--app-text)]">{formatNumber(yard.total)}</p></div><div className="mt-3 grid grid-cols-4 gap-1 text-center text-[10px] font-black text-[var(--app-text-muted)]"><span>{yard.natural}<br/>Natural</span><span>{yard.arrastre}<br/>Arrastre</span><span>{yard.wash}<br/>Lavado</span><span>{yard.turning}<br/>Torno</span></div></button>)}{!analytics.yards.length ? <p className="py-10 text-center text-sm font-bold text-[var(--app-text-muted)]">Sin operación para este periodo.</p> : null}</div></article>
      </section>

      <section className="commercial-card overflow-hidden"><header className="border-b border-[var(--app-border)] p-5"><p className="commercial-label">Detalle auditable</p><h2 className="text-xl font-black text-[var(--app-text)]">Operaciones que forman el reporte</h2><p className="mt-1 text-sm text-[var(--app-text-muted)]">25 registros por página para mantener la lectura limpia.</p></header><div className="overflow-x-auto"><table className="w-full min-w-[1040px] text-left text-sm"><thead className="bg-[var(--app-surface-muted)] text-[10px] font-black uppercase tracking-[.1em] text-[var(--app-text-muted)]"><tr><th className="px-5 py-3">Referencia</th><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Localidad</th><th className="px-4 py-3">Operación</th><th className="px-4 py-3">Locomotora / vagones</th><th className="px-4 py-3">Servicios</th><th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Estado</th></tr></thead><tbody className="divide-y divide-[var(--app-border)]">{analytics.operations.data.map((item) => <tr key={item.key} className="hover:bg-[var(--app-surface-subtle)]"><td className="px-5 py-4 font-black text-[var(--app-text)]">{item.reference}</td><td className="px-4 py-4 font-bold text-[var(--app-text)]">{item.empresa}</td><td className="px-4 py-4"><p className="font-bold text-[var(--app-text)]">{item.localidad}</p><p className="text-xs text-[var(--app-text-muted)]">{item.sourceSystem}</p></td><td className="px-4 py-4"><StateBadge value={item.origin}/></td><td className="px-4 py-4 font-black text-[var(--app-text)]">{item.origin === "ARRASTRE" ? `${item.wagons} vagones` : item.locomotiveNumber ? `L-${item.locomotiveNumber}` : "—"}</td><td className="px-4 py-4 text-xs font-bold text-[var(--app-text-muted)]">{item.services.map(humanize).join(", ")}</td><td className="px-4 py-4 text-xs text-[var(--app-text-muted)]">{formatDate(item.operationAt)}</td><td className="px-4 py-4"><StateBadge value={item.status}/></td></tr>)}</tbody></table></div><Pagination page={analytics.operations.meta.page} pages={analytics.operations.meta.totalPages} total={analytics.operations.meta.total} onChange={(page) => setFilters({ page })}/></section>
    </> : null}
  </div>;
}

function isTorreon(value?: string) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes("torreon");
}
