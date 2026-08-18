// src/lib/routePolicy.ts
import {
  APP_ROLES,
  PERMISSIONS,
  canUseWeb,
  getRoleCapabilities,
  hasAnyPermission,
  normalizeAppRole,
  type AppRole,
  type AuthorizationProfile,
  type Permission,
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
  COMERCIAL: /^\/comercial(\/|$)/i,
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
  COMERCIAL: "/comercial",
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

/**
 * Espacios de IDs reservados exclusivamente para la capacitación.
 *
 * No deben llegar nunca a una API productiva. Reservamos el namespace completo
 * (no sólo los ejemplos actuales) para que una URL o payload manipulado tampoco
 * pueda convertir un futuro registro SIM en una consulta/mutación real.
 */
export const TRAINING_MOVEMENT_ID = 910_000_204;
export const TRAINING_PAST_MOVEMENT_ID = 910_000_119;
export const TRAINING_CREATED_MOVEMENT_ID = 910_000_305;
export const TRAINING_INCIDENT_ID = 920_000_041;
export const TRAINING_ROUND_ID = 930_000_204;
export const TRAINING_PAST_ROUND_ID = 930_000_119;

const isIdInTrainingNamespace = (value: unknown, namespace: number): boolean => {
  const id = Number(value);
  return Number.isInteger(id) && id >= namespace && id < namespace + 1_000_000;
};

export function isTrainingMovementId(value: unknown): boolean {
  return isIdInTrainingNamespace(value, 910_000_000);
}

export function isTrainingIncidentId(value: unknown): boolean {
  return isIdInTrainingNamespace(value, 920_000_000);
}

export function isTrainingRoundId(value: unknown): boolean {
  return isIdInTrainingNamespace(value, 930_000_000);
}

export function isTrainingReservedId(value: unknown): boolean {
  return isTrainingMovementId(value) || isTrainingIncidentId(value) || isTrainingRoundId(value);
}

/** Detecta IDs SIM aun cuando vengan anidados en un payload de outbox/proxy. */
export function containsTrainingReservedId(value: unknown, depth = 0, seen = new WeakSet<object>()): boolean {
  if (depth > 12 || value == null) return false;
  if (typeof value === "number") return isTrainingReservedId(value);
  if (typeof value === "string") {
    if (isTrainingReservedId(value)) return true;
    return (value.match(/\d{6,}/g) || []).some(isTrainingReservedId);
  }
  if (typeof value !== "object") return false;
  if (seen.has(value)) return false;
  seen.add(value);

  if (Array.isArray(value)) {
    return value.some((item) => containsTrainingReservedId(item, depth + 1, seen));
  }

  return Object.values(value as Record<string, unknown>)
    .some((item) => containsTrainingReservedId(item, depth + 1, seen));
}

/**
 * Excepción mínima para que roles web de otras áreas practiquen la edición SIM.
 * Exige ruta exacta, flag de capacitación e ID reservado; nunca abre un editor
 * productivo de cliente a otro rol.
 */
export function isTrainingMovementEdit(pathname: string, search = ""): boolean {
  if (pathname.toLowerCase() !== "/cliente/editar") return false;
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return params.get("training") === "1"
    && isTrainingMovementId(params.get("id"));
}

/** Home destino según rol (fallback a DEFAULT_HOME) */
export function homeFor(role?: string | null): string {
  const capabilities = getRoleCapabilities(role);
  return capabilities.canUseWeb ? capabilities.home : "/login";
}

export function homeForAuthorization(authorization?: AuthorizationProfile | null): string {
  return authorization?.platforms.web && authorization.capabilities.canUseWeb
    ? authorization.capabilities.home
    : "/login";
}

function permissionsForPage(pathname: string, role: AppRole): Permission[] | null {
  const path = pathname.toLowerCase();
  if (path.includes("/usuarios")) return [PERMISSIONS.USERS_READ];
  if (path.includes("/configuracion")) {
    return [PERMISSIONS.COMPANIES_MANAGE, PERMISSIONS.OPERATIONAL_CATALOGS_MANAGE, PERMISSIONS.CATALOG_CONFIGURATION_MANAGE];
  }
  if (path === "/movimientos/crear") return [PERMISSIONS.MOVEMENTS_CREATE];
  if (path.includes("/torreon/crear")) return [PERMISSIONS.TORREON_CREATE];
  if (path.includes("/torreon/incidentes")) return [PERMISSIONS.INCIDENTS_READ];
  if (path === "/cliente/torreon") return [PERMISSIONS.TORREON_READ, PERMISSIONS.MOVEMENTS_READ];
  if (path.includes("/torreon")) return [PERMISSIONS.TORREON_READ];
  if (path.includes("/movimientos")) return [PERMISSIONS.MOVEMENTS_READ];
  if (path.includes("/incidentes")) return [PERMISSIONS.INCIDENTS_READ];
  if (path.includes("/torno")) return [PERMISSIONS.TORNO_READ];
  if (path.includes("/reporteria") || path.includes("/reporte-general")) {
    if (role === "ADMINISTRADOR") return [PERMISSIONS.REPORTS_ADMIN_READ];
    if (role === "COORDINADOR") return [PERMISSIONS.REPORTS_COORDINATOR_READ];
    if (role === "COMERCIAL") return [PERMISSIONS.REPORTS_COMMERCIAL_READ];
    return [PERMISSIONS.REPORTS_CLIENT_READ];
  }
  return null;
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
    | "MISSING_PERMISSION"
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
  authorization?: AuthorizationProfile | null;
  rootIsPublic?: boolean;
}): RouteEvaluation {
  const {
    pathname,
    search = "",
    isAuthenticated = false,
    role: roleRaw,
    authorization,
    rootIsPublic = false,
  } = input;

  const role = authorization?.role ?? normalizeRole(roleRaw);
  const authed = !!isAuthenticated && !!role;
  const webAllowed = authorization
    ? authorization.platforms.web && authorization.capabilities.canUseWeb
    : role ? canUseWeb(role) : false;

  if (isOpenPath(pathname)) {
    if (pathname === "/login" && authed) {
      return {
        allow: false,
        redirectTo: authorization ? homeForAuthorization(authorization) : homeFor(role),
        reason: "LOGIN_HAS_SESSION",
      };
    }
    return { allow: true, reason: "OPEN" };
  }

  if (pathname === "/") {
    if (authed)
      return {
        allow: false,
        redirectTo: authorization ? homeForAuthorization(authorization) : homeFor(role),
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

  if (isTrainingMovementEdit(pathname, search)) {
    return { allow: true, reason: "OK" };
  }

  const capabilities = authorization?.capabilities ?? getRoleCapabilities(role);
  if (
    pathname.toLowerCase().startsWith("/cliente/reporteria") &&
    !capabilities.canViewReports
  ) {
    return { allow: false, redirectTo: capabilities.home, reason: "CROSS_AREA" };
  }

  const inAny = isInAnyArea(pathname);
  const hereOk = role ? isAllowedInArea(pathname, role) : false;
  if (inAny && !hereOk) {
    return { allow: false, redirectTo: authorization ? homeForAuthorization(authorization) : homeFor(role), reason: "CROSS_AREA" };
  }

  const requiredPermissions = permissionsForPage(pathname, role);
  if (authorization && requiredPermissions && !hasAnyPermission(authorization, requiredPermissions)) {
    return { allow: false, redirectTo: homeForAuthorization(authorization), reason: "MISSING_PERMISSION" };
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
