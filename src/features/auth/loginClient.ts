import { parseAuthorizationProfile } from "@/lib/accessControl";
import { safeReturnPath } from "@/lib/auth/returnPath";
import { isClienteAreaRole, isTorreonLocalidadId } from "@/lib/torreonLocalidad";

const DEST: Record<string, string> = {
  CLIENTE: "/cliente", CLIENTE_ADMIN: "/cliente", CLIENTE_COOR: "/cliente",
  ARRASTRE_TORREON: "/cliente/torreon", SUPERVISOR: "/supervisor",
  ADMINISTRADOR: "/administrador", COMERCIAL: "/comercial", COORDINADOR: "/coordinador",
};
const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);

function loginError(status: number, payload: unknown): string {
  // A server outage must never be presented as an incorrect password.
  if (status === 401 || status === 400) return "Usuario o contraseña incorrectos. Revisa tus datos e inténtalo de nuevo.";
  if (status === 429) return "Se alcanzó el límite de intentos. Espera unos minutos antes de volver a intentar.";
  if (status === 504) return "El servicio está tardando en responder. Inténtalo de nuevo en un momento.";
  if (status >= 500) return "El servicio de acceso no está disponible en este momento. Inténtalo más tarde o contacta al administrador.";
  const detail = isRecord(payload) ? payload.error ?? payload.message : undefined;
  if (typeof detail === "string" && detail.trim() && detail.length <= 240 && !/[<>]/.test(detail)) return detail;
  return status === 403 ? "Tu cuenta no tiene acceso a esta plataforma. Contacta al administrador." : "No fue posible iniciar sesión. Inténtalo nuevamente.";
}

/** Credentials go only to our same-origin BFF. Session tokens remain in HttpOnly cookies. */
export async function authenticate(nombre: string, contrasena: string, requestedPath: string | null) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    let response: Response;
    try {
      response = await fetch("/bff/login", {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "same-origin", cache: "no-store", signal: controller.signal,
        body: JSON.stringify({ nombre: nombre.trim(), contrasena }),
      });
    } catch {
      throw new Error(controller.signal.aborted
        ? "El servicio está tardando en responder. Inténtalo de nuevo en un momento."
        : "No pudimos conectar con el servicio. Revisa tu conexión e inténtalo de nuevo.");
    }
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) throw new Error(loginError(response.status, payload));
    if (!isRecord(payload)) throw new Error("El servicio devolvió una respuesta incompleta. Inténtalo de nuevo.");
    const user = isRecord(payload.user) ? payload.user : {};
    const authorization = parseAuthorizationProfile(payload.authorization ?? user.authorization);
    const uid = Number(user.id ?? payload.id);
    if (!authorization || !Number.isInteger(uid) || uid <= 0) throw new Error("No fue posible validar tu perfil de acceso. Contacta al administrador.");
    if (!authorization.platforms.web || !authorization.capabilities.canUseWeb) throw new Error("Tu cuenta no tiene acceso a esta plataforma. Contacta al administrador.");
    const { role, capabilities, scope } = authorization;
    const company = isRecord(user.empresa) ? user.empresa : {};
    const storedUser = {
      id: uid, rol: role, nombre: typeof user.nombre === "string" ? user.nombre : "", authorization,
      ...(scope.empresaId ? { empresaId: scope.empresaId, empresa: { id: scope.empresaId, nombre: typeof company.nombre === "string" ? company.nombre : "" } } : {}),
      ...(scope.localidadId ? { localidadId: scope.localidadId } : {}),
    };
    const isTorreon = role === "ARRASTRE_TORREON" || (role === "CLIENTE" && !capabilities.canSwitchLocalidad && isTorreonLocalidadId(scope.localidadId));
    const destination = isClienteAreaRole(role) && isTorreon ? "/cliente/torreon" : DEST[role] || capabilities.home;
    return { user: storedUser, destination: safeReturnPath(requestedPath, authorization, destination) };
  } finally {
    clearTimeout(timeout);
  }
}
