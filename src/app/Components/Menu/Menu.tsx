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

/* ===== Tipos ===== */
export type Rol = "ADMINISTRADOR" | "COORDINADOR" | "SUPERVISOR" | "CLIENTE";

type Theme = {
  bg: string;
  text: string;
  accent: string;
  border: string;
  glass: string;
  roleBg: string;
  roleBorder: string;
  roleText: string;
};

type SidebarCSSVars = React.CSSProperties & {
  "--sb-bg": string;
  "--sb-text": string;
  "--sb-accent": string;
  "--sb-border": string;
  "--sb-glass": string;
  "--sb-role-bg": string;
  "--sb-role-border": string;
  "--sb-role-text": string;
  "--sbw-open": string;
  "--sbw-collapsed": string;
};

export interface SidebarMenuProps {
  rol?: Rol | string;
  nombre?: string;
  empresa?: string;
  version?: string;
  defaultOpen?: boolean;
  expandedWidth?: number;
  collapsedWidth?: number;
  /** "auto" respeta el SO. No afecta nada fuera del sidebar. */
  appearance?: "auto" | "light" | "dark";
}

/* ===== Helpers ===== */
function getCookie(name: string): string {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : "";
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
  SUPERVISOR: {
    bg: "#232038", text: "#ECE9FE", accent: "#7C3AED", border: "#2F2A4E",
    glass: "rgba(255,255,255,0.06)", roleBg: "rgba(124,58,237,0.15)",
    roleBorder: "#5B21B6", roleText: "#C4B5FD",
  },
  CLIENTE: {
    bg: "#1E3B2E", text: "#E0F5E9", accent: "#4AC27D", border: "#25483A",
    glass: "rgba(255,255,255,0.05)", roleBg: "rgba(74,194,125,0.15)",
    roleBorder: "#2E6F53", roleText: "#B7E4C7",
  },
} satisfies Record<Rol, Theme>;

/* ===== Tema por rol (dark) ===== */
const ROLE_THEME_DARK = {
  ADMINISTRADOR: {
    bg: "#0B2217", text: "#E6F7EE", accent: "#5ED3A5", border: "#13432E",
    glass: "rgba(255,255,255,0.08)", roleBg: "rgba(94,211,165,0.16)",
    roleBorder: "#1E5A40", roleText: "#A6F0D3",
  },
  COORDINADOR: {
    bg: "#0F1722", text: "#E8F4FB", accent: "#57D8E8", border: "#1B2A3A",
    glass: "rgba(255,255,255,0.08)", roleBg: "rgba(57,216,232,0.16)",
    roleBorder: "#2D7E90", roleText: "#BCEFF6",
  },
  SUPERVISOR: {
    bg: "#18132B", text: "#EEE9FF", accent: "#A78BFA", border: "#241C43",
    glass: "rgba(255,255,255,0.08)", roleBg: "rgba(167,139,250,0.16)",
    roleBorder: "#4C1D95", roleText: "#DDD6FE",
  },
  CLIENTE: {
    bg: "#0F241B", text: "#E6F7EE", accent: "#5ED3A5", border: "#174635",
    glass: "rgba(255,255,255,0.08)", roleBg: "rgba(94,211,165,0.16)",
    roleBorder: "#2B6E55", roleText: "#BFF3DD",
  },
} satisfies Record<Rol, Theme>;

const ROLE_ICON: Record<Rol, JSX.Element> = {
  ADMINISTRADOR: <ShieldHalf className="h-4 w-4" />,
  COORDINADOR: <Train className="h-4 w-4" />,
  SUPERVISOR: <Users className="h-4 w-4" />,
  CLIENTE: <Building2 className="h-4 w-4" />,
};

/* ===== Normalizador ===== */
function normalizeRole(r?: string): Rol {
  const s = (r || "").toUpperCase().trim();
  if (s === "ADMINISTRADOR" || s === "ADMIN") return "ADMINISTRADOR";
  if (s === "COORDINADOR" || s === "COORDINADORES" || s === "COORD") return "COORDINADOR";
  if (s === "SUPERVISOR" || s === "SUPERVISORES" || s === "SUP") return "SUPERVISOR";
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
function usePrefersDark() { return useMediaQuery("(prefers-color-scheme: dark)"); }
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
    const paths = ["/", "/cliente", "/administrador", "/coordinador", "/supervisor", "/operador", "/maquinista"];
    names.forEach((name) => {
      document.cookie = `${name}=; Max-Age=0; path=/;`;
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/;`;
      domains.forEach((d) => paths.forEach((p) => (document.cookie = `${name}=; Max-Age=0; path=${p}; domain=${d}`)));
    });
  } catch {}
}

/* Lee localStorage.theme = "light" | "dark" | "system" y reacciona a cambios */
function useThemePref(key: string = "theme") {
  type Pref = "light" | "dark" | "system";
  const read = (): Pref | null => {
    try {
      const v = localStorage.getItem(key);
      return v === "light" || v === "dark" || v === "system" ? v : null;
    } catch { return null; }
  };
  const [pref, setPref] = React.useState<Pref | null>(read);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => { if (e.key === key) setPref(read()); };
    window.addEventListener("storage", onStorage);
    const i = window.setInterval(() => setPref((p) => {
      const r = read(); return r !== p ? r : p;
    }), 300);
    return () => { window.removeEventListener("storage", onStorage); clearInterval(i); };
  }, [key]);

  return pref;
}

/* Sigue la clase <html class="dark"> si existe */
function useDarkFromClass(cls = "dark") {
  const [isDark, set] = useState<boolean>(() =>
    typeof document !== "undefined" && document.documentElement.classList.contains(cls)
  );
  useEffect(() => {
    const el = document.documentElement;
    const update = () => set(el.classList.contains(cls));
    update();
    const obs = new MutationObserver(update);
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, [cls]);
  return isDark;
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
  const classDark = useDarkFromClass("dark");
  const themePref = useThemePref("theme");

  // Prioridad: prop explícita > localStorage.theme > .dark global > SO
  const isDark =
    appearance === "dark" ? true :
    appearance === "light" ? false :
    themePref === "dark" ? true :
    themePref === "light" ? false :
    themePref === "system" ? prefersDark :
    classDark ?? prefersDark;

  const [open, setOpen] = useLocalStorageBool("sidebar:open", defaultOpen);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useBodyScrollLock(mobileOpen && !isDesktop);

  // Detecta rol: prop -> cookie -> localStorage.user.rol
  const cookieRole = useMemo(() => getCookie("role"), []);
  const localRole = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("user") || "{}")?.rol as string | undefined; } catch { return undefined; }
  }, []);
  const normRol = useMemo<Rol>(() => normalizeRole((rol as string) || cookieRole || localRole), [rol, cookieRole, localRole]);

  const theme: Theme = useMemo(
    () => (isDark ? ROLE_THEME_DARK[normRol] : ROLE_THEME_LIGHT[normRol]),
    [normRol, isDark]
  );

  const openW = useMemo(() => Math.round(Math.min(Math.max(expandedWidth, 240), 420)), [expandedWidth]);
  const colW = useMemo(() => Math.round(Math.min(Math.max(collapsedWidth, 64), 104)), [collapsedWidth]);

  const asideId = "sidebar-mobile";

  // Base por rol
  const BASE_BY_ROLE: Record<Rol, string> = {
    CLIENTE: "/cliente",
    COORDINADOR: "/coordinador",
    SUPERVISOR: "/supervisor",
    ADMINISTRADOR: "/administrador",
  };
  const BASE = BASE_BY_ROLE[normRol];

  const NAV = useMemo(
    () =>
      [
        { id: "Panel", label: "Panel", href: BASE, icon: <LayoutDashboard className="h-5 w-5" />, show: true, exact: true },
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
    [normRol, pathname, BASE]
  );

  const vars: SidebarCSSVars = {
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
  };

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
        <div className="flex h-full w-[min(92vw,360px)] md:w-auto flex-col" style={{ background: "var(--sb-bg)" }}>
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
