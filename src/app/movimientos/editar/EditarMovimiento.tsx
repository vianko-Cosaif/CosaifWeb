/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Movement, Rol } from "../../Components/movimientos/useMovimientos";

/* ================== CONFIG ================== */
const API_BASE =
  (process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || process.env.NEXT_PUBLIC_API_BASE || "/xapi").trim();

type Via = { id: number; nombre: string };
type Localidad = { id: number; nombre: string };

/* ================== HELPERS SESIÓN ================== */

function getCookie(name: string): string {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(new RegExp("(^|; )" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[2]) : "";
}

function safeJsonParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function getRoleFromSession(): Rol {
  const c = (getCookie("role") || "").trim().toUpperCase();
  if (c) return c as Rol;

  const u = safeJsonParse<any>(typeof window !== "undefined" ? localStorage.getItem("user") : null);
  const r = String(u?.rol || u?.role || "").toUpperCase();
  return (r || "CLIENTE") as Rol;
}

function getTokenFromSession(): string | undefined {
  const t = (getCookie("token") || "").trim();
  if (t) return t;

  const u = safeJsonParse<any>(typeof window !== "undefined" ? localStorage.getItem("user") : null);
  const token = String(u?.token || u?.accessToken || "").trim();
  return token || undefined;
}

const tokenHeader = (token?: string): HeadersInit => {
  const t = (token || getTokenFromSession() || "").trim();
  return t ? { Authorization: `Bearer ${t}` } : {};
};

type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string; status?: number };

async function fetchJson<T>(url: string, init?: RequestInit): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, init);
    const status = res.status;

    const ct = res.headers.get("content-type") || "";
    const txt = await res.text().catch(() => "");
    const body = ct.includes("application/json") && txt ? safeJsonParse<any>(txt) : txt;

    if (!res.ok) {
      const msg =
        typeof body === "string"
          ? body
          : (body?.message || body?.error || `HTTP ${status}`);
      return { ok: false, error: String(msg), status };
    }

    return { ok: true, data: body as T };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Error de red" };
  }
}

/* ================== RUTAS POR ROL ================== */
const BASE_BY_ROLE: Record<string, string> = {
  ADMINISTRADOR: "/administrador",
  COORDINADOR: "/coordinador",
  SUPERVISOR: "/supervisor",
  CLIENTE: "/cliente",
};
const roleBase = (r?: string) => BASE_BY_ROLE[String(r || "").toUpperCase()] || "/cliente";

/* ================== COMPONENTE ================== */

type EditForm = {
  // backend-friendly (como CREAR)
  locomotiveNumber: string; // input
  prioridad: "ALTA" | "BAJA";
  lavado: boolean;
  torno: boolean;
  instrucciones: string;

  viaOrigenId: number | null;
  viaDestinoId: number | null;

  // opcionales, los dejo para no romper si tu backend los espera
  posicionCabina: string;
  posicionChimenea: string;

  // contexto
  localidadId: number | null;
};

export default function EditarMovimiento(props: { apiBase?: string }) {
  const router = useRouter();
  const sp = useSearchParams();

  const movimientoId = useMemo(() => {
    const raw = sp.get("id") || sp.get("movimientoId") || "";
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [sp]);

  const [rol, setRol] = useState<Rol>(() => getRoleFromSession());
  const [token, setToken] = useState<string | undefined>(() => getTokenFromSession());

  const apiBase = useMemo(() => (props.apiBase || API_BASE).trim(), [props.apiBase]);

  const ADMIN_OR_COORD = useMemo(() => ["ADMINISTRADOR", "COORDINADOR"], []);
  const canManageAll = useMemo(() => ADMIN_OR_COORD.includes(String(rol).toUpperCase()), [rol, ADMIN_OR_COORD]);

  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mov, setMov] = useState<Movement | null>(null);

  const [localidades, setLocalidades] = useState<Localidad[]>([]);
  const [vias, setVias] = useState<Via[]>([]);

  // si es servicio, se elige UNA sola vía (como crear)
  const [selectionMode, setSelectionMode] = useState<"de_via" | "para_via">("para_via");

  const [form, setForm] = useState<EditForm>({
    locomotiveNumber: "",
    prioridad: "BAJA",
    lavado: false,
    torno: false,
    instrucciones: "",
    viaOrigenId: null,
    viaDestinoId: null,
    posicionCabina: "Sin_Solicitar",
    posicionChimenea: "Sin_Solicitar",
    localidadId: null,
  });

  useEffect(() => {
    setRol(getRoleFromSession());
    setToken(getTokenFromSession());
  }, []);

  const isService = useMemo(() => Boolean(form.lavado || form.torno), [form.lavado, form.torno]);

  // CLIENTE PUEDE EDITAR. Punto.
  // Si el backend quiere prohibir algo, que responda error y lo mostramos.
  const puedeEditar = useMemo(() => {
    if (!mov) return false;

    const estado = String((mov as any).estado || "").toUpperCase();
    // Única excepción razonable: concluido/cancelado (si aún así quieres editar, quita esto)
    if (["CONCLUIDO", "CANCELADO"].includes(estado)) return false;

    return true;
  }, [mov]);

  const cargarLocalidades = useCallback(async () => {
    const r = await fetchJson<any>(`${apiBase}/localidades`, {
      method: "GET",
      headers: { Accept: "application/json", ...tokenHeader(token) },
      credentials: "include",
      cache: "no-store",
    });
    if (!r.ok) return; // no es crítico
    const list = Array.isArray(r.data) ? r.data : [];
    setLocalidades(list.map((x: any) => ({ id: Number(x.id), nombre: String(x.nombre || x.name || "") })));
  }, [apiBase, token]);

  const cargarViasPorLocalidad = useCallback(
    async (localidadId: number) => {
      const r = await fetchJson<any>(`${apiBase}/vias/localidad/${localidadId}`, {
        method: "GET",
        headers: { Accept: "application/json", ...tokenHeader(token) },
        credentials: "include",
        cache: "no-store",
      });
      if (!r.ok) {
        setVias([]);
        return;
      }
      const list = Array.isArray(r.data) ? r.data : [];
      const mapped: Via[] = list.map((v: any) => ({ id: Number(v.id), nombre: String(v.nombre || "") }));
      mapped.sort((a, b) => String(a.nombre).localeCompare(String(b.nombre)));
      setVias(mapped);
    },
    [apiBase, token]
  );

  const cargarMovimiento = useCallback(async () => {
    setError(null);

    if (!apiBase) return setError("Falta apiBase.");
    if (!token) return setError("Falta token en cookie/localStorage.");
    if (!movimientoId) return setError("Falta id en la URL. Usa ?id=123");

    setCargando(true);

    const url = `${apiBase}/movimientos/${movimientoId}`;
    console.info("[EditarMovimiento] GET", { url, movimientoId, rol, hasToken: Boolean(token) });

    const r = await fetchJson<any>(url, {
      method: "GET",
      headers: { Accept: "application/json", ...tokenHeader(token) },
      credentials: "include",
      cache: "no-store",
    });

    if (!r.ok) {
      setError(r.error);
      setCargando(false);
      return;
    }

    const data = r.data as any;
    setMov(data);

    // localidad: del movimiento o cookie locId (fallback)
    const locFromMov = Number(data?.localidadId ?? data?.localidad?.id ?? NaN);
    const locFromCookie = Number(getCookie("locId") || NaN);
    const localidadId = Number.isFinite(locFromMov) ? locFromMov : (Number.isFinite(locFromCookie) ? locFromCookie : null);

    // vías
    if (localidadId) await cargarViasPorLocalidad(localidadId);

    // modo servicio inicial: si trae solo una vía, inferimos
    const oId = Number(data?.viaOrigenId ?? NaN);
    const dId = Number(data?.viaDestinoId ?? NaN);
    if (Number.isFinite(oId) && !Number.isFinite(dId)) setSelectionMode("de_via");
    else if (!Number.isFinite(oId) && Number.isFinite(dId)) setSelectionMode("para_via");

    // hidrata form (acepta nombres viejos/raros sin romper)
    setForm((prev) => ({
      ...prev,
      localidadId,
      locomotiveNumber: String(data?.locomotiveNumber ?? data?.locomotora ?? data?.locomotive ?? ""),
      prioridad: (String(data?.prioridad || "BAJA").toUpperCase() === "ALTA" ? "ALTA" : "BAJA"),
      lavado: Boolean(data?.lavado),
      torno: Boolean(data?.torno),
      instrucciones: String(data?.instrucciones ?? ""),
      viaOrigenId: Number.isFinite(oId) ? oId : null,
      viaDestinoId: Number.isFinite(dId) ? dId : null,
      posicionCabina: String(data?.posicionCabina ?? "Sin_Solicitar"),
      posicionChimenea: String(data?.posicionChimenea ?? "Sin_Solicitar"),
    }));

    setCargando(false);
  }, [apiBase, token, movimientoId, rol, cargarViasPorLocalidad]);

  useEffect(() => {
    if (!apiBase || !token || !movimientoId) return;
    cargarMovimiento();
    cargarLocalidades();
  }, [apiBase, token, movimientoId, cargarMovimiento, cargarLocalidades]);

  // si es servicio, solo una vía según modo (como crear)
  useEffect(() => {
    if (!isService) return;
    if (selectionMode === "de_via") {
      setForm((p) => ({ ...p, viaDestinoId: null }));
    } else {
      setForm((p) => ({ ...p, viaOrigenId: null }));
    }
  }, [isService, selectionMode]);

  const guardar = useCallback(async () => {
    setError(null);

    if (!apiBase) return setError("Falta apiBase.");
    if (!token) return setError("Falta token en cookie/localStorage.");
    if (!movimientoId) return setError("Falta id en la URL.");
    if (!mov) return setError("No hay movimiento cargado.");
    if (!puedeEditar) return setError("Este movimiento está cerrado (CONCLUIDO/CANCELADO).");

    const locoNum = String(form.locomotiveNumber || "").trim();
    if (!locoNum) return setError("Falta número de locomotora.");

    // si servicio, manda solo la vía válida según modo
    const viaOrigenId = isService ? (selectionMode === "de_via" ? form.viaOrigenId : null) : form.viaOrigenId;
    const viaDestinoId = isService ? (selectionMode === "para_via" ? form.viaDestinoId : null) : form.viaDestinoId;

    const payload: Record<string, any> = {
      locomotiveNumber: Number(locoNum),
      prioridad: form.prioridad,
      lavado: Boolean(form.lavado),
      torno: Boolean(form.torno),
      instrucciones: String(form.instrucciones || "").trim(),
      viaOrigenId: viaOrigenId ?? null,
      viaDestinoId: viaDestinoId ?? null,
      posicionCabina: form.posicionCabina || "Sin_Solicitar",
      posicionChimenea: form.posicionChimenea || "Sin_Solicitar",
    };

    const url = `${apiBase}/movimientos/${movimientoId}`;
    console.info("[EditarMovimiento] PUT", { url, movimientoId, payload });

    setGuardando(true);

    const r = await fetchJson<any>(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Accept: "application/json", ...tokenHeader(token) },
      credentials: "include",
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      setError(r.error);
      setGuardando(false);
      return;
    }

    await cargarMovimiento();
    setGuardando(false);

    router.push(`${roleBase(rol)}/movimientos`);
  }, [apiBase, token, movimientoId, mov, puedeEditar, form, isService, selectionMode, cargarMovimiento, router, rol]);

  const goBack = () => router.push(`${roleBase(rol)}/movimientos`);

  const viaLabel = (id: number | null) => (id ? vias.find((v) => v.id === id)?.nombre || `ID ${id}` : "—");

  return (
    <section className="w-full rounded-3xl border border-slate-200 bg-white/95 p-4 text-slate-900 shadow-md dark:border-slate-800 dark:bg-slate-950/90 dark:text-slate-100 sm:p-6">
      <header className="mb-4 flex flex-col gap-1 sm:mb-6">
        <h1 className="text-lg font-semibold tracking-tight sm:text-2xl">Editar movimiento</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
          {movimientoId ? `ID: ${movimientoId}` : "Sin ID"} · Rol: {rol}
        </p>
      </header>

      {error && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-300">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-slate-100 bg-slate-50/90 p-3 dark:border-slate-800 dark:bg-slate-900/70 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {cargando ? "Cargando..." : mov ? `Estado: ${(mov as any).estado}` : "Sin datos"}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={goBack}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            >
              Volver
            </button>

            <button
              type="button"
              onClick={cargarMovimiento}
              disabled={cargando || !movimientoId || !token || !apiBase}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 hover:border-emerald-300 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            >
              Recargar
            </button>
          </div>
        </div>

        {/* FORM */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {/* Localidad */}
          <Field label="Localidad">
            {canManageAll ? (
              <select
                value={form.localidadId ?? ""}
                onChange={async (e) => {
                  const id = e.target.value ? Number(e.target.value) : null;
                  setForm((p) => ({ ...p, localidadId: id, viaOrigenId: null, viaDestinoId: null }));
                  if (id) await cargarViasPorLocalidad(id);
                }}
                disabled={!puedeEditar || cargando || guardando}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="">— Selecciona —</option>
                {localidades.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nombre}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={
                  localidades.find((l) => l.id === form.localidadId)?.nombre ||
                  (form.localidadId ? `ID ${form.localidadId}` : "")
                }
                disabled
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            )}
          </Field>

          <Field label="Locomotora">
            <input
              value={form.locomotiveNumber ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "" || /^\d+$/.test(v)) setForm((p) => ({ ...p, locomotiveNumber: v }));
              }}
              disabled={!puedeEditar || cargando || guardando}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              placeholder="Ej. 4567"
              inputMode="numeric"
            />
          </Field>

          <Field label="Prioridad">
            <select
              value={String(form.prioridad || "BAJA")}
              onChange={(e) => setForm((p) => ({ ...p, prioridad: e.target.value as any }))}
              disabled={!puedeEditar || cargando || guardando}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="BAJA">BAJA</option>
              <option value="ALTA">ALTA</option>
            </select>
          </Field>

          <Field label="Servicios">
            <div className="flex flex-wrap gap-3">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(form.lavado)}
                  onChange={(e) => setForm((p) => ({ ...p, lavado: e.target.checked }))}
                  disabled={!puedeEditar || cargando || guardando}
                />
                Lavado
              </label>
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(form.torno)}
                  onChange={(e) => setForm((p) => ({ ...p, torno: e.target.checked }))}
                  disabled={!puedeEditar || cargando || guardando}
                />
                Torno
              </label>
              <span className="text-xs text-slate-500 dark:text-slate-400">(flags; no encola solo)</span>
            </div>
          </Field>

          {/* Modo selección solo si servicio */}
          {isService && (
            <Field label="Modo de selección (servicio)">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectionMode("de_via")}
                  disabled={!puedeEditar || cargando || guardando}
                  className={`rounded-lg border px-3 py-2 text-xs ${
                    selectionMode === "de_via"
                      ? "border-emerald-400 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-200"
                      : "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                  }`}
                >
                  De vía
                </button>
                <button
                  type="button"
                  onClick={() => setSelectionMode("para_via")}
                  disabled={!puedeEditar || cargando || guardando}
                  className={`rounded-lg border px-3 py-2 text-xs ${
                    selectionMode === "para_via"
                      ? "border-emerald-400 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-200"
                      : "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                  }`}
                >
                  Para vía
                </button>
              </div>
            </Field>
          )}

          {/* Vía origen */}
          {(!isService || selectionMode === "de_via") && (
            <Field label="Vía origen">
              <select
                value={form.viaOrigenId ?? ""}
                onChange={(e) => setForm((p) => ({ ...p, viaOrigenId: e.target.value ? Number(e.target.value) : null }))}
                disabled={!puedeEditar || cargando || guardando || !form.localidadId}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="">— Selecciona —</option>
                {vias.map((v) => (
                  <option key={v.id} value={v.id}>
                    Vía {v.nombre}
                  </option>
                ))}
              </select>
              <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                Actual: {viaLabel(form.viaOrigenId)}
              </div>
            </Field>
          )}

          {/* Vía destino */}
          {(!isService || selectionMode === "para_via") && (
            <Field label="Vía destino">
              <select
                value={form.viaDestinoId ?? ""}
                onChange={(e) => setForm((p) => ({ ...p, viaDestinoId: e.target.value ? Number(e.target.value) : null }))}
                disabled={!puedeEditar || cargando || guardando || !form.localidadId}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="">— Selecciona —</option>
                {vias.map((v) => (
                  <option key={v.id} value={v.id}>
                    Vía {v.nombre}
                  </option>
                ))}
              </select>
              <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                Actual: {viaLabel(form.viaDestinoId)}
              </div>
            </Field>
          )}

          <Field label="Posición cabina">
            <input
              value={String(form.posicionCabina ?? "")}
              onChange={(e) => setForm((p) => ({ ...p, posicionCabina: e.target.value }))}
              disabled={!puedeEditar || cargando || guardando}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              placeholder="Ej. DENTRO/AFUERA/Sin_Solicitar"
            />
          </Field>

          <Field label="Posición chimenea">
            <input
              value={String(form.posicionChimenea ?? "")}
              onChange={(e) => setForm((p) => ({ ...p, posicionChimenea: e.target.value }))}
              disabled={!puedeEditar || cargando || guardando}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              placeholder="Ej. DENTRO/AFUERA/Sin_Solicitar"
            />
          </Field>

          <Field label="Instrucciones" className="md:col-span-2">
            <textarea
              value={form.instrucciones ?? ""}
              onChange={(e) => setForm((p) => ({ ...p, instrucciones: e.target.value }))}
              disabled={!puedeEditar || cargando || guardando}
              className="min-h-[110px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              placeholder="Notas para operación..."
            />
          </Field>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          {!puedeEditar && (
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Bloqueado solo si está CONCLUIDO/CANCELADO.
            </div>
          )}

          <button
            type="button"
            onClick={guardar}
            disabled={!puedeEditar || cargando || guardando}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {guardando ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </div>
    </section>
  );
}

/* ================== UI HELPERS ================== */

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      <label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">
        {label}
      </label>
      {children}
    </div>
  );
}
