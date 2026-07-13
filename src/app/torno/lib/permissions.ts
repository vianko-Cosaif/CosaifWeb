import type { TornoPermissions, TornoRole } from "./types";

export const TORNO_ROLES: TornoRole[] = [
  "CLIENTE",
  "CLIENTE_ADMIN",
  "CLIENTE_COOR",
  "ARRASTRE_TORREON",
  "ADMINISTRADOR",
  "SUPERVISOR",
  "COORDINADOR",
];

export function normalizeTornoRole(input?: string | null): TornoRole {
  const role = String(input || "").trim().toUpperCase();
  if (role === "CLIENTE_ADMIN") return "CLIENTE_ADMIN";
  if (role === "CLIENTE_COOR") return "CLIENTE_COOR";
  if (role === "ARRASTRE_TORREON") return "ARRASTRE_TORREON";
  if (role === "CLIENTE") return "CLIENTE";
  if (role.includes("ADMIN")) return "ADMINISTRADOR";
  if (role.includes("SUP")) return "SUPERVISOR";
  if (role.includes("COORD")) return "COORDINADOR";
  return "CLIENTE";
}

export function getTornoPermissions(input?: string | null): TornoPermissions {
  const role = normalizeTornoRole(input);
  const isClient = role === "CLIENTE" || role === "ARRASTRE_TORREON";
  const isClientWide = role === "CLIENTE_ADMIN" || role === "CLIENTE_COOR";
  const isOperational = role === "COORDINADOR" || role === "SUPERVISOR";
  const canOperate = isOperational;

  return {
    role,
    scopeEmpresaId: isClient || isClientWide,
    scopeLocalidadId: isClient,
    canViewHistory: true,
    canViewDurations: isOperational,
    canOperateServices: canOperate,
    canCancelServices: canOperate,
    canManageFinalMeasures: canOperate,
    canViewIncidents: isOperational,
    canManageIncidents: isOperational,
    canResolveParentIncident: isOperational,
    canResolveChildIncident: isOperational,
    canViewNavajas: isOperational,
    canManageNavajas: isOperational,
  };
}

export function roleBasePath(role: TornoRole): string {
  if (["CLIENTE", "CLIENTE_ADMIN", "CLIENTE_COOR", "ARRASTRE_TORREON"].includes(role)) return "/cliente";
  if (role === "ADMINISTRADOR") return "/administrador";
  return `/${role.toLowerCase()}`;
}
