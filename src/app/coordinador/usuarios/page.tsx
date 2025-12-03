"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Search, Plus, RefreshCw, X, Check, AlertCircle, Users, Mail, Building, MapPin,
  Edit2, Trash2, Filter, ChevronDown, User as UserIcon, KeyRound, Eye, EyeOff,
} from "lucide-react";

/** ================== CONFIG ================== */
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "/api";
const FETCH_TIMEOUT_MS = 12000;

/** ================== TIPOS ================== */
export type Rol = "CLIENTE" | "SUPERVISOR" | "COORDINADOR" | "ADMINISTRADOR";
type ID = number;

export interface Empresa { id: ID; nombre: string }
export interface Localidad { id: ID; nombre: string; estado?: string }

export interface UserData {
  id: ID;
  nombre: string;
  email: string;
  rol: Rol;
  empresaId: ID;
  empresa?: { id?: ID; nombre: string } | null;
  localidad?: { id?: ID; nombre: string; estado?: string } | null;
  usuario?: string | null;   // se mantiene por compatibilidad con backend
  activo?: boolean | null;   // no se edita/crea desde este form
}

type ToastType = "success" | "error" | "info";
interface Toast { id: string; type: ToastType; message: string }

/** ================== UTILS ================== */
const clsx = (...xs: Array<string | false | null | undefined>) => xs.filter(Boolean).join(" ");

const getCookie = (name: string) => {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(new RegExp(`(^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[2]) : "";
};

function tokenHeader(): Headers {
  const h = new Headers();
  h.set("Accept", "application/json");
  const t = getCookie("token");
  if (t) h.set("Authorization", `Bearer ${t}`);
  return h;
}

function mergeHeaders(...sets: (HeadersInit | undefined)[]): Headers {
  const out = new Headers();
  for (const s of sets) {
    if (!s) continue;
    const h = new Headers(s);
    h.forEach((v, k) => out.set(k, v));
  }
  return out;
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, credentials: "include", cache: "no-store" });
  } finally { clearTimeout(to); }
}

function parseJsonSafe<T>(txt: string): T | null { try { return JSON.parse(txt) as T; } catch { return null; } }

async function fetchJSON<T>(url: string, init: RequestInit = {}): Promise<T> {
  const isGet = !init.method || init.method.toUpperCase() === "GET";
  const headers = mergeHeaders(tokenHeader(), init.headers, isGet ? undefined : { "Content-Type": "application/json" });
  const res = await fetchWithTimeout(url, { ...init, headers });
  const ct = res.headers.get("content-type") || "";
  const txt = await res.text().catch(() => "");
  const body = ct.includes("application/json") ? parseJsonSafe<T>(txt) : null;
  if (!res.ok) {
    const msg =
      (body && typeof body === "object" && "message" in (body as object) ? (body as any).message : undefined) ??
      (body && typeof body === "object" && "error" in (body as object) ? (body as any).error : undefined) ??
      txt ?? `HTTP ${res.status}`;
    throw new Error(String(msg));
  }
  return (body ?? ({} as T));
}

/** ================== ROL UI ================== */
const roleBadge = (r: Rol) =>
  ({
    ADMINISTRADOR: "bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-300 dark:border-indigo-800",
    COORDINADOR:  "bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200 dark:bg-fuchsia-900/20 dark:text-fuchsia-300 dark:border-fuchsia-800",
    SUPERVISOR:   "bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-900/20 dark:text-sky-300 dark:border-sky-800",
    CLIENTE:      "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800",
  } as const)[r];

const roleAccent = (r: Rol) =>
  ({
    ADMINISTRADOR: { ring: "ring-indigo-500/20", grad: "from-indigo-600 to-violet-600", text: "text-indigo-700 dark:text-indigo-300" },
    COORDINADOR:  { ring: "ring-fuchsia-500/20", grad: "from-fuchsia-600 to-pink-600",  text: "text-fuchsia-700 dark:text-fuchsia-300" },
    SUPERVISOR:   { ring: "ring-sky-500/20",     grad: "from-sky-600 to-cyan-600",      text: "text-sky-700 dark:text-sky-300" },
    CLIENTE:      { ring: "ring-emerald-500/20", grad: "from-emerald-600 to-teal-600",  text: "text-emerald-700 dark:text-emerald-300" },
  } as const)[r];

/** ================== PASSWORD SCORE ================== */
function passwordScore(p: string): number {
  let s = 0;
  if (p.length >= 8) s += 30;
  if (/[A-Z]/.test(p)) s += 20;
  if (/[a-z]/.test(p)) s += 20;
  if (/[0-9]/.test(p)) s += 20;
  if (/[^A-Za-z0-9]/.test(p)) s += 10;
  return Math.min(s, 100);
}

/** ================== TOASTS ================== */
function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) {
  return (
    <div className="pointer-events-none fixed right-4 top-20 z-50 flex flex-col gap-2 md:right-6">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={clsx(
            "pointer-events-auto min-w-[280px] max-w-md animate-in slide-in-from-right-full fade-in duration-300",
            "rounded-lg border p-4 shadow-lg backdrop-blur-xl",
            t.type === "success" && "border-emerald-300 bg-emerald-50/95 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/95 dark:text-emerald-100",
            t.type === "error" && "border-rose-300 bg-rose-50/95 text-rose-900 dark:border-rose-700 dark:bg-rose-950/95 dark:text-rose-100",
            t.type === "info" && "border-sky-300 bg-sky-50/95 text-sky-900 dark:border-sky-700 dark:bg-sky-950/95 dark:text-sky-100"
          )}
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5">
              {t.type === "success" && <Check className="h-5 w-5" />}
              {t.type === "error" && <AlertCircle className="h-5 w-5" />}
              {t.type === "info" && <AlertCircle className="h-5 w-5" />}
            </div>
            <div className="flex-1 text-sm font-medium">{t.message}</div>
            <button onClick={() => onRemove(t.id)} className="opacity-60 hover:opacity-100">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/** ================== PÁGINA ================== */
export default function Usuarios() {
  const [usuarios, setUsuarios] = useState<UserData[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [localidades, setLocalidades] = useState<Localidad[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [filterRol, setFilterRol] = useState<Rol | "">("");
  const [filterActivo, setFilterActivo] = useState<"all" | "active" | "inactive">("all");
  const [showFilters, setShowFilters] = useState(false);

  const [editing, setEditing] = useState<UserData | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<UserData | null>(null);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = Math.random().toString(36);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const [list, emps, locs] = await Promise.all([
        fetchJSON<UserData[]>(`${API_BASE}/usuarios`, { signal: ac.signal }),
        fetchJSON<Empresa[]>(`${API_BASE}/empresas`, { signal: ac.signal }).catch(() => [] as Empresa[]),
        fetchJSON<Localidad[]>(`${API_BASE}/localidades`, { signal: ac.signal }).catch(() => [] as Localidad[]),
      ]);
      setUsuarios(Array.isArray(list) ? list : []);
      setEmpresas(Array.isArray(emps) ? emps : []);
      setLocalidades(Array.isArray(locs) ? locs : []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al cargar datos";
      setErr(msg);
      setUsuarios([]);
      addToast("error", msg);
    } finally { setLoading(false); }
  }, [addToast]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const k = q.trim().toLowerCase();
    return usuarios.filter((u) => {
      const matchSearch =
        !k ||
        (u.nombre || "").toLowerCase().includes(k) ||
        (u.email || "").toLowerCase().includes(k) ||
        (u.rol || "").toLowerCase().includes(k) ||
        (u.empresa?.nombre || "").toLowerCase().includes(k);
      const matchRol = !filterRol || u.rol === filterRol;
      const matchActivo =
        filterActivo === "all" ||
        (filterActivo === "active" && u.activo) ||
        (filterActivo === "inactive" && !u.activo);
      return matchSearch && matchRol && matchActivo;
    });
  }, [usuarios, q, filterRol, filterActivo]);

  async function saveEdit(u: UserData & { localidadId?: number | null }) {
    try {
      // En edición mantenemos compatibilidad: enviamos nombre y también usuario = nombre
      const body: any = {
        nombre: String(u.nombre || "").trim(),
        usuario: String(u.nombre || "").trim(),
        email: String(u.email || "").trim(),
        rol: u.rol,
        empresaId: Number(u.empresaId),
        localidadId: u.localidad?.id ?? u.localidadId ?? null,
        // NO tocamos 'activo' aquí para no sobrescribir desde UI
      };
      await fetchJSON<unknown>(`${API_BASE}/usuarios/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      addToast("success", "Usuario actualizado correctamente");
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "Error al actualizar");
      throw e;
    }
  }

  async function createUser(u: {
    nombre: string;
    email: string;
    rol: Rol;
    empresaId: number;
    localidadId: number | null;
    password: string;
  }) {
    try {
  // createUser(...)
const body = {
  nombre: String(u.nombre || "").trim(),
  usuario: String(u.nombre || "").trim(),  // opcional pero útil si lo usas como username
  email: String(u.email || "").trim(),
  contrasena: u.password,
  empresaId: Number(u.empresaId),
  rol: u.rol,
  localidadId: u.localidadId,
  activo: true
};

      await fetchJSON<unknown>(`${API_BASE}/usuarios`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      addToast("success", "Usuario creado exitosamente");
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "Error al crear");
      throw e;
    }
  }

  async function deleteUser(u: UserData) {
    try {
      await fetchJSON<unknown>(`${API_BASE}/usuarios/${u.id}`, { method: "DELETE" });
      addToast("success", "Usuario eliminado");
      setDeleting(null);
      await load();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "Error al eliminar");
    }
  }

  const activeFiltersCount = [filterRol, filterActivo !== "all"].filter(Boolean).length;

  return (
    <div className="min-h-[calc(100vh-200px)]">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white md:text-3xl">Gestión de Usuarios</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Administra los usuarios del sistema</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => load()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <RefreshCw className={clsx("h-4 w-4", loading && "animate-spin")} />
              <span className="hidden sm:inline">Actualizar</span>
            </button>
            <button
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-emerald-500/30 transition-all hover:shadow-xl hover:shadow-emerald-500/40 active:scale-95"
            >
              <Plus className="h-4 w-4" />
              Nuevo Usuario
            </button>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="mt-4 space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por nombre, email, rol o empresa..."
                className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm shadow-sm transition-shadow focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-sky-500"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={clsx(
                "inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium shadow-sm transition-all",
                showFilters || activeFiltersCount > 0
                  ? "border-sky-500 bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              )}
            >
              <Filter className="h-4 w-4" />
              Filtros
              {activeFiltersCount > 0 && (
                <span className="rounded-full bg-sky-600 px-1.5 py-0.5 text-xs text-white">{activeFiltersCount}</span>
              )}
              <ChevronDown className={clsx("h-4 w-4 transition-transform", showFilters && "rotate-180")} />
            </button>
          </div>

          {showFilters && (
            <div className="animate-in slide-in-from-top-2 fade-in duration-200 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">Rol</label>
                  <select
                    value={filterRol}
                    onChange={(e) => setFilterRol(e.target.value as Rol | "")}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  >
                    <option value="">Todos los roles</option>
                    <option value="ADMINISTRADOR">Administrador</option>
                    <option value="COORDINADOR">Coordinador</option>
                    <option value="SUPERVISOR">Supervisor</option>
                    <option value="CLIENTE">Cliente</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">Estado</label>
                  <select
                    value={filterActivo}
                    onChange={(e) => setFilterActivo(e.target.value as typeof filterActivo)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  >
                    <option value="all">Todos</option>
                    <option value="active">Activos</option>
                    <option value="inactive">Inactivos</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={() => { setFilterRol(""); setFilterActivo("all"); setQ(""); }}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    Limpiar filtros
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-64 animate-pulse rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100 dark:border-slate-800 dark:from-slate-900 dark:to-slate-800" />
          ))}
        </div>
      ) : err ? (
        <div className="rounded-xl border border-rose-300 bg-rose-50 p-6 text-center dark:border-rose-700 dark:bg-rose-950/30">
          <AlertCircle className="mx-auto h-12 w-12 text-rose-600 dark:text-rose-400" />
          <p className="mt-3 font-medium text-rose-900 dark:text-rose-100">{err}</p>
          <button onClick={load} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm text-white hover:bg-rose-700">
            <RefreshCw className="h-4 w-4" /> Reintentar
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
          <Users className="mx-auto h-16 w-16 text-slate-300 dark:text-slate-700" />
          <h3 className="mt-4 text-lg font-medium text-slate-900 dark:text-slate-100">No se encontraron usuarios</h3>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            {q || filterRol || filterActivo !== "all" ? "Intenta ajustar los filtros de búsqueda" : "Comienza creando un nuevo usuario"}
          </p>
          {(q || filterRol || filterActivo !== "all") && (
            <button onClick={() => { setQ(""); setFilterRol(""); setFilterActivo("all"); }} className="mt-4 text-sm text-sky-600 hover:text-sky-700 dark:text-sky-400">
              Limpiar filtros
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Mostrando <span className="font-semibold">{filtered.length}</span> de <span className="font-semibold">{usuarios.length}</span> usuarios
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((u, idx) => (
              <article
                key={u.id}
                className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all hover:shadow-lg dark:border-slate-800 dark:bg-slate-900"
                style={{ animationDelay: `${idx * 30}ms` }}
              >
                <div className={clsx("absolute right-0 top-0 h-1 w-full", u.activo ? "bg-gradient-to-r from-emerald-500 to-teal-500" : "bg-gradient-to-r from-slate-300 to-slate-400 dark:from-slate-700 dark:to-slate-600")} />
                <div className="p-5">
                  <div className="mb-4 flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="grid h-12 w-12 place-items-center rounded-xl text-xl font-bold shadow-inner text-white bg-gradient-to-br from-slate-700 to-slate-900">
                        {(u.nombre || "?").trim().split(/\s+/).slice(0,2).map(s=>s[0]?.toUpperCase()||"").join("") || "?"}
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold text-slate-900 dark:text-white">{u.nombre}</h3>
                        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                          {u.activo ? (<><div className="h-2 w-2 rounded-full bg-emerald-500" />Activo</>) : (<><div className="h-2 w-2 rounded-full bg-slate-400" />Inactivo</>)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 shrink-0 text-slate-400" />
                      <span className="truncate text-slate-700 dark:text-slate-300">{u.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Building className="h-4 w-4 shrink-0 text-slate-400" />
                      <span className="truncate text-slate-700 dark:text-slate-300">{u.empresa?.nombre || "Sin empresa"}</span>
                    </div>
                    {u.localidad && (
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
                        <span className="truncate text-slate-700 dark:text-slate-300">
                          {u.localidad.nombre}{u.localidad.estado && `, ${u.localidad.estado}`}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4">
                    <span className={clsx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", roleBadge(u.rol))}>
                      {u.rol}
                    </span>
                  </div>

                  <div className="mt-4 flex gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                    <button
                      onClick={() => setEditing(u)}
                      className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      <Edit2 className="mx-auto h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setDeleting(u)}
                      className="flex-1 rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-50 dark:border-rose-700 dark:bg-rose-950/30 dark:text-rose-400 dark:hover:bg-rose-950/50"
                    >
                      <Trash2 className="mx-auto h-4 w-4" />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      {/* Modals */}
      {creating && (
        <Modal title="Crear Nuevo Usuario" onClose={() => setCreating(false)}>
          <UserForm
            mode="create"
            empresas={empresas}
            localidades={localidades}
            onSubmit={async (values) => {
              await createUser(values as any);
              setCreating(false);
              await load();
            }}
            onCancel={() => setCreating(false)}
          />
        </Modal>
      )}

      {editing && (
        <Modal title="Editar Usuario" onClose={() => setEditing(null)}>
          <UserForm
            mode="edit"
            empresas={empresas}
            localidades={localidades}
            initial={editing}
            onSubmit={async (values) => {
              await saveEdit({ ...editing, ...values, id: editing.id } as any);
              setEditing(null);
              await load();
            }}
            onCancel={() => setEditing(null)}
          />
        </Modal>
      )}

      {deleting && (
        <Modal title="Confirmar Eliminación" onClose={() => setDeleting(null)} maxWidth="max-w-md">
          <div className="space-y-4">
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 dark:border-rose-800 dark:bg-rose-950/30">
              <div className="flex gap-3">
                <AlertCircle className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
                <div className="text-sm text-rose-900 dark:text-rose-100">
                  <p className="font-medium">Esta acción no se puede deshacer</p>
                  <p className="mt-1">¿Estás seguro de eliminar a <span className="font-semibold">{deleting.nombre}</span>?</p>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleting(null)}
                className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                onClick={() => deleteUser(deleting)}
                className="flex-1 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700"
              >
                Eliminar
              </button>
            </div>
          </div>
        </Modal>
      )}

      <ToastContainer toasts={toasts} onRemove={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />
    </div>
  );
}

/** ================== MODAL ================== */
function Modal({
  title, children, onClose, maxWidth = "max-w-2xl",
}: { title: string; children: React.ReactNode; onClose: () => void; maxWidth?: string }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", h); document.body.style.overflow = ""; };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} />
      <div
        className={clsx(
          "relative w-full animate-in zoom-in-95 fade-in duration-200 slide-in-from-bottom-4",
          "max-h-[90vh] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900",
          maxWidth
        )}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/95">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

/** ================== FORM alineado a móvil ================== */
function UserForm({
  mode, empresas, localidades, initial, onSubmit, onCancel,
}: {
  mode: "create" | "edit";
  empresas: Empresa[];
  localidades: Localidad[];
  initial?: UserData | null;
  onSubmit: (values: {
    nombre: string;
    email: string;
    rol: Rol;
    empresaId: number;
    localidadId: number | null;
    password: string;
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<{
    nombre: string;
    email: string;
    rol: Rol;
    empresaId: number | "";
    localidadId: number | "";
    password: string;
    confirm: string;
  }>(() => ({
    nombre: initial?.nombre ?? "",
    email: initial?.email ?? "",
    rol: initial?.rol ?? "CLIENTE",
    empresaId: initial?.empresaId ?? (empresas[0]?.id ?? ""),
    localidadId: initial?.localidad?.id ?? (localidades[0]?.id ?? ""),
    password: "",
    confirm: "",
  }));

  const [saving, setSaving] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [touched, setTouched] = useState({ nombre: false, email: false, password: false, confirm: false });

  const pScore = passwordScore(form.password || "");
  const accent = roleAccent(form.rol);

  const errors = {
    nombre: touched.nombre && !form.nombre.trim() ? "El nombre es obligatorio" : "",
    email: touched.email && !form.email.trim() ? "El email es obligatorio" : "",
    password:
      touched.password && mode === "create" && !(form.password || "").trim()
        ? "La contraseña es obligatoria"
        : touched.password && mode === "create" && (form.password || "").length < 8
        ? "Mínimo 8 caracteres"
        : "",
    confirm:
      touched.confirm && mode === "create" && (form.password || "") !== (form.confirm || "")
        ? "Las contraseñas no coinciden"
        : "",
    empresa: !form.empresaId ? "Selecciona una empresa" : "",
    localidad: !form.localidadId ? "Selecciona una localidad" : "",
  };

  const canSubmit =
    form.nombre.trim() &&
    form.email.trim() &&
    !!form.empresaId &&
    !!form.localidadId &&
    (mode === "edit" || ((form.password || "").length >= 8 && form.password === form.confirm)) &&
    !saving;

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      await onSubmit({
        nombre: form.nombre.trim(),
        email: form.email.trim(),
        rol: form.rol,
        empresaId: Number(form.empresaId),
        localidadId: form.localidadId ? Number(form.localidadId) : null,
        password: form.password, // se mapea a 'contrasena' en createUser
      });
    } finally { setSaving(false); }
  };

  const baseInput = "w-full rounded-xl border px-3.5 py-3 pl-11 text-sm shadow-sm transition-all focus:outline-none focus:ring-2 dark:bg-slate-800 dark:text-slate-100";
  const okCls = "border-slate-300 focus:border-sky-500 focus:ring-sky-500/20 dark:border-slate-700";
  const errCls = "border-rose-500 focus:border-rose-500 focus:ring-rose-500/20";

  return (
    <div className="space-y-5">
      <div className={clsx("rounded-2xl border p-4 shadow-sm dark:border-slate-700", `ring-2 ${accent.ring}`)}>
        <div className={clsx("inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold dark:bg-slate-800", accent.text)}>
          <UserIcon className="h-4 w-4" /> {mode === "create" ? "Crear Nuevo Usuario" : "Editar Usuario"}
        </div>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Mismos campos y flujo que la app móvil.</p>
      </div>

      {/* Nombre */}
      <div className="relative">
        <UserIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={form.nombre}
          onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
          onBlur={() => setTouched((t) => ({ ...t, nombre: true }))}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          className={clsx(baseInput, errors.nombre ? errCls : okCls)}
          placeholder="Nombre"
        />
        {errors.nombre && <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{errors.nombre}</p>}
      </div>

      {/* Email */}
      <div className="relative">
        <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="email"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          onBlur={() => setTouched((t) => ({ ...t, email: true }))}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          className={clsx(baseInput, errors.email ? errCls : okCls)}
          placeholder="Correo electrónico"
        />
        {errors.email && <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{errors.email}</p>}
      </div>

      {/* Passwords solo en create */}
      {mode === "create" && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type={showPass ? "text" : "password"}
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                className={clsx(baseInput, errors.password ? errCls : okCls, "pr-12")}
                placeholder="Contraseña (mínimo 8)"
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label={showPass ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
              {errors.password && <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{errors.password}</p>}
            </div>

            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type={showConfirm ? "text" : "password"}
                value={form.confirm}
                onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))}
                onBlur={() => setTouched((t) => ({ ...t, confirm: true }))}
                className={clsx(baseInput, errors.confirm ? errCls : okCls, "pr-12")}
                placeholder="Confirmar contraseña"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label={showConfirm ? "Ocultar confirmación" : "Mostrar confirmación"}
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
              {errors.confirm && <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{errors.confirm}</p>}
            </div>
          </div>

          {/* Indicador de fuerza */}
          <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
            <span>Seguridad de la contraseña</span>
            <span className={clsx(passwordScore(form.password) < 40 ? "text-rose-600" : passwordScore(form.password) < 70 ? "text-amber-600" : "text-emerald-600")}>
              {passwordScore(form.password)}%
            </span>
          </div>
          <div className="h-2 w-full rounded bg-slate-200">
            <div
              className={clsx("h-2 rounded", pScore < 40 ? "bg-rose-500" : pScore < 70 ? "bg-amber-500" : "bg-emerald-500")}
              style={{ width: `${pScore}%` }}
            />
          </div>
        </>
      )}

      {/* Rol */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Rol</label>
        <div className="grid grid-cols-2 gap-2">
          {(["CLIENTE", "SUPERVISOR", "COORDINADOR", "ADMINISTRADOR"] as Rol[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setForm((f) => ({ ...f, rol: r }))}
              className={clsx(
                "rounded-xl border px-3 py-2.5 text-sm font-medium transition-all",
                form.rol === r
                  ? "border-sky-500 bg-sky-50 text-sky-700 shadow-sm ring-2 ring-sky-500/20 dark:bg-sky-950/50 dark:text-sky-300"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Empresa y Localidad */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="relative">
          <Building className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <select
            value={form.empresaId}
            onChange={(e) => setForm((f) => ({ ...f, empresaId: Number(e.target.value) }))}
            className={clsx(baseInput, !form.empresaId ? errCls : okCls, "appearance-none")}
          >
            <option value="">Selecciona una empresa</option>
            {empresas.map((e) => (<option key={e.id} value={e.id}>{e.nombre}</option>))}
          </select>
          {!form.empresaId && <p className="mt-1 text-xs text-rose-600">{errors.empresa}</p>}
        </div>

        <div className="relative">
          <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <select
            value={form.localidadId}
            onChange={(e) => setForm((f) => ({ ...f, localidadId: Number(e.target.value) }))}
            className={clsx(baseInput, !form.localidadId ? errCls : okCls, "appearance-none")}
          >
            <option value="">Selecciona una localidad</option>
            {localidades.map((l) => (<option key={l.id} value={l.id}>{l.nombre}{l.estado ? `, ${l.estado}` : ""}</option>))}
          </select>
          {!form.localidadId && <p className="mt-1 text-xs text-rose-600">{errors.localidad}</p>}
        </div>
      </div>

      {/* Botones */}
      <div className="flex gap-3 border-t border-slate-200 pt-5 dark:border-slate-800">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className={clsx(
            "flex-1 rounded-xl px-4 py-2.5 text-sm font-medium text-white shadow-lg transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-50",
            "bg-gradient-to-r",
            roleAccent(form.rol).grad,
            "shadow-emerald-500/30 hover:shadow-xl"
          )}
        >
          {saving ? (<span className="flex items-center justify-center gap-2"><RefreshCw className="h-4 w-4 animate-spin" />{mode === "create" ? "Creando..." : "Guardando..."}</span>)
                  : (mode === "create" ? "Crear Usuario" : "Guardar Cambios")}
        </button>
      </div>
    </div>
  );
}
