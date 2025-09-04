// src/lib/routePolicy.ts

/** =========================
 *  Roles soportados
 *  ========================= */
export const ALL_ROLES = ["CLIENTE", "ADMINISTRADOR", "COORDINADOR"] as const;
export type Role = (typeof ALL_ROLES)[number];

export const DEFAULT_HOME = "/cliente";

/** Áreas por rol (regex de guard) */
export const AREAS_REGEX: Record<Role, RegExp> = {
  CLIENTE: /^\/cliente(\/|$)/i,
  ADMINISTRADOR: /^\/admin(\/|$)/i,
  COORDINADOR: /^\/coordinador(\/|$)/i,
};

/** Home por rol */
export const HOME_BY_ROLE: Record<Role, string> = {
  CLIENTE: "/cliente",
  ADMINISTRADOR: "/admin",
  COORDINADOR: "/coordinador",
};

/** Prefijos SIEMPRE abiertos (assets/proxy/health/login) */
export const OPEN_PREFIXES = [
  "/login",
  "/_next",
  "/favicon",
  "/robots.txt",
  "/sitemap.xml",
  "/api/auth",
  "/xapi",
] as const;

/** =========================
 *  Utils de path
 *  ========================= */
export const policyVersion = 2;

export function normalizeRole(input?: string | null): Role | null {
  const r = (input || "").toUpperCase().trim();
  return (ALL_ROLES as readonly string[]).includes(r) ? (r as Role) : null;
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
  const r = normalizeRole(role);
  return (r && HOME_BY_ROLE[r]) || DEFAULT_HOME;
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

/** CLIENTE bloqueado; ADMINISTRADOR/COORDINADOR libres */
export function getFilterPolicy(user: UserMeta): FilterPolicy {
  const role = normalizeRole(user.rol);
  if (role === "CLIENTE") {
    return {
      forcedEmpresaId: user.empresaId ?? undefined,
      forcedLocalidadId: user.localidadId ?? undefined,
      canEditEmpresa: false,
      canEditLocalidad: false,
      canEditDates: true,
      canSearch: true,
    };
  }
  return {
    canEditEmpresa: true,
    canEditLocalidad: true,
    canEditDates: true,
    canSearch: true,
  };
}

export function applyFilterLocks<T extends Record<string, any>>(
  input: T,
  policy: FilterPolicy,
): T {
  const out: Record<string, any> = { ...input };
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
