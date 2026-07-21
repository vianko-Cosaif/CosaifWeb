"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Boxes,
  ContactRound,
  FileSpreadsheet,
  FileText,
  HandCoins,
  PackageCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { GuidedTarget, useGuidedManualApi } from "@/app/Components/GuidedManualAtom";
import ThemeToggle from "@/app/Components/ui/ThemeToggle";
import { CLIENT_MOVEMENT_GUIDE_ID, CLIENT_MOVEMENT_MOBILE_GUIDE_ID } from "@/app/Components/GuidedManualAtom/ClientMovementGuide.config";
import { ClientMovementGuideButton } from "@/app/Components/GuidedManualAtom/ClientMovementGuide";
import { buildNavigationForRole, isNavigationItemActive, type AppNavigationItem } from "@/lib/appNavigation";
import { getRoleClient } from "@/lib/cookies";
import { getRoleCapabilities, normalizeAppRole, type AppRole, type NavModuleId } from "@/lib/accessControl";
import { clearAuthenticatedSession } from "@/lib/sessionLogout";

/* ==========================================================================
   INTERFACES & TYPES
   ========================================================================== */
export type Rol = "ADMINISTRADOR" | "COMERCIAL" | "COORDINADOR" | "SUPERVISOR" | "CLIENTE";

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

type HelpGuideAction = "client-create-movement" | "client-create-movement-mobile" | "legacy-create-movement" | "legacy-create-movement-torno";

type HelpSuggestion = {
  id: string;
  label: string;
  description: string;
  keywords: string[];
  roles?: Rol[];
  action: HelpGuideAction;
};

const HELP_GUIDE_CATALOG: HelpSuggestion[] = [
  {
    id: "client-create-movement-mobile",
    label: "Crear movimiento paso a paso (Mobile / Paginado)",
    description: "Guía interactiva optimizada para el flujo mobile/paginado paso a paso.",
    keywords: ["movimiento", "crear", "nuevo", "mobile", "paginado", "guia", "wizard"],
    roles: ["CLIENTE"],
    action: "client-create-movement-mobile",
  },
  {
    id: "client-guide-button-flow",
    label: "Wizard del botón Guía",
    description: "Mismo flujo del botón Guía: acompaña al cliente desde Movimientos hasta confirmar la solicitud.",
    keywords: ["guia", "boton", "wizard", "cliente", "movimiento", "paso", "confirmar"],
    roles: ["CLIENTE"],
    action: "client-create-movement",
  },
  {
    id: "create-movement-torno",
    label: "Cómo crear un movimiento con torno",
    description: "Asistente para el flujo con mediciones de ruedas, PDF y cierre del movimiento.",
    keywords: ["movimiento", "torno", "ruedas", "medicion", "pdf", "calendarizar", "wizard"],
    action: "legacy-create-movement-torno",
  },
];

function readStoredSession(): UserSession | null {
  if (typeof window === "undefined") return null;
  for (const storage of [window.sessionStorage, window.localStorage]) {
    try {
      const rawUser = storage.getItem("user");
      if (!rawUser) continue;
      const parsed = JSON.parse(rawUser) as UserSession | null;
      if (parsed?.id || parsed?.rol || parsed?.nombre) return parsed;
    } catch {
      // seguimos con la siguiente fuente
    }
  }
  return null;
}

function inferRoleFromPath(pathname: string | null): AppRole | null {
  const path = String(pathname || "").toLowerCase();
  if (path.startsWith("/administrador")) return "ADMINISTRADOR";
  if (path.startsWith("/comercial")) return "COMERCIAL";
  if (path.startsWith("/coordinador")) return "COORDINADOR";
  if (path.startsWith("/supervisor")) return "SUPERVISOR";
  if (path.startsWith("/cliente/torreon")) return "ARRASTRE_TORREON";
  if (path.startsWith("/cliente")) return "CLIENTE";
  return null;
}

const COMMON_ROLE_STYLE = {
  text: "text-[var(--app-accent)]",
  bg: "bg-[var(--app-accent-soft)]",
  gradient: "from-emerald-600 to-teal-600",
  border: "border-[var(--app-border)]",
  ring: "ring-[var(--app-focus)]",
  hoverBg: "hover:bg-[var(--app-surface-muted)]",
} as const;

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
    ...COMMON_ROLE_STYLE,
    icon: ShieldHalf,
    label: "Administrador",
  },
  COMERCIAL: {
    ...COMMON_ROLE_STYLE,
    icon: BarChart3,
    label: "Comercial",
  },
  COORDINADOR: {
    ...COMMON_ROLE_STYLE,
    icon: Train,
    label: "Coordinador",
  },
  SUPERVISOR: {
    ...COMMON_ROLE_STYLE,
    icon: Users,
    label: "Supervisor",
  },
  CLIENTE: {
    ...COMMON_ROLE_STYLE,
    icon: Building2,
    label: "Cliente",
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
  commercial_general: BarChart3,
  commercial_clients: ContactRound,
  commercial_contracts: FileText,
  commercial_packages: PackageCheck,
  commercial_collections: HandCoins,
  commercial_reports: FileSpreadsheet,
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
  const guidedManualApi = useGuidedManualApi();

  const [isOpen, setIsOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpQuery, setHelpQuery] = useState("");
  const [session, setSession] = useState<UserSession | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [mounted, setMounted] = useState(false);
  const helpPanelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMounted(true);
    setSession(readStoredSession());
    // Auto-collapse on small screens
    if (window.innerWidth < 1024) setIsOpen(false);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const syncSession = () => setSession(readStoredSession());
    window.addEventListener("storage", syncSession);
    window.addEventListener("focus", syncSession);
    document.addEventListener("visibilitychange", syncSession);
    return () => {
      window.removeEventListener("storage", syncSession);
      window.removeEventListener("focus", syncSession);
      document.removeEventListener("visibilitychange", syncSession);
    };
  }, [mounted]);

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
      const target = event.target as Node;
      if (!helpPanelRef.current?.contains(target)) {
        setHelpOpen(false);
      }
    };

    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, [helpOpen]);

  useEffect(() => {
    setHelpQuery("");
    setHelpOpen(false);
  }, [pathname, isOpen, mobileOpen]);

  const appRole = useMemo(() => (
    normalizeAppRole(String(session?.rol || "")) ??
    normalizeAppRole(getRoleClient()) ??
    inferRoleFromPath(pathname) ??
    "CLIENTE"
  ), [session, pathname]);
  const capabilities = useMemo(() => getRoleCapabilities(appRole), [appRole]);
  const normRol = useMemo<Rol>(() => {
    if (capabilities.area === "administrador") return "ADMINISTRADOR";
    if (capabilities.area === "comercial") return "COMERCIAL";
    if (capabilities.area === "coordinador") return "COORDINADOR";
    if (capabilities.area === "supervisor") return "SUPERVISOR";
    return "CLIENTE";
  }, [capabilities.area]);
  const roleConfig = ROLE_CONFIG[normRol] || ROLE_CONFIG.CLIENTE;
  const showExpandedSidebar = isOpen || mobileOpen;
  const normalizedHelpQuery = helpQuery.trim().toLowerCase();
  const helpSuggestions = useMemo(() => {
    const available = HELP_GUIDE_CATALOG.filter((item) => !item.roles || item.roles.includes(normRol));
    if (!normalizedHelpQuery) return available.slice(0, 4);

    return available.filter((item) => {
      const haystack = [item.label, item.description, ...item.keywords].join(" ").toLowerCase();
      return normalizedHelpQuery
        .split(/\s+/)
        .filter(Boolean)
        .every((term) => haystack.includes(term));
    });
  }, [normRol, normalizedHelpQuery]);

  const closeHelpAssistant = useCallback(() => {
    setHelpOpen(false);
    setHelpQuery("");
  }, []);

  const runHelpSuggestion = useCallback(
    (suggestion: HelpSuggestion) => {
      if (suggestion.action === "client-create-movement" && guidedManualApi) {
        guidedManualApi.startManual(CLIENT_MOVEMENT_GUIDE_ID);
        closeHelpAssistant();
        return;
      }

      if (suggestion.action === "client-create-movement-mobile" && guidedManualApi) {
        guidedManualApi.startManual(CLIENT_MOVEMENT_MOBILE_GUIDE_ID);
        closeHelpAssistant();
        return;
      }

      if (suggestion.action === "legacy-create-movement-torno") {
        window.dispatchEvent(new CustomEvent("cosaif:start-create-movement-torno-guide"));
        closeHelpAssistant();
        return;
      }

      window.dispatchEvent(new CustomEvent("cosaif:start-create-movement-guide"));
      closeHelpAssistant();
    },
    [closeHelpAssistant, guidedManualApi]
  );

  const navigation = useMemo<NavigationItem[]>(() => {
    return buildNavigationForRole(appRole).map((item: AppNavigationItem) => ({
      ...item,
      label: item.id === "torno" && capabilities.isClientLike ? "Historial Torno" : item.label,
      icon: NAV_ICONS[item.id],
    }));
  }, [appRole, capabilities.isClientLike]);
  const mobileNavigation = useMemo(() => {
    if (capabilities.area === "comercial") return navigation.slice(0, 3);
    const preferred = [
      navigation.find((item) => item.id === "dashboard"),
      navigation.find((item) => item.id === "torreon_arrastres") ?? navigation.find((item) => item.id === "movimientos"),
      navigation.find((item) => item.id === "incidentes") ?? navigation.find((item) => item.id === "reporteria"),
    ].filter((item): item is NavigationItem => Boolean(item));
    return preferred.filter((item, index) => preferred.findIndex((candidate) => candidate.id === item.id) === index);
  }, [navigation, capabilities.area]);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutError("");

    try {
      await clearAuthenticatedSession();
      router.replace("/login");
      router.refresh();
    } catch {
      setLogoutError("No se pudo cerrar la sesión. Inténtalo de nuevo.");
      setLoggingOut(false);
    }
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
        "group relative flex w-full items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 transition-colors duration-150",
        // Active State
        isActive
          ? cn("font-bold", roleConfig.bg, roleConfig.text, roleConfig.border)
          : cn("text-[var(--app-text-muted)] hover:text-[var(--app-text)]", roleConfig.hoverBg),
        !isOpen && !mobileOpen ? "justify-center px-2" : ""
      )}
      title={!isOpen ? item.label : undefined}
      >
      <item.icon
        className={cn(
          "h-5 w-5 shrink-0 transition-transform duration-300",
          isActive ? roleConfig.text : "text-[var(--app-text-soft)] group-hover:text-[var(--app-text-muted)]"
        )}
      />

      {(isOpen || mobileOpen) && (
        <span className="truncate text-sm tracking-wide">{item.label}</span>
      )}

      {/* Active Indicator (Glowing line) */}
      {isActive && (
        <div className="absolute left-0 h-5 w-0.5 rounded-r bg-[var(--app-accent)]" />
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
        className="fixed left-4 top-[calc(env(safe-area-inset-top)+1rem)] z-40 flex h-11 items-center justify-center gap-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 shadow-sm transition-colors hover:bg-[var(--app-surface-muted)] active:scale-95 md:hidden"
        aria-label="Abrir menú"
        aria-expanded={mobileOpen}
        aria-controls="cosaif-sidebar"
      >
        <MenuIcon className="h-5 w-5 text-[var(--app-text-muted)]" />
        <span className="text-sm font-black text-[var(--app-text)]">COSAIF</span>
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

      {!mobileOpen ? (
        <nav aria-label="Navegación principal" className="fixed inset-x-3 bottom-[max(.75rem,env(safe-area-inset-bottom))] z-40 grid grid-cols-4 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-1.5 shadow-[var(--app-shadow-md)] md:hidden">
          {mobileNavigation.map((item) => {
            const active = isNavigationItemActive(pathname, item);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => router.push(item.href)}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-black transition ${active ? "bg-[var(--app-accent-soft)] text-[var(--app-accent)]" : "text-[var(--app-text-muted)]"}`}
                aria-current={active ? "page" : undefined}
              >
                <item.icon className="h-5 w-5" aria-hidden />
                <span className="max-w-full truncate">{item.label}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-black text-[var(--app-text-muted)] transition hover:bg-[var(--app-surface-muted)]"
          >
            <MenuIcon className="h-5 w-5" aria-hidden />
            Más
          </button>
        </nav>
      ) : null}

      {/* SIDEBAR CONTAINER */}
      <aside
        id="cosaif-sidebar"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-[var(--app-border)] bg-[var(--app-sidebar)] transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)]",
          mobileOpen ? "translate-x-0 w-[280px] shadow-2xl" : "-translate-x-full md:translate-x-0",
          !mobileOpen && (isOpen ? "md:w-[280px]" : "md:w-[80px]")
        )}
      >
        {/* HEADER */}
        <div className="flex h-20 shrink-0 items-center justify-between px-5 md:px-4 relative">
          <div className={cn("flex items-center gap-3 transition-opacity", !isOpen && !mobileOpen ? "w-full justify-center" : "")}>
            <div className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-sm transition-colors",
              roleConfig.gradient
            )}>
              <Home className="h-5 w-5" />
            </div>

            {(isOpen || mobileOpen) && (
              <div className="flex flex-col animate-in fade-in slide-in-from-left-2 duration-300">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--app-text-soft)]">Logistics</span>
                <span className="text-xl font-black leading-none text-[var(--app-text)]">COSAIF</span>
              </div>
            )}
          </div>

          {/* COLLAPSE TOGGLE (Moved to Header) */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="absolute right-[-12px] top-1/2 z-50 hidden h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text-muted)] shadow-sm transition-colors hover:text-[var(--app-text)] md:flex"
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
              "relative flex items-center gap-3 overflow-hidden rounded-lg border transition-colors",
              !isOpen && !mobileOpen
                ? "justify-center px-0 py-3 border-transparent bg-transparent"
                : "border-[var(--app-border)] bg-[var(--app-surface-subtle)] p-3 shadow-sm"
            )}
          >
            <div className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-800 text-sm font-bold text-white shadow-sm ring-2 ring-[var(--app-surface)] dark:bg-slate-200 dark:text-slate-900",
              !isOpen && !mobileOpen && "h-10 w-10"
            )}>
              {session?.nombre?.charAt(0)?.toUpperCase() || "U"}
            </div>

            {(isOpen || mobileOpen) && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold leading-tight text-[var(--app-text)]">
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
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-200 dark:scrollbar-thumb-zinc-800">
          <div className="mb-2 px-2 text-[10px] font-bold uppercase tracking-widest text-[var(--app-text-soft)]">
            {showExpandedSidebar ? "Módulos" : "..."}
          </div>

          {navigation.map((item) => {
            const active = isNavigationItemActive(pathname, item);
            const navItem = <NavItem key={item.id} item={item} isActive={active} />;

            if (item.id === "movimientos") {
              return (
                <GuidedTarget key={item.id} id="sidebar-menu-movimientos" className="w-full">
                  {navItem}
                </GuidedTarget>
              );
            }

            return navItem;
          })}
        </nav>

        {/* FOOTER */}
        <div className="mt-auto border-t border-[var(--app-border)] bg-[var(--app-surface-subtle)] p-4 backdrop-blur-sm">
          <div
            ref={helpPanelRef}
            className={cn("relative mb-3 flex items-center", showExpandedSidebar ? "justify-between" : "justify-center")}
          >
            {showExpandedSidebar && (
              <span className="text-[10px] uppercase tracking-widest text-[var(--app-text-soft)]">
                Ayuda
              </span>
            )}
            <button
              type="button"
              onClick={() =>
                setHelpOpen((current) => {
                  const next = !current;
                  return next;
                })
              }
              className={cn(
                "inline-flex items-center justify-center rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text-muted)] transition hover:bg-[var(--app-surface-muted)] active:scale-[.98]",
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
                className="absolute bottom-0 left-full z-[60] ml-3 w-80 max-w-[calc(100vw-6rem)] overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] shadow-2xl"
                role="dialog"
                aria-label="Panel de ayuda"
              >
                <div className="border-b border-[var(--app-border)] px-4 py-3">
                  <p className="text-sm font-semibold text-[var(--app-text)]">Asistente de guías</p>
                  <p className="mt-0.5 text-xs text-[var(--app-text-muted)]">
                    Busca un proceso y lanza la guía o wizard correspondiente.
                  </p>
                </div>
                <div className="px-4 py-5">
                  <label htmlFor="sidebar-help-search" className="sr-only">
                    Buscar ayuda
                  </label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-text-soft)]" />
                    <input
                      id="sidebar-help-search"
                      type="text"
                      value={helpQuery}
                      onChange={(event) => setHelpQuery(event.target.value)}
                      placeholder="Ej. movimiento, torno, PDF, solicitud"
                      className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] py-2.5 pl-9 pr-3 text-sm text-[var(--app-text)] outline-none transition focus:border-[var(--app-accent)] focus:bg-[var(--app-surface)]"
                    />
                  </div>

                  <div className="mt-4 space-y-2">
                    {helpSuggestions.length > 0 ? (
                      helpSuggestions.map((suggestion) => (
                        <button
                          key={suggestion.id}
                          type="button"
                          onClick={() => runHelpSuggestion(suggestion)}
                          className="block w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-3 py-2.5 text-left transition hover:border-[var(--app-accent)] hover:bg-[var(--app-surface-muted)]"
                        >
                          <span className="block text-sm font-semibold text-[var(--app-text)]">
                            {suggestion.label}
                          </span>
                          <span className="mt-1 block text-xs leading-5 text-[var(--app-text-muted)]">
                            {suggestion.description}
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="rounded-xl border border-dashed border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-3 py-4 text-xs text-[var(--app-text-muted)]">
                        No encontré una guía con esa búsqueda. Intenta con movimiento, torno o PDF.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* THEME TOGGLE */}
          <div className={cn("mb-3 flex items-center gap-2", (isOpen || mobileOpen) ? "justify-between" : "justify-center")}>
            {(isOpen || mobileOpen) && (
              <span className="text-[10px] uppercase tracking-widest text-[var(--app-text-soft)]">
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
          {logoutError && showExpandedSidebar ? (
            <p role="alert" className="mb-2 text-xs leading-5 text-rose-600 dark:text-rose-300">
              {logoutError}
            </p>
          ) : null}
          <div className={cn("flex items-center", isOpen ? "justify-between" : "flex-col gap-3 justify-center")}>
            {(isOpen || mobileOpen) && (
              <span className="select-none font-mono text-[10px] text-[var(--app-text-soft)]">
                {version}
              </span>
            )}

            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className={cn(
                "group flex items-center gap-2 rounded-lg p-2 text-[var(--app-text-muted)] transition-colors hover:bg-rose-50 hover:text-rose-600 active:scale-95 disabled:cursor-wait disabled:opacity-60 dark:hover:bg-rose-950/30 dark:hover:text-rose-300",
                !isOpen && !mobileOpen && "justify-center"
              )}
              title={loggingOut ? "Cerrando sesión" : "Cerrar sesión"}
              aria-busy={loggingOut}
            >
              <LogOut className="h-5 w-5 transition-transform group-hover:-translate-x-0.5" />
              {(isOpen || mobileOpen) && (
                <span className="text-sm font-medium">{loggingOut ? "Saliendo…" : "Salir"}</span>
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
