"use client";

import type { Rol } from "./types";

export const USER_ROLE_OPTIONS: Rol[] = [
  "COORDINADOR",
  "SUPERVISOR",
  "TORNO",
  "LAVADO",
  "CLIENTE",
  "CLIENTE_ADMIN",
  "CLIENTE_COOR",
  "ARRASTRE_TORREON",
  "MAQUINISTA",
  "MAQUINISTA_ARRASTRE",
];

export const LOCAL_COORDINATOR_ROLE_OPTIONS: Rol[] = [
  "CLIENTE",
  "ARRASTRE_TORREON",
  "MAQUINISTA",
  "MAQUINISTA_ARRASTRE",
];

export const ADMIN_ROLE_OPTIONS: Rol[] = ["ADMINISTRADOR", "COMERCIAL", ...USER_ROLE_OPTIONS];

export const INTERNAL_COMPANY_NAMES = ["COSAIF", "VIANKO"] as const;

export const INTERNAL_OPERATION_ROLES: Rol[] = [
  "MAQUINISTA",
  "MAQUINISTA_ARRASTRE",
  "TORNO",
  "COORDINADOR",
  "SUPERVISOR",
];

export const CLIENT_COMPANY_ROLES: Rol[] = [
  "CLIENTE",
  "CLIENTE_ADMIN",
  "CLIENTE_COOR",
  "ARRASTRE_TORREON",
];

export function normalizeCompanyName(value?: string | null) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

export function isInternalCompanyName(value?: string | null) {
  return INTERNAL_COMPANY_NAMES.includes(normalizeCompanyName(value) as (typeof INTERNAL_COMPANY_NAMES)[number]);
}

export function isRoleAllowedForCompany(role: Rol, companyName?: string | null) {
  const internalCompany = isInternalCompanyName(companyName);
  if (INTERNAL_OPERATION_ROLES.includes(role)) return internalCompany;
  if (CLIENT_COMPANY_ROLES.includes(role)) return !internalCompany;
  return true;
}

export function isCompanyAllowedForRole(companyName: string | undefined, role: Rol) {
  return isRoleAllowedForCompany(role, companyName);
}

export const ROLE_LABELS: Record<Rol, string> = {
  ADMINISTRADOR: "Administrador",
  COMERCIAL: "Comercial",
  COORDINADOR: "Coordinador",
  SUPERVISOR: "Supervisor",
  TORNO: "Tornero",
  LAVADO: "Lavadero",
  CLIENTE: "Cliente",
  CLIENTE_ADMIN: "Cliente admin",
  CLIENTE_COOR: "Cliente coor",
  ARRASTRE_TORREON: "Arrastre Torreon",
  MAQUINISTA: "Maquinista",
  MAQUINISTA_ARRASTRE: "Maquinista arrastre",
};

export const roleBadge = (role: Rol) =>
  ({
    ADMINISTRADOR:
      "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/35 dark:text-indigo-300",
    COMERCIAL:
      "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/35 dark:text-rose-300",
    COORDINADOR:
      "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-800 dark:bg-fuchsia-950/35 dark:text-fuchsia-300",
    SUPERVISOR:
      "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/35 dark:text-sky-300",
    TORNO:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/35 dark:text-amber-300",
    LAVADO:
      "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-800 dark:bg-cyan-950/35 dark:text-cyan-300",
    CLIENTE:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-300",
    CLIENTE_ADMIN:
      "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-800 dark:bg-teal-950/35 dark:text-teal-300",
    CLIENTE_COOR:
      "border-lime-200 bg-lime-50 text-lime-700 dark:border-lime-800 dark:bg-lime-950/35 dark:text-lime-300",
    ARRASTRE_TORREON:
      "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950/35 dark:text-orange-300",
    MAQUINISTA:
      "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/35 dark:text-violet-300",
    MAQUINISTA_ARRASTRE:
      "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950/35 dark:text-purple-300",
  })[role] ?? "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300";

export const roleAccent = (role: Rol) =>
  ({
    ADMINISTRADOR: {
      ring: "ring-indigo-500/20",
      grad: "from-indigo-600 to-violet-600",
      text: "text-indigo-700 dark:text-indigo-300",
    },
    COMERCIAL: {
      ring: "ring-rose-500/20",
      grad: "from-rose-600 to-pink-600",
      text: "text-rose-700 dark:text-rose-300",
    },
    COORDINADOR: {
      ring: "ring-fuchsia-500/20",
      grad: "from-fuchsia-600 to-pink-600",
      text: "text-fuchsia-700 dark:text-fuchsia-300",
    },
    SUPERVISOR: {
      ring: "ring-sky-500/20",
      grad: "from-sky-600 to-cyan-600",
      text: "text-sky-700 dark:text-sky-300",
    },
    TORNO: {
      ring: "ring-amber-500/20",
      grad: "from-amber-600 to-yellow-600",
      text: "text-amber-700 dark:text-amber-300",
    },
    LAVADO: {
      ring: "ring-cyan-500/20",
      grad: "from-cyan-600 to-blue-600",
      text: "text-cyan-700 dark:text-cyan-300",
    },
    CLIENTE: {
      ring: "ring-emerald-500/20",
      grad: "from-emerald-600 to-teal-600",
      text: "text-emerald-700 dark:text-emerald-300",
    },
    CLIENTE_ADMIN: {
      ring: "ring-teal-500/20",
      grad: "from-teal-600 to-emerald-600",
      text: "text-teal-700 dark:text-teal-300",
    },
    CLIENTE_COOR: {
      ring: "ring-lime-500/20",
      grad: "from-lime-600 to-green-600",
      text: "text-lime-700 dark:text-lime-300",
    },
    ARRASTRE_TORREON: {
      ring: "ring-orange-500/20",
      grad: "from-orange-600 to-amber-600",
      text: "text-orange-700 dark:text-orange-300",
    },
    MAQUINISTA: {
      ring: "ring-violet-500/20",
      grad: "from-violet-600 to-purple-600",
      text: "text-violet-700 dark:text-violet-300",
    },
    MAQUINISTA_ARRASTRE: {
      ring: "ring-purple-500/20",
      grad: "from-purple-600 to-fuchsia-600",
      text: "text-purple-700 dark:text-purple-300",
    },
  })[role] ?? {
    ring: "ring-slate-500/20",
    grad: "from-slate-600 to-slate-700",
    text: "text-slate-700 dark:text-slate-300",
  };
