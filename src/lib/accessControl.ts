export const APP_ROLES = [
  "ADMINISTRADOR",
  "COMERCIAL",
  "COORDINADOR",
  "SUPERVISOR",
  "CLIENTE",
  "CLIENTE_ADMIN",
  "CLIENTE_COOR",
  "ARRASTRE_TORREON",
  "MAQUINISTA",
  "MAQUINISTA_ARRASTRE",
  "TORNO",
  "LAVADO",
] as const;

export type AppRole = (typeof APP_ROLES)[number];
export type RoleArea = "administrador" | "comercial" | "coordinador" | "supervisor" | "cliente" | "unsupported";
export type NavModuleId =
  | "dashboard"
  | "movimientos"
  | "torreon_arrastres"
  | "torno"
  | "configuracion"
  | "usuarios"
  | "incidentes"
  | "reporteria"
  | "commercial_general"
  | "commercial_clients"
  | "commercial_contracts"
  | "commercial_packages"
  | "commercial_collections"
  | "commercial_reports";

export type RoleCapabilities = {
  area: RoleArea;
  home: string;
  label: string;
  isClientLike: boolean;
  isOperationalOnly: boolean;
  canUseWeb: boolean;
  canCreateMovements: boolean;
  canViewMovementDuration: boolean;
  canViewAllCompanies: boolean;
  canViewCompanyWide: boolean;
  canSwitchLocalidad: boolean;
  canViewNaturalMovements: boolean;
  canViewTorreonArrastres: boolean;
  canCreateTorreonArrastres: boolean;
  canManageUsers: boolean;
  canViewReports: boolean;
  canViewTorno: boolean;
  navModules: NavModuleId[];
};

const ROLE_LABELS: Record<AppRole, string> = {
  ADMINISTRADOR: "Administrador",
  COMERCIAL: "Comercial",
  COORDINADOR: "Coordinador",
  SUPERVISOR: "Supervisor",
  CLIENTE: "Cliente",
  CLIENTE_ADMIN: "Cliente admin",
  CLIENTE_COOR: "Cliente coordinador",
  ARRASTRE_TORREON: "Arrastre Torreón",
  MAQUINISTA: "Maquinista",
  MAQUINISTA_ARRASTRE: "Maquinista arrastre",
  TORNO: "Tornero",
  LAVADO: "Lavadero",
};

const ADMIN_CAPABILITIES: RoleCapabilities = {
  area: "administrador",
  home: "/administrador",
  label: ROLE_LABELS.ADMINISTRADOR,
  isClientLike: false,
  isOperationalOnly: false,
  canUseWeb: true,
  canCreateMovements: true,
  canViewMovementDuration: true,
  canViewAllCompanies: true,
  canViewCompanyWide: true,
  canSwitchLocalidad: true,
  canViewNaturalMovements: true,
  canViewTorreonArrastres: true,
  canCreateTorreonArrastres: true,
  canManageUsers: true,
  canViewReports: true,
  canViewTorno: false,
  navModules: ["dashboard", "movimientos", "configuracion", "usuarios", "incidentes", "reporteria"],
};

const COMERCIAL_CAPABILITIES: RoleCapabilities = {
  area: "comercial",
  home: "/comercial/reporte-general",
  label: ROLE_LABELS.COMERCIAL,
  isClientLike: false,
  isOperationalOnly: false,
  canUseWeb: true,
  canCreateMovements: false,
  canViewMovementDuration: true,
  canViewAllCompanies: true,
  canViewCompanyWide: true,
  canSwitchLocalidad: true,
  canViewNaturalMovements: false,
  canViewTorreonArrastres: false,
  canCreateTorreonArrastres: false,
  canManageUsers: false,
  canViewReports: true,
  canViewTorno: false,
  navModules: ["commercial_general", "commercial_clients", "commercial_contracts", "commercial_packages", "commercial_collections", "commercial_reports"],
};

const COORDINADOR_CAPABILITIES: RoleCapabilities = {
  ...ADMIN_CAPABILITIES,
  area: "coordinador",
  home: "/coordinador",
  label: ROLE_LABELS.COORDINADOR,
  canViewAllCompanies: true,
  canSwitchLocalidad: false,
  canViewTorno: true,
  navModules: ["dashboard", "movimientos", "torno", "usuarios", "incidentes", "reporteria"],
};

const SUPERVISOR_CAPABILITIES: RoleCapabilities = {
  area: "supervisor",
  home: "/supervisor",
  label: ROLE_LABELS.SUPERVISOR,
  isClientLike: false,
  isOperationalOnly: false,
  canUseWeb: true,
  canCreateMovements: false,
  canViewMovementDuration: true,
  canViewAllCompanies: false,
  canViewCompanyWide: false,
  canSwitchLocalidad: false,
  canViewNaturalMovements: true,
  canViewTorreonArrastres: false,
  canCreateTorreonArrastres: false,
  canManageUsers: false,
  canViewReports: false,
  canViewTorno: true,
  navModules: ["dashboard", "movimientos", "torno", "incidentes"],
};

const CLIENT_CAPABILITIES: RoleCapabilities = {
  area: "cliente",
  home: "/cliente",
  label: ROLE_LABELS.CLIENTE,
  isClientLike: true,
  isOperationalOnly: false,
  canUseWeb: true,
  canCreateMovements: true,
  canViewMovementDuration: false,
  canViewAllCompanies: false,
  canViewCompanyWide: false,
  canSwitchLocalidad: false,
  canViewNaturalMovements: true,
  canViewTorreonArrastres: false,
  canCreateTorreonArrastres: false,
  canManageUsers: false,
  canViewReports: true,
  canViewTorno: true,
  navModules: ["dashboard", "movimientos", "torno", "reporteria"],
};

const CLIENT_ADMIN_CAPABILITIES: RoleCapabilities = {
  ...CLIENT_CAPABILITIES,
  label: ROLE_LABELS.CLIENTE_ADMIN,
  canViewCompanyWide: true,
  canSwitchLocalidad: false,
  canViewTorreonArrastres: true,
  canCreateTorreonArrastres: true,
  navModules: ["dashboard", "movimientos", "torreon_arrastres", "torno", "incidentes", "reporteria"],
};

const CLIENT_COOR_CAPABILITIES: RoleCapabilities = {
  ...CLIENT_ADMIN_CAPABILITIES,
  label: ROLE_LABELS.CLIENTE_COOR,
};

const ARRASTRE_TORREON_CAPABILITIES: RoleCapabilities = {
  area: "cliente",
  home: "/cliente/torreon",
  label: ROLE_LABELS.ARRASTRE_TORREON,
  isClientLike: true,
  isOperationalOnly: true,
  canUseWeb: true,
  canCreateMovements: false,
  canViewMovementDuration: false,
  canViewAllCompanies: false,
  canViewCompanyWide: false,
  canSwitchLocalidad: false,
  canViewNaturalMovements: false,
  canViewTorreonArrastres: true,
  canCreateTorreonArrastres: true,
  canManageUsers: false,
  canViewReports: false,
  canViewTorno: false,
  navModules: ["dashboard", "torreon_arrastres", "incidentes"],
};

const UNSUPPORTED_CAPABILITIES: RoleCapabilities = {
  area: "unsupported",
  home: "/login",
  label: "Sin acceso web",
  isClientLike: false,
  isOperationalOnly: true,
  canUseWeb: false,
  canCreateMovements: false,
  canViewMovementDuration: false,
  canViewAllCompanies: false,
  canViewCompanyWide: false,
  canSwitchLocalidad: false,
  canViewNaturalMovements: false,
  canViewTorreonArrastres: false,
  canCreateTorreonArrastres: false,
  canManageUsers: false,
  canViewReports: false,
  canViewTorno: false,
  navModules: [],
};

const CAPABILITIES_BY_ROLE: Record<AppRole, RoleCapabilities> = {
  ADMINISTRADOR: ADMIN_CAPABILITIES,
  COMERCIAL: COMERCIAL_CAPABILITIES,
  COORDINADOR: COORDINADOR_CAPABILITIES,
  SUPERVISOR: SUPERVISOR_CAPABILITIES,
  CLIENTE: CLIENT_CAPABILITIES,
  CLIENTE_ADMIN: CLIENT_ADMIN_CAPABILITIES,
  CLIENTE_COOR: CLIENT_COOR_CAPABILITIES,
  ARRASTRE_TORREON: ARRASTRE_TORREON_CAPABILITIES,
  MAQUINISTA: { ...UNSUPPORTED_CAPABILITIES, label: ROLE_LABELS.MAQUINISTA },
  MAQUINISTA_ARRASTRE: { ...UNSUPPORTED_CAPABILITIES, label: ROLE_LABELS.MAQUINISTA_ARRASTRE },
  TORNO: { ...UNSUPPORTED_CAPABILITIES, label: ROLE_LABELS.TORNO },
  LAVADO: { ...UNSUPPORTED_CAPABILITIES, label: ROLE_LABELS.LAVADO },
};

export function normalizeAppRole(input?: string | null): AppRole | null {
  const value = String(input || "").trim().toUpperCase();
  return (APP_ROLES as readonly string[]).includes(value) ? (value as AppRole) : null;
}

export function getRoleCapabilities(input?: string | null): RoleCapabilities {
  const role = normalizeAppRole(input);
  return role ? CAPABILITIES_BY_ROLE[role] : UNSUPPORTED_CAPABILITIES;
}

export function getAreaBase(role?: string | null): string {
  return getRoleCapabilities(role).home.split("/").slice(0, 2).join("/") || "/cliente";
}

export function isClientLikeRole(role?: string | null): boolean {
  return getRoleCapabilities(role).isClientLike;
}

export function canViewMovementDuration(role?: string | null): boolean {
  return getRoleCapabilities(role).canViewMovementDuration;
}

export function canUseWeb(role?: string | null): boolean {
  return getRoleCapabilities(role).canUseWeb;
}
