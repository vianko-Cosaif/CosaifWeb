"use client";

import { FormEvent, useMemo, useState } from "react";
import { Gauge, MapPin, Pencil, Plus, Target } from "lucide-react";
import type { AnalyticsSummary, Contract, CrmClient, Package } from "../crmTypes";
import { commercialApi } from "../_lib/api";
import { formatDate, formatNumber, humanize } from "../_lib/format";
import { useCrmList } from "../_lib/useCrmList";
import CommercialPeriodBar from "../_components/CommercialPeriodBar";
import { useCommercialData } from "../_components/CommercialDataProvider";
import { EmptyPanel, Field, LoadingPanel, Modal, ModuleHeader, Notice } from "../_components/CommercialUi";

const STATUS_OPTIONS = [
  { value: "CONCLUIDO", label: "Concluidos", help: "El servicio terminó correctamente." },
  { value: "CANCELADO", label: "Cancelados", help: "El contrato indica que también deben contar." },
  { value: "DETENIDO", label: "Detenidos", help: "Se contabilizan aunque hayan quedado detenidos." },
  { value: "EN_PROCESO", label: "En proceso", help: "Se cuentan antes de finalizar." },
] as const;

export default function ContractedMovementsPage() {
  const { analytics, filters } = useCommercialData();
  const { items: clients, error: clientError } = useCrmList<CrmClient>("/bff/comercial/clientes?pageSize=100");
  const { items: contracts } = useCrmList<Contract>("/bff/comercial/contratos?pageSize=100");
  const { items: controls, loading, error, reload } = useCrmList<Package>("/bff/comercial/paquetes?pageSize=100");
  const [editing, setEditing] = useState<Package | "NEW" | null>(null);
  const visible = useMemo(() => controls.filter((item) =>
    (!filters.empresaId || item.cliente?.empresaId === filters.empresaId)
    && (!filters.localidadId || !item.localidadId || item.localidadId === filters.localidadId)
    && (!filters.origin || !item.origenOperacion || item.origenOperacion === filters.origin),
  ), [controls, filters.empresaId, filters.localidadId, filters.origin]);
  const totals = visible.map((item) => usageFor(item, analytics));

  return <div className="space-y-5">
    <ModuleHeader eyebrow="Control contractual" title="Movimientos incluidos por contrato" description="Indique cuántos movimientos o servicios incluye cada contrato, dónde aplican y cada cuándo vuelve a comenzar el límite." icon={Target} actions={<button type="button" className="commercial-primary" onClick={() => setEditing("NEW")} disabled={!clients.length}><Plus className="h-4 w-4"/>Agregar movimientos contratados</button>}/>
    <CommercialPeriodBar showOrigin/>
    {clientError || error ? <Notice title="No se pudo consultar el control contractual" text="Verifique que el servicio Comercial esté activo y vuelva a intentarlo."/> : null}
    {loading ? <LoadingPanel text="Comparando lo contratado contra los movimientos reales…"/> : <>
      <section className="grid gap-3 sm:grid-cols-3"><MiniSummary icon={Target} label="Configuraciones visibles" value={visible.length}/><MiniSummary icon={Gauge} label="Cerca del límite" value={totals.filter((item) => item.percent >= 80 && item.percent < 100).length}/><MiniSummary icon={MapPin} label="Con excedente" value={totals.filter((item) => item.excess > 0).length}/></section>
      <section className="grid gap-4 lg:grid-cols-2">{visible.map((item) => <ContractControlCard key={item.id} item={item} analytics={analytics} onEdit={() => setEditing(item)}/>)}{!visible.length ? <div className="lg:col-span-2"><EmptyPanel title="No hay movimientos contratados para este alcance" text="Agregue el acuerdo de un contrato indicando el periodo, la cantidad incluida y qué estados deben contar."/></div> : null}</section>
    </>}
    {editing && analytics ? <ContractControlModal key={editing === "NEW" ? "new" : editing.id} item={editing === "NEW" ? undefined : editing} clients={clients} contracts={contracts} localities={analytics.catalogs.localities} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }}/> : null}
  </div>;
}

function usageFor(item: Package, analytics: AnalyticsSummary | null) {
  if (!analytics) return { used: 0, limit: item.cantidadIncluida == null ? null : Number(item.cantidadIncluida), percent: 0, excess: 0 };
  const statuses = item.estadosIncluidos?.length ? item.estadosIncluidos : ["CONCLUIDO"];
  const rows = analytics.contractBreakdown.filter((row) => row.empresaId === item.cliente?.empresaId && (!item.localidadId || row.localidadId === item.localidadId) && (!item.origenOperacion || row.origin === item.origenOperacion) && row.service === item.servicio && statuses.includes(row.status));
  const used = item.unidad === "VAGON" ? rows.reduce((sum, row) => sum + row.wagons, 0) : rows.reduce((sum, row) => sum + row.count, 0);
  const from = new Date(analytics.meta.range.from);
  const to = new Date(analytics.meta.range.toExclusive);
  const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000));
  const months = Math.max(1, (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + to.getUTCMonth() - from.getUTCMonth());
  const multiplier = item.periodicidad === "SEMANAL" ? Math.ceil(days / 7) : item.periodicidad === "MENSUAL" ? months : item.periodicidad === "BIMESTRAL" ? Math.max(1, Math.ceil(months / 2)) : item.periodicidad === "SEMESTRAL" ? Math.max(1, Math.ceil(months / 6)) : item.periodicidad === "ANUAL" ? Math.max(1, Math.ceil(months / 12)) : 1;
  const limit = item.cantidadIncluida == null ? null : Number(item.cantidadIncluida) * multiplier;
  const percent = limit ? Math.round(used / limit * 1000) / 10 : 0;
  return { used, limit, percent, excess: limit == null ? 0 : Math.max(0, used - limit) };
}

function ContractControlCard({ item, analytics, onEdit }: { item: Package; analytics: AnalyticsSummary | null; onEdit: () => void }) {
  const usage = usageFor(item, analytics);
  const color = usage.percent >= 100 ? "bg-rose-500" : usage.percent >= 80 ? "bg-amber-500" : "bg-emerald-600";
  const locality = item.localidadId ? analytics?.catalogs.localities.find((value) => value.id === item.localidadId)?.nombre : "Todos los patios";
  const quantity = item.cantidadIncluida == null ? "Sin límite capturado" : `${formatNumber(item.cantidadIncluida)} ${unitPlural(item.unidad)}`;
  const contract = item.contrato ? `${item.contrato.folio} · ${item.contrato.nombre}` : "Sin contrato vinculado";
  return <article className="commercial-card overflow-hidden">
    <header className="flex items-start justify-between gap-4 border-b border-[var(--app-border)] p-5"><div><p className="commercial-label">{item.cliente?.empresaNombre || "Cliente"}</p><h2 className="mt-1 text-lg font-black text-[var(--app-text)]">{item.nombre}</h2><p className="mt-1 text-xs font-bold text-[var(--app-text-muted)]">{contract}</p></div><button type="button" onClick={onEdit} className="commercial-secondary min-h-9 px-3 text-xs"><Pencil className="h-4 w-4"/>Editar</button></header>
    <div className="p-5">
      <div className="rounded-2xl bg-[var(--app-surface-muted)] p-4"><p className="text-base font-black text-[var(--app-text)]">{quantity} {periodSentence(item.periodicidad)}</p><p className="mt-1 text-xs font-bold text-[var(--app-text-muted)]">{serviceLabel(item.servicio)} · {humanize(item.origenOperacion || "NATURAL Y ARRASTRE")} · {locality}</p><p className="mt-2 text-xs text-[var(--app-text-muted)]">Cuenta: {(item.estadosIncluidos?.length ? item.estadosIncluidos : ["CONCLUIDO"]).map(humanize).join(", ")}.</p></div>
      <div className="mt-5 flex items-end justify-between gap-4"><div><p className="text-3xl font-black text-[var(--app-text)]">{formatNumber(usage.used)} <span className="text-sm text-[var(--app-text-muted)]">consumidos</span></p><p className="mt-1 text-xs font-bold text-[var(--app-text-muted)]">Vigencia: {formatDate(item.vigenciaInicio)} – {formatDate(item.vigenciaFin)}</p></div><div className="text-right"><p className="text-lg font-black text-[var(--app-text)]">{formatNumber(usage.excess)}</p><p className="text-xs text-[var(--app-text-muted)]">excedente</p></div></div>
      {usage.limit != null ? <><div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"><div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, usage.percent)}%` }}/></div><p className={`mt-2 text-xs font-black ${usage.percent >= 100 ? "text-rose-600" : usage.percent >= 80 ? "text-amber-600" : "text-emerald-700"}`}>{usage.percent}% utilizado · {usage.percent >= 100 ? "El límite fue alcanzado" : usage.percent >= 80 ? "Está cerca del límite" : "Está dentro de lo contratado"}</p></> : <p className="mt-4 rounded-xl bg-blue-50 p-3 text-xs font-bold text-blue-800">Este control registra consumo, pero todavía no tiene una cantidad límite.</p>}
    </div>
  </article>;
}

function ContractControlModal({ item, clients, contracts, localities, onClose, onSaved }: { item?: Package; clients: CrmClient[]; contracts: Contract[]; localities: Array<{ id: number; nombre: string }>; onClose: () => void; onSaved: () => void }) {
  const editing = Boolean(item);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [clientId, setClientId] = useState<number | undefined>(item?.clienteComercialId);
  const [service, setService] = useState(item?.servicio || "MOVIMIENTO");
  const [unit, setUnit] = useState(item?.unidad === "VAGON" ? "VAGON" : item?.servicio === "MOVIMIENTO" ? "MOVIMIENTO" : "SERVICIO");
  const [periodicity, setPeriodicity] = useState(item?.periodicidad || "MENSUAL");
  const [localityId, setLocalityId] = useState<number | undefined>(item?.localidadId || undefined);
  const [origin, setOrigin] = useState(item?.origenOperacion || "NATURAL");
  const selectedLocality = localityId ? localities.find((locality) => locality.id === localityId)?.nombre : undefined;
  const arrastreAllowed = !localityId || isTorreon(selectedLocality);
  const arrastreSelectable = arrastreAllowed && service === "MOVIMIENTO";
  const periodName = periodNoun(periodicity);

  function changeService(value: string) {
    setService(value as Package["servicio"]);
    if (value === "LAVADO" || value === "TORNEADO") {
      setUnit("SERVICIO");
      setOrigin("NATURAL");
    }
    else if (unit === "SERVICIO") setUnit("MOVIMIENTO");
  }

  function changeLocality(value: string) {
    const next = value ? Number(value) : undefined;
    const name = next ? localities.find((locality) => locality.id === next)?.nombre : undefined;
    setLocalityId(next);
    if (next && !isTorreon(name)) {
      setOrigin("NATURAL");
      if (unit === "VAGON") setUnit("MOVIMIENTO");
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const optionalNumber = (name: string) => data.get(name) ? Number(data.get(name)) : null;
    const statuses = data.getAll("estadosIncluidos").map(String);
    const payload = {
      ...(editing ? {} : { clienteComercialId: clientId }),
      contratoId: optionalNumber("contratoId"),
      nombre: data.get("nombre"),
      servicio: service,
      origenOperacion: origin || null,
      unidad: unit,
      periodicidad: periodicity,
      localidadId: localityId || null,
      estadosIncluidos: statuses.length ? statuses : ["CONCLUIDO"],
      cantidadIncluida: optionalNumber("cantidadIncluida"),
      vigenciaInicio: data.get("vigenciaInicio"),
      vigenciaFin: data.get("vigenciaFin") || null,
      activo: data.has("activo"),
      notas: data.get("notas") || null,
    };
    try {
      await commercialApi(editing ? `/bff/comercial/paquetes/${item?.id}` : "/bff/comercial/paquetes", { method: editing ? "PATCH" : "POST", body: JSON.stringify(payload) });
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar la configuración contractual");
    } finally {
      setSaving(false);
    }
  }

  return <Modal title={editing ? "Editar movimientos contratados" : "Agregar movimientos contratados"} description="Complete las preguntas en orden. Los campos explican exactamente cómo se calculará el consumo." onClose={onClose}>
    <form onSubmit={submit} className="space-y-5 p-5">
      <FormSection number="1" title="¿Para quién aplica?" help="Vincule esta configuración con el cliente y, de preferencia, con su contrato.">
        <Field label="Cliente"><select required disabled={editing} value={clientId ?? ""} onChange={(event) => setClientId(event.target.value ? Number(event.target.value) : undefined)} className="commercial-select"><option value="">Seleccione un cliente…</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.empresaNombre}</option>)}</select></Field>
        <Field label="Contrato"><select name="contratoId" defaultValue={item?.contratoId || ""} className="commercial-select"><option value="">Sin contrato vinculado</option>{contracts.filter((contract) => !clientId || contract.clienteComercialId === clientId).map((contract) => <option key={contract.id} value={contract.id}>{contract.folio} · {contract.nombre}</option>)}</select></Field>
        <Field label="Nombre para reconocer esta configuración"><input name="nombre" required defaultValue={item?.nombre || ""} className="commercial-input" placeholder="Ej. 120 movimientos mensuales Guadalajara"/></Field>
      </FormSection>

      <FormSection number="2" title="¿Qué trabajo y dónde?" help="Arrastre y Vagones solo están disponibles cuando el patio es Torreón o se incluyen todos los patios.">
        <div className="grid gap-3 sm:grid-cols-2"><Field label="Trabajo contratado"><select value={service} onChange={(event) => changeService(event.target.value)} className="commercial-select"><option value="MOVIMIENTO">Movimiento de locomotora</option><option value="LAVADO">Servicio de lavado</option><option value="TORNEADO">Servicio de torneado</option></select></Field><Field label="Patio donde aplica"><select value={localityId ?? ""} onChange={(event) => changeLocality(event.target.value)} className="commercial-select"><option value="">Todos los patios</option>{localities.map((locality) => <option key={locality.id} value={locality.id}>{locality.nombre}</option>)}</select></Field></div>
        <div className="grid gap-3 sm:grid-cols-2"><Field label="Tipo de operación"><select value={origin} onChange={(event) => setOrigin(event.target.value as "NATURAL" | "ARRASTRE")} className="commercial-select" disabled={service !== "MOVIMIENTO"}><option value="NATURAL">Naturales</option>{arrastreSelectable ? <option value="ARRASTRE">Arrastre · solo Torreón</option> : null}</select></Field><Field label="¿Qué se contará?"><select value={unit} onChange={(event) => setUnit(event.target.value)} className="commercial-select" disabled={service !== "MOVIMIENTO"}><option value={service === "MOVIMIENTO" ? "MOVIMIENTO" : "SERVICIO"}>{service === "MOVIMIENTO" ? "Cada movimiento" : "Cada servicio realizado"}</option>{arrastreSelectable && origin === "ARRASTRE" ? <option value="VAGON">Cada vagón movilizado</option> : null}</select></Field></div>
      </FormSection>

      <FormSection number="3" title="¿Cuál es el límite contratado?" help="La duración del contrato y el reinicio del límite son independientes: un contrato anual puede incluir movimientos cada mes.">
        <div className="grid gap-3 sm:grid-cols-2"><Field label="¿Cada cuándo vuelve a empezar?"><select value={periodicity} onChange={(event) => setPeriodicity(event.target.value as Package["periodicidad"])} className="commercial-select"><option value="SEMANAL">Cada semana</option><option value="MENSUAL">Cada mes</option><option value="BIMESTRAL">Cada bimestre</option><option value="SEMESTRAL">Cada semestre</option><option value="ANUAL">Cada año</option><option value="VIGENCIA_COMPLETA">Una sola vez en toda la vigencia</option></select></Field><Field label={`¿Cuántos incluye cada ${periodName}?`}><input name="cantidadIncluida" type="number" min="1" step="1" defaultValue={item?.cantidadIncluida || ""} className="commercial-input" placeholder="Ej. 120"/></Field></div>
        <Notice title="Así se interpretará" text={`El sistema comparará los ${unit === "VAGON" ? "vagones" : service === "MOVIMIENTO" ? "movimientos" : "servicios"} reales contra la cantidad incluida ${periodSentence(periodicity)}. Puede dejar la cantidad vacía para registrar consumo sin límite.`}/>
      </FormSection>

      <FormSection number="4" title="¿Qué movimientos deben sumar al consumo?" help="Lo normal es contar solo los concluidos. Marque otros estados únicamente si el contrato lo establece.">
        <div className="grid gap-2 sm:grid-cols-2">{STATUS_OPTIONS.map((status) => <label key={status.value} className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] p-3"><input type="checkbox" name="estadosIncluidos" value={status.value} defaultChecked={(item?.estadosIncluidos || ["CONCLUIDO"]).includes(status.value)} className="mt-1 h-4 w-4"/><span><span className="block text-sm font-black text-[var(--app-text)]">{status.label}</span><span className="mt-0.5 block text-xs text-[var(--app-text-muted)]">{status.help}</span></span></label>)}</div>
      </FormSection>

      <FormSection number="5" title="¿Durante qué fechas estará vigente?" help="Estas fechas normalmente coinciden con la vigencia del contrato.">
        <div className="grid gap-3 sm:grid-cols-2"><Field label="Fecha de inicio"><input name="vigenciaInicio" type="date" required defaultValue={dateInput(item?.vigenciaInicio)} className="commercial-input"/></Field><Field label="Fecha final"><input name="vigenciaFin" type="date" defaultValue={dateInput(item?.vigenciaFin)} className="commercial-input"/></Field></div>
        <Field label="Notas opcionales"><textarea name="notas" rows={3} defaultValue={item?.notas || ""} className="commercial-input" placeholder="Aclaraciones específicas del acuerdo…"/></Field>
        <label className="flex items-center gap-3 rounded-xl bg-[var(--app-surface-muted)] p-3"><input name="activo" type="checkbox" defaultChecked={item?.activo ?? true} className="h-4 w-4"/><span className="text-sm font-black text-[var(--app-text)]">Usar esta configuración en los cálculos</span></label>
      </FormSection>

      {error ? <Notice tone="rose" title="No se pudo guardar" text={error}/> : null}
      <div className="sticky bottom-0 flex justify-end gap-2 border-t border-[var(--app-border)] bg-[var(--app-surface)] py-4"><button type="button" className="commercial-secondary" onClick={onClose}>Cancelar</button><button className="commercial-primary" disabled={saving}>{saving ? "Guardando…" : editing ? "Guardar cambios" : "Agregar al contrato"}</button></div>
    </form>
  </Modal>;
}

function FormSection({ number, title, help, children }: { number: string; title: string; help: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-[var(--app-border)] p-4"><header className="mb-4 flex items-start gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-100 text-sm font-black text-emerald-800">{number}</span><div><h3 className="font-black text-[var(--app-text)]">{title}</h3><p className="mt-1 text-xs leading-5 text-[var(--app-text-muted)]">{help}</p></div></header><div className="space-y-3">{children}</div></section>;
}

function MiniSummary({ icon: Icon, label, value }: { icon: typeof Target; label: string; value: number }) {
  return <article className="commercial-card flex items-center gap-3 p-4"><span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-100 text-emerald-700"><Icon className="h-5 w-5"/></span><div><p className="text-2xl font-black text-[var(--app-text)]">{value}</p><p className="text-xs font-bold text-[var(--app-text-muted)]">{label}</p></div></article>;
}

function periodSentence(value: Package["periodicidad"] | string) {
  return value === "SEMANAL" ? "por semana" : value === "MENSUAL" ? "por mes" : value === "BIMESTRAL" ? "por bimestre" : value === "SEMESTRAL" ? "por semestre" : value === "ANUAL" ? "por año" : "durante toda la vigencia";
}

function periodNoun(value: Package["periodicidad"] | string) {
  return value === "SEMANAL" ? "semana" : value === "MENSUAL" ? "mes" : value === "BIMESTRAL" ? "bimestre" : value === "SEMESTRAL" ? "semestre" : value === "ANUAL" ? "año" : "vigencia";
}

function unitPlural(value: Package["unidad"]) {
  return value === "VAGON" ? "vagones" : value === "SERVICIO" ? "servicios" : "movimientos";
}

function serviceLabel(value: Package["servicio"]) {
  return value === "LAVADO" ? "Lavado" : value === "TORNEADO" ? "Torneado" : "Movimiento";
}

function dateInput(value?: string | null) {
  return value ? value.slice(0, 10) : "";
}

function isTorreon(value?: string) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes("torreon");
}
