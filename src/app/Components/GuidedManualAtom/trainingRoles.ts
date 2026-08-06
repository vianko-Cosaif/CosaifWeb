export type TrainingRole =
  | "ADMINISTRADOR"
  | "COMERCIAL"
  | "COORDINADOR"
  | "SUPERVISOR"
  | "CLIENTE"
  | "CLIENTE_ADMIN"
  | "CLIENTE_COOR"
  | "ARRASTRE_TORREON";

const TRAINING_ROLES: readonly TrainingRole[] = [
  "ADMINISTRADOR",
  "COMERCIAL",
  "COORDINADOR",
  "SUPERVISOR",
  "CLIENTE",
  "CLIENTE_ADMIN",
  "CLIENTE_COOR",
  "ARRASTRE_TORREON",
];

export function normalizeTrainingRole(value: unknown, roleBase: string): TrainingRole {
  const normalized = String(value || "").trim().toUpperCase() as TrainingRole;
  if (TRAINING_ROLES.includes(normalized)) return normalized;
  if (roleBase.startsWith("/administrador")) return "ADMINISTRADOR";
  if (roleBase.startsWith("/comercial")) return "COMERCIAL";
  if (roleBase.startsWith("/coordinador")) return "COORDINADOR";
  if (roleBase.startsWith("/supervisor")) return "SUPERVISOR";
  if (roleBase.startsWith("/cliente/torreon")) return "ARRASTRE_TORREON";
  return "CLIENTE";
}

