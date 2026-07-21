"use client";

import { FormEvent, useMemo, useState } from "react";
import { CalendarCheck2, CheckCircle2, CircleDollarSign, HandCoins, PauseCircle, Plus, ReceiptText, WalletCards, XCircle } from "lucide-react";
import type { AnalyticsSummary, BillingCut, Contract, CrmClient } from "../crmTypes";
import { buildQuery, commercialApi } from "../_lib/api";
import { formatDate, formatMoney, formatNumber } from "../_lib/format";
import { useCrmList } from "../_lib/useCrmList";
import CommercialPeriodBar from "../_components/CommercialPeriodBar";
import { useCommercialData } from "../_components/CommercialDataProvider";
import { EmptyPanel, Field, LoadingPanel, MetricCard, Modal, ModuleHeader, Notice, Pagination, StateBadge } from "../_components/CommercialUi";

export default function CollectionsPage() {
  const { analytics, filters } = useCommercialData();
  const { items: clients, error: clientError } = useCrmList<CrmClient>("/bff/comercial/clientes?pageSize=100");
  const { items: contracts } = useCrmList<Contract>("/bff/comercial/contratos?pageSize=100");
  const crmClientId = filters.empresaId ? clients.find((item) => item.empresaId === filters.empresaId)?.id : undefined;
  const cutQuery = buildQuery({ pageSize: 100, clienteComercialId: crmClientId, desde: analytics?.meta.range.from.slice(0, 10), hasta: analytics?.meta.range.toExclusive.slice(0, 10) });
  const { items: cuts, loading, error, reload } = useCrmList<BillingCut>(`/bff/comercial/cobranza/cortes?${cutQuery}`);
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [paying, setPaying] = useState<BillingCut>();
  const visible = useMemo(() => cuts.filter((cut) => !filters.localidadId || !cut.detalles?.length || cut.detalles.some((detail) => detail.localidadId === filters.localidadId)), [cuts, filters.localidadId]);
  const pageSize = 10;
  const pages = Math.max(1, Math.ceil(visible.length / pageSize));
  const rows = visible.slice((page - 1) * pageSize, page * pageSize);
  const hasManualBalance = visible.some((cut) => cut.cobranza.total != null);
  const amounts = visible.reduce((sum, cut) => ({ captured: sum.captured + Number(cut.cobranza.total || 0), applied: sum.applied + cut.cobranza.pagado, balance: sum.balance + Number(cut.cobranza.saldo || 0) }), { captured: 0, applied: 0, balance: 0 });

  return <div className="space-y-5">
    <ModuleHeader eyebrow="Ambiente de cierres" title="Cortes contractuales por periodo" description="Revise movimientos concluidos, cancelados y detenidos antes de cerrar cada mes. El dinero no se calcula automáticamente: el saldo aparece únicamente cuando Comercial decide capturarlo." icon={HandCoins} actions={<button type="button" className="commercial-primary" onClick={() => setCreating(true)} disabled={!clients.length}><Plus className="h-4 w-4"/>Nuevo corte</button>}/>
    <CommercialPeriodBar/>
    {clientError || error ? <Notice title="Cortes pendientes de activación" text="La analítica sigue disponible. Levante msComercial para guardar cierres contractuales y, si lo necesitan, saldos manuales."/> : null}
    {loading ? <LoadingPanel text="Organizando movimientos y cortes del periodo…"/> : <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard icon={CalendarCheck2} label="Movimientos" value={formatNumber(analytics?.kpis.operations || 0)} detail={analytics?.meta.periodLabel || "Periodo elegido"} tone="blue"/>
        <MetricCard icon={CheckCircle2} label="Concluidos" value={formatNumber(analytics?.kpis.completed || 0)} detail="Terminados en el periodo" tone="emerald"/>
        <MetricCard icon={XCircle} label="Cancelados" value={formatNumber(analytics?.kpis.cancelled || 0)} detail="Separados por estatus" tone="rose"/>
        <MetricCard icon={PauseCircle} label="Detenidos" value={formatNumber(analytics?.kpis.stopped || 0)} detail="Requieren revisión" tone="amber"/>
        <MetricCard icon={ReceiptText} label="Cortes" value={formatNumber(visible.length)} detail="Cierres registrados" tone="slate"/>
      </section>

      {hasManualBalance ? <section className="commercial-card p-5"><div className="mb-4"><p className="commercial-label">Saldo manual opcional</p><h2 className="text-lg font-black text-[var(--app-text)]">Solo se muestra porque existe un saldo capturado</h2></div><div className="grid gap-3 sm:grid-cols-3"><MetricCard icon={CircleDollarSign} label="Saldo inicial" value={formatMoney(amounts.captured)} detail="Capturado por Comercial" tone="blue"/><MetricCard icon={WalletCards} label="Aplicado" value={formatMoney(amounts.applied)} detail="Registros manuales" tone="emerald"/><MetricCard icon={HandCoins} label="Restante" value={formatMoney(amounts.balance)} detail="Sin cálculo desde movimientos" tone="amber"/></div></section> : <Notice title="Sin saldos capturados" text="Esta vista funciona solo con cantidades y estados. Si algún contrato necesita control de saldo, puede agregarse manualmente al preparar su corte."/>}

      <section className="commercial-card overflow-hidden">
        <div className="overflow-x-auto"><table className="w-full min-w-[920px] text-left text-sm"><thead className="bg-[var(--app-surface-muted)] text-[10px] font-black uppercase tracking-[.1em] text-[var(--app-text-muted)]"><tr><th className="px-5 py-3">Cliente y corte</th><th className="px-4 py-3">Periodo</th><th className="px-4 py-3">Movimientos del alcance</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Saldo opcional</th><th className="px-4 py-3"></th></tr></thead><tbody className="divide-y divide-[var(--app-border)]">{rows.map((cut) => { const movement = movementSummary(cut, analytics); return <tr key={cut.id}><td className="px-5 py-4"><p className="font-black text-[var(--app-text)]">{cut.cliente.empresaNombre}</p><p className="text-xs text-[var(--app-text-muted)]">{cut.folio}{cut.contrato ? ` · ${cut.contrato.folio}` : ""}</p></td><td className="px-4 py-4 text-xs font-bold text-[var(--app-text-muted)]">{formatDate(cut.periodoInicio)} – {formatDate(cut.periodoFin)}</td><td className="px-4 py-4"><p className="font-black text-[var(--app-text)]">{formatNumber(movement.total)} movimientos</p><p className="text-xs text-[var(--app-text-muted)]">{movement.completed} concluidos · {movement.cancelled} cancelados · {movement.stopped} detenidos</p></td><td className="px-4 py-4"><StateBadge value={cut.estado}/></td><td className="px-4 py-4">{cut.cobranza.total == null ? <span className="text-xs font-bold text-[var(--app-text-muted)]">No capturado</span> : <><p className="font-black text-[var(--app-text)]">{formatMoney(cut.cobranza.saldo)}</p><p className="text-xs text-[var(--app-text-muted)]">restante</p></>}</td><td className="px-4 py-4">{cut.cobranza.total != null && cut.estado !== "PAGADO" && cut.estado !== "CANCELADO" ? <button type="button" className="commercial-secondary min-h-9 px-3 text-xs" onClick={() => setPaying(cut)}>Aplicar al saldo</button> : null}</td></tr>; })}</tbody></table></div>
        {visible.length ? <Pagination page={page} pages={pages} total={visible.length} onChange={setPage}/> : <div className="p-5"><EmptyPanel title="No hay cortes para este periodo" text="Prepare el primer cierre o cambie cliente, localidad o periodo."/></div>}
      </section>
    </>}
    {creating && analytics ? <CreateCutModal clients={clients} contracts={contracts} defaultClientId={crmClientId} from={analytics.meta.range.from.slice(0, 10)} to={new Date(new Date(analytics.meta.range.toExclusive).getTime() - 86400000).toISOString().slice(0, 10)} onClose={() => setCreating(false)} onCreated={() => { setCreating(false); reload(); }}/> : null}
    {paying ? <PaymentModal cut={paying} onClose={() => setPaying(undefined)} onCreated={() => { setPaying(undefined); reload(); }}/> : null}
  </div>;
}

function movementSummary(cut: BillingCut, analytics: AnalyticsSummary | null) {
  if (cut.detalles?.length) {
    return { total: cut.detalles.filter((item) => item.servicio === "MOVIMIENTO").length, completed: 0, cancelled: 0, stopped: 0 };
  }
  if (!analytics) return { total: 0, completed: 0, cancelled: 0, stopped: 0 };
  const rows = analytics.contractBreakdown.filter((item) => item.empresaId === cut.cliente.empresaId && item.service === "MOVIMIENTO");
  const count = (status: string) => rows.filter((item) => item.status === status).reduce((sum, item) => sum + item.count, 0);
  return { total: rows.reduce((sum, item) => sum + item.count, 0), completed: count("CONCLUIDO"), cancelled: count("CANCELADO"), stopped: count("DETENIDO") };
}

function CreateCutModal({ clients, contracts, defaultClientId, from, to, onClose, onCreated }: { clients: CrmClient[]; contracts: Contract[]; defaultClientId?: number; from: string; to: string; onClose: () => void; onCreated: () => void }) {
  const [clientId, setClientId] = useState<number | undefined>(defaultClientId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      await commercialApi("/bff/comercial/cobranza/cortes", { method: "POST", body: JSON.stringify({ clienteComercialId: Number(data.get("clienteComercialId")), contratoId: data.get("contratoId") ? Number(data.get("contratoId")) : null, folio: data.get("folio"), periodoInicio: data.get("periodoInicio"), periodoFin: data.get("periodoFin"), fechaCorte: data.get("fechaCorte"), fechaVencimiento: data.get("fechaVencimiento") || null, estado: data.get("estado"), total: data.get("total") ? Number(data.get("total")) : null, notas: data.get("notas") || null, detalles: [] }) });
      onCreated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo crear el corte");
    } finally {
      setSaving(false);
    }
  }
  return <Modal title="Nuevo corte contractual" description="Cierre el periodo por cliente y contrato. El saldo es totalmente opcional." onClose={onClose}><form onSubmit={submit} className="space-y-4 p-5"><Field label="Cliente"><select name="clienteComercialId" required value={clientId ?? ""} onChange={(event) => setClientId(event.target.value ? Number(event.target.value) : undefined)} className="commercial-select"><option value="">Seleccione…</option>{clients.map((item) => <option key={item.id} value={item.id}>{item.empresaNombre}</option>)}</select></Field><Field label="Contrato"><select name="contratoId" className="commercial-select"><option value="">Sin contrato específico</option>{contracts.filter((item) => !clientId || item.clienteComercialId === clientId).map((item) => <option key={item.id} value={item.id}>{item.folio} · {item.nombre}</option>)}</select></Field><div className="grid gap-3 sm:grid-cols-2"><Field label="Folio del corte"><input name="folio" required className="commercial-input" placeholder="Ej. ALT-JUL-2026"/></Field><Field label="Estado"><select name="estado" defaultValue="BORRADOR" className="commercial-select"><option value="BORRADOR">Borrador</option><option value="EN_REVISION">En revisión</option><option value="APROBADO">Aprobado</option></select></Field></div><div className="grid gap-3 sm:grid-cols-2"><Field label="Periodo inicio"><input name="periodoInicio" type="date" defaultValue={from} required className="commercial-input"/></Field><Field label="Periodo fin"><input name="periodoFin" type="date" defaultValue={to} required className="commercial-input"/></Field></div><div className="grid gap-3 sm:grid-cols-2"><Field label="Fecha de corte"><input name="fechaCorte" type="date" defaultValue={to} required className="commercial-input"/></Field><Field label="Vencimiento opcional"><input name="fechaVencimiento" type="date" className="commercial-input"/></Field></div><Field label="Saldo manual opcional"><input name="total" type="number" min="0" step=".01" className="commercial-input" placeholder="Déjelo vacío para controlar solo movimientos"/></Field><Field label="Notas de las reglas aplicadas"><textarea name="notas" rows={3} className="commercial-input" placeholder="Ej. Se cuentan concluidos y cancelados conforme al contrato"/></Field>{error ? <Notice tone="rose" title="No se pudo guardar" text={error}/> : null}<div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="commercial-secondary">Cancelar</button><button disabled={saving} className="commercial-primary">{saving ? "Guardando…" : "Guardar corte"}</button></div></form></Modal>;
}

function PaymentModal({ cut, onClose, onCreated }: { cut: BillingCut; onClose: () => void; onCreated: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
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
  return <Modal title="Aplicar al saldo manual" description={`${cut.cliente.empresaNombre} · Restante ${formatMoney(cut.cobranza.saldo)}`} onClose={onClose}><form onSubmit={submit} className="space-y-4 p-5"><Field label="Cantidad aplicada"><input name="monto" type="number" min=".01" step=".01" required className="commercial-input"/></Field><Field label="Fecha"><input name="fechaPago" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className="commercial-input"/></Field><div className="grid gap-3 sm:grid-cols-2"><Field label="Referencia"><input name="referencia" className="commercial-input"/></Field><Field label="Método opcional"><input name="metodo" className="commercial-input"/></Field></div>{error ? <Notice tone="rose" title="No se pudo aplicar" text={error}/> : null}<div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="commercial-secondary">Cancelar</button><button disabled={saving} className="commercial-primary">{saving ? "Guardando…" : "Aplicar"}</button></div></form></Modal>;
}
