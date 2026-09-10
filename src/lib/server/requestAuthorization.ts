import "server-only";
import { PERMISSIONS, hasAnyPermission, hasPermission, type AuthorizationProfile, type Permission } from "@/lib/accessControl";

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function requiredPermissions(pathname: string, method: string): Permission[] | null {
  const path = `/${pathname.replace(/^\/+/, "")}`.toLowerCase();
  method = method.toUpperCase();
  const read = READ_METHODS.has(method);

  if (path === "/realtime/events" || path === "/realtime/stats") return read ? [PERMISSIONS.SESSION_READ] : [];
  if (path === "/banner" || path.startsWith("/banner/")) return [read ? PERMISSIONS.UPDATES_READ : PERMISSIONS.UPDATES_MANAGE];
  if (path === "/comercial" || path.startsWith("/comercial/")) return [PERMISSIONS.REPORTS_COMMERCIAL_READ];

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
    if (/\/cancelar$/.test(path)) return [PERMISSIONS.MOVEMENTS_CANCEL];
    if (/^\/movimientos\/\d+(?:\/edicion)?$/.test(path)) return [PERMISSIONS.MOVEMENTS_EDIT];
    return [PERMISSIONS.MOVEMENTS_OPERATE, PERMISSIONS.TORNO_OPERATE];
  }
  if (path.startsWith("/incidentes")) {
    if (read) return [PERMISSIONS.INCIDENTS_READ];
    if (method === "POST") return [PERMISSIONS.INCIDENTS_CREATE, PERMISSIONS.INCIDENTS_MANAGE];
    if (method === "DELETE") return [PERMISSIONS.INCIDENTS_DELETE];
    if (/\/(cerrar|resuelto|resolver)$/.test(path)) return [PERMISSIONS.INCIDENTS_RESOLVE, PERMISSIONS.INCIDENTS_MANAGE];
    return [PERMISSIONS.INCIDENTS_UPDATE, PERMISSIONS.INCIDENTS_MANAGE];
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
  if (!required || !authorization.platforms.web) return false;
  if ((pathname === "/comercial" || pathname.startsWith("/comercial/")) && !["ADMINISTRADOR", "COMERCIAL"].includes(authorization.role)) return false;
  if (/\/(pdf|excel)(?:\/|$)/.test(pathname) && /\/(comercial|reporteria|reporterias)(?:\/|$)/.test(pathname) && !hasPermission(authorization, PERMISSIONS.REPORTS_EXPORT)) return false;
  return hasAnyPermission(authorization, required);
}
