"use client";

import { FormEvent, useMemo, useState } from "react";
import { CalendarClock, FileCheck2, FileText, Plus } from "lucide-react";
import type { Contract, CrmClient } from "../crmTypes";
import { buildQuery, commercialApi } from "../_lib/api";
import { formatDate, formatNumber, humanize } from "../_lib/format";
import { useCrmList } from "../_lib/useCrmList";
import { EmptyPanel, Field, LoadingPanel, Modal, ModuleHeader, Notice, StateBadge } from "../_components/CommercialUi";

export default function ContractsPage() {
  const { items: clients, error: clientError } = useCrmList<CrmClient>("/bff/comercial/clientes?pageSize=100");
  const [clientId, setClientId] = useState<number>(); const [status, setStatus] = useState(""); const [creating, setCreating] = useState(false);
  const query = buildQuery({ pageSize: 100, clienteComercialId: clientId, estado: status || undefined });
  const { items: contracts, loading, error, reload } = useCrmList<Contract>(`/bff/comercial/contratos?${query}`);
  const active = useMemo(() => contracts.filter((item) => item.estado === "VIGENTE"), [contracts]);
  return <div className="space-y-5">
    <ModuleHeader eyebrow="Ambiente de contratos" title="Contratos y vigencias" description="Registre el acuerdo general por cliente. Las cantidades incluidas y su consumo se administran en Movimientos contratados." icon={FileText} actions={<button type="button" className="commercial-primary" onClick={() => setCreating(true)} disabled={!clients.length}><Plus className="h-4 w-4"/>Nuevo contrato</button>}/>
    <section className="commercial-card grid gap-3 p-4 sm:grid-cols-2 lg:max-w-3xl"><label><span className="commercial-label">Cliente</span><select className="commercial-select" value={clientId ?? ""} onChange={(event) => setClientId(event.target.value ? Number(event.target.value) : undefined)}><option value="">Todos los clientes</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.empresaNombre}</option>)}</select></label><label><span className="commercial-label">Estado contractual</span><select className="commercial-select" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Todos los estados</option><option value="VIGENTE">Vigentes</option><option value="BORRADOR">Borradores</option><option value="VENCIDO">Vencidos</option><option value="CANCELADO">Cancelados</option></select></label></section>
    {clientError || error ? <Notice title="Contratos pendientes de activación" text="Configure y levante msComercial para registrar contratos en la base independiente."/> : null}
    {loading ? <LoadingPanel text="Cargando contratos…"/> : <>
      <section className="grid gap-3 sm:grid-cols-3"><Summary icon={FileCheck2} label="Vigentes" value={active.length}/><Summary icon={CalendarClock} label="Con fecha de corte" value={contracts.filter((item) => item.diaCorte).length}/><Summary icon={FileText} label="Total registrados" value={contracts.length}/></section>
      <section className="commercial-card overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-sm"><thead className="bg-[var(--app-surface-muted)] text-[10px] font-black uppercase tracking-[.1em] text-[var(--app-text-muted)]"><tr><th className="px-5 py-3">Cliente</th><th className="px-4 py-3">Contrato</th><th className="px-4 py-3">Vigencia</th><th className="px-4 py-3">Control del consumo</th><th className="px-4 py-3">Orden de compra</th><th className="px-4 py-3">Día de corte</th><th className="px-4 py-3">Configuraciones</th><th className="px-4 py-3">Estado</th></tr></thead><tbody className="divide-y divide-[var(--app-border)]">{contracts.map((contract) => <tr key={contract.id}><td className="px-5 py-4 font-black text-[var(--app-text)]">{contract.cliente?.empresaNombre || "—"}</td><td className="px-4 py-4"><p className="font-black text-[var(--app-text)]">{contract.nombre}</p><p className="text-xs text-[var(--app-text-muted)]">{contract.folio}</p></td><td className="px-4 py-4 text-xs font-bold text-[var(--app-text-muted)]">{formatDate(contract.fechaInicio)} – {formatDate(contract.fechaFin)}</td><td className="px-4 py-4"><ContractControl contract={contract}/></td><td className="px-4 py-4 font-bold text-[var(--app-text)]">{contract.ordenCompra || "Pendiente"}</td><td className="px-4 py-4 font-black text-[var(--app-text)]">{contract.diaCorte ? `Día ${contract.diaCorte}` : "Sin día fijo"}</td><td className="px-4 py-4"><p className="font-black text-[var(--app-text)]">{contract._count?.paquetes || 0}</p><p className="text-xs text-[var(--app-text-muted)]">controles configurados</p></td><td className="px-4 py-4"><StateBadge value={contract.estado}/></td></tr>)}</tbody></table></div>{!contracts.length ? <div className="p-5"><EmptyPanel title="No hay contratos en esta vista" text="Registre el primer contrato o cambie los filtros."/></div> : null}</section>
    </>}
    {creating ? <CreateContractModal clients={clients} defaultClientId={clientId} onClose={() => setCreating(false)} onCreated={() => { setCreating(false); reload(); }}/> : null}
  </div>;
}

function CreateContractModal({ clients, defaultClientId, onClose, onCreated }: { clients: CrmClient[]; defaultClientId?: number; onClose: () => void; onCreated: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [createRule, setCreateRule] = useState(true);
  const [unit, setUnit] = useState<"MOVIMIENTO" | "TARIFA_FIJA">("MOVIMIENTO");
  const [periodicity, setPeriodicity] = useState("MENSUAL");
  const periodicityLabel = humanize(periodicity).toLowerCase();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const optionalNumber = (name: string) => data.get(name) ? Number(data.get(name)) : null;
    const contractName = String(data.get("nombre") || "Contrato");
    try {
      await commercialApi("/bff/comercial/contratos", {
        method: "POST",
        body: JSON.stringify({
          clienteComercialId: Number(data.get("clienteComercialId")),
          nombre: contractName,
          folio: data.get("folio"),
          estado: data.get("estado"),
          fechaInicio: data.get("fechaInicio"),
          fechaFin: data.get("fechaFin") || null,
          ordenCompra: data.get("ordenCompra") || null,
          diaCorte: optionalNumber("diaCorte"),
          reglaInicial: createRule ? {
            nombre: `${contractName} · control ${periodicityLabel}`,
            servicio: "MOVIMIENTO",
            origenOperacion: null,
            unidad: unit,
            periodicidad: periodicity,
            cantidadIncluida: unit === "MOVIMIENTO" ? optionalNumber("cantidadIncluida") : null,
            estadosIncluidos: ["CONCLUIDO"],
            notas: unit === "TARIFA_FIJA" ? "Cuota fija por periodo; monto no capturado." : "Control de movimientos concluidos por periodo.",
          } : undefined,
        }),
      });
      onCreated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo crear el contrato");
    } finally {
      setSaving(false);
    }
  }

  return <Modal title="Nuevo contrato" description="La vigencia y el periodo de control son independientes: un contrato anual puede controlarse cada mes." onClose={onClose}>
    <form onSubmit={submit} className="space-y-4 p-5">
      <Field label="Cliente"><select name="clienteComercialId" required defaultValue={defaultClientId || ""} className="commercial-select"><option value="">Seleccione…</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.empresaNombre}</option>)}</select></Field>
      <Field label="Nombre del contrato"><input name="nombre" required className="commercial-input"/></Field>
      <div className="grid gap-3 sm:grid-cols-2"><Field label="Folio"><input name="folio" required className="commercial-input"/></Field><Field label="Estado"><select name="estado" defaultValue="VIGENTE" className="commercial-select"><option value="BORRADOR">Borrador</option><option value="VIGENTE">Vigente</option></select></Field></div>
      <section className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] p-4">
        <p className="commercial-label">1. Vigencia completa del contrato</p>
        <p className="mb-3 text-xs font-bold text-[var(--app-text-muted)]">Ejemplo: del 1 de enero al 31 de diciembre.</p>
        <div className="grid gap-3 sm:grid-cols-2"><Field label="Inicio"><input name="fechaInicio" type="date" required className="commercial-input"/></Field><Field label="Fin"><input name="fechaFin" type="date" className="commercial-input"/></Field></div>
      </section>
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900 dark:bg-emerald-950/20">
        <label className="flex cursor-pointer items-start gap-3"><input type="checkbox" checked={createRule} onChange={(event) => setCreateRule(event.target.checked)} className="mt-1 h-4 w-4"/><span><span className="block text-sm font-black text-[var(--app-text)]">2. Configurar ahora el control recurrente</span><span className="block text-xs font-bold text-[var(--app-text-muted)]">Se repetirá dentro de la vigencia; no cambia la duración del contrato.</span></span></label>
        {createRule ? <div className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2"><Field label="Forma de control"><select value={unit} onChange={(event) => setUnit(event.target.value as "MOVIMIENTO" | "TARIFA_FIJA")} className="commercial-select"><option value="MOVIMIENTO">Por movimientos del periodo</option><option value="TARIFA_FIJA">Cuota fija por periodo</option></select></Field><Field label="Cada cuánto se revisa"><select value={periodicity} onChange={(event) => setPeriodicity(event.target.value)} className="commercial-select"><option value="SEMANAL">Cada semana</option><option value="MENSUAL">Cada mes</option><option value="BIMESTRAL">Cada bimestre</option><option value="SEMESTRAL">Cada semestre</option><option value="ANUAL">Cada año</option><option value="VIGENCIA_COMPLETA">Toda la vigencia</option></select></Field></div>
          {unit === "MOVIMIENTO" ? <Field label={`Movimientos incluidos ${periodicity === "VIGENCIA_COMPLETA" ? "en toda la vigencia" : `por ${periodicityLabel}`}`}><input name="cantidadIncluida" type="number" min="1" step="1" className="commercial-input" placeholder="Opcional; ej. 120"/></Field> : <Notice tone="blue" title={`Cuota ${periodicityLabel}`} text="Se controlará un corte por periodo. El monto puede quedar vacío y capturarse después."/>}
          <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">Ejemplo válido: contrato de 1 año + 120 movimientos cada mes.</p>
        </div> : null}
      </section>
      <div className="grid gap-3 sm:grid-cols-2"><Field label="Día de corte"><input name="diaCorte" type="number" min="1" max="31" className="commercial-input"/></Field><Field label="Orden de compra"><input name="ordenCompra" className="commercial-input"/></Field></div>
      {error ? <Notice tone="rose" title="No se pudo guardar" text={error}/> : null}
      <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="commercial-secondary">Cancelar</button><button disabled={saving} className="commercial-primary">{saving ? "Guardando…" : "Guardar contrato"}</button></div>
    </form>
  </Modal>;
}

function ContractControl({ contract }: { contract: Contract }) {
  const rule = contract.paquetes?.[0];
  if (!rule) return <span className="text-xs font-bold text-[var(--app-text-muted)]">Sin control configurado</span>;
  const mode = rule.unidad === "TARIFA_FIJA" ? "Cuota fija" : rule.cantidadIncluida ? `${formatNumber(Number(rule.cantidadIncluida))} ${humanize(rule.unidad).toLowerCase()}` : `Por ${humanize(rule.unidad).toLowerCase()}`;
  return <div><p className="font-black text-[var(--app-text)]">{humanize(rule.periodicidad)}</p><p className="text-xs font-bold text-[var(--app-text-muted)]">{mode}</p></div>;
}

function Summary({ icon: Icon, label, value }: { icon: typeof FileText; label: string; value: number }) { return <article className="commercial-card flex items-center gap-3 p-4"><span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-100 text-emerald-700"><Icon className="h-5 w-5"/></span><div><p className="text-2xl font-black text-[var(--app-text)]">{value}</p><p className="text-xs font-bold text-[var(--app-text-muted)]">{label}</p></div></article>; }
