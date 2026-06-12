"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, Loader2, X } from "lucide-react";
import {
  listenFirebaseForegroundMessages,
  registerFirebaseNotificationToken,
  requestFirebaseNotificationToken,
} from "@/lib/firebase";

const STATUS_KEY = "cosaif:firebase-notifications:status:v1";
const DISMISSED_AT_KEY = "cosaif:firebase-notifications:dismissed-at:v1";
const DISMISS_MS = 3 * 24 * 60 * 60 * 1000;

type PromptState =
  | "checking"
  | "idle"
  | "requesting"
  | "granted"
  | "denied"
  | "hidden"
  | "unsupported"
  | "error";

function safeGet(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

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
  const [state, setState] = useState<PromptState>("checking");

  const enableNotifications = useCallback(async (showError: boolean) => {
    setState("requesting");

    try {
      const token = await requestFirebaseNotificationToken();
      const permission = browserPermission();

      if (token) {
        await registerFirebaseNotificationToken(token);
        safeSet(STATUS_KEY, "granted");
        setState("granted");
        return;
      }

      if (permission === "denied") {
        safeSet(STATUS_KEY, "denied");
        setState("denied");
        return;
      }

      setState(showError ? "error" : "hidden");
    } catch (error) {
      console.warn("No se pudo activar Firebase Messaging.", error);
      setState(showError ? "error" : "hidden");
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !window.isSecureContext) {
      setState("unsupported");
      return;
    }

    const permission = Notification.permission;

    if (permission === "granted") {
      safeSet(STATUS_KEY, "granted");
      void enableNotifications(false);
      return;
    }

    if (permission === "denied") {
      safeSet(STATUS_KEY, "denied");
      setState("denied");
      return;
    }

    const dismissedAt = Number(safeGet(DISMISSED_AT_KEY) || 0);
    const dismissedRecently = dismissedAt > 0 && Date.now() - dismissedAt < DISMISS_MS;

    setState(dismissedRecently ? "hidden" : "idle");
  }, [enableNotifications]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (browserPermission() !== "granted") return;

    let unsubscribe: (() => void) | undefined;
    let mounted = true;

    listenFirebaseForegroundMessages((payload) => {
      if (browserPermission() !== "granted") return;

      const title = payload.notification?.title || payload.data?.title || "Nueva notificacion";
      const body = payload.notification?.body || payload.data?.body || "";
      const url = payload.data?.url || "/";

      new Notification(title, {
        body,
        icon: payload.notification?.icon || "/icons/cosaif-192.png",
        data: { url },
      });
    }).then((nextUnsubscribe) => {
      if (mounted) unsubscribe = nextUnsubscribe;
    });

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, [state]);

  const copy = useMemo(() => {
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

  const dismiss = () => {
    safeSet(STATUS_KEY, "dismissed");
    safeSet(DISMISSED_AT_KEY, String(Date.now()));
    setState("hidden");
  };

  const shouldShow = state === "idle" || state === "requesting" || state === "error";
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
            onClick={() => enableNotifications(true)}
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
        <button
          type="button"
          onClick={dismiss}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
          aria-label="Cerrar notificaciones"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
