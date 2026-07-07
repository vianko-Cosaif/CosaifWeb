"use client";
import { useEffect, useState } from "react";
import { User, Lock, Eye, EyeOff, LogIn, AlertCircle } from "lucide-react";
import {
  isFirebaseConfigured,
  registerFirebaseNotificationToken,
  requestFirebaseNotificationToken,
} from "@/lib/firebase";
import { getNotificationRuntimePolicy } from "@/lib/notificationRuntime";
import { isClienteAreaRole, isTorreonLocalidadId } from "@/lib/torreonLocalidad";
import { getRoleCapabilities } from "@/lib/accessControl";

const DEST: Record<string, string> = {
  CLIENTE: "/cliente",
  SUPERVISOR: "/supervisor",
  MAQUINISTA: "/maquinista",
  OPERADOR: "/operador",
  ADMINISTRADOR: "/administrador",
  COORDINADOR: "/coordinador",
};

const API_BASE = "/bff";
const LOGIN_PATH = "/login";

type NotificationGateState = "checking" | "required" | "requesting" | "ready" | "denied" | "unsupported" | "disabled" | "error";

function notificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) return undefined;
  return Notification.permission;
}

export default function LoginForm() {
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [notificationPolicy] = useState(() => getNotificationRuntimePolicy());
  const [notificationGate, setNotificationGate] = useState<NotificationGateState>("checking");
  const [notificationToken, setNotificationToken] = useState<string>();

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!notificationPolicy.enabled) {
      setNotificationGate("disabled");
      return;
    }
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !window.isSecureContext) {
      setNotificationGate("unsupported");
      return;
    }

    const permission = Notification.permission;
    if (permission === "granted") {
      setNotificationGate("ready");
      return;
    }
    if (permission === "denied") {
      setNotificationGate("denied");
      return;
    }

    setNotificationGate(notificationPolicy.requiredForLogin ? "required" : "ready");
  }, [notificationPolicy.enabled, notificationPolicy.requiredForLogin]);

  async function prepareNotificationAfterLogin(accessToken: string, localidadId?: number) {
    if (!notificationPolicy.enabled) return true;

    if (!isFirebaseConfigured()) {
      setNotificationGate("error");
      setErr("Firebase no esta configurado para notificaciones.");
      return !notificationPolicy.requiredForLogin;
    }

    if (typeof window === "undefined") return !notificationPolicy.requiredForLogin;

    if (!("Notification" in window) || !("serviceWorker" in navigator) || !window.isSecureContext) {
      setNotificationGate("unsupported");
      setErr("Este navegador no permite notificaciones en esta pagina.");
      return !notificationPolicy.requiredForLogin;
    }

    if (Notification.permission === "denied") {
      setNotificationGate("denied");
      setErr("Activa las notificaciones en permisos del sitio para poder iniciar sesion.");
      return !notificationPolicy.requiredForLogin;
    }

    if (notificationToken && Notification.permission === "granted") {
      await registerFirebaseNotificationToken(notificationToken, accessToken, localidadId);
      return true;
    }

    setNotificationGate("requesting");

    try {
      const token = await requestFirebaseNotificationToken();
      const permission = notificationPermission();

      if (token && permission === "granted") {
        setNotificationToken(token);
        await registerFirebaseNotificationToken(token, accessToken, localidadId);
        setNotificationGate("ready");
        return true;
      }

      if (permission === "denied") {
        setNotificationGate("denied");
        setErr("Activa las notificaciones en permisos del sitio para poder iniciar sesion.");
        return !notificationPolicy.requiredForLogin;
      }

      setNotificationGate("error");
      setErr("Debes aceptar las notificaciones para poder iniciar sesion.");
      return !notificationPolicy.requiredForLogin;
    } catch (error) {
      console.warn("No se pudo preparar Firebase Messaging antes del login.", error);
      setNotificationGate("error");
      setErr("No se pudieron activar las notificaciones. Revisa Firebase y la llave VAPID.");
      return !notificationPolicy.requiredForLogin;
    }
  }

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
      // 1) Login al backend
      const r = await fetch(`${API_BASE}${LOGIN_PATH}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: username, contrasena: password }),
      });

      if (!r.ok) {
        let msg = "Credenciales inválidas";
        try {
          msg = String((await r.json())?.error || msg);
        } catch {}
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
          localidadId?: number; // <- importante
        };
        status?: number;
        id?: number; // por si el API lo manda en la raíz
      };

      const token = payload?.token;
      const role = String(payload?.user?.rol || payload?.role || "").toUpperCase();
      const uid = Number(payload?.user?.id ?? payload?.id ?? NaN);
      const empresaId = Number(payload?.user?.empresaId ?? payload?.user?.empresa?.id ?? NaN);
      const empresaNombre = payload?.user?.empresa?.nombre || "";
      const localidadId = Number(payload?.user?.localidadId ?? NaN);

      if (!token || !role || !Number.isFinite(uid)) {
        setErr("Respuesta inválida del servidor");
        return;
      }

      const notificationsReady = await prepareNotificationAfterLogin(
        token,
        Number.isFinite(localidadId) ? localidadId : undefined
      );
      if (!notificationsReady) {
        return;
      }

      // 2) Set cookies HttpOnly en Next (token/role) + locId (no HttpOnly)
      const setCookie = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          role,
          // pasamos locId para que el server pueda setear cookie también
          locId: Number.isFinite(localidadId) ? localidadId : undefined,
          debug: { trace, status: payload?.status ?? r.status, role, user: payload?.user },
        }),
      });
      if (!setCookie.ok) {
        setErr("No se pudo establecer sesión");
        return;
      }

      // 3) Cookies legibles por el cliente para IDs no sensibles
      document.cookie = `userId=${encodeURIComponent(String(uid))}; path=/; max-age=31536000; samesite=lax`;
      if (Number.isFinite(empresaId) && empresaId > 0) {
        document.cookie = `empresaId=${encodeURIComponent(String(empresaId))}; path=/; max-age=31536000; samesite=lax`;
      }
      if (Number.isFinite(localidadId)) {
        document.cookie = `locId=${encodeURIComponent(String(localidadId))}; path=/; max-age=31536000; samesite=lax`;
      }

      // 4) Persistir user (opcional, sin localidad)
      try {
        const storedUser = {
          id: uid,
          rol: role,
          nombre: payload?.user?.nombre || "",
          ...(Number.isFinite(empresaId) ? { empresaId, empresa: { id: empresaId, nombre: empresaNombre } } : {}),
          ...(Number.isFinite(localidadId) ? { localidadId } : {}),
        };
        localStorage.setItem("user", JSON.stringify(storedUser));
      } catch {}

      // 5) Redirección por rol, sin query ?loc
      const capabilities = getRoleCapabilities(role);
      const shouldEnterTorreon =
        role === "ARRASTRE_TORREON" ||
        (role === "CLIENTE" && !capabilities.canSwitchLocalidad && isTorreonLocalidadId(localidadId));
      const destBase = isClienteAreaRole(role) && shouldEnterTorreon
        ? "/cliente/torreon"
        : DEST[role] || "/cliente";
      console.log("Ingresamos ✅", {
        trace,
        role,
        uid,
        empresaId,
        localidadId,
        dest: destBase,
      });
      window.location.assign(destBase);
    } catch {
      setErr("No hay conexión con el servicio");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="relative p-6 sm:p-8">
      {loading && <div className="top-loader" />}
      <h1 className="text-center text-xl font-semibold">Iniciar sesión</h1>

      <div className="mt-6 space-y-4">
        <div>
          <label
            htmlFor="username"
            className="mb-1 block text-xs text-slate-600 dark:text-slate-400"
          >
            Usuario
          </label>
          <div className="relative">
            <User className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              placeholder="tu_usuario"
              required
              className="input pl-9"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-1 block text-xs text-slate-600 dark:text-slate-400"
          >
            Contraseña
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              id="password"
              name="password"
              type={show ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              required
              className="input pl-9 pr-12"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              aria-label={show ? "ocultar contraseña" : "mostrar contraseña"}
            >
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

      {notificationGate !== "ready" && notificationGate !== "disabled" && (
        <p className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {notificationGate === "denied"
              ? "Las notificaciones estan bloqueadas. Cambia el permiso del sitio a Permitir para entrar."
              : notificationGate === "unsupported"
                ? "Este navegador no permite notificaciones aqui."
                : notificationGate === "requesting"
                  ? "Activando notificaciones..."
                  : notificationPolicy.requiredForLogin
                    ? "Despues de validar tus credenciales se pedira permiso de notificaciones."
                    : "Puedes activar notificaciones despues de entrar."}
          </span>
        </p>
      )}

      <button
        type="submit"
        disabled={loading || notificationGate === "requesting"}
        className="btn-primary mt-6"
        aria-busy={loading || notificationGate === "requesting"}
      >
        <span className="inline-flex items-center justify-center gap-2">
          <LogIn className="h-5 w-5" /> {loading ? "Verificando..." : "Entrar"}
        </span>
      </button>
    </form>
  );
}
