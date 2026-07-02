import type { TornoPermissions, TornoRole } from "./types";

export const TORNO_ROLES: TornoRole[] = [
  "CLIENTE",
  "ADMINISTRADOR",
  "SUPERVISOR",
  "COORDINADOR",
];

export function normalizeTornoRole(input?: string | null): TornoRole {
  const role = String(input || "").trim().toUpperCase();
  if (["CLIENTE", "CLIENTE_ADMIN", "CLIENTE_COOR", "ARRASTRE_TORREON"].includes(role)) return "CLIENTE";
  if (role.includes("ADMIN")) return "ADMINISTRADOR";
  if (role.includes("SUP")) return "SUPERVISOR";
  if (role.includes("COORD")) return "COORDINADOR";
  return "CLIENTE";
}

export function getTornoPermissions(input?: string | null): TornoPermissions {
  const role = normalizeTornoRole(input);
  const isClient = role === "CLIENTE";

  return {
    role,
    canViewHistory: true,
    canViewIncidents: !isClient,
    canManageIncidents: !isClient,
    canResolveParentIncident: !isClient,
    canResolveChildIncident: !isClient,
    canViewNavajas: !isClient,
    canManageNavajas: !isClient,
  };
}

export function roleBasePath(role: TornoRole): string {
  return `/${role.toLowerCase()}`;
}
