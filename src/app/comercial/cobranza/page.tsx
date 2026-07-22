"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, CalendarRange, Check, CheckCircle2, Clock3, FileDown, FileSpreadsheet, FileWarning, HandCoins, History, Loader2, MapPin, Pencil, ReceiptText, Send, ShieldCheck, TrainFront, UserRound, WalletCards, X } from "lucide-react";
import type { AnalyticsSummary, BillingCut, Contract, CrmClient } from "../crmTypes";
import { buildQuery, commercialApi } from "../_lib/api";
import { formatDate, formatMoney, formatNumber, humanize, todayIso } from "../_lib/format";
import { useCrmList } from "../_lib/useCrmList";
import { useCommercialData } from "../_components/CommercialDataProvider";
import { EmptyPanel, Field, LoadingPanel, MetricCard, Modal, ModuleHeader, Notice } from "../_components/CommercialUi";

type ContractRule = NonNullable<Contract["paquetes"]>[number];
type CollectionState = "PAGADO" | "VENCIDO" | "POR_VENCER" | "SIN_MONTO" | "CANCELADO" | "PENDIENTE";
type BillingRow = {
  key: string;
  cut?: BillingCut;
  contract?: Contract;
  clientId: number;
  companyId: number;
  companyName: string;
  contractId: number | null;
  contractLabel: string;
  folio: string;
  periodStart: string;
  periodEnd: string;
  state: string;
  saved: boolean;
  amount: number | null;
  paid: number;
  balance: number | null;
  dueDate: string | null;
  collectionState: CollectionState;
  movement: MovementSummary;
  pricing: PricingSummary;
};
type BillingViewRow = BillingRow & { monthKey: string; monthLabel: string; contractKind: string; analytics: AnalyticsSummary };
type BillingNavigationGroup = { kind: string; contracts: Array<{ key: string; label: string; company: string; rows: BillingViewRow[] }> };
type BillingCutHistory = {
  id: number;
  corteId: number;
  accion: string;
  estadoAnterior: BillingCut["estado"] | null;
  estadoNuevo: BillingCut["estado"] | null;
  actorId: number;
  actorNombre: string | null;
  actorRol: string;
  cambios: Record<string, unknown> | null;
  createdAt: string;
};
type MovementSummary = { billable: number; total: number; completed: number; cancelled: number; stopped: number; inProcess: number };
type ServiceCharge = {
  key: string;
  ruleId: number;
  label: string;
  service: ContractRule["servicio"];
  origin: ContractRule["origenOperacion"];
  unit: ContractRule["unidad"];
  periodicity: ContractRule["periodicidad"];
  periods: number;
  included: number | null;
  consumed: number;
  total: number;
  excess: number;
  baseAmount: number | null;
  extraRate: number | null;
  extraAmount: number | null;
  completed: number;
  cancelled: number;
  stopped: number;
  inProcess: number;
};
type PricingSummary = {
  lines: ServiceCharge[];
  baseAmount: number | null;
  extrasAmount: number;
  knownTotal: number;
  total: number | null;
  missingBase: boolean;
  missingRates: number;
  complete: boolean;
};
type CutEvidence = {
  generatedAt: string;
  contract: { id: number; folio: string; name: string; client: string; currency: string };
  cut: { id: number | null; folio: string; state: string; invoice: string | null; dueDate: string | null };
  period: { start: string; end: string; label: string; periods: number };
  totals: { base: number | null; extras: number; calculated: number | null; official: number | null; paid: number; balance: number | null; missingBase: boolean; missingRates: number };
  rules: Array<{ ruleId: number; name: string; serviceLabel: string; unitLabel: string; included: number | null; consumed: number; excess: number; unitRate: number | null; extraAmount: number | null; missingRate: boolean }>;
  excessRows: Array<{ key: string; movementId: string; reference: string; serviceLabel: string; requester: string; requestedAt: string; startedAt: string | null; completedAt: string | null; fromTrack: string | null; toTrack: string | null; status: string; locality: string; quantity: number; excessQuantity: number; unitRate: number | null; amount: number | null }>;
};

const DEFAULT_BILLABLE_STATUSES = ["CONCLUIDO", "CANCELADO", "DETENIDO", "EN_PROCESO"];

export default function CollectionsPage() {
  const { analytics, filters, setFilters } = useCommercialData();
  const { empresaId, localidadId, origin } = filters;
  const { items: clients, error: clientError } = useCrmList<CrmClient>("/bff/comercial/clientes?pageSize=100");
  const { items: contracts } = useCrmList<Contract>("/bff/comercial/contratos?pageSize=100");
  const initialMonth = filters.referenceDate.slice(0, 7);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([initialMonth]);
  const [monthAnalytics, setMonthAnalytics] = useState<Record<string, AnalyticsSummary>>({});
  const [monthsLoading, setMonthsLoading] = useState(true);
  const [monthsError, setMonthsError] = useState("");
  const [generalDownloading, setGeneralDownloading] = useState(false);
  const sortedMonths = useMemo(() => [...selectedMonths].sort(), [selectedMonths]);
  const crmClientId = empresaId ? clients.find((item) => item.empresaId === empresaId)?.id : undefined;
  const rangeStart = `${sortedMonths[0]}-01`;
  const rangeEnd = monthEnd(sortedMonths[sortedMonths.length - 1]);
  const cutQuery = buildQuery({ pageSize: 100, clienteComercialId: crmClientId, desde: rangeStart, hasta: rangeEnd });
  const { items: cuts, loading: cutsLoading, error, reload } = useCrmList<BillingCut>(`/bff/comercial/cobranza/cortes?${cutQuery}`);
  const [creating, setCreating] = useState<BillingViewRow | null>(null);
  const [paying, setPaying] = useState<BillingCut>();
  const [editing, setEditing] = useState<{ cut: BillingCut; mode: "EDIT" | "INVOICE" }>();
  const [selectedKey, setSelectedKey] = useState<string>();

  useEffect(() => {
    const controller = new AbortController();
    setMonthsLoading(true);
    setMonthsError("");
    Promise.all(sortedMonths.map(async (month) => {
      const query = buildQuery({ period: "MONTH", referenceDate: `${month}-01`, empresaId, localidadId, origin, page: 1, pageSize: 10_000 });
      return [month, await commercialApi<AnalyticsSummary>(`/bff/comercial/analitica?${query}`, { signal: controller.signal })] as const;
    })).then((entries) => setMonthAnalytics(Object.fromEntries(entries))).catch((cause) => {
      if ((cause as Error).name !== "AbortError") setMonthsError(cause instanceof Error ? cause.message : "No se pudieron cargar los meses elegidos");
    }).finally(() => {
      if (!controller.signal.aborted) setMonthsLoading(false);
    });
    return () => controller.abort();
  }, [sortedMonths, empresaId, localidadId, origin]);

  const billingRows = useMemo<BillingViewRow[]>(() => sortedMonths.flatMap((month) => {
    const monthly = monthAnalytics[month];
    if (!monthly) return [];
    return buildBillingRows({ analytics: monthly, clients, contracts, cuts: cuts.filter((cut) => cutOverlapsMonth(cut, month)), filters: { empresaId, localidadId, origin } }).map((row) => ({ ...row, key: `${month}:${row.key}`, monthKey: month, monthLabel: monthName(month), contractKind: contractKind(row.contract), analytics: monthly }));
  }), [sortedMonths, monthAnalytics, clients, contracts, cuts, empresaId, localidadId, origin]);
  const navigation = useMemo(() => buildBillingNavigation(billingRows), [billingRows]);
  const selected = billingRows.find((row) => row.key === selectedKey) || billingRows[0];
  useEffect(() => {
    if (selected && selected.key !== selectedKey) setSelectedKey(selected.key);
  }, [selected?.key, selectedKey]);
  const totals = billingRows.reduce((sum, row) => ({
    billable: sum.billable + row.movement.billable,
    saved: sum.saved + (row.saved ? 1 : 0),
    pending: sum.pending + (row.saved ? 0 : 1),
    amount: sum.amount + (row.amount || 0),
    paid: sum.paid + row.paid,
    balance: sum.balance + (row.balance || 0),
    overdue: sum.overdue + (row.collectionState === "VENCIDO" ? row.balance || 0 : 0),
    upcoming: sum.upcoming + (row.collectionState === "POR_VENCER" ? row.balance || 0 : 0),
    noAmount: sum.noAmount + (row.collectionState === "SIN_MONTO" ? 1 : 0),
    excess: sum.excess + row.pricing.lines.reduce((total, line) => total + line.excess, 0),
    base: sum.base + (row.pricing.baseAmount || 0),
    extras: sum.extras + row.pricing.extrasAmount,
    incomplete: sum.incomplete + (row.pricing.complete || row.saved && row.amount != null ? 0 : 1),
    missingRates: sum.missingRates + row.pricing.missingRates,
    closed: sum.closed + (row.collectionState === "PAGADO" ? 1 : 0),
  }), { billable: 0, saved: 0, pending: 0, amount: 0, paid: 0, balance: 0, overdue: 0, upcoming: 0, noAmount: 0, excess: 0, base: 0, extras: 0, incomplete: 0, missingRates: 0, closed: 0 });

  async function downloadGeneralCut() {
    const contractIds = [...new Set(billingRows.map((row) => row.contractId).filter((value): value is number => value != null))];
    if (!contractIds.length) return;
    setGeneralDownloading(true);
    setMonthsError("");
    try {
      const response = await fetch("/bff/comercial/cobranza/corte-general/pdf", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contractIds, months: sortedMonths, localidadId, origin }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "No se pudo generar el Corte general");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = response.headers.get("content-disposition")?.match(/filename="?([^";]+)"?/)?.[1] || "COSAIF_Corte_General.pdf";
      link.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setMonthsError(cause instanceof Error ? cause.message : "No se pudo generar el Corte general");
    } finally {
      setGeneralDownloading(false);
    }
  }

  return <div className="space-y-5">
    <ModuleHeader eyebrow="Control contractual" title="Cortes por contrato" description="Compare uno o varios meses siguiendo la ruta tipo de contrato → contrato → mes." icon={HandCoins} actions={<button type="button" disabled={!billingRows.length || generalDownloading} onClick={downloadGeneralCut} className="commercial-secondary border-white/20 bg-white/10 text-white hover:bg-white/20"><FileSpreadsheet className="h-4 w-4"/>{generalDownloading ? "Generando…" : "Corte general"}</button>}/>
    <MultiMonthScope analytics={analytics} filters={{ empresaId, localidadId, origin }} selectedMonths={selectedMonths} onMonthsChange={setSelectedMonths} onScopeChange={setFilters} loading={monthsLoading}/>
    {clientError || error || monthsError ? <Notice tone="rose" title="No se pudieron cargar los cortes" text={clientError || error || monthsError}/> : null}
    {cutsLoading || monthsLoading ? <LoadingPanel text="Organizando contratos y meses seleccionados…"/> : <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard icon={ReceiptText} label="Contratos" value={formatNumber(new Set(billingRows.map((row) => row.contractId || row.contractLabel)).size)} detail={`${navigation.length} tipos de contrato`} tone="slate"/>
        <MetricCard icon={CalendarRange} label="Meses seleccionados" value={formatNumber(sortedMonths.length)} detail={selectedMonthsLabel(sortedMonths)} tone="blue"/>
        <MetricCard icon={CheckCircle2} label="Consumo contractual" value={formatNumber(totals.billable)} detail="Unidades que cuentan por reglas" tone="emerald"/>
        <MetricCard icon={WalletCards} label="Cortes cobrados" value={`${formatNumber(totals.closed)} / ${formatNumber(billingRows.length)}`} detail="Contrato-mes liquidado" tone={totals.closed === billingRows.length && billingRows.length ? "emerald" : "blue"}/>
        <MetricCard icon={AlertTriangle} label="Excedentes" value={formatNumber(totals.excess)} detail="Fuera de lo incluido" tone={totals.excess ? "amber" : "emerald"}/>
      </section>

      {totals.incomplete ? <Notice tone="blue" title={`${formatNumber(totals.incomplete)} cortes sin información económica completa`} text="El monto base y las tarifas son opcionales. Puede dar seguimiento, aprobar, facturar y cerrar el corte aunque esos datos no se capturen."/> : null}

      <section className="grid min-h-[620px] gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="commercial-card flex min-h-0 flex-col overflow-hidden">
          <div className="border-b border-[var(--app-border)] p-4"><p className="commercial-label">Explorador de contratos</p><p className="mt-1 text-xs font-bold text-[var(--app-text-muted)]">Tipo → contrato → mes del corte.</p></div>
          <div className="max-h-[760px] flex-1 space-y-3 overflow-y-auto p-3">{navigation.map((group) => <ContractTypeGroup key={group.kind} group={group} selectedKey={selected?.key} onSelect={setSelectedKey}/>)}{!navigation.length ? <EmptyPanel title="Sin contratos para estos meses" text="Cambie los meses o el alcance seleccionado."/> : null}</div>
        </aside>
        {selected ? <CutReviewPanel row={selected} analytics={selected.analytics} localityId={localidadId} origin={origin} onCreate={(row) => setCreating(row as BillingViewRow)} onPay={setPaying} onEdit={(cut) => setEditing({ cut, mode: "EDIT" })} onInvoice={(cut) => setEditing({ cut, mode: "INVOICE" })} onChanged={reload}/> : <div className="commercial-card p-5"><EmptyPanel title="Seleccione contrato y mes" text="Aquí aparecerá el consumo incluido, cuánto falta para exceder y las operaciones fuera de rango."/></div>}
      </section>
    </>}
    {creating ? <CreateCutModal key={creating.key} clients={clients} contracts={contracts} draft={creating} from={creating.periodStart.slice(0, 10)} to={creating.periodEnd.slice(0, 10)} onClose={() => setCreating(null)} onCreated={() => { setCreating(null); reload(); }}/> : null}
    {paying ? <PaymentModal cut={paying} onClose={() => setPaying(undefined)} onCreated={() => { setPaying(undefined); reload(); }}/> : null}
    {editing ? <EditCutModal cut={editing.cut} mode={editing.mode} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); reload(); }}/> : null}
  </div>;
}

const MONTH_OPTIONS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function MultiMonthScope({ analytics, filters, selectedMonths, onMonthsChange, onScopeChange, loading }: {
  analytics: AnalyticsSummary | null;
  filters: { empresaId?: number; localidadId?: number; origin?: "NATURAL" | "ARRASTRE" };
  selectedMonths: string[];
  onMonthsChange: (months: string[]) => void;
  onScopeChange: (patch: { empresaId?: number; localidadId?: number; origin?: "NATURAL" | "ARRASTRE" }) => void;
  loading: boolean;
}) {
  const [year, setYear] = useState(Number([...selectedMonths].sort().at(-1)?.slice(0, 4) || new Date().getFullYear()));
  const years = Array.from({ length: 12 }, (_, index) => new Date().getFullYear() + 1 - index);
  const localityName = filters.localidadId ? analytics?.catalogs.localities.find((item) => item.id === filters.localidadId)?.nombre : undefined;
  const arrastreAvailable = !filters.localidadId || isTorreonName(localityName);
  function toggleMonth(month: number) {
    const key = `${year}-${String(month).padStart(2, "0")}`;
    if (selectedMonths.includes(key)) {
      if (selectedMonths.length === 1) return;
      onMonthsChange(selectedMonths.filter((item) => item !== key));
    } else {
      onMonthsChange([...selectedMonths, key].sort());
    }
  }
  function changeLocality(raw: string) {
    const localidadId = raw ? Number(raw) : undefined;
    const name = localidadId ? analytics?.catalogs.localities.find((item) => item.id === localidadId)?.nombre : undefined;
    onScopeChange({ localidadId, origin: localidadId && !isTorreonName(name) ? "NATURAL" : undefined });
  }
  return <section className="commercial-card overflow-hidden">
    <header className="flex flex-col gap-2 border-b border-[var(--app-border)] bg-[var(--app-surface-subtle)] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"><div><p className="commercial-label">Selección del corte</p><h2 className="text-lg font-black text-[var(--app-text)]">Meses y alcance</h2><p className="mt-1 text-xs font-bold text-[var(--app-text-muted)]">Puede comparar meses no consecutivos; siempre verá cada mes por separado.</p></div>{loading ? <span className="inline-flex self-start items-center gap-2 rounded-full bg-blue-100 px-3 py-1.5 text-xs font-black text-blue-800 dark:bg-blue-950/50 dark:text-blue-200"><Loader2 className="h-3.5 w-3.5 animate-spin"/>Actualizando</span> : null}</header>
    <div className="grid gap-4 p-4 sm:p-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(420px,.75fr)]">
      <div className="rounded-2xl border border-[var(--app-border)] p-4"><div className="flex items-end justify-between gap-3"><div><p className="commercial-label"><CalendarRange className="mr-1 inline h-3.5 w-3.5"/>Meses del corte</p><p className="mt-1 text-sm font-black text-[var(--app-text)]">{selectedMonthsLabel(selectedMonths)}</p></div><label className="w-28"><span className="commercial-label">Año</span><select value={year} onChange={(event) => setYear(Number(event.target.value))} className="commercial-select">{years.map((item) => <option key={item} value={item}>{item}</option>)}</select></label></div>
        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">{MONTH_OPTIONS.map((label, index) => { const key = `${year}-${String(index + 1).padStart(2, "0")}`; const selected = selectedMonths.includes(key); return <button key={key} type="button" aria-pressed={selected} onClick={() => toggleMonth(index + 1)} className={`rounded-xl border px-2 py-2.5 text-xs font-black transition ${selected ? "border-blue-600 bg-blue-600 text-white shadow-sm" : "border-[var(--app-border)] bg-[var(--app-surface-subtle)] text-[var(--app-text-muted)] hover:border-blue-300"}`}>{label.slice(0, 3)}</button>; })}</div>
        <div className="mt-3 flex flex-wrap gap-1.5">{[...selectedMonths].sort().map((month) => <span key={month} className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-black text-blue-800 dark:bg-blue-950/35 dark:text-blue-200">{monthName(month)}{selectedMonths.length > 1 ? <button type="button" aria-label={`Quitar ${monthName(month)}`} onClick={() => onMonthsChange(selectedMonths.filter((item) => item !== month))}><X className="h-3 w-3"/></button> : null}</span>)}</div>
      </div>
      <div className="rounded-2xl border border-[var(--app-border)] p-4"><p className="commercial-label">Alcance operativo</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><label><span className="commercial-label">Cliente</span><select value={filters.empresaId ?? ""} onChange={(event) => onScopeChange({ empresaId: event.target.value ? Number(event.target.value) : undefined })} className="commercial-select"><option value="">Todos los clientes</option>{analytics?.catalogs.companies.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label><label><span className="commercial-label"><MapPin className="mr-1 inline h-3.5 w-3.5"/>Patio</span><select value={filters.localidadId ?? ""} onChange={(event) => changeLocality(event.target.value)} className="commercial-select"><option value="">Todos los patios</option>{analytics?.catalogs.localities.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label></div>{arrastreAvailable ? <label className="mt-3 block"><span className="commercial-label"><TrainFront className="mr-1 inline h-3.5 w-3.5"/>Tipo de operación</span><select value={filters.origin ?? ""} onChange={(event) => onScopeChange({ origin: event.target.value ? event.target.value as "NATURAL" | "ARRASTRE" : undefined })} className="commercial-select"><option value="">Naturales y arrastre separados</option><option value="NATURAL">Naturales</option><option value="ARRASTRE">Arrastre Torreón</option></select></label> : null}</div>
    </div>
  </section>;
}

function ContractTypeGroup({ group, selectedKey, onSelect }: { group: BillingNavigationGroup; selectedKey?: string; onSelect: (key: string) => void }) {
  const groupRows = group.contracts.flatMap((contract) => contract.rows);
  const groupProgress = cutProgress(groupRows);
  return <details open className={`overflow-hidden rounded-2xl border ${groupProgress.complete ? "border-emerald-300 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/20" : "border-[var(--app-border)] bg-[var(--app-surface)]"}`}>
    <summary className={`cursor-pointer list-none px-3 py-3 ${groupProgress.complete ? "bg-emerald-100/80 dark:bg-emerald-950/45" : "bg-[var(--app-surface-subtle)]"}`}>
      <div className="flex items-center justify-between gap-2"><span className={`text-xs font-black uppercase tracking-[.06em] ${groupProgress.complete ? "text-emerald-800 dark:text-emerald-200" : "text-[var(--app-text)]"}`}>{group.kind}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${groupProgress.complete ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200"}`}>{groupProgress.label}</span></div>
    </summary>
    <div className="space-y-3 p-2">{group.contracts.map((contract) => { const progress = cutProgress(contract.rows); return <section key={contract.key} className={`rounded-xl border p-2 ${progress.complete ? "border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/25" : "border-[var(--app-border)] bg-[var(--app-surface)]"}`}>
      <div className="flex items-start justify-between gap-2 px-1 pb-2"><div className="min-w-0"><p className="truncate text-xs font-black text-[var(--app-text)]">{contract.label}</p><p className="truncate text-[10px] font-bold text-[var(--app-text-muted)]">{contract.company}</p></div><span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-black ${progress.complete ? "bg-emerald-600 text-white" : "bg-[var(--app-surface-subtle)] text-[var(--app-text-muted)]"}`}>{progress.label}</span></div>
      <div className="grid gap-1.5">{contract.rows.map((row) => { const selected = row.key === selectedKey; const visual = cutRowVisual(row); return <button key={row.key} type="button" onClick={() => onSelect(row.key)} className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left ${selected ? "ring-2 ring-blue-500/40 " : ""}${visual.className}`}><span><span className="block text-xs font-black text-[var(--app-text)]">{row.monthLabel}</span><span className={`block text-[9px] font-black uppercase ${visual.textClass}`}>{visual.label}</span></span><span className={`text-xs font-black ${row.pricing.lines.some((line) => line.excess > 0) ? "text-amber-700 dark:text-amber-300" : "text-[var(--app-text-muted)]"}`}>{formatNumber(row.pricing.lines.reduce((sum, line) => sum + line.excess, 0))} exc.</span></button>; })}</div>
    </section>; })}</div>
  </details>;
}

function cutProgress(rows: BillingViewRow[]) {
  const paid = rows.filter((row) => row.collectionState === "PAGADO").length;
  return { paid, total: rows.length, complete: rows.length > 0 && paid === rows.length, label: `${paid} de ${rows.length} cobrados` };
}

function cutRowVisual(row: BillingViewRow) {
  if (row.collectionState === "PAGADO") return { label: "Cobrado", className: "border-emerald-300 bg-emerald-100/80 dark:border-emerald-900 dark:bg-emerald-950/45", textClass: "text-emerald-800 dark:text-emerald-200" };
  if (["FACTURADO", "PARCIAL", "VENCIDO"].includes(row.state)) return { label: row.state === "PARCIAL" ? "Cobro parcial" : humanize(row.state), className: "border-violet-300 bg-violet-50 dark:border-violet-900 dark:bg-violet-950/30", textClass: "text-violet-800 dark:text-violet-200" };
  if (row.state === "APROBADO") return { label: "Aprobado", className: "border-cyan-300 bg-cyan-50 dark:border-cyan-900 dark:bg-cyan-950/30", textClass: "text-cyan-800 dark:text-cyan-200" };
  if (row.state === "EN_REVISION") return { label: "En revisión", className: "border-blue-300 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30", textClass: "text-blue-800 dark:text-blue-200" };
  if (row.saved) return { label: humanize(row.state), className: "border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/25", textClass: "text-amber-800 dark:text-amber-200" };
  return { label: "Por revisar", className: "border-transparent bg-[var(--app-surface-subtle)] hover:border-blue-300", textClass: "text-[var(--app-text-muted)]" };
}

function CutReviewPanel({ row, analytics, localityId, origin, onCreate, onPay, onEdit, onInvoice, onChanged }: {
  row: BillingViewRow;
  analytics: AnalyticsSummary;
  localityId?: number;
  origin?: "NATURAL" | "ARRASTRE";
  onCreate: (row: BillingRow) => void;
  onPay: (cut: BillingCut) => void;
  onEdit: (cut: BillingCut) => void;
  onInvoice: (cut: BillingCut) => void;
  onChanged: () => void;
}) {
  const [evidence, setEvidence] = useState<CutEvidence>();
  const [evidenceError, setEvidenceError] = useState("");
  const [loadingEvidence, setLoadingEvidence] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [transitioning, setTransitioning] = useState<BillingCut["estado"]>();
  const [historyEntries, setHistoryEntries] = useState<BillingCutHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const evidenceBody = useMemo(() => ({
    contractId: row.contractId,
    cutId: row.cut?.id,
    period: analytics.meta.period,
    referenceDate: analytics.meta.referenceDate,
    periodStart: row.periodStart.slice(0, 10),
    periodEnd: row.periodEnd.slice(0, 10),
    localidadId: localityId,
    origin,
  }), [row.key, row.contractId, row.cut?.id, row.periodStart, row.periodEnd, analytics.meta.period, analytics.meta.referenceDate, localityId, origin]);

  useEffect(() => {
    if (!row.contractId) {
      setEvidence(undefined);
      setEvidenceError("Este corte no está vinculado a un contrato.");
      return;
    }
    const controller = new AbortController();
    setLoadingEvidence(true);
    setEvidenceError("");
    commercialApi<CutEvidence>("/bff/comercial/cobranza/evidencia", {
      method: "POST",
      body: JSON.stringify(evidenceBody),
      signal: controller.signal,
    }).then(setEvidence).catch((cause) => {
      if (!controller.signal.aborted) setEvidenceError(cause instanceof Error ? cause.message : "No se pudo cargar la evidencia");
    }).finally(() => {
      if (!controller.signal.aborted) setLoadingEvidence(false);
    });
    return () => controller.abort();
  }, [evidenceBody, row.contractId]);

  useEffect(() => {
    if (!row.cut?.id) {
      setHistoryEntries([]);
      setHistoryError("");
      return;
    }
    const controller = new AbortController();
    setHistoryLoading(true);
    setHistoryError("");
    commercialApi<{ data: BillingCutHistory[] }>(`/bff/comercial/cobranza/cortes/${row.cut.id}/historial`, { signal: controller.signal })
      .then((payload) => setHistoryEntries(payload.data || []))
      .catch((cause) => {
        if (!controller.signal.aborted) setHistoryError(cause instanceof Error ? cause.message : "No se pudo cargar la bitácora");
      })
      .finally(() => {
        if (!controller.signal.aborted) setHistoryLoading(false);
      });
    return () => controller.abort();
  }, [row.cut?.id, row.cut?.updatedAt]);

  async function downloadPdf() {
    if (!row.contractId) return;
    setDownloading(true);
    setEvidenceError("");
    try {
      const response = await fetch("/bff/comercial/cobranza/evidencia/pdf", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(evidenceBody),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "No se pudo generar el PDF");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = response.headers.get("content-disposition")?.match(/filename="?([^";]+)"?/)?.[1] || `COSAIF_Corte_${row.folio}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setEvidenceError(cause instanceof Error ? cause.message : "No se pudo generar el PDF");
    } finally {
      setDownloading(false);
    }
  }

  async function transitionTo(nextState: BillingCut["estado"]) {
    if (!row.cut) return;
    setTransitioning(nextState);
    setEvidenceError("");
    try {
      await commercialApi(`/bff/comercial/cobranza/cortes/${row.cut.id}`, {
        method: "PATCH",
        body: JSON.stringify({ estado: nextState }),
      });
      onChanged();
    } catch (cause) {
      setEvidenceError(cause instanceof Error ? cause.message : "No se pudo cambiar el estado del corte");
    } finally {
      setTransitioning(undefined);
    }
  }

  const cut = row.cut;
  const editable = cut && !["PAGADO", "CANCELADO"].includes(cut.estado);
  const canSendReview = cut?.estado === "BORRADOR";
  const canApprove = cut?.estado === "EN_REVISION";
  const canInvoice = cut?.estado === "APROBADO";
  const canPay = cut && ["FACTURADO", "PARCIAL", "VENCIDO"].includes(cut.estado) && row.balance != null && row.balance > 0;
  const canCloseWithoutAmount = cut && ["FACTURADO", "VENCIDO"].includes(cut.estado) && row.amount == null;
  const rules = evidence?.rules || row.pricing.lines.map((line) => ({
    ruleId: line.ruleId,
    name: line.label,
    serviceLabel: serviceVisual(line).label,
    unitLabel: unitPlural(line.unit),
    included: line.included,
    consumed: line.consumed,
    excess: line.excess,
    unitRate: line.extraRate,
    extraAmount: line.extraAmount,
    missingRate: line.excess > 0 && line.extraRate == null,
  }));

  return <article className="commercial-card min-w-0 overflow-hidden">
    <header className="border-b border-[var(--app-border)] bg-[var(--app-surface-subtle)] p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-blue-600 px-2.5 py-1 text-[10px] font-black uppercase text-white">{row.monthLabel}</span><span className="rounded-full bg-blue-100 px-2.5 py-1 text-[10px] font-black uppercase text-blue-800 dark:bg-blue-950/55 dark:text-blue-200">{row.companyName}</span><CutStateBadge value={row.saved ? row.state : "POR_REVISAR"}/>{row.collectionState === "PAGADO" ? <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-black uppercase text-white">Cobrado</span> : null}</div>
          <h2 className="mt-3 truncate text-xl font-black text-[var(--app-text)]">{row.contractLabel}</h2>
          <p className="mt-1 text-xs font-bold text-[var(--app-text-muted)]">{row.folio} · {formatDate(row.periodStart)} – {formatDate(row.periodEnd)} · vence {formatDate(row.dueDate)}</p>
        </div>
        <div className="flex flex-wrap gap-2"><button type="button" disabled={!row.contractId || downloading} onClick={downloadPdf} className="commercial-secondary"><FileDown className="h-4 w-4"/>{downloading ? "Generando…" : "Descargar evidencia"}</button>{editable ? <button type="button" onClick={() => { if (cut) onEdit(cut); }} className="commercial-secondary"><Pencil className="h-4 w-4"/>Editar corte</button> : null}</div>
      </div>
    </header>

    <div className="space-y-5 p-4 sm:p-5">
      <CutWorkflow state={row.saved ? row.state : "POR_REVISAR"} paid={row.paid}/>

      <section className="grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,.9fr)]">
        <div className="rounded-2xl border border-[var(--app-border)] p-4"><p className="commercial-label">Cómo se obtiene el corte</p><div className="mt-3 grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2"><FormulaValue label="Base" value={formatMoney(evidence?.totals.base ?? row.pricing.baseAmount)}/><span className="font-black text-[var(--app-text-muted)]">+</span><FormulaValue label="Extras" value={formatMoney(evidence?.totals.extras ?? row.pricing.extrasAmount)}/><span className="font-black text-[var(--app-text-muted)]">=</span><FormulaValue label="Calculado" value={formatMoney(evidence?.totals.calculated ?? row.pricing.total)} strong/></div></div>
        <div className="grid grid-cols-3 gap-2 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] p-4"><CutMetric label="Total aprobado" value={formatMoney(row.amount)}/><CutMetric label="Cobrado" value={formatMoney(row.paid)}/><CutMetric label="Saldo" value={formatMoney(row.balance)}/><p className="col-span-3 mt-1 text-[11px] font-bold text-[var(--app-text-muted)]">{row.cut?.facturaFolio ? `Factura ${row.cut.facturaFolio}` : "Factura pendiente"} · {collectionDetail(row)}</p></div>
      </section>

      {row.amount == null ? <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-900 dark:border-blue-900 dark:bg-blue-950/35 dark:text-blue-100"><FileWarning className="mt-0.5 h-5 w-5 shrink-0"/><div><p className="font-black">Información económica opcional</p><p className="mt-1 text-xs font-bold">{row.pricing.missingBase ? "Monto base no capturado. " : ""}{row.pricing.missingRates === 1 ? "Hay 1 tarifa de excedente sin capturar. " : row.pricing.missingRates > 1 ? `Hay ${row.pricing.missingRates} tarifas de excedente sin capturar. ` : ""}Esto no bloquea el seguimiento del corte ni sus estados.</p></div></div> : null}

      <ServiceRulesTable rules={rules}/>
      <CutEvidenceTable evidence={evidence} loading={loadingEvidence} error={evidenceError}/>
      {cut ? <CutHistoryTimeline entries={historyEntries} loading={historyLoading} error={historyError}/> : null}

      {cut?.notas ? <div className="rounded-xl bg-[var(--app-surface-subtle)] p-4"><p className="commercial-label">Notas del corte</p><p className="mt-2 whitespace-pre-wrap text-sm font-bold text-[var(--app-text)]">{cut.notas}</p></div> : null}
      <footer className="flex flex-col gap-3 border-t border-[var(--app-border)] pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs font-bold text-[var(--app-text-muted)]"><p>El PDF conserva IDs, solicitante, fechas, vías, tarifa y monto para aclaraciones.</p>{cut?.updatedAt ? <p className="mt-1">Última edición {formatEvidenceDate(cut.updatedAt)}{cut.updatedById ? ` · usuario #${cut.updatedById}` : ""}{cut.aprobadoAt ? ` · aprobado ${formatEvidenceDate(cut.aprobadoAt)}` : ""}</p> : null}</div>
        <div className="flex flex-wrap justify-end gap-2">{!row.saved ? <button type="button" className="commercial-primary" onClick={() => onCreate(row)}>{row.amount == null ? "Crear corte sin monto" : "Crear corte para revisión"}</button> : null}{canSendReview ? <button type="button" disabled={Boolean(transitioning)} className="commercial-primary" onClick={() => transitionTo("EN_REVISION")}><Send className="h-4 w-4"/>{transitioning === "EN_REVISION" ? "Enviando…" : "Enviar a revisión"}</button> : null}{canApprove ? <button type="button" disabled={Boolean(transitioning)} className="commercial-primary" onClick={() => transitionTo("APROBADO")}><ShieldCheck className="h-4 w-4"/>{transitioning === "APROBADO" ? "Aprobando…" : "Aprobar corte"}</button> : null}{canInvoice ? <button type="button" className="commercial-primary" onClick={() => { if (cut) onInvoice(cut); }}><ReceiptText className="h-4 w-4"/>Registrar factura</button> : null}{canPay ? <button type="button" className="commercial-primary" onClick={() => { if (cut) onPay(cut); }}><WalletCards className="h-4 w-4"/>Registrar cobro</button> : null}{canCloseWithoutAmount ? <button type="button" disabled={Boolean(transitioning)} className="commercial-primary" onClick={() => transitionTo("PAGADO")}><CheckCircle2 className="h-4 w-4"/>{transitioning === "PAGADO" ? "Cerrando…" : "Marcar cobrado sin monto"}</button> : null}{row.collectionState === "PAGADO" ? <span className="inline-flex items-center gap-2 rounded-xl bg-emerald-100 px-4 py-2 text-sm font-black text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"><Check className="h-4 w-4"/>Cobrado totalmente</span> : null}</div>
      </footer>
    </div>
  </article>;
}

function ServiceRulesTable({ rules }: { rules: CutEvidence["rules"] }) {
  return <section><div className="mb-3"><p className="commercial-label">Servicios del contrato</p><h3 className="mt-1 text-base font-black text-[var(--app-text)]">Consumo contra límite contractual</h3><p className="mt-1 text-xs font-bold text-[var(--app-text-muted)]">“Disponible” explica cuánto falta para que el siguiente consumo genere excedente.</p></div><div className="overflow-x-auto rounded-2xl border border-[var(--app-border)]"><table className="w-full min-w-[760px] text-left text-xs"><thead className="bg-[var(--app-surface-subtle)] text-[10px] font-black uppercase tracking-[.08em] text-[var(--app-text-muted)]"><tr><th className="p-3">Servicio</th><th className="p-3 text-right">Incluido</th><th className="p-3 text-right">Consumido</th><th className="p-3 text-right">Disponible</th><th className="p-3 text-right">Excedente</th><th className="p-3 text-right">Tarifa</th><th className="p-3 text-right">Importe extra</th></tr></thead><tbody>{rules.map((rule) => { const remaining = rule.included == null ? null : Math.max(0, rule.included - rule.consumed); return <tr key={rule.ruleId} className="border-t border-[var(--app-border)]"><td className="p-3"><p className="font-black text-[var(--app-text)]">{rule.serviceLabel}</p><p className="text-[11px] font-bold text-[var(--app-text-muted)]">{rule.name}</p></td><td className="p-3 text-right font-bold text-[var(--app-text)]">{rule.included == null ? "Sin límite" : `${formatNumber(rule.included)} ${rule.unitLabel}`}</td><td className="p-3 text-right font-bold text-[var(--app-text)]">{formatNumber(rule.consumed)}</td><td className="p-3 text-right font-black text-blue-700 dark:text-blue-300">{remaining == null ? "No aplica" : formatNumber(remaining)}</td><td className={`p-3 text-right font-black ${rule.excess ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300"}`}>{formatNumber(rule.excess)}</td><td className="p-3 text-right font-bold text-[var(--app-text)]">{rule.unitRate == null ? rule.excess ? "Pendiente" : "—" : formatMoney(rule.unitRate)}</td><td className="p-3 text-right font-black text-[var(--app-text)]">{rule.extraAmount == null ? "Pendiente" : formatMoney(rule.extraAmount)}</td></tr>; })}</tbody></table></div></section>;
}

function CutEvidenceTable({ evidence, loading, error }: { evidence?: CutEvidence; loading: boolean; error: string }) {
  return <section><div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="commercial-label">Justificación del excedente</p><h3 className="mt-1 text-base font-black text-[var(--app-text)]">Operaciones exactas fuera de rango</h3><p className="mt-1 text-xs font-bold text-[var(--app-text-muted)]">El incluido se consume en orden de solicitud; sólo lo que rebasa el límite aparece aquí.</p></div><span className="text-xs font-black text-[var(--app-text-muted)]">{evidence?.excessRows.length ?? 0} operaciones</span></div>{loading ? <LoadingPanel text="Identificando movimientos excedentes…"/> : error ? <Notice tone="rose" title="No se pudo cargar la evidencia" text={error}/> : evidence?.excessRows.length ? <div className="overflow-x-auto rounded-2xl border border-[var(--app-border)]"><table className="w-full min-w-[860px] text-left text-xs"><thead className="bg-[var(--app-surface-subtle)] text-[10px] font-black uppercase tracking-[.08em] text-[var(--app-text-muted)]"><tr><th className="p-3">ID / servicio</th><th className="p-3">Solicitante</th><th className="p-3">Solicitud</th><th className="p-3">Fin</th><th className="p-3">Vía</th><th className="p-3 text-right">Fuera de rango</th><th className="p-3 text-right">Importe</th></tr></thead><tbody>{evidence.excessRows.slice(0, 10).map((item) => <tr key={item.key} className="border-t border-[var(--app-border)]"><td className="p-3"><p className="font-black text-[var(--app-text)]">{item.movementId}</p><p className="text-[11px] font-bold text-[var(--app-text-muted)]">{item.serviceLabel} · {humanize(item.status)}</p></td><td className="p-3 font-bold text-[var(--app-text)]">{item.requester}</td><td className="p-3 font-bold text-[var(--app-text)]">{formatEvidenceDate(item.requestedAt)}</td><td className="p-3 font-bold text-[var(--app-text)]">{formatEvidenceDate(item.completedAt)}</td><td className="p-3 font-bold text-[var(--app-text)]">{item.fromTrack || "—"} → {item.toTrack || "—"}</td><td className="p-3 text-right font-black text-amber-700 dark:text-amber-300">{formatNumber(item.excessQuantity)}</td><td className="p-3 text-right font-black text-[var(--app-text)]">{formatMoney(item.amount)}</td></tr>)}</tbody></table>{evidence.excessRows.length > 10 ? <p className="border-t border-[var(--app-border)] p-3 text-xs font-bold text-[var(--app-text-muted)]">El PDF incluye las {evidence.excessRows.length} operaciones.</p> : null}</div> : <div className="rounded-2xl border border-dashed border-[var(--app-border)] p-5 text-center"><CheckCircle2 className="mx-auto h-7 w-7 text-emerald-600"/><p className="mt-2 font-black text-[var(--app-text)]">Sin operaciones fuera de rango</p><p className="mt-1 text-xs font-bold text-[var(--app-text-muted)]">El consumo no rebasa lo incluido por el contrato.</p></div>}</section>;
}

function CutHistoryTimeline({ entries, loading, error }: { entries: BillingCutHistory[]; loading: boolean; error: string }) {
  return <details open className="overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)]">
    <summary className="cursor-pointer list-none bg-[var(--app-surface-subtle)] p-4">
      <div className="flex items-center justify-between gap-3"><div><p className="commercial-label"><History className="mr-1 inline h-3.5 w-3.5"/>Bitácora auditable</p><h3 className="mt-1 text-base font-black text-[var(--app-text)]">Historial del corte</h3><p className="mt-1 text-xs font-bold text-[var(--app-text-muted)]">Quién lo cambió, cuándo y qué valores modificó.</p></div><span className="rounded-full bg-slate-200 px-2.5 py-1 text-[10px] font-black text-slate-700 dark:bg-slate-800 dark:text-slate-200">{entries.length} {entries.length === 1 ? "evento" : "eventos"}</span></div>
    </summary>
    <div className="p-4">{loading ? <LoadingPanel text="Cargando bitácora…"/> : error ? <Notice tone="rose" title="No se pudo cargar el historial" text={error}/> : entries.length ? <div className="space-y-3">{entries.map((entry) => { const changes = historyChangeLines(entry); return <article key={entry.id} className="relative rounded-xl border border-[var(--app-border)] p-4 pl-11"><span className={`absolute left-4 top-4 flex h-6 w-6 items-center justify-center rounded-full ${entry.estadoNuevo === "PAGADO" ? "bg-emerald-600 text-white" : entry.estadoNuevo === "FACTURADO" ? "bg-violet-600 text-white" : entry.estadoNuevo === "APROBADO" ? "bg-cyan-600 text-white" : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200"}`}>{entry.estadoNuevo === "PAGADO" ? <Check className="h-3.5 w-3.5"/> : <Clock3 className="h-3.5 w-3.5"/>}</span><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-sm font-black text-[var(--app-text)]">{historyActionLabel(entry.accion)}</p><p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-[var(--app-text-muted)]"><UserRound className="h-3.5 w-3.5"/>{entry.actorNombre || `${humanize(entry.actorRol)} #${entry.actorId}`}<span>·</span>{formatEvidenceDate(entry.createdAt)}</p></div>{entry.estadoAnterior !== entry.estadoNuevo && entry.estadoNuevo ? <div className="flex items-center gap-1 text-[9px] font-black uppercase"><span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600 dark:bg-slate-800 dark:text-slate-200">{humanize(entry.estadoAnterior || "INICIAL")}</span><ArrowRight className="h-3 w-3 text-[var(--app-text-muted)]"/><span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">{humanize(entry.estadoNuevo)}</span></div> : null}</div>{changes.length ? <div className="mt-3 grid gap-1.5 sm:grid-cols-2">{changes.map((change) => <div key={change} className="rounded-lg bg-[var(--app-surface-subtle)] px-3 py-2 text-[11px] font-bold text-[var(--app-text-muted)]">{change}</div>)}</div> : null}</article>; })}</div> : <div className="rounded-xl border border-dashed border-[var(--app-border)] p-5 text-center"><History className="mx-auto h-6 w-6 text-[var(--app-text-muted)]"/><p className="mt-2 font-black text-[var(--app-text)]">Sin cambios registrados todavía</p><p className="mt-1 text-xs font-bold text-[var(--app-text-muted)]">La próxima edición, aprobación, factura o cobranza quedará registrada aquí.</p></div>}</div>
  </details>;
}

function historyActionLabel(action: string) {
  const labels: Record<string, string> = {
    CREADO: "Corte creado",
    EDITADO: "Información del corte editada",
    ENVIADO_A_REVISION: "Enviado a revisión",
    APROBADO: "Corte aprobado",
    FACTURADO: "Factura registrada",
    PAGO_PARCIAL: "Cobro parcial registrado",
    COBRADO: "Corte cobrado totalmente",
    CANCELADO: "Corte cancelado",
    REGISTRO_INICIAL: "Registro inicial importado",
  };
  return labels[action] || humanize(action);
}

function historyChangeLines(entry: BillingCutHistory) {
  const changes = entry.cambios || {};
  const payment = changes.pago && typeof changes.pago === "object" && !Array.isArray(changes.pago) ? changes.pago as Record<string, unknown> : null;
  const lines: string[] = [];
  if (payment) {
    lines.push(`Cobro: ${formatMoney(Number(payment.monto || 0))}${payment.metodo ? ` · ${String(payment.metodo)}` : ""}${payment.referencia ? ` · ref. ${String(payment.referencia)}` : ""}`);
  }
  for (const [field, raw] of Object.entries(changes)) {
    if (field === "pago" || !raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const value = raw as Record<string, unknown>;
    if (!("anterior" in value) && !("nuevo" in value)) continue;
    lines.push(`${historyFieldLabel(field)}: ${historyValue(field, value.anterior)} → ${historyValue(field, value.nuevo)}`);
  }
  return lines.slice(0, 8);
}

function historyFieldLabel(field: string) {
  const labels: Record<string, string> = { total: "Total", subtotal: "Subtotal", iva: "IVA", estado: "Estado", estadoActual: "Estado inicial registrado", facturaFolio: "Folio de factura", fechaVencimiento: "Vencimiento", periodoInicio: "Inicio del periodo", periodoFin: "Fin del periodo", fechaCorte: "Fecha de corte", notas: "Notas", cobradoAcumulado: "Cobrado acumulado", saldo: "Saldo" };
  return labels[field] || humanize(field);
}

function historyValue(field: string, value: unknown) {
  if (value == null || value === "") return "Sin dato";
  if (["total", "subtotal", "iva", "cobradoAcumulado", "saldo"].includes(field)) return formatMoney(Number(value));
  if (["fechaVencimiento", "periodoInicio", "periodoFin", "fechaCorte"].includes(field)) return formatEvidenceDate(String(value));
  if (field === "estado" || field === "estadoActual") return humanize(String(value));
  const text = String(value);
  return text.length > 80 ? `${text.slice(0, 77)}…` : text;
}

function CutWorkflow({ state, paid }: { state: string; paid: number }) {
  const rank = state === "PAGADO" ? 4 : state === "PARCIAL" ? 3 : ["FACTURADO", "VENCIDO"].includes(state) ? 3 : state === "APROBADO" ? 2 : 0;
  const steps = [{ label: "Revisión", detail: "Validar operaciones" }, { label: "Aprobado", detail: "Monto autorizado" }, { label: "Facturado", detail: "Folio registrado" }, { label: state === "PAGADO" ? "Cobrado" : "Cobranza", detail: state === "PAGADO" ? "Saldo liquidado" : `${formatMoney(paid)} cobrado` }];
  return <section><p className="commercial-label">Estado del corte</p><div className="mt-2 grid gap-2 sm:grid-cols-4">{steps.map((step, index) => { const done = rank > index; const active = rank === index; return <div key={step.label} className={`rounded-xl border p-3 ${done ? "border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30" : active ? "border-blue-400 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30" : "border-[var(--app-border)] bg-[var(--app-surface-subtle)] opacity-65"}`}><div className="flex items-center gap-2">{done ? <Check className="h-4 w-4 text-emerald-600"/> : <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-black ${active ? "bg-blue-600 text-white" : "bg-slate-300 text-slate-700 dark:bg-slate-700 dark:text-slate-200"}`}>{index + 1}</span>}<p className="text-xs font-black text-[var(--app-text)]">{step.label}</p></div><p className="mt-1 pl-6 text-[10px] font-bold text-[var(--app-text-muted)]">{step.detail}</p></div>; })}</div></section>;
}

function CutStateBadge({ value }: { value: string }) {
  const tone = value === "PAGADO" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/55 dark:text-emerald-200" : value === "CANCELADO" ? "bg-rose-100 text-rose-800 dark:bg-rose-950/55 dark:text-rose-200" : ["FACTURADO", "PARCIAL", "VENCIDO"].includes(value) ? "bg-violet-100 text-violet-800 dark:bg-violet-950/55 dark:text-violet-200" : value === "APROBADO" ? "bg-cyan-100 text-cyan-800 dark:bg-cyan-950/55 dark:text-cyan-200" : "bg-amber-100 text-amber-800 dark:bg-amber-950/55 dark:text-amber-200";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${tone}`}>{humanize(value)}</span>;
}

function CutMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2"><p className="break-words text-xs font-black leading-tight text-[var(--app-text)] sm:text-sm">{value}</p><p className="mt-1 text-[9px] font-black uppercase tracking-[.08em] text-[var(--app-text-muted)]">{label}</p></div>;
}

function FormulaValue({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className={`min-w-0 rounded-xl px-2 py-2 text-center sm:px-4 ${strong ? "bg-emerald-100 dark:bg-emerald-950/45" : "bg-[var(--app-surface-subtle)]"}`}><p className={`break-words text-xs font-black leading-tight sm:text-base ${strong ? "text-emerald-800 dark:text-emerald-200" : "text-[var(--app-text)]"}`}>{value}</p><p className="mt-1 text-[8px] font-black uppercase tracking-[.06em] text-[var(--app-text-muted)] sm:text-[9px]">{label}</p></div>;
}

function CollectionStateBadge({ value }: { value: CollectionState }) {
  const styles: Record<CollectionState, string> = {
    PAGADO: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/55 dark:text-emerald-200",
    VENCIDO: "bg-rose-100 text-rose-800 dark:bg-rose-950/55 dark:text-rose-200",
    POR_VENCER: "bg-amber-100 text-amber-800 dark:bg-amber-950/55 dark:text-amber-200",
    SIN_MONTO: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
    CANCELADO: "bg-rose-100 text-rose-800 dark:bg-rose-950/55 dark:text-rose-200",
    PENDIENTE: "bg-blue-100 text-blue-800 dark:bg-blue-950/55 dark:text-blue-200",
  };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${styles[value]}`}>{humanize(value)}</span>;
}

function collectionDetail(row: BillingRow) {
  if (row.collectionState === "VENCIDO") return `Saldo vencido desde ${formatDate(row.dueDate)}`;
  if (row.collectionState === "POR_VENCER") return `Saldo abierto hasta ${formatDate(row.dueDate)}`;
  if (row.collectionState === "PAGADO") return "Sin saldo pendiente";
  if (row.collectionState === "SIN_MONTO") return "Falta monto contractual";
  if (row.collectionState === "CANCELADO") return "Corte cancelado";
  return "Pendiente de vencer";
}

function formatEvidenceDate(value: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "short", timeStyle: "short" }).format(parsed);
}

function monthEnd(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(year, monthNumber, 0).getDate();
  return `${month}-${String(lastDay).padStart(2, "0")}`;
}

function monthName(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  if (!year || !monthNumber) return month;
  const label = new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric" }).format(new Date(year, monthNumber - 1, 1));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function selectedMonthsLabel(months: string[]) {
  const ordered = [...months].sort();
  if (ordered.length <= 3) return ordered.map(monthName).join(" · ");
  return `${ordered.length} meses · ${monthName(ordered[0])} a ${monthName(ordered[ordered.length - 1])}`;
}

function isTorreonName(value?: string) {
  return Boolean(value?.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().includes("TORREON"));
}

function cutOverlapsMonth(cut: BillingCut, month: string) {
  return cut.periodoInicio.slice(0, 10) <= monthEnd(month) && cut.periodoFin.slice(0, 10) >= `${month}-01`;
}

function contractKind(contract?: Contract) {
  if (!contract) return "Sin contrato";
  const kinds = new Set<string>();
  for (const rule of contract.paquetes || []) {
    if (rule.activo === false) continue;
    if (rule.servicio === "LAVADO") kinds.add("Lavado");
    else if (rule.servicio === "TORNEADO") kinds.add("Torneado");
    else if (rule.servicio === "MOVIMIENTO" && rule.origenOperacion === "ARRASTRE") kinds.add("Arrastre Torreón");
    else if (rule.servicio === "MOVIMIENTO") kinds.add("Movimiento natural");
  }
  if (kinds.size === 0) return "Sin clasificación";
  if (kinds.size > 1) return "Contrato mixto";
  return [...kinds][0];
}

function buildBillingNavigation(rows: BillingViewRow[]): BillingNavigationGroup[] {
  const grouped = new Map<string, Map<string, BillingNavigationGroup["contracts"][number]>>();
  for (const row of rows) {
    const contracts = grouped.get(row.contractKind) || new Map<string, BillingNavigationGroup["contracts"][number]>();
    const key = row.contractId == null ? `cut-${row.cut?.id || row.contractLabel}` : `contract-${row.contractId}`;
    const current = contracts.get(key) || { key, label: row.contractLabel, company: row.companyName, rows: [] };
    current.rows.push(row);
    contracts.set(key, current);
    grouped.set(row.contractKind, contracts);
  }
  const kindOrder = ["Movimiento natural", "Arrastre Torreón", "Lavado", "Torneado", "Contrato mixto", "Sin clasificación", "Sin contrato"];
  return [...grouped.entries()].map(([kind, contracts]) => ({
    kind,
    contracts: [...contracts.values()]
      .map((contract) => ({ ...contract, rows: contract.rows.sort((left, right) => left.monthKey.localeCompare(right.monthKey)) }))
      .sort((left, right) => left.company.localeCompare(right.company) || left.label.localeCompare(right.label)),
  })).sort((left, right) => {
    const leftIndex = kindOrder.indexOf(left.kind);
    const rightIndex = kindOrder.indexOf(right.kind);
    return (leftIndex < 0 ? kindOrder.length : leftIndex) - (rightIndex < 0 ? kindOrder.length : rightIndex) || left.kind.localeCompare(right.kind);
  });
}

function buildBillingRows({ analytics, clients, contracts, cuts, filters }: { analytics: AnalyticsSummary | null; clients: CrmClient[]; contracts: Contract[]; cuts: BillingCut[]; filters: { empresaId?: number; localidadId?: number; origin?: "NATURAL" | "ARRASTRE" } }) {
  const rows: BillingRow[] = [];
  const coveredContracts = new Set<number>();
  const rangeFrom = analytics ? Date.parse(analytics.meta.range.from) : Number.NEGATIVE_INFINITY;
  const rangeTo = analytics ? Date.parse(analytics.meta.range.toExclusive) : Number.POSITIVE_INFINITY;
  const periodStart = analytics?.meta.range.from.slice(0, 10) || "";
  const periodEnd = analytics ? new Date(rangeTo - 86_400_000).toISOString().slice(0, 10) : "";

  for (const cut of cuts) {
    if (filters.localidadId && cut.detalles?.length && !cut.detalles.some((detail) => detail.localidadId === filters.localidadId)) continue;
    const contract = cut.contratoId ? contracts.find((item) => item.id === cut.contratoId) : undefined;
    if (cut.contratoId) coveredContracts.add(cut.contratoId);
    const dueDate = cut.fechaVencimiento || automaticDueDate(cut.periodoFin, cut.cliente.diasCredito);
    const amount = cut.cobranza.total;
    const balance = cut.cobranza.saldo;
    const pricing = pricingForContract(contract, cut.cliente.empresaId, analytics, filters, rangeFrom, rangeTo);
    rows.push({
      key: `cut-${cut.id}`,
      cut,
      contract,
      clientId: cut.clienteComercialId,
      companyId: cut.cliente.empresaId,
      companyName: cut.cliente.empresaNombre,
      contractId: cut.contratoId,
      contractLabel: contract ? `${contract.folio} · ${contract.nombre}` : cut.contrato ? `${cut.contrato.folio} · ${cut.contrato.nombre}` : "Sin contrato vinculado",
      folio: cut.folio,
      periodStart: cut.periodoInicio,
      periodEnd: cut.periodoFin,
      state: cut.estado,
      saved: true,
      amount,
      paid: cut.cobranza.pagado,
      balance,
      dueDate,
      collectionState: collectionStateFor({ state: cut.estado, amount, balance, dueDate }),
      movement: movementSummary(pricing.lines),
      pricing,
    });
  }

  for (const contract of contracts) {
    if (coveredContracts.has(contract.id) || !contractMatches(contract, filters, rangeFrom, rangeTo)) continue;
    const companyId = contract.cliente?.empresaId;
    if (!companyId) continue;
    const client = clients.find((item) => item.id === contract.clienteComercialId);
    const start = clampDate(contract.fechaInicio, periodStart, "max");
    const end = clampDate(contract.fechaFin || periodEnd, periodEnd, "min");
    const dueDate = automaticDueDate(end, client?.diasCredito ?? 0);
    const pricing = pricingForContract(contract, companyId, analytics, filters, rangeFrom, rangeTo);
    const amount = pricing.total;
    const balance = amount;
    rows.push({
      key: `expected-${contract.id}`,
      contract,
      clientId: contract.clienteComercialId,
      companyId,
      companyName: contract.cliente?.empresaNombre || "Cliente",
      contractId: contract.id,
      contractLabel: `${contract.folio} · ${contract.nombre}`,
      folio: `AUTO-${contract.folio}-${analytics?.meta.reference || periodStart}`,
      periodStart: start,
      periodEnd: end,
      state: "AUTOMATICO",
      saved: false,
      amount,
      paid: 0,
      balance,
      dueDate,
      collectionState: collectionStateFor({ state: "AUTOMATICO", amount, balance, dueDate }),
      movement: movementSummary(pricing.lines),
      pricing,
    });
  }

  return rows.sort((a, b) => a.companyName.localeCompare(b.companyName) || a.contractLabel.localeCompare(b.contractLabel));
}

function collectionStateFor({ state, amount, balance, dueDate }: { state: string; amount: number | null; balance: number | null; dueDate: string | null }): CollectionState {
  if (state === "CANCELADO") return "CANCELADO";
  if (state === "PAGADO") return "PAGADO";
  if (amount == null || balance == null) return "SIN_MONTO";
  if (!dueDate) return "PENDIENTE";
  return dueDate.slice(0, 10) < todayIso() ? "VENCIDO" : "POR_VENCER";
}

function automaticDueDate(periodEnd: string, creditDays: number) {
  if (!periodEnd) return null;
  const [year, month, day] = periodEnd.slice(0, 10).split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + Math.max(0, Number(creditDays || 0)));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function contractMatches(contract: Contract, filters: { empresaId?: number; localidadId?: number; origin?: "NATURAL" | "ARRASTRE" }, rangeFrom: number, rangeTo: number) {
  if (contract.estado === "CANCELADO") return false;
  const companyId = contract.cliente?.empresaId;
  const startsAt = Date.parse(contract.fechaInicio);
  const endsAt = contract.fechaFin ? Date.parse(contract.fechaFin) + 86_400_000 : Number.POSITIVE_INFINITY;
  const rules = applicableRules(contract, filters, rangeFrom, rangeTo);
  const ruleScopeMatches = (!filters.localidadId && !filters.origin) || rules.length > 0;
  return (!filters.empresaId || companyId === filters.empresaId)
    && ruleScopeMatches
    && startsAt < rangeTo
    && endsAt >= rangeFrom;
}

function pricingForContract(contract: Contract | undefined, empresaId: number, analytics: AnalyticsSummary | null, filters: { localidadId?: number; origin?: "NATURAL" | "ARRASTRE" }, rangeFrom: number, rangeTo: number): PricingSummary {
  if (!contract || !analytics) return emptyPricing();
  const lines = applicableRules(contract, filters, rangeFrom, rangeTo).map((rule) => chargeForRule(rule, empresaId, analytics, rangeFrom, rangeTo, analytics.meta.months));
  const serviceBases = lines.filter((line) => line.baseAmount != null);
  const contractPeriods = Math.max(1, ...lines.map((line) => line.periods));
  const contractBase = nullableMoney(contract.montoMaximo);
  const baseAmount = serviceBases.length
    ? serviceBases.reduce((sum, line) => sum + Number(line.baseAmount || 0), 0)
    : contractBase == null ? null : contractBase * contractPeriods;
  const missingRates = lines.filter((line) => line.excess > 0 && line.extraRate == null).length;
  const extrasAmount = lines.reduce((sum, line) => sum + Number(line.extraAmount || 0), 0);
  const missingBase = baseAmount == null;
  const knownTotal = Number(baseAmount || 0) + extrasAmount;
  const complete = !missingBase && missingRates === 0;
  return { lines, baseAmount, extrasAmount, knownTotal, total: complete ? knownTotal : null, missingBase, missingRates, complete };
}

function emptyPricing(): PricingSummary {
  return { lines: [], baseAmount: null, extrasAmount: 0, knownTotal: 0, total: null, missingBase: true, missingRates: 0, complete: false };
}

function applicableRules(contract: Contract, filters: { localidadId?: number; origin?: "NATURAL" | "ARRASTRE" }, rangeFrom: number, rangeTo: number) {
  return (contract.paquetes || []).filter((rule) => {
    const startsAt = Date.parse(rule.vigenciaInicio);
    const endsAt = rule.vigenciaFin ? Date.parse(rule.vigenciaFin) + 86_400_000 : Number.POSITIVE_INFINITY;
    return rule.activo !== false
      && ["MOVIMIENTO", "LAVADO", "TORNEADO"].includes(rule.servicio)
      && (!filters.localidadId || !rule.localidadId || rule.localidadId === filters.localidadId)
      && (!filters.origin || !rule.origenOperacion || rule.origenOperacion === filters.origin)
      && startsAt < rangeTo
      && endsAt >= rangeFrom;
  });
}

function chargeForRule(rule: ContractRule, empresaId: number, analytics: AnalyticsSummary, rangeFrom: number, rangeTo: number, selectedMonths: number): ServiceCharge {
  const statuses = rule.estadosIncluidos?.length ? rule.estadosIncluidos : DEFAULT_BILLABLE_STATUSES;
  const rows = analytics.contractBreakdown.filter((item) =>
    item.empresaId === empresaId
    && item.service === rule.servicio
    && (!rule.localidadId || item.localidadId === rule.localidadId)
    && (!rule.origenOperacion || item.origin === rule.origenOperacion)
  );
  const measure = (status?: string) => rows.filter((item) => !status || item.status === status).reduce((sum, item) => sum + (rule.unidad === "VAGON" ? item.wagons : item.count), 0);
  const consumed = statuses.reduce((sum, status) => sum + measure(status), 0);
  const quantity = rule.cantidadIncluida == null ? null : Number(rule.cantidadIncluida);
  const periods = allowanceFactor(rule.periodicidad, rangeFrom, rangeTo, selectedMonths);
  const included = quantity == null ? null : quantity * periods;
  const excess = included == null ? 0 : Math.max(0, consumed - included);
  const extraRate = nullableMoney(rule.importeExcedente ?? rule.tarifaExcedente?.importeUnitario);
  const extraAmount = excess > 0 && extraRate == null ? null : excess * Number(extraRate || 0);
  return {
    key: `rule-${rule.id}`,
    ruleId: rule.id,
    label: rule.nombre,
    service: rule.servicio,
    origin: rule.origenOperacion,
    unit: rule.unidad,
    periodicity: rule.periodicidad,
    periods,
    included,
    consumed,
    total: measure(),
    excess,
    baseAmount: nullableMoney(rule.montoPaquete) == null ? null : Number(rule.montoPaquete) * periods,
    extraRate,
    extraAmount,
    completed: measure("CONCLUIDO"),
    cancelled: measure("CANCELADO"),
    stopped: measure("DETENIDO"),
    inProcess: measure("EN_PROCESO"),
  };
}

function allowanceFactor(periodicity: ContractRule["periodicidad"], rangeFrom: number, rangeTo: number, selectedMonths: number) {
  const safeFrom = Number.isFinite(rangeFrom) ? rangeFrom : Date.now();
  const safeTo = Number.isFinite(rangeTo) ? rangeTo : safeFrom + 86_400_000;
  const days = Math.max(1, Math.round((safeTo - safeFrom) / 86_400_000));
  const months = Math.max(1, Math.round(selectedMonths || 1));
  if (periodicity === "SEMANAL") return Math.ceil(days / 7);
  if (periodicity === "MENSUAL") return months;
  if (periodicity === "BIMESTRAL") return Math.ceil(months / 2);
  if (periodicity === "SEMESTRAL") return Math.ceil(months / 6);
  if (periodicity === "ANUAL") return Math.ceil(months / 12);
  return 1;
}

function nullableMoney(value?: string | number | null) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function movementSummary(lines: ServiceCharge[]): MovementSummary {
  return {
    billable: lines.reduce((sum, line) => sum + line.consumed, 0),
    total: lines.reduce((sum, line) => sum + line.total, 0),
    completed: lines.reduce((sum, line) => sum + line.completed, 0),
    cancelled: lines.reduce((sum, line) => sum + line.cancelled, 0),
    stopped: lines.reduce((sum, line) => sum + line.stopped, 0),
    inProcess: lines.reduce((sum, line) => sum + line.inProcess, 0),
  };
}

function CreateCutModal({ clients, contracts, draft, from, to, onClose, onCreated }: { clients: CrmClient[]; contracts: Contract[]; draft: BillingRow; from: string; to: string; onClose: () => void; onCreated: () => void }) {
  const [clientId, setClientId] = useState<number | undefined>(draft.clientId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const periodEnd = String(data.get("periodoFin") || draft.periodEnd || to);
      const details = draft.pricing.lines.map((line) => ({
        fuente: line.origin === "ARRASTRE" ? "ARRASTRE" : "NATURAL",
        fuenteId: `REGLA-${line.ruleId}-${draft.periodStart}-${draft.periodEnd}`,
        servicio: line.service,
        localidadId: draft.contract?.paquetes?.find((rule) => rule.id === line.ruleId)?.localidadId || null,
        referencia: `${line.label}: ${line.consumed} consumidos, ${line.excess} excedentes`,
        fechaServicio: periodEnd,
        cantidad: Math.max(1, line.excess || line.consumed),
        importeUnitario: line.excess ? line.extraRate : null,
        subtotal: line.extraAmount,
        estadoCobro: "PENDIENTE_VALIDACION",
      }));
      await commercialApi("/bff/comercial/cobranza/cortes", {
        method: "POST",
        body: JSON.stringify({
          clienteComercialId: Number(data.get("clienteComercialId")),
          contratoId: data.get("contratoId") ? Number(data.get("contratoId")) : null,
          folio: data.get("folio"),
          periodoInicio: data.get("periodoInicio"),
          periodoFin: periodEnd,
          fechaCorte: data.get("fechaCorte"),
          fechaVencimiento: data.get("fechaVencimiento") || draft.dueDate || null,
          estado: data.get("estado"),
          total: data.get("total") !== "" ? Number(data.get("total")) : null,
          notas: data.get("notas") || null,
          detalles: details,
        }),
      });
      onCreated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo crear el corte");
    } finally {
      setSaving(false);
    }
  }
  return <Modal title="Crear corte para revisión" description="Se guardará como borrador. Después podrá editarlo, aprobarlo, facturarlo y registrar su cobro." onClose={onClose}>
    <form onSubmit={submit} className="space-y-4 p-5">
      <div className="grid gap-3 sm:grid-cols-2"><Field label="Cliente"><select name="clienteComercialId" required value={clientId ?? ""} onChange={(event) => setClientId(event.target.value ? Number(event.target.value) : undefined)} className="commercial-select"><option value="">Seleccione…</option>{clients.map((item) => <option key={item.id} value={item.id}>{item.empresaNombre}</option>)}</select></Field><Field label="Contrato"><select name="contratoId" defaultValue={draft.contractId || ""} className="commercial-select"><option value="">Sin contrato específico</option>{contracts.filter((item) => !clientId || item.clienteComercialId === clientId).map((item) => <option key={item.id} value={item.id}>{item.folio} · {item.nombre}</option>)}</select></Field></div>
      <section className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] p-4"><p className="commercial-label">Información económica</p><div className="mt-3 grid gap-2 sm:grid-cols-3"><CutMetric label="Monto base" value={formatMoney(draft.pricing.baseAmount)}/><CutMetric label="Servicios extra" value={formatMoney(draft.pricing.extrasAmount)}/><CutMetric label="Total" value={formatMoney(draft.amount)}/></div>{!draft.pricing.complete ? <p className="mt-3 text-xs font-bold text-blue-700 dark:text-blue-300">Los importes pueden dejarse sin capturar; el seguimiento y los estados continuarán disponibles.</p> : null}</section>
      <Field label="Folio del corte"><input name="folio" required defaultValue={draft.folio} className="commercial-input" placeholder="Ej. ALT-JUL-2026"/></Field><input type="hidden" name="estado" value="BORRADOR"/>
      <div className="grid gap-3 sm:grid-cols-2"><Field label="Periodo inicio"><input name="periodoInicio" type="date" defaultValue={draft.periodStart || from} required className="commercial-input"/></Field><Field label="Periodo fin"><input name="periodoFin" type="date" defaultValue={draft.periodEnd || to} required className="commercial-input"/></Field></div>
      <div className="grid gap-3 sm:grid-cols-2"><Field label="Fecha de corte"><input name="fechaCorte" type="date" defaultValue={draft.periodEnd || to} required className="commercial-input"/></Field><Field label="Vencimiento calculado"><input name="fechaVencimiento" type="date" defaultValue={draft.dueDate || ""} className="commercial-input"/></Field></div>
      <Field label="Total del corte"><input name="total" type="number" min="0" step=".01" defaultValue={draft.amount ?? ""} className="commercial-input" placeholder="Pendiente hasta completar contrato"/></Field>
      <Field label="Notas"><textarea name="notas" rows={3} defaultValue={`Corte calculado desde contrato. Base: ${formatMoney(draft.pricing.baseAmount)}. Extras: ${formatMoney(draft.pricing.extrasAmount)}. Unidades cobrables: ${draft.movement.billable}.`} className="commercial-input"/></Field>
      {error ? <Notice tone="rose" title="No se pudo guardar" text={error}/> : null}
      <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="commercial-secondary">Cancelar</button><button disabled={saving} className="commercial-primary">{saving ? "Guardando…" : "Crear borrador"}</button></div>
    </form>
  </Modal>;
}

function EditCutModal({ cut, mode, onClose, onSaved }: { cut: BillingCut; mode: "EDIT" | "INVOICE"; onClose: () => void; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const invoicing = mode === "INVOICE";
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      await commercialApi(`/bff/comercial/cobranza/cortes/${cut.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          total: data.get("total") !== "" ? Number(data.get("total")) : null,
          fechaVencimiento: data.get("fechaVencimiento") || null,
          facturaFolio: data.get("facturaFolio") || cut.facturaFolio || null,
          notas: data.get("notas") || null,
          ...(invoicing ? { estado: "FACTURADO" } : {}),
        }),
      });
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo actualizar el corte");
    } finally {
      setSaving(false);
    }
  }
  return <Modal title={invoicing ? "Registrar factura" : "Editar corte"} description={invoicing ? "El folio identifica la factura. El importe puede permanecer sin capturar y el corte conservará su seguimiento." : "Ajuste la información disponible; el monto es opcional."} onClose={onClose}>
    <form onSubmit={submit} className="space-y-4 p-5">
      <div className="rounded-xl bg-[var(--app-surface-subtle)] p-4"><p className="commercial-label">{cut.cliente.empresaNombre}</p><p className="mt-1 font-black text-[var(--app-text)]">{cut.folio} · {humanize(cut.estado)}</p><p className="mt-1 text-xs font-bold text-[var(--app-text-muted)]">{formatDate(cut.periodoInicio)} – {formatDate(cut.periodoFin)}</p></div>
      <div className="grid gap-3 sm:grid-cols-2"><Field label="Total autorizado (opcional)"><input name="total" type="number" min="0" step=".01" defaultValue={cut.total ?? ""} className="commercial-input" placeholder="Puede permanecer reservado"/></Field><Field label="Fecha de vencimiento"><input name="fechaVencimiento" type="date" defaultValue={cut.fechaVencimiento?.slice(0, 10) || ""} className="commercial-input"/></Field></div>
      {invoicing || cut.facturaFolio ? <Field label="Folio de factura"><input name="facturaFolio" required={invoicing} defaultValue={cut.facturaFolio || ""} className="commercial-input" placeholder="Ej. FAC-2026-0041"/></Field> : null}
      <Field label="Notas y justificación"><textarea name="notas" rows={4} defaultValue={cut.notas || ""} className="commercial-input" placeholder="Explique cualquier ajuste al cálculo propuesto."/></Field>
      {error ? <Notice tone="rose" title="No se pudo guardar" text={error}/> : null}
      <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="commercial-secondary">Cancelar</button><button disabled={saving} className="commercial-primary">{saving ? "Guardando…" : invoicing ? "Guardar y facturar" : "Guardar cambios"}</button></div>
    </form>
  </Modal>;
}

function PaymentModal({ cut, onClose, onCreated }: { cut: BillingCut; onClose: () => void; onCreated: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [amount, setAmount] = useState(Number(cut.cobranza.saldo || 0));
  const fullPayment = cut.cobranza.saldo != null && Math.abs(amount - cut.cobranza.saldo) < 0.005;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      await commercialApi(`/bff/comercial/cobranza/cortes/${cut.id}/pagos`, { method: "POST", body: JSON.stringify({ monto: Number(data.get("monto")), fechaPago: data.get("fechaPago"), referencia: data.get("referencia") || null, metodo: data.get("metodo") || null }) });
      onCreated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo aplicar al saldo");
    } finally {
      setSaving(false);
    }
  }
  return <Modal title="Registrar cobro" description={`${cut.cliente.empresaNombre} · Saldo ${formatMoney(cut.cobranza.saldo)}`} onClose={onClose}><form onSubmit={submit} className="space-y-4 p-5"><div className={`rounded-xl border p-4 ${fullPayment ? "border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30" : "border-blue-300 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30"}`}><p className="font-black text-[var(--app-text)]">{fullPayment ? "El corte quedará marcado como cobrado" : "Se registrará como cobro parcial"}</p><p className="mt-1 text-xs font-bold text-[var(--app-text-muted)]">{fullPayment ? "El pago cubre el saldo completo y cerrará el flujo." : `Después quedará un saldo de ${formatMoney(Math.max(0, Number(cut.cobranza.saldo || 0) - amount))}.`}</p></div><Field label="Cantidad cobrada"><input name="monto" type="number" min=".01" max={cut.cobranza.saldo ?? undefined} step=".01" value={amount || ""} onChange={(event) => setAmount(Number(event.target.value || 0))} required className="commercial-input"/></Field><Field label="Fecha"><input name="fechaPago" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className="commercial-input"/></Field><div className="grid gap-3 sm:grid-cols-2"><Field label="Referencia"><input name="referencia" className="commercial-input"/></Field><Field label="Método opcional"><input name="metodo" className="commercial-input"/></Field></div>{error ? <Notice tone="rose" title="No se pudo aplicar" text={error}/> : null}<div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="commercial-secondary">Cancelar</button><button disabled={saving || amount <= 0} className="commercial-primary">{saving ? "Guardando…" : fullPayment ? "Marcar como cobrado" : "Registrar pago parcial"}</button></div></form></Modal>;
}

function unitPlural(value: ContractRule["unidad"]) {
  if (value === "VAGON") return "vagones";
  if (value === "SERVICIO") return "servicios";
  return "movimientos";
}

function serviceVisual(line: ServiceCharge) {
  if (line.service === "LAVADO") return { label: "Lavado", badge: "bg-cyan-100 text-cyan-800 dark:bg-cyan-950/55 dark:text-cyan-200", border: "border-cyan-200 dark:border-cyan-900/70", surface: "bg-cyan-50/60 dark:bg-cyan-950/15" };
  if (line.service === "TORNEADO") return { label: "Torneado", badge: "bg-violet-100 text-violet-800 dark:bg-violet-950/55 dark:text-violet-200", border: "border-violet-200 dark:border-violet-900/70", surface: "bg-violet-50/60 dark:bg-violet-950/15" };
  if (line.origin === "ARRASTRE") return { label: "Arrastre", badge: "bg-blue-100 text-blue-800 dark:bg-blue-950/55 dark:text-blue-200", border: "border-blue-200 dark:border-blue-900/70", surface: "bg-blue-50/60 dark:bg-blue-950/15" };
  return { label: "Naturales", badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/55 dark:text-emerald-200", border: "border-emerald-200 dark:border-emerald-900/70", surface: "bg-emerald-50/60 dark:bg-emerald-950/15" };
}

function clampDate(value: string, boundary: string, mode: "min" | "max") {
  const raw = Date.parse(value);
  const limit = Date.parse(boundary);
  const time = mode === "max" ? Math.max(raw, limit) : Math.min(raw, limit);
  return new Date(time).toISOString().slice(0, 10);
}
