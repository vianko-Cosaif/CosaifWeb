"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Menu as MenuIcon,
  Users,
  MapPinned,
  TriangleAlert,
  Terminal,
  Home,
  LogOut,
  Train,
  Building2,
  ShieldHalf,
  LayoutDashboard,
} from "lucide-react";

export type Rol = "ADMINISTRADOR" | "COORDINADOR" | "CLIENTE";
export interface SidebarMenuProps {
  rol: Rol | string;
  nombre?: string;
  empresa?: string;
  version?: string;
  defaultOpen?: boolean;
  expandedWidth?: number;
  collapsedWidth?: number;
  /** "auto" respeta el SO. No afecta nada fuera del sidebar. */
  appearance?: "auto" | "light" | "dark";
}

/* ===== Tema por rol (light) ===== */
const ROLE_THEME_LIGHT = {
  ADMINISTRADOR: {
    bg: "#0D2818", text: "#E9F5ED", accent: "#40916C", border: "#1B4332",
    glass: "rgba(255,255,255,0.06)", roleBg: "rgba(64,145,108,0.15)",
    roleBorder: "#2D6A4F", roleText: "#74C69D",
  },
  COORDINADOR: {
    bg: "#1E2B3A", text: "#E0ECF7", accent: "#36B4C6", border: "#253648",
    glass: "rgba(255,255,255,0.05)", roleBg: "rgba(54,180,198,0.15)",
    roleBorder: "#2a6f7f", roleText: "#9adbe5",
  },
  CLIENTE: {
    bg: "#1E3B2E", text: "#E0F5E9", accent: "#4AC27D", border: "#25483A",
    glass: "rgba(255,255,255,0.05)", roleBg: "rgba(74,194,125,0.15)",
    roleBorder: "#2E6F53", roleText: "#B7E4C7",
  },
} as const;

/* ===== Tema por rol (dark) ===== */
const ROLE_THEME_DARK = {
  ADMINISTRADOR: {
    bg: "#07170F", text: "#EAF8F0", accent: "#58C49A", border: "#123524",
    glass: "rgba(255,255,255,0.08)", roleBg: "rgba(88,196,154,0.18)",
    roleBorder: "#1E5A40", roleText: "#9CE6C7",
  },
  COORDINADOR: {
    bg: "#121A24", text: "#E7F1FA", accent: "#50CFE0", border: "#1B2734",
    glass: "rgba(255,255,255,0.08)", roleBg: "rgba(80,207,224,0.18)",
    roleBorder: "#2D7E90", roleText: "#B7ECF3",
  },
  CLIENTE: {
    bg: "#12261D", text: "#E7FAF0", accent: "#62DB96", border: "#1B3A2E",
    glass: "rgba(255,255,255,0.08)", roleBg: "rgba(98,219,150,0.18)",
    roleBorder: "#2E6F53", roleText: "#C8F4DA",
  },
} as const;

const ROLE_ICON: Record<Rol, React.ReactNode> = {
  ADMINISTRADOR: <ShieldHalf className="h-4 w-4" />,
  COORDINADOR: <Train className="h-4 w-4" />,
  CLIENTE: <Building2 className="h-4 w-4" />,
};

/* ===== Normalizador ===== */
function normalizeRole(r?: string): Rol {
  const s = (r || "").toUpperCase().trim();
  if (s === "ADMINISTRADOR" || s === "ADMIN") return "ADMINISTRADOR";
  if (s === "COORDINADOR" || s === "COOORDINADOR" || s === "COORD") return "COORDINADOR";
  return "CLIENTE";
}

/* ===== Utils ===== */
function useMediaQuery(q: string) {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(q);
    const on = () => setOk(m.matches);
    on(); m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, [q]);
  return ok;
}
function usePrefersDark() {
  return useMediaQuery("(prefers-color-scheme: dark)");
}
function useBodyScrollLock(lock: boolean) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    if (lock) document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [lock]);
}
function useLocalStorageBool(key: string, initial = true) {
  const [v, setV] = useState(initial);
  useEffect(() => { try { const raw = localStorage.getItem(key); if (raw !== null) setV(raw === "1"); } catch {} }, [key]);
  useEffect(() => { try { localStorage.setItem(key, v ? "1" : "0"); } catch {} }, [key, v]);
  return [v, setV] as const;
}
function initialsFrom(name?: string) {
  const n = (name || "?").trim();
  return n.split(/\s+/).filter(Boolean).map((s) => s[0]?.toUpperCase()).slice(0, 2).join("") || "?";
}
function broadcastLogout() {
  try {
    const k = "auth:logout";
    localStorage.setItem(k, String(Date.now()));
    setTimeout(() => { try { localStorage.removeItem(k); } catch {} }, 500);
  } catch {}
}
function deleteClientCookies(names: string[]) {
  try {
    const host = location.hostname;
    const parts = host.split(".");
    const domains = new Set<string>([host]);
    for (let i = 0; i < parts.length - 1; i++) domains.add("." + parts.slice(i).join("."));
    const paths = ["/", "/cliente", "/admin", "/coordinador", "/supervisor", "/operador", "/maquinista"];
    names.forEach((name) => {
      document.cookie = `${name}=; Max-Age=0; path=/;`;
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/;`;
      domains.forEach((d) => paths.forEach((p) => (document.cookie = `${name}=; Max-Age=0; path=${p}; domain=${d}`)));
    });
  } catch {}
}

/* ===== Componente ===== */
export default function SidebarMenu({
  rol,
  nombre = "Usuario",
  empresa = "Empresa",
  version = "v1.2.0",
  defaultOpen = true,
  expandedWidth = 300,
  collapsedWidth = 76,
  appearance = "auto",
}: SidebarMenuProps) {
  const router = useRouter();
  const pathname = usePathname();
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const prefersDark = usePrefersDark();
  const isDark = appearance === "dark" || (appearance === "auto" && prefersDark);

  const [open, setOpen] = useLocalStorageBool("sidebar:open", defaultOpen);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useBodyScrollLock(mobileOpen && !isDesktop);

  const normRol = useMemo<Rol>(() => normalizeRole(rol as string), [rol]);
  const theme = useMemo(
    () => (isDark ? ROLE_THEME_DARK[normRol] : ROLE_THEME_LIGHT[normRol]),
    [normRol, isDark]
  );

  const openW = useMemo(() => Math.round(Math.min(Math.max(expandedWidth, 240), 420)), [expandedWidth]);
  const colW = useMemo(() => Math.round(Math.min(Math.max(collapsedWidth, 64), 104)), [collapsedWidth]);

  const asideId = "sidebar-mobile";
  const BASE = "/cliente";

  const NAV = useMemo(
    () =>
      [
        { id: "Panel", label: "Panel", href: BASE, icon: <LayoutDashboard className="h-5 w-5" />, show: normRol === "CLIENTE", exact: true },
        { id: "Movimientos", label: "Movimientos", href: `${BASE}/movimientos`, icon: <Train className="h-5 w-5" />, show: true },
        { id: "Usuario", label: "Usuarios", href: `${BASE}/usuarios`, icon: <Users className="h-5 w-5" />, show: normRol !== "CLIENTE" },
        { id: "Localidad", label: "Localidad y Vías", href: `${BASE}/localidad`, icon: <MapPinned className="h-5 w-5" />, show: normRol !== "CLIENTE" },
        { id: "Incidente", label: "Registro de Incidentes", href: `/incidentes`, icon: <TriangleAlert className="h-5 w-5" />, show: true },
        { id: "Terminal", label: "Terminal", href: `${BASE}/terminal`, icon: <Terminal className="h-5 w-5" />, show: normRol !== "CLIENTE" },
      ]
        .filter((i) => i.show)
        .map((it) => ({
          ...it,
          isActive: it.exact ? pathname === it.href : pathname.startsWith(it.href),
        })),
    [normRol, pathname]
  );

  const vars: React.CSSProperties = {
    "--sb-bg": theme.bg,
    "--sb-text": theme.text,
    "--sb-accent": theme.accent,
    "--sb-border": theme.border,
    "--sb-glass": theme.glass,
    "--sb-role-bg": theme.roleBg,
    "--sb-role-border": theme.roleBorder,
    "--sb-role-text": theme.roleText,
    "--sbw-open": `${openW}px`,
    "--sbw-collapsed": `${colW}px`,
  } as React.CSSProperties;

  async function handleLogoutLocal() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      try { localStorage.removeItem("user"); } catch {}
      try { localStorage.removeItem("token"); } catch {}
      try { sessionStorage.clear(); } catch {}
      deleteClientCookies(["auth", "role", "session", "token"]);
      broadcastLogout();
    } finally {
      setMobileOpen(false);
      try { router.replace("/login"); } catch {}
      setTimeout(() => { if (location.pathname !== "/login") location.replace("/login"); }, 80);
      setTimeout(() => setLoggingOut(false), 400);
    }
  }

  useEffect(() => {
    const onStorage = (e: StorageEvent) => { if (e.key === "auth:logout") router.replace("/login"); };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [router]);

  /* ===== Desktop ===== */
  const Desktop = (
    <aside data-appearance={isDark ? "dark" : "light"} style={vars} className="fixed left-0 top-0 z-40 hidden h-svh border-r md:flex" aria-label="Barra lateral">
      <div
        className="flex h-full flex-col border-r text-[var(--sb-text)] shadow-xl"
        style={{ width: open ? "var(--sbw-open)" : "var(--sbw-collapsed)", background: "var(--sb-bg)", borderColor: "var(--sb-border)" }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 border-b px-4 pt-6 pb-4" style={{ borderColor: "var(--sb-border)", paddingTop: "max(1rem, env(safe-area-inset-top))" }}>
          <Home className="h-5 w-5" />
          {open && (
            <div className="min-w-0 flex-1">
              <div className="font-semibold tracking-wide">COSAIF LOGISTICS</div>
              <div className="text-xs opacity-70">Panel</div>
            </div>
          )}
          <button
            type="button"
            aria-label={open ? "Colapsar menú" : "Expandir menú"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-md border"
            style={{ borderColor: "var(--sb-border)", background: "var(--sb-glass)", color: "var(--sb-text)" }}
          >
            <MenuIcon className="h-4 w-4" />
          </button>
        </div>

        {/* User */}
        <div className="flex items-center gap-3 border-b px-4 py-4" style={{ borderColor: "var(--sb-border)" }}>
          <div
            className="grid h-10 w-10 place-items-center rounded-full border-2 font-bold"
            style={{ borderColor: "var(--sb-role-text)", background: "var(--sb-accent)", color: "var(--sb-bg)" }}
            aria-hidden="true"
          >
            {initialsFrom(nombre)}
          </div>
          {open && (
            <div className="min-w-0">
              <div className="truncate font-medium" title={nombre}>{nombre}</div>
              <div className="truncate text-xs opacity-80" title={empresa}>{empresa}</div>
            </div>
          )}
        </div>

        {/* Rol */}
        {open && (
          <div
            className="mx-4 mt-3 rounded-full border px-3 py-1 text-xs"
            style={{ background: "var(--sb-role-bg)", borderColor: "var(--sb-role-border)", color: "var(--sb-role-text)" }}
          >
            <span className="inline-flex items-center gap-2">{ROLE_ICON[normRol]} {normRol}</span>
          </div>
        )}

        {/* Items */}
        <nav className="mt-3 flex-1 overflow-y-auto px-2" role="navigation" aria-label="Navegación principal">
          {NAV.map((it) => (
            <button
              key={it.id}
              type="button"
              onClick={() => router.push(it.href)}
              aria-current={it.isActive ? "page" : undefined}
              className={[
                "group flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors motion-safe:duration-200",
                it.isActive ? "bg-white/10 ring-1 ring-inset ring-[var(--sb-accent)]" : "hover:bg-white/5",
              ].join(" ")}
              style={{ color: "var(--sb-text)" }}
            >
              <span className="shrink-0 opacity-90">{it.icon}</span>
              {open && <span className="truncate">{it.label}</span>}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="mt-auto border-t px-3 py-4 text-xs opacity-80" style={{ borderColor: "var(--sb-border)", paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
          {open ? (
            <div className="flex items-center justify-between">
              <span>{version}</span>
              <button
                type="button"
                onClick={handleLogoutLocal}
                disabled={loggingOut}
                aria-busy={loggingOut}
                className="inline-flex items-center gap-2 rounded-md border px-2 py-1 disabled:opacity-60"
                style={{ borderColor: "var(--sb-border)", background: "var(--sb-glass)", color: "var(--sb-text)" }}
              >
                <LogOut className="h-4 w-4" /> {loggingOut ? "Saliendo…" : "Cerrar sesión"}
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center">
              <button
                type="button"
                onClick={handleLogoutLocal}
                disabled={loggingOut}
                aria-busy={loggingOut}
                className="inline-flex items-center justify-center rounded-md border p-2 disabled:opacity-60"
                style={{ borderColor: "var(--sb-border)", background: "var(--sb-glass)", color: "var(--sb-text)" }}
                title="Cerrar sesión"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );

  /* ===== Mobile ===== */
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => { if (mobileOpen) closeBtnRef.current?.focus(); }, [mobileOpen]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMobileOpen(false); };
    if (mobileOpen) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  const Mobile = (
    <>
      <button
        type="button"
        aria-controls={asideId}
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen(true)}
        className="fixed left-3 top-[max(0.5rem,env(safe-area-inset-top))] z-30 inline-flex h-10 w-10 items-center justify-center rounded-md border shadow md:hidden"
        style={{ background: "var(--sb-glass)", color: "var(--sb-text)", borderColor: "var(--sb-border)" }}
      >
        <MenuIcon className="h-5 w-5" />
        <span className="sr-only">Abrir menú</span>
      </button>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden" onClick={() => setMobileOpen(false)} aria-hidden="true" />
      )}

      <aside
        id={asideId}
        data-appearance={isDark ? "dark" : "light"}
        style={vars}
        role="dialog"
        aria-modal="true"
        aria-hidden={!mobileOpen}
        className={[
          "fixed inset-y-0 left-0 z-50 md:hidden",
          "text-[var(--sb-text)] shadow-2xl transition-transform motion-safe:duration-200 ease-out will-change-transform",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        <div className="flex h-full w-[min(92vw,360px)] flex-col" style={{ background: "var(--sb-bg)" }}>
          <div className="flex items-center gap-2 border-b px-4 py-4" style={{ borderColor: "var(--sb-border)", paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}>
            <Home className="h-5 w-5" />
            <div className="flex-1">
              <div className="font-semibold tracking-wide">COSAIF LOGISTICS</div>
              <div className="text-xs opacity-70">Panel</div>
            </div>
            <button
              ref={closeBtnRef}
              type="button"
              aria-label="Cerrar menú"
              onClick={() => setMobileOpen(false)}
              className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-md border"
              style={{ borderColor: "var(--sb-border)", background: "var(--sb-glass)", color: "var(--sb-text)" }}
            >
              ✕
            </button>
          </div>

          <div className="flex items-center gap-3 border-b px-4 py-4" style={{ borderColor: "var(--sb-border)" }}>
            <div
              className="grid h-10 w-10 place-items-center rounded-full border-2 font-bold"
              style={{ borderColor: "var(--sb-role-text)", background: "var(--sb-accent)", color: "var(--sb-bg)" }}
              aria-hidden="true"
            >
              {initialsFrom(nombre)}
            </div>
            <div className="min-w-0">
              <div className="truncate font-medium">{nombre}</div>
              <div className="truncate text-xs opacity-80">{empresa}</div>
            </div>
          </div>

          <div
            className="mx-4 mt-3 rounded-full border px-3 py-1 text-xs"
            style={{ background: "var(--sb-role-bg)", borderColor: "var(--sb-role-border)", color: "var(--sb-role-text)" }}
          >
            <span className="inline-flex items-center gap-2">{ROLE_ICON[normRol]} {normRol}</span>
          </div>

          <nav className="mt-3 flex-1 overflow-y-auto px-2" role="navigation" aria-label="Navegación principal">
            {NAV.map((it) => (
              <button
                key={it.id}
                type="button"
                onClick={() => { router.push(it.href); setMobileOpen(false); }}
                aria-current={it.isActive ? "page" : undefined}
                className={[
                  "group flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors motion-safe:duration-200",
                  it.isActive ? "bg-white/10 ring-1 ring-inset ring-[var(--sb-accent)]" : "hover:bg-white/5",
                ].join(" ")}
                style={{ color: "var(--sb-text)" }}
              >
                <span className="shrink-0 opacity-90">{it.icon}</span>
                <span className="truncate">{it.label}</span>
              </button>
            ))}
          </nav>

          <div className="mt-auto border-t px-3 py-4" style={{ borderColor: "var(--sb-border)", paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}>
            <button
              type="button"
              onClick={handleLogoutLocal}
              disabled={loggingOut}
              aria-busy={loggingOut}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm disabled:opacity-60"
              style={{ borderColor: "var(--sb-border)", background: "var(--sb-glass)", color: "var(--sb-text)" }}
            >
              <LogOut className="h-4 w-4" /> {loggingOut ? "Saliendo…" : "Cerrar sesión"}
            </button>
            <div className="mt-2 text-center text-xs opacity-70" style={{ color: "var(--sb-text)" }}>{version}</div>
          </div>
        </div>
      </aside>
    </>
  );

  return (
    <>
      {Desktop}
      {Mobile}
      {/* Spacer solo desktop */}
      <div className="hidden md:block" style={{ width: open ? openW : colW }} />
    </>
  );
}
