/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";

/** ======= CONFIG ======= */
const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || "/xapi";
const SECC_BASE = `${API_BASE}/secciones/secciones`;
const DRAFT_KEY = "movement_draft_v3";
const OUTBOX_KEY = "movement_outbox_v1";
const DOUBLE_TAP_MS = 250;
const FETCH_TIMEOUT_MS = 12000;
const FLUSH_INTERVAL_MS = 15000;

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
const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const toInputDT = (iso?: string) => {
  const d = iso ? new Date(iso) : new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};
const fromInputDT = (v: string) => (v ? new Date(v).toISOString() : new Date().toISOString());

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

function useVisibleInterval(cb: () => void, ms: number | null) {
  useEffect(() => {
    if (!ms) return;
    const id = window.setInterval(() => { if (document.visibilityState === "visible") cb(); }, ms);
    const onVis = () => document.visibilityState === "visible" && cb();
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
  }, [cb, ms]);
}

/** ======= ESTILOS (mobile-first) ======= */
const inputBase =
  "w-full rounded-md border px-3 py-3 min-h-[48px] text-base sm:text-sm outline-none transition-colors " +
  "bg-white text-slate-900 placeholder-slate-400 border-slate-300 focus:border-sky-500 " +
  "dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-500 dark:border-slate-700 dark:focus:border-sky-500";
const chipBase = "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium";

/** ======= COMPONENTE ======= */
export default function CrearMovimiento() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [form, setForm] = useState<MovementFormData>(baseInitialForm);
  const [sending, setSending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);

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

  // UI / selección
  const [showFromOpts, setShowFromOpts] = useState(false);
  const [showToOpts, setShowToOpts] = useState(false);
  const lastTap = useRef<Record<string, number>>({});
  const [fromSection, setFromSection] = useState<number | undefined>(undefined);
  const [toSection, setToSection] = useState<number | undefined>(undefined);
  const [locoLockedBy, setLocoLockedBy] = useState<{ movimientoId: number; viaId: number; numero: number } | null>(null);

  // online / outbox
  const [online, setOnline] = useState<boolean>(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [pendingCount, setPendingCount] = useState<number>(0);

  /** Init sesión + defaults */
  const initFormLocked = useCallback(() => {
    const roleCookie = String(getCookie("role") || "").trim().toUpperCase();
    if (roleCookie) setRol(roleCookie as Rol);

    const locCookie = Number(getCookie("locId") || NaN);
    const uRaw = typeof window !== "undefined" ? localStorage.getItem("user") : null;
    let u: any = null;
    try { u = uRaw ? JSON.parse(uRaw) : null; } catch { }
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

    setForm((prev) => ({ ...base, selectedLocalityId: selectedLocalityId ?? prev.selectedLocalityId ?? null }));
  }, [ADMIN_OR_COORD]);

  /** IDs finales */
  const resolvedIds = useMemo(() => {
    const empresaId = Number(form.empresaId ?? user?.empresaId ?? user?.empresa?.id ?? NaN);
    const creadoPorId = Number(form.creadoPorId ?? user?.id ?? NaN);
    const localidadId = Number(form.selectedLocalityId ?? Number(getCookie("locId") || NaN));
    return { empresaId, creadoPorId, localidadId };
  }, [form.empresaId, form.creadoPorId, form.selectedLocalityId, user]);

  /** Cargar combos + draft + outbox */
  useEffect(() => {
    initFormLocked();
    (async () => {
      try {
        const [e, l] = await Promise.all([fetchJSON(`${API_BASE}/empresas`).catch(() => []), fetchJSON(`${API_BASE}/localidades`).catch(() => [])]);
        const eList: Empresa[] = Array.isArray(e) ? e : [];
        const lList: Localidad[] = Array.isArray(l) ? l : [];
        setEmpresas(eList);
        setLocalidades(lList);
        setForm((p) => {
          let empresaId = p.empresaId ?? (user?.empresaId ?? user?.empresa?.id ?? null);
          if (!Number.isFinite(Number(empresaId)) && eList.length === 1) empresaId = eList[0].id;
          let localidadId = p.selectedLocalityId;
          const canAll = ADMIN_OR_COORD.includes(String(getCookie("role") || "").toUpperCase());
          if (!Number.isFinite(Number(localidadId)) && !canAll && lList.length === 1) localidadId = lList[0].id;
          return { ...p, empresaId: Number(empresaId) || p.empresaId, selectedLocalityId: (Number(localidadId) || p.selectedLocalityId) ?? null };
        });
      } catch { }

      try {
        const raw = typeof window !== "undefined" ? localStorage.getItem(DRAFT_KEY) : null;
        if (raw) {
          const d = JSON.parse(raw);
          setForm((p) => ({ ...p, ...d.form }));
          setFromSection(d.fromSection);
          setToSection(d.toSection);
          setLocoLockedBy(d.locoLockedBy || null);
        }
      } catch { }

      try {
        const q = JSON.parse(localStorage.getItem(OUTBOX_KEY) || "[]");
        setPendingCount(Array.isArray(q) ? q.length : 0);
      } catch { }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initFormLocked]);

  /** Enforce cliente localidad fija si aplica */
  useEffect(() => {
    const roleCookie = String(getCookie("role") || "").trim().toUpperCase();
    if (roleCookie) setRol(roleCookie as Rol);
    if (!canManageAll) {
      const locCookie = Number(getCookie("locId") || NaN);
      setForm((p) => ({ ...p, selectedLocalityId: Number.isFinite(locCookie) ? locCookie : p.selectedLocalityId }));
    }
  }, [canManageAll]);

  /** Draft autosave */
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const payload = { form, fromSection, toSection, locoLockedBy };
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(payload)); } catch { } }, 350);
    return () => { if (draftTimer.current) clearTimeout(draftTimer.current); };
  }, [form, fromSection, toSection, locoLockedBy]);

  /** Online + Outbox */
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  const flushOutbox = useCallback(async () => {
    if (!online) return;
    let q: any[] = [];
    try { q = JSON.parse(localStorage.getItem(OUTBOX_KEY) || "[]"); } catch { }
    if (!Array.isArray(q) || q.length === 0) return;

    const keep: any[] = [];
    for (const item of q) {
      try {
        const res = await fetchWithTimeout(`${API_BASE}/movimientos`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", Accept: "application/json", ...tokenHeader() },
          body: JSON.stringify(item.payload),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } catch { keep.push(item); }
    }
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(keep));
    setPendingCount(keep.length);
    if (keep.length === 0) { setBanner("Todos los envíos pendientes fueron sincronizados."); setTimeout(() => setBanner(null), 2500); }
  }, [online]);
  useVisibleInterval(flushOutbox, online ? FLUSH_INTERVAL_MS : null);

  /** Vías por localidad */
  useEffect(() => {
    (async () => {
      if (!form.selectedLocalityId) { setVias([]); return; }
      try {
        const data = await fetchJSON(`${API_BASE}/vias/localidad/${form.selectedLocalityId}`);
        const list: Via[] = (data || []).map((v: any) => ({ id: v.id, nombre: v.nombre }));
        list.sort((a, b) => String(a.nombre).localeCompare(String(b.nombre)));
        setVias(list);
      } catch { setVias([]); }
    })();
  }, [form.selectedLocalityId]);

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
    } catch { setSectionsByVia((m) => ({ ...m, [viaId]: [] })); }
    finally {
      secLoadingRef.current[viaId] = false;
      setSecLoading((s) => ({ ...s, [viaId]: false }));
    }
  }, [sectionsByVia]);

  useEffect(() => {
    setFromSection(undefined);
    setLocoLockedBy(null);
    if (form.fromTrack) ensureSections(form.fromTrack);
  }, [form.fromTrack, ensureSections]);

  useEffect(() => {
    setToSection(undefined);
    if (form.toTrack) ensureSections(form.toTrack);
  }, [form.toTrack, ensureSections]);

  /** Helpers */
  const tapToggle = (key: string, onSingle: () => void, onDouble: () => void) => {
    const now = Date.now();
    const last = lastTap.current[key] || 0;
    if (now - last < DOUBLE_TAP_MS) onDouble(); else onSingle();
    lastTap.current[key] = now;
  };
  const viaName = (id?: number | null) => (id ? vias.find((v) => v.id === id)?.nombre || "" : "");
  const isService = !!form.service;

  /** Seleccionar sección origen (precarga loco si ocupada) */
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
          const loco = Number((mov as any)?.locomotiveNumber ?? 0);
          if (loco > 0) {
            setForm((p) => ({ ...p, locomotiveNumber: loco }));
            setLocoLockedBy({ movimientoId: s.movimientoId!, viaId: form.fromTrack!, numero: s.numero });
          }
        } catch { }
      }
    } else {
      if (locoLockedBy && locoLockedBy.viaId === form.fromTrack && locoLockedBy.numero === s.numero) setLocoLockedBy(null);
    }
  };

  /** Validaciones */
  const validate1 = () => {
    const e: Record<string, string> = {};
    const { empresaId, localidadId } = resolvedIds;
    if (canManageAll && !Number.isFinite(empresaId)) e.empresaId = "Selecciona empresa.";
    if (canManageAll && !Number.isFinite(localidadId)) e.selectedLocalityId = "Selecciona localidad.";
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

  /** OUTBOX helper */
  const pushOutbox = (payload: any) => {
    let q: any[] = [];
    try { q = JSON.parse(localStorage.getItem(OUTBOX_KEY) || "[]"); } catch { }
    const item = { id: `${Date.now()}_${Math.random().toString(36).slice(2)}`, payload, createdAt: Date.now() };
    const next = [...(Array.isArray(q) ? q : []), item];
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(next));
    setPendingCount(next.length);
    setBanner("Sin conexión: la solicitud quedó en cola y se enviará automáticamente.");
    setTimeout(() => setBanner(null), 3500);
  };

  /** Submit (con offline y asignación de sección) */
  const submit = useCallback(async () => {
    const { empresaId, creadoPorId, localidadId } = resolvedIds;

    if (!Number.isFinite(empresaId) || !Number.isFinite(creadoPorId) || !Number.isFinite(localidadId)) {
      alert("Faltan IDs requeridos (empresa, usuario o localidad).");
      return;
    }
    if (!form.fromTrack || !form.locomotiveNumber) {
      alert("Faltan vía de origen o número de locomotora.");
      return;
    }

    const only = <T extends object>(cond: boolean, obj: T) => (cond ? obj : {});

    const payload = {
      empresaId: Number(empresaId),
      creadoPorId: Number(creadoPorId),
      localidadId: Number(localidadId),
      viaOrigenId: Number(form.fromTrack),
      locomotiveNumber: Number(form.locomotiveNumber),
      prioridad: form.priority ? "ALTA" : "BAJA",

      // opcionales
      ...only(!!form.toTrack && !isService, { viaDestinoId: Number(form.toTrack) }), // permite iguales si tu backend ya lo acepta
      ...only(typeof fromSection === "number", { numeroSeccion: Number(fromSection) }),
      ...only(!!form.comments.trim(), { instrucciones: form.comments.trim() }),

      // 👇 nombres que Prisma sí espera
      tipoMovimiento: ["MD_TRABAJANDO", "REMOLCADA"].includes(form.movementType) ? form.movementType : null,
      direccionEmpuje:
        form.movementType === "REMOLCADA" && ["EMPUJAR", "JALAR"].includes(form.direccionEmpuje || "")
          ? (form.direccionEmpuje as "EMPUJAR" | "JALAR")
          : "Sin_Solicitar",
      posicionCabina: !isService && ["DENTRO", "AFUERA"].includes(form.cabinPosition) ? form.cabinPosition : "Sin_Solicitar",
      posicionChimenea: !isService && ["DENTRO", "AFUERA"].includes(form.chimneyPosition) ? form.chimneyPosition : "Sin_Solicitar",

      // servicio como flags
      ...only(form.service === "Lavado", { lavado: true }),
      ...only(form.service === "Torno", { torno: true }),

    };


    const roleToPath = (r?: string) => {
      const R = String(r || "").toUpperCase();
      if (R === "COORDINADOR") return "/coordinador/movimientos";
      if (R === "ADMINISTRADOR") return "/administrador/movimientos";
      if (R === "SUPERVISOR") return "/supervisor/movimientos";
      return "/cliente/movimientos";
    };

    try {
      setSending(true);
      const res = await fetchWithTimeout(`${API_BASE}/movimientos`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json", ...tokenHeader() },
        body: JSON.stringify(payload),
      });

      const txt = await res.text();
      if (!res.ok) {
        // intenta mostrar detalle legible
        try { const j = JSON.parse(txt); alert(j.message || j.error || txt); }
        catch { alert(txt || `HTTP ${res.status}`); }
        return;
      }

      const created = txt ? safeJSON(txt) : {};
      const movimientoId = Number((created as any)?.id || 0);

      if (movimientoId && form.fromTrack && typeof fromSection === "number") {
        await fetchWithTimeout(`${API_BASE}/secciones/via/${form.fromTrack}/asignar`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", ...tokenHeader() },
          body: JSON.stringify({ numero: Number(fromSection), movimientoId }),
        }).catch(() => { });
      }

      try { localStorage.removeItem(DRAFT_KEY); } catch { }
      setFromSection(undefined);
      setToSection(undefined);
      setLocoLockedBy(null);
      setStep(1);

      window.location.assign(roleToPath(rol));
    } catch (e: any) {
      alert(e?.message || "Error al crear movimiento");
    } finally {
      setSending(false);
    }
  }, [resolvedIds, form, isService, fromSection, rol]);

  /** Progreso */
  const STEP_CFG = [
    { label: "Paso 1 de 3", percent: 33 },
    { label: "Paso 2 de 3", percent: 66 },
    { label: "Paso 3 de 3", percent: 100 },
  ] as const;
  const { label, percent } = STEP_CFG[step - 1];

  const lockedClienteMissingData = !canManageAll && !Number.isFinite(Number(getCookie("locId") || NaN));

  // Acceso rápido enviar
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "enter" && step === 3 && !sending) {
        e.preventDefault();
        submit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, sending, submit]);

  const goSalir = () => window.location.assign("/cliente/movimientos");

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Hace grandes los selects en celular */}
      <style jsx global>{`
        @media (max-width: 640px) {
          select, select option { font-size: 16px !important; line-height: 1.45 !important; }
          select { min-height: 48px !important; }
        }import { useLocalStorage } from '../../hooks/useLocalStorage';

      `}</style>

      {/* Grid de fondo que hereda del layout */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.05)_1px,transparent_1px)] bg-[size:24px_24px] dark:opacity-[0.07]"
      />
      <div className="relative z-10">

        {/* Estado conexión / outbox + Salir */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge tone={online ? "ok" : "error"}>{online ? "En línea" : "Sin conexión"}</Badge>
          {pendingCount > 0 && (
            <>
              <Badge tone="warn">{pendingCount} pendiente(s)</Badge>
              <button onClick={flushOutbox} className="rounded-md border px-3 py-1 text-xs hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                Enviar pendientes
              </button>
              <button onClick={() => { localStorage.removeItem(OUTBOX_KEY); setPendingCount(0); }} className="rounded-md border px-3 py-1 text-xs hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                Vaciar cola
              </button>
            </>
          )}
          {banner && <span className="text-xs text-slate-600 dark:text-slate-300">{banner}</span>}
          <button onClick={goSalir} className="ml-auto rounded-md border border-red-500 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:border-red-500 dark:text-red-400 dark:hover:bg-red-900/20" title="Volver a mis movimientos">
            Salir
          </button>
        </div>

        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Nuevo Movimiento <span className="text-slate-500 dark:text-slate-400">({label})</span>
        </h1>

        {!canManageAll && (
          <div className="mt-3 rounded-lg border-l-4 border-sky-400 bg-sky-50 p-3 text-sm dark:border-sky-600 dark:bg-sky-900/20">
            <div className="font-medium text-sky-800 dark:text-sky-200">CLIENTE</div>
            {lockedClienteMissingData && <div className="mt-2 text-rose-700 dark:text-rose-300">No se encontró una sesión activa. Por favor inicia sesión nuevamente.</div>}
          </div>
        )}

        {/* barra progreso */}
        <div className="mt-3 h-2 w-full rounded bg-slate-200 dark:bg-slate-800" aria-label="Progreso">
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
              setShowEmpresaOpts={() => { }}
              showLocOpts={false}
              setShowLocOpts={() => { }}
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
          {step === 3 && <StepThree form={form} setForm={setForm} sending={sending} submit={submit} fromSection={fromSection} toSection={toSection} viaName={viaName} />}
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            onClick={() => {
              try { localStorage.removeItem(DRAFT_KEY); } catch { }
              setForm((prev) => ({ ...baseInitialForm, selectedLocalityId: canManageAll ? null : prev.selectedLocalityId }));
              setFromSection(undefined);
              setToSection(undefined);
              setErrors({});
              // Cerrar desplegables de vías si están abiertos
              setShowFromOpts(false);
              setShowToOpts(false);
              // Si está en el paso 3, volver al paso 1
              if (step === 3) setStep(1);
            }}
            className="rounded-md border px-4 py-2 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Limpiar
          </button>

          {step > 1 && (
            <button onClick={() => setStep((s) => (s === 1 ? 1 : ((s - 1) as 1 | 2 | 3)))} className="rounded-md border border-amber-500 px-4 py-2 text-amber-700 hover:bg-amber-50 dark:border-amber-500 dark:text-amber-400 dark:hover:bg-amber-900/20">
              Anterior
            </button>
          )}
          {step < 3 && (
            <button
              onClick={() => { if (step === 1 && !validate1()) return; if (step === 2 && !validate2()) return; setStep((s) => ((s + 1) as 1 | 2 | 3)); }}
              className="rounded-md bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700"
            >
              Siguiente
            </button>
          )}

          <button onClick={goSalir} className="ml-auto rounded-md border border-red-500 px-4 py-2 text-red-600 hover:bg-red-50 dark:border-red-500 dark:text-red-400 dark:hover:bg-red-900/20" title="Volver a mis movimientos">
            Salir
          </button>
        </div>

        {locoLockedBy ? (
          <div className="mt-4 rounded-lg border-l-4 border-sky-400 bg-sky-50 p-3 text-sm dark:border-sky-600 dark:bg-sky-900/20">
            <div className="font-semibold text-sky-800 dark:text-sky-200">
              Locomotora bloqueada por sección #{locoLockedBy.numero} (movimiento #{locoLockedBy.movimientoId}).
            </div>
            <button onClick={() => setLocoLockedBy(null)} className="mt-2 rounded-md border px-3 py-1 text-xs hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
              Quitar vinculación
            </button>
          </div>
        ) : null}
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
  options: Option[];
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
    form, setForm, errors, empresas, localidades, vias, canManageAll, userCompanyName,
    showFromOpts, setShowFromOpts, showToOpts, setShowToOpts, tapToggle, sectionsByVia, secLoading,
    ensureSections, fromSection, toSection, setFromSection, setToSection, viaName, locoLockedBy
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
              const color = s.ocupada ? "border-rose-500 text-rose-700 dark:text-rose-300" : "border-emerald-500 text-emerald-700 dark:text-emerald-300";
              return (
                <button
                  key={s.id}
                  onClick={() => (kind === "from" ? setFromSection(s) : setToSection(active ? undefined : s.numero))}
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

  const empresaLabel =
    empresas.find((e) => e.id === form.empresaId)?.nombre ||
    userCompanyName || (Number.isFinite(Number(form.empresaId)) ? `ID ${form.empresaId}` : "");

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
        <div className="flex flex-wrap gap-2">
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
                  active ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300"
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
        inputMode="numeric"
        pattern="[0-9]*"
        value={form.locomotiveNumber ? String(form.locomotiveNumber) : ""}
        onChange={(e) => setForm((p) => ({ ...p, locomotiveNumber: Math.max(0, Number(e.target.value) || 0) }))}
        className={locoLockedBy ? "opacity-70" : ""}
        disabled={!!locoLockedBy}
        error={errors.locomotiveNumber}
      />

      {/* Vía origen */}
      <div className="sm:col-span-2">
        <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">De vía</span>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowFromOpts(!showFromOpts); if (form.fromTrack) ensureSections(form.fromTrack); }}
            className="min-w-[220px] rounded-md border px-3 py-2 text-left hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            {form.fromTrack ? `Vía ${viaName(form.fromTrack)}` : "Selecciona una vía"}
          </button>
          {errors.fromTrack ? <span className="self-center text-xs text-rose-600 dark:text-rose-400">{errors.fromTrack}</span> : null}
        </div>

        {showFromOpts && <div className="mt-2 grid gap-2 sm:grid-cols-2">{vias.map((v) => (<div key={v.id}>{viaOption(v)}</div>))}</div>}

        <SectionsPills kind="from" viaId={form.fromTrack} />
      </div>

      {/* Vía destino */}
      {!form.service && (
        <div className="sm:col-span-2">
          <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Para vía</span>
          <div className="flex gap-2">
            <button
              onClick={() => { setShowToOpts(!showToOpts); if (form.toTrack) ensureSections(form.toTrack); }}
              className="min-w-[220px] rounded-md border px-3 py-2 text-left hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              {form.toTrack ? `Vía ${viaName(form.toTrack)}` : "Selecciona una vía"}
            </button>
            {errors.toTrack ? <span className="self-center text-xs text-rose-600 dark:text-rose-400">{errors.toTrack}</span> : null}
          </div>

          {showToOpts && <div className="mt-2 grid gap-2 sm:grid-cols-2">{vias.map((v) => (<div key={v.id}>{viaOptionTo(v)}</div>))}</div>}

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
  const Card = ({
    active,
    label,
    onClick,
  }: {
    active: boolean;
    label: string;
    onClick: () => void;
  }) => (
    <button
      onClick={onClick}
      className={clsx(
        "flex w-full items-center justify-between rounded-md border px-3 py-3 text-left",
        "hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800",
        active && "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
      )}
    >
      <span className="font-medium">{label}</span>
      <span
        className={clsx(
          "ml-3 rounded-full px-2 py-0.5 text-xs",
          active ? "border border-emerald-500 text-emerald-700 dark:text-emerald-300" : "border border-slate-300 text-slate-500"
        )}
      >
        {active ? "Seleccionado" : "Elegir"}
      </span>
    </button>
  );

  return (
    <div className="grid gap-6">
      {/* Tipo de movimiento */}
      <div>
        <div className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-200">Tipo de movimiento</div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Card
            label="MD Trabajando"
            active={form.movementType === "MD_TRABAJANDO"}
            onClick={() => setForm((p) => ({ ...p, movementType: "MD_TRABAJANDO" }))}
          />
          <Card
            label="Remolcada"
            active={form.movementType === "REMOLCADA"}
            onClick={() => setForm((p) => ({ ...p, movementType: "REMOLCADA" }))}
          />
        </div>
        {errors.movementType && <div className="mt-1 text-xs text-rose-600">{errors.movementType}</div>}
      </div>

      {/* Posiciones (solo si NO es servicio) */}
      {!isService && (
        <>
          <div>
            <div className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-200">Posición de cabina</div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Card
                label="Dentro"
                active={form.cabinPosition === "DENTRO"}
                onClick={() => setForm((p) => ({ ...p, cabinPosition: "DENTRO" }))}
              />
              <Card
                label="Afuera"
                active={form.cabinPosition === "AFUERA"}
                onClick={() => setForm((p) => ({ ...p, cabinPosition: "AFUERA" }))}
              />
            </div>
            {errors.cabinPosition && <div className="mt-1 text-xs text-rose-600">{errors.cabinPosition}</div>}
          </div>

          <div>
            <div className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-200">Posición de chimenea</div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Card
                label="Dentro"
                active={form.chimneyPosition === "DENTRO"}
                onClick={() => setForm((p) => ({ ...p, chimneyPosition: "DENTRO", posicionChimenea: "DENTRO" }))}
              />
              <Card
                label="Afuera"
                active={form.chimneyPosition === "AFUERA"}
                onClick={() => setForm((p) => ({ ...p, chimneyPosition: "AFUERA", posicionChimenea: "AFUERA" }))}
              />
            </div>
            {errors.chimneyPosition && <div className="mt-1 text-xs text-rose-600">{errors.chimneyPosition}</div>}
          </div>
        </>
      )}

      {/* Dirección (solo si Remolcada) */}
      {form.movementType === "REMOLCADA" && (
        <div>
          <div className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-200">Dirección (remolcada)</div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Card
              label="Empujar"
              active={form.direccionEmpuje === "EMPUJAR"}
              onClick={() => setForm((p) => ({ ...p, direccionEmpuje: "EMPUJAR", pushPull: "EMPUJAR" }))}
            />
            <Card
              label="Jalar"
              active={form.direccionEmpuje === "JALAR"}
              onClick={() => setForm((p) => ({ ...p, direccionEmpuje: "JALAR", pushPull: "JALAR" }))}
            />
          </div>
          {errors.direccionEmpuje && <div className="mt-1 text-xs text-rose-600">{errors.direccionEmpuje}</div>}
        </div>
      )}
    </div>
  );
}


/** ------ Step 3 ------ */
function StepThree({
  form, setForm, sending, submit, fromSection, toSection, viaName,
}: { form: MovementFormData; setForm: React.Dispatch<React.SetStateAction<MovementFormData>>; sending: boolean; submit: () => void; fromSection?: number; toSection?: number; viaName: (id?: number | null) => string; }) {
  const sectionHint = (fromSection ? `[SECCION_ORIGEN:${fromSection}] ` : "") + (toSection ? `[SECCION_DESTINO:${toSection}]` : "");
  const showHint = Boolean(fromSection || toSection);

  return (
    <div className="grid gap-4">
      <div className="rounded-lg border p-3 text-sm dark:border-slate-700">
        <div className="font-semibold mb-2 text-slate-800 dark:text-slate-100">Resumen</div>
        <ul className="grid gap-1 text-slate-700 dark:text-slate-300">
          <li>Localidad: {form.selectedLocalityId ?? "—"}</li>
          <li>Origen: {form.fromTrack ? `Vía ${viaName(form.fromTrack)} ${fromSection ? `(Sección #${fromSection})` : ""}` : "—"}</li>
          {!form.service && <li>Destino: {form.toTrack ? `Vía ${viaName(form.toTrack)} ${toSection ? `(Sección #${toSection})` : ""}` : "—"}</li>}
          <li>Locomotora: {form.locomotiveNumber || "—"}</li>
          <li>Tipo: {form.movementType || "—"}</li>
          <li>Dirección: {form.direccionEmpuje || "—"}</li>
          <li>Prioridad: {form.priority ? "ALTA" : "BAJA"}</li>
          <li>Servicio: {form.service || "—"}</li>
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
        {showHint && <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">Se añadirá: {sectionHint.trim()}</span>}
      </label>

      <button onClick={submit} disabled={sending} className="inline-flex items-center justify-center rounded-md bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60" title="Ctrl/Cmd + Enter para enviar">
        {sending ? "Enviando..." : "Confirmar solicitud"}
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
