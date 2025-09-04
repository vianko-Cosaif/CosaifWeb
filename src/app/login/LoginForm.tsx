"use client";
import { useState } from "react";
import { User, Lock, Eye, EyeOff, LogIn, AlertCircle } from "lucide-react";

const DEST: Record<string, string> = {
  CLIENTE: "/cliente",
  SUPERVISOR: "/supervisor",
  MAQUINISTA: "/maquinista",
  OPERADOR: "/operador",
  ADMINISTRADOR: "/admin",
  COORDINADOR: "/coordinador",
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "/xapi";
const LOGIN_PATH = "/usuarios/login";

export default function LoginForm() {
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    setErr("");

    const f = new FormData(e.currentTarget);
    const username = String(f.get("username") || "").trim();
    const password = String(f.get("password") || "");

    if (!username || !password) {
      setErr("Completa usuario y contraseña");
      return;
    }

    setLoading(true);
    const trace = Math.random().toString(36).slice(2);

    try {
      // 1) Login a backend
      const r = await fetch(`${API_BASE}${LOGIN_PATH}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: username, contrasena: password }),
      });

      if (!r.ok) {
        let msg = "Credenciales inválidas";
        try { msg = String((await r.json())?.error || msg); } catch {}
        setErr(msg);
        return;
      }

      const payload = (await r.json()) as {
        token?: string;
        role?: string;
        user?: {
          id?: number;
          rol?: string;
          nombre?: string;
          empresaId?: number;
          empresa?: { id?: number; nombre?: string };
        };
        status?: number;
        id?: number; // por si el API lo manda en la raíz
      };

      const token = payload?.token;
      const role = String(payload?.user?.rol || payload?.role || "").toUpperCase();
      const uid = Number(payload?.user?.id ?? payload?.id ?? NaN);
      const empresaId = Number(payload?.user?.empresaId ?? payload?.user?.empresa?.id ?? NaN);
      const empresaNombre = payload?.user?.empresa?.nombre || "";

      if (!token || !role || !Number.isFinite(uid)) {
        setErr("Respuesta inválida del servidor");
        return;
      }

      // 2) Set cookies HttpOnly en Next (token/role)
      const setCookie = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          role,
          debug: { trace, status: payload?.status ?? r.status, role, user: payload?.user ?? null },
        }),
      });
      if (!setCookie.ok) {
        setErr("No se pudo establecer sesión");
        return;
      }

      // Cookie de apoyo no-httpOnly para poder leer el id en el cliente si hace falta
      document.cookie = `userId=${encodeURIComponent(String(uid))}; path=/; max-age=31536000; samesite=lax`;

      // 3) Persistir locId (si viene en URL) y user completo en localStorage
      const urlLoc = new URLSearchParams(location.search).get("loc");
      const storedLoc = localStorage.getItem("locId");
      const locId = urlLoc || storedLoc || "";
      if (locId) {
        try { localStorage.setItem("locId", String(locId)); } catch {}
        document.cookie = `locId=${encodeURIComponent(String(locId))}; path=/; max-age=31536000; samesite=lax`;
      }

      try {
        localStorage.setItem(
          "user",
          JSON.stringify({
            id: uid,
            rol: role,
            nombre: payload?.user?.nombre || "",
            empresaId: Number.isFinite(empresaId) ? empresaId : null,
            empresa: Number.isFinite(empresaId) ? { id: empresaId, nombre: empresaNombre } : null,
          })
        );
      } catch {}

      const base = DEST[role] || "/cliente";
      const dest = locId ? `${base}?loc=${encodeURIComponent(String(locId))}` : base;

      console.log("Ingresamos ✅", { trace, role, uid, empresaId, dest, locId });
      window.location.assign(dest);
    } catch {
      setErr("No hay conexión con el servicio");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="relative p-6 sm:p-8">
      {loading ? <div className="top-loader" /> : null}
      <h1 className="text-center text-xl font-semibold">Iniciar sesión</h1>

      <div className="mt-6 space-y-4">
        <div>
          <label htmlFor="username" className="mb-1 block text-xs text-slate-600 dark:text-slate-400">Usuario</label>
          <div className="relative">
            <User className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input id="username" name="username" type="text" autoComplete="username" placeholder="tu_usuario" required className="input pl-9" />
          </div>
        </div>

        <div>
          <label htmlFor="password" className="mb-1 block text-xs text-slate-600 dark:text-slate-400">Contraseña</label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input id="password" name="password" type={show ? "text" : "password"} autoComplete="current-password" placeholder="••••••••" required className="input pl-9 pr-12" />
            <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200" aria-label={show ? "ocultar contraseña" : "mostrar contraseña"}>
              {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {err && (
          <p className="flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400">
            <AlertCircle className="h-4 w-4" /> {err}
          </p>
        )}
      </div>

      <button type="submit" disabled={loading} className="btn-primary mt-6" aria-busy={loading}>
        <span className="inline-flex items-center justify-center gap-2">
          <LogIn className="h-5 w-5" /> {loading ? "Verificando…" : "Entrar"}
        </span>
      </button>
    </form>
  );
}
