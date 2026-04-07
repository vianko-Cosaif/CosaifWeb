// src/app/supervisor/layout.tsx
"use client";

import SidebarMenu from "@/app/Components/Menu/Menu";
// import { IncidentMonitor } from "@/app/Components/IncidentModal";

export default function SupervisorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="relative flex min-h-svh
                 bg-gradient-to-b from-violet-50 via-slate-50 to-slate-100
                 dark:from-[#050014] dark:via-[#050018] dark:to-black"
    >
      {/* Sidebar fijo morado */}
      <SidebarMenu  />

      {/* Grid de fondo con tono violeta */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0
                   bg-[linear-gradient(to_right,rgba(88,28,135,0.07)_1px,transparent_1px),linear-gradient(to_bottom,rgba(88,28,135,0.07)_1px,transparent_1px)]
                   bg-[size:24px_24px] dark:opacity-[0.10]"
      />

      <div className="relative z-10 flex min-h-svh flex-1 flex-col">
        {/* Si quieres monitor de incidentes para supervisor, luego lo activas */}
        {/* <IncidentMonitor
          apiBase="/bff"
          intervalMs={60000}
          enabled={true}
          empresaId={empresaId}
          localidadId={Number(getClientCookie("locId") ?? null) || null}
        /> */}

        {/* Skip link accesibilidad */}
 

        {/* Contenido */}
        <main
          id="main"
          className="relative z-10 mx-auto w-full max-w-screen-2xl flex-1 p-4 sm:p-6 md:p-8 pt-[calc(env(safe-area-inset-top)+1rem)] pb-[calc(env(safe-area-inset-bottom)+1rem)]"
        >
          <div className="contents">{children}</div>
        </main>

        <footer className="mx-auto w-full max-w-screen-2xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-xs text-slate-500">
          v1
        </footer>
      </div>
    </div>
  );
}
