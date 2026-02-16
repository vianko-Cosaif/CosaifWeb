// src/app/supervisor/layout.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import SidebarMenu, { Rol } from "@/app/Components/Menu/Menu";
import { MapPin, RefreshCw, Shield } from "lucide-react";
import ThemeToggle from "@/app/Components/ui/ThemeToggle";
// import { IncidentMonitor } from "@/app/Components/IncidentModal";
import { getClientCookie, getEmpresaIdClient } from "@/lib/cookies";

export default function CoordinadorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [rol, setRol] = useState<Rol>("COORDINADOR");
  const [locLabel, setLocLabel] = useState<string>("Global");
  const [empresaId, setEmpresaId] = useState<number | null>(null);

  useEffect(() => {
    const roleRaw = (getClientCookie("role") ?? "").toUpperCase();
    setRol(roleRaw === "COORDINADOR" ? "COORDINADOR" : "COORDINADOR");

    const locId = getClientCookie("locId");
    setLocLabel(locId ? `Loc ${locId}` : "Global");

    setEmpresaId(getEmpresaIdClient());
  }, [pathname]);

  return (
    <div
      className="relative flex min-h-svh
                 bg-gradient-to-b from-violet-50 via-zinc-50 to-zinc-100
                 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950"
    >
      {/* Sidebar fijo morado */}
      <SidebarMenu />

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
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-[max(0.5rem,env(safe-area-inset-top))] focus:z-50 focus:rounded-md focus:border focus:bg-white focus:px-3 focus:py-2 focus:text-zinc-900 dark:focus:bg-zinc-800 dark:focus:text-zinc-100"
        >
          Saltar al contenido
        </a>

        {/* Header */}
        <header className="sticky top-[max(0px,env(safe-area-inset-top))] z-20 border-b border-zinc-200/70 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:border-zinc-800/70 dark:bg-zinc-950/80">
          <div
            className="mx-auto flex w-full max-w-screen-2xl flex-wrap items-center gap-x-3 gap-y-2 py-3 sm:flex-nowrap"
            style={{
              paddingLeft:
                "max(3.75rem, calc(env(safe-area-inset-left) + 0rem))",
              paddingRight: "max(1rem, env(safe-area-inset-right))",
            }}
          >
            <h1 className="text-base font-semibold tracking-tight sm:text-lg">
              Panel de Supervisor
            </h1>

            <span className="hidden sm:inline-flex items-center leading-none gap-1 rounded-full border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 dark:border-violet-700 dark:bg-[#120528] dark:text-violet-200">
              <Shield className="h-4 w-4 -mt-px" />
              {rol}
            </span>

            <span className="inline-flex items-center leading-none gap-1 rounded-full border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
              <MapPin className="h-4 w-4 -mt-px" />
              <span className="whitespace-nowrap">{locLabel}</span>
            </span>

            <div className="ml-auto inline-flex items-center gap-2">
              <button
                type="button"
                onClick={() => router.refresh()}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-zinc-200 bg-white px-3 text-sm hover:bg-zinc-50 active:scale-[.98] dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                title="Refrescar"
              >
                <RefreshCw className="h-4 w-4 -mt-px" />
                <span className="hidden sm:inline">Actualizar</span>
              </button>

              <ThemeToggle
                className="inline-flex items-center justify-center"
                size="md"
                title="Cambiar tema"
              />
            </div>
          </div>
        </header>

        {/* Contenido */}
        <main
          id="main"
          className="relative z-10 mx-auto w-full max-w-screen-2xl flex-1 p-4 sm:p-6 md:p-8"
        >
          <div className="contents">{children}</div>
        </main>

        <footer className="mx-auto w-full max-w-screen-2xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-xs text-zinc-500">
          v1
        </footer>
      </div>
    </div>
  );
}
