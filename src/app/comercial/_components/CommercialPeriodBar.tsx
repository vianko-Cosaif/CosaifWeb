"use client";

import { CalendarRange, Loader2, MapPin, TrainFront } from "lucide-react";
import { PERIOD_OPTIONS } from "../_lib/format";
import type { CommercialPeriod } from "../crmTypes";
import { useCommercialData } from "./CommercialDataProvider";

const BIMONTHS = [
  { value: 1, label: "1 · Enero – febrero" },
  { value: 2, label: "2 · Marzo – abril" },
  { value: 3, label: "3 · Mayo – junio" },
  { value: 4, label: "4 · Julio – agosto" },
  { value: 5, label: "5 · Septiembre – octubre" },
  { value: 6, label: "6 · Noviembre – diciembre" },
];

export default function CommercialPeriodBar({ showCompany = true, showLocality = true, showOrigin = false, showPeriod = true }: { showCompany?: boolean; showLocality?: boolean; showOrigin?: boolean; showPeriod?: boolean }) {
  const { analytics, filters, loading, setFilters } = useCommercialData();
  const clientName = filters.empresaId ? analytics?.catalogs.companies.find((item) => item.id === filters.empresaId)?.nombre : "Todos los clientes";
  const localityName = filters.localidadId ? analytics?.catalogs.localities.find((item) => item.id === filters.localidadId)?.nombre : "Todos los patios";
  const arrastreAvailable = !filters.localidadId || isTorreon(localityName);
  const showOriginSelector = showOrigin && arrastreAvailable;
  const originName = !arrastreAvailable || filters.origin === "NATURAL" ? "Naturales" : filters.origin === "ARRASTRE" ? "Arrastre Torreón" : "Tipos separados";
  function changeLocality(raw: string) {
    const localidadId = raw ? Number(raw) : undefined;
    const name = localidadId ? analytics?.catalogs.localities.find((item) => item.id === localidadId)?.nombre : undefined;
    setFilters({ localidadId, origin: localidadId && !isTorreon(name) ? "NATURAL" : undefined });
  }
  return <section className="commercial-card p-4 sm:p-5">
    <header className="flex flex-col gap-2 border-b border-[var(--app-border)] pb-4 sm:flex-row sm:items-center sm:justify-between">
      <div><p className="commercial-label">Periodo y alcance</p><h2 className="text-lg font-black text-[var(--app-text)]">¿Qué información debe incluir?</h2><p className="mt-1 text-xs font-bold text-[var(--app-text-muted)]">Cada cambio actualiza los datos automáticamente.</p></div>
      {loading ? <span className="flex items-center gap-2 self-start rounded-full bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700 dark:bg-blue-950/30 dark:text-blue-200"><Loader2 className="h-3.5 w-3.5 animate-spin"/>Actualizando datos</span> : null}
    </header>
    <div className={`mt-4 grid gap-4 ${showPeriod ? "xl:grid-cols-[minmax(360px_.9fr)_minmax(520px_1.4fr)]" : ""}`}>
      {showPeriod ? <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] p-4">
        <p className="commercial-label">Periodo del reporte</p>
        <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-[var(--app-surface-muted)] p-1.5 sm:grid-cols-5">{PERIOD_OPTIONS.map((item) => <button key={item.value} type="button" onClick={() => setFilters({ period: item.value })} className={`min-h-10 rounded-lg px-2 text-xs font-black transition ${filters.period === item.value ? "bg-slate-950 text-white shadow-sm dark:bg-white dark:text-slate-950" : "text-[var(--app-text-muted)] hover:bg-[var(--app-surface)]"}`}>{item.short}</button>)}</div>
        <div className="mt-3"><PeriodSelector period={filters.period} referenceDate={filters.referenceDate} onChange={(referenceDate) => setFilters({ referenceDate })}/></div>
      </div> : null}
      <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] p-4">
        <p className="commercial-label">Alcance del reporte</p>
        <div className={`mt-3 grid gap-3 ${showOriginSelector ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
          {showCompany ? <label><span className="commercial-label">Cliente</span><select value={filters.empresaId ?? ""} onChange={(event) => setFilters({ empresaId: event.target.value ? Number(event.target.value) : undefined })} className="commercial-select"><option value="">Todos los clientes</option>{analytics?.catalogs.companies.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label> : null}
          {showLocality ? <label><span className="commercial-label"><MapPin className="mr-1 inline h-3.5 w-3.5"/>Patio</span><select value={filters.localidadId ?? ""} onChange={(event) => changeLocality(event.target.value)} className="commercial-select"><option value="">Todos los patios</option>{analytics?.catalogs.localities.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label> : null}
          {showOriginSelector ? <label><span className="commercial-label"><TrainFront className="mr-1 inline h-3.5 w-3.5"/>Tipo de trabajo</span><select value={filters.origin ?? ""} onChange={(event) => setFilters({ origin: event.target.value ? event.target.value as "NATURAL" | "ARRASTRE" : undefined })} className="commercial-select"><option value="">Todos separados</option><option value="NATURAL">Naturales</option><option value="ARRASTRE">Arrastre Torreón</option></select></label> : null}
        </div>
      </div>
    </div>
    <p className="mt-4 text-xs font-bold text-[var(--app-text-muted)]">{showPeriod ? <><span className="text-[var(--app-text)]">{analytics?.meta.periodLabel || "Periodo seleccionado"}</span><span aria-hidden="true"> · </span></> : null}{clientName}<span aria-hidden="true"> · </span>{localityName}{showOrigin ? <><span aria-hidden="true"> · </span>{originName}</> : null}</p>
  </section>;
}

function isTorreon(value?: string) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes("torreon");
}

function PeriodSelector({ period, referenceDate, onChange }: { period: CommercialPeriod; referenceDate: string; onChange: (value: string) => void }) {
  const date = safeDate(referenceDate);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  if (period === "WEEK") return <label><span className="commercial-label"><CalendarRange className="mr-1 inline h-3.5 w-3.5"/>Semana</span><input type="week" value={toIsoWeek(referenceDate)} onChange={(event) => event.target.value && onChange(fromIsoWeek(event.target.value))} className="commercial-input"/></label>;
  if (period === "MONTH") return <label><span className="commercial-label"><CalendarRange className="mr-1 inline h-3.5 w-3.5"/>Mes</span><input type="month" value={referenceDate.slice(0, 7)} onChange={(event) => event.target.value && onChange(`${event.target.value}-01`)} className="commercial-input"/></label>;
  if (period === "BIMONTH") {
    const bimonth = Math.floor((month - 1) / 2) + 1;
    return <div className="grid grid-cols-[110px_1fr] gap-2"><YearSelect value={year} onChange={(nextYear) => onChange(periodDate(nextYear, (bimonth - 1) * 2 + 1))}/><label><span className="commercial-label">Bimestre</span><select value={bimonth} onChange={(event) => onChange(periodDate(year, (Number(event.target.value) - 1) * 2 + 1))} className="commercial-select">{BIMONTHS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label></div>;
  }
  if (period === "SEMESTER") {
    const semester = month <= 6 ? 1 : 2;
    return <div className="grid grid-cols-[110px_1fr] gap-2"><YearSelect value={year} onChange={(nextYear) => onChange(periodDate(nextYear, semester === 1 ? 1 : 7))}/><label><span className="commercial-label">Semestre</span><select value={semester} onChange={(event) => onChange(periodDate(year, Number(event.target.value) === 1 ? 1 : 7))} className="commercial-select"><option value={1}>1 · Enero – junio</option><option value={2}>2 · Julio – diciembre</option></select></label></div>;
  }
  return <YearSelect value={year} onChange={(nextYear) => onChange(periodDate(nextYear, 1))}/>;
}

function YearSelect({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const current = new Date().getFullYear();
  const years = Array.from({ length: current - 1998 }, (_, index) => current + 1 - index);
  if (!years.includes(value)) years.push(value);
  years.sort((a, b) => b - a);
  return <label><span className="commercial-label">Año</span><select value={value} onChange={(event) => onChange(Number(event.target.value))} className="commercial-select">{years.map((year) => <option key={year} value={year}>{year}</option>)}</select></label>;
}

function safeDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function periodDate(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

function toIsoWeek(value: string) {
  const date = safeDate(value);
  const target = new Date(date);
  target.setDate(target.getDate() + 3 - ((target.getDay() + 6) % 7));
  const weekOne = new Date(target.getFullYear(), 0, 4, 12);
  const week = 1 + Math.round(((target.getTime() - weekOne.getTime()) / 86_400_000 - 3 + ((weekOne.getDay() + 6) % 7)) / 7);
  return `${target.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

function fromIsoWeek(value: string) {
  const match = /^(\d{4})-W(\d{2})$/.exec(value);
  if (!match) return value;
  const year = Number(match[1]);
  const week = Number(match[2]);
  const januaryFourth = new Date(year, 0, 4, 12);
  const monday = new Date(januaryFourth);
  monday.setDate(januaryFourth.getDate() - ((januaryFourth.getDay() + 6) % 7) + (week - 1) * 7);
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
}
