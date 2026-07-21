"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Bell, Loader2 } from "lucide-react";
import { assertSameOriginUrl, getNotificationRuntimePolicy } from "@/lib/notificationRuntime";
import { preloadNotificationSound, primeNotificationSound } from "@/lib/notificationSound";

type PromptState =
  | "checking"
  | "idle"
  | "requesting"
  | "granted"
  | "denied"
  | "unsupported"
  | "error";

function safeSet(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // localStorage can fail in private/restricted browser modes.
  }
}

function browserPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) return null;
  return Notification.permission;
}

export default function FirebaseNotificationPrompt() {
  const pathname = usePathname();
  const policy = useMemo(() => getNotificationRuntimePolicy(), []);
  const [state, setState] = useState<PromptState>("checking");
  const shouldRegisterToken = policy.enabled && !pathname.startsWith("/login");

  const enableNotifications = useCallback(async () => {
    if (!shouldRegisterToken) return;
    setState("requesting");

    try {
      const { primeNotificationSound } = await import("@/lib/notificationSound");
      await primeNotificationSound().catch(() => undefined);
      const {
        registerFirebaseNotificationToken,
        requestFirebaseNotificationToken,
      } = await import("@/lib/firebase");
      const token = await requestFirebaseNotificationToken();
      const permission = browserPermission();

      if (token) {
        if (shouldRegisterToken) {
          await registerFirebaseNotificationToken(token);
        }
        safeSet(policy.statusKey, "granted");
        setState("granted");
        return;
      }

      if (permission === "denied") {
        safeSet(policy.statusKey, "denied");
        setState("denied");
        return;
      }

      setState("error");
    } catch (error) {
      console.warn("No se pudo activar Firebase Messaging.", error);
      setState("error");
    }
  }, [policy.statusKey, shouldRegisterToken]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!shouldRegisterToken) {
      setState("unsupported");
      return;
    }
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !window.isSecureContext) {
      setState("unsupported");
      return;
    }

    const permission = Notification.permission;

    if (permission === "granted") {
      safeSet(policy.statusKey, "granted");
      const timeoutId = window.setTimeout(() => void enableNotifications(), 1200);
      return () => window.clearTimeout(timeoutId);
    }

    if (permission === "denied") {
      safeSet(policy.statusKey, "denied");
      setState("denied");
      return;
    }

    setState("idle");
  }, [enableNotifications, policy.statusKey, shouldRegisterToken]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!policy.enabled) return;

    let audioReady = false;
    preloadNotificationSound();

    const primeAudio = () => {
      void primeNotificationSound()
        .then((ready) => {
          if (!ready) return;
          audioReady = true;
          window.removeEventListener("pointerdown", primeAudio, true);
          window.removeEventListener("keydown", primeAudio, true);
        });
    };

    window.addEventListener("pointerdown", primeAudio, true);
    window.addEventListener("keydown", primeAudio, true);

    return () => {
      if (audioReady) return;
      window.removeEventListener("pointerdown", primeAudio, true);
      window.removeEventListener("keydown", primeAudio, true);
    };
  }, [policy.enabled]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!policy.enabled) return;
    if (browserPermission() !== "granted") return;

    let unsubscribe: (() => void) | undefined;
    let mounted = true;

    const timeoutId = window.setTimeout(() => {
      void import("@/lib/firebase")
        .then(({ listenFirebaseForegroundMessages }) =>
          listenFirebaseForegroundMessages((payload) => {
          if (browserPermission() !== "granted") return;

          const title = payload.notification?.title || payload.data?.title || "Nueva notificacion";
          const body = payload.notification?.body || payload.data?.body || "";
          const url = assertSameOriginUrl(payload.data?.url || "/", "/");
          const tag =
            payload.data?.tag ||
            payload.data?.eventId ||
            payload.data?.movimientoId ||
            payload.data?.incidenteId ||
            payload.data?.tipo ||
            title;

          const options: NotificationOptions & Record<string, unknown> = {
            body,
            icon: payload.notification?.icon || "/icons/cosaif-192.png",
            badge: "/icons/cosaif-192.png",
            tag,
            renotify: true,
            requireInteraction: true,
            silent: false,
            data: { ...payload.data, url },
          };
          void import("@/lib/notificationSound").then(({ playNotificationSound }) =>
            playNotificationSound([
              payload.data?.tipo,
              payload.data?.eventType,
              payload.data?.source,
            ].filter(Boolean).join(":"))
          );
          const notification = new Notification(title, options);
          notification.onclick = (event) => {
            event.preventDefault();
            window.focus();
            window.location.assign(url);
          };
          })
        )
        .then((nextUnsubscribe) => {
          if (mounted) unsubscribe = nextUnsubscribe;
        });
    }, 1200);

    return () => {
      mounted = false;
      window.clearTimeout(timeoutId);
      unsubscribe?.();
    };
  }, [policy.enabled, state]);

  const copy = useMemo(() => {
    if (state === "denied") {
      return {
        title: "Notificaciones bloqueadas",
        body: "Activalas desde permisos del sitio para poder entrar.",
        action: "Revisar permiso",
      };
    }

    if (state === "error") {
      return {
        title: "No se pudieron activar",
        body: "Revisa la configuracion de Firebase y la llave VAPID.",
        action: "Reintentar",
      };
    }

    return {
      title: "Activar notificaciones",
      body: "Recibe avisos de COSAIF en este dispositivo.",
      action: "Activar",
    };
  }, [state]);

  const shouldShow = state === "idle" || state === "requesting" || state === "error" || state === "denied";
  if (!shouldShow) return null;

  return (
    <div className="fixed right-3 top-[calc(env(safe-area-inset-top)+1rem)] z-50 w-[min(25rem,calc(100vw-1.5rem))] rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg shadow-slate-900/10 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
          <Bell className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-5 text-slate-900 dark:text-white">
            {copy.title}
          </p>
          <p className="mt-0.5 text-xs font-medium leading-5 text-slate-600 dark:text-slate-300">
            {copy.body}
          </p>
          <button
            type="button"
            onClick={enableNotifications}
            disabled={state === "requesting"}
            className="mt-3 inline-flex min-h-9 items-center justify-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2 disabled:cursor-wait disabled:opacity-75 dark:focus:ring-offset-slate-900"
          >
            {state === "requesting" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Bell className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span>{state === "requesting" ? "Activando" : copy.action}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
