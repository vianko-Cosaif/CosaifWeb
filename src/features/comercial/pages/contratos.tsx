"use client";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import responsive from "../components/CommercialRecords.module.css";
import { DEFAULT_BILLABLE_STATUSES, primaryRule, canEditContract, workTypeFromRule, normalizeRuleUnit, workTypeLabel, cutLabel, unitPlural, excessUnitLabel, type Locality, type ContractRule } from "../components/contracts/contractRules";
import { CalendarClock, FileCheck2, FileText, Lock, Pencil, Plus, Repeat2 } from "lucide-react";
import type { Contract, CrmClient } from "../types";
import { useCommercialData } from "../components/CommercialDataProvider";
import { buildQuery } from "../lib/api";
import { formatDate, formatMoney, formatNumber, humanize } from "../lib/format";
import { useCrmCatalog, useCrmList } from "../lib/useCrmList";
import { EmptyPanel, LoadingPanel, ModuleHeader, Notice, StateBadge, Pagination } from "../components/CommercialUi";

const preparingForm = () => <p role="status" className="commercial-card p-4 text-sm text-[var(--app-text-muted)]">Preparando formulario…</p>;
const CreateContractModal = dynamic(() => import("../components/contracts/ContractModals").then(mod => mod.CreateContractModal), { loading: preparingForm });
const EditContractModal = dynamic(() => import("../components/contracts/ContractModals").then(mod => mod.EditContractModal), { loading: preparingForm });

export default function ContractsPage() {
  const { analytics } = useCommercialData();
  const { items: clients, error: clientError } = useCrmCatalog<CrmClient>("/bff/comercial/clientes?pageSize=100");
  const [clientId, setClientId] = useState<number>();
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim().slice(0, 100));
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Contract>();
  const query = buildQuery({ q: debouncedSearch, pageSize: 25, clienteComercialId: clientId, estado: status || undefined });
  const { items: contracts, loading, error, reload, meta, page, setPage } = useCrmList<Contract>(`/bff/comercial/contratos?${query}`);
  const active = useMemo(() => contracts.filter((item) => item.estado === "VIGENTE"), [contracts]);
  const withRule = useMemo(() => contracts.filter((item) => primaryRule(item)), [contracts]);
  const localities = analytics?.catalogs.localities || [];

  return <div className="space-y-5">
    <ModuleHeader eyebrow="Contratos" title="Contrato manda el control" description="Registre vigencia, corte, cantidad incluida y estados cobrables una sola vez. Cumplimiento y cortes salen de esa regla." icon={FileText} actions={<button type="button" className="commercial-primary" onClick={() => setCreating(true)} disabled={!clients.length}><Plus className="h-4 w-4"/>Nuevo contrato</button>}/>
    <section className="commercial-card grid gap-3 p-4 sm:grid-cols-3"><label><span className="commercial-label">Buscar contrato</span><input className="commercial-input" value={search} onChange={event => setSearch(event.target.value)} placeholder="Nombre, folio u orden de compra" maxLength={100}/></label><label><span className="commercial-label">Cliente</span><select className="commercial-select" value={clientId ?? ""} onChange={(event) => setClientId(event.target.value ? Number(event.target.value) : undefined)}><option value="">Todos los clientes</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.empresaNombre}</option>)}</select></label><label><span className="commercial-label">Estado contractual</span><select className="commercial-select" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Todos los estados</option><option value="VIGENTE">Vigentes</option><option value="BORRADOR">Borradores</option><option value="VENCIDO">Vencidos</option><option value="CANCELADO">Cancelados</option></select></label></section>
    {clientError || error ? <Notice title="No se pudieron cargar los contratos" text={clientError || error}/> : null}
    {loading ? <LoadingPanel text="Cargando contratos…"/> : <>
      <section className="grid gap-3 sm:grid-cols-3"><Summary icon={FileCheck2} label="Vigentes en esta página" value={active.length}/><Summary icon={Repeat2} label="Con regla en esta página" value={withRule.length}/><Summary icon={CalendarClock} label="Corte fin de mes en esta página" value={contracts.filter((item) => !item.diaCorte || item.diaCorte === 31).length}/></section>
      <section className={`commercial-card overflow-hidden ${responsive.container}`}><div className={responsive.scroll}><table role="table" aria-label="Contratos comerciales" className={`${responsive.table} w-full min-w-[1160px] text-left text-sm`}><thead role="rowgroup" className="bg-[var(--app-surface-muted)] text-[10px] font-black uppercase tracking-[.1em] text-[var(--app-text-muted)]"><tr role="row"><th role="columnheader" scope="col" className="px-5 py-3">Cliente</th><th role="columnheader" scope="col" className="px-4 py-3">Contrato</th><th role="columnheader" scope="col" className="px-4 py-3">Vigencia</th><th role="columnheader" scope="col" className="px-4 py-3">Regla automática</th><th role="columnheader" scope="col" className="px-4 py-3">Monto por periodo</th><th role="columnheader" scope="col" className="px-4 py-3">Corte</th><th role="columnheader" scope="col" className="px-4 py-3">Estados cobrables</th><th role="columnheader" scope="col" className="px-4 py-3">Estado</th><th role="columnheader" scope="col" className="px-4 py-3">Acción</th></tr></thead><tbody role="rowgroup" className="divide-y divide-[var(--app-border)]">{contracts.map((contract) => <tr role="row" key={contract.id}><td role="cell" data-label="Cliente" className="px-5 py-4 font-black text-[var(--app-text)]">{contract.cliente?.empresaNombre || "—"}</td><td role="cell" data-label="Contrato" className="px-4 py-4"><p className="font-black text-[var(--app-text)]">{contract.nombre}</p><p className="text-xs text-[var(--app-text-muted)]">{contract.folio}</p></td><td role="cell" data-label="Vigencia" className="px-4 py-4 text-xs font-bold text-[var(--app-text-muted)]">{formatDate(contract.fechaInicio)} – {formatDate(contract.fechaFin)}</td><td role="cell" data-label="Regla automática" className="px-4 py-4"><ContractControl contract={contract} localities={localities}/></td><td role="cell" data-label="Monto por periodo" className="px-4 py-4 font-black text-[var(--app-text)]">{contract.montoMaximo ? formatMoney(Number(contract.montoMaximo)) : "Sin monto"}</td><td role="cell" data-label="Corte" className="px-4 py-4 font-black text-[var(--app-text)]">{cutLabel(contract.diaCorte)}</td><td role="cell" data-label="Estados cobrables" className="px-4 py-4"><BillableStatuses rule={primaryRule(contract)}/></td><td role="cell" data-label="Estado" className="px-4 py-4"><StateBadge value={contract.estado}/></td><td role="cell" data-label="Acción" className="px-4 py-4">{canEditContract(contract) ? <button type="button" className="commercial-secondary min-h-9 px-3 text-xs" onClick={() => setEditing(contract)}><Pencil className="h-4 w-4"/>Editar</button> : <span className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-500"><Lock className="h-3.5 w-3.5"/>Cerrado</span>}</td></tr>)}</tbody></table></div><Pagination page={page} pages={meta?.totalPages ?? 1} total={meta?.total ?? 0} onChange={setPage}/>{!contracts.length ? <div className="p-5"><EmptyPanel title="No hay contratos en esta vista" text="Registre el primer contrato o cambie los filtros."/></div> : null}</section>
    </>}
    {creating ? <CreateContractModal clients={clients} localities={localities} defaultClientId={clientId} onClose={() => setCreating(false)} onCreated={() => { setCreating(false); reload(); }}/> : null}
    {editing ? <EditContractModal contract={editing} localities={localities} onClose={() => setEditing(undefined)} onUpdated={() => { setEditing(undefined); reload(); }}/> : null}
  </div>;
}

function ContractControl({ contract, localities }: { contract: Contract; localities: Locality[] }) {
  const rule = primaryRule(contract);
  if (!rule) return <span className="text-xs font-bold text-[var(--app-text-muted)]">Sin regla automática</span>;
  const quantity = rule.unidad === "TARIFA_FIJA" ? "Cuota fija" : rule.cantidadIncluida ? `${formatNumber(Number(rule.cantidadIncluida))} ${unitPlural(rule.unidad)}` : `Por ${humanize(rule.unidad).toLowerCase()}`;
  const workType = workTypeFromRule(rule);
  const locality = rule.localidadId ? localities.find((item) => item.id === rule.localidadId)?.nombre || `Patio ${rule.localidadId}` : workType === "ARRASTRE" ? "Torreón" : "Todos los patios";
  const extraRate = rule.importeExcedente || rule.tarifaExcedente?.importeUnitario;
  return <div><p className="font-black text-[var(--app-text)]">{quantity}</p><p className="text-xs font-bold text-[var(--app-text-muted)]">{humanize(rule.periodicidad)} · {workTypeLabel(workType)} · {locality}</p>{rule.unidad !== "TARIFA_FIJA" ? <p className={`mt-1 text-[11px] font-black ${extraRate != null ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"}`}>{extraRate != null ? `Extra ${formatMoney(extraRate)} por ${excessUnitLabel(normalizeRuleUnit(rule.unidad, workType))}` : "Tarifa de excedente pendiente"}</p> : null}</div>;
}

function BillableStatuses({ rule }: { rule?: ContractRule }) {
  const statuses = rule?.estadosIncluidos?.length ? rule.estadosIncluidos : DEFAULT_BILLABLE_STATUSES;
  return <p className="max-w-48 text-xs font-bold leading-5 text-[var(--app-text-muted)]">{statuses.map(humanize).join(", ")}</p>;
}

function Summary({ icon: Icon, label, value }: { icon: typeof FileText; label: string; value: number }) {
  return <article className="commercial-card flex items-center gap-3 p-4"><span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-100 text-emerald-700"><Icon className="h-5 w-5"/></span><div><p className="text-2xl font-black text-[var(--app-text)]">{value}</p><p className="text-xs font-bold text-[var(--app-text-muted)]">{label}</p></div></article>;
}
