import "server-only";
import { PERMISSIONS, hasAnyPermission, type AuthorizationProfile, type Permission } from "@/lib/accessControl";

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function requiredPermissions(pathname: string, method: string): Permission[] | null {
  const path = `/${pathname.replace(/^\/+/, "")}`.toLowerCase();
  const read = READ_METHODS.has(method.toUpperCase());

  if (path === "/usuarios/me") return [PERMISSIONS.SESSION_READ];
  if (path === "/usuarios" || path.startsWith("/usuarios/")) {
    return [read ? PERMISSIONS.USERS_READ : PERMISSIONS.USERS_MANAGE];
  }
  if (path === "/empresas" || path.startsWith("/empresas/")) {
    return [read ? PERMISSIONS.CATALOGS_READ : PERMISSIONS.COMPANIES_MANAGE];
  }
  if (path.startsWith("/catalogos-operativos")) return [PERMISSIONS.CATALOG_CONFIGURATION_MANAGE];
  if (path.startsWith("/localidades") || path.startsWith("/vias") || path.startsWith("/secciones")) {
    return [read ? PERMISSIONS.CATALOGS_READ : PERMISSIONS.OPERATIONAL_CATALOGS_MANAGE];
  }
  if (path.startsWith("/actualizaciones")) {
    return [read ? PERMISSIONS.UPDATES_READ : PERMISSIONS.UPDATES_MANAGE];
  }
  if (path.includes("/rondas") || path.startsWith("/rondas")) {
    if (read) return [PERMISSIONS.ROUNDS_READ];
    if (method === "POST") return [PERMISSIONS.ROUNDS_CREATE, PERMISSIONS.ROUNDS_OPERATE];
    if (method === "DELETE") return [PERMISSIONS.ROUNDS_DELETE];
    return [PERMISSIONS.ROUNDS_EDIT, PERMISSIONS.ROUNDS_OPERATE];
  }
  if (path.startsWith("/movimientos")) {
    if (read) return [PERMISSIONS.MOVEMENTS_READ, PERMISSIONS.TORNO_READ];
    if (method === "POST" && path === "/movimientos") return [PERMISSIONS.MOVEMENTS_CREATE];
    if (method === "DELETE") return [PERMISSIONS.MOVEMENTS_DELETE];
    return [PERMISSIONS.MOVEMENTS_EDIT, PERMISSIONS.MOVEMENTS_CANCEL, PERMISSIONS.MOVEMENTS_OPERATE, PERMISSIONS.TORNO_OPERATE];
  }
  if (path.startsWith("/incidentes")) {
    if (read) return [PERMISSIONS.INCIDENTS_READ];
    if (method === "POST") return [PERMISSIONS.INCIDENTS_CREATE, PERMISSIONS.INCIDENTS_MANAGE];
    if (method === "DELETE") return [PERMISSIONS.INCIDENTS_DELETE];
    return [PERMISSIONS.INCIDENTS_UPDATE, PERMISSIONS.INCIDENTS_RESOLVE, PERMISSIONS.INCIDENTS_MANAGE];
  }
  if (path.startsWith("/torno")) return [read ? PERMISSIONS.TORNO_READ : PERMISSIONS.TORNO_OPERATE];
  if (path.startsWith("/torreon")) {
    return read
      ? [PERMISSIONS.TORREON_READ]
      : [PERMISSIONS.TORREON_CREATE, PERMISSIONS.TORREON_OPERATE];
  }
  if (path.startsWith("/reporteria") || path.startsWith("/reporterias")) {
    if (!read) return [PERMISSIONS.REPORTS_EXPORT];
    return [
      PERMISSIONS.REPORTS_ADMIN_READ,
      PERMISSIONS.REPORTS_COORDINATOR_READ,
      PERMISSIONS.REPORTS_CLIENT_READ,
      PERMISSIONS.REPORTS_COMMERCIAL_READ,
    ];
  }
  return null;
}

export function canForwardApiRequest(authorization: AuthorizationProfile, pathname: string, method: string) {
  const required = requiredPermissions(pathname, method);
  return !required || hasAnyPermission(authorization, required);
}
