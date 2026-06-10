"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Info, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type InstallTarget = "native" | "ios" | "secure-context" | "browser-menu";

const DISMISSED_KEY = "cosaif:pwa-install-dismissed:v2";
const DISMISS_MS = 24 * 60 * 60 * 1000;

function isStandalone() {
  if (typeof window === "undefined") return true;
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

function getInstallTarget(hasNativePrompt: boolean): InstallTarget {
  if (hasNativePrompt) return "native";

  const userAgent = window.navigator.userAgent.toLowerCase();
  const isIos = /iphone|ipad|ipod/.test(userAgent);
  if (isIos) return "ios";
  if (!window.isSecureContext) return "secure-context";

  return "browser-menu";
}

function getInstallMessage(target: InstallTarget) {
  switch (target) {
    case "native":
      return "Lista para instalarse como app en este equipo.";
    case "ios":
      return "En iPhone o iPad abre Compartir y toca Agregar a pantalla de inicio.";
    case "secure-context":
      return "Para instalar desde celular u otra compu usa HTTPS con la IP real de la Mac. No abras 0.0.0.0; eso solo levanta el server.";
    default:
      return "Si no abre el instalador, usa el menu del navegador y elige Instalar app.";
  }
}

export default function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [installed, setInstalled] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [serviceWorkerReady, setServiceWorkerReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const dismissedAt = Number(window.localStorage.getItem(DISMISSED_KEY) || 0);
    const dismissedRecently = dismissedAt > 0 && Date.now() - dismissedAt < DISMISS_MS;
    setDismissed(dismissedRecently || isStandalone());

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((registration) => {
          setServiceWorkerReady(true);
          registration.waiting?.postMessage({ type: "SKIP_WAITING" });
        })
        .catch(() => setServiceWorkerReady(false));
    }

    const softTimer = window.setTimeout(() => {
      if (!dismissedRecently && !isStandalone()) {
        setReady(true);
        setDismissed(false);
        setExpanded(!window.isSecureContext || /iphone|ipad|ipod/i.test(window.navigator.userAgent));
      }
    }, 1800);

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      setReady(true);
      setExpanded(false);
      if (!dismissedRecently && !isStandalone()) setDismissed(false);
    };

    const onInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
      setDismissed(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.clearTimeout(softTimer);
    };
  }, []);

  const installTarget = useMemo(() => {
    if (typeof window === "undefined") return "browser-menu";
    return getInstallTarget(Boolean(installEvent));
  }, [installEvent]);

  const message = useMemo(() => {
    const baseMessage = getInstallMessage(installTarget);
    if (serviceWorkerReady || installTarget !== "native") return baseMessage;
    return "Preparando la app para instalarse. Intenta otra vez en unos segundos.";
  }, [installTarget, serviceWorkerReady]);

  const shouldShow = ready && !dismissed && !installed;

  const dismiss = () => {
    window.localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    setDismissed(true);
  };

  const install = async () => {
    if (!installEvent) {
      setExpanded(true);
      return;
    }

    await installEvent.prompt();
    const choice = await installEvent.userChoice.catch(() => null);
    if (choice?.outcome === "accepted") {
      setInstalled(true);
      setDismissed(true);
    }
    setInstallEvent(null);
  };

  if (!shouldShow) return null;

  return (
    <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+1rem)] right-3 z-50 w-[min(28rem,calc(100vw-1.5rem))] rounded-xl border border-slate-200 bg-white/95 p-2 shadow-lg shadow-slate-900/10 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={install}
          className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
        >
          <Download className="h-4 w-4 shrink-0" />
          <span>Descargar app</span>
        </button>
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
          aria-label="Ver ayuda para instalar"
          aria-expanded={expanded}
        >
          <Info className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
          aria-label="Ocultar descarga"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {expanded ? (
        <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs font-medium leading-5 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {message}
        </p>
      ) : null}
    </div>
  );
}
