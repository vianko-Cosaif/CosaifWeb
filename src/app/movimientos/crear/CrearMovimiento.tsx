/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useMounted } from "@/app/hooks/useMounted";
import { getInitialTheme, applyTheme, onThemeChange } from "@/lib/theme";
import { Movimiento } from './../Movimiento'; // <--- Único import
import { API_BASE, SECC_BASE, DOUBLE_TAP_MS, FLUSH_INTERVAL_MS, DRAFT_KEY, OUTBOX_KEY, ALTA_PASSWORDS, Servicio, roleBase, Rol, Via, Empresa, Localidad, Seccion, MovementFormData, baseInitialForm
 } from './../movimientos.shared'; // <--- Único import

/** ======= RESOLVER ROL (cookie → localStorage) ======= */
function getRoleClient(): Rol {
  const c = String(Movimiento.getCookie("role") || "").trim().toUpperCase();
  if (c) return c as Rol;
  try {
    const raw = localStorage.getItem("user");
    if (raw) {
      const u = JSON.parse(raw);
      const r = String(u?.rol || u?.role || "").toUpperCase();
      if (r) return r as Rol;
    }
  } catch {}
  return "CLIENTE";
}

/** ======= ESTILOS ======= */
const inputBase =
  "w-full rounded-md border px-3 py-3 min-h-[48px] text-base sm:text-sm outline-none transition-colors " +
  "bg-white text-slate-900 placeholder-slate-400 border-slate-300 focus:border-sky-500 " +
  "dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-500 dark:border-slate-700 dark:focus:border-sky-500";
const chipBase = "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium";

/** ======= COMPONENTE ======= */
export default function CrearMovimiento() {
  const mounted = useMounted();
  
  // Manejo del tema
  useEffect(() => {
    if (!mounted) return;
    const initial = getInitialTheme();
    applyTheme(initial, { persist: false });
    
    // Sincronizar cambios de tema entre pestañas
    const unsubscribe = onThemeChange((newTheme) => {
      applyTheme(newTheme, { persist: false });
    });
    
    return () => unsubscribe();
  }, [mounted]);
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
  const [selectionMode, setSelectionMode] = useState<"de_via" | "para_via">("de_via");
  const lastTap = useRef<Record<string, number>>({});
  const [fromSection, setFromSection] = useState<number | undefined>(undefined);
  const [toSection, setToSection] = useState<number | undefined>(undefined);
  const [locoLockedBy, setLocoLockedBy] = useState<{ movimientoId: number; viaId: number; numero: number } | null>(null);

  // online / outbox
  const [online, setOnline] = useState<boolean>(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [pendingCount, setPendingCount] = useState<number>(0);

  /** Inicializa según rol y sesión */
  const initFormLocked = useCallback(() => {
    const role = getRoleClient();
    setRol(role);

    const locCookie = Number(Movimiento.getCookie("locId") || NaN);

    const uRaw = typeof window !== "undefined" ? localStorage.getItem("user") : null;
    let u: any = null;
    try { u = uRaw ? JSON.parse(uRaw) : null; } catch {}
    setUser(u || null);
    setUserCompanyName(u?.empresa?.nombre || "");

    const isAdminOrCoord = ["ADMINISTRADOR", "COORDINADOR"].includes(String(role).toUpperCase());

    const base: MovementFormData = {
      ...baseInitialForm,
      creadoPorId: u?.id ?? null,
      clienteId: u?.id ?? null,
      empresaId: isAdminOrCoord ? null : (Number.isFinite(Number(u?.empresaId ?? u?.empresa?.id)) ? Number(u?.empresaId ?? u?.empresa?.id) : null),
      selectedLocalityId: isAdminOrCoord ? null : (Number.isFinite(locCookie) ? locCookie : null),
    };

    setForm((prev) => ({ ...base, ...prev }));
  }, []);

  /** IDs efectivos blindados por permisos */
  const resolvedIds = useMemo(() => {
    const role = String(rol).toUpperCase();
    const forcedEmpresa = Number(user?.empresaId ?? user?.empresa?.id ?? NaN);
    const cookieLoc = Number(Movimiento.getCookie("locId") || NaN);

    const empresaId = ADMIN_OR_COORD.includes(role)
      ? Number(form.empresaId ?? NaN)
      : Number(isFinite(forcedEmpresa) ? forcedEmpresa : NaN);

    const creadoPorId = Number(form.creadoPorId ?? user?.id ?? NaN);

    const localidadId = ADMIN_OR_COORD.includes(role)
      ? Number(form.selectedLocalityId ?? NaN)
      : Number(isFinite(cookieLoc) ? cookieLoc : NaN);

    return { empresaId, creadoPorId, localidadId };
  }, [form.empresaId, form.creadoPorId, form.selectedLocalityId, user, rol]);

  /** Cargar combos + draft + outbox */
  useEffect(() => {
    let alive = true;

    initFormLocked();

    (async () => {
      try {
        const [e, l] = await Promise.all([
          Movimiento.fetchJSON(`${API_BASE}/empresas`).catch(() => []),
          Movimiento.fetchJSON(`${API_BASE}/localidades`).catch(() => []),
        ]);
        if (!alive) return;

        const eList: Empresa[] = Array.isArray(e) ? e : [];
        const lList: Localidad[] = Array.isArray(l) ? l : [];
        setEmpresas(eList);
        setLocalidades(lList);

        setForm((p) => {
          let empresaId = p.empresaId ?? (user?.empresaId ?? user?.empresa?.id ?? null);
          if (ADMIN_OR_COORD.includes(String(getRoleClient()).toUpperCase())) {
            // Admin/Coord elige libremente; si hay 1 sola opción, autoselecciona.
            if (!Number.isFinite(Number(empresaId)) && eList.length === 1) empresaId = eList[0].id;
          }
          let localidadId = p.selectedLocalityId;
          const role = getRoleClient();
          const canAll = ADMIN_OR_COORD.includes(String(role).toUpperCase());
          if (!Number.isFinite(Number(localidadId)) && canAll && lList.length === 1) localidadId = lList[0].id;

          return {
            ...p,
            empresaId: Number.isFinite(Number(empresaId)) ? Number(empresaId) : p.empresaId,
            selectedLocalityId: Number.isFinite(Number(localidadId)) ? Number(localidadId) : (p.selectedLocalityId ?? null),
          };
        });
      } catch {}

      try {
        const raw = typeof window !== "undefined" ? localStorage.getItem(DRAFT_KEY) : null;
        if (raw && alive) {
          const d = JSON.parse(raw);
          setForm((p) => ({ ...p, ...d.form }));
          setFromSection(d.fromSection);
          setToSection(d.toSection);
          setLocoLockedBy(d.locoLockedBy || null);
        }
      } catch {}

      try {
        const q = JSON.parse(localStorage.getItem(OUTBOX_KEY) || "[]");
        if (alive) setPendingCount(Array.isArray(q) ? q.length : 0);
      } catch {
        if (alive) setPendingCount(0);
      }
    })();

    return () => { alive = false; };
  }, [initFormLocked]);

  /** Revalida rol y localidad bloqueada si aplica */
  useEffect(() => {
    setRol(getRoleClient());
    if (!canManageAll) {
      const locCookie = Number(Movimiento.getCookie("locId") || NaN);
      setForm((p) => ({ ...p, selectedLocalityId: Number.isFinite(locCookie) ? locCookie : p.selectedLocalityId }));
    }
  }, [canManageAll]);

  /** Draft autosave */
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const payload = { form, fromSection, toSection, locoLockedBy };
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(payload)); } catch {} }, 350);
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
    try { q = JSON.parse(localStorage.getItem(OUTBOX_KEY) || "[]"); } catch {}
    if (!Array.isArray(q) || q.length === 0) return;

    const keep: any[] = [];
    for (const item of q) {
      try {
        const res = await Movimiento.fetchWithTimeout(`${API_BASE}/movimientos`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", Accept: "application/json", ...Movimiento.tokenHeader() },
          body: JSON.stringify(item.payload),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } catch { keep.push(item); }
    }
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(keep));
    setPendingCount(keep.length);
    if (keep.length === 0) { setBanner("Todos los envíos pendientes fueron sincronizados."); setTimeout(() => setBanner(null), 2500); }
  }, [online]);
  Movimiento.useVisibleInterval(flushOutbox, online ? FLUSH_INTERVAL_MS : null);

  /** Vías por localidad */
  useEffect(() => {
    (async () => {
      if (!form.selectedLocalityId) { setVias([]); return; }
      try {
        const data = await Movimiento.fetchJSON(`${API_BASE}/vias/localidad/${form.selectedLocalityId}`);
        const list: Via[] = (data || []).map((v: any) => ({ id: v.id, nombre: v.nombre }));
        
        // Ordenar vías numéricamente si son números, alfabéticamente si no
        list.sort((a, b) => {
          const numA = Number(a.nombre);
          const numB = Number(b.nombre);
          
          // Si ambos son números, ordenar numéricamente
          if (!isNaN(numA) && !isNaN(numB)) {
            return numA - numB;
          }
          
          // Si solo uno es número, poner primero los números
          if (!isNaN(numA)) return -1;
          if (!isNaN(numB)) return 1;
          
          // Si ninguno es número, ordenar alfabéticamente
          return String(a.nombre).localeCompare(String(b.nombre));
        });
        
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
      const raw = await Movimiento.fetchJSON(`${SECC_BASE}/via/${viaId}`);
      const arr: Seccion[] = Array.isArray(raw) ? raw : raw?.secciones ?? [];
      const ordered = arr.slice().sort((a, b) => a.numero - b.numero);
      setSectionsByVia((m) => ({ ...m, [viaId]: ordered }));
    } catch { setSectionsByVia((m) => ({ ...m, [viaId]: [] })); }
    finally {
      secLoadingRef.current[viaId] = false;
      setSecLoading((s) => ({ ...s, [viaId]: false }));
    }
  }, [sectionsByVia]);

  // Reset vias when selection mode changes
  useEffect(() => {
    if (form.service) {
      if (selectionMode === "de_via") {
        setForm((p) => ({ ...p, toTrack: null }));
        setToSection(undefined);
        setShowToOpts(false);
      } else if (selectionMode === "para_via") {
        setForm((p) => ({ ...p, fromTrack: null }));
        setFromSection(undefined);
        setShowFromOpts(false);
      }
    }
  }, [selectionMode, form.service]);

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
        setForm((p) => ({ ...p, locomotiveNumber: String(locoIn) }));
        setLocoLockedBy({ movimientoId: s.movimientoId!, viaId: form.fromTrack!, numero: s.numero });
      } else {
        try {
          const mov = await Movimiento.fetchJSON(`${API_BASE}/movimientos/${s.movimientoId}`);
          const loco = Number((mov as any)?.locomotiveNumber ?? 0);
          if (loco > 0) {
            setForm((p) => ({ ...p, locomotiveNumber: String(loco) }));
            setLocoLockedBy({ movimientoId: s.movimientoId!, viaId: form.fromTrack!, numero: s.numero });
          }
        } catch {}
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

    if (form.service) {
      if (selectionMode === "de_via" && !form.fromTrack) e.fromTrack = "Selecciona vía de origen.";
      if (selectionMode === "para_via" && !form.toTrack) e.toTrack = "Selecciona vía de destino.";
    } else {
      if (!form.fromTrack) e.fromTrack = "Selecciona vía de origen.";
      if (!form.toTrack) e.toTrack = "Selecciona vía de destino.";
    }

    if (!form.locomotiveNumber.trim()) e.locomotiveNumber = "Número requerido.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validate2 = () => {
    const e: Record<string, string> = {};
    if (!form.movementType) e.movementType = "Selecciona el tipo de movimiento.";
    if (!form.service) {
      if (form.polo === "Sin_Solicitar" && !["DENTRO", "AFUERA"].includes(form.chimneyPosition)) {
        e.chimneyPosition = "Selecciona posición de chimenea.";
      }
      if (form.chimneyPosition === "Sin_Solicitar" && !["NORTE", "SUR"].includes(form.polo)) {
        e.polo = "Selecciona polo o posición de chimenea.";
      }
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
    try { q = JSON.parse(localStorage.getItem(OUTBOX_KEY) || "[]"); } catch {}
    const item = { id: `${Date.now()}_${Math.random().toString(36).slice(2)}`, payload, createdAt: Date.now() };
    const next = [...(Array.isArray(q) ? q : []), item];
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(next));
    setPendingCount(next.length);
    setBanner("Sin conexión: la solicitud quedó en cola y se enviará automáticamente.");
    setTimeout(() => setBanner(null), 3500);
  };

  const submit = useCallback(async () => {
    const { empresaId, creadoPorId, localidadId } = resolvedIds;

    // Validaciones duras
    if (!Number.isFinite(empresaId) || !Number.isFinite(creadoPorId) || !Number.isFinite(localidadId)) {
      alert("Faltan IDs requeridos (empresa, usuario o localidad).");
      return;
    }
    if (!form.locomotiveNumber.trim()) {
      alert("Falta número de locomotora.");
      return;
    }

    // Vías según modo
    const fromTrack = (!form.service || selectionMode === "de_via") ? form.fromTrack : null;
    const toTrack   = (!form.service || selectionMode === "para_via") ? form.toTrack : null;

    if (!fromTrack && !toTrack) {
      alert("Debe seleccionar al menos una vía según el modo de selección.");
      return;
    }

    // Mensaje e instrucciones
    const meta: string[] = [];
    if (typeof toSection === "number")   meta.push(`[META DESTINO:${toSection}]`);
    if (typeof fromSection === "number") meta.push(`[META ORIGEN:${fromSection}]`);

    const partes: string[] = [];
    if (fromTrack)
      partes.push(`De la vía ${viaName(fromTrack)}${typeof fromSection === "number" ? ` (sección ${fromSection})` : ""}`);
    if (toTrack)
      partes.push(`para la vía ${viaName(toTrack)}${typeof toSection === "number" ? ` (sección ${toSection})` : ""}`);

    if (form.polo && form.polo !== "Sin_Solicitar") {
      partes.push(`| Posición: ${form.polo} | `);
    }

    const instrucciones = [meta.join(" "), partes.join(" "), (form.comments || "").trim()]
      .filter(Boolean)
      .join(" ")
      .trim();

    // Sección explícita para servicios
    const numeroSeccion =
      form.service && (typeof toSection === "number" || typeof fromSection === "number")
        ? Number(typeof toSection === "number" ? toSection : (fromSection as number))
        : undefined;

    // Cuerpo listo para API (con empresa/localidad blindados por permisos)
    const payload: Record<string, any> = {
      empresaId: Number(empresaId),
      creadoPorId: Number(creadoPorId),
      clienteId: Number(form.clienteId ?? user?.id ?? creadoPorId),
      localidadId: Number(localidadId),

      ...(fromTrack ? { viaOrigenId: Number(fromTrack) } : {}),
      ...(toTrack   ? { viaDestinoId: Number(toTrack) } : {}),
      ...(numeroSeccion !== undefined ? { numeroSeccion } : {}),

      locomotiveNumber: Number(form.locomotiveNumber),
      prioridad: form.priority ? "ALTA" : "BAJA",

      tipoMovimiento: ["MD_TRABAJANDO", "REMOLCADA"].includes(form.movementType) ? form.movementType : undefined,
      direccionEmpuje:
        form.movementType === "REMOLCADA" && ["EMPUJAR", "JALAR"].includes(form.direccionEmpuje || "")
          ? form.direccionEmpuje
          : "Sin_Solicitar",
      posicionCabina: !form.service && ["DENTRO", "AFUERA"].includes(form.cabinPosition) ? form.cabinPosition : "Sin_Solicitar",
      posicionChimenea: !form.service && ["DENTRO", "AFUERA"].includes(form.chimneyPosition) ? form.chimneyPosition : "Sin_Solicitar",

      ...(form.service === "Lavado" ? { lavado: true } : {}),
      ...(form.service === "Torno"  ? { torno:  true } : {}),

      ...(instrucciones ? { instrucciones } : {}),

      finalizado: false,
      incidenteGlobal: false,
    };

    Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

    try {
      setSending(true);

      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        pushOutbox(payload);
        setSending(false);
        return;
      }

      const res = await Movimiento.fetchWithTimeout(`${API_BASE}/movimientos`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json", ...Movimiento.tokenHeader() },
        body: JSON.stringify(payload),
      });

      const txt = await res.text();
      if (!res.ok) {
        try { const j = JSON.parse(txt); alert(j.message || j.error || txt); }
        catch { alert(txt || `HTTP ${res.status}`); }
        return;
      }

      const created = txt ? Movimiento.safeJSON(txt) : {};
      const movimientoId = Number((created as any)?.id || 0);

      const viaParaAsignar =
        typeof toSection === "number" && form.toTrack
          ? form.toTrack
          : (typeof fromSection === "number" && form.fromTrack ? form.fromTrack : null);

      const numeroParaAsignar =
        typeof toSection === "number" ? toSection :
        (typeof fromSection === "number" ? fromSection : undefined);

      if (movimientoId && viaParaAsignar && typeof numeroParaAsignar === "number") {
        await Movimiento.fetchWithTimeout(`${API_BASE}/secciones/via/${viaParaAsignar}/asignar`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", ...Movimiento.tokenHeader() },
          body: JSON.stringify({ numero: Number(numeroParaAsignar), movimientoId }),
        }).catch(() => {});
      }

      try { localStorage.removeItem(DRAFT_KEY); } catch {}
      setFromSection(undefined);
      setToSection(undefined);
      setLocoLockedBy(null);
      setStep(1);

      window.location.assign(`${roleBase(rol)}/movimientos`);
    } catch (e: any) {
      const msg = String(e?.name || "").toLowerCase();
      const isAbort = msg.includes("abort");
      const isTypeErr = String(e?.message || "").toLowerCase().includes("failed to fetch");
      if (isAbort || isTypeErr) {
        pushOutbox(payload);
        return;
      }
      alert(e?.message || "Error al crear movimiento");
    } finally {
      setSending(false);
    }
  }, [resolvedIds, form, selectionMode, fromSection, toSection, rol, user]);

  /** Progreso */
  const STEP_CFG = [
    { label: "Paso 1 de 3", percent: 33 },
    { label: "Paso 2 de 3", percent: 66 },
    { label: "Paso 3 de 3", percent: 100 },
  ] as const;
  const { label, percent } = STEP_CFG[step - 1];

  const lockedClienteMissingData = !canManageAll && !Number.isFinite(Number(Movimiento.getCookie("locId") || NaN));

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

  const goSalir = () => window.location.assign(`${roleBase(rol)}/movimientos`);

  if (!mounted) return null;
  
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white transition-colors duration-200 p-4 md:p-6 lg:p-8">
      <style jsx global>{`
        @media (max-width: 640px) {
          select, select option { font-size: 16px !important; line-height: 1.45 !important; }
          select { min-height: 48px !important; }
        }
      `}</style>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.05)_1px,transparent_1px)] bg-[size:24px_24px] dark:opacity-[0.07]"
      />
      <div className="relative z-10 max-w-4xl mx-auto">

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge tone={online ? "ok" : "error"}>{online ? "En línea" : "Sin conexión"}</Badge>
          <RoleBadge rol={rol} canManageAll={canManageAll} />
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

        {lockedClienteMissingData && (
          <div className="mt-3 rounded-lg border-l-4 border-rose-500 bg-rose-50 p-3 text-sm dark:border-rose-600 dark:bg-rose-900/20">
            <div className="font-medium text-rose-800 dark:text-rose-200">
              Sesión inválida. Inicia sesión nuevamente.
            </div>
          </div>
        )}

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
              selectionMode={selectionMode}
              setSelectionMode={setSelectionMode}
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
          {step === 3 && <StepThree form={form} setForm={setForm} sending={sending} submit={submit} fromSection={fromSection} toSection={toSection} viaName={viaName} selectionMode={selectionMode} />}
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            onClick={() => {
              try { localStorage.removeItem(DRAFT_KEY); } catch {}
              setForm((prev) => ({ ...baseInitialForm, selectedLocalityId: canManageAll ? null : prev.selectedLocalityId }));
              setFromSection(undefined);
              setToSection(undefined);
              setErrors({});
              setShowFromOpts(false);
              setShowToOpts(false);
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
  selectionMode: "de_via" | "para_via";
  setSelectionMode: (mode: "de_via" | "para_via") => void;
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
    showFromOpts, setShowFromOpts, showToOpts, setShowToOpts, selectionMode, setSelectionMode,
    tapToggle, sectionsByVia, secLoading, ensureSections, fromSection, toSection,
    setFromSection, setToSection, viaName
  } = props;
  /** ===== Alta Password Modal State ===== */
  const [altaOpen, setAltaOpen] = useState(false);
  const [altaPwd, setAltaPwd] = useState("");
  const [altaErr, setAltaErr] = useState<string | null>(null);

  const handlePriorityToggle = (checked: boolean) => {
    if (!checked) {
      setForm((p) => ({ ...p, priority: false }));
      return;
    }
    const empId = Number(form.empresaId);
    if (!Number.isFinite(empId)) {
      alert("Selecciona una empresa antes de marcar prioridad alta.");
      return;
    }
    setAltaPwd("");
    setAltaErr(null);
    setAltaOpen(true);
  };

  const confirmAltaPwd = () => {
    const empId = Number(form.empresaId);
    const expected = ALTA_PASSWORDS[empId];
    if (!expected) {
      setAltaErr("No hay contraseña configurada para esta empresa.");
      return;
    }
    if (altaPwd.trim() !== expected) {
      setAltaErr("Contraseña inválida.");
      return;
    }
    setForm((p) => ({ ...p, priority: true }));
    setAltaOpen(false);
    setAltaPwd("");
    setAltaErr(null);
  };

  const cancelAltaPwd = () => {
    setAltaOpen(false);
    setAltaPwd("");
    setAltaErr(null);
    setForm((p) => ({ ...p, priority: false }));
  };

  const viaOption = (v: Via) => {
    const secs = sectionsByVia[v.id];
    const anyOcc: boolean | null = Array.isArray(secs) ? secs.some((x) => x.ocupada) : null;
    const label = anyOcc === null ? "—" : anyOcc ? "OCUPADA" : "LIBRE";
    const tone = anyOcc === null ? "text-slate-500" : anyOcc ? "text-rose-600" : "text-emerald-600";
    
    const isServiceVia = ['torno', 'lavado'].includes(v.nombre.toLowerCase());
    const isDisabled = !form.service && isServiceVia;
    
    return (
      <button
        key={v.id}
        onClick={() => !isDisabled && setForm((p) => ({ ...p, fromTrack: p.fromTrack === v.id ? null : v.id }))}
        disabled={isDisabled}
        className={Movimiento.clsx(
          "flex w-full items-center justify-between rounded-md border px-3 py-2 text-left transition-colors duration-200",
          isDisabled 
            ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-500"
            : form.fromTrack === v.id
              ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-500 dark:text-emerald-300"
              : "hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
        )}
      >
        <span className="truncate">Vía {isDisabled ? `${v.nombre} (solo servicio)` : v.nombre}</span>
        <span className={Movimiento.clsx("ml-3 text-xs font-semibold", isDisabled ? "text-slate-400 dark:text-slate-500" : tone)}>
          {isDisabled ? "NO DISPONIBLE" : label}
        </span>
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
        className={Movimiento.clsx(
          "flex w-full items-center justify-between rounded-md border px-3 py-2 text-left transition-colors duration-200",
          allOcc === true ? "opacity-60" : "",
          form.toTrack === v.id
            ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-500 dark:text-emerald-300"
            : "hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
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
          {form.service ? <span className="self-center text-xs text-slate-500 dark:text-slate-400">Doble clic para desmarcar</span> : null}
        </div>
      </div>

      {/* Modo de selección - solo visible cuando hay servicio */}
      {form.service && (
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

      {/* Prioridad + Loco */}
      <label className="mb-3 mt-1 flex items-center gap-2">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 dark:border-slate-700"
          checked={form.priority}
          onChange={(e) => handlePriorityToggle(e.target.checked)}
        />
        <span className="text-sm text-slate-700 dark:text-slate-200">
          Prioridad alta
        </span>
      </label>
      {form.priority === false && (
        <div className="text-xs text-slate-500 dark:text-slate-400 -mt-2 mb-2">
          Para activar ALTA se requiere contraseña según la empresa.
        </div>
      )}

      <Field
        label="Número de locomotora"
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={form.locomotiveNumber ? String(form.locomotiveNumber) : ""}
        onChange={(e) => {
          const value = e.target.value;
          if (value === '' || /^\d+$/.test(value)) {
            setForm((p) => ({ ...p, locomotiveNumber: value }));
          }
        }}
        className=""
        disabled={false}
        error={errors.locomotiveNumber}
      />

      {/* Vía origen */}
      {(!form.service || selectionMode === "de_via") && (
        <div className="sm:col-span-2">
          <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">De vía</span>
          <div className="flex gap-2">
            <button
              onClick={() => { setShowFromOpts(!showFromOpts); if (form.fromTrack) ensureSections(form.fromTrack); }}
              className={Movimiento.clsx(
                "min-w-[220px] rounded-md border px-3 py-2 text-left transition-colors duration-200",
                form.fromTrack 
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-500 dark:text-emerald-300"
                  : "hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
              )} 
            >
              {form.fromTrack ? `Vía ${viaName(form.fromTrack)}` : "Selecciona una vía"}
            </button>
            {errors.fromTrack ? <span className="self-center text-xs text-rose-600 dark:text-rose-400">{errors.fromTrack}</span> : null}
          </div>

          {showFromOpts && (
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {Movimiento.TrackFilter(vias, selectionMode, "de_via", form.service)
                .map((v) => (
                  <div key={v.id}>
                    {viaOption(v)}
                  </div>
                ))}
            </div>
          )}

          <SectionsPills kind="from" viaId={form.fromTrack} />
        </div>
      )}

      {/* Vía destino */}
      {(!form.service || selectionMode === "para_via") && (
        <div className="sm:col-span-2">
          <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Para vía</span>
          <div className="flex gap-2">
            <button
              onClick={() => { setShowToOpts(!showToOpts); if (form.toTrack) ensureSections(form.toTrack); }}
              className={Movimiento.clsx(
                "min-w-[220px] rounded-md border px-3 py-2 text-left transition-colors duration-200",
                form.toTrack 
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-500 dark:text-emerald-300"
                  : "hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
              )}
            >
              {form.toTrack ? `Vía ${viaName(form.toTrack)}` : "Selecciona una vía"}
            </button>
            {errors.toTrack ? <span className="self-center text-xs text-rose-600 dark:text-rose-400">{errors.toTrack}</span> : null}
          </div>

          {showToOpts && (
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {Movimiento.TrackFilter(vias, selectionMode, "para_via", form.service)
                .map((v) => (
                  <div key={v.id}>
                    {viaOptionTo(v)}
                  </div>
                ))}
            </div>
          )}
          <SectionsPills kind="to" viaId={form.toTrack} />
        </div>
      )}

      {/* ===== Modal de contraseña ALTA ===== */}
      {altaOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <div className="text-base font-semibold text-slate-800 dark:text-slate-100">Confirmar prioridad ALTA</div>
            <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Ingresa la contraseña de ALTA para la empresa seleccionada.
            </div>
            <div className="mt-3">
              <input
                type="password"
                className={Movimiento.clsx(inputBase, altaErr && "border-rose-500 focus:border-rose-500")}
                value={altaPwd}
                onChange={(e) => { setAltaPwd(e.target.value); setAltaErr(null); }}
                onKeyDown={(e) => { if (e.key === "Enter") confirmAltaPwd(); }}
                placeholder="Contraseña de ALTA"
                autoFocus
              />
              {altaErr && <div className="mt-1 text-xs text-rose-600">{altaErr}</div>}
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={confirmAltaPwd} className="rounded-md bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-700">Confirmar</button>
              <button onClick={cancelAltaPwd} className="rounded-md border px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Cancelar</button>
            </div>
          </div>
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
        disabled && "opacity-50 cursor-not-allowed",
        active && "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
      )}
    >
      <span className="font-medium">{label}</span>
      <span
        className={Movimiento.clsx(
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
            <div className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-200"></div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Card
                label="Norte"
                active={form.polo === "NORTE"}
                disabled={form.cabinPosition !== "Sin_Solicitar" || form.chimneyPosition !== "Sin_Solicitar"}
                onClick={() => {
                  if (form.polo === "NORTE") {
                    setForm((p) => ({ ...p, polo: "Sin_Solicitar" }));
                  } else {
                    setForm((p) => ({ ...p, polo: "NORTE", cabinPosition: "Sin_Solicitar", chimneyPosition: "Sin_Solicitar", posicionChimenea: null }));
                  }
                }}
              />
              <Card
                label="Sur"
                active={form.polo === "SUR"}
                disabled={form.cabinPosition !== "Sin_Solicitar" || form.chimneyPosition !== "Sin_Solicitar"}
                onClick={() => {
                  if (form.polo === "SUR") {
                    setForm((p) => ({ ...p, polo: "Sin_Solicitar" }));
                  } else {
                    setForm((p) => ({ ...p, polo: "SUR", cabinPosition: "Sin_Solicitar", chimneyPosition: "Sin_Solicitar", posicionChimenea: null }));
                  }
                }}
              />
            </div>
            {(form.polo !== "Sin_Solicitar") && <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Doble clic para desmarcar</div>}
          </div>

          <div>
            <div className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-200">Posición de cabina</div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Card
                label="Dentro"
                active={form.cabinPosition === "DENTRO"}
                disabled={form.polo !== "Sin_Solicitar"}
                onClick={() => {
                  if (form.cabinPosition === "DENTRO") {
                    setForm((p) => ({ ...p, cabinPosition: "Sin_Solicitar" }));
                  } else {
                    setForm((p) => ({ ...p, cabinPosition: "DENTRO", polo: "Sin_Solicitar" }));
                  }
                }}
              />
              <Card
                label="Afuera"
                active={form.cabinPosition === "AFUERA"}
                disabled={form.polo !== "Sin_Solicitar"}
                onClick={() => {
                  if (form.cabinPosition === "AFUERA") {
                    setForm((p) => ({ ...p, cabinPosition: "Sin_Solicitar" }));
                  } else {
                    setForm((p) => ({ ...p, cabinPosition: "AFUERA", polo: "Sin_Solicitar" }));
                  }
                }}
              />
            </div>
            {errors.cabinPosition && <div className="mt-1 text-xs text-rose-600">{errors.cabinPosition}</div>}
            {(form.cabinPosition !== "Sin_Solicitar") && <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Doble clic para desmarcar</div>}
          </div>

          <div>
            <div className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-200">Posición de chimenea</div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Card
                label="Dentro"
                active={form.chimneyPosition === "DENTRO"}
                disabled={form.polo !== "Sin_Solicitar"}
                onClick={() => {
                  if (form.chimneyPosition === "DENTRO") {
                    setForm((p) => ({ ...p, chimneyPosition: "Sin_Solicitar", posicionChimenea: null }));
                  } else {
                    setForm((p) => ({ ...p, chimneyPosition: "DENTRO", posicionChimenea: "DENTRO", polo: "Sin_Solicitar" }));
                  }
                }}
              />
              <Card
                label="Afuera"
                active={form.chimneyPosition === "AFUERA"}
                disabled={form.polo !== "Sin_Solicitar"}
                onClick={() => {
                  if (form.chimneyPosition === "AFUERA") {
                    setForm((p) => ({ ...p, chimneyPosition: "Sin_Solicitar", posicionChimenea: null }));
                  } else {
                    setForm((p) => ({ ...p, chimneyPosition: "AFUERA", posicionChimenea: "AFUERA", polo: "Sin_Solicitar" }));
                  }
                }}
              />
            </div>
            {errors.chimneyPosition && <div className="mt-1 text-xs text-rose-600">{errors.chimneyPosition}</div>}
            {(form.chimneyPosition !== "Sin_Solicitar") && <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Doble clic para desmarcar</div>}
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
  form, setForm, sending, submit, fromSection, toSection, viaName, selectionMode,
}: { form: MovementFormData; setForm: React.Dispatch<React.SetStateAction<MovementFormData>>; sending: boolean; submit: () => void; fromSection?: number; toSection?: number; viaName: (id?: number | null) => string; selectionMode: "de_via" | "para_via"; }) {
  const sectionHint = (fromSection ? `[META ORIGEN:${fromSection}] ` : "") + (toSection ? `[META DESTINO:${toSection}]` : "");
  const showHint = Boolean(fromSection || toSection);

  return (
    <div className="grid gap-4">
      <div className="rounded-lg border p-3 text-sm dark:border-slate-700">
        <div className="font-semibold mb-2 text-slate-800 dark:text-slate-100">Resumen</div>
        <ul className="grid gap-1 text-slate-700 dark:text-slate-300">
          <li>Localidad: {form.selectedLocalityId ?? "—"}</li>
          {selectionMode === "de_via" && (
            <li>Origen: {form.fromTrack ? `Vía ${viaName(form.fromTrack)} ${fromSection ? `(Sección #${fromSection})` : ""}` : "—"}</li>
          )}
          {selectionMode === "para_via" && (
            <li>Destino: {form.toTrack ? `Vía ${viaName(form.toTrack)} ${toSection ? `(Sección #${toSection})` : ""}` : "—"}</li>
          )}
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
          className={Movimiento.clsx(inputBase, "min-h[120px] min-h-[120px]")}
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
  return <span className={Movimiento.clsx(chipBase, map[tone])}>{children}</span>;
}

/** Badge de Rol con permisos visibles */
function RoleBadge({ rol, canManageAll }: { rol: string; canManageAll: boolean }) {
  const R = String(rol || "").toUpperCase();
  const tone = canManageAll ? "ok" : (R === "SUPERVISOR" ? "warn" : "muted");
  const text =
    canManageAll
      ? `${R} · puede elegir empresa y localidad`
      : `${R} · solo su empresa${R === "CLIENTE" || R === "SUPERVISOR" ? " y localidad asignada" : ""}`;
  return <Badge tone={tone as any}>{text}</Badge>;
}
