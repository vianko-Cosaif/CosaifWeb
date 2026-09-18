"use client";
import { logicalNotificationId } from "@/lib/logicalNotificationId";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Bell, Loader2, X } from "lucide-react";
import { matchesNotificationAudience } from "@/lib/notificationAudience";
import { currentNotificationViewer } from "@/lib/notificationViewer";
import { claimNotification, shouldDeferPushToRealtime } from "@/lib/notificationDelivery";
import { assertSameOriginUrl, getNotificationRuntimePolicy } from "@/lib/notificationRuntime";

type PromptState =
  "checking" | "idle" | "requesting" | "granted" | "denied" | "unsupported" | "error";

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
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const [listenerAttempt, setListenerAttempt] = useState(0);
  const [dismissed, setDismissed] = useState<boolean | null>(null);
  const dismissalKey = `${policy.statusKey}:dismissed`;
  const shouldRegisterToken = policy.enabled && !pathname.startsWith("/login");
  const generationRef = useRef(0);
  const requestingRef = useRef(false);

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(dismissalKey) === "1");
    } catch {
      setDismissed(false);
    }
  }, [dismissalKey]);

  useEffect(() => {
    generationRef.current += 1;
    return () => {
      // Una importación o solicitud ya iniciada puede terminar después de salir.
      generationRef.current += 1;
      requestingRef.current = false;
    };
  }, [shouldRegisterToken]);

  const enableNotifications = useCallback(async () => {
    if (!shouldRegisterToken || requestingRef.current) return;
    const generation = generationRef.current;
    const isCurrent = () => generationRef.current === generation;
    requestingRef.current = true;
    setState("requesting");

    try {
      // Pedir permiso dentro del gesto de usuario, antes de descargar Firebase.
      const currentPermission =
        browserPermission() === "default"
          ? await Notification.requestPermission()
          : browserPermission();
      if (!isCurrent()) return;
      setPermission(currentPermission);
      if (currentPermission !== "granted") {
        if (currentPermission === "denied") safeSet(policy.statusKey, "denied");
        setState(currentPermission === "denied" ? "denied" : "idle");
        return;
      }
      const { registerFirebaseNotificationToken, requestFirebaseNotificationToken } =
        await import("@/lib/firebase");
      if (!isCurrent()) return;
      const token = await requestFirebaseNotificationToken({ requestPermission: false });
      if (!isCurrent()) return;
      if (token) {
        await registerFirebaseNotificationToken(token);
        if (!isCurrent()) return;
        safeSet(policy.statusKey, "granted");
        setState("granted");
      } else {
        setState("error");
      }
    } catch (error) {
      if (!isCurrent()) return;
      console.warn("No se pudo activar Firebase Messaging.", error);
      setState("error");
    } finally {
      if (isCurrent()) requestingRef.current = false;
    }
  }, [policy.statusKey, shouldRegisterToken]);

  useEffect(() => {
    if (
      !shouldRegisterToken ||
      !("Notification" in window) ||
      !("serviceWorker" in navigator) ||
      !window.isSecureContext
    ) {
      setState("unsupported");
      setPermission(null);
      return;
    }
    const currentPermission = Notification.permission;
    setPermission(currentPermission);
    if (currentPermission === "granted") {
      safeSet(policy.statusKey, "granted");
      setState("granted");
      const timeoutId = window.setTimeout(() => void enableNotifications(), 1200);
      return () => window.clearTimeout(timeoutId);
    }
    if (currentPermission === "denied") {
      safeSet(policy.statusKey, "denied");
      setState("denied");
      return;
    }
    setState("idle");
  }, [enableNotifications, policy.statusKey, shouldRegisterToken]);

  useEffect(() => {
    if (!shouldRegisterToken || permission !== "granted") return;
    let disposed = false;
    let priming = false;
    let sound: typeof import("@/lib/notificationSound") | undefined;
    let loading: Promise<void> | undefined;
    const prepareSound = () => {
      loading ??= import("@/lib/notificationSound")
        .then((module) => {
          if (disposed) return;
          sound = module;
          module.preloadNotificationSound();
        })
        .catch((error) => {
          if (!disposed) console.warn("No se pudo preparar el audio de notificaciones.", error);
        });
      return loading;
    };
    const removeListeners = () => {
      window.removeEventListener("pointerdown", primeAudio, true);
      window.removeEventListener("keydown", primeAudio, true);
    };
    const primeAudio = () => {
      if (!sound) {
        void prepareSound();
        return;
      }
      if (priming) return;
      priming = true;
      void sound
        .primeNotificationSound()
        .then((ready) => {
          if (ready) removeListeners();
        })
        .finally(() => {
          priming = false;
        });
    };
    const timerId = window.setTimeout(() => void prepareSound(), 1200);
    window.addEventListener("pointerdown", primeAudio, true);
    window.addEventListener("keydown", primeAudio, true);
    return () => {
      disposed = true;
      window.clearTimeout(timerId);
      removeListeners();
    };
  }, [shouldRegisterToken, permission]);

  useEffect(() => {
    if (!shouldRegisterToken || permission !== "granted") return;
    let unsubscribe: (() => void) | undefined;
    let mounted = true;
    const timeoutId = window.setTimeout(() => {
      void (async () => {
        const { listenFirebaseForegroundMessages } = await import("@/lib/firebase");
        if (!mounted) return;
        const nextUnsubscribe = await listenFirebaseForegroundMessages(async (payload) => {
          if (!mounted || browserPermission() !== "granted") return;
          if (!matchesNotificationAudience(payload.data, currentNotificationViewer())) return;
          if (document.visibilityState === "visible" && shouldDeferPushToRealtime(payload.data))
            return;
          const eventId = logicalNotificationId(payload.data ?? {}) || payload.data?.eventId || payload.messageId;
          if (eventId && !(await claimNotification(eventId))) return;
          if (!mounted) return;
          const title = payload.notification?.title || payload.data?.title || "Nueva notificación";
          const body = payload.notification?.body || payload.data?.body || "";
          window.dispatchEvent(new CustomEvent("cosaif:activity-event", { detail: {
            eventId, title, description: body, source: payload.data?.localidadId ? `Patio ${payload.data.localidadId}` : "Operación",
          } }));
          const url = assertSameOriginUrl(payload.data?.url || "/", "/");
          const tag =
            payload.data?.eventId ||
            payload.data?.tag ||
            payload.data?.movimientoId ||
            payload.data?.incidenteId ||
            payload.data?.tipo ||
            title;
          const options: NotificationOptions & Record<string, unknown> = {
            body,
            icon: payload.notification?.icon || "/icons/cosaif-192.png",
            badge: "/icons/cosaif-192.png",
            tag,
            renotify: false,
            requireInteraction: false,
            silent: true,
            data: { ...payload.data, url },
          };
          void import("@/lib/notificationSound")
            .then(({ playNotificationSound }) => {
              if (mounted)
                return playNotificationSound(
                  [payload.data?.tipo, payload.data?.eventType, payload.data?.source]
                    .filter(Boolean)
                    .join(":"),
                );
            })
            .catch((error) =>
              console.warn("No se pudo reproducir el aviso de notificación.", error),
            );
          // The visible page already shows its one in-app notice.
          if (document.visibilityState === "visible") return;
          const notification = new Notification(title, options);
          notification.onclick = (event) => {
            event.preventDefault();
            notification.close();
            window.focus();
            window.location.assign(url);
          };
        });
        // Firebase resuelve de forma asíncrona: el cleanup puede haber ocurrido.
        if (mounted) unsubscribe = nextUnsubscribe;
        else nextUnsubscribe?.();
      })().catch((error) => {
        if (!mounted) return;
        console.warn("No se pudo escuchar notificaciones en primer plano.", error);
        setState("error");
      });
    }, 1200);
    return () => {
      mounted = false;
      window.clearTimeout(timeoutId);
      unsubscribe?.();
    };
  }, [shouldRegisterToken, permission, listenerAttempt]);

  const copy = useMemo(() => {
    if (state === "denied") {
      return {
        title: "Notificaciones bloqueadas",
        body: "Actívalas en los permisos del sitio para recibir avisos de movimientos e incidentes.",
        action: "Revisar permiso",
      };
    }

    if (state === "error") {
      return {
        title: "No se pudieron activar",
        body: "No se pudieron preparar los avisos en este dispositivo. Puedes seguir trabajando y reintentarlo.",
        action: "Reintentar",
      };
    }

    return {
      title: "Activar notificaciones",
      body: "Recibe avisos de COSAIF en este dispositivo.",
      action: "Activar",
    };
  }, [state]);

  const shouldShow =
    state === "idle" || state === "requesting" || state === "error" || state === "denied";
  if (!shouldRegisterToken || !shouldShow || dismissed !== false) return null;

  return (
    <div className="fixed right-3 top-[calc(env(safe-area-inset-top)+4.5rem)] z-50 w-[min(25rem,calc(100vw-1.5rem))] rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg shadow-slate-900/10 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
      <button
        type="button"
        aria-label="Ocultar aviso de notificaciones"
        title="Ocultar aviso"
        onClick={() => {
          setDismissed(true);
          safeSet(dismissalKey, "1");
        }}
        className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-400 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
          <Bell className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="pr-7 text-sm font-semibold leading-5 text-slate-900 dark:text-white">
            {copy.title}
          </p>
          <p className="mt-0.5 text-xs font-medium leading-5 text-slate-600 dark:text-slate-300">
            {copy.body}
          </p>
          <button
            type="button"
            onClick={() => {
              setListenerAttempt((attempt) => attempt + 1);
              void enableNotifications();
            }}
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
