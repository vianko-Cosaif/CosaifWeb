"use client";
import { useEffect, useState } from "react";
import { User, Lock, Eye, EyeOff, LogIn, AlertCircle } from "lucide-react";
import { getNotificationRuntimePolicy } from "@/lib/notificationRuntime";
import { isClienteAreaRole, isTorreonLocalidadId } from "@/lib/torreonLocalidad";
import { getRoleCapabilities } from "@/lib/accessControl";

const DEST: Record<string, string> = {
  CLIENTE: "/cliente",
  SUPERVISOR: "/supervisor",
  MAQUINISTA: "/maquinista",
  OPERADOR: "/operador",
  ADMINISTRADOR: "/administrador",
  COMERCIAL: "/comercial",
  COORDINADOR: "/coordinador",
};

const API_BASE = "/bff";
const LOGIN_PATH = "/login";

type NotificationGateState = "checking" | "required" | "requesting" | "ready" | "denied" | "unsupported" | "disabled" | "error";

export default function LoginForm() {
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [notificationPolicy] = useState(() => getNotificationRuntimePolicy());
  const [notificationGate, setNotificationGate] = useState<NotificationGateState>("checking");

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

  async function prepareNotificationAfterLogin() {
    if (!notificationPolicy.enabled) return true;

    if (typeof window === "undefined") return !notificationPolicy.requiredForLogin;

    if (!("Notification" in window) || !("serviceWorker" in navigator) || !window.isSecureContext) {
      setNotificationGate("unsupported");
      setErr("Este navegador no permite notificaciones en esta página.");
      return !notificationPolicy.requiredForLogin;
    }

    if (Notification.permission === "denied") {
      setNotificationGate("denied");
      setErr("Activa las notificaciones en permisos del sitio para poder iniciar sesión.");
      return !notificationPolicy.requiredForLogin;
    }

    if (Notification.permission === "granted") {
      setNotificationGate("ready");
      return true;
    }

    setNotificationGate("requesting");

    try {
      const permission = await Notification.requestPermission();

      if (permission === "granted") {
        setNotificationGate("ready");
        return true;
      }

      if (permission === "denied") {
        setNotificationGate("denied");
        setErr("Activa las notificaciones en permisos del sitio para poder iniciar sesión.");
        return !notificationPolicy.requiredForLogin;
      }

      setNotificationGate("error");
      setErr("Debes aceptar las notificaciones para poder iniciar sesión.");
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
    try {
      // Pedimos el permiso requerido antes de crear una sesión autenticada.
      const notificationsReady = await prepareNotificationAfterLogin();
      if (!notificationsReady) return;

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

      const role = String(payload?.user?.rol || payload?.role || "").toUpperCase();
      const uid = Number(payload?.user?.id ?? payload?.id ?? NaN);
      const empresaId = Number(payload?.user?.empresaId ?? payload?.user?.empresa?.id ?? NaN);
      const empresaNombre = payload?.user?.empresa?.nombre || "";
      const localidadId = Number(payload?.user?.localidadId ?? NaN);

      if (!role || !Number.isFinite(uid)) {
        setErr("Respuesta inválida del servidor");
        return;
      }

      const capabilities = getRoleCapabilities(role);
      if (!capabilities.canUseWeb) {
        setErr(`El acceso web para el rol ${capabilities.label} todavía no está habilitado.`);
        return;
      }

      // 2) Persistir sólo el perfil de interfaz. La sesión y el token ya fueron
      // emitidos como cookies por /bff/login después de validar el backend.
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

      // 3) Registrar el dispositivo antes de salir del login. Esto deja la
      // suscripción lista para recibir push aunque después se cierre la PWA.
      if (
        notificationPolicy.enabled &&
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        try {
          const {
            registerFirebaseNotificationToken,
            requestFirebaseNotificationToken,
          } = await import("@/lib/firebase");
          const firebaseToken = await requestFirebaseNotificationToken({ requestPermission: false });
          if (firebaseToken) {
            await registerFirebaseNotificationToken(
              firebaseToken,
              undefined,
              Number.isFinite(localidadId) ? localidadId : undefined,
            );
          }
        } catch (notificationError) {
          // El login no se invalida por una caída temporal de FCM; el prompt
          // global volverá a sincronizar el token al cargar la aplicación.
          console.warn("No se pudo registrar FCM durante el login.", notificationError);
        }
      }

      // 4) Redirección por rol, sin query ?loc
      const shouldEnterTorreon =
        role === "ARRASTRE_TORREON" ||
        (role === "CLIENTE" && !capabilities.canSwitchLocalidad && isTorreonLocalidadId(localidadId));
      const destBase = isClienteAreaRole(role) && shouldEnterTorreon
        ? "/cliente/torreon"
        : DEST[role] || capabilities.home;
      window.location.assign(destBase);
    } catch {
      setErr("No hay conexión con el servicio");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="relative p-6 sm:p-8" aria-describedby={err ? "login-error" : undefined}>
      {loading && <div className="top-loader" />}

      <div className="space-y-4">
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
              className="absolute right-1 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              aria-label={show ? "ocultar contraseña" : "mostrar contraseña"}
              aria-pressed={show}
            >
              {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {err && (
          <p id="login-error" role="alert" aria-live="assertive" className="flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400">
            <AlertCircle className="h-4 w-4" /> {err}
          </p>
        )}
      </div>

      {notificationGate !== "ready" && notificationGate !== "disabled" && (
        <p aria-live="polite" className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {notificationGate === "denied"
              ? "Las notificaciones están bloqueadas. Cambia el permiso del sitio a Permitir para entrar."
              : notificationGate === "unsupported"
                ? "Este navegador no permite notificaciones aquí."
                : notificationGate === "requesting"
                  ? "Activando notificaciones..."
                  : notificationPolicy.requiredForLogin
                    ? "Después de validar tus credenciales se pedirá permiso de notificaciones."
                    : "Puedes activar notificaciones después de entrar."}
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
