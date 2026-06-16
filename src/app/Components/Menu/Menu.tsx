"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
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
  CircleHelp,
  Search,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import ThemeToggle from "@/app/Components/ui/ThemeToggle";

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
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  hide?: boolean;
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
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpQuery, setHelpQuery] = useState("");
  const [helpSuggestionModalOpen, setHelpSuggestionModalOpen] = useState(false);
  const [session, setSession] = useState<UserSession | null>(null);
  const [mounted, setMounted] = useState(false);
  const helpPanelRef = useRef<HTMLDivElement | null>(null);
  const helpSuggestionModalRef = useRef<HTMLDivElement | null>(null);

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
    const previousOverflow = document.body.style.overflow;
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setHelpSuggestionModalOpen(false);
        setMobileOpen(false);
        setHelpOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileOpen]);

  useEffect(() => {
    if (!helpOpen) return;

    const onPointerDown = (event: MouseEvent) => {
      if (helpSuggestionModalOpen) return;
      const target = event.target as Node;
      if (helpSuggestionModalRef.current?.contains(target)) return;
      if (!helpPanelRef.current?.contains(target)) {
        setHelpOpen(false);
      }
    };

    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, [helpOpen, helpSuggestionModalOpen]);

  useEffect(() => {
    if (!helpOpen) {
      setHelpSuggestionModalOpen(false);
    }
  }, [helpOpen]);

  useEffect(() => {
    setHelpQuery("");
    setHelpSuggestionModalOpen(false);
    setHelpOpen(false);
  }, [pathname, isOpen, mobileOpen]);

  const normRol = useMemo<Rol>(() => {
    const r = String(session?.rol || "").toUpperCase();
    if (r.includes("ADMIN")) return "ADMINISTRADOR";
    if (r.includes("COORD")) return "COORDINADOR";
    if (r.includes("SUP")) return "SUPERVISOR";
    return "CLIENTE";
  }, [session]);

  const base = useMemo(() => `/${normRol.toLowerCase()}`, [normRol]);
  const roleConfig = ROLE_CONFIG[normRol] || ROLE_CONFIG.CLIENTE;
  const showExpandedSidebar = isOpen || mobileOpen;
  const showMovimientoSuggestions = helpQuery.trim().toLowerCase().includes("movimiento");
  const helpSuggestions = showMovimientoSuggestions
    ? ["¿como crear un movimiento?", "¿como crear un movimiento con torno?"]
    : [];

  const navigation = useMemo<NavigationItem[]>(() => {
    return [
      { id: "dash", label: "Dashboard", href: base, icon: LayoutDashboard },
      { id: "movs", label: "Movimientos", href: `${base}/movimientos`, icon: Train },
      { id: "torno", label: normRol === "CLIENTE" ? "Historial Torno" : "Torno", href: `${base}/torno`, icon: Wrench },
      {
        id: "users",
        label: "Gestión Usuarios",
        href: `${base}/usuarios`,
        hide: ["CLIENTE", "SUPERVISOR"].includes(normRol),
        icon: Users,
      },
      { id: "inc", label: "Incidentes", href: `${base}/incidentes`, icon: TriangleAlert },
      {
        id: "reporteria",
        label: "Reportería",
        href: `${base}/reporteria`,
        hide: !["ADMINISTRADOR", "COORDINADOR"].includes(normRol),
        icon: BarChart3,
      },
    ].filter((item) => !item.hide);
  }, [normRol, base]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    document.cookie = "token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT";
    document.cookie = "role=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT";
    router.replace("/login");
  };

  if (!mounted) return null;

  // NavItem Component
  const NavItem = ({ item, isActive }: { item: NavigationItem, isActive: boolean }) => (
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
        onClick={() => {
          setMobileOpen(false);
          setHelpOpen(false);
        }}
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
                    {roleConfig.label}
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
            {showExpandedSidebar ? "Módulos" : "..."}
          </div>

          {navigation.map((item) => {
            const active = pathname === item.href || (item.href !== base && pathname.startsWith(item.href));
            return <NavItem key={item.id} item={item} isActive={active} />;
          })}
        </nav>

        {/* FOOTER */}
        <div className="mt-auto border-t border-slate-100 bg-slate-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/30 backdrop-blur-sm">
          <div
            ref={helpPanelRef}
            className={cn("relative mb-3 flex items-center", showExpandedSidebar ? "justify-between" : "justify-center")}
          >
            {showExpandedSidebar && (
              <span className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-zinc-600">
                ¿en que te puedo ayudar?
              </span>
            )}
            <button
              type="button"
              onClick={() =>
                setHelpOpen((current) => {
                  const next = !current;
                  if (!next) setHelpSuggestionModalOpen(false);
                  return next;
                })
              }
              className={cn(
                "inline-flex items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 active:scale-[.98] transition dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700",
                showExpandedSidebar ? "h-9 px-3" : "h-9 w-9"
              )}
              title="Abrir ayuda"
              aria-label={showExpandedSidebar ? undefined : "Abrir ayuda"}
              aria-expanded={helpOpen}
              aria-controls="sidebar-help-panel"
            >
              <CircleHelp className="h-4 w-4" />
            </button>

            {helpOpen && (
              <div
                id="sidebar-help-panel"
                className="absolute bottom-0 left-full z-[60] ml-3 w-80 max-w-[calc(100vw-6rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
                role="dialog"
                aria-label="Panel de ayuda"
              >
                <div className="border-b border-slate-100 px-4 py-3 dark:border-zinc-800">
                  <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100">¿en que te puedo ayudar?</p>
                </div>
                <div className="px-4 py-5">
                  <label htmlFor="sidebar-help-search" className="sr-only">
                    Buscar ayuda
                  </label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
                    <input
                      id="sidebar-help-search"
                      type="text"
                      value={helpQuery}
                      onChange={(event) => setHelpQuery(event.target.value)}
                      placeholder="Escribe una palabra clave"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-sky-400 focus:bg-white dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-sky-500"
                    />
                  </div>

                  {helpSuggestions.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {helpSuggestions.map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => setHelpSuggestionModalOpen(true)}
                          className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-left text-sm text-slate-700 transition hover:border-sky-300 hover:bg-sky-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-sky-700 dark:hover:bg-zinc-900"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* THEME TOGGLE */}
          <div className={cn("mb-3 flex items-center", showExpandedSidebar ? "justify-between" : "justify-center")}>
            {showExpandedSidebar && (
              <span className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-zinc-600">
                Tema
              </span>
            )}
            <ThemeToggle
              size="sm"
              withLabel={showExpandedSidebar}
              className={cn(!showExpandedSidebar && "h-9 w-9")}
            />
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

      {helpSuggestionModalOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-zinc-950/50 px-4 backdrop-blur-sm"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setHelpSuggestionModalOpen(false);
            }
          }}
        >
          <div
            ref={helpSuggestionModalRef}
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
            role="dialog"
            aria-label="Respuesta de ayuda"
          >
            <div className="border-b border-slate-100 px-4 py-3 dark:border-zinc-800">
              <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100">Ayuda</p>
            </div>
            <div className="px-4 py-5">
              <p className="text-sm text-slate-600 dark:text-zinc-300">hola</p>
            </div>
            <div className="flex justify-end border-t border-slate-100 px-4 py-3 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setHelpSuggestionModalOpen(false)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
