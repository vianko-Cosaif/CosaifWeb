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

export const AUTHORIZATION_POLICY_VERSION = 2;

export const PERMISSIONS = {
  SESSION_READ: "session.read",
  USERS_READ: "users.read",
  USERS_MANAGE: "users.manage",
  CATALOGS_READ: "catalogs.read",
  COMPANIES_MANAGE: "companies.manage",
  OPERATIONAL_CATALOGS_MANAGE: "catalogs.operational.manage",
  CATALOG_CONFIGURATION_MANAGE: "catalogs.configuration.manage",
  UPDATES_READ: "updates.read",
  UPDATES_MANAGE: "updates.manage",
  MOVEMENTS_READ: "movements.read",
  MOVEMENTS_CREATE: "movements.create",
  MOVEMENTS_EDIT: "movements.edit",
  MOVEMENTS_CANCEL: "movements.cancel",
  MOVEMENTS_DELETE: "movements.delete",
  MOVEMENTS_OPERATE: "movements.operate",
  ROUNDS_READ: "rounds.read",
  ROUNDS_CREATE: "rounds.create",
  ROUNDS_EDIT: "rounds.edit",
  ROUNDS_DELETE: "rounds.delete",
  ROUNDS_OPERATE: "rounds.operate",
  INCIDENTS_READ: "incidents.read",
  INCIDENTS_MANAGE: "incidents.manage",
  INCIDENTS_CREATE: "incidents.create",
  INCIDENTS_UPDATE: "incidents.update",
  INCIDENTS_RESOLVE: "incidents.resolve",
  INCIDENTS_DELETE: "incidents.delete",
  INCIDENTS_MAINTENANCE: "incidents.maintenance",
  TORNO_READ: "torno.read",
  TORNO_OPERATE: "torno.operate",
  TORREON_READ: "torreon.read",
  TORREON_CREATE: "torreon.create",
  TORREON_OPERATE: "torreon.operate",
  REPORTS_ADMIN_READ: "reports.admin.read",
  REPORTS_COORDINATOR_READ: "reports.coordinator.read",
  REPORTS_CLIENT_READ: "reports.client.read",
  REPORTS_COMMERCIAL_READ: "reports.commercial.read",
  REPORTS_EXPORT: "reports.export",
  OFFLINE_MAQUINISTA_READ: "offline.maquinista.read",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
export type AuthorizationScopeMode = "GLOBAL" | "COMMERCIAL" | "COMPANY" | "LOCALITY" | "COMPANY_LOCALITY" | "DENY";

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

export type AuthorizationProfile = {
  policyVersion: number;
  role: AppRole;
  roleLabel: string;
  platforms: { web: boolean; mobile: boolean };
  scope: {
    mode: AuthorizationScopeMode;
    empresaId: number | null;
    localidadId: number | null;
  };
  permissions: Permission[];
  capabilities: RoleCapabilities;
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
  canCreateMovements: true,
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
  canViewReports: false,
  canViewTorno: true,
  navModules: ["dashboard", "movimientos", "torno", "incidentes"],
};

const CLIENT_ADMIN_CAPABILITIES: RoleCapabilities = {
  ...CLIENT_CAPABILITIES,
  label: ROLE_LABELS.CLIENTE_ADMIN,
  canViewCompanyWide: true,
  canSwitchLocalidad: false,
  canViewTorreonArrastres: true,
  canCreateTorreonArrastres: true,
  navModules: ["dashboard", "movimientos", "torreon_arrastres", "torno", "incidentes"],
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

const PERMISSION_VALUES = new Set<string>(Object.values(PERMISSIONS));
const NAV_MODULE_VALUES = new Set<string>([
  "dashboard", "movimientos", "torreon_arrastres", "torno", "configuracion", "usuarios", "incidentes", "reporteria",
  "commercial_general", "commercial_clients", "commercial_contracts", "commercial_packages", "commercial_collections", "commercial_reports",
]);
const SCOPE_VALUES = new Set<AuthorizationScopeMode>(["GLOBAL", "COMMERCIAL", "COMPANY", "LOCALITY", "COMPANY_LOCALITY", "DENY"]);
const AREA_VALUES = new Set<RoleArea>(["administrador", "comercial", "coordinador", "supervisor", "cliente", "unsupported"]);

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
const nullablePositiveInteger = (value: unknown) => {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};
const safeInternalHome = (value: unknown) => {
  const path = typeof value === "string" ? value.trim() : "";
  return path.startsWith("/") && !path.startsWith("//") && !path.includes("\\") ? path : null;
};

/** Valida el contrato que entrega BackCosaif2; nunca amplía permisos desconocidos. */
export function parseAuthorizationProfile(value: unknown): AuthorizationProfile | null {
  if (!isRecord(value)) return null;
  const role = normalizeAppRole(typeof value.role === "string" ? value.role : null);
  const platforms = isRecord(value.platforms) ? value.platforms : null;
  const scope = isRecord(value.scope) ? value.scope : null;
  const capabilities = isRecord(value.capabilities) ? value.capabilities : null;
  const policyVersion = Number(value.policyVersion);
  if (!role || policyVersion !== AUTHORIZATION_POLICY_VERSION || !platforms || !scope || !capabilities) return null;

  const area = typeof capabilities.area === "string" ? capabilities.area as RoleArea : "unsupported";
  const home = safeInternalHome(capabilities.home);
  const scopeMode = typeof scope.mode === "string" ? scope.mode as AuthorizationScopeMode : "DENY";
  if (!AREA_VALUES.has(area) || !home || !SCOPE_VALUES.has(scopeMode)) return null;

  const permissions = Array.isArray(value.permissions)
    ? [...new Set(value.permissions.filter((item): item is Permission => typeof item === "string" && PERMISSION_VALUES.has(item)))]
    : [];
  const navModules = Array.isArray(capabilities.navModules)
    ? [...new Set(capabilities.navModules.filter((item): item is NavModuleId => typeof item === "string" && NAV_MODULE_VALUES.has(item)))]
    : [];
  const booleanCapability = (name: keyof RoleCapabilities) => capabilities[name] === true;

  return {
    policyVersion,
    role,
    roleLabel: typeof value.roleLabel === "string" ? value.roleLabel.slice(0, 80) : ROLE_LABELS[role],
    platforms: { web: platforms.web === true, mobile: platforms.mobile === true },
    scope: {
      mode: scopeMode,
      empresaId: nullablePositiveInteger(scope.empresaId),
      localidadId: nullablePositiveInteger(scope.localidadId),
    },
    permissions,
    capabilities: {
      area,
      home,
      label: typeof capabilities.label === "string" ? capabilities.label.slice(0, 80) : ROLE_LABELS[role],
      isClientLike: booleanCapability("isClientLike"),
      isOperationalOnly: booleanCapability("isOperationalOnly"),
      canUseWeb: booleanCapability("canUseWeb"),
      canCreateMovements: booleanCapability("canCreateMovements"),
      canViewMovementDuration: booleanCapability("canViewMovementDuration"),
      canViewAllCompanies: booleanCapability("canViewAllCompanies"),
      canViewCompanyWide: booleanCapability("canViewCompanyWide"),
      canSwitchLocalidad: booleanCapability("canSwitchLocalidad"),
      canViewNaturalMovements: booleanCapability("canViewNaturalMovements"),
      canViewTorreonArrastres: booleanCapability("canViewTorreonArrastres"),
      canCreateTorreonArrastres: booleanCapability("canCreateTorreonArrastres"),
      canManageUsers: booleanCapability("canManageUsers"),
      canViewReports: booleanCapability("canViewReports"),
      canViewTorno: booleanCapability("canViewTorno"),
      navModules,
    },
  };
}

export function hasPermission(profile: AuthorizationProfile | null | undefined, permission: Permission) {
  return Boolean(profile?.permissions.includes(permission));
}

export function hasAnyPermission(profile: AuthorizationProfile | null | undefined, permissions: readonly Permission[]) {
  return permissions.some((permission) => hasPermission(profile, permission));
}
