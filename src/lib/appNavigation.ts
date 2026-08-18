import {
  getAreaBase,
  getRoleCapabilities,
  type AuthorizationProfile,
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
    label: "Operación",
    description: "Qué ocurre ahora",
  },
  movimientos: {
    label: "Seguimiento",
    description: "Operaciones actuales e historial",
  },
  torreon_arrastres: {
    label: "Mis arrastres",
    description: "Solicitudes y seguimiento de vagones",
  },
  torno: {
    label: "Torno",
    description: "Servicios, historial y navajas",
  },
  configuracion: {
    label: "Configuración",
    description: "Empresas y patios natural/arrastre",
  },
  usuarios: {
    label: "Usuarios",
    description: "Altas, roles y desactivación",
  },
  incidentes: {
    label: "Incidentes",
    description: "Bloqueos, evidencias y resolución",
  },
  reporteria: {
    label: "Reportería",
    description: "Indicadores y cronología",
  },
  commercial_general: {
    label: "Reporte general",
    description: "Volumen por periodo y localidad",
  },
  commercial_clients: {
    label: "Clientes",
    description: "Expedientes y contactos comerciales",
  },
  commercial_contracts: {
    label: "Contratos",
    description: "Vigencias y reglas por movimiento",
  },
  commercial_packages: {
    label: "Movimientos contratados",
    description: "Cantidades incluidas y consumo por periodo",
  },
  commercial_collections: {
    label: "Cortes y saldos",
    description: "Cierres de periodo y saldo opcional",
  },
  commercial_reports: {
    label: "Reportería Excel",
    description: "Construcción de reportes a la medida",
  },
};

function hrefForModule(role: string | null | undefined, moduleId: NavModuleId) {
  const capabilities = getRoleCapabilities(role);
  const base = getAreaBase(role);

  if (moduleId === "dashboard") return capabilities.home;
  if (moduleId === "torreon_arrastres") return "/cliente/torreon/movimientos";
  if (moduleId === "movimientos") return `${base}/movimientos`;
  if (moduleId === "torno") return `${base}/torno`;
  if (moduleId === "configuracion") return `${base}/configuracion`;
  if (moduleId === "usuarios") return `${base}/usuarios`;
  if (moduleId === "incidentes" && capabilities.area === "cliente" && capabilities.canViewTorreonArrastres) {
    return "/cliente/torreon/incidentes";
  }
  if (moduleId === "incidentes") return `${base}/incidentes`;
  if (moduleId === "reporteria") return `${base}/reporteria`;
  if (moduleId === "commercial_general") return "/comercial/reporte-general";
  if (moduleId === "commercial_clients") return "/comercial/clientes";
  if (moduleId === "commercial_contracts") return "/comercial/contratos";
  if (moduleId === "commercial_packages") return "/comercial/paquetes";
  if (moduleId === "commercial_collections") return "/comercial/cobranza";
  if (moduleId === "commercial_reports") return "/comercial/reporteria";

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

export function buildNavigationForAuthorization(authorization: AuthorizationProfile): AppNavigationItem[] {
  const role = authorization.role;
  return authorization.capabilities.navModules.map((moduleId) => ({
    id: moduleId,
    href: hrefForModule(role, moduleId),
    ...MODULE_COPY[moduleId],
  }));
}

export function isNavigationItemActive(pathname: string, item: AppNavigationItem) {
  if (item.id === "dashboard") return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
