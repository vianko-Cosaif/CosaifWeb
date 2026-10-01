import { getEmpresaIdClient, getLocIdClient, getRoleClient } from "./cookies";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function currentNotificationViewer() {
  let user: Record<string, unknown> = {};
  try {
    user = asRecord(JSON.parse(window.localStorage.getItem("user") || "{}"));
  } catch {
    // A malformed or absent local snapshot never grants a notification audience.
  }
  return {
    id: Number(user.id) || null,
    role: getRoleClient() ?? String(user.rol || user.role || "").toUpperCase(),
    empresaId:
      getEmpresaIdClient() ?? (Number(user.empresaId ?? asRecord(user.empresa).id) || null),
    localidadId:
      getLocIdClient() ?? (Number(user.localidadId ?? asRecord(user.localidad).id) || null),
  };
}
