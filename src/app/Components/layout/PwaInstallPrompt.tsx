"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const DISMISSED_KEY = "cosaif:pwa-install-dismissed";

function isStandalone() {
  if (typeof window === "undefined") return true;
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

export default function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [installed, setInstalled] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const dismissedAt = Number(window.localStorage.getItem(DISMISSED_KEY) || 0);
    const dismissedRecently = dismissedAt > 0 && Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000;
    setDismissed(dismissedRecently || isStandalone());

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }

    const softTimer = window.setTimeout(() => {
      if (!dismissedRecently && !isStandalone()) {
        setReady(true);
        setDismissed(false);
        if (!window.isSecureContext) {
          setMessage("PWA real bloqueada por HTTP/IP. Usa localhost o HTTPS.");
        }
      }
    }, 2500);

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      setReady(true);
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

  const shouldShow = useMemo(() => {
    return ready && !dismissed && !installed;
  }, [ready, dismissed, installed]);

  const dismiss = () => {
    window.localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    setDismissed(true);
  };

  const install = async () => {
    if (!installEvent) {
      setMessage(
        window.isSecureContext
          ? "Chrome aun no habilita la instalacion PWA."
          : "PWA real bloqueada por HTTP/IP. Abre en localhost o HTTPS."
      );
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
    <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+1rem)] right-3 z-50 flex max-w-[calc(100vw-1.5rem)] flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white/95 p-2 shadow-lg shadow-slate-900/10 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
      <button
        type="button"
        onClick={install}
        className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
      >
        <Download className="h-4 w-4" />
        <span>Instalar app</span>
      </button>
      {message ? (
        <span className="order-3 w-full px-1 pb-1 text-xs font-medium text-slate-600 dark:text-slate-300">
          {message}
        </span>
      ) : null}
      <button
        type="button"
        onClick={dismiss}
        className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
        aria-label="Ocultar descarga"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
