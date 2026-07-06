"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Menu as MenuIcon,
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
  ChevronRight,
  Settings,
  BarChart3,
  Wrench,
  Boxes,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import ThemeToggle from "@/app/Components/ui/ThemeToggle";
import { GuidedTarget } from "@/app/Components/GuidedManualAtom";
import { ClientMovementGuideButton } from "@/app/Components/GuidedManualAtom/ClientMovementGuide";
import { buildNavigationForRole, isNavigationItemActive, type AppNavigationItem } from "@/lib/appNavigation";
import { getRoleCapabilities, normalizeAppRole, type NavModuleId } from "@/lib/accessControl";

/* ==========================================================================
   INTERFACES & TYPES
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

type NavigationItem = {
  id: NavModuleId;
  label: string;
  href: string;
  description: string;
  icon: LucideIcon;
};

// PREMIUM COLOR CONFIGURATION
const ROLE_CONFIG: Record<
  Rol,
  {
    icon: LucideIcon;
    label: string;
    // Tailwind classes
    text: string;           // Text color
    bg: string;             // Background tint
    gradient: string;       // Gradient for active/highlights
    border: string;         // Border color
    ring: string;           // Ring color
    hoverBg: string;        // Hover background
  }
> = {
  ADMINISTRADOR: {
    icon: ShieldHalf,
    label: "Administrador",
    text: "text-emerald-500 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    gradient: "from-emerald-500 to-teal-400",
    border: "border-emerald-200 dark:border-emerald-800",
    ring: "ring-emerald-500/20",
    hoverBg: "hover:bg-emerald-50 dark:hover:bg-emerald-900/20",
  },
  COORDINADOR: {
    icon: Train,
    label: "Coordinador",
    text: "text-blue-500 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/40",
    gradient: "from-blue-500 to-indigo-400",
    border: "border-blue-200 dark:border-blue-800",
    ring: "ring-blue-500/20",
    hoverBg: "hover:bg-blue-50 dark:hover:bg-blue-900/20",
  },
  SUPERVISOR: {
    icon: Users,
    label: "Supervisor",
    text: "text-violet-500 dark:text-violet-400",
    bg: "bg-violet-50 dark:bg-violet-950/40",
    gradient: "from-violet-500 to-purple-400",
    border: "border-violet-200 dark:border-violet-800",
    ring: "ring-violet-500/20",
    hoverBg: "hover:bg-violet-50 dark:hover:bg-violet-900/20",
  },
  CLIENTE: {
    icon: Building2,
    label: "Cliente",
    text: "text-amber-500 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    gradient: "from-amber-500 to-orange-400",
    border: "border-amber-200 dark:border-amber-800",
    ring: "ring-amber-500/20",
    hoverBg: "hover:bg-amber-50 dark:hover:bg-amber-900/20",
  },
};

const NAV_ICONS: Record<NavModuleId, LucideIcon> = {
  dashboard: LayoutDashboard,
  movimientos: Train,
  torreon_arrastres: Boxes,
  torno: Wrench,
  configuracion: Settings,
  usuarios: Users,
  incidentes: TriangleAlert,
  reporteria: BarChart3,
};

function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(" ");
}

/* ==========================================================================
   COMPONENT
   ========================================================================== */
export default function SidebarMenu({ version = "v2.0.0" }: { version?: string }) {
  const router = useRouter();
  const pathname = usePathname();

  const [isOpen, setIsOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [session, setSession] = useState<UserSession | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const rawUser = localStorage.getItem("user");
    if (rawUser) {
      try {
        setSession(JSON.parse(rawUser));
      } catch (e) {
        console.error(e);
      }
    }
    // Auto-collapse on small screens
    if (window.innerWidth < 1024) setIsOpen(false);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const updateSidebarWidth = () => {
      const width = window.innerWidth < 768 ? "0px" : isOpen ? "280px" : "80px";
      document.documentElement.style.setProperty("--cosaif-sidebar-width", width);
    };

    updateSidebarWidth();
    window.addEventListener("resize", updateSidebarWidth);
    return () => window.removeEventListener("resize", updateSidebarWidth);
  }, [isOpen, mounted]);

  useEffect(() => {
    if (!mobileOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileOpen]);

  const appRole = useMemo(() => normalizeAppRole(String(session?.rol || "")) ?? "CLIENTE", [session]);
  const capabilities = useMemo(() => getRoleCapabilities(appRole), [appRole]);
  const normRol = useMemo<Rol>(() => {
    if (capabilities.area === "administrador") return "ADMINISTRADOR";
    if (capabilities.area === "coordinador") return "COORDINADOR";
    if (capabilities.area === "supervisor") return "SUPERVISOR";
    return "CLIENTE";
  }, [capabilities.area]);
  const roleConfig = ROLE_CONFIG[normRol] || ROLE_CONFIG.CLIENTE;

  const navigation = useMemo<NavigationItem[]>(() => {
    return buildNavigationForRole(appRole).map((item: AppNavigationItem) => ({
      ...item,
      label: item.id === "torno" && capabilities.isClientLike ? "Historial Torno" : item.label,
      icon: NAV_ICONS[item.id],
    }));
  }, [appRole, capabilities.isClientLike]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    document.cookie = "token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT";
    document.cookie = "role=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT";
    router.replace("/login");
  };

  if (!mounted) return null;

  // NavItem Component
  const NavItem = ({ item, isActive }: { item: NavigationItem, isActive: boolean }) => {
    const button = (
      <button
      onClick={() => {
        router.push(item.href);
        setMobileOpen(false);
      }}
      className={cn(
        "group relative flex w-full items-center gap-3 rounded-xl px-3 py-3 transition-all duration-300 ease-out",
        // Active State
        isActive
          ? cn("font-bold shadow-md shadow-zinc-200/50 dark:shadow-none ring-1 ring-inset", roleConfig.bg, roleConfig.text, roleConfig.ring)
          : cn("text-slate-600 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-zinc-300", roleConfig.hoverBg),
        !isOpen && !mobileOpen ? "justify-center px-2" : ""
      )}
      title={!isOpen ? item.label : undefined}
      >
      <item.icon
        className={cn(
          "h-5 w-5 shrink-0 transition-transform duration-300",
          isActive ? "scale-110" : "group-hover:scale-105",
          isActive ? roleConfig.text : "text-slate-400 dark:text-zinc-600 group-hover:text-slate-600 dark:group-hover:text-zinc-400"
        )}
      />

      {(isOpen || mobileOpen) && (
        <span className="truncate text-sm tracking-wide">{item.label}</span>
      )}

      {/* Active Indicator (Glowing line) */}
      {isActive && (
        <div className={cn("absolute left-0 h-6 w-1 rounded-r-full transition-all bg-gradient-to-b", roleConfig.gradient)} />
      )}

      {/* Tooltip for collapsed state */}
      {!isOpen && !mobileOpen && (
        <div className="absolute left-full ml-2 hidden rounded-md bg-zinc-900 px-2 py-1 text-xs text-zinc-100 opacity-0 shadow-md group-hover:block group-hover:opacity-100 z-50 whitespace-nowrap border border-zinc-800">
          {item.label}
        </div>
      )}
      </button>
    );

    if (capabilities.isClientLike && item.id === "movimientos") {
      return (
        <GuidedTarget id="client-nav-movements" className="w-full">
          {button}
        </GuidedTarget>
      );
    }

    return button;
  };

  return (
    <>
      {/* MOBILE TRIGGER */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-[calc(env(safe-area-inset-top)+1rem)] z-40 flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white/80 shadow-sm backdrop-blur-md transition-transform hover:scale-105 active:scale-95 md:hidden dark:border-slate-800 dark:bg-slate-900/80"
        aria-label="Abrir menú"
        aria-expanded={mobileOpen}
        aria-controls="cosaif-sidebar"
      >
        <MenuIcon className="h-5 w-5 text-slate-700 dark:text-slate-300" />
      </button>

      {/* MOBILE OVERLAY */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-zinc-950/80 backdrop-blur-sm transition-opacity duration-300 md:hidden",
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setMobileOpen(false)}
      />

      {/* SIDEBAR CONTAINER */}
      <aside
        id="cosaif-sidebar"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-slate-200 bg-white/95 backdrop-blur-xl dark:border-zinc-800 dark:bg-black/90 transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)]",
          mobileOpen ? "translate-x-0 w-[280px] shadow-2xl" : "-translate-x-full md:translate-x-0",
          !mobileOpen && (isOpen ? "md:w-[280px]" : "md:w-[80px]")
        )}
      >
        {/* HEADER */}
        <div className="flex h-20 shrink-0 items-center justify-between px-5 md:px-4 relative">
          <div className={cn("flex items-center gap-3 transition-opacity", !isOpen && !mobileOpen ? "w-full justify-center" : "")}>
            <div className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-lg transition-all duration-500 bg-gradient-to-br",
              roleConfig.gradient
            )}>
              <Home className="h-5 w-5" />
            </div>

            {(isOpen || mobileOpen) && (
              <div className="flex flex-col animate-in fade-in slide-in-from-left-2 duration-300">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500">Logistics</span>
                <span className="text-xl font-black tracking-tighter text-slate-900 dark:text-white leading-none">COSAIF</span>
              </div>
            )}
          </div>

          {/* COLLAPSE TOGGLE (Moved to Header) */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="hidden md:flex absolute right-[-12px] top-1/2 -translate-y-1/2 h-6 w-6 items-center justify-center rounded-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 shadow-md text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 transition-all hover:scale-110 z-50"
            title={isOpen ? "Colapsar menú" : "Expandir menú"}
          >
            {isOpen ? <ChevronLeft className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>

          {/* CLOSE MOBILE */}
          {mobileOpen && (
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-4 top-1/2 -translate-y-1/2 md:hidden"
              aria-label="Cerrar menú"
            >
              <X className="h-5 w-5 text-slate-500" />
            </button>
          )}
        </div>

        {/* PROFILE CARD */}
        <div className="px-3 mb-6">
          <div
            className={cn(
              "relative flex items-center gap-3 overflow-hidden rounded-2xl border transition-all duration-300",
              !isOpen && !mobileOpen
                ? "justify-center px-0 py-3 border-transparent bg-transparent"
                : cn("p-3 bg-white dark:bg-zinc-900/50 border-slate-100 dark:border-zinc-800/50 shadow-sm", roleConfig.hoverBg)
            )}
          >
            <div className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold shadow-sm ring-2 ring-white dark:ring-zinc-950 transition-transform",
              "text-white bg-gradient-to-br from-slate-700 to-slate-900 dark:from-zinc-100 dark:to-zinc-300 dark:text-black",
              !isOpen && !mobileOpen && "h-10 w-10"
            )}>
              {session?.nombre?.charAt(0)?.toUpperCase() || "U"}
            </div>

            {(isOpen || mobileOpen) && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-800 dark:text-zinc-100 leading-tight">
                  {session?.nombre?.split(" ")[0]}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={cn("inline-block h-1.5 w-1.5 rounded-full bg-gradient-to-r", roleConfig.gradient)} />
                  <p className={cn("truncate text-[10px] font-semibold uppercase tracking-wider", roleConfig.text)}>
                    {capabilities.label}
                  </p>
                </div>
              </div>
            )}

            {(isOpen || mobileOpen) && (
              <div className={cn("h-8 w-8 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 transition-opacity", roleConfig.bg)}>
                <Settings className={cn("h-4 w-4", roleConfig.text)} />
              </div>
            )}
          </div>
        </div>

        {/* NAVIGATION */}
        <nav className="flex-1 space-y-1 px-3 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-200 dark:scrollbar-thumb-zinc-800">
          <div className="mb-2 px-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-600">
            {(isOpen || mobileOpen) ? "Módulos" : "..."}
          </div>

          {navigation.map((item) => {
            const active = isNavigationItemActive(pathname, item);
            return <NavItem key={item.id} item={item} isActive={active} />;
          })}
        </nav>

        {/* FOOTER */}
        <div className="mt-auto border-t border-slate-100 bg-slate-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/30 backdrop-blur-sm">
          {/* THEME TOGGLE */}
          <div className={cn("mb-3 flex items-center gap-2", (isOpen || mobileOpen) ? "justify-between" : "justify-center")}>
            {(isOpen || mobileOpen) && (
              <span className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-zinc-600">
                Tema
              </span>
            )}
            <div className="flex items-center gap-2">
              {capabilities.isClientLike && (
                <ClientMovementGuideButton
                  compact={!(isOpen || mobileOpen)}
                  className={cn(
                    "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/50",
                    !(isOpen || mobileOpen) && "w-9 px-0"
                  )}
                />
              )}
              <ThemeToggle
                size="sm"
                withLabel={isOpen || mobileOpen}
                className={cn(!(isOpen || mobileOpen) && "h-9 w-9")}
              />
            </div>
          </div>
          {/* LOGOUT + VERSION */}
          <div className={cn("flex items-center", isOpen ? "justify-between" : "flex-col gap-3 justify-center")}>
            {(isOpen || mobileOpen) && (
              <span className="text-[10px] text-slate-400 dark:text-slate-600 font-mono select-none transition-opacity hover:text-slate-600 dark:hover:text-slate-400">
                {version}
              </span>
            )}

            <button
              onClick={handleLogout}
              className={cn(
                "flex items-center gap-2 rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-rose-900/10 dark:hover:text-rose-400 transition-all active:scale-95 group",
                !isOpen && !mobileOpen && "justify-center"
              )}
              title="Cerrar Sesión"
            >
              <LogOut className="h-5 w-5 transition-transform group-hover:-translate-x-0.5" />
              {(isOpen || mobileOpen) && (
                <span className="text-sm font-medium">Salir</span>
              )}
            </button>
          </div>
        </div>
      </aside>

      {/* DESKTOP SPACER */}
      <div
        className={cn(
          "hidden shrink-0 transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] md:block",
          isOpen ? "w-[280px]" : "w-[80px]"
        )}
      />
    </>
  );
}
