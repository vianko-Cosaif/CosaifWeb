"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  FileClock,
  GitBranch,
  Loader2,
  MapPinned,
  RefreshCw,
  Route,
  Search,
  Train,
  UserRound,
} from "lucide-react";
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
import { getEmpresaIdClient, getLocIdClient } from "@/lib/cookies";

type ReportKey =
  | "carga"
  | "vias"
  | "turnos"
  | "usuarios"
  | "cumplimiento"
  | "incidentes"
  | "cronologia";

type PeriodoUi = "dia" | "semana" | "quincena" | "mes" | "bimestre" | "semestre" | "anual";
type PeriodoBack = "DIA" | "SEMANA" | "QUINCENA" | "MES" | "BIMESTRE" | "SEMESTRE" | "ANUAL";

type ReportDefinition = {
  key: ReportKey;
  path: string;
  label: string;
  shortLabel: string;
  desc: string;
  icon: LucideIcon;
  accent: string;
};

// Los reportes cambian de forma segun el modulo seleccionado.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

const DEFAULT_TZ = "America/Mexico_City";
const API_ROOT = "/bff/reporteria/cliente";
const CRONOLOGIA_PAGE_SIZE = 25;
const CHART_COLORS = ["#0f766e", "#2563eb", "#7c3aed", "#ea580c", "#dc2626", "#0891b2"];

const PERIOD_TO_BACK: Record<PeriodoUi, PeriodoBack> = {
  dia: "DIA",
  semana: "SEMANA",
  quincena: "QUINCENA",
  mes: "MES",
  bimestre: "BIMESTRE",
  semestre: "SEMESTRE",
  anual: "ANUAL",
};

const PERIOD_OPTIONS: Array<{ id: PeriodoUi; label: string }> = [
  { id: "dia", label: "Día" },
  { id: "semana", label: "Semana" },
  { id: "quincena", label: "Quincena" },
  { id: "mes", label: "Mes" },
  { id: "bimestre", label: "Bimestre" },
  { id: "semestre", label: "Semestre" },
  { id: "anual", label: "Año" },
];

const REPORTS: ReportDefinition[] = [
  {
    key: "carga",
    path: "carga-operativa",
    label: "Carga operativa",
    shortLabel: "Carga",
    desc: "Frecuencia por locomotora, vía y día.",
    icon: Activity,
    accent: "#0f766e",
  },
  {
    key: "vias",
    path: "vias",
    label: "Movimientos por vías",
    shortLabel: "Vías",
    desc: "Uso, entradas, salidas, pendientes y cancelaciones.",
    icon: Route,
    accent: "#2563eb",
  },
  {
    key: "turnos",
    path: "turnos",
    label: "Reporte por turnos",
    shortLabel: "Turnos",
    desc: "Turno 1, 2 y 3 con inicios, fines e incidentes.",
    icon: Clock3,
    accent: "#7c3aed",
  },
  {
    key: "usuarios",
    path: "usuarios",
    label: "Usuarios",
    shortLabel: "Usuarios",
    desc: "Solicitudes, operadores y actividad operativa.",
    icon: UserRound,
    accent: "#ea580c",
  },
  {
    key: "cumplimiento",
    path: "cumplimiento",
    label: "Cumplimiento",
    shortLabel: "Cumplimiento",
    desc: "Terminados, pendientes, cancelados e incidentes.",
    icon: CheckCircle2,
    accent: "#16a34a",
  },
  {
    key: "incidentes",
    path: "incidentes",
    label: "Incidentes",
    shortLabel: "Incidentes",
    desc: "Incidentes por locomotora, vía y turno.",
    icon: AlertTriangle,
    accent: "#dc2626",
  },
  {
    key: "cronologia",
    path: "cronologia",
    label: "Cronología",
    shortLabel: "Cronología",
    desc: "Historial completo por movimiento.",
    icon: FileClock,
    accent: "#0891b2",
  },
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function monthISO(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function n(value: unknown) {
  const x = Number(value);
  return Number.isFinite(x) ? x : 0;
}

function fmt(value: unknown) {
  return n(value).toLocaleString("es-MX");
}

function fmtPct(value: unknown) {
  return `${fmt(value)}%`;
}


function asArray<T = AnyRecord>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function safeText(value: unknown, fallback = "—") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function readSessionEmpresa() {
  if (typeof window === "undefined") return { id: null as number | null, nombre: "" };
  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const id = Number(user?.empresaId ?? user?.empresa?.id ?? NaN);
    return {
      id: Number.isFinite(id) && id > 0 ? id : getEmpresaIdClient(),
      nombre: String(user?.empresa?.nombre || ""),
    };
  } catch {
    return { id: getEmpresaIdClient(), nombre: "" };
  }
}

function buildAnchorDate(opts: {
  periodo: PeriodoUi;
  dia: string;
  semana: string;
  quincenaMes: string;
  quincena: 1 | 2;
  mes: string;
  bimestreYear: number;
  bimestre: number;
  semestreYear: number;
  semestre: 1 | 2;
  anual: number;
}) {
  switch (opts.periodo) {
    case "dia":
      return opts.dia;
    case "semana":
      return opts.semana;
    case "quincena":
      return `${opts.quincenaMes}-${opts.quincena === 1 ? "01" : "16"}`;
    case "mes":
      return `${opts.mes}-01`;
    case "bimestre": {
      const month = (Math.min(6, Math.max(1, opts.bimestre)) - 1) * 2 + 1;
      return `${opts.bimestreYear}-${String(month).padStart(2, "0")}-01`;
    }
    case "semestre":
      return `${opts.semestreYear}-${opts.semestre === 1 ? "01" : "07"}-01`;
    case "anual":
      return `${opts.anual}-01-01`;
  }
}

function parseFilenameDisposition(disposition: string | null) {
  if (!disposition) return "";
  const match = disposition.match(/filename="?([^"]+)"?/i);
  return match?.[1] || "";
}

async function readJsonError(res: Response) {
  const text = await res.text().catch(() => "");
  try {
    const json = JSON.parse(text);
    return String(json?.message || json?.error || text || `HTTP ${res.status}`);
  } catch {
    return text || `HTTP ${res.status}`;
  }
}

function buildQuery(params: {
  fecha: string;
  periodo: PeriodoBack;
  empresaId: number | null;
  localidadId: number | null;
  useLocalidad: boolean;
  page?: number;
  pageSize?: number;
}) {
  const qs = new URLSearchParams({
    fecha: params.fecha,
    periodo: params.periodo,
    tz: DEFAULT_TZ,
  });
  if (params.empresaId) qs.set("empresaId", String(params.empresaId));
  if (params.useLocalidad && params.localidadId) qs.set("localidadId", String(params.localidadId));
  if (params.page) qs.set("page", String(params.page));
  if (params.pageSize) qs.set("pageSize", String(params.pageSize));
  return qs;
}

export default function ClienteReporteriaClient() {
  const now = new Date();
  const [activeReport, setActiveReport] = useState<ReportKey>("carga");
  const [cronologiaPage, setCronologiaPage] = useState(1);
  const [periodo, setPeriodo] = useState<PeriodoUi>("mes");
  const [dia, setDia] = useState(todayISO());
  const [semana, setSemana] = useState(todayISO());
  const [quincenaMes, setQuincenaMes] = useState(monthISO(now));
  const [quincena, setQuincena] = useState<1 | 2>(now.getDate() <= 15 ? 1 : 2);
  const [mes, setMes] = useState(monthISO(now));
  const [bimestreYear, setBimestreYear] = useState(now.getFullYear());
  const [bimestre, setBimestre] = useState(Math.floor(now.getMonth() / 2) + 1);
  const [semestreYear, setSemestreYear] = useState(now.getFullYear());
  const [semestre, setSemestre] = useState<1 | 2>(now.getMonth() < 6 ? 1 : 2);
  const [anual, setAnual] = useState(now.getFullYear());
  const [empresa, setEmpresa] = useState<{ id: number | null; nombre: string }>({ id: null, nombre: "" });
  const [localidadId, setLocalidadId] = useState<number | null>(null);
  const [useLocalidad, setUseLocalidad] = useState(true);
  const [report, setReport] = useState<AnyRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);

  const activeDefinition = useMemo(
    () => REPORTS.find((item) => item.key === activeReport) ?? REPORTS[0],
    [activeReport]
  );

  useEffect(() => {
    setEmpresa(readSessionEmpresa());
    setLocalidadId(getLocIdClient());
  }, []);

  const anchorFecha = useMemo(
    () =>
      buildAnchorDate({
        periodo,
        dia,
        semana,
        quincenaMes,
        quincena,
        mes,
        bimestreYear,
        bimestre,
        semestreYear,
        semestre,
        anual,
      }),
    [periodo, dia, semana, quincenaMes, quincena, mes, bimestreYear, bimestre, semestreYear, semestre, anual]
  );

  useEffect(() => {
    setCronologiaPage(1);
  }, [activeReport, anchorFecha, empresa.id, localidadId, useLocalidad]);

  const query = useMemo(
    () =>
      buildQuery({
        fecha: anchorFecha,
        periodo: PERIOD_TO_BACK[periodo],
        empresaId: empresa.id,
        localidadId,
        useLocalidad,
        page: activeReport === "cronologia" ? cronologiaPage : undefined,
        pageSize: activeReport === "cronologia" ? CRONOLOGIA_PAGE_SIZE : undefined,
      }),
    [activeReport, anchorFecha, periodo, empresa.id, localidadId, useLocalidad, cronologiaPage]
  );

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_ROOT}/${activeDefinition.path}?${query.toString()}`, {
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error(await readJsonError(res));
      const json = await res.json();
      setReport((json?.reporte ?? json) as AnyRecord);
      setFetchedAt(new Date());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el reporte.");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [activeDefinition.path, query]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const exportPdf = useCallback(async () => {
    if (pdfBusy) return;
    setPdfBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_ROOT}/${activeDefinition.path}/pdf?${query.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) throw new Error(await readJsonError(res));
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download =
        parseFilenameDisposition(res.headers.get("content-disposition")) ||
        `reporte_${activeDefinition.path}_${PERIOD_TO_BACK[periodo]}_${anchorFecha}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo descargar el PDF.");
    } finally {
      setPdfBusy(false);
    }
  }, [activeDefinition.path, anchorFecha, pdfBusy, periodo, query]);

  return (
    <div className="w-full min-w-0 max-w-full space-y-4 overflow-x-hidden sm:space-y-5 2xl:mx-auto 2xl:max-w-screen-2xl">
      <header className="flex flex-col gap-4 border-b border-slate-200/80 pb-4 dark:border-slate-800 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0 space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400 sm:text-xs sm:tracking-[0.34em]">Reportería cliente</p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="min-w-0 text-xl font-black tracking-tight text-slate-950 dark:text-white sm:text-3xl">
              {empresa.nombre || "Mi empresa"}
            </h1>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
              {activeDefinition.shortLabel}
            </span>
          </div>
          <p className="max-w-3xl text-sm text-slate-500 dark:text-slate-400">
            Consulta movimientos, vías, turnos, usuarios, cumplimiento, incidentes y cronología por periodo.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
            <button
              type="button"
              onClick={fetchReport}
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 disabled:opacity-60 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 sm:w-auto sm:px-4"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Actualizando" : "Actualizar"}
            </button>
            <button
              type="button"
              onClick={exportPdf}
              disabled={pdfBusy || !report}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-950 sm:w-auto sm:px-4"
            >
              {pdfBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              PDF
            </button>
          </div>
          {fetchedAt ? (
            <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 shadow-sm dark:border-slate-800 dark:bg-slate-950/80">
              Actualizado {fetchedAt.toLocaleDateString("es-MX")}
            </span>
          ) : null}
        </div>
      </header>

      <ReportPicker activeReport={activeReport} setActiveReport={setActiveReport} report={report} />

      <FilterPanel
        periodo={periodo}
        setPeriodo={setPeriodo}
        dia={dia}
        setDia={setDia}
        semana={semana}
        setSemana={setSemana}
        quincenaMes={quincenaMes}
        setQuincenaMes={setQuincenaMes}
        quincena={quincena}
        setQuincena={setQuincena}
        mes={mes}
        setMes={setMes}
        bimestreYear={bimestreYear}
        setBimestreYear={setBimestreYear}
        bimestre={bimestre}
        setBimestre={setBimestre}
        semestreYear={semestreYear}
        setSemestreYear={setSemestreYear}
        semestre={semestre}
        setSemestre={setSemestre}
        anual={anual}
        setAnual={setAnual}
        useLocalidad={useLocalidad}
        setUseLocalidad={setUseLocalidad}
        localidadId={localidadId}
      />

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
          {error}
        </div>
      ) : null}

      <section className="min-h-[480px]">
        {loading && !report ? <LoadingState /> : null}
        {!loading && !report && !error ? <EmptyState /> : null}
        {report ? (
          <ReportContent
            reportKey={activeReport}
            report={report}
            accent={activeDefinition.accent}
            cronologiaPage={cronologiaPage}
            onCronologiaPageChange={setCronologiaPage}
          />
        ) : null}
      </section>
    </div>
  );
}

function ReportPicker({
  activeReport,
  setActiveReport,
  report,
}: {
  activeReport: ReportKey;
  setActiveReport: (key: ReportKey) => void;
  report: AnyRecord | null;
}) {
  const active = REPORTS.find((item) => item.key === activeReport) ?? REPORTS[0];
  const ActiveIcon = active.icon;

  return (
    <section className="min-w-0">
      <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:hidden">
        <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
          Módulo
        </label>
        <div className="flex items-start gap-3">
          <span
            className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-lg"
            style={{ background: `${active.accent}18`, color: active.accent }}
          >
            <ActiveIcon className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <select
              value={activeReport}
              onChange={(event) => setActiveReport(event.target.value as ReportKey)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-base font-bold text-slate-950 outline-none focus:border-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
            >
              {REPORTS.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.shortLabel}
                </option>
              ))}
            </select>
            <p className="mt-2 text-sm leading-5 text-slate-500 dark:text-slate-400">{active.desc}</p>
            {report?.meta?.rangoTexto ? (
              <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                {safeText(report.meta.rangoTexto)}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="hidden gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-7">
        {REPORTS.map((item) => {
          const selected = item.key === activeReport;
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setActiveReport(item.key)}
              className={`min-w-0 rounded-lg border p-3 text-left shadow-sm transition ${
                selected
                  ? "border-slate-950 bg-white ring-2 ring-slate-950/10 dark:border-white dark:bg-slate-950"
                  : "border-slate-200 bg-white/75 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950/70"
              }`}
            >
              <div className="flex items-start gap-3">
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg"
                  style={{ background: `${item.accent}18`, color: item.accent }}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-slate-950 dark:text-white">{item.shortLabel}</span>
                  <span className="mt-1 block text-xs leading-4 text-slate-500 dark:text-slate-400">{item.desc}</span>
                </span>
              </div>
              {selected && report?.meta?.rangoTexto ? (
                <div className="mt-3 truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  {safeText(report.meta.rangoTexto)}
                </div>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function FilterPanel(props: {
  periodo: PeriodoUi;
  setPeriodo: (value: PeriodoUi) => void;
  dia: string;
  setDia: (value: string) => void;
  semana: string;
  setSemana: (value: string) => void;
  quincenaMes: string;
  setQuincenaMes: (value: string) => void;
  quincena: 1 | 2;
  setQuincena: (value: 1 | 2) => void;
  mes: string;
  setMes: (value: string) => void;
  bimestreYear: number;
  setBimestreYear: (value: number) => void;
  bimestre: number;
  setBimestre: (value: number) => void;
  semestreYear: number;
  setSemestreYear: (value: number) => void;
  semestre: 1 | 2;
  setSemestre: (value: 1 | 2) => void;
  anual: number;
  setAnual: (value: number) => void;
  useLocalidad: boolean;
  setUseLocalidad: (value: boolean) => void;
  localidadId: number | null;
}) {
  return (
    <section className="min-w-0 rounded-lg border border-slate-200 bg-white/90 p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/80 sm:p-4">
      <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.75fr)]">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-slate-400">
            <CalendarDays className="h-3.5 w-3.5" />
            Periodo
          </div>
          <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
            {PERIOD_OPTIONS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => props.setPeriodo(item.id)}
                className={`min-w-0 rounded-lg px-2 py-2 text-[11px] font-bold uppercase tracking-[0.08em] transition sm:min-w-[86px] sm:px-3 sm:text-xs sm:tracking-[0.12em] ${
                  props.periodo === item.id
                    ? "bg-slate-950 text-white shadow-sm dark:bg-white dark:text-slate-950"
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="min-w-0 rounded-lg border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/40">
          <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-slate-400">
              <Search className="h-3.5 w-3.5" />
              Fecha
            </div>
            <label className="inline-flex shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
              <input
                type="checkbox"
                checked={props.useLocalidad}
                onChange={(e) => props.setUseLocalidad(e.target.checked)}
                disabled={!props.localidadId}
                className="h-3.5 w-3.5 rounded border-slate-300 text-slate-950"
              />
              Localidad
            </label>
          </div>
          <DateControl {...props} />
        </div>
      </div>
    </section>
  );
}

function DateControl(props: Parameters<typeof FilterPanel>[0]) {
  const inputClass =
    "w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white";

  if (props.periodo === "dia") {
    return <input className={inputClass} type="date" value={props.dia} onChange={(e) => props.setDia(e.target.value)} />;
  }
  if (props.periodo === "semana") {
    return <input className={inputClass} type="date" value={props.semana} onChange={(e) => props.setSemana(e.target.value)} />;
  }
  if (props.periodo === "quincena") {
    return (
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
        <input className={inputClass} type="month" value={props.quincenaMes} onChange={(e) => props.setQuincenaMes(e.target.value)} />
        <div className="grid grid-cols-2 rounded-lg bg-slate-100 p-1 dark:bg-slate-900">
          {[1, 2].map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => props.setQuincena(q as 1 | 2)}
              className={`rounded-md px-3 text-xs font-bold ${props.quincena === q ? "bg-white text-slate-950 shadow-sm dark:bg-slate-800 dark:text-white" : "text-slate-500"}`}
            >
              Q{q}
            </button>
          ))}
        </div>
      </div>
    );
  }
  if (props.periodo === "mes") {
    return <input className={inputClass} type="month" value={props.mes} onChange={(e) => props.setMes(e.target.value)} />;
  }
  if (props.periodo === "bimestre") {
    return (
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input className={inputClass} type="number" value={props.bimestreYear} onChange={(e) => props.setBimestreYear(Number(e.target.value))} />
        <select className={inputClass} value={props.bimestre} onChange={(e) => props.setBimestre(Number(e.target.value))}>
          {[1, 2, 3, 4, 5, 6].map((b) => <option key={b} value={b}>B{b}</option>)}
        </select>
      </div>
    );
  }
  if (props.periodo === "semestre") {
    return (
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input className={inputClass} type="number" value={props.semestreYear} onChange={(e) => props.setSemestreYear(Number(e.target.value))} />
        <select className={inputClass} value={props.semestre} onChange={(e) => props.setSemestre(Number(e.target.value) as 1 | 2)}>
          <option value={1}>S1</option>
          <option value={2}>S2</option>
        </select>
      </div>
    );
  }
  return <input className={inputClass} type="number" value={props.anual} onChange={(e) => props.setAnual(Number(e.target.value))} />;
}

function ReportContent({
  reportKey,
  report,
  accent,
  cronologiaPage,
  onCronologiaPageChange,
}: {
  reportKey: ReportKey;
  report: AnyRecord;
  accent: string;
  cronologiaPage: number;
  onCronologiaPageChange: (page: number) => void;
}) {
  if (reportKey === "carga") return <CargaReport report={report} accent={accent} />;
  if (reportKey === "vias") return <ViasReport report={report} accent={accent} />;
  if (reportKey === "turnos") return <TurnosReport report={report} accent={accent} />;
  if (reportKey === "usuarios") return <UsuariosReport report={report} accent={accent} />;
  if (reportKey === "cumplimiento") return <CumplimientoReport report={report} accent={accent} />;
  if (reportKey === "incidentes") return <IncidentesReport report={report} accent={accent} />;
  return <CronologiaReport report={report} page={cronologiaPage} onPageChange={onCronologiaPageChange} />;
}

function CargaReport({ report, accent }: { report: AnyRecord; accent: string }) {
  const resumen = report.resumen ?? {};
  const porDia = asArray(report.movimientosPorDia);
  const topVias = asArray(report.vias).slice(0, 10);
  const topLocos = asArray(report.locomotoras).slice(0, 10);
  const usuarios = asArray(report.usuariosSolicitantes).slice(0, 8);
  const servicios = resumen.servicios ?? {};

  return (
    <div className="space-y-5">
      <MetricGrid>
        <Kpi icon={Train} label="Movimientos" value={fmt(resumen.totalMovimientos)} sub="Total del periodo" />
        <Kpi icon={GitBranch} label="Locomotoras" value={fmt(resumen.totalLocomotoras)} sub="Unidades únicas" />
        <Kpi icon={MapPinned} label="Vías tocadas" value={fmt(resumen.totalVias)} sub="Origen o destino" />
      </MetricGrid>
      <ChartPanel title="Movimientos por día">
        <LineChartBox data={porDia} xKey="fecha" yKey="movimientos" stroke={accent} />
      </ChartPanel>
      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-[1fr_1fr_0.8fr]">
        <Panel title="Vías con mayor carga">
          <SimpleTable
            rows={topVias}
            columns={[
              ["Vía", (r) => safeText(r.via)],
              ["Usos", (r) => fmt(r.totalUsos), "right"],
              ["Origen", (r) => fmt(r.comoOrigen), "right"],
              ["Destino", (r) => fmt(r.comoDestino), "right"],
            ]}
          />
        </Panel>
        <Panel title="Locomotoras más movidas">
          <SimpleTable
            rows={topLocos}
            columns={[
              ["Loc.", (r) => `L-${safeText(r.locomotiveNumber)}`],
              ["Mov.", (r) => fmt(r.movimientos), "right"],
              ["Vías", (r) => fmt(r.viasUsadas), "right"],
              ["Días", (r) => fmt(r.diasActivos), "right"],
            ]}
          />
        </Panel>
        <Panel title="Servicios">
          <PieChartBox
            data={[
              { name: "Torno", value: n(servicios.torno) },
              { name: "Lavado", value: n(servicios.lavado) },
              { name: "Ambos", value: n(servicios.tornoLavado) },
              { name: "Sin servicio", value: n(servicios.sinServicio) },
            ]}
          />
        </Panel>
      </div>
      <Panel title="Usuarios solicitantes">
        <SimpleTable
          rows={usuarios}
          columns={[
            ["Usuario", (r) => safeText(r.nombre)],
            ["Solicitudes", (r) => fmt(r.solicitudes), "right"],
            ["Loc.", (r) => fmt(r.locomotorasUnicas), "right"],
            ["Vías", (r) => fmt(r.viasRelacionadas), "right"],
          ]}
        />
      </Panel>
    </div>
  );
}

function ViasReport({ report, accent }: { report: AnyRecord; accent: string }) {
  const resumen = report.resumen ?? {};
  const vias = asArray(report.vias);
  return (
    <div className="space-y-5">
      <MetricGrid>
        <Kpi icon={Route} label="Vías y servicios" value={fmt(resumen.totalVias)} sub="Con actividad" />
        <Kpi icon={Train} label="Entradas" value={fmt(resumen.totalEntradas)} sub="Destino" />
        <Kpi icon={Activity} label="Salidas" value={fmt(resumen.totalSalidas)} sub="Origen" />
        <Kpi icon={AlertTriangle} label="Cancelados" value={fmt(resumen.cancelados)} sub={`${fmt(resumen.incidentes)} incidentes`} />
      </MetricGrid>
      <ChartPanel title="Vías y servicios más usados">
        <BarChartBox data={vias.slice(0, 12)} xKey="via" yKey="totalUsos" fill={accent} />
      </ChartPanel>
      <Panel title="Detalle por vía">
        <SimpleTable
          rows={vias}
          columns={[
            ["Vía", (r) => safeText(r.via)],
            ["Usos", (r) => fmt(r.totalUsos), "right"],
            ["Entradas", (r) => fmt(r.entradas), "right"],
            ["Salidas", (r) => fmt(r.salidas), "right"],
            ["Pend.", (r) => fmt(r.pendientes), "right"],
            ["Canc.", (r) => fmt(r.cancelados), "right"],
            ["Inc.", (r) => fmt(r.incidentes), "right"],
          ]}
        />
      </Panel>
    </div>
  );
}

function TurnosReport({ report }: { report: AnyRecord; accent: string }) {
  const turnos = asArray(report.turnos);
  const total = turnos.reduce((acc, row) => acc + n(row.solicitados), 0);
  return (
    <div className="space-y-5">
      <MetricGrid>
        <Kpi icon={Train} label="Solicitados" value={fmt(total)} sub="Total turnos" />
        <Kpi icon={Clock3} label="Completos" value={fmtPct(avgPct(turnos, "conInicioFinPct"))} sub="Por turno" />
        <Kpi icon={AlertTriangle} label="Cancelados" value={fmt(sumBy(turnos, "cancelados"))} sub={`${fmt(sumBy(turnos, "incidentes"))} incidentes`} />
      </MetricGrid>
      <Panel title="Turno 1, 2 y 3">
        <SimpleTable
          rows={turnos}
          columns={[
            ["Turno", (r) => safeText(r.turnoLabel)],
            ["Solic.", (r) => fmt(r.solicitados), "right"],
            ["Inic.", (r) => fmt(r.iniciados), "right"],
            ["Finalizadas", (r) => fmt(r.finalizados), "right"],
            ["Completos", (r) => fmtPct(r.conInicioFinPct), "right"],
            ["Canc.", (r) => fmt(r.cancelados), "right"],
            ["Inc.", (r) => fmt(r.incidentes), "right"],
          ]}
        />
      </Panel>
    </div>
  );
}

function UsuariosReport({ report, accent }: { report: AnyRecord; accent: string }) {
  const solicitantes = asArray(report.solicitantes);
  const actividad = asArray(report.actividadPorDia);
  return (
    <div className="space-y-5">
      <MetricGrid>
        <Kpi icon={UserRound} label="Solicitantes" value={fmt(solicitantes.length)} sub="Usuarios con solicitudes" />
        <Kpi icon={CheckCircle2} label="Finalizados" value={fmt(sumBy(solicitantes, "finalizados"))} sub="Desde solicitudes" />
        <Kpi icon={AlertTriangle} label="Cancelaciones" value={fmt(sumBy(solicitantes, "cancelaciones"))} sub="Registradas" />
      </MetricGrid>
      <ChartPanel title="Solicitudes por usuario">
        <BarChartBox data={solicitantes.slice(0, 10)} xKey="nombre" yKey="solicitudes" fill={accent} />
      </ChartPanel>
      <Panel title="Solicitudes creadas">
        <SimpleTable
          rows={solicitantes}
          columns={[
            ["Usuario", (r) => safeText(r.nombre)],
            ["Solicitudes", (r) => fmt(r.solicitudes), "right"],
            ["Finalizadas", (r) => fmt(r.finalizados), "right"],
            ["Canceladas", (r) => fmt(r.cancelaciones), "right"],
            ["T1", (r) => fmt(r.turnos?.T1), "right"],
            ["T2", (r) => fmt(r.turnos?.T2), "right"],
            ["T3", (r) => fmt(r.turnos?.T3), "right"],
          ]}
        />
      </Panel>
      <Panel title="Actividad por día">
        <SimpleTable
          rows={actividad}
          columns={[
            ["Fecha", (r) => safeText(r.fecha)],
            ["Día", (r) => safeText(r.diaSemana)],
            ["Solicitudes", (r) => fmt(r.solicitudes), "right"],
            ["Atendidos", (r) => fmt(r.atendidos), "right"],
            ["Finalizadas", (r) => fmt(r.finalizados), "right"],
            ["Canceladas", (r) => fmt(r.cancelaciones), "right"],
          ]}
        />
      </Panel>
    </div>
  );
}

function CumplimientoReport({ report, accent }: { report: AnyRecord; accent: string }) {
  const resumen = report.resumen ?? {};
  const locos = asArray(report.porLocomotora);
  const turnos = asArray(report.porTurno);
  return (
    <div className="space-y-5">
      <MetricGrid>
        <Kpi icon={CheckCircle2} label="Terminados" value={fmt(resumen.terminadosCorrectamente)} sub={`${fmt(resumen.concluidosSinIncidente)} sin incidente`} />
        <Kpi icon={Clock3} label="Pendientes" value={fmt(resumen.pendientes)} sub="Activos" />
        <Kpi icon={AlertTriangle} label="Cancelados" value={fmt(resumen.cancelados)} sub="Del periodo" />
        <Kpi icon={Activity} label="Completos" value={fmtPct(resumen.conInicioFinPct)} sub="Con registro completo" />
      </MetricGrid>
      <ChartPanel title="Cumplimiento por turno">
        <BarChartBox data={turnos} xKey="turnoLabel" yKey="finalizados" fill={accent} />
      </ChartPanel>
      <Panel title="Cumplimiento por locomotora">
        <SimpleTable
          rows={locos}
          columns={[
            ["Loc.", (r) => `L-${safeText(r.locomotiveNumber)}`],
            ["Total", (r) => fmt(r.totalMovimientos), "right"],
            ["Conc.", (r) => fmt(r.concluidos), "right"],
            ["Pend.", (r) => fmt(r.pendientes), "right"],
            ["Canc.", (r) => fmt(r.cancelados), "right"],
            ["Inc.", (r) => fmt(r.incidentes), "right"],
          ]}
        />
      </Panel>
    </div>
  );
}

function IncidentesReport({ report, accent }: { report: AnyRecord; accent: string }) {
  const resumen = report.resumen ?? {};
  const locos = asArray(report.porLocomotora);
  const vias = asArray(report.porVia);
  const turnos = asArray(report.porTurno);
  const detalle = asArray(report.detalle);
  return (
    <div className="space-y-5">
      <MetricGrid>
        <Kpi icon={AlertTriangle} label="Incidentes" value={fmt(resumen.totalIncidentes)} sub="Total" />
        <Kpi icon={Train} label="Mov. con incidente" value={fmt(resumen.movimientosConIncidente)} sub="Relacionados" />
        <Kpi icon={Clock3} label="Abiertos" value={fmt(resumen.incidentesAbiertos)} sub={`${fmt(resumen.incidentesResueltos)} resueltos`} />
        <Kpi icon={CheckCircle2} label="Canc. relacionadas" value={fmt(resumen.cancelacionesRelacionadas)} sub="Cancelado + incidente" />
      </MetricGrid>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartPanel title="Incidentes por locomotora">
          <BarChartBox data={locos.slice(0, 10)} xKey="locomotiveNumber" yKey="incidentes" fill={accent} prefixX="L-" />
        </ChartPanel>
        <ChartPanel title="Incidentes por vía">
          <BarChartBox data={vias.slice(0, 10)} xKey="via" yKey="incidentes" fill="#ea580c" />
        </ChartPanel>
      </div>
      <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <Panel title="Incidentes por turno">
          <SimpleTable
            rows={turnos}
            columns={[
              ["Turno", (r) => safeText(r.turnoLabel)],
              ["Inc.", (r) => fmt(r.incidentes), "right"],
              ["Mov.", (r) => fmt(r.movimientos), "right"],
              ["Canc.", (r) => fmt(r.cancelacionesRelacionadas), "right"],
            ]}
          />
        </Panel>
        <Panel title="Detalle de incidentes">
          <SimpleTable
            rows={detalle}
            columns={[
              ["Inc.", (r) => fmt(r.incidenteId), "right"],
              ["Mov.", (r) => fmt(r.movimientoId), "right"],
              ["Loc.", (r) => `L-${safeText(r.locomotiveNumber)}`],
              ["Estado", (r) => safeText(r.estadoIncidente)],
              ["Vía", (r) => safeText(r.viaOrigen ?? r.viaDestino)],
              ["Turno", (r) => safeText(r.turnoLabel)],
            ]}
          />
        </Panel>

      </div>
    </div>
  );
}

function CronologiaReport({
  report,
  page,
  onPageChange,
}: {
  report: AnyRecord;
  page: number;
  onPageChange: (page: number) => void;
}) {
  const movimientos = asArray(report.movimientos);
  const meta = report.detalleMeta ?? {};
  const currentPage = Math.max(1, n(meta.page ?? page));
  const totalPages = Math.max(1, n(meta.totalPages ?? 1));
  const total = n(meta.totalMovimientos ?? movimientos.length);
  const from = n(meta.from ?? (total ? (currentPage - 1) * CRONOLOGIA_PAGE_SIZE + 1 : 0));
  const to = n(meta.to ?? (total ? from + movimientos.length - 1 : 0));

  return (
    <div className="space-y-5">
      <MetricGrid>
        <Kpi icon={FileClock} label="Movimientos" value={fmt(total)} sub="Total del periodo" />
        <Kpi icon={CheckCircle2} label="Página" value={`${fmt(currentPage)} / ${fmt(totalPages)}`} sub="Desde backend" />
        <Kpi icon={Activity} label="Mostrados" value={fmt(meta.incluidos ?? movimientos.length)} sub="En esta página" />
        <Kpi icon={AlertTriangle} label="Rango" value={total ? `${fmt(from)}-${fmt(to)}` : "0"} sub="Registros visibles" />
      </MetricGrid>
      <Panel title="Línea de tiempo por movimiento">
        <SimpleTable
          rows={movimientos}
          columns={[
            ["ID", (r) => fmt(r.id), "right"],
            ["Loc.", (r) => `L-${safeText(r.locomotiveNumber)}`],
            ["Estado", (r) => safeText(r.estadoActual)],
            ["Origen", (r) => safeText(r.viaOrigen)],
            ["Destino", (r) => safeText(r.viaDestino)],
            ["Servicio", (r) => safeText(r.servicio)],
            ["Solicitud", (r) => safeText(r.fechaSolicitud)],
            ["Inicio", (r) => safeText(r.fechaInicio)],
            ["Fin", (r) => safeText(r.fechaFin)],
            ["Línea", (r) => safeText(asArray<string>(r.linea).join(" → ")), "wide"],
            ["Inc.", (r) => fmt(r.incidentes), "right"],
          ]}
        />
        <PaginationControls
          page={currentPage}
          totalPages={totalPages}
          total={total}
          from={from}
          to={to}
          onPageChange={onPageChange}
        />
      </Panel>
    </div>
  );
}

function PaginationControls({
  page,
  totalPages,
  total,
  from,
  to,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  from: number;
  to: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 dark:border-slate-900 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
        {total ? `Mostrando ${fmt(from)}-${fmt(to)} de ${fmt(total)}` : "Sin registros para este periodo"}
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:flex">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-45 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
        >
          <ChevronLeft className="h-4 w-4" />
          Anterior
        </button>
        <span className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-black text-slate-700 dark:bg-slate-900 dark:text-slate-200">
          {fmt(page)} / {fmt(totalPages)}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-45 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
        >
          Siguiente
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function MetricGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2 sm:gap-3 xl:grid-cols-4">{children}</div>;
}

function Kpi({
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
    <div className={`min-w-0 rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-4 ${compact ? "" : "min-h-[84px] sm:min-h-[104px]"}`}>
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 sm:gap-2 sm:text-xs sm:tracking-[0.2em]">
        <Icon className="h-4 w-4" />
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-2 break-words text-2xl font-black leading-tight text-slate-950 dark:text-white sm:mt-3 sm:text-2xl">{value}</div>
      {sub ? <div className="mt-1 truncate text-xs font-medium text-slate-500 dark:text-slate-400">{sub}</div> : null}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-4">
      <h2 className="mb-3 text-sm font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{title}</h2>
      {children}
    </section>
  );
}

function ChartPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-4">
      <h2 className="mb-3 text-xs font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400 sm:text-sm sm:tracking-[0.18em]">{title}</h2>
      <div className="h-[250px] min-w-0 sm:h-[300px]">{children}</div>
    </section>
  );
}

function BarChartBox({ data, xKey, yKey, fill, prefixX = "" }: { data: AnyRecord[]; xKey: string; yKey: string; fill: string; prefixX?: string }) {
  if (!data.length) return <NoData />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 28 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: "#64748b" }} angle={-25} textAnchor="end" height={54} tickFormatter={(value) => `${prefixX}${String(value).slice(0, 16)}`} />
        <YAxis tick={{ fontSize: 11, fill: "#64748b" }} allowDecimals={false} />
        <Tooltip cursor={{ fill: "rgba(15,23,42,0.05)" }} />
        <Bar dataKey={yKey} fill={fill} radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function LineChartBox({ data, xKey, yKey, stroke }: { data: AnyRecord[]; xKey: string; yKey: string; stroke: string }) {
  if (!data.length) return <NoData />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 18 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: "#64748b" }} />
        <YAxis tick={{ fontSize: 11, fill: "#64748b" }} allowDecimals={false} />
        <Tooltip />
        <Line type="monotone" dataKey={yKey} stroke={stroke} strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function PieChartBox({ data }: { data: Array<{ name: string; value: number }> }) {
  const clean = data.filter((item) => item.value > 0);
  if (!clean.length) return <NoData />;
  return (
    <div className="grid min-h-[260px] grid-cols-1 items-center gap-3 sm:grid-cols-[1fr_auto]">
      <div className="h-[220px] min-w-0 sm:h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
          <Pie data={clean} dataKey="value" nameKey="name" innerRadius={52} outerRadius={86} paddingAngle={3}>
            {clean.map((_, index) => <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
          </Pie>
          <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs sm:block sm:space-y-2">
        {clean.map((item, index) => (
          <div key={item.name} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
            <span className="font-semibold text-slate-600 dark:text-slate-300">{item.name}</span>
            <span className="font-bold text-slate-950 dark:text-white">{fmt(item.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

type ColumnDef = [label: string, render: (row: AnyRecord) => React.ReactNode, align?: "right" | "wide"];

function SimpleTable({ rows, columns }: { rows: AnyRecord[]; columns: ColumnDef[] }) {
  return (
    <div className="min-w-0">
      <div className="space-y-2 md:hidden">
        {rows.length ? rows.map((row, index) => (
          <div key={String(row.id ?? row.viaId ?? row.usuarioId ?? row.locomotiveNumber ?? index)} className="rounded-lg border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/40">
            {columns.map(([label, render, align]) => (
              <div key={label} className="flex items-start justify-between gap-3 border-b border-slate-100 py-1.5 last:border-0 dark:border-slate-800">
                <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</span>
                <span className={`min-w-0 text-right text-sm text-slate-700 dark:text-slate-200 ${align === "right" ? "font-mono tabular-nums" : ""} ${align === "wide" ? "max-w-[65%] break-words text-xs" : "truncate"}`}>
                  {render(row)}
                </span>
              </div>
            ))}
          </div>
        )) : (
          <div className="rounded-lg border border-dashed border-slate-200 px-3 py-8 text-center text-sm text-slate-400 dark:border-slate-800">Sin datos para este periodo.</div>
        )}
      </div>
      <div className="hidden overflow-x-auto md:block">
      <table className="w-full min-w-[680px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-800">
            {columns.map(([label, , align]) => (
              <th key={label} className={`px-3 py-2 text-left text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 ${align === "right" ? "text-right" : ""} ${align === "wide" ? "min-w-[220px]" : ""}`}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? rows.map((row, index) => (
            <tr key={String(row.id ?? row.viaId ?? row.usuarioId ?? row.locomotiveNumber ?? index)} className="border-b border-slate-100 last:border-0 dark:border-slate-900">
              {columns.map(([label, render, align]) => (
                <td key={label} className={`px-3 py-2 text-slate-700 dark:text-slate-200 ${align === "right" ? "text-right font-mono tabular-nums" : ""} ${align === "wide" ? "min-w-[220px] text-xs" : ""}`}>
                  {render(row)}
                </td>
              ))}
            </tr>
          )) : (
            <tr>
              <td colSpan={columns.length} className="px-3 py-8 text-center text-sm text-slate-400">Sin datos para este periodo.</td>
            </tr>
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="grid min-h-[360px] place-items-center rounded-lg border border-slate-200 bg-white/80 dark:border-slate-800 dark:bg-slate-950/70">
      <div className="flex items-center gap-3 text-sm font-semibold text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" />
        Cargando reporte
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="grid min-h-[360px] place-items-center rounded-lg border border-slate-200 bg-white/80 p-8 text-center dark:border-slate-800 dark:bg-slate-950/70">
      <div className="max-w-sm space-y-2">
        <BarChart3 className="mx-auto h-8 w-8 text-slate-400" />
        <h2 className="text-base font-black text-slate-900 dark:text-white">Sin reporte cargado</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">Ajusta el periodo o actualiza la consulta.</p>
      </div>
    </div>
  );
}

function NoData() {
  return <div className="grid h-full place-items-center rounded-lg bg-slate-50 text-sm font-medium text-slate-400 dark:bg-slate-900/50">Sin datos</div>;
}

function sumBy(rows: AnyRecord[], key: string) {
  return rows.reduce((acc, row) => acc + n(row?.[key]), 0);
}


function avgPct(rows: AnyRecord[], key: string) {
  if (!rows.length) return 0;
  return Math.round(rows.reduce((acc, row) => acc + n(row?.[key]), 0) / rows.length);
}
