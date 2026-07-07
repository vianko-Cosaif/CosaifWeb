import {
  getAreaBase,
  getRoleCapabilities,
  normalizeAppRole,
  type NavModuleId,
} from "./accessControl";

export type AppNavigationItem = {
  id: NavModuleId;
  label: string;
  description: string;
  href: string;
};

const MODULE_COPY: Record<NavModuleId, Omit<AppNavigationItem, "id" | "href">> = {
  dashboard: {
    label: "Dashboard",
    description: "Resumen operativo",
  },
  movimientos: {
    label: "Movimientos",
    description: "Movimientos naturales del patio",
  },
  torreon_arrastres: {
    label: "Arrastres",
    description: "Solicitudes de vagones Torreon",
  },
  torno: {
    label: "Torno",
    description: "Servicios, historial y navajas",
  },
  configuracion: {
    label: "Configuracion",
    description: "Localidades, vias y Torno",
  },
  usuarios: {
    label: "Gestion Usuarios",
    description: "Altas, roles y desactivacion",
  },
  incidentes: {
    label: "Incidentes",
    description: "Bloqueos, evidencias y resolucion",
  },
  reporteria: {
    label: "Reporteria",
    description: "Indicadores y cronologia",
  },
};

function hrefForModule(role: string | null | undefined, moduleId: NavModuleId) {
  const capabilities = getRoleCapabilities(role);
  const base = getAreaBase(role);
  const normalizedRole = normalizeAppRole(role);

  if (moduleId === "dashboard") return capabilities.home;
  if (moduleId === "torreon_arrastres") return "/cliente/torreon/movimientos";
  if (moduleId === "incidentes" && normalizedRole === "ARRASTRE_TORREON") {
    return "/cliente/torreon/incidentes";
  }
  if (moduleId === "movimientos") return `${base}/movimientos`;
  if (moduleId === "torno") return `${base}/torno`;
  if (moduleId === "configuracion") return `${base}/configuracion`;
  if (moduleId === "usuarios") return `${base}/usuarios`;
  if (moduleId === "incidentes") return `${base}/incidentes`;
  if (moduleId === "reporteria") return `${base}/reporteria`;

  return capabilities.home;
}

export function buildNavigationForRole(role?: string | null): AppNavigationItem[] {
  const capabilities = getRoleCapabilities(role);

  return capabilities.navModules.map((moduleId) => ({
    id: moduleId,
    href: hrefForModule(role, moduleId),
    ...MODULE_COPY[moduleId],
  }));
}

export function isNavigationItemActive(pathname: string, item: AppNavigationItem) {
  if (item.id === "dashboard") return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
