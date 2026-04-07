// src/app/admin/layout.tsx
"use client";

import SidebarMenu from "@/app/Components/Menu/Menu";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-svh bg-gradient-to-b from-emerald-50 to-sky-50 dark:from-slate-900 dark:to-slate-950">
      {/* Sidebar fijo */}
      <SidebarMenu />

      {/* Grid de fondo */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.05)_1px,transparent_1px)] bg-[size:24px_24px] dark:opacity-[0.07]"
      />

      <div className="relative z-10 flex min-h-svh flex-1 flex-col">
        {/* Monitor global opcional para Admin */}
        {/* <IncidentMonitor apiBase="/bff" intervalMs={60000} enabled={true} empresaId={empresaId} localidadId={null} /> */}

        {/* Skip link */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-[max(0.5rem,env(safe-area-inset-top))] focus:z-50 focus:rounded-md focus:border focus:bg-white focus:px-3 focus:py-2 focus:text-slate-900 dark:focus:bg-slate-800 dark:focus:text-slate-100"
        >
          Saltar al contenido
        </a>

        {/* Contenido */}
        <main id="main" className="relative z-10 mx-auto w-full max-w-screen-2xl flex-1 p-4 sm:p-6 md:p-8">
          <div className="contents">{children}</div>
        </main>

        <footer className="mx-auto w-full max-w-screen-2xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-xs text-slate-500">
          v1
        </footer>
      </div>
    </div>
  );
}
