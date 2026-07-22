"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Building2, CalendarDays, Check, ChevronDown, ChevronUp, Download, FileText, Filter, Gauge, Loader2, MapPin, Plus, Search, Target, X } from "lucide-react";
import type { AnalyticsSummary, CommercialOrigin, Contract } from "../crmTypes";
import { useCommercialData } from "../_components/CommercialDataProvider";
import { EmptyPanel, Field, LoadingPanel, ModuleHeader, Notice } from "../_components/CommercialUi";
import { buildQuery, commercialApi } from "../_lib/api";
import { formatNumber } from "../_lib/format";
import { useCrmList } from "../_lib/useCrmList";

type ContractRule = NonNullable<Contract["paquetes"]>[number];
type RuleContext = { contract: Contract; rule: ContractRule };
type OperationCategory = "NATURALES" | "ARRASTRE" | "LAVADO" | "TORNEADO";
type MonthlyAnalytics = { monthKey: string; analytics: AnalyticsSummary };
type ContractMonthCard = {
  key: string;
  monthKey: string;
  label: string;
  category: OperationCategory;
  contract: Contract;
  contracted: number | null;
  used: number;
  excess: number;
  percent: number;
  rules: RuleContext[];
};
type ContractGroup = {
  contract: Contract;
  cards: ContractMonthCard[];
  contracted: number;
  used: number;
  excess: number;
  percent: number;
};
type AppliedFilters = {
  months: string[];
  contractIds: number[];
  localidadId?: number;
  origin?: CommercialOrigin;
};

const DEFAULT_BILLABLE_STATUSES = ["CONCLUIDO", "CANCELADO", "DETENIDO", "EN_PROCESO"];
const TRACKED_SERVICES = new Set(["MOVIMIENTO", "LAVADO", "TORNEADO"]);
const MAX_MONTHS = 12;
const CATEGORY_STYLES: Record<OperationCategory, { label: string; dot: string; badge: string; border: string; surface: string }> = {
  NATURALES: { label: "Naturales", dot: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/55 dark:text-emerald-200", border: "border-emerald-200 dark:border-emerald-900/70", surface: "bg-emerald-50/65 dark:bg-emerald-950/15" },
  ARRASTRE: { label: "Arrastre Torreón", dot: "bg-blue-500", badge: "bg-blue-100 text-blue-800 dark:bg-blue-950/55 dark:text-blue-200", border: "border-blue-200 dark:border-blue-900/70", surface: "bg-blue-50/65 dark:bg-blue-950/15" },
  LAVADO: { label: "Lavado", dot: "bg-cyan-500", badge: "bg-cyan-100 text-cyan-800 dark:bg-cyan-950/55 dark:text-cyan-200", border: "border-cyan-200 dark:border-cyan-900/70", surface: "bg-cyan-50/65 dark:bg-cyan-950/15" },
  TORNEADO: { label: "Torneado", dot: "bg-violet-500", badge: "bg-violet-100 text-violet-800 dark:bg-violet-950/55 dark:text-violet-200", border: "border-violet-200 dark:border-violet-900/70", surface: "bg-violet-50/65 dark:bg-violet-950/15" },
};
const CLIENT_STYLES = [
  { border: "border-l-teal-500", badge: "bg-teal-100 text-teal-800 dark:bg-teal-950/55 dark:text-teal-200" },
  { border: "border-l-blue-500", badge: "bg-blue-100 text-blue-800 dark:bg-blue-950/55 dark:text-blue-200" },
  { border: "border-l-violet-500", badge: "bg-violet-100 text-violet-800 dark:bg-violet-950/55 dark:text-violet-200" },
  { border: "border-l-orange-500", badge: "bg-orange-100 text-orange-800 dark:bg-orange-950/55 dark:text-orange-200" },
  { border: "border-l-rose-500", badge: "bg-rose-100 text-rose-800 dark:bg-rose-950/55 dark:text-rose-200" },
];

export default function ContractedMovementsPage() {
  const { analytics, loading: catalogsLoading, error: catalogsError } = useCommercialData();
  const { items: contracts, loading: contractsLoading, error: contractsError } = useCrmList<Contract>("/bff/comercial/contratos?pageSize=100");
  const [monthDraft, setMonthDraft] = useState(currentMonthKey);
  const [selectedMonths, setSelectedMonths] = useState<string[]>(() => [currentMonthKey()]);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<number[]>([]);
  const [selectedContractIds, setSelectedContractIds] = useState<number[]>([]);
  const [localidadId, setLocalidadId] = useState<number | undefined>();
  const [origin, setOrigin] = useState<CommercialOrigin | undefined>();
  const [clientSearch, setClientSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [report, setReport] = useState<MonthlyAnalytics[]>([]);
  const [applied, setApplied] = useState<AppliedFilters | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState("");
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => () => requestRef.current?.abort(), []);

  const reportableContracts = useMemo(() => contracts.filter((contract) => contract.estado !== "CANCELADO" && (contract.paquetes || []).some((rule) => TRACKED_SERVICES.has(rule.servicio))), [contracts]);
  const clients = useMemo(() => {
    const values = new Map<number, { id: number; name: string; contracts: number }>();
    for (const contract of reportableContracts) {
      const id = contract.cliente?.empresaId;
      if (!id) continue;
      const item = values.get(id) || { id, name: contract.cliente?.empresaNombre || `Empresa #${id}`, contracts: 0 };
      item.contracts += 1;
      values.set(id, item);
    }
    return [...values.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [reportableContracts]);
  const visibleClients = useMemo(() => {
    const search = normalizeText(clientSearch);
    return search ? clients.filter((client) => normalizeText(client.name).includes(search)) : clients;
  }, [clientSearch, clients]);
  const selectableContracts = useMemo(() => reportableContracts.filter((contract) => selectedCompanyIds.includes(contract.cliente?.empresaId || 0)), [reportableContracts, selectedCompanyIds]);
  const appliedContracts = useMemo(() => applied ? reportableContracts.filter((contract) => applied.contractIds.includes(contract.id)) : [], [applied, reportableContracts]);
  const cards = useMemo(() => applied ? buildContractMonthCards(appliedContracts, report, applied.localidadId, applied.origin) : [], [applied, appliedContracts, report]);
  const contractGroups = useMemo(() => groupCardsByContract(cards), [cards]);
  const totals = useMemo(() => summarizeCards(cards), [cards]);
  const selectionSignature = signature({ months: selectedMonths, contractIds: selectedContractIds, localidadId, origin });
  const appliedSignature = applied ? signature(applied) : "";
  const resultIsStale = Boolean(applied && selectionSignature !== appliedSignature);

  function toggleCompany(companyId: number, checked: boolean) {
    const companyContracts = reportableContracts.filter((contract) => contract.cliente?.empresaId === companyId).map((contract) => contract.id);
    setSelectedCompanyIds((current) => checked ? uniqueNumbers([...current, companyId]) : current.filter((id) => id !== companyId));
    setSelectedContractIds((current) => checked ? uniqueNumbers([...current, ...companyContracts]) : current.filter((id) => !companyContracts.includes(id)));
  }

  function toggleContract(contract: Contract, checked: boolean) {
    setSelectedContractIds((current) => checked ? uniqueNumbers([...current, contract.id]) : current.filter((id) => id !== contract.id));
    if (checked && contract.cliente?.empresaId) setSelectedCompanyIds((current) => uniqueNumbers([...current, contract.cliente!.empresaId]));
  }

  function addMonth(value = monthDraft) {
    if (!/^\d{4}-\d{2}$/.test(value) || selectedMonths.includes(value)) return;
    if (selectedMonths.length >= MAX_MONTHS) {
      setReportError(`Puede comparar hasta ${MAX_MONTHS} meses por consulta.`);
      return;
    }
    setReportError("");
    setSelectedMonths((current) => [...current, value].sort());
  }

  function chooseRecentMonths(count: number) {
    setReportError("");
    setSelectedMonths(recentMonthKeys(count));
  }

  async function runReport() {
    const activeContracts = reportableContracts.filter((contract) => selectedContractIds.includes(contract.id));
    const companyIds = uniqueNumbers(activeContracts.map((contract) => contract.cliente?.empresaId).filter((id): id is number => Boolean(id)));
    if (!selectedMonths.length) return setReportError("Seleccione al menos un mes.");
    if (!activeContracts.length || !companyIds.length) return setReportError("Seleccione al menos un cliente y uno de sus contratos.");

    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setReportLoading(true);
    setReportError("");
    try {
      const months = [...selectedMonths].sort();
      const data = await Promise.all(months.map(async (monthKey) => {
        const query = buildQuery({
          period: "MONTH",
          referenceDate: `${monthKey}-01`,
          empresaIds: companyIds.join(","),
          localidadId,
          origin,
          page: 1,
          pageSize: 10,
        });
        const monthAnalytics = await commercialApi<AnalyticsSummary>(`/bff/comercial/analitica?${query}`, { signal: controller.signal });
        return { monthKey, analytics: monthAnalytics };
      }));
      if (controller.signal.aborted) return;
      setReport(data);
      setApplied({ months, contractIds: activeContracts.map((contract) => contract.id).sort((a, b) => a - b), localidadId, origin });
    } catch (cause) {
      if ((cause as Error).name !== "AbortError") setReportError(cause instanceof Error ? cause.message : "No se pudo consultar el consumo contractual");
    } finally {
      if (!controller.signal.aborted) setReportLoading(false);
    }
  }

  return <div className="space-y-5">
    <ModuleHeader eyebrow="Cumplimiento contractual" title="Movimientos contratados" description="Elija uno o varios meses y únicamente los clientes que desea revisar. La consulta se ejecuta al confirmar y los resultados se organizan contrato por contrato." icon={CalendarDays}/>

    <section className="commercial-card overflow-hidden">
      <header className="flex flex-col gap-3 border-b border-[var(--app-border)] bg-[var(--app-surface-subtle)] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="commercial-label">Filtros de consulta</p><h2 className="text-lg font-black text-[var(--app-text)]">Periodo, clientes y contratos</h2></div>
        <div className="flex flex-wrap items-center gap-2"><span className="inline-flex w-fit items-center gap-2 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-black text-emerald-800 dark:bg-emerald-950/55 dark:text-emerald-200"><Filter className="h-3.5 w-3.5"/>{selectedMonths.length} {selectedMonths.length === 1 ? "mes" : "meses"} · {selectedContractIds.length} {selectedContractIds.length === 1 ? "contrato" : "contratos"}</span><button type="button" className="commercial-secondary min-h-9 px-3 text-xs" aria-expanded={filtersOpen} aria-controls="contract-report-filters" onClick={() => setFiltersOpen((current) => !current)}>{filtersOpen ? <ChevronUp className="h-4 w-4"/> : <ChevronDown className="h-4 w-4"/>}{filtersOpen ? "Ocultar filtros" : "Mostrar filtros"}</button></div>
      </header>

      {filtersOpen ? <div id="contract-report-filters" className="grid gap-5 p-5 xl:grid-cols-2">
        <section className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] p-4">
          <div className="flex items-center gap-3"><span className="commercial-step">1</span><div><h3 className="font-black text-[var(--app-text)]">Mes o meses</h3><p className="text-xs text-[var(--app-text-muted)]">Máximo {MAX_MONTHS} meses por consulta.</p></div></div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row"><input type="month" aria-label="Mes para agregar" value={monthDraft} onChange={(event) => setMonthDraft(event.target.value)} className="commercial-input"/><button type="button" className="commercial-secondary shrink-0" onClick={() => addMonth()}><Plus className="h-4 w-4"/>Agregar mes</button></div>
          <div className="mt-3 flex flex-wrap gap-2"><button type="button" className="commercial-filter-chip" onClick={() => chooseRecentMonths(1)}>Mes actual</button><button type="button" className="commercial-filter-chip" onClick={() => chooseRecentMonths(3)}>Últimos 3</button><button type="button" className="commercial-filter-chip" onClick={() => chooseRecentMonths(6)}>Últimos 6</button></div>
          <div className="mt-4 flex flex-wrap gap-2">{selectedMonths.map((month) => <span key={month} className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/25 dark:text-emerald-200">{shortMonthLabel(month)}<button type="button" aria-label={`Quitar ${shortMonthLabel(month)}`} onClick={() => setSelectedMonths((current) => current.filter((item) => item !== month))} className="rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10"><X className="h-3.5 w-3.5"/></button></span>)}</div>
        </section>

        <section className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] p-4">
          <div className="flex items-center gap-3"><span className="commercial-step">2</span><div><h3 className="font-black text-[var(--app-text)]">Patio y operación</h3><p className="text-xs text-[var(--app-text-muted)]">Opcional: acote todavía más la consulta.</p></div></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Localidad"><select value={localidadId ?? ""} onChange={(event) => setLocalidadId(event.target.value ? Number(event.target.value) : undefined)} className="commercial-select"><option value="">Todas las localidades</option>{analytics?.catalogs.localities.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></Field>
            <Field label="Tipo de operación"><select value={origin ?? ""} onChange={(event) => setOrigin((event.target.value || undefined) as CommercialOrigin | undefined)} className="commercial-select"><option value="">Naturales y arrastre</option><option value="NATURAL">Sólo naturales</option><option value="ARRASTRE">Sólo arrastre</option></select></Field>
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--app-border)] p-4">
          <div className="flex items-center gap-3"><span className="commercial-step">3</span><div><h3 className="font-black text-[var(--app-text)]">Clientes a revisar</h3><p className="text-xs text-[var(--app-text-muted)]">Al elegir un cliente se incluyen sus contratos vigentes.</p></div></div>
          <label className="relative mt-4 block"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-text-muted)]"/><input value={clientSearch} onChange={(event) => setClientSearch(event.target.value)} className="commercial-input pl-10" placeholder="Buscar cliente…"/></label>
          <div className="commercial-choice-list mt-3">{visibleClients.map((client) => { const selected = selectedCompanyIds.includes(client.id); return <label key={client.id} className={`commercial-choice ${selected ? "commercial-choice-selected" : ""}`}><input type="checkbox" checked={selected} onChange={(event) => toggleCompany(client.id, event.target.checked)} className="commercial-checkbox"/><span className="min-w-0 flex-1"><span className="block truncate text-sm font-black text-[var(--app-text)]">{client.name}</span><span className="text-xs font-bold text-[var(--app-text-muted)]">{client.contracts} {client.contracts === 1 ? "contrato" : "contratos"}</span></span>{selected ? <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300"/> : null}</label>; })}{!visibleClients.length ? <p className="py-6 text-center text-xs font-bold text-[var(--app-text-muted)]">No hay clientes con contratos para mostrar.</p> : null}</div>
        </section>

        <section className="rounded-2xl border border-[var(--app-border)] p-4">
          <div className="flex items-center gap-3"><span className="commercial-step">4</span><div><h3 className="font-black text-[var(--app-text)]">Contratos incluidos</h3><p className="text-xs text-[var(--app-text-muted)]">Puede quitar contratos individuales sin quitar al cliente.</p></div></div>
          <div className="commercial-choice-list mt-4">{selectableContracts.map((contract) => { const selected = selectedContractIds.includes(contract.id); return <label key={contract.id} className={`commercial-choice ${selected ? "commercial-choice-selected" : ""}`}><input type="checkbox" checked={selected} onChange={(event) => toggleContract(contract, event.target.checked)} className="commercial-checkbox"/><span className="min-w-0 flex-1"><span className="block truncate text-sm font-black text-[var(--app-text)]">{contract.nombre}</span><span className="block truncate text-xs font-bold text-[var(--app-text-muted)]">{contract.cliente?.empresaNombre} · {contract.folio}</span></span></label>; })}{!selectedCompanyIds.length ? <p className="py-6 text-center text-xs font-bold text-[var(--app-text-muted)]">Primero seleccione uno o más clientes.</p> : null}{selectedCompanyIds.length > 0 && !selectableContracts.length ? <p className="py-6 text-center text-xs font-bold text-[var(--app-text-muted)]">Los clientes elegidos no tienen contratos consultables.</p> : null}</div>
        </section>
      </div> : null}

      <footer className="flex flex-col gap-3 border-t border-[var(--app-border)] bg-[var(--app-surface-subtle)] p-5 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs font-bold text-[var(--app-text-muted)]">Se harán {selectedMonths.length || 0} {selectedMonths.length === 1 ? "consulta mensual" : "consultas mensuales"}, filtradas a {selectedCompanyIds.length} {selectedCompanyIds.length === 1 ? "cliente" : "clientes"}.</p><button type="button" data-testid="contract-report-submit" className="commercial-primary sm:min-w-56" disabled={reportLoading || !selectedMonths.length || !selectedContractIds.length} onClick={runReport}>{reportLoading ? "Consultando…" : "Consultar movimientos"}</button></footer>
    </section>

    {catalogsError || contractsError ? <Notice title="No se pudo preparar el filtro" text="Verifique que los servicios Comercial y de analítica estén activos." tone="rose"/> : null}
    {reportError ? <Notice title="Revise la selección" text={reportError} tone="amber"/> : null}
    {resultIsStale ? <Notice title="Hay cambios sin aplicar" text="Los resultados siguen mostrando la consulta anterior. Pulse Consultar movimientos para actualizarlos." tone="blue"/> : null}

    {reportLoading ? <LoadingPanel text={`Consultando ${selectedMonths.length} ${selectedMonths.length === 1 ? "mes" : "meses"} para los contratos elegidos…`}/> : applied ? <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MiniSummary icon={FileText} label="Contratos revisados" value={contractGroups.length}/>
        <MiniSummary icon={Target} label="Movimientos contratados" value={totals.contracted}/>
        <MiniSummary icon={Gauge} label="Consumo cobrable" value={totals.used}/>
        <MiniSummary icon={MapPin} label="Excedente" value={totals.excess}/>
      </section>
      {contractGroups.length ? <section className="space-y-5" data-testid="contract-report-results">{contractGroups.map((group) => <ContractSection key={group.contract.id} group={group} localidadId={applied.localidadId} origin={applied.origin}/>)}</section> : <EmptyPanel title="No hay reglas que apliquen al alcance" text="Los contratos seleccionados no tienen reglas vigentes para esos meses, patio o tipo de operación."/>}
    </> : <EmptyPanel title="La consulta está lista para configurarse" text="Seleccione el periodo y los clientes. Los movimientos sólo se cargarán cuando pulse Consultar movimientos."/>}
    {(catalogsLoading || contractsLoading) && !contracts.length ? <LoadingPanel text="Preparando clientes, contratos y localidades…"/> : null}
  </div>;
}

function ContractSection({ group, localidadId, origin }: { group: ContractGroup; localidadId?: number; origin?: CommercialOrigin }) {
  const clientStyle = colorForClient(group.contract);
  const months = groupCardsByMonth(group.cards);
  const tone = progressTone(group.percent);
  return <article data-contract-id={group.contract.id} className={`commercial-card overflow-hidden border-l-4 ${clientStyle.border}`}>
    <header className="grid gap-4 border-b border-[var(--app-border)] bg-[var(--app-surface-subtle)] p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
      <div className="min-w-0"><span className={`inline-flex max-w-full items-center gap-2 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[.1em] ${clientStyle.badge}`}><Building2 className="h-3.5 w-3.5 shrink-0"/><span className="truncate">{group.contract.cliente?.empresaNombre || "Cliente"}</span></span><h2 className="mt-3 truncate text-xl font-black text-[var(--app-text)]">{group.contract.nombre}</h2><p className="mt-1 text-xs font-bold text-[var(--app-text-muted)]">{group.contract.folio} · {months.length} {months.length === 1 ? "mes revisado" : "meses revisados"} · {group.contract.estado}</p></div>
      <div className="grid grid-cols-3 gap-2"><CompactMetric label="Contratado" value={group.contracted}/><CompactMetric label="Consumido" value={group.used}/><CompactMetric label="Excedente" value={group.excess}/></div>
    </header>
    <div className="p-4 sm:p-5">
      <div className="mb-5"><div className="flex items-center justify-between text-xs font-black"><span className="text-[var(--app-text-muted)]">Uso consolidado</span><span className={tone.text}>{group.percent}%</span></div><div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[var(--app-surface-muted)]"><div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${Math.min(100, group.percent)}%` }}/></div></div>
      <div className="space-y-3">{months.map((month) => <ContractMonth key={month.key} monthKey={month.key} label={month.label} cards={month.cards} contractId={group.contract.id} localidadId={localidadId} origin={origin}/>)}</div>
    </div>
  </article>;
}

function ContractMonth({ monthKey, label, cards, contractId, localidadId, origin }: { monthKey: string; label: string; cards: ContractMonthCard[]; contractId: number; localidadId?: number; origin?: CommercialOrigin }) {
  const totals = summarizeCards(cards);
  const [open, setOpen] = useState(false);

  return <section className="overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)]">
    <header className={`flex flex-col gap-3 bg-[var(--app-surface-subtle)] p-3 sm:flex-row sm:items-center sm:justify-between ${open ? "border-b border-[var(--app-border)]" : ""}`}>
      <button type="button" aria-expanded={open} aria-controls={`contract-month-${contractId}-${monthKey}`} onClick={() => setOpen((current) => !current)} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1 text-left hover:bg-[var(--app-surface-muted)]"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/55 dark:text-emerald-200"><CalendarDays className="h-4 w-4"/></span><span className="min-w-0 flex-1"><span className="block font-black capitalize text-[var(--app-text)]">{label}</span><span className="block text-xs font-bold text-[var(--app-text-muted)]">{formatNumber(totals.contracted)} contratados · {formatNumber(totals.used)} consumidos · {formatNumber(totals.excess)} excedente</span></span>{open ? <ChevronUp className="h-5 w-5 shrink-0 text-[var(--app-text-muted)]"/> : <ChevronDown className="h-5 w-5 shrink-0 text-[var(--app-text-muted)]"/>}</button>
    </header>
    {open ? <div id={`contract-month-${contractId}-${monthKey}`} className="space-y-2 p-3">{cards.map((card) => <OperationRow key={card.key} card={card} contractId={contractId} monthKey={monthKey} localidadId={localidadId} selectedOrigin={origin}/>)}</div> : null}
  </section>;
}

function OperationRow({ card, contractId, monthKey, localidadId, selectedOrigin }: { card: ContractMonthCard; contractId: number; monthKey: string; localidadId?: number; selectedOrigin?: CommercialOrigin }) {
  const style = CATEGORY_STYLES[card.category];
  const tone = progressTone(card.percent);
  const [downloadState, setDownloadState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [downloadMessage, setDownloadMessage] = useState("");

  async function downloadCard() {
    setDownloadState("loading");
    setDownloadMessage("");
    try {
      const origin = card.category === "ARRASTRE" ? "ARRASTRE" : card.category === "NATURALES" ? "NATURAL" : selectedOrigin;
      const response = await fetch("/bff/comercial/excel/contrato-mes", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contractId, month: monthKey, localidadId, origin, ruleIds: card.rules.map(({ rule }) => rule.id) }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || `No se pudo generar el Excel de ${style.label}`);
      }
      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = response.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1] || `COSAIF_${style.label}_${monthKey}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(href);
      setDownloadState("success");
      setDownloadMessage(`Excel de ${style.label.toLowerCase()} descargado.`);
    } catch (cause) {
      setDownloadState("error");
      setDownloadMessage(cause instanceof Error ? cause.message : `No se pudo descargar el Excel de ${style.label}`);
    }
  }

  return <div className={`rounded-xl border p-3 ${style.border} ${style.surface}`}>
    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between"><div className="min-w-0"><span className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[10px] font-black ${style.badge}`}><i className={`h-2 w-2 rounded-full ${style.dot}`}/>{style.label}</span><p className="mt-2 text-xs font-bold text-[var(--app-text-muted)]">{card.rules.map(({ rule }) => operationLabel(rule)).join(" · ")}</p></div><div className="flex flex-col gap-3 sm:flex-row sm:items-center"><div className="grid grid-cols-3 gap-4 text-right"><TinyMetric label="Contratado" value={card.contracted == null ? "Sin límite" : formatNumber(card.contracted)}/><TinyMetric label="Consumido" value={formatNumber(card.used)}/><TinyMetric label="Excedente" value={formatNumber(card.excess)}/></div><button type="button" data-testid={`contract-card-download-${contractId}-${monthKey}-${card.category}`} onClick={downloadCard} disabled={downloadState === "loading"} className="commercial-secondary min-h-10 shrink-0 px-3 text-xs">{downloadState === "loading" ? <Loader2 className="h-4 w-4 animate-spin"/> : <Download className="h-4 w-4"/>}{downloadState === "loading" ? "Construyendo…" : `Descargar ${style.label}`}</button></div></div>
    {card.contracted != null ? <><div className="mt-3 h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10"><div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${Math.min(100, card.percent)}%` }}/></div><p className={`mt-1.5 text-right text-[10px] font-black ${tone.text}`}>{card.percent}% · {card.percent >= 100 ? "Límite alcanzado" : card.percent >= 80 ? "Cerca del límite" : "Dentro de lo contratado"}</p></> : null}
    {downloadMessage ? <p className={`mt-3 rounded-lg px-3 py-2 text-xs font-bold ${downloadState === "error" ? "bg-rose-100 text-rose-700 dark:bg-rose-950/45 dark:text-rose-200" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/45 dark:text-emerald-200"}`}>{downloadMessage}</p> : null}
  </div>;
}

function CompactMetric({ label, value }: { label: string; value: number }) {
  return <div className="min-w-24 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-right"><p className="text-lg font-black text-[var(--app-text)]">{formatNumber(value)}</p><p className="text-[9px] font-black uppercase tracking-[.08em] text-[var(--app-text-muted)]">{label}</p></div>;
}

function TinyMetric({ label, value }: { label: string; value: string }) {
  return <div><p className="text-sm font-black text-[var(--app-text)]">{value}</p><p className="text-[9px] font-black uppercase tracking-[.06em] text-[var(--app-text-muted)]">{label}</p></div>;
}

function buildContractMonthCards(contracts: Contract[], months: MonthlyAnalytics[], localidadId?: number, origin?: CommercialOrigin): ContractMonthCard[] {
  return months.flatMap(({ monthKey, analytics }) => {
    const start = Date.parse(`${monthKey}-01T00:00:00Z`);
    const end = addMonth(start);
    const grouped = new Map<string, RuleContext[]>();
    for (const context of contractRules(contracts)) {
      if (!contractRuleApplies(context.contract, context.rule, start, end, localidadId, origin)) continue;
      const category = categoryForRule(context.rule);
      const key = `${context.contract.id}-${category}`;
      grouped.set(key, [...(grouped.get(key) || []), context]);
    }
    return [...grouped.entries()].map(([groupKey, contexts]) => {
      const contract = contexts[0].contract;
      const category = categoryForRule(contexts[0].rule);
      const rules = preferSpecificRules(contexts, localidadId);
      const limits = rules.map(({ rule }) => limitForMonth(rule, start, end)).filter((value): value is number => value != null);
      const contracted = limits.length ? limits.reduce((sum, value) => sum + value, 0) : null;
      const used = rules.reduce((sum, item) => sum + usedForRule(item, analytics), 0);
      const excess = contracted == null ? 0 : Math.max(0, used - contracted);
      const percent = contracted ? Math.round(used / contracted * 1000) / 10 : 0;
      return { key: `${monthKey}-${groupKey}`, monthKey, label: fullMonthLabel(monthKey), category, contract, contracted, used, excess, percent, rules };
    });
  });
}

function groupCardsByContract(cards: ContractMonthCard[]): ContractGroup[] {
  const groups = new Map<number, ContractMonthCard[]>();
  for (const card of cards) groups.set(card.contract.id, [...(groups.get(card.contract.id) || []), card]);
  return [...groups.values()].map((groupCards) => ({ contract: groupCards[0].contract, cards: groupCards, ...summarizeCards(groupCards) })).sort((a, b) => `${a.contract.cliente?.empresaNombre || ""}${a.contract.nombre}`.localeCompare(`${b.contract.cliente?.empresaNombre || ""}${b.contract.nombre}`, "es"));
}

function groupCardsByMonth(cards: ContractMonthCard[]) {
  const groups = new Map<string, ContractMonthCard[]>();
  for (const card of cards) groups.set(card.monthKey, [...(groups.get(card.monthKey) || []), card]);
  return [...groups.entries()].map(([key, monthCards]) => ({ key, label: fullMonthLabel(key), cards: monthCards })).sort((a, b) => a.key.localeCompare(b.key));
}

function summarizeCards(cards: ContractMonthCard[]) {
  const contracted = cards.reduce((sum, card) => sum + (card.contracted || 0), 0);
  const used = cards.reduce((sum, card) => sum + card.used, 0);
  const excess = cards.reduce((sum, card) => sum + card.excess, 0);
  return { contracted, used, excess, percent: contracted ? Math.round(used / contracted * 1000) / 10 : 0 };
}

function contractRules(contracts: Contract[]): RuleContext[] {
  return contracts.flatMap((contract) => (contract.paquetes || []).filter((rule) => TRACKED_SERVICES.has(rule.servicio)).map((rule) => ({ contract, rule })));
}

function preferSpecificRules(contexts: RuleContext[], localidadId?: number) {
  const groups = new Map<string, RuleContext[]>();
  for (const context of contexts) {
    const key = [context.rule.servicio, context.rule.origenOperacion || "TODOS", context.rule.unidad, context.rule.periodicidad, [...(context.rule.estadosIncluidos || [])].sort().join(",")].join("|");
    groups.set(key, [...(groups.get(key) || []), context]);
  }
  return [...groups.values()].flatMap((group) => {
    const scoped = localidadId ? group.filter(({ rule }) => rule.localidadId === localidadId) : [];
    const candidates = scoped.length ? scoped : group.filter(({ rule }) => !localidadId || !rule.localidadId);
    return candidates.slice(0, 1);
  });
}

function contractRuleApplies(contract: Contract, rule: ContractRule, monthStart: number, monthEnd: number, localidadId?: number, origin?: CommercialOrigin) {
  const contractStart = Date.parse(contract.fechaInicio);
  const contractEnd = contract.fechaFin ? Date.parse(contract.fechaFin) + 86_400_000 : Number.POSITIVE_INFINITY;
  const ruleStart = Date.parse(rule.vigenciaInicio);
  const ruleEnd = rule.vigenciaFin ? Date.parse(rule.vigenciaFin) + 86_400_000 : Number.POSITIVE_INFINITY;
  return contract.estado !== "CANCELADO" && contractStart < monthEnd && contractEnd >= monthStart && ruleStart < monthEnd && ruleEnd >= monthStart && (!localidadId || !rule.localidadId || rule.localidadId === localidadId) && (!origin || !rule.origenOperacion || rule.origenOperacion === origin);
}

function usedForRule({ contract, rule }: RuleContext, analytics: AnalyticsSummary) {
  const statuses = rule.estadosIncluidos?.length ? rule.estadosIncluidos : DEFAULT_BILLABLE_STATUSES;
  const rows = (analytics.contractTrend || []).filter((row) => row.empresaId === contract.cliente?.empresaId && (!rule.localidadId || row.localidadId === rule.localidadId) && (!rule.origenOperacion || row.origin === rule.origenOperacion) && row.service === rule.servicio && statuses.includes(row.status));
  return rule.unidad === "VAGON" ? rows.reduce((sum, row) => sum + row.wagons, 0) : rows.reduce((sum, row) => sum + row.count, 0);
}

function limitForMonth(rule: ContractRule, monthStart: number, monthEnd: number) {
  if (rule.cantidadIncluida == null || rule.unidad === "TARIFA_FIJA") return null;
  const days = Math.max(1, Math.round((monthEnd - monthStart) / 86_400_000));
  const quantity = Number(rule.cantidadIncluida);
  return rule.periodicidad === "SEMANAL" ? quantity * Math.ceil(days / 7) : quantity;
}

function categoryForRule(rule: ContractRule): OperationCategory {
  if (rule.servicio === "LAVADO") return "LAVADO";
  if (rule.servicio === "TORNEADO") return "TORNEADO";
  if (rule.origenOperacion === "ARRASTRE") return "ARRASTRE";
  return "NATURALES";
}

function operationLabel(rule: ContractRule) {
  const unit = rule.unidad === "VAGON" ? "vagones" : rule.unidad === "MOVIMIENTO" ? "movimientos" : "servicios";
  return `${rule.nombre} · ${unit}`;
}

function progressTone(percent: number) {
  return percent >= 100 ? { bar: "bg-rose-500", text: "text-rose-700 dark:text-rose-300" } : percent >= 80 ? { bar: "bg-amber-500", text: "text-amber-700 dark:text-amber-300" } : { bar: "bg-emerald-600", text: "text-emerald-700 dark:text-emerald-300" };
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function recentMonthKeys(count: number) {
  const now = new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }).sort();
}

function addMonth(value: number) {
  const date = new Date(value);
  date.setUTCMonth(date.getUTCMonth() + 1);
  return date.getTime();
}

function fullMonthLabel(monthKey: string) {
  const date = new Date(`${monthKey}-01T12:00:00`);
  return new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric" }).format(date);
}

function shortMonthLabel(monthKey: string) {
  const date = new Date(`${monthKey}-01T12:00:00`);
  return new Intl.DateTimeFormat("es-MX", { month: "short", year: "numeric" }).format(date);
}

function colorForClient(contract: Contract) {
  const seed = String(contract.cliente?.empresaId || contract.cliente?.empresaNombre || contract.id);
  return CLIENT_STYLES[Math.abs(hashSeed(seed)) % CLIENT_STYLES.length];
}

function hashSeed(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = (hash * 31 + value.charCodeAt(index)) | 0;
  return hash;
}

function signature(filters: AppliedFilters) {
  return JSON.stringify({ months: [...filters.months].sort(), contractIds: [...filters.contractIds].sort((a, b) => a - b), localidadId: filters.localidadId || null, origin: filters.origin || null });
}

function uniqueNumbers(values: number[]) {
  return [...new Set(values)];
}

function normalizeText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function MiniSummary({ icon: Icon, label, value }: { icon: typeof Target; label: string; value: number }) {
  return <article className="commercial-card flex items-center gap-3 p-4"><span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/55 dark:text-emerald-200"><Icon className="h-5 w-5"/></span><div><p className="text-2xl font-black text-[var(--app-text)]">{formatNumber(value)}</p><p className="text-xs font-bold text-[var(--app-text-muted)]">{label}</p></div></article>;
}
