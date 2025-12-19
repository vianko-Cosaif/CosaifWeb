// src/app/supervisor/layout.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import SidebarMenu, { Rol } from "@/app/Components/Menu/Menu";
import { MapPin, RefreshCw, Shield } from "lucide-react";
import ThemeToggle from "@/app/Components/ui/ThemeToggle";
// import { IncidentMonitor } from "@/app/Components/IncidentModal";
import { getClientCookie, getEmpresaIdClient } from "@/lib/cookies";

export default function SupervisorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [rol, setRol] = useState<Rol>("SUPERVISOR");
  const [locLabel, setLocLabel] = useState<string>("Global");
  const [empresaId, setEmpresaId] = useState<number | null>(null);

  useEffect(() => {
    const roleRaw = (getClientCookie("role") ?? "").toUpperCase();
    setRol(roleRaw === "SUPERVISOR" ? "SUPERVISOR" : "SUPERVISOR");

    const locId = getClientCookie("locId");
    setLocLabel(locId ? `Loc ${locId}` : "Global");

    setEmpresaId(getEmpresaIdClient());
  }, [pathname]);

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
 

        {/* Header */}
        <header className="sticky top-[max(0px,env(safe-area-inset-top))] z-20 border-b border-slate-200/70 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:border-slate-800/70 dark:bg-[#080217]/80">
       
        </header>

        {/* Contenido */}
        <main
          id="main"
          className="relative z-10 mx-auto w-full max-w-screen-2xl flex-1 p-4 sm:p-6 md:p-8"
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
