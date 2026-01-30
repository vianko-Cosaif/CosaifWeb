/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Movimiento } from './../../movimientos/Movimiento'; // <--- Único import
import { API_BASE, SECC_BASE, DOUBLE_TAP_MS, Direccion, Posicion, Servicio, Rol, Polo, Via, Seccion,InfoEdicion, EditablePayload, MovementFormData, baseInitialForm
 } from './../../movimientos/movimientos.shared'; // <--- Único import
/** ======= UTILS ======= */


/** ======= ESTILOS ======= */
const inputBase =
  "w-full rounded-md border px-3 py-3 min-h-[48px] text-base sm:text-sm outline-none transition-colors " +
  "bg-white text-slate-900 placeholder-slate-400 border-slate-300 focus:border-sky-500 " +
  "dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-500 dark:border-slate-700 dark:focus:border-sky-500";
const chipBase = "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium";

/** ======= COMPONENTE PRINCIPAL ======= */
export default function EditarMovimiento({
  movimientoId,
  onClose,
  onSaved,
}: {
  movimientoId: number | string;
  onClose?: () => void;
  onSaved?: (updated: any) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState<"de_via" | "para_via">("de_via");
const [serviceVia, setServiceVia] = useState<Servicio | undefined>("");
  const [info, setInfo] = useState<InfoEdicion | null>(null);
  const [vias, setVias] = useState<Via[]>([]);
  const [sectionsByVia, setSectionsByVia] = useState<Record<number, Seccion[]>>({});
  const [secLoading, setSecLoading] = useState<Record<number, boolean>>({});

  // Form local (solo editables)
  const [instrucciones, setInstrucciones] = useState<string>("");
  const [locomotiveNumber, setLocomotiveNumber] = useState<string>("");
  const [viaOrigenId, setViaOrigenId] = useState<number | null>(null);
  const [viaDestinoId, setViaDestinoId] = useState<number | null>(null);
  const [tipoMovimiento, setTipoMovimiento] = useState<"MD_TRABAJANDO" | "REMOLCADA" | "">("");
  const [posicionCabina, setPosicionCabina] = useState<Posicion>("Sin_Solicitar");
  const [posicionChimenea, setPosicionChimenea] = useState<Posicion>("Sin_Solicitar");
  const [direccionEmpuje, setDireccionEmpuje] = useState<Direccion>("Sin_Solicitar");
  const [polo, setPolo] = useState<Polo>("Sin_Solicitar");
  const [form, setForm] = useState<MovementFormData>(baseInitialForm);
    const lastTap = useRef<Record<string, number>>({});
  
  // Secciones elegidas para hint META (el backend solo las lee desde instrucciones)
  const [fromSection, setFromSection] = useState<number | undefined>(undefined);
  const [toSection, setToSection] = useState<number | undefined>(undefined);

  // Estado para el flujo de pasos
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const STEP_CFG = [
    { label: "Paso 1 de 3", percent: 33 },
    { label: "Paso 2 de 3", percent: 66 },
    { label: "Paso 3 de 3", percent: 100 },
  ] as const;
  const { label, percent } = STEP_CFG[step - 1];

  // Limpiar instrucciones cuando se llega al paso 3
  useEffect(() => {
    if (step === 3) {
      setInstrucciones("");
    }
  }, [step]);

  // Rol y helpers
  const [rol, setRol] = useState<Rol>("CLIENTE");
  useEffect(() => { const r = String(Movimiento.getCookie("role") || "").toUpperCase() as Rol; if (r) setRol(r); }, []);
  const roleToPath = (r?: string) => {
    const R = String(r || "").toUpperCase();
    if (R === "COORDINADOR") return "/coordinador/movimientos";
    if (R === "ADMINISTRADOR") return "/administrador/movimientos";
    if (R === "SUPERVISOR") return "/supervisor/movimientos";
    return "/cliente/movimientos";
  };

  /** Cargar info edición + vías */
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const data = await Movimiento.fetchJSON(`${API_BASE}/movimientos/${movimientoId}/edicion`);
        if (!mounted) return;
        setInfo(data);

        // Prefill
        setInstrucciones(String(data.movimiento.instrucciones ?? ""));
        setLocomotiveNumber(String(data.movimiento.locomotiveNumber ?? ""));
        setViaOrigenId(data.movimiento.viaOrigen?.id ?? null);
        setViaDestinoId(data.movimiento.viaDestino?.id ?? null);
        setTipoMovimiento((data.movimiento.tipoMovimiento as any) || "");
        setPolo(data.movimiento.polo || "Sin_Solicitar");
        setPosicionCabina((data.movimiento.posicionCabina as any) ?? "Sin_Solicitar");
        setPosicionChimenea((data.movimiento.posicionChimenea as any) ?? "Sin_Solicitar");
        setDireccionEmpuje((data.movimiento.direccionEmpuje as any) ?? "Sin_Solicitar");
        setServiceVia((!data.movimiento.Lavado && !data.movimiento.torno)?"":(data.movimiento.torno?"Torno":"Lavado"));

        // Prefill secciones desde meta si aplica (el parser expone meta.seccion y meta.destinoId)
        if (data.movimiento.meta?.seccion) setToSection(Number(data.movimiento.meta.seccion));

        // Cargar vías por localidad
        const locId = data.movimiento.localidad?.id;
        if (locId) {
          const list = await Movimiento.fetchJSON(`${API_BASE}/vias/localidad/${locId}`).catch(() => []);
          const vList: Via[] = Array.isArray(list)
            ? list.map((v: any) => ({ id: v.id, nombre: v.nombre }))
            : [];
          vList.sort((a, b) => String(a.nombre).localeCompare(String(b.nombre)));
          setVias(vList);
        }
      } catch (e: any) {
        setError(e?.message || "Error al cargar la información de edición.");
      } finally {
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [movimientoId]);

  /** Secciones por vía (caché) */
  const secLoadingRef = useRef<Record<number, boolean>>({});
  const ensureSections = useCallback(async (viaId: number) => {
    if (!viaId) return;
    if (secLoadingRef.current[viaId]) return;
    if (Array.isArray(sectionsByVia[viaId])) return;

    secLoadingRef.current[viaId] = true;
    setSecLoading((s) => ({ ...s, [viaId]: true }));
    try {
      const raw = await Movimiento.fetchJSON(`${SECC_BASE}/via/${viaId}`);
      const arr: Seccion[] = Array.isArray(raw) ? raw : raw?.secciones ?? [];
      const ordered = arr.slice().sort((a, b) => a.numero - b.numero);
      setSectionsByVia((m) => ({ ...m, [viaId]: ordered }));
    } catch {
      setSectionsByVia((m) => ({ ...m, [viaId]: [] }));
    } finally {
      secLoadingRef.current[viaId] = false;
      setSecLoading((s) => ({ ...s, [viaId]: false }));
    }
  }, [sectionsByVia]);

  /** UI helpers */
  const viaName = (id?: number | null) => (id ? vias.find((v) => v.id === id)?.nombre || "" : "");
  useEffect(() => { if (viaOrigenId) ensureSections(viaOrigenId); }, [viaOrigenId, ensureSections]);
  useEffect(() => { if (viaDestinoId) ensureSections(viaDestinoId); }, [viaDestinoId, ensureSections]);

  /** Validaciones ligeras */
  const [errors, setErrors] = useState<Record<string, string>>({});
  const validateStep2 = () => {
    const e: Record<string, string> = {};
    if (!tipoMovimiento) e.tipoMovimiento = "Selecciona el tipo de movimiento.";
    if (tipoMovimiento === "REMOLCADA" && !["EMPUJAR", "JALAR"].includes(direccionEmpuje)) {
      e.direccionEmpuje = "Selecciona EMPUJAR o JALAR.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  /** Construir descripción automática de vías, secciones y polo igual que en CrearMovimiento */
  const buildAutoDescription = (fromTrackId?: number | null, toTrackId?: number | null, fromSection?: number, toSection?: number, polo?: "NORTE" | "SUR" | "Sin_Solicitar"): string => {
    const partes: string[] = [];
    if (fromTrackId)
      partes.push(`De la vía ${viaName(fromTrackId)}${typeof fromSection === "number" ? ` (sección ${fromSection})` : ""}`);
    if (toTrackId)
      partes.push(`para la vía ${viaName(toTrackId)}${typeof toSection === "number" ? ` (sección ${toSection})` : ""}`);
    
    // Add polo information if selected
    if (polo && polo !== "Sin_Solicitar") {
      partes.push(`| Posición: ${polo} |`);
    }
    
    return partes.join(" ");
  };
  const tapToggle = (key: string, onSingle: () => void, onDouble: () => void) => {
    const now = Date.now();
    const last = lastTap.current[key] || 0;
    if (now - last < DOUBLE_TAP_MS) onDouble(); else onSingle();
    lastTap.current[key] = now;
  };
  const buildPayload = (): EditablePayload => {
    if (!info) return {} as EditablePayload;

    const { editableKeys } = info;
    const payload: EditablePayload = {};

    // Añadir solo los campos editables que han cambiado
    if (editableKeys.includes('locomotiveNumber') && String(locomotiveNumber) !== String(info.movimiento.locomotiveNumber ?? '')) {
      payload.locomotiveNumber = Number(locomotiveNumber) || 0;
    }

    if (editableKeys.includes('viaOrigenId') && viaOrigenId !== info.movimiento.viaOrigen?.id) {
      payload.viaOrigenId = viaOrigenId;
    }

    if (editableKeys.includes('viaDestinoId') && viaDestinoId !== info.movimiento.viaDestino?.id) {
      payload.viaDestinoId = viaDestinoId;
    }

    if (editableKeys.includes('tipoMovimiento') && tipoMovimiento !== (info.movimiento.tipoMovimiento as any)) {
      if (tipoMovimiento) payload.tipoMovimiento = tipoMovimiento;
    }

    if (editableKeys.includes('posicionCabina') && posicionCabina !== (info.movimiento.posicionCabina as any)) {
      payload.posicionCabina = posicionCabina;
    }

    if (editableKeys.includes('posicionChimenea') && posicionChimenea !== (info.movimiento.posicionChimenea as any)) {
      payload.posicionChimenea = posicionChimenea;
    }

    if (editableKeys.includes('direccionEmpuje') && direccionEmpuje !== (info.movimiento.direccionEmpuje as any)) {
      payload.direccionEmpuje = direccionEmpuje;
    }

    if ((editableKeys.includes('torno') && editableKeys.includes('lavado'))) {
      payload.torno =serviceVia === "Torno"
      payload.lavado = serviceVia === "Lavado";
    }

    // Polo is now included in the instructions, not in the payload

    // Construir instrucciones con metadatos
    const autoDesc = buildAutoDescription(viaOrigenId, viaDestinoId, fromSection, toSection, polo);
    const metaParts: string[] = [];
    if (typeof toSection === 'number') metaParts.push(`[META DESTINO:${toSection}]`);
    if (typeof fromSection === 'number') metaParts.push(`[META ORIGEN:${fromSection}]`);

    const finalInstr = [metaParts.join(' '), autoDesc, instrucciones?.trim() || '']
      .filter(Boolean)
      .join(' ')
      .trim();

    if (info.editableKeys.includes('instrucciones')) payload.instrucciones = finalInstr;
    
    return payload;
  };

  /** Guardar */
  const onSubmit = useCallback(async () => {
    if (!info) return;
    if (!validateStep2()) return;

    const payload = buildPayload();
    if (Object.keys(payload).length === 0) {
      alert("No hay cambios por guardar.");
      return;
    }

    try {
      setSaving(true);
      const updated = await Movimiento.fetchJSON(`${API_BASE}/movimientos/${movimientoId}/edicion`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      // Éxito
      onSaved?.(updated);
      const next = roleToPath(rol);
      window.location.assign(next);
    } catch (e: any) {
      alert(e?.message || "Error al guardar cambios.");
    } finally {
      setSaving(false);
    }
  }, [info, movimientoId, rol, validateStep2, buildPayload, onSaved]);


  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="text-slate-600 dark:text-slate-300">Cargando editor…</div>
      </div>
    );
  }
  if (error || !info) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="rounded-md border border-rose-300 bg-rose-50 p-4 text-rose-700 dark:border-rose-700 dark:bg-rose-900/20 dark:text-rose-200">
          {error || "No se pudo cargar la información de edición."}
        </div>
      </div>
    );
  }

  const readOnly = !info.editable;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Grid de fondo */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.05)_1px,transparent_1px)] bg-[size:24px_24px] dark:opacity-[0.07]"
      />
      <div className="relative z-10">
        <div className="mb-3 flex items-center gap-2">
          <Badge tone={readOnly ? "warn" : "ok"}>
            {readOnly ? (info.restricciones.motivo || "No editable") : "Editable"}
          </Badge>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Movimiento #{info.movimiento.id} · {info.movimiento.empresa?.nombre ?? "Sin empresa"} · {info.movimiento.localidad?.nombre}
          </span>
          <button
            onClick={onClose || (() => window.location.assign(roleToPath(rol)))}
            className="ml-auto rounded-md border border-red-500 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:border-red-500 dark:text-red-400 dark:hover:bg-red-900/20"
            title="Volver"
          >
            Salir
          </button>
        </div>

        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Editar Movimiento #{info.movimiento.id} <span className="text-slate-500 dark:text-slate-400">({label})</span>
        </h1>

        <div className="mt-3 h-2 w-full rounded bg-slate-200 dark:bg-slate-800" aria-label="Progreso">
          <div className="h-2 rounded bg-emerald-600 transition-[width] duration-300" style={{ width: `${percent}%` }} />
        </div>
        <div className="mt-1 text-right text-xs text-slate-500 dark:text-slate-400">{percent}%</div>

        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          {step === 1 && (
            <Step1Edit
              readOnly={readOnly}
              vias={vias}
              sectionsByVia={sectionsByVia}
              secLoading={secLoading}
              selectionMode={selectionMode}
              serviceVia={serviceVia}
              setServiceVia={setServiceVia}
              setSelectionMode={setSelectionMode}
              ensureSections={ensureSections}
              viaOrigenId={viaOrigenId}
              setViaOrigenId={setViaOrigenId}
              viaDestinoId={viaDestinoId}
              setViaDestinoId={setViaDestinoId}
              fromSection={fromSection}
              setFromSection={setFromSection}
              toSection={toSection}
              setToSection={setToSection}
              locomotiveNumber={locomotiveNumber}
              setLocomotiveNumber={setLocomotiveNumber}
              viaName={viaName} 
              tapToggle={tapToggle}
              setForm={setForm} />
          )}

          {step === 2 && (
            <Step2Edit
              readOnly={!info.editable || saving}
              tipoMovimiento={tipoMovimiento}
              setTipoMovimiento={setTipoMovimiento}
              posicionCabina={posicionCabina}
              setPosicionCabina={setPosicionCabina}
              posicionChimenea={posicionChimenea}
              setPosicionChimenea={setPosicionChimenea}
              direccionEmpuje={direccionEmpuje}
              setDireccionEmpuje={setDireccionEmpuje}
              polo={polo}
              setPolo={setPolo}
              errors={errors}
            />
          )}

          {step === 3 && (
            <Step3Edit
              readOnly={readOnly}
              instrucciones={instrucciones}
              setInstrucciones={setInstrucciones}
              resumen={{
                localidad: info.movimiento.localidad?.nombre,
                origen: viaOrigenId ? `Vía ${viaName(viaOrigenId)}${fromSection ? ` (Sección #${fromSection})` : ""}` : "—",
                destino: viaDestinoId ? `Vía ${viaName(viaDestinoId)}${toSection ? ` (Sección #${toSection})` : ""}` : "—",
                loco: locomotiveNumber || "—",
                tipo: tipoMovimiento || "—",
                dir: direccionEmpuje || "—",
              }}
              metaHint={
                (fromSection ? `[META ORIGEN:${fromSection}] ` : "") +
                (toSection ? `[META SECCION:${toSection}]` : "")
              }
              saving={saving}
              onSubmit={onSubmit}
            />
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          {step > 1 && (
            <button
              onClick={() => setStep((s) => (s === 1 ? 1 : ((s - 1) as 1 | 2 | 3)))}
              className="rounded-md border border-amber-500 px-4 py-2 text-amber-700 hover:bg-amber-50 dark:border-amber-500 dark:text-amber-400 dark:hover:bg-amber-900/20"
            >
              Anterior
            </button>
          )}
          {step < 3 && (
            <button
              onClick={() => {
                if (step === 2 && !validateStep2()) return;
                setStep((s) => ((s + 1) as 1 | 2 | 3));
              }}
              className={Movimiento.clsx(
                "rounded-md px-4 py-2 text-white",
                readOnly ? "bg-slate-400 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-700"
              )}
              disabled={readOnly}
            >
              Siguiente
            </button>
          )}
          <button
            onClick={onClose || (() => window.location.assign(roleToPath(rol)))}
            className="ml-auto rounded-md border border-red-500 px-4 py-2 text-red-600 hover:bg-red-50 dark:border-red-500 dark:text-red-400 dark:hover:bg-red-900/20"
            title="Volver"
          >
            Salir
          </button>
        </div>
      </div>
    </div>
  );
}

/** ======= SUBCOMPONENTES ======= */

function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  const { label, error, className, id, ...rest } = props;
  const eid = id || `f_${label.replace(/\s+/g, "_").toLowerCase()}`;
  return (
    <label htmlFor={eid} className="mb-3 block">
      <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
      <input
        id={eid}
        {...rest}
        aria-invalid={!!error}
        aria-describedby={error ? `${eid}_err` : undefined}
        className={Movimiento.clsx(inputBase, error && "border-rose-500 focus:border-rose-500", className)}
      />
      {error ? <span id={`${eid}_err`} className="mt-1 block text-xs text-rose-600 dark:text-rose-400">{error}</span> : null}
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  error,
  disabled,
}: {
  label: string;
  value: string | number | null | undefined;
  onChange: (v: string) => void;
  options: Array<{ label: string; value: string }>;
  error?: string;
  disabled?: boolean;
}) {
  const id = `sel_${label.replace(/\s+/g, "_").toLowerCase()}`;
  return (
    <label className="mb-3 block" htmlFor={id}>
      <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
      <select
        id={id}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}_err` : undefined}
        className={Movimiento.clsx(
          inputBase,
          "bg-white dark:bg-slate-900 appearance-none touch-manipulation",
          disabled && "cursor-not-allowed opacity-60",
          error && "border-rose-500 focus:border-rose-500"
        )}
      >
        <option value="">— Selecciona —</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error ? <span id={`${id}_err`} className="mt-1 block text-xs text-rose-600 dark:text-rose-400">{error}</span> : null}
    </label>
  );
}

function Step1Edit({
  readOnly,
  vias,
  sectionsByVia,
  secLoading,
  selectionMode,
  serviceVia,
  setServiceVia,
  setSelectionMode,
  tapToggle,
  setForm,
  ensureSections,
  viaOrigenId,
  setViaOrigenId,
  viaDestinoId,
  setViaDestinoId,
  fromSection,
  setFromSection,
  toSection,
  setToSection,
  locomotiveNumber,
  setLocomotiveNumber,
  viaName,
}: {
  readOnly: boolean;
  vias: Via[];
  sectionsByVia: Record<number, Seccion[]>;
  secLoading: Record<number, boolean>;
  selectionMode: "de_via" | "para_via";
  serviceVia:Servicio | undefined ;
  setServiceVia: (v?: Servicio) => void;
  setSelectionMode: (mode: "de_via" | "para_via") => void;
  tapToggle: (key: string, onSingle: () => void, onDouble: () => void) => void;
  setForm: React.Dispatch<React.SetStateAction<MovementFormData>>;
  ensureSections: (viaId: number) => void;
  viaOrigenId: number | null;
  setViaOrigenId: (v: number | null) => void;
  viaDestinoId: number | null;
  setViaDestinoId: (v: number | null) => void;
  fromSection?: number;
  setFromSection: (v?: number) => void;
  toSection?: number;
  setToSection: (v?: number) => void;
  locomotiveNumber: string;
  setLocomotiveNumber: (v: string) => void;
  viaName: (id?: number | null) => string;
}) {
  const optionFrom = (v: Via) => (
    <button
      key={v.id}
      disabled={readOnly}
      onClick={() => setViaOrigenId(viaOrigenId === v.id ? null : v.id)}
      className={Movimiento.clsx(
        "flex w-full items-center justify-between rounded-md border px-3 py-2 text-left hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800",
        viaOrigenId === v.id && "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
      )}
    >
      <span className="truncate">Vía {v.nombre}</span>
    </button>
  );
  const optionTo = (v: Via) => {
    const secs = sectionsByVia[v.id];
    const allOcc: boolean | null = Array.isArray(secs) ? secs.length > 0 && secs.every((x) => x.ocupada) : null;
    const label = allOcc === null ? "—" : allOcc ? "SIN SECC. LIBRES" : "HAY LIBRES";
    const tone = allOcc === null ? "text-slate-500" : allOcc ? "text-rose-600" : "text-emerald-600";
    return (
      <button
        key={v.id}
        disabled={readOnly}
        onClick={() => setViaDestinoId(viaDestinoId === v.id ? null : v.id)}
        className={Movimiento.clsx(
          "flex w-full items-center justify-between rounded-md border px-3 py-2 text-left hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800",
          viaDestinoId === v.id && "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
        )}
      >
        <span className="truncate">Vía {v.nombre}</span>
        <span className={Movimiento.clsx("ml-3 text-xs font-semibold", tone)}>{label}</span>
      </button>
    );
  };

  const SectionsPills = ({ kind, viaId }: { kind: "from" | "to"; viaId?: number | null }) => {
    useEffect(() => {
      if (!viaId) return;
      if (!Array.isArray(sectionsByVia[viaId]) && !secLoading[viaId]) ensureSections(viaId);
    }, [viaId]);

    if (!viaId) return null;
    const loading = !!secLoading[viaId];
    const listRaw = sectionsByVia[viaId];
    const hasData = Array.isArray(listRaw);
    const list = (hasData ? listRaw : [])!.filter((s) => (kind === "from" ? true : !s.ocupada));
    const selected = kind === "from" ? fromSection : toSection;

    return (
      <div className="mt-2">
        <div className="mb-1 text-xs text-slate-500 dark:text-slate-400">
          Secciones de {viaName(viaId)} {loading || !hasData ? "" : `(${list.length})`}
        </div>

        {loading || !hasData ? (
          <div className="py-2 text-sm text-slate-500 dark:text-slate-400">Cargando secciones…</div>
        ) : list.length === 0 ? (
          <div className="py-2 text-sm text-slate-500 dark:text-slate-400">
            {kind === "to" ? "No hay secciones libres." : "Esta vía no tiene secciones."}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {list.map((s) => {
              const active = selected === s.numero;
              const color = s.ocupada ? "border-rose-500 text-rose-700 dark:text-rose-300" : "border-emerald-500 text-emerald-700 dark:text-emerald-300";
              return (
                <button
                  key={s.id}
                  disabled={readOnly}
                  onClick={() => (kind === "from" ? setFromSection(active ? undefined : s.numero) : setToSection(active ? undefined : s.numero))}
                  className={Movimiento.clsx("rounded-full border px-3 py-1 text-xs font-semibold", color, active && (s.ocupada ? "bg-rose-600 text-white" : "bg-emerald-600 text-white"))}
                >
                  #{s.numero}{s.nombre ? ` · ${s.nombre}` : ""}{s.ocupada ? " · OCUP" : ""}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field
        label="Número de locomotora"
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={locomotiveNumber}
        onChange={(e) => {
          const value = e.target.value;
          if (value === '' || /^\d+$/.test(value)) {
            setLocomotiveNumber(value);
          }
        }}
        disabled={readOnly}
      />
      {/* Modo de selección - solo visible cuando hay servicio */}
      {/* Servicio */}
      <div className="sm:col-span-2">
        <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Servicio</span>
        <div className="flex flex-wrap gap-2">
          {(["Lavado", "Torno"] as const).map((svc) => {
            const active = serviceVia === svc;
            return (
              <button
                key={svc}
                onClick={() =>
                    tapToggle(
                      `svc:${svc}`,
                      () => {setForm((p) => ({ ...p, service: svc, toTrack: null })); setServiceVia(svc)},
                      () => {setForm((p) => ({ ...p, service: "", toTrack: p.toTrack })); setServiceVia("")}
                    )
                }
                className={Movimiento.clsx(
                  "rounded-md border px-3 py-2 text-sm",
                  active ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300"
                    : "hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                )}
              >
                {svc}
              </button>
            );
          })}
          {serviceVia ? <span className="self-center text-xs text-slate-500 dark:text-slate-400">Doble clic para desmarcar</span> : null}
        </div>
      </div>
      {(serviceVia || selectionMode) && (
        <div className="sm:col-span-2">
          <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Modo de selección</span>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectionMode("de_via")}
              className={Movimiento.clsx(
                "rounded-md border px-3 py-2 text-sm",
                selectionMode === "de_via"
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300"
                  : "hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
              )}
            >
              De vía
            </button>
            <button
              onClick={() => setSelectionMode("para_via")}
              className={Movimiento.clsx(
                "rounded-md border px-3 py-2 text-sm",
                selectionMode === "para_via"
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300"
                  : "hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
              )}
            >
              Para vía
            </button>
          </div>
        </div>
      )}
      {/* Origen */}
      {(selectionMode === "de_via" || !serviceVia) && 
      (<div className="sm:col-span-2">
        <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">De vía (origen)</span>
        <div className="flex gap-2">
          <button
            onClick={() => { /* toggled by list */ }}
            className="min-w-[220px] rounded-md border px-3 py-2 text-left dark:border-slate-700"
            disabled
            title="Selecciona abajo"
          >
            {viaOrigenId ? `Vía ${viaName(viaOrigenId)}` : "Selecciona una vía"}
          </button>
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">{Movimiento.TrackFilter(vias, selectionMode, "de_via", serviceVia).map((v) => (<div key={v.id}>{optionFrom(v)}</div>))}</div>
        <SectionsPills kind="from" viaId={viaOrigenId} />
      </div>)}
      {(selectionMode === "para_via" || !serviceVia) && (<div className="sm:col-span-2">
        <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Para vía (destino)</span>
        <div className="flex gap-2">
          <button
            onClick={() => { /* toggled by list */ }}
            className="min-w-[220px] rounded-md border px-3 py-2 text-left dark:border-slate-700"
            disabled
            title="Selecciona abajo"
          >
            {viaDestinoId ? `Vía ${viaName(viaDestinoId)}` : "Selecciona una vía"}
          </button>
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">{Movimiento.TrackFilter(vias, selectionMode, "para_via", serviceVia).map((v) => (<div key={v.id}>{optionTo(v)}</div>))}</div>
        <SectionsPills kind="to" viaId={viaDestinoId} />
      </div>)}
    </div>
  );
}

function Step2Edit({
  readOnly,
  tipoMovimiento,
  setTipoMovimiento,
  posicionCabina,
  setPosicionCabina,
  posicionChimenea,
  setPosicionChimenea,
  direccionEmpuje,
  setDireccionEmpuje,
  polo,
  setPolo,
  errors,
}: {
  readOnly: boolean;
  tipoMovimiento: "" | "MD_TRABAJANDO" | "REMOLCADA";
  setTipoMovimiento: (v: "MD_TRABAJANDO" | "REMOLCADA" | "") => void;
  posicionCabina: Posicion;
  setPosicionCabina: (v: Posicion) => void;
  posicionChimenea: Posicion;
  setPosicionChimenea: (v: Posicion) => void;
  direccionEmpuje: Direccion;
  setDireccionEmpuje: (v: Direccion) => void;
  polo: "NORTE" | "SUR" | "Sin_Solicitar";
  setPolo: (v: "NORTE" | "SUR" | "Sin_Solicitar") => void;
  errors: Record<string, string>;
}) {
  const Card = ({
    active,
    label,
    onClick,
    disabled,
  }: {
    active: boolean;
    label: string;
    onClick: () => void;
    disabled?: boolean;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={Movimiento.clsx(
        "flex w-full items-center justify-between rounded-md border px-3 py-3 text-left",
        "hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800",
        active && "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20",
        disabled && "cursor-not-allowed opacity-60"
      )}
    >
      <span className="font-medium">{label}</span>
      <span className={Movimiento.clsx("ml-3 rounded-full px-2 py-0.5 text-xs", active ? "border border-emerald-500 text-emerald-700 dark:text-emerald-300" : "border border-slate-300 text-slate-500")}>
        {active ? "Seleccionado" : "Elegir"}
      </span>
    </button>
  );

  return (
    <div className="grid gap-6">
      {/* Tipo */}
      <div>
        <div className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-200">Tipo de movimiento</div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Card label="MD Trabajando" active={tipoMovimiento === "MD_TRABAJANDO"} onClick={() => setTipoMovimiento("MD_TRABAJANDO")} disabled={readOnly} />
          <Card label="Remolcada" active={tipoMovimiento === "REMOLCADA"} onClick={() => setTipoMovimiento("REMOLCADA")} disabled={readOnly} />
        </div>
        {errors.tipoMovimiento && <div className="mt-1 text-xs text-rose-600">{errors.tipoMovimiento}</div>}
      </div>

      {/* Polo Norte/Sur */}
      <div>
        <div className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-200"></div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Card 
            label="Norte" 
            active={polo === "NORTE"} 
            onClick={() => {
              if (polo === "NORTE") {
                setPolo("Sin_Solicitar");
              } else {
                setPolo("NORTE");
                setPosicionCabina("Sin_Solicitar");
                setPosicionChimenea("Sin_Solicitar");
              }
            }} 
            disabled={readOnly || posicionCabina !== "Sin_Solicitar" || posicionChimenea !== "Sin_Solicitar"} 
          />
          <Card 
            label="Sur" 
            active={polo === "SUR"} 
            onClick={() => {
              if (polo === "SUR") {
                setPolo("Sin_Solicitar");
              } else {
                setPolo("SUR");
                setPosicionCabina("Sin_Solicitar");
                setPosicionChimenea("Sin_Solicitar");
              }
            }} 
            disabled={readOnly || posicionCabina !== "Sin_Solicitar" || posicionChimenea !== "Sin_Solicitar"} 
          />
        </div>
        {polo !== "Sin_Solicitar" && <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Doble clic para desmarcar</div>}
      </div>

      {/* Posición de cabina */}
      <div>
        <div className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-200">Posición de cabina</div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Card 
            label="Dentro" 
            active={posicionCabina === "DENTRO"} 
            onClick={() => {
              if (posicionCabina === "DENTRO") {
                setPosicionCabina("Sin_Solicitar");
              } else {
                setPosicionCabina("DENTRO");
                setPolo("Sin_Solicitar");
              }
            }} 
            disabled={readOnly || polo !== "Sin_Solicitar"} 
          />
          <Card 
            label="Afuera" 
            active={posicionCabina === "AFUERA"} 
            onClick={() => {
              if (posicionCabina === "AFUERA") {
                setPosicionCabina("Sin_Solicitar");
              } else {
                setPosicionCabina("AFUERA");
                setPolo("Sin_Solicitar");
              }
            }} 
            disabled={readOnly || polo !== "Sin_Solicitar"} 
          />
        </div>
        {posicionCabina !== "Sin_Solicitar" && <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Doble clic para desmarcar</div>}
      </div>

      <div>
        <div className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-200">Posición de chimenea</div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Card 
            label="Dentro" 
            active={posicionChimenea === "DENTRO"} 
            onClick={() => {
              if (posicionChimenea === "DENTRO") {
                setPosicionChimenea("Sin_Solicitar");
              } else {
                setPosicionChimenea("DENTRO");
                setPolo("Sin_Solicitar");
              }
            }} 
            disabled={readOnly || polo !== "Sin_Solicitar"} 
          />
          <Card 
            label="Afuera" 
            active={posicionChimenea === "AFUERA"} 
            onClick={() => {
              if (posicionChimenea === "AFUERA") {
                setPosicionChimenea("Sin_Solicitar");
              } else {
                setPosicionChimenea("AFUERA");
                setPolo("Sin_Solicitar");
              }
            }} 
            disabled={readOnly || polo !== "Sin_Solicitar"} 
          />
        </div>
        {posicionChimenea !== "Sin_Solicitar" && <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Doble clic para desmarcar</div>}
      </div>

      {/* Dirección (solo si Remolcada) */}
      {tipoMovimiento === "REMOLCADA" && (
        <div>
          <div className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-200">Dirección (remolcada)</div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Card label="Empujar" active={direccionEmpuje === "EMPUJAR"} onClick={() => setDireccionEmpuje("EMPUJAR")} disabled={readOnly} />
            <Card label="Jalar" active={direccionEmpuje === "JALAR"} onClick={() => setDireccionEmpuje("JALAR")} disabled={readOnly} />
          </div>
          {errors.direccionEmpuje && <div className="mt-1 text-xs text-rose-600">{errors.direccionEmpuje}</div>}
        </div>
      )}
    </div>
  );
}

function Step3Edit({
  readOnly,
  instrucciones,
  setInstrucciones,
  resumen,
  metaHint,
  saving,
  onSubmit,
}: {
  readOnly: boolean;
  instrucciones: string;
  setInstrucciones: (v: string) => void;
  resumen: { localidad?: string; origen: string | number | null | undefined; destino: string | number | null | undefined; loco: string; tipo: string; dir: string; };
  metaHint: string;
  saving: boolean;
  onSubmit: () => void;
}) {
  return (
    <div className="grid gap-4">
      <div className="rounded-lg border p-3 text-sm dark:border-slate-700">
        <div className="font-semibold mb-2 text-slate-800 dark:text-slate-100">Resumen</div>
        <ul className="grid gap-1 text-slate-700 dark:text-slate-300">
          <li>Localidad: {resumen.localidad ?? "—"}</li>
          <li>Origen: {resumen.origen ?? "—"}</li>
          <li>Destino: {resumen.destino ?? "—"}</li>
          <li>Locomotora: {resumen.loco || "—"}</li>
          <li>Tipo: {resumen.tipo || "—"}</li>
          <li>Dirección: {resumen.dir || "—"}</li>
        </ul>
      </div>

      <label className="mb-3 block">
        <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Comentarios / instrucciones</span>
        <textarea
          rows={6}
          className={Movimiento.clsx(inputBase, "min-h-[120px]")}
          value={instrucciones}
          onChange={(e) => setInstrucciones(e.target.value)}
          placeholder="Escribe comentarios; añadiremos pistas META si seleccionaste secciones."
          disabled={readOnly}
        />
        {(metaHint?.trim()?.length ?? 0) > 0 && (
          <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">Se añadirá: {metaHint.trim()}</span>
        )}
      </label>

      <button
        onClick={onSubmit}
        disabled={readOnly || saving}
        className={Movimiento.clsx(
          "inline-flex items-center justify-center rounded-md px-4 py-2 font-medium text-white",
          readOnly ? "bg-slate-400 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-700",
          saving && "opacity-60"
        )}
        title={readOnly ? "No editable" : "Guardar cambios"}
      >
        {saving ? "Guardando…" : "Guardar cambios"}
      </button>
    </div>
  );
}

function Badge({ tone, children }: { tone: "ok" | "warn" | "error" | "muted"; children: React.ReactNode }) {
  const map = {
    ok: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-800",
    warn: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-800",
    error: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-200 dark:border-rose-800",
    muted: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  } as const;
  return <span className={Movimiento.clsx(chipBase, map[tone])}>{children}</span>;
}
