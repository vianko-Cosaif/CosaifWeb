"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";

/** ======= CONFIG ======= */
const API_BASE = process.env.API_URL || "/xapi";
const SECC_BASE = `${API_BASE}/secciones/secciones`;
const DRAFT_KEY = "movement_draft_v2";
const DOUBLE_TAP_MS = 250;

/** ======= TIPOS ======= */
type Servicio = "Lavado" | "Torno" | "";
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
  movimiento?: { id: number; locomotiveNumber?: number | null } | null;
};

type Option = { label: string; value: string };

export interface MovementFormData {
  empresaId: number | null;
  locomotiveNumber: number;
  priority: boolean;
  fromTrack: number | null;
  toTrack: number | null;
  selectedLocalityId?: number | null;
  cabinPosition: Posicion;
  chimneyPosition: Posicion;
  pushPull: "" | "EMPUJAR" | "JALAR";
  movementType: "" | "MD_TRABAJANDO" | "REMOLCADA";
  comments: string;
  service?: Servicio;
  creadoPorId: number | null;
  clienteId: number | null;
  fechaInicio: string;
  fechaFin: string;
  posicionChimenea?: Posicion | null;
  direccionEmpuje?: Direccion;
}

const baseInitialForm: MovementFormData = {
  empresaId: null,
  locomotiveNumber: 0,
  priority: false,
  fromTrack: null,
  toTrack: null,
  selectedLocalityId: null,
  cabinPosition: "Sin_Solicitar",
  chimneyPosition: "Sin_Solicitar",
  pushPull: "",
  movementType: "",
  comments: "",
  service: "",
  creadoPorId: null,
  clienteId: null,
  fechaInicio: new Date().toISOString(),
  fechaFin: new Date().toISOString(),
  posicionChimenea: null,
  direccionEmpuje: "Sin_Solicitar",
};

/** ======= UTILS ======= */
const clsx = (...xs: Array<string | false | null | undefined>) => xs.filter(Boolean).join(" ");
const fmtLocalDateTime = (s?: string | null) => (s ? new Date(s).toLocaleString("es-MX") : "—");
const getCookie = (name: string) => {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(new RegExp("(^|; )" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[2]) : "";
};
const tokenHeader = (): HeadersInit => {
  const t = getCookie("token");
  return t ? { Authorization: `Bearer ${t}` } : {};
};
const fetchJSON = async (url: string, init: RequestInit = {}) => {
  const initHeaders =
    init.headers instanceof Headers
      ? Object.fromEntries(init.headers.entries())
      : (init.headers as Record<string, string>) || {};
  const isGet = !init.method || init.method.toUpperCase() === "GET";

  const res = await fetch(url, {
    credentials: "include",
    cache: "no-store",
    ...init,
    headers: {
      ...(isGet ? {} : { "Content-Type": "application/json" }),
      Accept: "application/json",
      ...initHeaders,
      ...tokenHeader(),
    },
  });

  if (!res.ok) throw new Error(`${res.status}`);
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? res.json() : null;
};

/** ======= ESTILOS ======= */
const inputBase =
  "w-full rounded-md border px-3 py-2 outline-none transition-colors " +
  "bg-white text-slate-900 placeholder-slate-400 border-slate-300 focus:border-sky-500 " +
  "dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-500 dark:border-slate-700 dark:focus:border-sky-500";
const chipBase = "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium";

/** ======= COMPONENTE ======= */
export default function CrearMovimiento() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [form, setForm] = useState<MovementFormData>(baseInitialForm);
  const [sending, setSending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // data
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [localidades, setLocalidades] = useState<Localidad[]>([]);
  const [vias, setVias] = useState<Via[]>([]);
  const [sectionsByVia, setSectionsByVia] = useState<Record<number, Seccion[]>>({});
  const [secLoading, setSecLoading] = useState<Record<number, boolean>>({});

  // sesión/rol
  const [rol, setRol] = useState<Rol>("CLIENTE");
  const ADMIN_OR_COORD = useMemo(() => ["ADMINISTRADOR", "COORDINADOR"], []);
  const canManageAll = useMemo(() => ADMIN_OR_COORD.includes(String(rol).toUpperCase()), [rol, ADMIN_OR_COORD]);

  const [userCompanyName, setUserCompanyName] = useState("");
  const [user, setUser] = useState<{ id?: number; empresaId?: number | null; empresa?: { id?: number; nombre?: string } | null } | null>(null);

  // UI
  const [showFromOpts, setShowFromOpts] = useState(false);
  const [showToOpts, setShowToOpts] = useState(false);
  const lastTap = useRef<Record<string, number>>({});

  // selección secciones
  const [fromSection, setFromSection] = useState<number | undefined>(undefined);
  const [toSection, setToSection] = useState<number | undefined>(undefined);
  const [locoLockedBy, setLocoLockedBy] = useState<{ movimientoId: number; viaId: number; numero: number } | null>(null);

  /** helper: inicializar form según rol + cookies */
  const initFormLocked = useCallback(() => {
    const roleCookie = String(getCookie("role") || "").trim().toUpperCase();
    if (roleCookie) setRol(roleCookie as Rol);

    const locCookie = Number(getCookie("locId") || NaN);
    const uRaw = typeof window !== "undefined" ? localStorage.getItem("user") : null;
    let u: any = null;
    try {
      u = uRaw ? JSON.parse(uRaw) : null;
    } catch {}

    setUser(u || null);
    setUserCompanyName(u?.empresa?.nombre || "");

    const empresaId = Number(u?.empresaId ?? u?.empresa?.id ?? NaN);
    const base: MovementFormData = {
      ...baseInitialForm,
      creadoPorId: u?.id ?? null,
      clienteId: u?.id ?? null,
      empresaId: Number.isFinite(empresaId) ? empresaId : null,
    };

    const isAdminOrCoord = ADMIN_OR_COORD.includes(roleCookie || String(u?.rol || u?.role || "").toUpperCase());
    const selectedLocalityId = isAdminOrCoord ? null : Number.isFinite(locCookie) ? locCookie : null;

    setForm((prev) => ({
      ...base,
      selectedLocalityId: selectedLocalityId ?? prev.selectedLocalityId ?? null,
    }));
  }, [ADMIN_OR_COORD]);

  /** IDs finales (para submit) */
  const resolvedIds = useMemo(() => {
    const empresaId = Number(form.empresaId ?? user?.empresaId ?? user?.empresa?.id ?? NaN);
    const creadoPorId = Number(form.creadoPorId ?? user?.id ?? NaN);
    const localidadId = Number(form.selectedLocalityId ?? Number(getCookie("locId") || NaN));
    return { empresaId, creadoPorId, localidadId };
  }, [form.empresaId, form.creadoPorId, form.selectedLocalityId, user]);

  /** cargar sesión/combos/draft */
  useEffect(() => {
    initFormLocked();

    (async () => {
      try {
        const [e, l] = await Promise.all([
          fetchJSON(`${API_BASE}/empresas`).catch(() => []),
          fetchJSON(`${API_BASE}/localidades`).catch(() => []),
        ]);
        const eList: Empresa[] = Array.isArray(e) ? e : [];
        const lList: Localidad[] = Array.isArray(l) ? l : [];
        setEmpresas(eList);
        setLocalidades(lList);

        // Fallbacks por si no venían en el usuario/cookie
        setForm((p) => {
          let empresaId = p.empresaId ?? (user?.empresaId ?? user?.empresa?.id ?? null);
          if (!Number.isFinite(Number(empresaId)) && eList.length === 1) empresaId = eList[0].id;

          let localidadId = p.selectedLocalityId;
          if (!Number.isFinite(Number(localidadId)) && !canManageAll && lList.length === 1) localidadId = lList[0].id;

          return {
            ...p,
            empresaId: Number(empresaId) || p.empresaId,
            selectedLocalityId: (Number(localidadId) || p.selectedLocalityId) ?? null,
          };
        });
      } catch {}

      try {
        const raw = typeof window !== "undefined" ? localStorage.getItem(DRAFT_KEY) : null;
        if (raw) {
          const d = JSON.parse(raw);
          setForm((p) => ({ ...p, ...d.form }));
          setFromSection(d.fromSection);
          setToSection(d.toSection);
          setLocoLockedBy(d.locoLockedBy || null);
        }
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initFormLocked]);

  /** reforzar bloqueo cuando cambie rol (cookie) */
  useEffect(() => {
    const roleCookie = String(getCookie("role") || "").trim().toUpperCase();
    if (roleCookie) setRol(roleCookie as Rol);

    if (!canManageAll) {
      const locCookie = Number(getCookie("locId") || NaN);
      setForm((p) => ({
        ...p,
        selectedLocalityId: Number.isFinite(locCookie) ? locCookie : p.selectedLocalityId,
      }));
    }
  }, [canManageAll]);

  /** draft */
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const payload = { form, fromSection, toSection, locoLockedBy };
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
      } catch {}
    }, 350);
    return () => {
      if (draftTimer.current) clearTimeout(draftTimer.current);
    };
  }, [form, fromSection, toSection, locoLockedBy]);

  /** vías por localidad */
  useEffect(() => {
    (async () => {
      if (!form.selectedLocalityId) {
        setVias([]);
        return;
      }
      try {
        const data = await fetchJSON(`${API_BASE}/vias/localidad/${form.selectedLocalityId}`);
        const list: Via[] = (data || []).map((v: any) => ({ id: v.id, nombre: v.nombre }));
        list.sort((a, b) => String(a.nombre).localeCompare(String(b.nombre)));
        setVias(list);
      } catch {
        setVias([]);
      }
    })();
  }, [form.selectedLocalityId]);

  /** ====== ensureSections estable ====== */
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
  }, []); // estable

  /** reset secciones al cambiar vía */
  useEffect(() => {
    setFromSection(undefined);
    setLocoLockedBy(null);
    if (form.fromTrack) ensureSections(form.fromTrack);
  }, [form.fromTrack, ensureSections]);

  useEffect(() => {
    setToSection(undefined);
    if (form.toTrack) ensureSections(form.toTrack);
  }, [form.toTrack, ensureSections]);

  /** helpers */
  const tapToggle = (key: string, onSingle: () => void, onDouble: () => void) => {
    const now = Date.now();
    const last = lastTap.current[key] || 0;
    if (now - last < DOUBLE_TAP_MS) onDouble();
    else onSingle();
    lastTap.current[key] = now;
  };
  const viaName = (id?: number | null) => (id ? vias.find((v) => v.id === id)?.nombre || "" : "");
  const isService = !!form.service;

  /** seleccionar sección origen (prellenar loco si ocupada) */
  const selectFromSection = async (s: Seccion) => {
    const willSelect = fromSection !== s.numero;
    const newVal = willSelect ? s.numero : undefined;
    setFromSection(newVal);

    if (willSelect && s.ocupada && s.movimientoId) {
      const locoIn = Number(s.movimiento?.locomotiveNumber ?? 0);
      if (locoIn > 0) {
        setForm((p) => ({ ...p, locomotiveNumber: locoIn }));
        setLocoLockedBy({ movimientoId: s.movimientoId!, viaId: form.fromTrack!, numero: s.numero });
      } else {
        try {
          const mov = await fetchJSON(`${API_BASE}/movimientos/${s.movimientoId}`);
          const loco = Number(mov?.locomotiveNumber ?? 0);
          if (loco > 0) {
            setForm((p) => ({ ...p, locomotiveNumber: loco }));
            setLocoLockedBy({ movimientoId: s.movimientoId!, viaId: form.fromTrack!, numero: s.numero });
          }
        } catch {}
      }
    } else {
      if (locoLockedBy && locoLockedBy.viaId === form.fromTrack && locoLockedBy.numero === s.numero) setLocoLockedBy(null);
    }
  };

  /** validaciones (no bloquea por empresa/localidad cuando eres CLIENTE) */
  const validate1 = () => {
    const e: Record<string, string> = {};

    const empresaOk = Number.isFinite(resolvedIds.empresaId);
    const locOk = Number.isFinite(resolvedIds.localidadId);

    if (canManageAll && !empresaOk) e.empresaId = "Selecciona empresa.";
    if (canManageAll && !locOk) e.selectedLocalityId = "Selecciona localidad.";

    if (!form.fromTrack) e.fromTrack = "Selecciona vía de origen.";
    if (!isService && !form.toTrack) e.toTrack = "Selecciona vía de destino.";
    if (!form.locomotiveNumber) e.locomotiveNumber = "Número requerido.";

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validate2 = () => {
    const e: Record<string, string> = {};
    if (!form.movementType) e.movementType = "Selecciona el tipo de movimiento.";
    if (!isService) {
      if (!["DENTRO", "AFUERA"].includes(form.cabinPosition)) e.cabinPosition = "Selecciona posición de cabina.";
      if (!["DENTRO", "AFUERA"].includes(form.chimneyPosition)) e.chimneyPosition = "Selecciona posición de chimenea.";
    }
    if (form.movementType === "REMOLCADA" && !["EMPUJAR", "JALAR"].includes(form.direccionEmpuje || "")) {
      e.direccionEmpuje = "Selecciona EMPUJAR o JALAR.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };
/** submit (cumple exactamente con lo que pide el backend + redirect por rol) */
const submit = async () => {
  const { empresaId, creadoPorId, localidadId } = resolvedIds;

  // última validación defensiva
  if (!Number.isFinite(empresaId) || !Number.isFinite(creadoPorId) || !Number.isFinite(localidadId)) {
    alert("Faltan IDs requeridos (empresa, usuario o localidad).");
    return;
  }
  if (!form.fromTrack || !form.locomotiveNumber) {
    alert("Faltan vía de origen o número de locomotora.");
    return;
  }

  const payload: {
    empresaId: number;
    creadoPorId: number;
    localidadId: number;
    viaOrigenId: number;
    locomotiveNumber: number;             // INT
    prioridad: "ALTA" | "BAJA";
    viaDestinoId?: number;
    numeroSeccion?: number;
    instrucciones?: string;
  } = {
    empresaId: Number(empresaId),
    creadoPorId: Number(creadoPorId),
    localidadId: Number(localidadId),
    viaOrigenId: Number(form.fromTrack),
    locomotiveNumber: Number(form.locomotiveNumber),
    prioridad: form.priority ? "ALTA" : "BAJA",
    ...(form.toTrack && !isService ? { viaDestinoId: Number(form.toTrack) } : {}),
    ...(typeof fromSection === "number" ? { numeroSeccion: Number(fromSection) } : {}),
    ...(form.comments.trim() ? { instrucciones: form.comments.trim() } : {}),
  };

  // helper para decidir a dónde mandar según rol
  const roleToPath = (r?: string) => {
    const R = String(r || "").toUpperCase();
    if (R === "COORDINADOR") return "/coordinador/movimientos";
    if (R === "ADMINISTRADOR") return "/administrador/movimientos";
    return "/cliente/movimientos"; // default CLIENTE u otros roles
  };

  try {
    setSending(true);
    const res = await fetch(`${API_BASE}/movimientos`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", Accept: "application/json", ...tokenHeader() },
      body: JSON.stringify(payload),
    });

    const txt = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}${txt ? `: ${txt}` : ""}`);
    const created = txt ? JSON.parse(txt) : {};
    const movimientoId = Number(created?.id || 0);

    // asignar sección origen (opcional)
    if (movimientoId && form.fromTrack && typeof fromSection === "number") {
      await fetch(`${API_BASE}/secciones/via/${form.fromTrack}/asignar`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...tokenHeader() },
        body: JSON.stringify({ numero: Number(fromSection), movimientoId }),
      }).catch(() => {});
    }

    // limpiar draft/UI y redirigir según rol
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
    setFromSection(undefined);
    setToSection(undefined);
    setLocoLockedBy(null);
    setStep(1);

    const dest = roleToPath(rol); // usa el estado 'rol' ya resuelto desde la cookie
    window.location.assign(dest);
  } catch (e: any) {
    alert(e.message || "Error al crear movimiento");
  } finally {
    setSending(false);
  }
};


  /** progreso */
  const STEP_CFG = [
    { label: "Paso 1 de 3", percent: 33 },
    { label: "Paso 2 de 3", percent: 66 },
    { label: "Paso 3 de 3", percent: 100 },
  ] as const;
  const { label, percent } = STEP_CFG[step - 1];

  const lockedClienteMissingData = !canManageAll && !Number.isFinite(Number(getCookie("locId") || NaN));

  const Badge = ({ tone, children }: { tone: "ok" | "warn" | "error" | "muted"; children: React.ReactNode }) => {
    const map = {
      ok: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-800",
      warn: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-800",
      error: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-200 dark:border-rose-800",
      muted: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    } as const;
    return <span className={clsx(chipBase, map[tone])}>{children}</span>;
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
        Nuevo Movimiento <span className="text-slate-500 dark:text-slate-400">({label})</span>
      </h1>

      {!canManageAll && (
        <div className="mt-3 rounded-lg border-l-4 border-sky-400 bg-sky-50 p-3 text-sm dark:border-sky-600 dark:bg-sky-900/20">
          <div className="flex items-center justify-between">
            <div className="font-medium text-sky-800 dark:text-sky-200">
              CLIENTE
            </div>
          </div>
          {lockedClienteMissingData && (
            <div className="mt-2 text-rose-700 dark:text-rose-300">
              No se encontró  una sesión activa por favor inicie sesión nuevamente.
            </div>
          )}
        </div>
      )}

      {/* barra progreso */}
      <div className="mt-3 h-2 w-full rounded bg-slate-200 dark:bg-slate-800">
        <div className="h-2 rounded bg-emerald-600 transition-[width] duration-300" style={{ width: `${percent}%` }} />
      </div>
      <div className="mt-1 text-right text-xs text-slate-500 dark:text-slate-400">{percent}%</div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        {step === 1 && (
          <StepOne
            form={form}
            setForm={setForm}
            errors={errors}
            empresas={empresas}
            localidades={localidades}
            vias={vias}
            canManageAll={canManageAll}
            userCompanyName={userCompanyName}
            showEmpresaOpts={false}
            setShowEmpresaOpts={() => {}}
            showLocOpts={false}
            setShowLocOpts={() => {}}
            showFromOpts={showFromOpts}
            setShowFromOpts={setShowFromOpts}
            showToOpts={showToOpts}
            setShowToOpts={setShowToOpts}
            tapToggle={(k, a, b) => tapToggle(k, a, b)}
            sectionsByVia={sectionsByVia}
            secLoading={secLoading}
            ensureSections={ensureSections}
            fromSection={fromSection}
            toSection={toSection}
            setFromSection={selectFromSection}
            setToSection={setToSection}
            locoLockedBy={locoLockedBy}
            setLocoLockedBy={setLocoLockedBy}
            viaName={viaName}
          />
        )}
        {step === 2 && <StepTwo form={form} setForm={setForm} errors={errors} isService={isService} />}
        {step === 3 && (
          <StepThree
            form={form}
            setForm={setForm}
            sending={sending}
            submit={submit}
            fromSection={fromSection}
            toSection={toSection}
            viaName={viaName}
          />
        )}
      </div>

      <div className="mt-4 flex gap-3">
        {step > 1 && (
          <button
            onClick={() => setStep((s) => (s === 1 ? 1 : ((s - 1) as 1 | 2 | 3)))}
            className="rounded-md border px-4 py-2 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Anterior
          </button>
        )}
        {step < 3 && (
          <button
            onClick={() => {
              if (step === 1 && !validate1()) return;
              if (step === 2 && !validate2()) return;
              setStep((s) => ((s + 1) as 1 | 2 | 3));
            }}
            className="rounded-md bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700"
          >
            Siguiente
          </button>
        )}
      </div>

      {locoLockedBy ? (
        <div className="mt-4 rounded-lg border-l-4 border-sky-400 bg-sky-50 p-3 text-sm dark:border-sky-600 dark:bg-sky-900/20">
          <div className="font-semibold text-sky-800 dark:text-sky-200">
            Locomotora bloqueada por sección #{locoLockedBy.numero} (movimiento #{locoLockedBy.movimientoId}).
          </div>
          <button
            onClick={() => setLocoLockedBy(null)}
            className="mt-2 rounded-md border px-3 py-1 text-xs hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Quitar vinculación
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** ======= SUBCOMPONENTES ======= */

function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  const { label, error, className, ...rest } = props;
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
      <input {...rest} className={clsx(inputBase, error && "border-rose-500 focus:border-rose-500", className)} />
      {error ? <span className="mt-1 block text-xs text-rose-600 dark:text-rose-400">{error}</span> : null}
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
  options: Option[];
  error?: string;
  disabled?: boolean;
}) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={clsx(
          inputBase,
          "bg-white dark:bg-slate-900",
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
      {error ? <span className="mt-1 block text-xs text-rose-600 dark:text-rose-400">{error}</span> : null}
    </label>
  );
}

/** ------ Step 1 ------ */
function StepOne(props: {
  form: MovementFormData;
  setForm: React.Dispatch<React.SetStateAction<MovementFormData>>;
  errors: Record<string, string>;
  empresas: Empresa[];
  localidades: Localidad[];
  vias: Via[];
  canManageAll: boolean;
  userCompanyName: string;
  showEmpresaOpts: boolean;
  setShowEmpresaOpts: (v: boolean) => void;
  showLocOpts: boolean;
  setShowLocOpts: (v: boolean) => void;
  showFromOpts: boolean;
  setShowFromOpts: (v: boolean) => void;
  showToOpts: boolean;
  setShowToOpts: (v: boolean) => void;
  tapToggle: (key: string, onSingle: () => void, onDouble: () => void) => void;
  sectionsByVia: Record<number, Seccion[]>;
  secLoading: Record<number, boolean>;
  ensureSections: (viaId: number) => void;
  fromSection?: number;
  toSection?: number;
  setFromSection: (s: Seccion) => void;
  setToSection: (n?: number) => void;
  locoLockedBy: { movimientoId: number; viaId: number; numero: number } | null;
  setLocoLockedBy: (v: any) => void;
  viaName: (id?: number | null) => string;
}) {
  const {
    form,
    setForm,
    errors,
    empresas,
    localidades,
    vias,
    canManageAll,
    userCompanyName,
    showFromOpts,
    setShowFromOpts,
    showToOpts,
    setShowToOpts,
    tapToggle,
    sectionsByVia,
    secLoading,
    ensureSections,
    fromSection,
    toSection,
    setFromSection,
    setToSection,
    viaName,
    locoLockedBy,
  } = props;

  const viaOption = (v: Via) => {
    const secs = sectionsByVia[v.id];
    const anyOcc: boolean | null = Array.isArray(secs) ? secs.some((x) => x.ocupada) : null;

    const label = anyOcc === null ? "—" : anyOcc ? "OCUPADA" : "LIBRE";
    const tone = anyOcc === null ? "text-slate-500" : anyOcc ? "text-rose-600" : "text-emerald-600";

    return (
      <button
        key={v.id}
        onClick={() => setForm((p) => ({ ...p, fromTrack: p.fromTrack === v.id ? null : v.id }))}
        className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
      >
        <span className="truncate">Vía {v.nombre}</span>
        <span className={clsx("ml-3 text-xs font-semibold", tone)}>{label}</span>
      </button>
    );
  };

  const viaOptionTo = (v: Via) => {
    const secs = sectionsByVia[v.id];
    const allOcc: boolean | null = Array.isArray(secs) ? secs.length > 0 && secs.every((x) => x.ocupada) : null;

    const label = allOcc === null ? "—" : allOcc ? "SIN SECC. LIBRES" : "HAY LIBRES";
    const tone = allOcc === null ? "text-slate-500" : allOcc ? "text-rose-600" : "text-emerald-600";

    return (
      <button
        key={v.id}
        onClick={() => setForm((p) => ({ ...p, toTrack: p.toTrack === v.id ? null : v.id }))}
        className={clsx(
          "flex w-full items-center justify-between rounded-md border px-3 py-2 text-left hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800",
          allOcc === true && "opacity-60"
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
    }, [viaId, sectionsByVia, secLoading, ensureSections]);

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
              const color = s.ocupada
                ? "border-rose-500 text-rose-700 dark:text-rose-300"
                : "border-emerald-500 text-emerald-700 dark:text-emerald-300";
              return (
                <button
                  key={s.id}
                  onClick={() => (kind === "from" ? setFromSection(s) : setToSection(active ? undefined : s.numero))}
                  className={clsx(
                    "rounded-full border px-3 py-1 text-xs font-semibold",
                    color,
                    active && (s.ocupada ? "bg-rose-600 text-white" : "bg-emerald-600 text-white")
                  )}
                >
                  #{s.numero}
                  {s.nombre ? ` · ${s.nombre}` : ""}
                  {s.ocupada ? " · OCUP" : ""}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const empresaLabel =
    empresas.find((e) => e.id === form.empresaId)?.nombre ||
    userCompanyName ||
    (Number.isFinite(Number(form.empresaId)) ? `ID ${form.empresaId}` : "");

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {/* Empresa */}
      {canManageAll ? (
        <Select
          label="Empresa"
          value={form.empresaId ?? ""}
          onChange={(v) => setForm((p) => ({ ...p, empresaId: v ? Number(v) : null }))}
          options={empresas.map((e) => ({ label: e.nombre, value: String(e.id) }))}
          error={errors.empresaId}
        />
      ) : (
        <Field label="Empresa" value={empresaLabel} disabled />
      )}

      {/* Localidad */}
      {canManageAll ? (
        <Select
          label="Localidad"
          value={form.selectedLocalityId ?? ""}
          onChange={(v) => setForm((p) => ({ ...p, selectedLocalityId: v ? Number(v) : null, fromTrack: null, toTrack: null }))}
          options={localidades.map((l) => ({ label: l.nombre, value: String(l.id) }))}
          error={errors.selectedLocalityId}
        />
      ) : (
        <Field
          label="Localidad"
          value={localidades.find((l) => l.id === form.selectedLocalityId)?.nombre || (form.selectedLocalityId ? `ID ${form.selectedLocalityId}` : "")}
          disabled
          error={errors.selectedLocalityId}
        />
      )}

      {/* Servicio */}
      <div className="sm:col-span-2">
        <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Servicio</span>
        <div className="flex gap-2">
          {(["Lavado", "Torno"] as const).map((svc) => {
            const active = form.service === svc;
            return (
              <button
                key={svc}
                onClick={() =>
                  tapToggle(
                    `svc:${svc}`,
                    () => setForm((p) => ({ ...p, service: svc, toTrack: null })),
                    () => setForm((p) => ({ ...p, service: "", toTrack: p.toTrack }))
                  )
                }
                className={clsx(
                  "rounded-md border px-3 py-2 text-sm",
                  active
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300"
                    : "hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                )}
              >
                {svc}
              </button>
            );
          })}
          {form.service ? <span className="self-center text-xs text-slate-500 dark:text-slate-400">Doble clic para desmarcar</span> : null}
        </div>
      </div>

      {/* Prioridad + Loco */}
      <label className="mb-3 mt-1 flex items-center gap-2">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 dark:border-slate-700"
          checked={form.priority}
          onChange={(e) => setForm((p) => ({ ...p, priority: e.target.checked }))}
        />
        <span className="text-sm text-slate-700 dark:text-slate-200">Prioridad alta</span>
      </label>
      <Field
        label="Número de locomotora"
        type="number"
        value={form.locomotiveNumber ? String(form.locomotiveNumber) : ""}
        onChange={(e) => setForm((p) => ({ ...p, locomotiveNumber: Number(e.target.value) || 0 }))}
        className={locoLockedBy ? "opacity-70" : ""}
        disabled={!!locoLockedBy}
        error={errors.locomotiveNumber}
      />

      {/* Vía origen */}
      <div className="sm:col-span-2">
        <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">De vía</span>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setShowFromOpts((v) => !v);
              if (form.fromTrack) ensureSections(form.fromTrack);
            }}
            className="min-w-[220px] rounded-md border px-3 py-2 text-left hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            {form.fromTrack ? `Vía ${viaName(form.fromTrack)}` : "Selecciona una vía"}
          </button>
          {errors.fromTrack ? <span className="self-center text-xs text-rose-600 dark:text-rose-400">{errors.fromTrack}</span> : null}
        </div>

        {showFromOpts && (
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {vias.map((v) => (
              <div key={v.id}>{viaOption(v)}</div>
            ))}
          </div>
        )}

        <SectionsPills kind="from" viaId={form.fromTrack} />
      </div>

      {/* Vía destino */}
      {!form.service && (
        <div className="sm:col-span-2">
          <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Para vía</span>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setShowToOpts((v) => !v);
                if (form.toTrack) ensureSections(form.toTrack);
              }}
              className="min-w-[220px] rounded-md border px-3 py-2 text-left hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              {form.toTrack ? `Vía ${viaName(form.toTrack)}` : "Selecciona una vía"}
            </button>
            {errors.toTrack ? <span className="self-center text-xs text-rose-600 dark:text-rose-400">{errors.toTrack}</span> : null}
          </div>

          {showToOpts && (
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {vias.map((v) => (
                <div key={v.id}>{viaOptionTo(v)}</div>
              ))}
            </div>
          )}

          <SectionsPills kind="to" viaId={form.toTrack} />
        </div>
      )}
    </div>
  );
}

/** ------ Step 2 ------ */
function StepTwo({
  form,
  setForm,
  errors,
  isService,
}: {
  form: MovementFormData;
  setForm: React.Dispatch<React.SetStateAction<MovementFormData>>;
  errors: Record<string, string>;
  isService: boolean;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Select
        label="Tipo de movimiento"
        value={form.movementType}
        onChange={(v) => setForm((p) => ({ ...p, movementType: v as any }))}
        options={[
          { label: "MD Trabajando", value: "MD_TRABAJANDO" },
          { label: "Remolcada", value: "REMOLCADA" },
        ]}
        error={errors.movementType}
      />

      {!isService && (
        <>
          <Select
            label="Posición de cabina"
            value={form.cabinPosition}
            onChange={(v) => setForm((p) => ({ ...p, cabinPosition: v as any }))}
            options={[
              { label: "Dentro", value: "DENTRO" },
              { label: "Afuera", value: "AFUERA" },
            ]}
            error={errors.cabinPosition}
          />
          <Select
            label="Posición de chimenea"
            value={form.chimneyPosition}
            onChange={(v) => setForm((p) => ({ ...p, chimneyPosition: v as any, posicionChimenea: v as any }))}
            options={[
              { label: "Dentro", value: "DENTRO" },
              { label: "Afuera", value: "AFUERA" },
            ]}
            error={errors.chimneyPosition}
          />
        </>
      )}

      {form.movementType === "REMOLCADA" && (
        <Select
          label="Dirección (remolcada)"
          value={form.direccionEmpuje}
          onChange={(v) => setForm((p) => ({ ...p, direccionEmpuje: v as Direccion, pushPull: v as any }))}
          options={[
            { label: "Empujar", value: "EMPUJAR" },
            { label: "Jalar", value: "JALAR" },
          ]}
          error={errors.direccionEmpuje}
        />
      )}
    </div>
  );
}

/** ------ Step 3 ------ */
function StepThree({
  form,
  setForm,
  sending,
  submit,
  fromSection,
  toSection,
  viaName,
}: {
  form: MovementFormData;
  setForm: React.Dispatch<React.SetStateAction<MovementFormData>>;
  sending: boolean;
  submit: () => void;
  fromSection?: number;
  toSection?: number;
  viaName: (id?: number | null) => string;
}) {
  return (
    <div className="grid gap-4">
      <div className="rounded-lg border p-3 text-sm dark:border-slate-700">
        <div className="font-semibold mb-2 text-slate-800 dark:text-slate-100">Resumen</div>
        <ul className="grid gap-1 text-slate-700 dark:text-slate-300">
          <li>Localidad: {form.selectedLocalityId ?? "—"}</li>
          <li>
            Origen: {form.fromTrack ? `Vía ${viaName(form.fromTrack)} ${fromSection ? `(Sección #${fromSection})` : ""}` : "—"}
          </li>
          {!form.service && (
            <li>
              Destino: {form.toTrack ? `Vía ${viaName(form.toTrack)} ${toSection ? `(Sección #${toSection})` : ""}` : "—"}
            </li>
          )}
          <li>Locomotora: {form.locomotiveNumber || "—"}</li>
          <li>Tipo: {form.movementType || "—"}</li>
          <li>Prioridad: {form.priority ? "ALTA" : "BAJA"}</li>
          <li>Servicio: {form.service || "—"}</li>
          <li>Inicio: {fmtLocalDateTime(form.fechaInicio)}</li>
        </ul>
      </div>

      <label className="mb-3 block">
        <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Comentarios / instrucciones</span>
        <textarea
          rows={6}
          className={clsx(inputBase, "min-h-[120px]")}
          value={form.comments}
          onChange={(e) => setForm((p) => ({ ...p, comments: e.target.value }))}
          placeholder="Escribe comentarios; agregaremos las secciones seleccionadas automáticamente."
        />
        {(fromSection || toSection) && (
          <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
            Se añadirá: {fromSection ? `[SECCION_ORIGEN:${fromSection}] ` : ""}
            {toSection ? `[SECCION_DESTINO:${toSection}]` : ""}
          </span>
        )}
      </label>

      <button
        onClick={submit}
        disabled={sending}
        className="inline-flex items-center justify-center rounded-md bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {sending ? "Enviando..." : "Confirmar solicitud"}
      </button>
    </div>
  );
}
