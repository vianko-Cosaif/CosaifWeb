"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, LogIn } from "lucide-react";
import RailQueueBoard from "./RailQueueBoard";
import { getClientCookie } from "@/lib/cookies";
import { syncFirebaseNotificationLocalidad } from "@/lib/firebase";
import { clearAuthenticatedSession } from "@/lib/sessionLogout";

type LocalidadState = "checking" | "ready" | "missing";

const SupervisorPage: React.FC = () => {
  const router = useRouter();
  const [localidadId, setLocalidadId] = useState<number | null>(null);
  const [localidadState, setLocalidadState] = useState<LocalidadState>("checking");
  const [sessionError, setSessionError] = useState("");
  const [restartingSession, setRestartingSession] = useState(false);

  useEffect(() => {
    const raw =
      getClientCookie("locId") ??
      (typeof window !== "undefined" ? localStorage.getItem("locId") : null);

    const num = raw ? Number(raw) : NaN;
    if (!Number.isFinite(num) || num <= 0) {
      setLocalidadState("missing");
      return;
    }

    setLocalidadId(num);
    setLocalidadState("ready");
    window.dispatchEvent(new CustomEvent("cosaif:localidad-change", { detail: { localidadId: num } }));
    void syncFirebaseNotificationLocalidad(num).catch((error) => {
      console.warn("No se pudo sincronizar localidad FCM.", error);
    });
  }, []);

  const restartSession = async () => {
    if (restartingSession) return;
    setRestartingSession(true);
    setSessionError("");

    try {
      await clearAuthenticatedSession();
      router.replace("/login");
      router.refresh();
    } catch {
      setSessionError("No se pudo reiniciar la sesión. Inténtalo de nuevo.");
      setRestartingSession(false);
    }
  };

  return (
    <section className="w-full min-w-0">
      {localidadState === "checking" ? (
        <div aria-live="polite" aria-busy="true" className="mx-auto w-full max-w-[1400px] space-y-4">
          <span className="sr-only">Preparando operación</span>
          <div className="h-24 animate-pulse rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)]" />
          <div className="h-72 animate-pulse rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)]" />
        </div>
      ) : null}

      {localidadState === "missing" ? (
        <div className="mx-auto flex min-h-[55vh] w-full max-w-xl items-center px-2">
          <div className="w-full rounded-2xl border border-amber-200 bg-[var(--app-surface)] p-6 text-center shadow-[var(--app-shadow-md)] dark:border-amber-900/60 sm:p-8">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
              <AlertTriangle className="h-6 w-6" aria-hidden="true" />
            </span>
            <h1 className="mt-4 text-xl font-bold text-[var(--app-text)]">Falta asignar una localidad</h1>
            <p className="mt-2 text-sm leading-6 text-[var(--app-text-muted)]">
              Tu sesión no contiene la localidad necesaria para mostrar la operación. Vuelve a iniciar sesión; si el problema continúa, solicita al administrador que revise tu asignación.
            </p>
            {sessionError ? (
              <p role="alert" className="mt-4 text-sm text-rose-600 dark:text-rose-300">
                {sessionError}
              </p>
            ) : null}
            <button
              type="button"
              onClick={restartSession}
              disabled={restartingSession}
              aria-busy={restartingSession}
              className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--app-accent)] px-5 text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
            >
              <LogIn className="h-4 w-4" aria-hidden="true" />
              {restartingSession ? "Reiniciando…" : "Volver a iniciar sesión"}
            </button>
          </div>
        </div>
      ) : null}

      {localidadState === "ready" && localidadId ? (
        <div className="mx-auto w-full max-w-[1400px] space-y-6 sm:space-y-8 min-w-0">
          <RailQueueBoard localidadId={localidadId} />
        </div>
      ) : null}
    </section>
  );
};

export default SupervisorPage;
