"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import SidebarMenu, { Rol } from "@/app/Components/Menu/Menu";
import { MapPin, RefreshCw, Shield } from "lucide-react";
import ThemeToggle from "@/app/Components/ui/ThemeToggle";
import { IncidentMonitor } from "@/app/Components/IncidentModal";
import { getClientCookie, getEmpresaIdClient } from "@/lib/cookies";

export default function ClienteLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [rol, setRol] = useState<Rol>("CLIENTE");
  const [loc, setLoc] = useState<string>("-");
  const [empresaId, setEmpresaId] = useState<number | null>(null);

  useEffect(() => {
    const roleRaw = (getClientCookie("role") ?? "").toUpperCase();
    const r: Rol =
      roleRaw === "ADMINISTRADOR" || roleRaw === "COORDINADOR" || roleRaw === "CLIENTE"
        ? (roleRaw as Rol)
        : "CLIENTE";
    setRol(r);

    const locId =
      getClientCookie("locId") ??
      (typeof window !== "undefined" ? localStorage.getItem("locId") ?? "-" : "-");
    setLoc(locId);

    // Obtener empresaId del usuario logueado
    const empId = getEmpresaIdClient();
    setEmpresaId(empId);
  }, [pathname]);

  return (
    <div className="relative flex min-h-svh bg-gradient-to-b from-emerald-50 to-sky-50 dark:from-slate-900 dark:to-slate-950">
      {/* Sidebar fijo + spacer responsivo dentro del propio componente */}
      <SidebarMenu />

      {/* Grid de fondo */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.05)_1px,transparent_1px)] bg-[size:24px_24px] dark:opacity-[0.07]"
      />

      <div className="relative z-10 flex min-h-svh flex-1 flex-col">
        {/* Monitor de incidentes global para /cliente/* */}
        <IncidentMonitor
          apiBase="/bff"
          intervalMs={60000}
          enabled={true}
          empresaId={empresaId}
          localidadId={Number(loc) || null}
        />

        {/* Skip link accesible */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-[max(0.5rem,env(safe-area-inset-top))] focus:z-50 focus:rounded-md focus:border focus:bg-white focus:px-3 focus:py-2 focus:text-slate-900 dark:focus:bg-slate-800 dark:focus:text-slate-100"
        >
          Saltar al contenido
        </a>

        {/* Header sticky con safe-areas y compactación móvil */}
        <header className="sticky top-[max(0px,env(safe-area-inset-top))] z-20 border-b border-slate-200/70 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:border-slate-700/60 dark:bg-slate-900/70">
          <div
            className="mx-auto flex w-full max-w-screen-2xl flex-wrap items-center gap-x-3 gap-y-2 py-3 sm:flex-nowrap"
            style={{
              paddingLeft: "max(3.75rem, calc(env(safe-area-inset-left) + 0rem))", // deja espacio al botón móvil del sidebar
              paddingRight: "max(1rem, env(safe-area-inset-right))",
            }}
          >
            <h1 className="text-base font-semibold tracking-tight sm:text-lg">Panel de Cliente</h1>

            <span className="hidden sm:inline-flex items-center leading-none gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <Shield className="h-4 w-4 -mt-px" />
              {rol}
            </span>

            <span className="inline-flex items-center leading-none gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <MapPin className="h-4 w-4 -mt-px" />
              <span className="whitespace-nowrap">
                Loc: <b className="ml-0.5">{loc}</b>
              </span>
            </span>

            <div className="ml-auto inline-flex items-center gap-2">
              <button
                type="button"
                onClick={() => router.refresh()}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm hover:bg-slate-50 active:scale-[.98] dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
                title="Refrescar"
              >
                <RefreshCw className="h-4 w-4 -mt-px" />
                <span className="hidden sm:inline">Actualizar</span>
              </button>

              <ThemeToggle className="inline-flex items-center justify-center" size="md" title="Cambiar tema" />
            </div>
          </div>
        </header>

        {/* Contenido principal con paddings escalonados y container ancho */}
        <main id="main" className="relative z-10 mx-auto w-full max-w-screen-2xl flex-1 p-4 sm:p-6 md:p-8">
          {/* Para layouts complejos en móvil, permitimos overflow-x en secciones internas */}
          <div className="contents">{children}</div>
        </main>

         <footer className="mx-auto w-full max-w-screen-2xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-xs text-slate-500">v1</footer>
      </div>
    </div>
  );
}
