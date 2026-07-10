// src/lib/routePolicy.ts
import {
  APP_ROLES,
  canUseWeb,
  getRoleCapabilities,
  normalizeAppRole,
  type AppRole,
} from "./accessControl";

/** =========================
 *  Roles soportados
 *  ========================= */
export const ALL_ROLES = APP_ROLES;
export type Role = AppRole;

export const DEFAULT_HOME = "/cliente";

/** Áreas por rol (regex de guard) */
export const AREAS_REGEX: Record<Role, RegExp> = {
  CLIENTE: /^\/cliente(\/|$)/i,
  CLIENTE_ADMIN: /^\/cliente(\/|$)/i,
  CLIENTE_COOR: /^\/cliente(\/|$)/i,
  ARRASTRE_TORREON: /^\/cliente\/torreon(\/|$)/i,
  ADMINISTRADOR: /^\/administrador(\/|$)/i,
  SUPERVISOR: /^\/supervisor(\/|$)/i,
  COORDINADOR: /^\/coordinador(\/|$)/i,
  MAQUINISTA: /^\/__unsupported_web_role(\/|$)/i,
  MAQUINISTA_ARRASTRE: /^\/__unsupported_web_role(\/|$)/i,
  TORNO: /^\/__unsupported_web_role(\/|$)/i,
  LAVADO: /^\/__unsupported_web_role(\/|$)/i,
};

/** Home por rol */
export const HOME_BY_ROLE: Record<Role, string> = {
  CLIENTE: "/cliente",
  CLIENTE_ADMIN: "/cliente",
  CLIENTE_COOR: "/cliente",
  ARRASTRE_TORREON: "/cliente/torreon",
  ADMINISTRADOR: "/administrador",
  SUPERVISOR: "/supervisor",
  COORDINADOR: "/coordinador",
  MAQUINISTA: "/login",
  MAQUINISTA_ARRASTRE: "/login",
  TORNO: "/login",
  LAVADO: "/login",
};

/** Prefijos SIEMPRE abiertos (assets/proxy/health/login) */
export const OPEN_PREFIXES = [
  "/login",
  "/_next",
  "/favicon",
  "/robots.txt",
  "/sitemap.xml",
  "/api/auth",
  "/bff",
  "/xapi",
] as const;

/** =========================
 *  Utils de path
 *  ========================= */
export const policyVersion = 2;

export function normalizeRole(input?: string | null): Role | null {
  return normalizeAppRole(input);
}

export function isAssetPath(pathname: string): boolean {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.endsWith(".map") ||
    /\.[^/]+$/.test(pathname)
  );
}

export function isOpenPath(pathname: string): boolean {
  if (isAssetPath(pathname)) return true;
  return OPEN_PREFIXES.some((p) => pathname.startsWith(p));
}

/** ¿El path pertenece a alguna “área” protegida? */
export function isInAnyArea(pathname: string): boolean {
  return Object.values(AREAS_REGEX).some((rx) => rx.test(pathname));
}

/** ¿El path cuadra con el área del rol? */
export function isAllowedInArea(pathname: string, role: Role): boolean {
  const rx = AREAS_REGEX[role];
  return rx ? rx.test(pathname) : false;
}

/** Home destino según rol (fallback a DEFAULT_HOME) */
export function homeFor(role?: string | null): string {
  const capabilities = getRoleCapabilities(role);
  return capabilities.canUseWeb ? capabilities.home : "/login";
}

/** =========================
 *  Evaluador central de rutas
 *  ========================= */
export type RouteEvaluation = {
  allow: boolean;
  redirectTo?: string;
  reason?:
    | "OPEN"
    | "NEEDS_AUTH"
    | "CROSS_AREA"
    | "OK"
    | "LOGIN_HAS_SESSION"
    | "ROOT_WITH_SESSION";
};

/** Lógica pura para decidir allow/redirect en front o middleware */
export function evaluateRoute(input: {
  pathname: string;
  search?: string;
  isAuthenticated?: boolean;
  role?: string | null;
  rootIsPublic?: boolean;
}): RouteEvaluation {
  const {
    pathname,
    search = "",
    isAuthenticated = false,
    role: roleRaw,
    rootIsPublic = false,
  } = input;

  const role = normalizeRole(roleRaw);
  const authed = !!isAuthenticated && !!role;
  const webAllowed = role ? canUseWeb(role) : false;

  if (isOpenPath(pathname)) {
    if (pathname === "/login" && authed) {
      return {
        allow: false,
        redirectTo: homeFor(role),
        reason: "LOGIN_HAS_SESSION",
      };
    }
    return { allow: true, reason: "OPEN" };
  }

  if (pathname === "/") {
    if (authed)
      return {
        allow: false,
        redirectTo: homeFor(role),
        reason: "ROOT_WITH_SESSION",
      };
    return rootIsPublic
      ? { allow: true, reason: "OPEN" }
      : { allow: false, redirectTo: "/login", reason: "NEEDS_AUTH" };
  }

  if (!authed) {
    const next = pathname + (search || "");
    return {
      allow: false,
      redirectTo: `/login?next=${encodeURIComponent(next)}`,
      reason: "NEEDS_AUTH",
    };
  }

  if (!webAllowed) {
    return { allow: false, redirectTo: "/login", reason: "CROSS_AREA" };
  }

  const inAny = isInAnyArea(pathname);
  const hereOk = role ? isAllowedInArea(pathname, role) : false;
  if (inAny && !hereOk) {
    return { allow: false, redirectTo: homeFor(role), reason: "CROSS_AREA" };
  }

  return { allow: true, reason: "OK" };
}

/** =========================
 *  Política de filtros en UI
 *  ========================= */
export type FilterPolicy = {
  forcedEmpresaId?: number;
  forcedLocalidadId?: number;
  canEditEmpresa: boolean;
  canEditLocalidad: boolean;
  canEditDates: boolean;
  canSearch: boolean;
};

export type UserMeta = {
  empresaId?: number | null;
  localidadId?: number | null;
  rol?: string | null;
};

/** Solo administradores pueden operar sin una localidad forzada. */
export function getFilterPolicy(user: UserMeta): FilterPolicy {
  const capabilities = getRoleCapabilities(user.rol);
  return {
    forcedEmpresaId: capabilities.canViewAllCompanies ? undefined : user.empresaId ?? undefined,
    forcedLocalidadId: capabilities.canSwitchLocalidad ? undefined : user.localidadId ?? undefined,
    canEditEmpresa: capabilities.canViewAllCompanies,
    canEditLocalidad: capabilities.canSwitchLocalidad,
    canEditDates: true,
    canSearch: true,
  };
}

export function applyFilterLocks<T extends Record<string, unknown>>(
  input: T,
  policy: FilterPolicy,
): T {
  const out: Record<string, unknown> = { ...input };
  if (policy.forcedEmpresaId != null) out.empresaId = policy.forcedEmpresaId;
  if (policy.forcedLocalidadId != null)
    out.localidadId = policy.forcedLocalidadId;
  return out as T;
}

export function wantsAuth(pathname: string): boolean {
  if (isOpenPath(pathname)) return false;
  if (pathname === "/") return true;
  return true;
}

export function redirectSuggestion(
  pathname: string,
  role?: string | null,
): string | null {
  const r = normalizeRole(role);
  if (!r) return "/login";
  return isAllowedInArea(pathname, r) ? null : homeFor(r);
}
