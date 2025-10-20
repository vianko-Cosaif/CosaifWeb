/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

/** ======= CONFIG ======= */
const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || "/xapi";
const SECC_BASE = `${API_BASE}/secciones/secciones`;
const FETCH_TIMEOUT_MS = 12000;

/** ======= TIPOS ======= */
type Direccion = "EMPUJAR" | "JALAR" | "Sin_Solicitar";
type Posicion = "DENTRO" | "AFUERA" | "Sin_Solicitar";
type Rol = "CLIENTE" | "ADMINISTRADOR" | "COORDINADOR" | "SUPERVISOR" | string;

type Empresa = { id: number; nombre: string };
type Localidad = { id: number; nombre: string; estado?: string };
type Via = { id: number; nombre: string };
type Seccion = {
  id: number;
  numero: number;
  nombre?: string | null;
  ocupada: boolean;
  movimientoId?: number | null;
  movimiento?: { id: number; locomotiveNumber?: string | null } | null;
};

type InfoEdicion = {
  editable: boolean;
  restricciones: {
    motivo: string | null;
    estadosPermitidos: string[];
    mismaLocalidadParaVias: boolean;
  };
  movimiento: {
    id: number;
    empresa: Empresa | null;
    localidad: Localidad;
    estado: string;
    finalizado: boolean;
    instrucciones?: string | null;
    locomotiveNumber?: number | null;
    viaOrigen?: Via | null;
    viaDestino?: Via | null;
    tipoMovimiento?: "MD_TRABAJANDO" | "REMOLCADA" | null;
    posicionCabina?: Posicion | null;
    posicionChimenea?: Posicion | null;
    direccionEmpuje?: Direccion | null;
    meta?: { destinoId?: number; seccion?: number; liberar?: boolean };
  };
  editableKeys: Array<
    | "instrucciones"
    | "locomotiveNumber"
    | "viaOrigenId"
    | "viaDestinoId"
    | "tipoMovimiento"
    | "posicionCabina"
    | "posicionChimenea"
    | "direccionEmpuje"
  >;
};

type EditablePayload = Partial<{
  instrucciones: string;
  locomotiveNumber: number;
  viaOrigenId: number | null;
  viaDestinoId: number | null;
  tipoMovimiento: "MD_TRABAJANDO" | "REMOLCADA";
  posicionCabina: Posicion;
  posicionChimenea: Posicion;
  direccionEmpuje: Direccion;
}>;

/** ======= UTILS ======= */
const clsx = (...xs: Array<string | false | null | undefined>) => xs.filter(Boolean).join(" ");
const safeJSON = (t: string) => { try { return JSON.parse(t); } catch { return null; } };

const getCookie = (name: string) => {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(new RegExp("(^|; )" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[2]) : "";
};
const tokenHeader = (): HeadersInit => {
  const t = getCookie("token");
  return t ? { Authorization: `Bearer ${t}` } : {};
};

const fetchWithTimeout = async (url: string, init: RequestInit = {}, timeoutMs = FETCH_TIMEOUT_MS) => {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(to);
  }
};

const fetchJSON = async (url: string, init: RequestInit = {}) => {
  const isGet = !init.method || init.method.toUpperCase() === "GET";
  const res = await fetchWithTimeout(url, {
    credentials: "include",
    cache: "no-store",
    ...init,
    headers: {
      ...(isGet ? {} : { "Content-Type": "application/json" }),
      Accept: "application/json",
      ...(init.headers as any),
      ...tokenHeader(),
    },
  });
  const ct = res.headers.get("content-type") || "";
  const txt = await res.text().catch(() => "");
  const body = ct.includes("application/json") && txt ? safeJSON(txt) : null;
  if (!res.ok) throw new Error((body as any)?.message || (body as any)?.error || txt || `HTTP ${res.status}`);
  return body;
};

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
  useEffect(() => { const r = String(getCookie("role") || "").toUpperCase() as Rol; if (r) setRol(r); }, []);
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
        const data = await fetchJSON(`${API_BASE}/movimientos/${movimientoId}/edicion`);
        if (!mounted) return;
        setInfo(data);

        // Prefill
        setInstrucciones(String(data.movimiento.instrucciones ?? ""));
        setLocomotiveNumber(String(data.movimiento.locomotiveNumber ?? ""));
        setViaOrigenId(data.movimiento.viaOrigen?.id ?? null);
        setViaDestinoId(data.movimiento.viaDestino?.id ?? null);
        setTipoMovimiento((data.movimiento.tipoMovimiento as any) || "");
        setPosicionCabina((data.movimiento.posicionCabina as any) ?? "Sin_Solicitar");
        setPosicionChimenea((data.movimiento.posicionChimenea as any) ?? "Sin_Solicitar");
        setDireccionEmpuje((data.movimiento.direccionEmpuje as any) ?? "Sin_Solicitar");

        // Prefill secciones desde meta si aplica (el parser expone meta.seccion y meta.destinoId)
        if (data.movimiento.meta?.seccion) setToSection(Number(data.movimiento.meta.seccion));

        // Cargar vías por localidad
        const locId = data.movimiento.localidad?.id;
        if (locId) {
          const list = await fetchJSON(`${API_BASE}/vias/localidad/${locId}`).catch(() => []);
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
      const raw = await fetchJSON(`${SECC_BASE}/via/${viaId}`);
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

  /** Construir descripción automática de vías y secciones igual que en CrearMovimiento */
  const buildAutoDescription = (fromTrackId?: number | null, toTrackId?: number | null, fromSection?: number, toSection?: number): string => {
    const partes: string[] = [];
    if (fromTrackId)
      partes.push(`De la vía ${viaName(fromTrackId)}${typeof fromSection === "number" ? ` (sección ${fromSection})` : ""}`);
    if (toTrackId)
      partes.push(`para la vía ${viaName(toTrackId)}${typeof toSection === "number" ? ` (sección ${toSection})` : ""}`);
    return partes.join("");
  };

  const buildPayload = (): EditablePayload => {
    if (!info) return {};
    const orig = info.movimiento;

    const p: EditablePayload = {};

    const add = (k: keyof EditablePayload, v: any, toNumber = false) => {
      if (!(info.editableKeys as string[]).includes(k as string)) return;
      const ov: any = ((): any => {
        switch (k) {
          case "instrucciones": return orig.instrucciones ?? "";
          case "locomotiveNumber": return orig.locomotiveNumber ?? null;
          case "viaOrigenId": return orig.viaOrigen?.id ?? null;
          case "viaDestinoId": return orig.viaDestino?.id ?? null;
          case "tipoMovimiento": return orig.tipoMovimiento ?? "";
          case "posicionCabina": return (orig.posicionCabina as any) ?? "Sin_Solicitar";
          case "posicionChimenea": return (orig.posicionChimenea as any) ?? "Sin_Solicitar";
          case "direccionEmpuje": return (orig.direccionEmpuje as any) ?? "Sin_Solicitar";
          default: return undefined;
        }
      })();

      const nv = toNumber ? (v === "" || v === null ? null : Number(v)) : v;
      const areEqual = (a: any, b: any) => String(a ?? "") === String(b ?? "");
      if (!areEqual(ov, nv)) (p as any)[k] = nv;
    };

    // Construir instrucciones igual que en CrearMovimiento: descripción automática + comentario del usuario
    const autoDesc = buildAutoDescription(viaOrigenId, viaDestinoId, fromSection, toSection);
    const metaParts: string[] = [];
    if (typeof toSection === "number") metaParts.push(`[META DESTINO:${toSection}]`);
    if (typeof fromSection === "number") metaParts.push(`[META ORIGEN:${fromSection}]`);

    const finalInstr = [metaParts.join(" "), autoDesc, instrucciones?.trim() || ""]
      .filter(Boolean)
      .join(" ")
      .trim();

    add("instrucciones", finalInstr);
    add("locomotiveNumber", locomotiveNumber.trim() === "" ? null : Number(locomotiveNumber), true);
    add("viaOrigenId", viaOrigenId ?? null, true);
    add("viaDestinoId", viaDestinoId ?? null, true);
    if (tipoMovimiento) add("tipoMovimiento", tipoMovimiento);
    add("posicionCabina", posicionCabina);
    add("posicionChimenea", posicionChimenea);
    add("direccionEmpuje", tipoMovimiento === "REMOLCADA" ? direccionEmpuje : "Sin_Solicitar");

    return p;
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
      const updated = await fetchJSON(`${API_BASE}/movimientos/${movimientoId}/edicion`, {
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
            />
          )}

          {step === 2 && (
            <Step2Edit
              readOnly={readOnly}
              tipoMovimiento={tipoMovimiento}
              setTipoMovimiento={setTipoMovimiento}
              posicionCabina={posicionCabina}
              setPosicionCabina={setPosicionCabina}
              posicionChimenea={posicionChimenea}
              setPosicionChimenea={setPosicionChimenea}
              direccionEmpuje={direccionEmpuje}
              setDireccionEmpuje={setDireccionEmpuje}
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
              className={clsx(
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
        className={clsx(inputBase, error && "border-rose-500 focus:border-rose-500", className)}
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
        className={clsx(
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
      className={clsx(
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
        className={clsx(
          "flex w-full items-center justify-between rounded-md border px-3 py-2 text-left hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800",
          viaDestinoId === v.id && "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
        )}
      >
        <span className="truncate">Vía {v.nombre}</span>
        <span className={clsx("ml-3 text-xs font-semibold", tone)}>{label}</span>
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
                  className={clsx("rounded-full border px-3 py-1 text-xs font-semibold", color, active && (s.ocupada ? "bg-rose-600 text-white" : "bg-emerald-600 text-white"))}
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

      {/* Origen */}
      <div className="sm:col-span-2">
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
        <div className="mt-2 grid gap-2 sm:grid-cols-2">{vias.map((v) => (<div key={v.id}>{optionFrom(v)}</div>))}</div>
        <SectionsPills kind="from" viaId={viaOrigenId} />
      </div>

      {/* Destino */}
      <div className="sm:col-span-2">
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
        <div className="mt-2 grid gap-2 sm:grid-cols-2">{vias.map((v) => (<div key={v.id}>{optionTo(v)}</div>))}</div>
        <SectionsPills kind="to" viaId={viaDestinoId} />
      </div>
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
      className={clsx(
        "flex w-full items-center justify-between rounded-md border px-3 py-3 text-left",
        "hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800",
        active && "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20",
        disabled && "cursor-not-allowed opacity-60"
      )}
    >
      <span className="font-medium">{label}</span>
      <span className={clsx("ml-3 rounded-full px-2 py-0.5 text-xs", active ? "border border-emerald-500 text-emerald-700 dark:text-emerald-300" : "border border-slate-300 text-slate-500")}>
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

      {/* Posiciones */}
      <div>
        <div className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-200">Posición de cabina</div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Card label="Dentro" active={posicionCabina === "DENTRO"} onClick={() => setPosicionCabina("DENTRO")} disabled={readOnly} />
          <Card label="Afuera" active={posicionCabina === "AFUERA"} onClick={() => setPosicionCabina("AFUERA")} disabled={readOnly} />
        </div>
      </div>

      <div>
        <div className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-200">Posición de chimenea</div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Card label="Dentro" active={posicionChimenea === "DENTRO"} onClick={() => setPosicionChimenea("DENTRO")} disabled={readOnly} />
          <Card label="Afuera" active={posicionChimenea === "AFUERA"} onClick={() => setPosicionChimenea("AFUERA")} disabled={readOnly} />
        </div>
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
          className={clsx(inputBase, "min-h-[120px]")}
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
        className={clsx(
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
  return <span className={clsx(chipBase, map[tone])}>{children}</span>;
}
