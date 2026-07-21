"use client";

import { useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, ArrowRight, BarChart3, BriefcaseBusiness, Check, ChevronDown, ChevronUp, CircleHelp, Download, Eye, FileCheck2, FileSpreadsheet, Loader2, Settings2, TableProperties } from "lucide-react";
import type { AnalyticsSummary, BillingCut, CommercialOperation, Contract, Package } from "../crmTypes";
import CommercialPeriodBar from "../_components/CommercialPeriodBar";
import { useCommercialData } from "../_components/CommercialDataProvider";
import { Modal, ModuleHeader, Notice } from "../_components/CommercialUi";
import { buildQuery } from "../_lib/api";
import { formatDate, formatNumber, humanize } from "../_lib/format";
import { useCrmList } from "../_lib/useCrmList";

type SectionId = "RESUMEN" | "NATURAL" | "ARRASTRE" | "TENDENCIA" | "PATIOS" | "CLIENTES" | "CONTRATOS" | "PAQUETES" | "COBRANZA" | "OPERACIONES" | "GUIA";
type ColumnId = "FUENTE" | "TIPO" | "REFERENCIA" | "CLIENTE" | "PATIO" | "LOCOMOTORA" | "VAGONES" | "SERVICIOS" | "ESTADO" | "SOLICITUD" | "FINALIZACION" | "INCIDENTES";
type PresetId = "MOVIMIENTOS" | "CONTRATOS" | "CIERRE" | "GENERAL" | "PERSONALIZADO";
type CrmPreviewSection = "CONTRATOS" | "PAQUETES" | "COBRANZA";
type CrmPreviewStatus = Record<CrmPreviewSection, { loading: boolean; error: string }>;

const DEFAULT_COLUMNS: ColumnId[] = ["REFERENCIA", "CLIENTE", "PATIO", "TIPO", "LOCOMOTORA", "VAGONES", "SERVICIOS", "ESTADO", "FINALIZACION"];

const PRESETS: Array<{ id: Exclude<PresetId, "PERSONALIZADO">; title: string; description: string; help: string; icon: LucideIcon; sections: SectionId[] }> = [
  { id: "MOVIMIENTOS", title: "Movimientos", description: "Operación, evolución, patios y clientes", help: "Analiza exclusivamente los movimientos del periodo y los registros que respaldan sus totales.", icon: BarChart3, sections: ["RESUMEN", "NATURAL", "ARRASTRE", "TENDENCIA", "PATIOS", "CLIENTES", "OPERACIONES", "GUIA"] },
  { id: "CONTRATOS", title: "Cumplimiento de contratos", description: "Reglas contra movimientos reales", help: "Compara lo incluido en cada regla con lo consumido durante la semana, mes, bimestre, semestre o año elegido.", icon: BriefcaseBusiness, sections: ["PAQUETES", "CONTRATOS", "OPERACIONES", "GUIA"] },
  { id: "CIERRE", title: "Cierre y seguimiento", description: "Cortes, estados y saldos opcionales", help: "Muestra únicamente el seguimiento de cierres; los importes aparecen solo cuando Comercial los captura.", icon: FileCheck2, sections: ["COBRANZA", "GUIA"] },
  { id: "GENERAL", title: "General", description: "Movimientos, contratos y seguimiento", help: "Concentra los tres reportes anteriores en un solo archivo, conservando cada tema en hojas separadas.", icon: FileSpreadsheet, sections: ["RESUMEN", "NATURAL", "ARRASTRE", "TENDENCIA", "PATIOS", "CLIENTES", "CONTRATOS", "PAQUETES", "COBRANZA", "OPERACIONES", "GUIA"] },
];

const SECTIONS: Array<{ id: SectionId; title: string; description: string }> = [
  { id: "RESUMEN", title: "Resumen", description: "Consolidado, crecimiento, riesgos y concentración." },
  { id: "NATURAL", title: "Naturales", description: "Clientes, cumplimiento, lavado y torneado." },
  { id: "ARRASTRE", title: "Arrastre", description: "Clientes, vagones, cumplimiento y cancelación." },
  { id: "TENDENCIA", title: "Evolución del periodo", description: "Comparación por día, semana o mes." },
  { id: "PATIOS", title: "Volumen por patio", description: "Cada localidad por separado." },
  { id: "CLIENTES", title: "Volumen por cliente", description: "Movimientos y servicios por empresa." },
  { id: "CONTRATOS", title: "Contratos", description: "Vigencias, cortes y reglas registradas." },
  { id: "PAQUETES", title: "Cumplimiento contractual", description: "Reglas, movimientos incluidos, consumo y excedente del periodo." },
  { id: "COBRANZA", title: "Cortes y saldo opcional", description: "Cierres; importes solo si fueron capturados." },
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
      "Cumplimiento de contratos: compara cada regla con los movimientos reales del periodo y calcula consumo y excedente.",
      "Cierre y seguimiento: cortes, estados, pendientes y saldos únicamente cuando fueron capturados.",
      "General: reúne los tres reportes anteriores en hojas separadas.",
    ],
    target: "tipo-reporte",
    action: "Ver tipos de reporte",
  },
  {
    title: "Defina periodo y alcance",
    description: "Seleccione semana, mes, bimestre, semestre o año completo; después elija cliente y patio.",
    details: [
      "El sistema toma las fechas completas del periodo seleccionado.",
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
      "Al final presione “Sí, descargar este Excel”; la descarga respetará exactamente lo mostrado.",
    ],
    target: "vista-previa-excel",
    action: "Ir a la vista previa",
  },
] as const;

export default function ReportingPage() {
  const { analytics, filters } = useCommercialData();
  const { items: contracts, loading: contractsLoading, error: contractsError } = useCrmList<Contract>("/bff/comercial/contratos?pageSize=100");
  const { items: packages, loading: packagesLoading, error: packagesError } = useCrmList<Package>("/bff/comercial/paquetes?pageSize=100");
  const cutPeriodEnd = analytics ? new Date(Date.parse(analytics.meta.range.toExclusive) - 86_400_000).toISOString().slice(0, 10) : undefined;
  const cutQuery = buildQuery({ pageSize: 100, desde: analytics?.meta.range.from.slice(0, 10), hasta: cutPeriodEnd });
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
  const selectedYardName = filters.localidadId ? analytics?.catalogs.localities.find((item) => item.id === filters.localidadId)?.nombre : undefined;
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
    if (!effectiveSections.length) return setMessage("Seleccione al menos un contenido para el archivo.");
    if (effectiveSections.includes("OPERACIONES") && !effectiveColumns.length) return setMessage("Seleccione al menos una columna para el detalle de movimientos.");
    setDownloading(true);
    setMessage("");
    try {
      const response = await fetch("/bff/comercial/excel", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ template: "COMPLETO", reportName: name, sections: effectiveSections, operationColumns: effectiveColumns, includeArrastre: showArrastre, period: filters.period, referenceDate: filters.referenceDate, empresaId: filters.empresaId, localidadId: filters.localidadId, origin: filters.origin }),
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
  const client = filters.empresaId ? analytics?.catalogs.companies.find((item) => item.id === filters.empresaId)?.nombre : "Todos los clientes";
  const yard = selectedYardName || "Todas las localidades";
  const visibleContracts = useMemo(() => {
    const from = analytics ? Date.parse(analytics.meta.range.from) : Number.NEGATIVE_INFINITY;
    const to = analytics ? Date.parse(analytics.meta.range.toExclusive) : Number.POSITIVE_INFINITY;
    return contracts.filter((item) => {
      const startsAt = Date.parse(item.fechaInicio);
      const endsAt = item.fechaFin ? Date.parse(item.fechaFin) : Number.POSITIVE_INFINITY;
      return (!filters.empresaId || item.cliente?.empresaId === filters.empresaId) && startsAt < to && endsAt >= from;
    });
  }, [analytics, contracts, filters.empresaId]);
  const visiblePackages = useMemo(() => {
    const from = analytics ? Date.parse(analytics.meta.range.from) : Number.NEGATIVE_INFINITY;
    const to = analytics ? Date.parse(analytics.meta.range.toExclusive) : Number.POSITIVE_INFINITY;
    return packages.filter((item) => {
      const startsAt = item.vigenciaInicio ? Date.parse(item.vigenciaInicio) : Number.NEGATIVE_INFINITY;
      const endsAt = item.vigenciaFin ? Date.parse(item.vigenciaFin) : Number.POSITIVE_INFINITY;
      return (!filters.empresaId || item.cliente?.empresaId === filters.empresaId)
        && (!filters.localidadId || !item.localidadId || item.localidadId === filters.localidadId)
        && (!filters.origin || !item.origenOperacion || item.origenOperacion === filters.origin)
        && startsAt < to
        && endsAt >= from;
    });
  }, [analytics, packages, filters.empresaId, filters.localidadId, filters.origin]);
  const visibleCuts = useMemo(() => cuts.flatMap((item) => {
    if (filters.empresaId && item.cliente.empresaId !== filters.empresaId) return [];
    if (!filters.localidadId && !filters.origin) return [item];
    const detalles = item.detalles?.filter((detail) =>
      (!filters.localidadId || detail.localidadId === filters.localidadId)
      && (!filters.origin || detail.fuente === filters.origin),
    ) || [];
    return detalles.length ? [{ ...item, detalles }] : [];
  }), [cuts, filters.empresaId, filters.localidadId, filters.origin]);
  const crmStatus: CrmPreviewStatus = {
    CONTRATOS: { loading: contractsLoading, error: contractsError },
    PAQUETES: { loading: packagesLoading, error: packagesError },
    COBRANZA: { loading: cutsLoading, error: cutsError },
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
    <ModuleHeader eyebrow="Reportería comercial" title="Constructor de reportes" description="Elija el contenido y el alcance. Arrastre aparece únicamente cuando el reporte incluye Torreón." icon={FileSpreadsheet} actions={<button type="button" onClick={openHelp} className="commercial-secondary border-white/20 bg-white/10 text-white hover:bg-white/20"><CircleHelp className="h-4 w-4"/>Ayuda</button>}/>

    <section id="tipo-reporte" className="commercial-card scroll-mt-5 p-5">
      <div><p className="commercial-label">1 · Tipo de reporte</p><h2 className="text-xl font-black text-[var(--app-text)]">¿Qué quiere revisar?</h2><p className="mt-1 text-sm text-[var(--app-text-muted)]">Seleccione una base; después puede agregar o quitar apartados.</p></div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">{PRESETS.map((item) => { const Icon = item.icon; const selected = preset === item.id; return <button key={item.id} type="button" aria-pressed={selected} onClick={() => choosePreset(item)} className={`flex min-h-28 items-center gap-4 rounded-2xl border p-4 text-left transition ${selected ? "border-emerald-500 bg-emerald-50 shadow-sm dark:bg-emerald-950/20" : "border-[var(--app-border)] bg-[var(--app-surface-subtle)] hover:border-emerald-300"}`}><span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${selected ? "bg-emerald-600 text-white" : "bg-[var(--app-surface-muted)] text-[var(--app-text)]"}`}><Icon className="h-5 w-5"/></span><span className="min-w-0 flex-1"><span className="block text-sm font-black text-[var(--app-text)]">{item.title}</span><span className="mt-1 block text-xs font-bold leading-5 text-[var(--app-text-muted)]">{item.description}</span></span>{selected ? <Check className="h-5 w-5 shrink-0 text-emerald-700"/> : null}</button>; })}</div>
    </section>

    <div id="alcance-reporte" className="scroll-mt-5"><CommercialPeriodBar showOrigin/></div>

    <section id="contenido-reporte" className="commercial-card scroll-mt-5 overflow-hidden">
      <button type="button" onClick={() => setAdvanced((value) => !value)} className="flex w-full items-center justify-between gap-4 p-5 text-left"><span className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-200"><Settings2 className="h-5 w-5"/></span><span><span className="commercial-label">Opcional</span><span className="block text-base font-black text-[var(--app-text)]">Personalizar apartados y columnas</span><span className="mt-0.5 block text-xs text-[var(--app-text-muted)]">La opción elegida ya está lista; abra esto solo si necesita cambiarla.</span></span></span>{advanced ? <ChevronUp className="h-5 w-5 text-[var(--app-text-muted)]"/> : <ChevronDown className="h-5 w-5 text-[var(--app-text-muted)]"/>}</button>
      {advanced ? <div className="border-t border-[var(--app-border)] p-5"><p className="text-sm font-black text-[var(--app-text)]">Apartados del archivo</p><div className="mt-3 grid gap-2 md:grid-cols-2">{SECTIONS.filter((item) => item.id !== "ARRASTRE" || showArrastre).map((item) => { const selected = effectiveSections.includes(item.id); return <label key={item.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${selected ? "border-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/15" : "border-[var(--app-border)]"}`}><input type="checkbox" checked={selected} onChange={() => toggleSection(item.id)} className="mt-1 h-4 w-4"/><span><span className="block text-sm font-black text-[var(--app-text)]">{item.title}</span><span className="mt-0.5 block text-xs text-[var(--app-text-muted)]">{item.description}</span></span></label>; })}</div>{effectiveSections.includes("OPERACIONES") ? <div className="mt-6 border-t border-[var(--app-border)] pt-5"><div className="flex items-center gap-2"><TableProperties className="h-5 w-5 text-blue-600"/><p className="text-sm font-black text-[var(--app-text)]">Columnas del detalle de movimientos</p></div><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{COLUMNS.filter((column) => showArrastre || column.id !== "VAGONES").map((column) => <label key={column.id} className="flex cursor-pointer items-center gap-2 rounded-xl bg-[var(--app-surface-subtle)] p-3"><input type="checkbox" checked={effectiveColumns.includes(column.id)} onChange={() => toggleColumn(column.id)} className="h-4 w-4"/><span className="text-xs font-bold text-[var(--app-text)]">{column.label}</span></label>)}</div></div> : null}</div> : null}
    </section>

    <section className="commercial-card p-5">
      <div className="grid gap-4 lg:grid-cols-[1fr_minmax(260px_420px)_220px] lg:items-end">
        <div className="flex items-center gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-950 text-white"><FileSpreadsheet className="h-5 w-5"/></span><div><p className="commercial-label">Reporte preparado</p><h2 className="text-lg font-black text-[var(--app-text)]">{selectedName}</h2><p className="mt-1 text-xs font-bold text-[var(--app-text-muted)]">{analytics?.meta.periodLabel || "Periodo elegido"} · {client} · {yard} · {formatNumber(analytics?.operations.meta.total || 0)} movimientos</p></div></div>
        <label><span className="commercial-label">Nombre del archivo</span><input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} className="commercial-input"/></label>
        <button type="button" onClick={() => previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })} className="commercial-primary w-full"><Eye className="h-4 w-4"/>Revisar reporte</button>
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5"><span className="commercial-label mr-2 self-center">Incluye:</span>{effectiveSections.map((id) => <span key={id} className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-800 dark:bg-emerald-950/25 dark:text-emerald-200">{SECTIONS.find((item) => item.id === id)?.title}</span>)}</div>
    </section>

    <section ref={previewRef} id="vista-previa-excel" className="commercial-card scroll-mt-5 overflow-hidden">
      <header className="flex flex-col gap-4 border-b border-[var(--app-border)] bg-slate-950 p-5 text-white sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-600"><Eye className="h-5 w-5"/></span><div><p className="text-[10px] font-black uppercase tracking-[.14em] text-emerald-300">Vista previa</p><h2 className="text-xl font-black">Así quedará el reporte</h2><p className="mt-1 text-xs text-slate-300">Revise cada pestaña y descargue únicamente cuando el contenido sea correcto.</p></div></div><span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-black">{name || "Reporte comercial"}</span></header>
      <div className="border-b border-[var(--app-border)] bg-[var(--app-surface-muted)] px-4 pt-3"><div className="flex gap-1 overflow-x-auto">{effectiveSections.map((id) => <button key={id} type="button" onClick={() => setPreviewSection(id)} className={`shrink-0 rounded-t-xl px-4 py-2.5 text-xs font-black ${activePreviewSection === id ? "bg-white text-emerald-800 shadow-sm dark:bg-slate-950 dark:text-emerald-300" : "text-[var(--app-text-muted)]"}`}>{SECTIONS.find((item) => item.id === id)?.title}</button>)}</div></div>
      <div className="bg-slate-100 p-3 sm:p-6 dark:bg-slate-950/40"><div className="min-h-[360px] overflow-hidden rounded-lg border border-slate-300 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-950"><div className="flex items-center justify-between border-b border-slate-200 bg-emerald-700 px-4 py-3 text-white dark:border-slate-800"><div><p className="text-[10px] font-black uppercase tracking-[.12em] text-emerald-100">COSAIF Comercial</p><p className="text-sm font-black">{SECTIONS.find((item) => item.id === activePreviewSection)?.title}</p></div><p className="text-xs font-bold">{analytics?.meta.periodLabel || "Periodo seleccionado"}</p></div><ExcelPreview section={activePreviewSection} columns={effectiveColumns} analytics={analytics} contracts={visibleContracts} packages={visiblePackages} cuts={visibleCuts} crmStatus={crmStatus} showNatural={showNatural} showArrastre={showArrastre}/></div></div>
      <footer className="flex flex-col gap-4 border-t border-[var(--app-border)] p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-black text-[var(--app-text)]">¿La información le sirve así?</p><p className="mt-1 text-xs text-[var(--app-text-muted)]">Puede volver arriba a cambiar periodo, cliente, patio, plantilla o columnas.</p></div><div className="sm:min-w-64">{message ? <div className="mb-3"><Notice tone={message.includes("correctamente") ? "blue" : "rose"} title={message.includes("correctamente") ? "Reporte listo" : "Revise la configuración"} text={message}/></div> : null}<button type="button" onClick={download} disabled={downloading} className="commercial-primary w-full">{downloading ? <Loader2 className="h-4 w-4 animate-spin"/> : <Download className="h-4 w-4"/>}{downloading ? "Construyendo Excel…" : "Sí, descargar este Excel"}</button></div></footer>
    </section>
    <button type="button" onClick={openHelp} className="fixed bottom-5 right-5 z-50 flex min-h-12 items-center gap-2 rounded-full bg-slate-950 px-5 text-sm font-black text-white shadow-2xl ring-1 ring-white/20 hover:bg-emerald-800"><CircleHelp className="h-5 w-5"/>Ayuda</button>
    {helpOpen ? <ReportHelp step={helpStep} setStep={setHelpStep} onClose={() => setHelpOpen(false)} onGo={goToHelpTarget}/> : null}
  </div>;
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

function ExcelPreview({ section, columns, analytics, contracts, packages, cuts, crmStatus, showNatural, showArrastre }: { section: SectionId; columns: ColumnId[]; analytics: AnalyticsSummary | null; contracts: Contract[]; packages: Package[]; cuts: BillingCut[]; crmStatus: CrmPreviewStatus; showNatural: boolean; showArrastre: boolean }) {
  if (!analytics) return <PreviewEmpty text="Cargando los datos de la vista previa…"/>;
  if (section === "CONTRATOS" || section === "PAQUETES" || section === "COBRANZA") {
    const status = crmStatus[section];
    if (status.loading) return <PreviewEmpty text="Consultando la información comercial para este alcance…"/>;
    if (status.error) return <PreviewEmpty text="La fuente comercial no está disponible. Verifique que msComercial esté activo y configurado."/>;
  }
  if (section === "RESUMEN") return <ExecutiveSummaryPreview analytics={analytics} showNatural={showNatural} showArrastre={showArrastre}/>;
  if (section === "NATURAL") return <OriginExecutivePreview analytics={analytics} origin="NATURAL"/>;
  if (section === "ARRASTRE") return <OriginExecutivePreview analytics={analytics} origin="ARRASTRE"/>;
  if (section === "TENDENCIA") return analytics.trend.some((item) => item.total > 0) ? <PreviewTable headers={["Periodo", "Total", "Concluidos", "Cancelados", ...(showNatural ? ["Naturales"] : []), ...(showArrastre ? ["Arrastre"] : []), "Lavados", "Torneados"]} rows={analytics.trend.map((item) => [item.label, item.total, item.completed, item.cancelled, ...(showNatural ? [item.natural] : []), ...(showArrastre ? [item.arrastre] : []), item.wash, item.turning])}/> : <PreviewEmpty text="No hay datos disponibles para el alcance seleccionado."/>;
  if (section === "PATIOS") return <PreviewTable headers={["Localidad", "Total", "Concluidos", ...(showNatural ? ["Naturales"] : []), ...(showArrastre ? ["Arrastre", "Vagones"] : []), "Lavados", "Torneados"]} rows={analytics.yards.filter((item) => item.total > 0).map((item) => [item.name, item.total, item.completed, ...(showNatural ? [item.natural] : []), ...(showArrastre ? [item.arrastre, item.wagons] : []), item.wash, item.turning])} empty="No hay datos disponibles para los patios y el periodo seleccionados."/>;
  if (section === "CLIENTES") return <PreviewTable headers={["Cliente", "Total", "Concluidos", ...(showNatural ? ["Naturales"] : []), ...(showArrastre ? ["Arrastre", "Vagones"] : []), "Lavados", "Torneados"]} rows={analytics.clients.filter((item) => item.total > 0).map((item) => [item.name, item.total, item.completed, ...(showNatural ? [item.natural] : []), ...(showArrastre ? [item.arrastre, item.wagons] : []), item.wash, item.turning])} empty="No hay datos disponibles para los clientes y el periodo seleccionados."/>;
  if (section === "CONTRATOS") return <PreviewTable headers={["Cliente", "Folio", "Contrato", "Estado", "Inicio", "Fin", "Reglas"]} rows={contracts.map((item) => [item.cliente?.empresaNombre || "—", item.folio, item.nombre, humanize(item.estado), formatDate(item.fechaInicio), formatDate(item.fechaFin), item._count?.paquetes || 0])} empty="No hay contratos registrados que coincidan con el alcance seleccionado."/>;
  if (section === "PAQUETES") return <ContractCompliancePreview packages={packages} analytics={analytics}/>;
  if (section === "COBRANZA") return <ClosingTrackingPreview cuts={cuts}/>;
  if (section === "OPERACIONES") {
    const selectedColumns = columns.length ? columns : DEFAULT_COLUMNS;
    return <PreviewTable headers={selectedColumns.map((id) => COLUMNS.find((item) => item.id === id)?.label || id)} rows={analytics.operations.data.map((operation) => selectedColumns.map((id) => operationPreviewValue(operation, id)))} totalRows={analytics.operations.meta.total} empty="No hay movimientos para mostrar con estos filtros."/>;
  }
  return <PreviewTable headers={["Apartado", "Qué contiene"]} rows={SECTIONS.filter((item) => item.id !== "GUIA").map((item) => [item.title, item.description])}/>;
}

function ContractCompliancePreview({ packages, analytics }: { packages: Package[]; analytics: AnalyticsSummary }) {
  if (!packages.length) return <PreviewEmpty text="No hay reglas contractuales que coincidan con el cliente, patio y periodo seleccionados."/>;
  const rows = packages.map((item) => ({ item, usage: packagePreviewUsage(item, analytics) }));
  const withLimit = rows.filter((row) => row.usage.limit != null);
  const exceeded = rows.filter((row) => row.usage.excess > 0);
  const consumed = rows.reduce((sum, row) => sum + row.usage.used, 0);
  return <div className="space-y-5 p-5">
    <div><p className="text-[10px] font-black uppercase tracking-[.12em] text-emerald-700">Análisis del periodo</p><h3 className="mt-1 text-xl font-black text-slate-950 dark:text-white">Reglas contratadas contra movimientos reales</h3><p className="mt-1 text-xs font-bold text-slate-500">El consumo se calcula únicamente con los estados configurados en cada regla.</p></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><PreviewMetric label="Reglas evaluadas" value={formatNumber(rows.length)} tone="blue"/><PreviewMetric label="Consumo de las reglas" value={formatNumber(consumed)} tone="emerald"/><PreviewMetric label="Dentro del límite" value={formatNumber(Math.max(0, withLimit.length - exceeded.length))} tone="emerald"/><PreviewMetric label="Con excedente" value={formatNumber(exceeded.length)} tone={exceeded.length ? "rose" : "emerald"}/></div>
    <PreviewTable headers={["Cliente", "Regla", "Servicio", "Periodicidad", "Estados que cuentan", "Incluido", "Consumido", "Excedente"]} rows={rows.map(({ item, usage }) => [item.cliente?.empresaNombre || "—", item.nombre, humanize(item.servicio), humanize(item.periodicidad), (item.estadosIncluidos?.length ? item.estadosIncluidos : ["CONCLUIDO"]).map(humanize).join(", "), usage.limit == null ? "Sin límite" : formatNumber(usage.limit), formatNumber(usage.used), formatNumber(usage.excess)])}/>
  </div>;
}

function ClosingTrackingPreview({ cuts }: { cuts: BillingCut[] }) {
  if (!cuts.length) return <PreviewEmpty text="No hay cortes registrados que coincidan con el alcance y periodo seleccionados."/>;
  const pending = cuts.filter((item) => !["PAGADO", "CANCELADO"].includes(item.estado));
  const overdue = cuts.filter((item) => item.cobranza.vencido);
  const withBalance = cuts.filter((item) => item.cobranza.saldo != null);
  return <div className="space-y-5 p-5">
    <div><p className="text-[10px] font-black uppercase tracking-[.12em] text-blue-700">Seguimiento del periodo</p><h3 className="mt-1 text-xl font-black text-slate-950 dark:text-white">Cortes y estado de seguimiento</h3><p className="mt-1 text-xs font-bold text-slate-500">Los importes permanecen ocultos cuando Comercial no ha capturado un saldo.</p></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><PreviewMetric label="Cortes registrados" value={formatNumber(cuts.length)} tone="blue"/><PreviewMetric label="En seguimiento" value={formatNumber(pending.length)} tone={pending.length ? "amber" : "emerald"}/><PreviewMetric label="Vencidos" value={formatNumber(overdue.length)} tone={overdue.length ? "rose" : "emerald"}/><PreviewMetric label="Con saldo capturado" value={formatNumber(withBalance.length)} tone="blue"/></div>
    <PreviewTable headers={["Cliente", "Corte", "Periodo", "Movimientos vinculados", "Estado", "Saldo opcional"]} rows={cuts.map((item) => [item.cliente.empresaNombre, item.folio, `${formatDate(item.periodoInicio)} – ${formatDate(item.periodoFin)}`, item.detalles?.length || 0, humanize(item.estado), item.cobranza.saldo == null ? "Sin saldo capturado" : new Intl.NumberFormat("es-MX", { style: "currency", currency: item.moneda }).format(item.cobranza.saldo)])}/>
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
  const textColor = color === "emerald" ? "text-emerald-700" : "text-blue-700";
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
  const tones = { blue: "border-blue-200 bg-blue-50 text-blue-900", emerald: "border-emerald-200 bg-emerald-50 text-emerald-900", rose: "border-rose-200 bg-rose-50 text-rose-900", amber: "border-amber-200 bg-amber-50 text-amber-900" };
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

function packagePreviewUsage(item: Package, analytics: AnalyticsSummary) {
  const statuses = item.estadosIncluidos?.length ? item.estadosIncluidos : ["CONCLUIDO"];
  const rows = analytics.contractBreakdown.filter((row) => row.empresaId === item.cliente?.empresaId && (!item.localidadId || row.localidadId === item.localidadId) && (!item.origenOperacion || row.origin === item.origenOperacion) && row.service === item.servicio && statuses.includes(row.status));
  const used = item.unidad === "VAGON" ? rows.reduce((sum, row) => sum + row.wagons, 0) : rows.reduce((sum, row) => sum + row.count, 0);
  const from = new Date(analytics.meta.range.from);
  const to = new Date(analytics.meta.range.toExclusive);
  const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000));
  const months = Math.max(1, (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + to.getUTCMonth() - from.getUTCMonth());
  const multiplier = item.periodicidad === "SEMANAL" ? Math.ceil(days / 7) : item.periodicidad === "MENSUAL" ? months : item.periodicidad === "BIMESTRAL" ? Math.ceil(months / 2) : item.periodicidad === "SEMESTRAL" ? Math.ceil(months / 6) : item.periodicidad === "ANUAL" ? Math.ceil(months / 12) : 1;
  const limit = item.cantidadIncluida == null ? null : Number(item.cantidadIncluida) * multiplier;
  return { used, limit, excess: limit == null ? 0 : Math.max(0, used - limit) };
}

function isTorreon(value?: string) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes("torreon");
}
