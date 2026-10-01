"use client";
import { useState, type FormEvent } from "react";
import type { Contract, CrmClient } from "../../types";
import { commercialApi } from "../../lib/api";
import { humanize } from "../../lib/format";
import { Field, Modal, Notice } from "../CommercialUi";
import { DEFAULT_BILLABLE_STATUSES, BILLABLE_STATUS_OPTIONS, primaryRule, dateInput, workTypeFromRule, serviceForWorkType, originForWorkType, normalizeRuleUnit, torreonLocalityId, excessUnitLabel, isTorreon, type Locality, type ContractWorkType, type RuleUnit, type RulePeriodicity } from "./contractRules";

export function CreateContractModal({ clients, localities, defaultClientId, onClose, onCreated }: { clients: CrmClient[]; localities: Locality[]; defaultClientId?: number; onClose: () => void; onCreated: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [workType, setWorkType] = useState<ContractWorkType>("NATURAL");
  const [unit, setUnit] = useState<RuleUnit>("MOVIMIENTO");
  const [periodicity, setPeriodicity] = useState<RulePeriodicity>("MENSUAL");
  const [localityId, setLocalityId] = useState<number | undefined>();
  const periodicityLabel = humanize(periodicity).toLowerCase();
  const torreonId = torreonLocalityId(localities);
  const localityOptions = workType === "ARRASTRE" ? localities.filter((locality) => isTorreon(locality.nombre)) : localities;

  function changeWorkType(value: ContractWorkType) {
    setWorkType(value);
    if (value === "LAVADO" || value === "TORNEADO") {
      setUnit("SERVICIO");
    } else if (value === "ARRASTRE") {
      if (unit === "SERVICIO") setUnit("MOVIMIENTO");
      if (torreonId) setLocalityId(torreonId);
    } else {
      setUnit("MOVIMIENTO");
    }
  }

  function changeLocality(value: string) {
    const next = value ? Number(value) : undefined;
    const name = next ? localities.find((locality) => locality.id === next)?.nombre : undefined;
    if (workType === "ARRASTRE" && next && !isTorreon(name)) return;
    setLocalityId(next);
    if (next && !isTorreon(name) && unit === "VAGON") setUnit("MOVIMIENTO");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const optionalNumber = (name: string) => data.get(name) ? Number(data.get(name)) : null;
    const contractName = String(data.get("nombre") || "Contrato");
    const statuses = data.getAll("estadosIncluidos").map(String);
    const selectedStatuses = statuses.length ? statuses : DEFAULT_BILLABLE_STATUSES;
    const service = serviceForWorkType(workType);
    const origin = originForWorkType(workType);
    const effectiveLocalityId = workType === "ARRASTRE" ? torreonId : localityId;
    if (workType === "ARRASTRE" && !effectiveLocalityId) {
      setSaving(false);
      setError("Arrastre solo puede configurarse en Torreon.");
      return;
    }
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
          diaCorte: optionalNumber("diaCorte") ?? 31,
          montoMaximo: optionalNumber("montoMaximo"),
          reglaInicial: {
            nombre: `${contractName} · control ${periodicityLabel}`,
            servicio: service,
            origenOperacion: origin,
            unidad: unit,
            periodicidad: periodicity,
            localidadId: effectiveLocalityId || null,
            cantidadIncluida: unit === "TARIFA_FIJA" ? null : optionalNumber("cantidadIncluida"),
            importeExcedente: unit === "TARIFA_FIJA" ? null : optionalNumber("importeExcedente"),
            estadosIncluidos: selectedStatuses,
            notas: `Regla creada automaticamente desde contrato. Cuenta: ${selectedStatuses.map(humanize).join(", ")}.`,
          },
        }),
      });
      onCreated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo crear el contrato");
    } finally {
      setSaving(false);
    }
  }

  return <Modal title="Nuevo contrato" description="Capture el acuerdo una vez; el sistema genera la regla de consumo y el corte del periodo." onClose={onClose}>
    <form onSubmit={submit} className="space-y-4 p-5">
      <Field label="Cliente"><select name="clienteComercialId" required defaultValue={defaultClientId || ""} className="commercial-select"><option value="">Seleccione…</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.empresaNombre}</option>)}</select></Field>
      <Field label="Nombre del contrato"><input name="nombre" required className="commercial-input"/></Field>
      <div className="grid gap-3 sm:grid-cols-2"><Field label="Folio"><input name="folio" required className="commercial-input"/></Field><Field label="Estado"><select name="estado" defaultValue="VIGENTE" className="commercial-select"><option value="BORRADOR">Borrador</option><option value="VIGENTE">Vigente</option></select></Field></div>

      <section className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] p-4">
        <p className="commercial-label">1. Vigencia y corte</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2"><Field label="Inicio"><input name="fechaInicio" type="date" required className="commercial-input"/></Field><Field label="Fin"><input name="fechaFin" type="date" className="commercial-input"/></Field></div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3"><Field label="Día de corte"><input name="diaCorte" type="number" min="1" max="31" defaultValue={31} className="commercial-input"/></Field><Field label="Monto base del contrato por periodo"><input name="montoMaximo" type="number" min=".01" step=".01" className="commercial-input"/></Field><Field label="Orden de compra"><input name="ordenCompra" className="commercial-input"/></Field></div>
      </section>

      <section className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900 dark:bg-emerald-950/20">
        <p className="commercial-label">2. Regla comercial automática</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2"><Field label="Tipo de trabajo"><select value={workType} onChange={(event) => changeWorkType(event.target.value as ContractWorkType)} className="commercial-select"><option value="NATURAL">Movimiento natural</option><option value="ARRASTRE">Arrastre Torreón</option><option value="LAVADO">Servicio de lavado</option><option value="TORNEADO">Servicio de torneado</option></select></Field><Field label="Cada cuánto se revisa"><select value={periodicity} onChange={(event) => setPeriodicity(event.target.value as RulePeriodicity)} className="commercial-select"><option value="MENSUAL">Cada mes</option><option value="SEMANAL">Cada semana</option><option value="BIMESTRAL">Cada bimestre</option><option value="SEMESTRAL">Cada semestre</option><option value="ANUAL">Cada año</option><option value="VIGENCIA_COMPLETA">Toda la vigencia</option></select></Field></div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2"><Field label={workType === "ARRASTRE" ? "Patio de arrastre" : "Patio donde aplica"}><select value={localityId ?? ""} onChange={(event) => changeLocality(event.target.value)} className="commercial-select" required={workType === "ARRASTRE"}>{workType === "ARRASTRE" ? null : <option value="">Todos los patios</option>}{localityOptions.map((locality) => <option key={locality.id} value={locality.id}>{locality.nombre}</option>)}</select></Field><Field label="Qué se cuenta"><select value={unit} onChange={(event) => setUnit(event.target.value as RuleUnit)} className="commercial-select"><option value={workType === "LAVADO" || workType === "TORNEADO" ? "SERVICIO" : "MOVIMIENTO"}>{workType === "ARRASTRE" ? "Cada arrastre" : workType === "NATURAL" ? "Cada movimiento natural" : "Cada servicio"}</option>{workType === "ARRASTRE" ? <option value="VAGON">Cada vagón</option> : null}<option value="TARIFA_FIJA">Cuota fija del periodo</option></select></Field></div>
        {workType === "ARRASTRE" ? <Notice title="Arrastre separado" text="Arrastre se controla como trabajo independiente y solo aplica en Torreón; no se mezcla con movimientos naturales."/> : unit === "TARIFA_FIJA" ? <Notice title="Cuota fija" text="El contrato generará cortes del periodo sin pedir cantidad de movimientos."/> : null}
        {unit !== "TARIFA_FIJA" ? <div className="grid gap-3 sm:grid-cols-2"><Field label={`Cantidad incluida por ${periodicityLabel}`}><input name="cantidadIncluida" type="number" min="1" step="1" required className="commercial-input"/></Field><Field label={`Precio por ${excessUnitLabel(unit)} excedente`}><input name="importeExcedente" type="number" min="0" step=".01" className="commercial-input" placeholder="Puede quedar pendiente"/></Field></div> : null}
        <div className="mt-4"><p className="commercial-label">Estados cobrables</p><div className="mt-2 grid gap-2 sm:grid-cols-2">{BILLABLE_STATUS_OPTIONS.map((status) => <label key={status.value} className="flex cursor-pointer items-center gap-3 rounded-xl border border-emerald-200 bg-white/70 p-3 text-sm font-black text-[var(--app-text)]"><input type="checkbox" name="estadosIncluidos" value={status.value} defaultChecked={DEFAULT_BILLABLE_STATUSES.includes(status.value)} className="h-4 w-4"/>{status.label}</label>)}</div></div>
      </section>

      {error ? <Notice tone="rose" title="No se pudo guardar" text={error}/> : null}
      <div className="sticky bottom-0 flex justify-end gap-2 border-t border-[var(--app-border)] bg-[var(--app-surface)] py-4"><button type="button" onClick={onClose} className="commercial-secondary">Cancelar</button><button disabled={saving} className="commercial-primary">{saving ? "Guardando…" : "Guardar contrato"}</button></div>
    </form>
  </Modal>;
}

export function EditContractModal({ contract, localities, onClose, onUpdated }: { contract: Contract; localities: Locality[]; onClose: () => void; onUpdated: () => void }) {
  const rule = primaryRule(contract);
  const initialWorkType = workTypeFromRule(rule);
  const initialTorreonId = torreonLocalityId(localities);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [workType, setWorkType] = useState<ContractWorkType>(initialWorkType);
  const [unit, setUnit] = useState<RuleUnit>(normalizeRuleUnit(rule?.unidad, initialWorkType));
  const [periodicity, setPeriodicity] = useState<RulePeriodicity>(rule?.periodicidad || "MENSUAL");
  const [localityId, setLocalityId] = useState<number | undefined>(rule?.localidadId || (initialWorkType === "ARRASTRE" ? initialTorreonId : undefined));
  const periodicityLabel = humanize(periodicity).toLowerCase();
  const torreonId = initialTorreonId;
  const localityOptions = workType === "ARRASTRE" ? localities.filter((locality) => isTorreon(locality.nombre)) : localities;

  function changeWorkType(value: ContractWorkType) {
    setWorkType(value);
    if (value === "LAVADO" || value === "TORNEADO") {
      setUnit("SERVICIO");
    } else if (value === "ARRASTRE") {
      if (unit === "SERVICIO") setUnit("MOVIMIENTO");
      if (torreonId) setLocalityId(torreonId);
    } else {
      setUnit("MOVIMIENTO");
    }
  }

  function changeLocality(value: string) {
    const next = value ? Number(value) : undefined;
    const name = next ? localities.find((locality) => locality.id === next)?.nombre : undefined;
    if (workType === "ARRASTRE" && next && !isTorreon(name)) return;
    setLocalityId(next);
    if (next && !isTorreon(name) && unit === "VAGON") setUnit("MOVIMIENTO");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const optionalNumber = (name: string) => data.get(name) ? Number(data.get(name)) : null;
    const contractName = String(data.get("nombre") || contract.nombre);
    const fechaInicio = String(data.get("fechaInicio") || dateInput(contract.fechaInicio));
    const fechaFin = String(data.get("fechaFin") || "");
    const statuses = data.getAll("estadosIncluidos").map(String);
    const selectedStatuses = statuses.length ? statuses : DEFAULT_BILLABLE_STATUSES;
    const service = serviceForWorkType(workType);
    const origin = originForWorkType(workType);
    const effectiveLocalityId = workType === "ARRASTRE" ? torreonId : localityId;
    if (workType === "ARRASTRE" && !effectiveLocalityId) {
      setSaving(false);
      setError("Arrastre solo puede configurarse en Torreon.");
      return;
    }
    try {
      await commercialApi(`/bff/comercial/contratos/${contract.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          nombre: contractName,
          estado: data.get("estado"),
          fechaInicio,
          fechaFin: fechaFin || null,
          ordenCompra: data.get("ordenCompra") || null,
          diaCorte: optionalNumber("diaCorte") ?? 31,
          montoMaximo: optionalNumber("montoMaximo"),
          notas: data.get("notas") || null,
        }),
      });
      if (rule) {
        await commercialApi(`/bff/comercial/paquetes/${rule.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            contratoId: contract.id,
            nombre: rule.nombre || `${contractName} · control ${periodicityLabel}`,
            servicio: service,
            origenOperacion: origin,
            unidad: unit,
            periodicidad: periodicity,
            localidadId: effectiveLocalityId || null,
            estadosIncluidos: selectedStatuses,
            cantidadIncluida: unit === "TARIFA_FIJA" ? null : optionalNumber("cantidadIncluida"),
            importeExcedente: unit === "TARIFA_FIJA" ? null : optionalNumber("importeExcedente"),
            vigenciaInicio: fechaInicio,
            vigenciaFin: fechaFin || null,
            activo: true,
            notas: `Regla actualizada desde contrato. Cuenta: ${selectedStatuses.map(humanize).join(", ")}.`,
          }),
        });
      }
      onUpdated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo editar el contrato");
    } finally {
      setSaving(false);
    }
  }

  return <Modal title="Editar contrato" description={`${contract.cliente?.empresaNombre || "Cliente"} · ${contract.folio}. Si la vigencia ya terminó, el sistema bloquea la edición.`} onClose={onClose}>
    <form onSubmit={submit} className="space-y-4 p-5">
      <section className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] p-4">
        <p className="commercial-label">Contrato</p>
        <Field label="Nombre del contrato"><input name="nombre" required defaultValue={contract.nombre} className="commercial-input"/></Field>
        <div className="mt-3 grid gap-3 sm:grid-cols-2"><Field label="Estado"><select name="estado" defaultValue={contract.estado} className="commercial-select"><option value="BORRADOR">Borrador</option><option value="VIGENTE">Vigente</option><option value="VENCIDO">Vencido</option><option value="CANCELADO">Cancelado</option></select></Field><Field label="Orden de compra"><input name="ordenCompra" defaultValue={contract.ordenCompra || ""} className="commercial-input"/></Field></div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2"><Field label="Inicio"><input name="fechaInicio" type="date" required defaultValue={dateInput(contract.fechaInicio)} className="commercial-input"/></Field><Field label="Fin"><input name="fechaFin" type="date" defaultValue={dateInput(contract.fechaFin)} className="commercial-input"/></Field></div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2"><Field label="Día de corte"><input name="diaCorte" type="number" min="1" max="31" defaultValue={contract.diaCorte || 31} className="commercial-input"/></Field><Field label="Monto base del contrato por periodo"><input name="montoMaximo" type="number" min=".01" step=".01" defaultValue={contract.montoMaximo || ""} className="commercial-input"/></Field></div>
        <Field label="Notas"><textarea name="notas" rows={3} defaultValue={contract.notas || ""} className="commercial-input"/></Field>
      </section>

      {rule ? <section className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900 dark:bg-emerald-950/20">
        <p className="commercial-label">Regla comercial automática</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2"><Field label="Tipo de trabajo"><select value={workType} onChange={(event) => changeWorkType(event.target.value as ContractWorkType)} className="commercial-select"><option value="NATURAL">Movimiento natural</option><option value="ARRASTRE">Arrastre Torreón</option><option value="LAVADO">Servicio de lavado</option><option value="TORNEADO">Servicio de torneado</option></select></Field><Field label="Cada cuánto se revisa"><select value={periodicity} onChange={(event) => setPeriodicity(event.target.value as RulePeriodicity)} className="commercial-select"><option value="MENSUAL">Cada mes</option><option value="SEMANAL">Cada semana</option><option value="BIMESTRAL">Cada bimestre</option><option value="SEMESTRAL">Cada semestre</option><option value="ANUAL">Cada año</option><option value="VIGENCIA_COMPLETA">Toda la vigencia</option></select></Field></div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2"><Field label={workType === "ARRASTRE" ? "Patio de arrastre" : "Patio donde aplica"}><select value={localityId ?? ""} onChange={(event) => changeLocality(event.target.value)} className="commercial-select" required={workType === "ARRASTRE"}>{workType === "ARRASTRE" ? null : <option value="">Todos los patios</option>}{localityOptions.map((locality) => <option key={locality.id} value={locality.id}>{locality.nombre}</option>)}</select></Field><Field label="Qué se cuenta"><select value={unit} onChange={(event) => setUnit(event.target.value as RuleUnit)} className="commercial-select"><option value={workType === "LAVADO" || workType === "TORNEADO" ? "SERVICIO" : "MOVIMIENTO"}>{workType === "ARRASTRE" ? "Cada arrastre" : workType === "NATURAL" ? "Cada movimiento natural" : "Cada servicio"}</option>{workType === "ARRASTRE" ? <option value="VAGON">Cada vagón</option> : null}<option value="TARIFA_FIJA">Cuota fija del periodo</option></select></Field></div>
        {workType === "ARRASTRE" ? <Notice title="Arrastre separado" text="Arrastre se controla como trabajo independiente y solo aplica en Torreón; no se mezcla con movimientos naturales."/> : unit === "TARIFA_FIJA" ? <Notice title="Cuota fija" text="El contrato conserva cortes del periodo sin cantidad de movimientos."/> : null}
        {unit !== "TARIFA_FIJA" ? <div className="grid gap-3 sm:grid-cols-2"><Field label={`Cantidad incluida por ${periodicityLabel}`}><input name="cantidadIncluida" type="number" min="1" step="1" required defaultValue={rule.cantidadIncluida || ""} className="commercial-input"/></Field><Field label={`Precio por ${excessUnitLabel(unit)} excedente`}><input name="importeExcedente" type="number" min="0" step=".01" defaultValue={rule.importeExcedente || rule.tarifaExcedente?.importeUnitario || ""} className="commercial-input" placeholder="Puede quedar pendiente"/></Field></div> : null}
        <div className="mt-4"><p className="commercial-label">Estados cobrables</p><div className="mt-2 grid gap-2 sm:grid-cols-2">{BILLABLE_STATUS_OPTIONS.map((status) => <label key={status.value} className="flex cursor-pointer items-center gap-3 rounded-xl border border-emerald-200 bg-white/70 p-3 text-sm font-black text-[var(--app-text)]"><input type="checkbox" name="estadosIncluidos" value={status.value} defaultChecked={(rule.estadosIncluidos?.length ? rule.estadosIncluidos : DEFAULT_BILLABLE_STATUSES).includes(status.value)} className="h-4 w-4"/>{status.label}</label>)}</div></div>
      </section> : <Notice tone="amber" title="Sin regla automática" text="Este contrato no tiene regla ligada; puede editar los datos generales, pero no hay control de consumo que modificar."/>}

      {error ? <Notice tone="rose" title="No se pudo guardar" text={error}/> : null}
      <div className="sticky bottom-0 flex justify-end gap-2 border-t border-[var(--app-border)] bg-[var(--app-surface)] py-4"><button type="button" onClick={onClose} className="commercial-secondary">Cancelar</button><button disabled={saving} className="commercial-primary">{saving ? "Guardando…" : "Guardar cambios"}</button></div>
    </form>
  </Modal>;
}

