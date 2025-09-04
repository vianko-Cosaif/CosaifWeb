// src/app/cliente/error.tsx
"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[/cliente] Uncaught error:", error);
  }, [error]);

  async function copyDetails() {
    try {
      const txt =
        (error?.message ?? "Error") +
        "\n\n" +
        (error?.stack ?? "") +
        (error?.digest ? `\n\nDigest: ${error.digest}` : "");
      await navigator.clipboard.writeText(txt);
         alert("Detalles copiados al portapapeles.");
    } catch {}
  }

  return (
    <section
      className="mx-auto w-full max-w-3xl p-4 sm:p-6"
      role="alert"
      aria-live="assertive"
    >
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-900 shadow dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-100">
        <h1 className="text-lg font-semibold">Algo salió mal</h1>
        <p className="mt-1 text-sm opacity-90">
          No pudimos cargar el panel. Intenta nuevamente o vuelve al inicio.
        </p>

        <details className="mt-4 rounded-md border border-rose-200 bg-white p-3 text-rose-900 dark:border-rose-900/50 dark:bg-slate-900 dark:text-rose-100">
          <summary className="cursor-pointer select-none text-sm font-medium">
            Ver detalles técnicos
          </summary>
          <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap text-xs leading-relaxed opacity-90">
            {error?.message}
            {"\n\n"}
            {error?.stack}
            {error?.digest ? `\n\nDigest: ${error.digest}` : null}
          </pre>
          <div className="mt-2">
            <button
              onClick={copyDetails}
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
            >
              Copiar detalles
            </button>
          </div>
        </details>

        <div className="mt-6 flex flex-wrap gap-2">
          <button
            onClick={() => reset()}
            className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
          >
            Reintentar
          </button>
          <a
            href="/cliente"
            className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
          >
            Ir a /cliente
          <Link
            href="/"
            className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
          >
            Inicio
          </Link>
          </a>
        </div>
      </div>
    </section>
  );
}
