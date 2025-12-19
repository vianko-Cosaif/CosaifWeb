"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Menu,
  Users,
  TriangleAlert,
  Home,
  LogOut,
  Train,
  Building2,
  ShieldHalf,
  LayoutDashboard,
  X,
  ChevronLeft,
  BarChart3,
} from "lucide-react";

/* ==========================================================================
   INTERFACES (Basadas en tu captura de LocalStorage)
   ========================================================================== */
export type Rol = "ADMINISTRADOR" | "COORDINADOR" | "SUPERVISOR" | "CLIENTE";

interface UserSession {
  id: number;
  rol: Rol | string;
  nombre: string;
  empresaId: number;
  empresa: {
    id: number;
    nombre: string;
  };
}

const THEMES: Record<"light" | "dark", Record<Rol, any>> = {
  light: {
    ADMINISTRADOR: {
      bg: "#0D2818",
      text: "#E9F5ED",
      accent: "#40916C",
      border: "#1B4332",
      roleBg: "rgba(64,145,108,0.15)",
      roleText: "#74C69D",
      roleBorder: "rgba(64,145,108,0.25)",
    },
    COORDINADOR: {
      bg: "#1E2B3A",
      text: "#E0ECF7",
      accent: "#36B4C6",
      border: "#253648",
      roleBg: "rgba(54,180,198,0.15)",
      roleText: "#9adbe5",
      roleBorder: "rgba(54,180,198,0.25)",
    },
    SUPERVISOR: {
      bg: "#232038",
      text: "#ECE9FE",
      accent: "#7C3AED",
      border: "#2F2A4E",
      roleBg: "rgba(124,58,237,0.15)",
      roleText: "#C4B5FD",
      roleBorder: "rgba(124,58,237,0.25)",
    },
    CLIENTE: {
      bg: "#1E3B2E",
      text: "#E0F5E9",
      accent: "#4AC27D",
      border: "#25483A",
      roleBg: "rgba(74,194,125,0.15)",
      roleText: "#B7E4C7",
      roleBorder: "rgba(74,194,125,0.25)",
    },
  },
  dark: {
    ADMINISTRADOR: {
      bg: "#0B2217",
      text: "#E6F7EE",
      accent: "#5ED3A5",
      border: "#13432E",
      roleBg: "rgba(94,211,165,0.16)",
      roleText: "#A6F0D3",
      roleBorder: "rgba(94,211,165,0.28)",
    },
    COORDINADOR: {
      bg: "#0F1722",
      text: "#E8F4FB",
      accent: "#57D8E8",
      border: "#1B2A3A",
      roleBg: "rgba(87,216,232,0.16)",
      roleText: "#BCEFF6",
      roleBorder: "rgba(87,216,232,0.28)",
    },
    SUPERVISOR: {
      bg: "#18132B",
      text: "#EEE9FF",
      accent: "#A78BFA",
      border: "#241C43",
      roleBg: "rgba(167,139,250,0.16)",
      roleText: "#DDD6FE",
      roleBorder: "rgba(167,139,250,0.28)",
    },
    CLIENTE: {
      bg: "#0F241B",
      text: "#E6F7EE",
      accent: "#5ED3A5",
      border: "#174635",
      roleBg: "rgba(94,211,165,0.16)",
      roleText: "#BFF3DD",
      roleBorder: "rgba(94,211,165,0.28)",
    },
  },
};

const ROLE_ICONS: Record<Rol, any> = {
  ADMINISTRADOR: ShieldHalf,
  COORDINADOR: Train,
  SUPERVISOR: Users,
  CLIENTE: Building2,
};

export default function SidebarMenu({ version = "v1.2.0" }: { version?: string }) {
  const router = useRouter();
  const pathname = usePathname();

  const [isOpen, setIsOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [session, setSession] = useState<UserSession | null>(null);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const rawUser = localStorage.getItem("user");
    if (rawUser) {
      try {
        setSession(JSON.parse(rawUser));
      } catch (e) {
        console.error(e);
      }
    }

    const rawTheme = localStorage.getItem("theme");
    setIsDark(rawTheme === "dark" || document.documentElement.classList.contains("dark"));
  }, []);

  const normRol = useMemo<Rol>(() => {
    const r = String(session?.rol || "").toUpperCase();
    if (r.includes("ADMIN")) return "ADMINISTRADOR";
    if (r.includes("COORD")) return "COORDINADOR";
    if (r.includes("SUP")) return "SUPERVISOR";
    return "CLIENTE";
  }, [session]);

  const theme = isDark ? THEMES.dark[normRol] : THEMES.light[normRol];
  const RoleIcon = ROLE_ICONS[normRol] || Users;

  const base = useMemo(() => `/${normRol.toLowerCase()}`, [normRol]);

  const navigation = useMemo(() => {
    return [
      { id: "dash", label: "Dashboard", href: base, icon: LayoutDashboard },
      { id: "movs", label: "Movimientos", href: `${base}/movimientos`, icon: Train },
      {
        id: "users",
        label: "Gestión Usuarios",
        href: `${base}/usuarios`,
        hide: ["CLIENTE", "SUPERVISOR"].includes(normRol),
        icon: Users,
      },
      { id: "inc", label: "Incidentes", href: `${base}/incidentes`, icon: TriangleAlert },

      // ✅ SOLO UNA OPCIÓN NUEVA (sin submenú): Reportería (Admin/Coord)
      {
        id: "reporteria",
        label: "Reportería",
        href: `${base}/reporteria`,
        hide: !["ADMINISTRADOR", "COORDINADOR"].includes(normRol),
        icon: BarChart3,
      },
    ].filter((i: any) => !i.hide);
  }, [normRol, base]);

  if (!session) return null;

  const asideStyles = {
    "--sb-bg": theme?.bg || "#1e293b",
    "--sb-text": theme?.text || "#f8fafc",
    "--sb-accent": theme?.accent || "#38bdf8",
    "--sb-border": theme?.border || "rgba(255,255,255,0.1)",
    "--sb-role-bg": theme?.roleBg || "rgba(255,255,255,0.1)",
    "--sb-role-text": theme?.roleText || "#f8fafc",
    "--sb-role-border": theme?.roleBorder || "rgba(255,255,255,0.18)",
  } as React.CSSProperties;

  return (
    <>
      {/* TRIGGER MÓVIL */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-[60] flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-lg md:hidden dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
      >
        <Menu className="h-6 w-6 text-slate-600 dark:text-slate-300" />
      </button>

      {/* OVERLAY MÓVIL */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm md:hidden transition-opacity"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside
        style={asideStyles}
        className={`
          fixed inset-y-0 left-0 z-[100] flex flex-col border-r border-[var(--sb-border)] bg-[var(--sb-bg)] text-[var(--sb-text)]
          transition-all duration-300 ease-in-out
          ${mobileOpen ? "translate-x-0 w-[min(85vw,320px)] shadow-2xl" : "-translate-x-full md:translate-x-0"}
          ${!mobileOpen && (isOpen ? "md:w-[280px]" : "md:w-[88px]")}
        `}
      >
        {/* HEADER */}
        <div className="flex h-20 items-center justify-between px-6 shrink-0">
          <div className={`flex items-center gap-3 ${(isOpen || mobileOpen) ? "" : "mx-auto"}`}>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--sb-accent)] text-white shadow-lg">
              <Home className="h-5 w-5" />
            </div>

            {(isOpen || mobileOpen) && (
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-50">Logistics</span>
                <span className="text-lg font-black tracking-tight leading-none">COSAIF</span>
              </div>
            )}
          </div>

          {/* Colapsar (desktop) */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="hidden md:flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/10"
          >
            <ChevronLeft className={`h-5 w-5 transition-transform ${isOpen ? "" : "rotate-180"}`} />
          </button>

          {/* Cerrar (móvil) */}
          <button onClick={() => setMobileOpen(false)} className="md:hidden p-2 hover:bg-white/10 rounded-lg">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* PERFIL */}
        <div
          className={`mx-4 mb-6 rounded-2xl border border-[var(--sb-border)] bg-white/5 p-4 transition-all overflow-hidden ${
            !isOpen && !mobileOpen ? "px-2" : ""
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-[var(--sb-role-text)] bg-[var(--sb-accent)] font-bold text-[var(--sb-bg)] shadow-md text-xl">
              {session.nombre?.charAt(0)?.toUpperCase()}
            </div>

            {(isOpen || mobileOpen) && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold leading-tight uppercase">{session.nombre}</p>
                <p className="truncate text-[11px] font-medium opacity-60 uppercase tracking-tighter">
                  {session.empresa?.nombre || "Sin Empresa"}
                </p>
              </div>
            )}
          </div>

          {(isOpen || mobileOpen) && (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-[var(--sb-role-border)] bg-[var(--sb-role-bg)] px-3 py-2 text-[10px] font-black text-[var(--sb-role-text)] uppercase tracking-[0.1em]">
              <RoleIcon className="h-4 w-4" />
              <span>{normRol}</span>
            </div>
          )}
        </div>

        {/* NAVEGACIÓN */}
        <nav className="flex-1 space-y-2 overflow-y-auto px-3 scrollbar-hide">
          {navigation.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== `/${normRol.toLowerCase()}` && pathname.startsWith(item.href));
            const Icon = item.icon || Users;

            return (
              <button
                key={item.id}
                onClick={() => {
                  router.push(item.href);
                  setMobileOpen(false);
                }}
                className={`
                  group relative flex w-full items-center gap-4 rounded-xl px-3 py-3.5 transition-all
                  ${active ? "bg-white/10 text-[var(--sb-accent)] shadow-sm" : "text-[var(--sb-text)] opacity-60 hover:bg-white/5 hover:opacity-100"}
                  ${!isOpen && !mobileOpen ? "justify-center" : ""}
                `}
              >
                <Icon className={`h-5 w-5 shrink-0 ${active ? "scale-110" : ""}`} />
                {(isOpen || mobileOpen) && <span className="text-sm font-semibold tracking-wide">{item.label}</span>}
                {active && (
                  <div className="absolute left-0 h-6 w-1 rounded-r-full bg-[var(--sb-accent)] shadow-[0_0_12px_var(--sb-accent)]" />
                )}
              </button>
            );
          })}
        </nav>

        {/* FOOTER */}
        <div className="border-t border-[var(--sb-border)] p-4 shrink-0">
          <button
            onClick={() => {
              localStorage.clear();
              router.replace("/login");
            }}
            className={`flex w-full items-center gap-3 rounded-xl p-3 text-sm font-bold transition-all hover:bg-red-500/20 hover:text-red-400 ${
              !isOpen && !mobileOpen ? "justify-center" : ""
            }`}
          >
            <LogOut className="h-5 w-5" />
            {(isOpen || mobileOpen) && <span>Cerrar Sesión</span>}
          </button>

          {(isOpen || mobileOpen) && (
            <p className="mt-4 text-center text-[9px] opacity-30 font-mono uppercase tracking-widest">{version}</p>
          )}
        </div>
      </aside>

      {/* ESPACIADOR DESKTOP */}
      <div
        className="hidden shrink-0 transition-all duration-300 md:block"
        style={{ width: isOpen ? "280px" : "88px" }}
      />
    </>
  );
}
