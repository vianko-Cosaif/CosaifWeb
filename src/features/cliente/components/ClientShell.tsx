// src/app/Components/cliente/ClientShell.tsx
// ⚠️ Neutralizado para no interferir con /cliente.
// Úsalo sólo fuera de /cliente si necesitas un contenedor básico.
// Sin grid/gradientes ni control de tema.

"use client";
import React from "react";

export interface ClientShellProps {
  header?: React.ReactNode;        // opcional (se pinta sticky si se pasa)
  children: React.ReactNode;
  contentClassName?: string;       // clases extra para <main>
}

export default function ClientShell({
  header,
  children,
  contentClassName,
}: ClientShellProps) {
  return (
    <div className="relative flex min-h-svh">
      {/* Skip link accesible */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:shadow"
      >
        Saltar al contenido
      </a>

      {/* Header opcional (sin estilos de fondo/borde para no interferir) */}
      {header ? <div className="sticky top-0 z-20">{header}</div> : null}

      {/* Contenido principal */}
      <main
        id="main"
        className={cls(
          "mx-auto w-full max-w-7xl flex-1 p-4 md:p-6",
          contentClassName
        )}
      >
        {children}
      </main>
    </div>
  );
}

/* util mínima para concatenar clases */
function cls(...xs: Array<string | undefined | false | null>) {
  return xs.filter(Boolean).join(" ");
}
