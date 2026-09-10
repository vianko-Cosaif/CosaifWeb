import type { VerifiedSession } from "@/lib/sessionToken";

export type MovementReadContext = "current-list" | "history-list" | "detail";
export class MovementScopeError extends Error {
  constructor(message: string, public readonly status: 400 | 403 = 403) {
    super(message);
    this.name = "MovementScopeError";
  }
}

function positiveId(value: unknown): number | null {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function requestedId(value: string | null, label: string) {
  if (value == null || value === "") return null;
  const id = positiveId(value);
  if (!id) throw new MovementScopeError(`${label} inválida.`, 400);
  return id;
}

/** Context is chosen by the server endpoint, never by an untrusted scope flag. */
export function resolveMovementReadScope(session: VerifiedSession, context: MovementReadContext, params: URLSearchParams) {
  const mode = session.authorization.scope.mode;
  const isClient = session.role === "CLIENTE";
  const sharedCurrentLocality = isClient && context === "current-list";
  const restrictLocality = isClient || mode === "LOCALITY" || mode === "COMPANY_LOCALITY";
  const restrictCompany = !sharedCurrentLocality && (isClient || mode === "COMPANY" || mode === "COMPANY_LOCALITY");
  const assignedLocalidadId = positiveId(session.localidadId);
  const assignedEmpresaId = positiveId(session.empresaId);
  const requestedLocalidadId = requestedId(params.get("localidadId"), "Localidad");
  const requestedEmpresaId = requestedId(params.get("empresaId"), "Empresa");
  if (restrictLocality && (!assignedLocalidadId || (requestedLocalidadId && requestedLocalidadId !== assignedLocalidadId))) {
    throw new MovementScopeError("Solo puedes consultar movimientos de tu localidad asignada.");
  }
  if (restrictCompany && (!assignedEmpresaId || (requestedEmpresaId && requestedEmpresaId !== assignedEmpresaId))) {
    throw new MovementScopeError("Solo puedes consultar movimientos de tu empresa.");
  }
  return {
    sharedCurrentLocality,
    localidadId: restrictLocality ? assignedLocalidadId : requestedLocalidadId,
    empresaId: restrictCompany ? assignedEmpresaId : requestedEmpresaId,
    restrictLocality,
    restrictCompany,
  };
}

export function recordMatchesMovementScope(
  record: { empresaId?: unknown; localidadId?: unknown },
  scope: Pick<ReturnType<typeof resolveMovementReadScope>, "empresaId" | "localidadId">,
) {
  return (!scope.empresaId || positiveId(record.empresaId) === scope.empresaId)
    && (!scope.localidadId || positiveId(record.localidadId) === scope.localidadId);
}

/** Generic proxies stay private; the operational cross-company projection has its own endpoint. */
export function scopePrivateClientMovementRead(session: VerifiedSession, path: string, method: string, params: URLSearchParams) {
  if (session.role !== "CLIENTE" || !["GET", "HEAD"].includes(method.toUpperCase())) return;
  if (!/^\/(?:movimientos|rondas|torno|torreon\/(?:movimientos|rondas|arrastres))(?:\/|$)/.test(path)) return;
  const scope = resolveMovementReadScope(session, "detail", params);
  const embeddedLocality = path.match(/\/localidad\/(\d+)(?:\/|$)/);
  const embeddedCompany = path.match(/\/empresa\/(\d+)(?:\/|$)/);
  if ((embeddedLocality && Number(embeddedLocality[1]) !== scope.localidadId)
    || (embeddedCompany && Number(embeddedCompany[1]) !== scope.empresaId)) {
    throw new MovementScopeError("Solo puedes consultar movimientos de tu empresa y localidad asignadas.");
  }
  params.delete("alcance");
  params.set("empresaId", String(scope.empresaId));
  params.set("localidadId", String(scope.localidadId));
}
