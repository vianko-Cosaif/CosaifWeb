"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, ArrowRight, BarChart3, BriefcaseBusiness, CalendarRange, Check, ChevronDown, ChevronUp, CircleHelp, Download, Eye, FileCheck2, FileSpreadsheet, Loader2, Settings2, TableProperties, X } from "lucide-react";
import type { AnalyticsSummary, BillingCut, CommercialOperation, Contract } from "../crmTypes";
import CommercialPeriodBar from "../_components/CommercialPeriodBar";
import { useCommercialData } from "../_components/CommercialDataProvider";
import { Modal, ModuleHeader, Notice } from "../_components/CommercialUi";
import { buildQuery, commercialApi } from "../_lib/api";
import { formatDate, formatNumber, humanize } from "../_lib/format";
import { useCrmList } from "../_lib/useCrmList";

type SectionId = "RESUMEN" | "NATURAL" | "ARRASTRE" | "TENDENCIA" | "PATIOS" | "CLIENTES" | "CONTRATOS" | "PAQUETES" | "COBRANZA" | "FINANZAS" | "EXCEDENTES" | "PAGOS" | "HISTORIAL" | "OPERACIONES" | "GUIA";
type ColumnId = "FUENTE" | "TIPO" | "REFERENCIA" | "CLIENTE" | "PATIO" | "LOCOMOTORA" | "VAGONES" | "SERVICIOS" | "ESTADO" | "SOLICITUD" | "FINALIZACION" | "INCIDENTES";
type PresetId = "MOVIMIENTOS" | "CONTRATOS" | "CIERRE" | "GENERAL" | "PERSONALIZADO";
type CrmPreviewSection = "CONTRATOS" | "PAQUETES" | "COBRANZA" | "FINANZAS" | "EXCEDENTES" | "PAGOS" | "HISTORIAL";
type CrmPreviewStatus = Record<CrmPreviewSection, { loading: boolean; error: string }>;
type ContractRule = NonNullable<Contract["paquetes"]>[number];
type ReportFilters = { empresaId?: number; localidadId?: number; origin?: "NATURAL" | "ARRASTRE" };
type RuleUsage = { used: number; limit: number | null; percent: number | null; excess: number };
type ContractComplianceRow = { key: string; monthKey: string; monthLabel: string; contract: Contract; rule: ContractRule; companyName: string; contractLabel: string; usage: RuleUsage };
type ClosingPreviewRow = {
  key: string;
  cut?: BillingCut;
  contract?: Contract;
  companyName: string;
  folio: string;
  period: string;
  contractLabel: string;
  movement: { billable: number; completed: number; cancelled: number; stopped: number; inProcess: number };
  state: string;
  amount: number | null;
  saved: boolean;
};

const DEFAULT_COLUMNS: ColumnId[] = ["REFERENCIA", "CLIENTE", "PATIO", "TIPO", "LOCOMOTORA", "VAGONES", "SERVICIOS", "ESTADO", "FINALIZACION"];
const DEFAULT_BILLABLE_STATUSES = ["CONCLUIDO", "CANCELADO", "DETENIDO", "EN_PROCESO"];

const PRESETS: Array<{ id: Exclude<PresetId, "PERSONALIZADO">; title: string; description: string; help: string; icon: LucideIcon; sections: SectionId[] }> = [
  { id: "MOVIMIENTOS", title: "Movimientos", description: "Operación, evolución, patios y clientes", help: "Analiza exclusivamente los movimientos del periodo y los registros que respaldan sus totales.", icon: BarChart3, sections: ["RESUMEN", "NATURAL", "ARRASTRE", "TENDENCIA", "PATIOS", "CLIENTES", "OPERACIONES", "GUIA"] },
  { id: "CONTRATOS", title: "Contrato y cumplimiento", description: "Vigencias, reglas, consumo y dinero", help: "Compara cada contrato contra movimientos cobrables, excedentes, montos y cambios registrados.", icon: BriefcaseBusiness, sections: ["CONTRATOS", "PAQUETES", "FINANZAS", "EXCEDENTES", "HISTORIAL", "OPERACIONES", "GUIA"] },
  { id: "CIERRE", title: "Cortes y cobranza", description: "Estados, factura, pagos y auditoría", help: "Da seguimiento a cada contrato-mes desde revisión hasta cobrado, incluyendo pagos y bitácora.", icon: FileCheck2, sections: ["COBRANZA", "FINANZAS", "EXCEDENTES", "PAGOS", "HISTORIAL", "PAQUETES", "GUIA"] },
  { id: "GENERAL", title: "General", description: "Operación, contrato, cortes y auditoría", help: "Concentra toda la operación, reglas, excedentes, finanzas, pagos e historial en un solo archivo.", icon: FileSpreadsheet, sections: ["RESUMEN", "NATURAL", "ARRASTRE", "TENDENCIA", "PATIOS", "CLIENTES", "CONTRATOS", "PAQUETES", "COBRANZA", "FINANZAS", "EXCEDENTES", "PAGOS", "HISTORIAL", "OPERACIONES", "GUIA"] },
];

const SECTIONS: Array<{ id: SectionId; title: string; description: string }> = [
  { id: "RESUMEN", title: "Resumen", description: "Consolidado, crecimiento, riesgos y concentración." },
  { id: "NATURAL", title: "Naturales", description: "Clientes, cumplimiento, lavado y torneado." },
  { id: "ARRASTRE", title: "Arrastre", description: "Clientes, vagones, cumplimiento y cancelación." },
  { id: "TENDENCIA", title: "Evolución del periodo", description: "Comparación por día, semana o mes." },
  { id: "PATIOS", title: "Volumen por patio", description: "Cada localidad por separado." },
  { id: "CLIENTES", title: "Volumen por cliente", description: "Movimientos y servicios por empresa." },
  { id: "CONTRATOS", title: "Contratos", description: "Vigencias, corte, monto y regla automática." },
  { id: "PAQUETES", title: "Cumplimiento contractual", description: "Consumo, límite y excedente calculados desde contrato." },
  { id: "COBRANZA", title: "Cortes y estados", description: "Avance, factura, progreso, monto opcional, cobrado y saldo." },
  { id: "FINANZAS", title: "Detalle financiero", description: "Base y extras divididos por servicio, contrato y mes." },
  { id: "EXCEDENTES", title: "Excedentes cobrables", description: "Operaciones exactas fuera de rango con tarifa e importe." },
  { id: "PAGOS", title: "Pagos registrados", description: "Pagos, referencias, métodos, fechas y usuarios." },
  { id: "HISTORIAL", title: "Historial de cortes", description: "Quién cambió qué, cuándo y de qué estado a cuál." },
  { id: "OPERACIONES", title: "Detalle de movimientos", description: "Registros que respaldan los totales." },
  { id: "GUIA", title: "Guía sencilla", description: "Explica cómo leer el archivo." },
];

const COLUMNS: Array<{ id: ColumnId; label: string }> = [
  { id: "REFERENCIA", label: "Referencia" }, { id: "CLIENTE", label: "Cliente" }, { id: "PATIO", label: "Localidad" },
  { id: "TIPO", label: "Natural o arrastre" }, { id: "LOCOMOTORA", label: "Locomotora" }, { id: "VAGONES", label: "Vagones" },
  { id: "SERVICIOS", label: "Servicios" }, { id: "ESTADO", label: "Estado" }, { id: "SOLICITUD", label: "Fecha de solicitud" },
  { id: "FINALIZACION", label: "Fecha de finalización" }, { id: "INCIDENTES", label: "Incidentes" }, { id: "FUENTE", label: "Sistema de origen" },
];

const HELP_STEPS = [
  {
    title: "Elija el tipo de reporte",
    description: "Cada opción prepara automáticamente las hojas más útiles para una necesidad distinta.",
    details: [
      "Movimientos: volumen, cumplimiento, evolución, patios, clientes y registros que respaldan los totales.",
      "Contrato y cumplimiento: usa el contrato vigente como fuente de verdad y calcula consumo contra sus reglas.",
      "Cortes y cobranza: muestra el avance de cada contrato-mes desde revisión hasta pagado, con factura, pagos e historial.",
      "General: reúne los tres reportes anteriores en hojas separadas.",
    ],
    target: "tipo-reporte",
    action: "Ver tipos de reporte",
  },
  {
    title: "Defina periodo y alcance",
    description: "Seleccione uno o varios meses, incluso no consecutivos; después elija cliente, patio y origen.",
    details: [
      "Cada mes seleccionado conserva su propio corte, consumo, excedentes y resultado económico.",
      "Guadalajara y los demás patios muestran únicamente movimientos Naturales.",
      "Arrastre aparece solo cuando el alcance incluye Torreón o todos los patios.",
    ],
    target: "alcance-reporte",
    action: "Configurar periodo",
  },
  {
    title: "Personalice solo si lo necesita",
    description: "La plantilla ya está lista. Este paso permite quitar hojas o elegir las columnas del detalle.",
    details: [
      "Cada apartado marcado se convierte en una hoja del Excel.",
      "Detalle de movimientos contiene los registros que comprueban los indicadores.",
      "Si el patio no es Torreón, Arrastre y Vagones se eliminan automáticamente.",
    ],
    target: "contenido-reporte",
    action: "Ver personalización",
  },
  {
    title: "Revise y descargue",
    description: "La vista previa enseña el contenido real antes de construir el archivo.",
    details: [
      "Cambie entre pestañas para revisar cada hoja.",
      "Si una hoja no tiene información, el reporte lo indicará claramente.",
      "Al final presione “Sí, descargar este Excel”; el archivo incluirá contrato, cumplimiento, excedentes, cortes, pagos y auditoría.",
    ],
    target: "vista-previa-excel",
    action: "Ir a la vista previa",
  },
] as const;

export default function ReportingPage() {
  const { analytics, filters } = useCommercialData();
  const [selectedMonths, setSelectedMonths] = useState<string[]>([filters.referenceDate.slice(0, 7)]);
  const sortedMonths = useMemo(() => [...selectedMonths].sort(), [selectedMonths]);
  const [selectedAnalytics, setSelectedAnalytics] = useState<AnalyticsSummary | null>(null);
  const [selectedAnalyticsLoading, setSelectedAnalyticsLoading] = useState(true);
  const [selectedAnalyticsError, setSelectedAnalyticsError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setSelectedAnalytics(null);
    setSelectedAnalyticsLoading(true);
    setSelectedAnalyticsError("");
    Promise.all(sortedMonths.map((month) => {
      const query = buildQuery({ period: "MONTH", reference: month, referenceDate: `${month}-01`, empresaId: filters.empresaId, localidadId: filters.localidadId, origin: filters.origin, page: 1, pageSize: 10_000 });
      return commercialApi<AnalyticsSummary>(`/bff/comercial/analitica?${query}`, { signal: controller.signal });
    }))
      .then((parts) => setSelectedAnalytics(mergeMonthlyAnalytics(parts, sortedMonths)))
      .catch((cause) => {
        if (!controller.signal.aborted) setSelectedAnalyticsError(cause instanceof Error ? cause.message : "No se pudieron cargar los meses seleccionados");
      })
      .finally(() => {
        if (!controller.signal.aborted) setSelectedAnalyticsLoading(false);
      });
    return () => controller.abort();
  }, [sortedMonths, filters.empresaId, filters.localidadId, filters.origin]);
  const selectedAnalyticsKeys = selectedAnalytics?.meta.selectedMonthKeys?.length
    ? [...selectedAnalytics.meta.selectedMonthKeys].sort()
    : selectedAnalytics ? [selectedAnalytics.meta.reference.slice(0, 7)] : [];
  const selectedAnalyticsMatches = selectedAnalyticsKeys.length === sortedMonths.length
    && selectedAnalyticsKeys.every((month, index) => month === sortedMonths[index]);
  const reportAnalytics = selectedAnalyticsMatches ? selectedAnalytics : null;
  const { items: contracts, loading: contractsLoading, error: contractsError } = useCrmList<Contract>("/bff/comercial/contratos?pageSize=100");
  const cutWindow = selectedMonthQueryWindow(sortedMonths);
  const cutQuery = buildQuery({ pageSize: 100, desde: cutWindow.from, hasta: cutWindow.to, includeHistorial: 1 });
  const { items: cuts, loading: cutsLoading, error: cutsError } = useCrmList<BillingCut>(`/bff/comercial/cobranza/cortes?${cutQuery}`);
  const [preset, setPreset] = useState<PresetId>("MOVIMIENTOS");
  const [sections, setSections] = useState<SectionId[]>(PRESETS[0].sections);
  const [columns, setColumns] = useState<ColumnId[]>(DEFAULT_COLUMNS);
  const [advanced, setAdvanced] = useState(false);
  const [name, setName] = useState("Reporte de movimientos");
  const [downloading, setDownloading] = useState(false);
  const [message, setMessage] = useState("");
  const [previewSection, setPreviewSection] = useState<SectionId>("RESUMEN");
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpStep, setHelpStep] = useState(0);
  const previewRef = useRef<HTMLElement>(null);
  const catalogAnalytics = reportAnalytics || analytics;
  const selectedYardName = filters.localidadId ? catalogAnalytics?.catalogs.localities.find((item) => item.id === filters.localidadId)?.nombre : undefined;
  const arrastreAvailable = !filters.localidadId || isTorreon(selectedYardName);
  const showArrastre = arrastreAvailable && filters.origin !== "NATURAL";
  const showNatural = filters.origin !== "ARRASTRE";
  const effectiveSections = sections.filter((section) => section !== "ARRASTRE" || showArrastre);
  const effectiveColumns = columns.filter((column) => showArrastre || column !== "VAGONES");

  function choosePreset(item: typeof PRESETS[number]) {
    setPreset(item.id);
    setSections(item.sections);
    setColumns(DEFAULT_COLUMNS);
    setName(item.title);
    setAdvanced(false);
    setMessage("");
  }

  function toggleSection(value: SectionId) {
    setPreset("PERSONALIZADO");
    setSections((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  }

  function toggleColumn(value: ColumnId) {
    setPreset("PERSONALIZADO");
    setColumns((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  }

  async function download() {
    if (selectedAnalyticsLoading || !reportAnalytics) return setMessage(selectedAnalyticsError || "Espere a que termine de cargar el mes seleccionado.");
    if (!effectiveSections.length) return setMessage("Seleccione al menos un contenido para el archivo.");
    if (effectiveSections.includes("OPERACIONES") && !effectiveColumns.length) return setMessage("Seleccione al menos una columna para el detalle de movimientos.");
    setDownloading(true);
    setMessage("");
    try {
      const response = await fetch("/bff/comercial/excel", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ template: "COMPLETO", reportName: name, sections: effectiveSections, operationColumns: effectiveColumns, includeArrastre: showArrastre, months: sortedMonths, reference: sortedMonths[0], referenceDate: `${sortedMonths[0]}-01`, period: "MONTH", empresaId: filters.empresaId, localidadId: filters.localidadId, origin: filters.origin }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "No se pudo generar el Excel");
      }
      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = response.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1] || "COSAIF_Reporte_Comercial.xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(href);
      setMessage("Excel construido correctamente.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "No se pudo generar el Excel");
    } finally {
      setDownloading(false);
    }
  }

  const selectedName = preset === "PERSONALIZADO" ? "Reporte personalizado" : PRESETS.find((item) => item.id === preset)?.title;
  const client = filters.empresaId ? catalogAnalytics?.catalogs.companies.find((item) => item.id === filters.empresaId)?.nombre : "Todos los clientes";
  const yard = selectedYardName || "Todas las localidades";
  const scopedFilters = useMemo<ReportFilters>(() => ({ empresaId: filters.empresaId, localidadId: filters.localidadId, origin: filters.origin }), [filters.empresaId, filters.localidadId, filters.origin]);
  const visibleContracts = useMemo(() => {
    const from = reportAnalytics ? Date.parse(reportAnalytics.meta.range.from) : Number.NEGATIVE_INFINITY;
    const to = reportAnalytics ? Date.parse(reportAnalytics.meta.range.toExclusive) : Number.POSITIVE_INFINITY;
    return contracts.filter((item) => contractMatchesScope(item, scopedFilters, from, to) && sortedMonths.some((month) => contractOverlapsMonth(item, month)));
  }, [reportAnalytics, contracts, scopedFilters, sortedMonths]);
  const selectedCuts = useMemo(() => cuts.filter((cut) => sortedMonths.some((month) => cutOverlapsMonth(cut, month))), [cuts, sortedMonths]);
  const complianceRows = useMemo(() => reportAnalytics ? buildComplianceRows(visibleContracts, reportAnalytics, scopedFilters) : [], [reportAnalytics, visibleContracts, scopedFilters]);
  const closingRows = useMemo(() => reportAnalytics ? buildClosingRows({ contracts: visibleContracts, cuts: selectedCuts, analytics: reportAnalytics, filters: scopedFilters }) : [], [reportAnalytics, visibleContracts, selectedCuts, scopedFilters]);
  const crmStatus: CrmPreviewStatus = {
    CONTRATOS: { loading: contractsLoading, error: contractsError },
    PAQUETES: { loading: contractsLoading, error: contractsError },
    COBRANZA: { loading: cutsLoading || selectedAnalyticsLoading, error: cutsError || selectedAnalyticsError },
    FINANZAS: { loading: cutsLoading || selectedAnalyticsLoading, error: cutsError || selectedAnalyticsError },
    EXCEDENTES: { loading: contractsLoading || selectedAnalyticsLoading, error: contractsError || selectedAnalyticsError },
    PAGOS: { loading: cutsLoading || selectedAnalyticsLoading, error: cutsError || selectedAnalyticsError },
    HISTORIAL: { loading: cutsLoading || selectedAnalyticsLoading, error: cutsError || selectedAnalyticsError },
  };
  const activePreviewSection = effectiveSections.includes(previewSection) ? previewSection : effectiveSections[0] || "RESUMEN";

  function openHelp() {
    setHelpStep(0);
    setHelpOpen(true);
  }

  function goToHelpTarget(target: string) {
    setHelpOpen(false);
    requestAnimationFrame(() => document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  return <div className="space-y-5">
    <ModuleHeader eyebrow="Reportería comercial" title="Constructor de reportes" description="Primero elija el mes de solicitud; después refine cliente, patio y tipo de trabajo." icon={FileSpreadsheet} actions={<button type="button" onClick={openHelp} className="commercial-secondary border-white/20 bg-white/10 text-white hover:bg-white/20"><CircleHelp className="h-4 w-4"/>Ayuda</button>}/>

    <section id="tipo-reporte" className="commercial-card scroll-mt-5 p-5">
      <div><p className="commercial-label">1 · Tipo de reporte</p><h2 className="text-xl font-black text-[var(--app-text)]">¿Qué quiere revisar?</h2><p className="mt-1 text-sm text-[var(--app-text-muted)]">Seleccione una base; después puede agregar o quitar apartados.</p></div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">{PRESETS.map((item) => { const Icon = item.icon; const selected = preset === item.id; return <button key={item.id} type="button" aria-pressed={selected} onClick={() => choosePreset(item)} className={`flex min-h-28 items-center gap-4 rounded-2xl border p-4 text-left transition ${selected ? "border-emerald-500 bg-emerald-50 shadow-sm dark:bg-emerald-950/20" : "border-[var(--app-border)] bg-[var(--app-surface-subtle)] hover:border-emerald-300"}`}><span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${selected ? "bg-emerald-600 text-white" : "bg-[var(--app-surface-muted)] text-[var(--app-text)]"}`}><Icon className="h-5 w-5"/></span><span className="min-w-0 flex-1"><span className="block text-sm font-black text-[var(--app-text)]">{item.title}</span><span className="mt-1 block text-xs font-bold leading-5 text-[var(--app-text-muted)]">{item.description}</span></span>{selected ? <Check className="h-5 w-5 shrink-0 text-emerald-700"/> : null}</button>; })}</div>
    </section>

    <div id="alcance-reporte" className="space-y-4 scroll-mt-5"><ReportMonthSelector selectedMonths={sortedMonths} onChange={setSelectedMonths} loading={selectedAnalyticsLoading} total={reportAnalytics?.operations.meta.total}/><CommercialPeriodBar showOrigin showPeriod={false}/></div>
    {selectedAnalyticsError ? <Notice tone="rose" title="No se pudieron cargar los meses" text={selectedAnalyticsError}/> : null}

    <section id="contenido-reporte" className="commercial-card scroll-mt-5 overflow-hidden">
      <button type="button" onClick={() => setAdvanced((value) => !value)} className="flex w-full items-center justify-between gap-4 p-5 text-left"><span className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-200"><Settings2 className="h-5 w-5"/></span><span><span className="commercial-label">Opcional</span><span className="block text-base font-black text-[var(--app-text)]">Personalizar apartados y columnas</span><span className="mt-0.5 block text-xs text-[var(--app-text-muted)]">La opción elegida ya está lista; abra esto solo si necesita cambiarla.</span></span></span>{advanced ? <ChevronUp className="h-5 w-5 text-[var(--app-text-muted)]"/> : <ChevronDown className="h-5 w-5 text-[var(--app-text-muted)]"/>}</button>
      {advanced ? <div className="border-t border-[var(--app-border)] p-5"><p className="text-sm font-black text-[var(--app-text)]">Apartados del archivo</p><div className="mt-3 grid gap-2 md:grid-cols-2">{SECTIONS.filter((item) => item.id !== "ARRASTRE" || showArrastre).map((item) => { const selected = effectiveSections.includes(item.id); return <label key={item.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${selected ? "border-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/15" : "border-[var(--app-border)]"}`}><input type="checkbox" checked={selected} onChange={() => toggleSection(item.id)} className="mt-1 h-4 w-4"/><span><span className="block text-sm font-black text-[var(--app-text)]">{item.title}</span><span className="mt-0.5 block text-xs text-[var(--app-text-muted)]">{item.description}</span></span></label>; })}</div>{effectiveSections.includes("OPERACIONES") ? <div className="mt-6 border-t border-[var(--app-border)] pt-5"><div className="flex items-center gap-2"><TableProperties className="h-5 w-5 text-blue-600"/><p className="text-sm font-black text-[var(--app-text)]">Columnas del detalle de movimientos</p></div><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{COLUMNS.filter((column) => showArrastre || column.id !== "VAGONES").map((column) => <label key={column.id} className="flex cursor-pointer items-center gap-2 rounded-xl bg-[var(--app-surface-subtle)] p-3"><input type="checkbox" checked={effectiveColumns.includes(column.id)} onChange={() => toggleColumn(column.id)} className="h-4 w-4"/><span className="text-xs font-bold text-[var(--app-text)]">{column.label}</span></label>)}</div></div> : null}</div> : null}
    </section>

    <section className="commercial-card p-5">
      <div className="grid gap-4 lg:grid-cols-[1fr_minmax(260px_420px)_220px] lg:items-end">
        <div className="flex items-center gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-950 text-white"><FileSpreadsheet className="h-5 w-5"/></span><div><p className="commercial-label">Reporte preparado</p><h2 className="text-lg font-black text-[var(--app-text)]">{selectedName}</h2><p className="mt-1 text-xs font-bold text-[var(--app-text-muted)]">{reportAnalytics?.meta.periodLabel || selectedMonthsLabel(sortedMonths)} · {client} · {yard} · {formatNumber(reportAnalytics?.operations.meta.total || 0)} movimientos</p></div></div>
        <label><span className="commercial-label">Nombre del archivo</span><input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} className="commercial-input"/></label>
        <button type="button" disabled={selectedAnalyticsLoading || !reportAnalytics} onClick={() => previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })} className="commercial-primary w-full"><Eye className="h-4 w-4"/>{selectedAnalyticsLoading ? "Cargando mes…" : "Revisar reporte"}</button>
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5"><span className="commercial-label mr-2 self-center">Incluye:</span>{effectiveSections.map((id) => <span key={id} className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-800 dark:bg-emerald-950/25 dark:text-emerald-200">{SECTIONS.find((item) => item.id === id)?.title}</span>)}</div>
    </section>

    <section ref={previewRef} id="vista-previa-excel" className="commercial-card scroll-mt-5 overflow-hidden">
      <header className="flex flex-col gap-4 border-b border-[var(--app-border)] bg-slate-950 p-5 text-white sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-600"><Eye className="h-5 w-5"/></span><div><p className="text-[10px] font-black uppercase tracking-[.14em] text-emerald-300">Vista previa</p><h2 className="text-xl font-black">Así quedará el reporte</h2><p className="mt-1 text-xs text-slate-300">Revise cada pestaña y descargue únicamente cuando el contenido sea correcto.</p></div></div><span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-black">{name || "Reporte comercial"}</span></header>
      <div className="border-b border-[var(--app-border)] bg-[var(--app-surface-muted)] px-4 pt-3"><div className="flex gap-1 overflow-x-auto">{effectiveSections.map((id) => <button key={id} type="button" onClick={() => setPreviewSection(id)} className={`shrink-0 rounded-t-xl px-4 py-2.5 text-xs font-black ${activePreviewSection === id ? "bg-white text-emerald-800 shadow-sm dark:bg-slate-950 dark:text-emerald-300" : "text-[var(--app-text-muted)]"}`}>{SECTIONS.find((item) => item.id === id)?.title}</button>)}</div></div>
      <div className="bg-slate-100 p-3 sm:p-6 dark:bg-slate-950/40"><div className="min-h-[360px] overflow-hidden rounded-lg border border-slate-300 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-950"><div className="flex items-center justify-between border-b border-slate-200 bg-emerald-700 px-4 py-3 text-white dark:border-slate-800"><div><p className="text-[10px] font-black uppercase tracking-[.12em] text-emerald-100">COSAIF Comercial</p><p className="text-sm font-black">{SECTIONS.find((item) => item.id === activePreviewSection)?.title}</p></div><p className="text-xs font-bold">{reportAnalytics?.meta.periodLabel || selectedMonthsLabel(sortedMonths)}</p></div><ExcelPreview section={activePreviewSection} columns={effectiveColumns} analytics={reportAnalytics} contracts={visibleContracts} complianceRows={complianceRows} closingRows={closingRows} crmStatus={crmStatus} showNatural={showNatural} showArrastre={showArrastre}/></div></div>
      <footer className="flex flex-col gap-4 border-t border-[var(--app-border)] p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-black text-[var(--app-text)]">¿La información le sirve así?</p><p className="mt-1 text-xs text-[var(--app-text-muted)]">Puede volver arriba a cambiar mes de solicitud, cliente, patio, plantilla o columnas.</p></div><div className="sm:min-w-64">{message ? <div className="mb-3"><Notice tone={message.includes("correctamente") ? "blue" : "rose"} title={message.includes("correctamente") ? "Reporte listo" : "Revise la configuración"} text={message}/></div> : null}<button type="button" onClick={download} disabled={downloading || selectedAnalyticsLoading || !reportAnalytics} className="commercial-primary w-full">{downloading || selectedAnalyticsLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : <Download className="h-4 w-4"/>}{downloading ? "Construyendo Excel…" : selectedAnalyticsLoading ? "Cargando mes…" : "Descargar Excel"}</button></div></footer>
    </section>
    <button type="button" onClick={openHelp} className="fixed bottom-5 right-5 z-50 flex min-h-12 items-center gap-2 rounded-full bg-slate-950 px-5 text-sm font-black text-white shadow-2xl ring-1 ring-white/20 hover:bg-emerald-800"><CircleHelp className="h-5 w-5"/>Ayuda</button>
    {helpOpen ? <ReportHelp step={helpStep} setStep={setHelpStep} onClose={() => setHelpOpen(false)} onGo={goToHelpTarget}/> : null}
  </div>;
}

const REPORT_MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function ReportMonthSelector({ selectedMonths, onChange, loading, total }: { selectedMonths: string[]; onChange: (months: string[]) => void; loading: boolean; total?: number }) {
  const [year, setYear] = useState(Number(selectedMonths[selectedMonths.length - 1]?.slice(0, 4) || new Date().getFullYear()));
  const [pickerOpen, setPickerOpen] = useState(false);
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 2014 }, (_, index) => currentYear + 1 - index);
  if (!years.includes(year)) years.push(year);
  years.sort((left, right) => right - left);
  function toggle(monthIndex: number) {
    const key = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
    if (selectedMonths.includes(key)) {
      if (selectedMonths.length === 1) return;
      onChange(selectedMonths.filter((month) => month !== key));
    } else onChange([...selectedMonths, key].sort());
  }
  function moveSingleMonth(delta: number) {
    if (selectedMonths.length !== 1) return;
    const [selectedYear, selectedMonth] = selectedMonths[0].split("-").map(Number);
    const target = new Date(Date.UTC(selectedYear, selectedMonth - 1 + delta, 1));
    const key = `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, "0")}`;
    setYear(target.getUTCFullYear());
    onChange([key]);
  }
  return <section className="commercial-card p-4 sm:p-5">
    <header className="flex flex-col gap-3 border-b border-[var(--app-border)] pb-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="commercial-label">Periodo del reporte</p><h2 className="text-lg font-black text-[var(--app-text)]">Mes de solicitud</h2><p className="mt-1 text-xs font-bold text-[var(--app-text-muted)]">Un movimiento pertenece al mes en que fue solicitado, aunque termine después.</p></div>{loading ? <span className="inline-flex items-center gap-2 self-start rounded-full bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700 dark:bg-blue-950/30 dark:text-blue-200"><Loader2 className="h-3.5 w-3.5 animate-spin"/>Consultando movimientos</span> : <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-black text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">{formatNumber(total || 0)} movimientos encontrados</span>}</header>
    <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-2">
        <button type="button" disabled={selectedMonths.length !== 1 || loading} onClick={() => moveSingleMonth(-1)} className="commercial-secondary h-11 w-11 shrink-0 p-0" aria-label="Mes anterior"><ArrowLeft className="h-4 w-4"/></button>
        <div className="min-w-0 flex-1 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 dark:border-emerald-900 dark:bg-emerald-950/20"><p className="text-[10px] font-black uppercase tracking-[.12em] text-emerald-700 dark:text-emerald-300">{selectedMonths.length === 1 ? "Mes seleccionado" : `${selectedMonths.length} meses seleccionados`}</p><p className="mt-1 text-base font-black capitalize text-[var(--app-text)]">{selectedMonthsLabel(selectedMonths)}</p></div>
        <button type="button" disabled={selectedMonths.length !== 1 || loading} onClick={() => moveSingleMonth(1)} className="commercial-secondary h-11 w-11 shrink-0 p-0" aria-label="Mes siguiente"><ArrowRight className="h-4 w-4"/></button>
      </div>
      <button type="button" onClick={() => setPickerOpen((value) => !value)} className="commercial-secondary"><CalendarRange className="h-4 w-4"/>{pickerOpen ? "Ocultar calendario" : selectedMonths.length > 1 ? "Cambiar meses" : "Elegir varios meses"}{pickerOpen ? <ChevronUp className="h-4 w-4"/> : <ChevronDown className="h-4 w-4"/>}</button>
    </div>
    {pickerOpen ? <div className="mt-4 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] p-4"><div className="grid gap-4 lg:grid-cols-[150px_1fr]"><label><span className="commercial-label">Año</span><select value={year} onChange={(event) => setYear(Number(event.target.value))} className="commercial-select">{years.map((value) => <option key={value} value={value}>{value}</option>)}</select></label><div><span className="commercial-label">Seleccione los meses</span><div className="mt-1 grid grid-cols-4 gap-2 sm:grid-cols-6 xl:grid-cols-12">{REPORT_MONTHS.map((label, index) => { const key = `${year}-${String(index + 1).padStart(2, "0")}`; const selected = selectedMonths.includes(key); return <button key={key} type="button" aria-pressed={selected} onClick={() => toggle(index)} className={`min-h-10 rounded-xl border px-2 text-xs font-black transition ${selected ? "border-emerald-600 bg-emerald-600 text-white shadow-sm" : "border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text-muted)] hover:border-emerald-300"}`}>{label}</button>; })}</div></div></div>{selectedMonths.length > 1 ? <div className="mt-4 flex flex-wrap gap-2">{selectedMonths.map((month) => <button key={month} type="button" onClick={() => onChange(selectedMonths.filter((value) => value !== month))} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-black text-slate-700 shadow-sm dark:bg-slate-900 dark:text-slate-200">{monthLabel(month)}<X className="h-3.5 w-3.5"/></button>)}</div> : null}</div> : null}
  </section>;
}

function ReportHelp({ step, setStep, onClose, onGo }: { step: number; setStep: (step: number) => void; onClose: () => void; onGo: (target: string) => void }) {
  const current = HELP_STEPS[step];
  return <Modal title="Ayuda para generar el reporte" description={`Paso ${step + 1} de ${HELP_STEPS.length} · Puede abrir esta ayuda en cualquier momento.`} onClose={onClose}>
    <div className="p-5">
      <div className="flex gap-2">{HELP_STEPS.map((item, index) => <button key={item.title} type="button" onClick={() => setStep(index)} aria-label={`Ir al paso ${index + 1}`} className={`h-2 flex-1 rounded-full ${index <= step ? "bg-emerald-600" : "bg-slate-200 dark:bg-slate-800"}`}/>)}</div>
      <div className="mt-6 rounded-2xl bg-[var(--app-surface-subtle)] p-5"><span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-100 text-lg font-black text-emerald-800">{step + 1}</span><h3 className="mt-4 text-xl font-black text-[var(--app-text)]">{current.title}</h3><p className="mt-2 text-sm leading-6 text-[var(--app-text-muted)]">{current.description}</p><ul className="mt-5 space-y-3">{current.details.map((detail) => <li key={detail} className="flex gap-3 text-sm font-bold leading-6 text-[var(--app-text)]"><Check className="mt-1 h-4 w-4 shrink-0 text-emerald-600"/><span>{detail}</span></li>)}</ul></div>
      <button type="button" onClick={() => onGo(current.target)} className="commercial-secondary mt-4 w-full"><Eye className="h-4 w-4"/>{current.action}</button>
      <div className="mt-5 flex items-center justify-between gap-3"><button type="button" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} className="commercial-secondary"><ArrowLeft className="h-4 w-4"/>Anterior</button>{step < HELP_STEPS.length - 1 ? <button type="button" onClick={() => setStep(step + 1)} className="commercial-primary">Siguiente<ArrowRight className="h-4 w-4"/></button> : <button type="button" onClick={onClose} className="commercial-primary"><Check className="h-4 w-4"/>Entendido</button>}</div>
    </div>
  </Modal>;
}

function ExcelPreview({ section, columns, analytics, contracts, complianceRows, closingRows, crmStatus, showNatural, showArrastre }: { section: SectionId; columns: ColumnId[]; analytics: AnalyticsSummary | null; contracts: Contract[]; complianceRows: ContractComplianceRow[]; closingRows: ClosingPreviewRow[]; crmStatus: CrmPreviewStatus; showNatural: boolean; showArrastre: boolean }) {
  if (!analytics) return <PreviewEmpty text="Cargando los datos de la vista previa…"/>;
  if (["CONTRATOS", "PAQUETES", "COBRANZA", "FINANZAS", "EXCEDENTES", "PAGOS", "HISTORIAL"].includes(section)) {
    const status = crmStatus[section as CrmPreviewSection];
    if (status.loading) return <PreviewEmpty text="Consultando la información comercial para este alcance…"/>;
    if (status.error) return <PreviewEmpty text="La fuente comercial no está disponible. Verifique que msComercial esté activo y configurado."/>;
  }
  if (section === "RESUMEN") return <ExecutiveSummaryPreview analytics={analytics} showNatural={showNatural} showArrastre={showArrastre}/>;
  if (section === "NATURAL") return <OriginExecutivePreview analytics={analytics} origin="NATURAL"/>;
  if (section === "ARRASTRE") return <OriginExecutivePreview analytics={analytics} origin="ARRASTRE"/>;
  if (section === "TENDENCIA") return analytics.trend.some((item) => item.total > 0) ? <PreviewTable headers={["Periodo", "Total", "Concluidos", "Cancelados", ...(showNatural ? ["Naturales"] : []), ...(showArrastre ? ["Arrastre"] : []), "Lavados", "Torneados"]} rows={analytics.trend.map((item) => [item.label, item.total, item.completed, item.cancelled, ...(showNatural ? [item.natural] : []), ...(showArrastre ? [item.arrastre] : []), item.wash, item.turning])}/> : <PreviewEmpty text="No hay datos disponibles para el alcance seleccionado."/>;
  if (section === "PATIOS") return <PreviewTable headers={["Localidad", "Total", "Concluidos", ...(showNatural ? ["Naturales"] : []), ...(showArrastre ? ["Arrastre", "Vagones"] : []), "Lavados", "Torneados"]} rows={analytics.yards.filter((item) => item.total > 0).map((item) => [item.name, item.total, item.completed, ...(showNatural ? [item.natural] : []), ...(showArrastre ? [item.arrastre, item.wagons] : []), item.wash, item.turning])} empty="No hay datos disponibles para los patios y el periodo seleccionados."/>;
  if (section === "CLIENTES") return <PreviewTable headers={["Cliente", "Total", "Concluidos", ...(showNatural ? ["Naturales"] : []), ...(showArrastre ? ["Arrastre", "Vagones"] : []), "Lavados", "Torneados"]} rows={analytics.clients.filter((item) => item.total > 0).map((item) => [item.name, item.total, item.completed, ...(showNatural ? [item.natural] : []), ...(showArrastre ? [item.arrastre, item.wagons] : []), item.wash, item.turning])} empty="No hay datos disponibles para los clientes y el periodo seleccionados."/>;
  if (section === "CONTRATOS") return <PreviewTable headers={["Cliente", "Folio", "Contrato", "Vigencia", "Corte", "Monto periodo", "Regla automática"]} rows={contracts.map((item) => [item.cliente?.empresaNombre || "—", item.folio, item.nombre, `${formatDate(item.fechaInicio)} – ${formatDate(item.fechaFin)}`, cutLabel(item.diaCorte), item.montoMaximo ? moneyText(Number(item.montoMaximo), item.moneda) : "Sin monto", contractRuleSummary(primaryRule(item))])} empty="No hay contratos vigentes que coincidan con el alcance seleccionado."/>;
  if (section === "PAQUETES") return <ContractCompliancePreview rows={complianceRows}/>;
  if (section === "COBRANZA") return <ClosingTrackingPreview rows={closingRows}/>;
  if (section === "FINANZAS") return <PreviewTable headers={["Cliente", "Contrato", "Estado", "Monto oficial", "Cobrado", "Saldo", "Información económica"]} rows={closingRows.map((item) => [item.companyName, item.contractLabel, humanize(item.state), item.cut?.cobranza.total == null ? "Opcional / no capturado" : moneyText(item.cut.cobranza.total), moneyText(item.cut?.cobranza.pagado || 0), item.cut?.cobranza.saldo == null ? "—" : moneyText(item.cut.cobranza.saldo), item.cut?.cobranza.total == null ? "Opcional" : "Capturado"])} empty="No hay cortes para mostrar en el detalle financiero."/>;
  if (section === "EXCEDENTES") return <PreviewTable headers={["Mes", "Cliente", "Contrato", "Servicio", "Incluido", "Consumido", "Excedente"]} rows={complianceRows.filter((item) => item.usage.excess > 0).map((item) => [item.monthLabel, item.companyName, item.contractLabel, humanize(item.rule.servicio), item.usage.limit == null ? "Sin límite" : item.usage.limit, item.usage.used, item.usage.excess])} empty="No existen reglas con consumo fuera de rango en los meses seleccionados."/>;
  if (section === "PAGOS") {
    const paymentRows = closingRows.flatMap((item) => (item.cut?.pagos || []).map((payment) => [item.companyName, item.contractLabel, item.folio, formatDate(payment.fechaPago), moneyText(Number(payment.monto)), payment.referencia || "—", payment.metodo || "—", payment.registradoPorId ? `Usuario #${payment.registradoPorId}` : "—"]));
    return <PreviewTable headers={["Cliente", "Contrato", "Corte", "Fecha", "Monto", "Referencia", "Método", "Registró"]} rows={paymentRows} empty="No hay pagos registrados para los meses seleccionados."/>;
  }
  if (section === "HISTORIAL") {
    const historyRows = closingRows.flatMap((item) => (item.cut?.historial || []).map((history) => [item.companyName, item.contractLabel, item.folio, humanize(history.accion), humanize(history.estadoAnterior), humanize(history.estadoNuevo), history.actorNombre || `${humanize(history.actorRol)} #${history.actorId}`, formatDate(history.createdAt)]));
    return <PreviewTable headers={["Cliente", "Contrato", "Corte", "Acción", "Estado anterior", "Estado nuevo", "Usuario", "Fecha"]} rows={historyRows} empty="No hay cambios auditables para los cortes seleccionados."/>;
  }
  if (section === "OPERACIONES") {
    const selectedColumns = columns.length ? columns : DEFAULT_COLUMNS;
    return <PreviewTable headers={selectedColumns.map((id) => COLUMNS.find((item) => item.id === id)?.label || id)} rows={analytics.operations.data.map((operation) => selectedColumns.map((id) => operationPreviewValue(operation, id)))} totalRows={analytics.operations.meta.total} empty="No hay movimientos para mostrar con estos filtros."/>;
  }
  return <PreviewTable headers={["Apartado", "Qué contiene"]} rows={SECTIONS.filter((item) => item.id !== "GUIA").map((item) => [item.title, item.description])}/>;
}

function ContractCompliancePreview({ rows }: { rows: ContractComplianceRow[] }) {
  if (!rows.length) return <PreviewEmpty text="No hay contratos vigentes con regla automática para el cliente, patio y periodo seleccionados."/>;
  const withLimit = rows.filter((row) => row.usage.limit != null);
  const exceeded = rows.filter((row) => row.usage.excess > 0);
  const consumed = rows.reduce((sum, row) => sum + row.usage.used, 0);
  return <div className="space-y-5 p-5">
    <div><p className="text-[10px] font-black uppercase tracking-[.12em] text-emerald-700">Análisis del periodo</p><h3 className="mt-1 text-xl font-black text-slate-950 dark:text-white">Contrato vigente contra movimientos cobrables</h3><p className="mt-1 text-xs font-bold text-slate-500">El consumo se calcula con servicio, patio, operación y estados definidos en el contrato.</p></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><PreviewMetric label="Reglas evaluadas" value={formatNumber(rows.length)} tone="blue"/><PreviewMetric label="Consumo de las reglas" value={formatNumber(consumed)} tone="emerald"/><PreviewMetric label="Dentro del límite" value={formatNumber(Math.max(0, withLimit.length - exceeded.length))} tone="emerald"/><PreviewMetric label="Con excedente" value={formatNumber(exceeded.length)} tone={exceeded.length ? "rose" : "emerald"}/></div>
    <PreviewTable headers={["Mes", "Cliente", "Contrato", "Regla", "Servicio", "Estados cobrables", "Incluido", "Consumido", "Excedente"]} rows={rows.map(({ monthLabel, rule, companyName, contractLabel, usage }) => [monthLabel, companyName, contractLabel, rule.nombre, humanize(rule.servicio), billableStatuses(rule).map(humanize).join(", "), usage.limit == null ? "Sin límite" : formatNumber(usage.limit), formatNumber(usage.used), formatNumber(usage.excess)])}/>
  </div>;
}

function ClosingTrackingPreview({ rows }: { rows: ClosingPreviewRow[] }) {
  if (!rows.length) return <PreviewEmpty text="No hay contratos vigentes ni cortes guardados para el alcance y periodo seleccionados."/>;
  const pending = rows.filter((item) => !item.saved);
  const saved = rows.filter((item) => item.saved);
  const completed = rows.filter((item) => ["PAGADO", "CANCELADO"].includes(item.state));
  const totalBillable = rows.reduce((sum, item) => sum + item.movement.billable, 0);
  return <div className="space-y-5 p-5">
    <div><p className="text-[10px] font-black uppercase tracking-[.12em] text-blue-700">Seguimiento por contrato y mes</p><h3 className="mt-1 text-xl font-black text-slate-950 dark:text-white">Revisión → aprobación → factura → pago</h3><p className="mt-1 text-xs font-bold text-slate-500">Cada fila corresponde a un contrato-mes y conserva su estado, monto opcional y evidencia de movimientos.</p></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><PreviewMetric label="Contrato-mes" value={formatNumber(rows.length)} tone="blue"/><PreviewMetric label="Registrados" value={formatNumber(saved.length)} tone="emerald"/><PreviewMetric label="Cerrados" value={`${formatNumber(completed.length)} de ${formatNumber(rows.length)}`} tone={completed.length === rows.length ? "emerald" : "amber"}/><PreviewMetric label="Movimientos cobrables" value={formatNumber(totalBillable)} tone="blue"/></div>
    <PreviewTable headers={["Cliente", "Corte", "Periodo", "Contrato", "Cobrables", "Estado", "Monto"]} rows={rows.map((item) => [item.companyName, item.folio, item.period, item.contractLabel, item.movement.billable, item.saved ? humanize(item.state) : "Pendiente de generar", item.amount == null ? "Monto opcional" : moneyText(item.amount)])}/>
    {pending.length ? <p className="rounded-xl bg-amber-50 px-4 py-3 text-xs font-bold text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">{pending.length} contrato-mes todavía no tiene corte guardado; aparece para que no se pierda del seguimiento.</p> : null}
  </div>;
}

function ExecutiveSummaryPreview({ analytics, showNatural, showArrastre }: { analytics: AnalyticsSummary; showNatural: boolean; showArrastre: boolean }) {
  if (!analytics.kpis.operations) return <PreviewEmpty text="No hay datos disponibles para el periodo, cliente, patio y tipo de operación seleccionados."/>;
  const natural = originStats(analytics, "NATURAL");
  const arrastre = originStats(analytics, "ARRASTRE");
  const completion = analytics.kpis.operations ? analytics.kpis.completed / analytics.kpis.operations * 100 : 0;
  const cancellation = analytics.kpis.operations ? analytics.kpis.cancelled / analytics.kpis.operations * 100 : 0;
  const incidentsPerHundred = analytics.kpis.operations ? analytics.kpis.incidents / analytics.kpis.operations * 100 : 0;
  const topYard = [...analytics.yards].sort((a, b) => b.total - a.total)[0];
  const mainBusiness = showArrastre && (!showNatural || arrastre.concentration > natural.concentration) ? arrastre : natural;
  const mainBusinessName = showArrastre && (!showNatural || arrastre.concentration > natural.concentration) ? "Arrastre" : "Natural";
  return <div className="space-y-5 p-5">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><PreviewMetric label="Volumen consolidado" value={formatNumber(analytics.kpis.operations)}/><PreviewMetric label="Cumplimiento" value={`${completion.toFixed(1)}%`} tone={completion >= 90 ? "emerald" : "amber"}/><PreviewMetric label="Cambio vs periodo anterior" value={`${analytics.kpis.periodGrowthPct >= 0 ? "+" : ""}${analytics.kpis.periodGrowthPct}%`} tone={analytics.kpis.periodGrowthPct >= 0 ? "emerald" : "rose"}/><PreviewMetric label="Incidentes por 100 operaciones" value={incidentsPerHundred.toFixed(1)} tone={incidentsPerHundred <= 3 ? "emerald" : "amber"}/></div>
    <div className={`grid gap-4 ${showNatural && showArrastre ? "lg:grid-cols-2" : "grid-cols-1"}`}>{showNatural ? <BusinessSegmentCard title="Naturales" color="emerald" stats={natural} details={[{ label: "Lavados", value: formatNumber(analytics.kpis.wash) }, { label: "Torneados", value: formatNumber(analytics.kpis.turning) }]}/> : null}{showArrastre ? <BusinessSegmentCard title="Arrastre" color="blue" stats={arrastre} details={[{ label: "Vagones", value: formatNumber(arrastre.wagons) }, { label: "Vagones / solicitud", value: arrastre.total ? (arrastre.wagons / arrastre.total).toFixed(1) : "0" }]}/> : null}</div>
    <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]"><ExecutiveTrendChart analytics={analytics} showNatural={showNatural} showArrastre={showArrastre}/><div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800"><p className="text-xs font-black uppercase tracking-[.1em] text-slate-500">Indicadores clave</p><div className="mt-3 space-y-2"><ManagementSignal label="Cumplimiento consolidado" value={`${completion.toFixed(1)}%`} status={completion >= 95 ? "good" : completion >= 85 ? "watch" : "risk"}/><ManagementSignal label="Tasa de cancelación" value={`${cancellation.toFixed(1)}%`} status={cancellation <= 3 ? "good" : cancellation <= 8 ? "watch" : "risk"}/><ManagementSignal label="Patio con mayor volumen" value={topYard ? `${topYard.name} · ${formatNumber(topYard.total)}` : "Sin datos"} status="neutral"/><ManagementSignal label="Concentración principal" value={`${mainBusinessName}: ${mainBusiness.topClient || "—"} ${mainBusiness.concentration.toFixed(1)}%`} status={mainBusiness.concentration > 60 ? "watch" : "neutral"}/></div></div></div>
  </div>;
}

function OriginExecutivePreview({ analytics, origin }: { analytics: AnalyticsSummary; origin: "NATURAL" | "ARRASTRE" }) {
  const stats = originStats(analytics, origin);
  const natural = origin === "NATURAL";
  if (!stats.total) return <PreviewEmpty text={`No hay datos disponibles de ${natural ? "Naturales" : "Arrastre"} para el alcance seleccionado.`}/>;
  const maxClient = Math.max(1, ...stats.clients.map((item) => item.volume));
  const maxYard = Math.max(1, ...stats.yards.map((item) => item.volume));
  return <div className="space-y-5 p-5">
    <div className={`rounded-2xl p-5 text-white ${natural ? "bg-gradient-to-r from-emerald-950 to-emerald-700" : "bg-gradient-to-r from-blue-950 to-blue-700"}`}><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.15em] opacity-75">Unidad de negocio</p><h3 className="mt-1 text-2xl font-black">{natural ? "Naturales" : "Arrastre"}</h3><p className="mt-2 text-xs opacity-80">Clientes, volumen y desempeño evaluados de forma independiente.</p></div><div className="text-left sm:text-right"><p className="text-4xl font-black">{formatNumber(stats.total)}</p><p className="text-xs font-bold opacity-75">{natural ? "movimientos" : "solicitudes"}</p></div></div></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><PreviewMetric label="Concluidos" value={formatNumber(stats.completed)} tone="emerald"/><PreviewMetric label="Cumplimiento" value={`${stats.completion.toFixed(1)}%`} tone={stats.completion >= 90 ? "emerald" : "amber"}/><PreviewMetric label="Cancelados" value={formatNumber(stats.cancelled)} tone={stats.cancelled ? "rose" : "emerald"}/><PreviewMetric label="Incidentes" value={formatNumber(stats.incidents)} tone={stats.incidents ? "amber" : "emerald"}/></div>
    <div className="grid gap-4 lg:grid-cols-2"><RankingPanel title={natural ? "Clientes de Naturales" : "Clientes de Arrastre"} rows={stats.clients} max={maxClient} color={natural ? "emerald" : "blue"}/><RankingPanel title="Participación por patio" rows={stats.yards} max={maxYard} color={natural ? "emerald" : "blue"}/></div>
    <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]"><OriginTrendChart analytics={analytics} origin={origin}/><div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800"><p className="text-xs font-black uppercase tracking-[.1em] text-slate-500">Indicadores de gestión</p><div className="mt-3 space-y-3">{natural ? <><ManagementSignal label="Lavados concluidos" value={formatNumber(analytics.kpis.wash)} status="neutral"/><ManagementSignal label="Torneados concluidos" value={formatNumber(analytics.kpis.turning)} status="neutral"/></> : <><ManagementSignal label="Vagones movilizados" value={formatNumber(stats.wagons)} status="neutral"/><ManagementSignal label="Promedio por solicitud" value={stats.total ? (stats.wagons / stats.total).toFixed(1) : "0"} status="neutral"/></>}<ManagementSignal label="Cliente principal" value={`${stats.topClient || "Sin datos"} · ${stats.concentration.toFixed(1)}%`} status={stats.concentration > 60 ? "watch" : "good"}/><ManagementSignal label="Detenidos" value={formatNumber(stats.stopped)} status={stats.stopped ? "watch" : "good"}/></div></div></div>
  </div>;
}

function originStats(analytics: AnalyticsSummary, origin: "NATURAL" | "ARRASTRE") {
  const rows = analytics.contractBreakdown.filter((item) => item.origin === origin && item.service === "MOVIMIENTO");
  const total = rows.reduce((sum, item) => sum + item.count, 0);
  const byStatus = (status: string) => rows.filter((item) => item.status === status).reduce((sum, item) => sum + item.count, 0);
  const clients = analytics.clients.map((item) => ({ name: item.name, volume: origin === "NATURAL" ? item.natural : item.arrastre })).filter((item) => item.volume > 0).sort((a, b) => b.volume - a.volume);
  const yards = analytics.yards.map((item) => ({ name: item.name, volume: origin === "NATURAL" ? item.natural : item.arrastre })).filter((item) => item.volume > 0).sort((a, b) => b.volume - a.volume);
  const top = clients[0];
  const wagons = rows.reduce((sum, item) => sum + item.wagons, 0);
  const completed = byStatus("CONCLUIDO");
  return { total, completed, cancelled: byStatus("CANCELADO"), stopped: byStatus("DETENIDO"), incidents: rows.reduce((sum, item) => sum + item.incidents, 0), wagons, completion: total ? completed / total * 100 : 0, clients, yards, topClient: top?.name || "", concentration: total && top ? top.volume / total * 100 : 0 };
}

function BusinessSegmentCard({ title, color, stats, details }: { title: string; color: "emerald" | "blue"; stats: ReturnType<typeof originStats>; details: Array<{ label: string; value: string }> }) {
  const accent = color === "emerald" ? "bg-emerald-600" : "bg-blue-600";
  const textColor = color === "emerald" ? "text-emerald-700 dark:text-emerald-300" : "text-blue-700 dark:text-blue-300";
  return <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800"><div className={`${accent} flex items-center justify-between px-5 py-3 text-white`}><p className="font-black">{title}</p><span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-black">SEGMENTO</span></div><div className="p-5"><div className="flex items-end justify-between gap-3"><div><p className={`text-4xl font-black ${textColor}`}>{formatNumber(stats.total)}</p><p className="text-xs font-bold text-slate-500">volumen del periodo</p></div><div className="text-right"><p className="text-xl font-black text-slate-900 dark:text-white">{stats.completion.toFixed(1)}%</p><p className="text-[10px] font-bold text-slate-500">cumplimiento</p></div></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className={`h-full ${accent}`} style={{ width: `${Math.min(100, stats.completion)}%` }}/></div><div className="mt-5 grid grid-cols-2 gap-3">{details.map((item) => <div key={item.label} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900"><p className="text-lg font-black text-slate-900 dark:text-white">{item.value}</p><p className="text-[10px] font-bold text-slate-500">{item.label}</p></div>)}</div><p className="mt-4 text-xs font-bold text-slate-600 dark:text-slate-300">Cliente principal: <span className={textColor}>{stats.topClient || "Sin datos"} · {stats.concentration.toFixed(1)}%</span></p></div></div>;
}

function ExecutiveTrendChart({ analytics, showNatural, showArrastre }: { analytics: AnalyticsSummary; showNatural: boolean; showArrastre: boolean }) {
  const series = [
    ...(showNatural ? [{ key: "natural" as const, label: "Naturales", color: "bg-emerald-600" }] : []),
    ...(showArrastre ? [{ key: "arrastre" as const, label: "Arrastre", color: "bg-blue-600" }] : []),
  ];
  const max = Math.max(1, ...analytics.trend.flatMap((item) => series.map((entry) => item[entry.key])));
  return <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800"><div className="flex items-center justify-between"><p className="text-xs font-black uppercase tracking-[.1em] text-slate-500">Evolución del periodo</p><div className="flex gap-3 text-[9px] font-bold text-slate-500">{series.map((entry) => <span key={entry.key} className="flex items-center gap-1"><i className={`h-2 w-2 rounded ${entry.color}`}/>{entry.label}</span>)}</div></div><div className="mt-4 overflow-x-auto"><div className="flex h-48 items-end gap-2" style={{ minWidth: `${Math.max(560, analytics.trend.length * 42)}px` }}>{analytics.trend.map((item) => <div key={item.key} className="flex min-w-8 flex-1 flex-col items-center justify-end"><div className="flex h-36 items-end gap-1">{series.map((entry) => <div key={entry.key} className={`w-3 rounded-t ${entry.color}`} style={{ height: `${Math.max(3, item[entry.key] / max * 130)}px` }}/>)}</div><p className="mt-2 max-w-14 truncate text-[8px] font-bold text-slate-500">{item.label}</p></div>)}</div></div></div>;
}

function OriginTrendChart({ analytics, origin }: { analytics: AnalyticsSummary; origin: "NATURAL" | "ARRASTRE" }) {
  const key = origin === "NATURAL" ? "natural" : "arrastre";
  const color = origin === "NATURAL" ? "bg-emerald-600" : "bg-blue-600";
  const max = Math.max(1, ...analytics.trend.map((item) => item[key]));
  return <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800"><p className="text-xs font-black uppercase tracking-[.1em] text-slate-500">Evolución del segmento</p><div className="mt-4 overflow-x-auto"><div className="flex h-44 items-end gap-2" style={{ minWidth: `${Math.max(520, analytics.trend.length * 38)}px` }}>{analytics.trend.map((item) => <div key={item.key} className="flex min-w-7 flex-1 flex-col items-center justify-end"><span className="text-[8px] font-bold text-slate-500">{item[key]}</span><div className={`mt-1 w-full max-w-6 rounded-t ${color}`} style={{ height: `${Math.max(3, item[key] / max * 115)}px` }}/><span className="mt-2 max-w-14 truncate text-[8px] font-bold text-slate-500">{item.label}</span></div>)}</div></div></div>;
}

function RankingPanel({ title, rows, max, color }: { title: string; rows: Array<{ name: string; volume: number }>; max: number; color: "emerald" | "blue" }) {
  const bar = color === "emerald" ? "bg-emerald-600" : "bg-blue-600";
  return <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800"><p className="text-xs font-black uppercase tracking-[.1em] text-slate-500">{title}</p><div className="mt-4 space-y-3">{rows.slice(0, 6).map((item, index) => <div key={item.name}><div className="mb-1 flex items-center justify-between gap-3"><span className="truncate text-xs font-bold text-slate-700 dark:text-slate-200">{index + 1}. {item.name}</span><span className="text-xs font-black text-slate-900 dark:text-white">{formatNumber(item.volume)}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className={`h-full rounded-full ${bar}`} style={{ width: `${item.volume / max * 100}%` }}/></div></div>)}{!rows.length ? <p className="py-8 text-center text-xs font-bold text-slate-400">Sin datos para este segmento.</p> : null}</div></div>;
}

function ManagementSignal({ label, value, status }: { label: string; value: string; status: "good" | "watch" | "risk" | "neutral" }) {
  const tones = { good: "bg-emerald-500", watch: "bg-amber-500", risk: "bg-rose-500", neutral: "bg-blue-500" };
  return <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-900"><span className="flex min-w-0 items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300"><i className={`h-2.5 w-2.5 shrink-0 rounded-full ${tones[status]}`}/><span className="truncate">{label}</span></span><span className="text-right text-xs font-black text-slate-900 dark:text-white">{value}</span></div>;
}

function PreviewMetric({ label, value, tone = "blue" }: { label: string; value: string; tone?: "blue" | "emerald" | "rose" | "amber" }) {
  const tones = { blue: "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/70 dark:bg-blue-950/30 dark:text-blue-100", emerald: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-100", rose: "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-100", amber: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100" };
  return <div className={`rounded-xl border p-4 ${tones[tone]}`}><p className="text-[9px] font-black uppercase tracking-[.1em] opacity-70">{label}</p><p className="mt-2 text-2xl font-black">{value}</p></div>;
}

function PreviewTable({ headers, rows, totalRows, empty = "No hay registros para mostrar." }: { headers: string[]; rows: Array<Array<string | number>>; totalRows?: number; empty?: string }) {
  const total = totalRows ?? rows.length;
  return <div className="overflow-x-auto"><table className="w-full min-w-max border-collapse text-left text-xs"><thead><tr>{headers.map((header) => <th key={header} className="border-b border-r border-slate-200 bg-slate-100 px-4 py-3 font-black uppercase tracking-[.06em] text-slate-600 last:border-r-0 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">{header}</th>)}</tr></thead><tbody>{rows.slice(0, 10).map((row, rowIndex) => <tr key={rowIndex} className="even:bg-slate-50 dark:even:bg-slate-900/50">{row.map((value, columnIndex) => <td key={`${rowIndex}-${columnIndex}`} className="border-b border-r border-slate-100 px-4 py-3 font-medium text-slate-700 last:border-r-0 dark:border-slate-800 dark:text-slate-200">{value}</td>)}</tr>)}</tbody></table>{!rows.length ? <PreviewEmpty text={empty}/> : total > 10 ? <p className="border-t border-slate-200 p-3 text-center text-[10px] font-bold text-slate-500 dark:border-slate-800">Vista previa de 10 filas · El Excel incluirá {formatNumber(total)} registros de esta sección.</p> : null}</div>;
}

function PreviewEmpty({ text }: { text: string }) {
  return <div className="grid min-h-64 place-items-center p-8 text-center"><div><FileSpreadsheet className="mx-auto h-9 w-9 text-slate-300"/><p className="mt-3 text-sm font-black text-slate-600 dark:text-slate-300">{text}</p></div></div>;
}

function operationPreviewValue(operation: CommercialOperation, column: ColumnId) {
  const values: Record<ColumnId, string | number> = {
    FUENTE: operation.sourceSystem,
    TIPO: humanize(operation.origin),
    REFERENCIA: operation.reference,
    CLIENTE: operation.empresa,
    PATIO: operation.localidad,
    LOCOMOTORA: operation.locomotiveNumber || "—",
    VAGONES: operation.wagons,
    SERVICIOS: operation.services.map(humanize).join(", "),
    ESTADO: humanize(operation.status),
    SOLICITUD: formatDate(operation.requestedAt),
    FINALIZACION: formatDate(operation.completedAt),
    INCIDENTES: operation.incidents,
  };
  return values[column];
}

function buildComplianceRows(contracts: Contract[], analytics: AnalyticsSummary, filters: ReportFilters): ContractComplianceRow[] {
  const selected = analytics.meta.selectedMonthKeys?.length ? [...analytics.meta.selectedMonthKeys].sort() : [analytics.meta.reference.slice(0, 7)];
  return selected.flatMap((monthKey) => {
    const bounds = monthBounds(monthKey);
    const from = Date.parse(bounds.start);
    const to = Date.parse(bounds.end) + 86_400_000;
    return contracts.flatMap((contract) => {
      if (!contractOverlapsMonth(contract, monthKey)) return [];
      return (contract.paquetes || []).filter((rule) => ruleMatchesScope(rule, filters, from, to)).map((rule) => ({
        key: `${contract.id}-${rule.id}-${monthKey}`,
        monthKey,
        monthLabel: monthLabel(monthKey),
        contract,
        rule,
        companyName: contract.cliente?.empresaNombre || "Cliente",
        contractLabel: `${contract.folio} · ${contract.nombre}`,
        usage: rulePreviewUsage(rule, contract, analytics, monthKey),
      }));
    });
  });
}

function buildClosingRows({ contracts, cuts, analytics, filters }: { contracts: Contract[]; cuts: BillingCut[]; analytics: AnalyticsSummary; filters: ReportFilters }): ClosingPreviewRow[] {
  const monthKeys = analytics.meta.selectedMonthKeys?.length
    ? [...analytics.meta.selectedMonthKeys].sort()
    : analytics.trend.map((item) => item.key).filter((key) => /^\d{4}-\d{2}$/.test(key));
  const selected = monthKeys.length ? monthKeys : [analytics.meta.reference.slice(0, 7)];
  const usedCutIds = new Set<number>();
  const rows = selected.flatMap((monthKey) => contracts.flatMap((contract) => {
    if (!contractOverlapsMonth(contract, monthKey)) return [];
    const companyId = contract.cliente?.empresaId;
    if (!companyId) return [];
    const cut = cuts.find((item) => item.contratoId === contract.id && cutOverlapsMonth(item, monthKey));
    if (cut) usedCutIds.add(cut.id);
    const bounds = monthBounds(monthKey);
    const movement = movementSummary(primaryRule(contract), contract, companyId, analytics, monthKey);
    return [{
      key: cut ? `cut-${cut.id}-${monthKey}` : `expected-${contract.id}-${monthKey}`,
      cut,
      contract,
      companyName: cut?.cliente.empresaNombre || contract.cliente?.empresaNombre || "Cliente",
      folio: cut?.folio || `PENDIENTE-${contract.folio}-${monthKey}`,
      period: cut ? `${formatDate(cut.periodoInicio)} – ${formatDate(cut.periodoFin)}` : `${formatDate(clampDate(contract.fechaInicio, bounds.start, "max"))} – ${formatDate(clampDate(contract.fechaFin || bounds.end, bounds.end, "min"))}`,
      contractLabel: `${contract.folio} · ${contract.nombre}`,
      movement,
      state: cut?.estado || "PENDIENTE",
      amount: cut?.cobranza.total ?? null,
      saved: Boolean(cut),
    }];
  }));
  const unlinked = cuts.flatMap((cut) => {
    if (usedCutIds.has(cut.id)) return [];
    if (filters.empresaId && cut.cliente.empresaId !== filters.empresaId) return [];
    if (filters.localidadId && cut.detalles?.length && !cut.detalles.some((detail) => detail.localidadId === filters.localidadId)) return [];
    const monthKey = selected.find((key) => cutOverlapsMonth(cut, key));
    if (!monthKey) return [];
    const contract = cut.contratoId ? contracts.find((item) => item.id === cut.contratoId) : undefined;
    return [{
      key: `cut-${cut.id}`,
      cut,
      contract,
      companyName: cut.cliente.empresaNombre,
      folio: cut.folio,
      period: `${formatDate(cut.periodoInicio)} – ${formatDate(cut.periodoFin)}`,
      contractLabel: contract ? `${contract.folio} · ${contract.nombre}` : cut.contrato ? `${cut.contrato.folio} · ${cut.contrato.nombre}` : "Sin contrato vinculado",
      movement: movementSummary(primaryRule(contract), contract, cut.cliente.empresaId, analytics, monthKey),
      state: cut.estado,
      amount: cut.cobranza.total,
      saved: true,
    }];
  });
  return [...rows, ...unlinked].sort((a, b) => a.companyName.localeCompare(b.companyName) || a.period.localeCompare(b.period) || a.contractLabel.localeCompare(b.contractLabel));
}

function contractMatchesScope(contract: Contract, filters: ReportFilters, from: number, to: number) {
  if (contract.estado === "CANCELADO") return false;
  const startsAt = Date.parse(contract.fechaInicio);
  const endsAt = contract.fechaFin ? Date.parse(contract.fechaFin) + 86_400_000 : Number.POSITIVE_INFINITY;
  const rules = contract.paquetes || [];
  return (!filters.empresaId || contract.cliente?.empresaId === filters.empresaId)
    && startsAt < to
    && endsAt >= from
    && (!rules.length || rules.some((rule) => ruleMatchesScope(rule, filters, from, to)));
}

function ruleMatchesScope(rule: ContractRule, filters: ReportFilters, from: number, to: number) {
  const startsAt = Date.parse(rule.vigenciaInicio);
  const endsAt = rule.vigenciaFin ? Date.parse(rule.vigenciaFin) + 86_400_000 : Number.POSITIVE_INFINITY;
  return (!filters.localidadId || !rule.localidadId || rule.localidadId === filters.localidadId)
    && (!filters.origin || !rule.origenOperacion || rule.origenOperacion === filters.origin)
    && startsAt < to
    && endsAt >= from;
}

function rulePreviewUsage(rule: ContractRule, contract: Contract, analytics: AnalyticsSummary, monthKey?: string): RuleUsage {
  const statuses = billableStatuses(rule);
  const sourceRows = monthKey ? analytics.contractTrend.filter((row) => row.bucketKey.startsWith(monthKey)) : analytics.contractBreakdown;
  const rows = sourceRows.filter((row) =>
    row.empresaId === contract.cliente?.empresaId
    && (!rule.localidadId || row.localidadId === rule.localidadId)
    && (!rule.origenOperacion || row.origin === rule.origenOperacion)
    && row.service === rule.servicio
    && statuses.includes(row.status),
  );
  const used = rule.unidad === "VAGON" ? rows.reduce((sum, row) => sum + row.wagons, 0) : rows.reduce((sum, row) => sum + row.count, 0);
  const bounds = monthKey ? monthBounds(monthKey) : null;
  const from = new Date(bounds?.start || analytics.meta.range.from);
  const to = new Date(bounds ? `${bounds.end}T23:59:59.999Z` : analytics.meta.range.toExclusive);
  const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000));
  const months = monthKey ? 1 : Math.max(1, analytics.meta.months || (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + to.getUTCMonth() - from.getUTCMonth());
  const multiplier = rule.periodicidad === "SEMANAL" ? Math.ceil(days / 7) : rule.periodicidad === "MENSUAL" ? months : rule.periodicidad === "BIMESTRAL" ? Math.max(1, Math.ceil(months / 2)) : rule.periodicidad === "SEMESTRAL" ? Math.max(1, Math.ceil(months / 6)) : rule.periodicidad === "ANUAL" ? Math.max(1, Math.ceil(months / 12)) : 1;
  const limit = rule.cantidadIncluida == null ? null : Number(rule.cantidadIncluida) * multiplier;
  const percent = limit ? Math.round(used / limit * 1000) / 10 : null;
  return { used, limit, percent, excess: limit == null ? 0 : Math.max(0, used - limit) };
}

function movementSummary(rule: ContractRule | undefined, contract: Contract | undefined, empresaId: number, analytics: AnalyticsSummary, monthKey?: string) {
  const statuses = rule ? billableStatuses(rule) : DEFAULT_BILLABLE_STATUSES;
  const service = rule?.servicio || "MOVIMIENTO";
  const sourceRows = monthKey ? analytics.contractTrend.filter((row) => row.bucketKey === monthKey) : analytics.contractBreakdown;
  const rows = sourceRows.filter((row) =>
    row.empresaId === empresaId
    && row.service === service
    && (!rule?.localidadId || row.localidadId === rule.localidadId)
    && (!rule?.origenOperacion || row.origin === rule.origenOperacion)
    && (!contract?.cliente?.empresaId || row.empresaId === contract.cliente.empresaId),
  );
  const count = (status: string) => rows.filter((row) => row.status === status).reduce((sum, row) => sum + row.count, 0);
  return {
    billable: statuses.reduce((sum, status) => sum + count(status), 0),
    completed: count("CONCLUIDO"),
    cancelled: count("CANCELADO"),
    stopped: count("DETENIDO"),
    inProcess: count("EN_PROCESO"),
  };
}

function primaryRule(contract?: Contract) {
  return contract?.paquetes?.[0];
}

function billableStatuses(rule: ContractRule) {
  return rule.estadosIncluidos?.length ? rule.estadosIncluidos : DEFAULT_BILLABLE_STATUSES;
}

function contractRuleSummary(rule?: ContractRule) {
  if (!rule) return "Sin regla automática";
  const quantity = rule.unidad === "TARIFA_FIJA" ? "Cuota fija" : rule.cantidadIncluida ? `${formatNumber(rule.cantidadIncluida)} ${unitPlural(rule.unidad)}` : humanize(rule.unidad);
  return `${quantity} · ${humanize(rule.periodicidad)} · ${billableStatuses(rule).map(humanize).join(", ")}`;
}

function cutLabel(day: number | null) {
  return !day || day === 31 ? "Fin de mes" : `Día ${day}`;
}

function moneyText(value: number, currency = "MXN") {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(value);
}

function unitPlural(value: ContractRule["unidad"]) {
  if (value === "VAGON") return "vagones";
  if (value === "SERVICIO") return "servicios";
  if (value === "TARIFA_FIJA") return "cuota fija";
  return "movimientos";
}

function clampDate(value: string, boundary: string, mode: "min" | "max") {
  const raw = Date.parse(value);
  const limit = Date.parse(boundary);
  const time = mode === "max" ? Math.max(raw, limit) : Math.min(raw, limit);
  return new Date(time).toISOString().slice(0, 10);
}

function monthBounds(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return {
    start: new Date(Date.UTC(year, month - 1, 1)).toISOString().slice(0, 10),
    end: new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10),
  };
}

function selectedMonthQueryWindow(months: string[]) {
  const ordered = [...months].sort();
  const first = monthBounds(ordered[0]);
  const last = monthBounds(ordered[ordered.length - 1]);
  return { from: first.start, to: last.end };
}

function monthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function selectedMonthsLabel(months: string[]) {
  return months.map(monthLabel).join(" · ");
}

function mergeAnalyticsRows<T>(rows: T[], keyFields: string[], numericFields: string[]): T[] {
  const grouped = new Map<string, T>();
  for (const row of rows) {
    const record = row as Record<string, unknown>;
    const key = keyFields.map((field) => String(record[field] ?? "")).join(":");
    const current = grouped.get(key);
    if (!current) {
      grouped.set(key, { ...record } as T);
      continue;
    }
    const target = current as Record<string, unknown>;
    for (const field of numericFields) target[field] = Number(target[field] || 0) + Number(record[field] || 0);
  }
  return [...grouped.values()];
}

function mergeMonthlyAnalytics(parts: AnalyticsSummary[], months: string[]): AnalyticsSummary {
  if (!parts.length) throw new Error("El servidor no devolvió información para los meses seleccionados.");
  const selected = [...months].sort();
  if (parts.length === 1) return {
    ...parts[0],
    meta: { ...parts[0].meta, months: 1, periodLabel: monthLabel(selected[0]), selectedMonthKeys: selected },
  };
  const operations = parts.flatMap((part) => part.operations.data);
  const sumKpi = (key: keyof AnalyticsSummary["kpis"]) => parts.reduce((sum, part) => sum + Number(part.kpis[key] || 0), 0);
  const previousPeriod = sumKpi("previousPeriod");
  const selectedPeriod = operations.length;
  const completed = operations.filter((item) => item.completed).length;
  const growth = (current: number, previous: number) => previous ? Math.round((current - previous) / previous * 1000) / 10 : current ? 100 : 0;
  const clients = mergeAnalyticsRows(parts.flatMap((part) => part.clients), ["id"], ["total", "completed", "natural", "arrastre", "wagons", "wash", "turning"])
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "es"));
  const yards = mergeAnalyticsRows(parts.flatMap((part) => part.yards), ["id"], ["total", "completed", "natural", "arrastre", "wagons", "wash", "turning"])
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "es"));
  const currentBreakdown = mergeAnalyticsRows(parts.flatMap((part) => part.currentBreakdown), ["empresaId", "localidadId"], ["natural", "arrastre", "wagons", "wash", "turning", "completed"])
    .sort((a, b) => b.completed - a.completed);
  const contractBreakdown = mergeAnalyticsRows(parts.flatMap((part) => part.contractBreakdown), ["empresaId", "localidadId", "origin", "service", "status"], ["count", "wagons", "incidents"])
    .sort((a, b) => a.empresa.localeCompare(b.empresa, "es") || a.localidad.localeCompare(b.localidad, "es") || a.status.localeCompare(b.status, "es"));
  const contractTrend = parts.flatMap((part, index) => part.contractBreakdown.map((row) => ({ ...row, bucketKey: selected[index], bucketLabel: monthLabel(selected[index]) })))
    .sort((a, b) => a.bucketKey.localeCompare(b.bucketKey) || a.empresa.localeCompare(b.empresa, "es"));
  const trend = parts.map((part, index) => ({
    key: selected[index], label: monthLabel(selected[index]), natural: part.kpis.natural, arrastre: part.kpis.arrastre,
    wagons: part.kpis.wagons, wash: part.kpis.wash, turning: part.kpis.turning, total: part.kpis.operations,
    completed: part.kpis.completed, cancelled: part.kpis.cancelled,
  }));
  const kpis = {
    operations: selectedPeriod, completed, cancelled: sumKpi("cancelled"), stopped: sumKpi("stopped"), incidents: sumKpi("incidents"),
    natural: sumKpi("natural"), arrastre: sumKpi("arrastre"), wagons: sumKpi("wagons"), wash: sumKpi("wash"), turning: sumKpi("turning"),
    currentMonth: selectedPeriod, previousMonth: previousPeriod, monthlyGrowthPct: growth(selectedPeriod, previousPeriod), selectedPeriod, previousPeriod,
    periodGrowthPct: growth(selectedPeriod, previousPeriod), completedGrowthPct: 0,
  };
  return {
    ...parts[0],
    meta: {
      ...parts[0].meta,
      months: selected.length,
      range: { from: parts[0].meta.range.from, toExclusive: parts[parts.length - 1].meta.range.toExclusive },
      reference: selected.join("_"),
      referenceDate: `${selected[0]}-01`,
      period: "MONTH",
      periodLabel: selectedMonthsLabel(selected),
      torreonAvailable: parts.some((part) => part.meta.torreonAvailable),
      selectedMonthKeys: selected,
    },
    kpis,
    trend,
    currentBreakdown,
    contractBreakdown,
    contractTrend,
    clients,
    yards,
    operations: { data: operations, meta: { page: 1, pageSize: Math.max(1, operations.length), total: operations.length, totalPages: 1 } },
  };
}

function overlapsMonth(from: string, to: string | null | undefined, monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const monthStart = Date.UTC(year, month - 1, 1);
  const monthEnd = Date.UTC(year, month, 1);
  const startsAt = Date.parse(from);
  const endsAt = to ? Date.parse(to) + 86_400_000 : Number.POSITIVE_INFINITY;
  return Number.isFinite(startsAt) && startsAt < monthEnd && endsAt >= monthStart;
}

function contractOverlapsMonth(contract: Contract, monthKey: string) {
  return overlapsMonth(contract.fechaInicio, contract.fechaFin, monthKey);
}

function cutOverlapsMonth(cut: BillingCut, monthKey: string) {
  return overlapsMonth(cut.periodoInicio, cut.periodoFin, monthKey);
}

function isTorreon(value?: string) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes("torreon");
}
