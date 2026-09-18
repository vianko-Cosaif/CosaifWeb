import { MovementScopeError, scopePrivateClientMovementRead } from "@/lib/auth/movementScope";
import {
  buildUpstreamHeaders,
  fetchUpstream,
  getErrorStatus,
  upstreamResponseHeaders,
} from "@/lib/server/upstream";
import "server-only";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { normalizeHttpOrigin } from "@/lib/serverOrigin";
import { containsTrainingReservedId } from "@/lib/routePolicy";
import { getVerifiedSession } from "@/lib/server/session";
import { rejectCrossSiteMutation } from "@/lib/server/requestSecurity";
import { canForwardApiRequest } from "@/lib/server/requestAuthorization";

const ORIGIN = normalizeHttpOrigin(process.env.API_ORIGIN);

function upstreamUrl(path: string, search: string) {
  const p = path.replace(/^\/+/, "");
  return `${ORIGIN}/${p}${search || ""}`;
}

function readUsersCollection(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value))
    return value.filter(
      (item): item is Record<string, unknown> => !!item && typeof item === "object",
    );
  if (!value || typeof value !== "object") return [];

  const record = value as Record<string, unknown>;
  for (const key of ["data", "usuarios", "items", "results"]) {
    if (Array.isArray(record[key])) {
      return (record[key] as unknown[]).filter(
        (item): item is Record<string, unknown> => !!item && typeof item === "object",
      );
    }
  }
  return [];
}

function userLocalidadId(user: Record<string, unknown>): number {
  const localidad =
    user.localidad && typeof user.localidad === "object"
      ? (user.localidad as Record<string, unknown>)
      : undefined;
  return Number(user.localidadId ?? localidad?.id ?? 0);
}

function filterUsersPayload(value: unknown, localidadId: number): unknown {
  const filter = (users: Record<string, unknown>[]) =>
    users.filter(
      (user) =>
        userLocalidadId(user) === localidadId &&
        String(user.rol || "").toUpperCase() !== "ADMINISTRADOR",
    );

  if (Array.isArray(value)) return filter(readUsersCollection(value));
  if (!value || typeof value !== "object") return [];

  const record = value as Record<string, unknown>;
  for (const key of ["data", "usuarios", "items", "results"]) {
    if (Array.isArray(record[key]))
      return { ...record, [key]: filter(readUsersCollection({ [key]: record[key] })) };
  }
  return value;
}

async function coordinatorCanManageUser(
  headers: Headers,
  userId: number,
  localidadId: number,
): Promise<boolean> {
  try {
    const url = upstreamUrl("/usuarios", `?localidadId=${localidadId}`);
    const response = await fetchUpstream(url, { headers });
    if (!response.ok) return false;
    const value = await response.json().catch(() => null);
    const user = readUsersCollection(value).find((item) => Number(item.id) === userId);
    return (
      !!user &&
      userLocalidadId(user) === localidadId &&
      String(user.rol || "").toUpperCase() !== "ADMINISTRADOR"
    );
  } catch {
    return false;
  }
}

async function proxy(req: NextRequest) {
  const crossSite = rejectCrossSiteMutation(req);
  if (crossSite) return crossSite;
  if (!ORIGIN) {
    return NextResponse.json({ error: "Servicio no configurado" }, { status: 500 });
  }

  const cookieStore = await cookies();
  const cookieName = process.env.JWT_COOKIE_NAME ?? "token";
  const token = cookieStore.get(cookieName)?.value || cookieStore.get("token")?.value || "";
  const session = await getVerifiedSession();
  if (!token || !session) return NextResponse.json({ message: "No autenticado" }, { status: 401 });
  const role = session.role;
  const assignedEmpresaId = Number(session.empresaId || 0);
  const assignedLocalidadId = Number(session.localidadId || 0);
  const capabilities = session.authorization.capabilities;
  const scopeMode = session.authorization.scope.mode;
  const restrictedLocality = scopeMode === "LOCALITY" || scopeMode === "COMPANY_LOCALITY";
  const restrictedCompany = scopeMode === "COMPANY" || scopeMode === "COMPANY_LOCALITY";
  const restrictedCoordinator = role === "COORDINADOR";
  let upstreamPath = req.nextUrl.pathname.replace(/^\/bff/, "");
  if (!canForwardApiRequest(session.authorization, upstreamPath, req.method)) {
    return NextResponse.json(
      { message: "Esta acción no está habilitada para tu perfil." },
      { status: 403 },
    );
  }
  const searchParams = new URLSearchParams(req.nextUrl.searchParams);
  try {
    scopePrivateClientMovementRead(session, upstreamPath, req.method, searchParams);
  } catch (error) {
    if (error instanceof MovementScopeError)
      return NextResponse.json({ message: error.message }, { status: error.status });
    throw error;
  }

  const hasBody = !["GET", "HEAD"].includes(req.method);
  const jsonBody =
    hasBody && (req.headers.get("content-type") || "").includes("application/json")
      ? await req
          .clone()
          .json()
          .catch(() => null)
      : null;
  if (
    containsTrainingReservedId(upstreamPath) ||
    containsTrainingReservedId(req.nextUrl.search) ||
    containsTrainingReservedId(jsonBody)
  ) {
    return NextResponse.json(
      { message: "Los registros SIM sólo existen dentro de la capacitación." },
      { status: 409 },
    );
  }
  const isCompanyWrite =
    (upstreamPath === "/empresas" || upstreamPath.startsWith("/empresas/")) &&
    !["GET", "HEAD"].includes(req.method);
  const isMovementPath =
    upstreamPath === "/movimientos" || upstreamPath.startsWith("/movimientos/");
  const isMovementListing =
    upstreamPath.includes("/pendientes") || upstreamPath === "/movimientos/buscar";
  const isUsersCollection = upstreamPath === "/usuarios";
  const isUsersPath = isUsersCollection || upstreamPath.startsWith("/usuarios/");
  const userTarget = upstreamPath.match(/^\/usuarios\/(\d+)(?:\/estado)?$/);
  const isReportPath =
    upstreamPath === "/reporteria" ||
    upstreamPath.startsWith("/reporteria/") ||
    upstreamPath === "/reporterias" ||
    upstreamPath.startsWith("/reporterias/");
  const isTornoRead =
    ["GET", "HEAD"].includes(req.method) &&
    (upstreamPath === "/torno" || upstreamPath.startsWith("/torno/"));

  if (isReportPath && !capabilities.canViewReports) {
    return NextResponse.json(
      { message: "Reporteria no disponible para este rol." },
      { status: 403 },
    );
  }

  if (isTornoRead && capabilities.isClientLike) {
    if (!Number.isFinite(assignedEmpresaId) || assignedEmpresaId <= 0) {
      return NextResponse.json(
        { message: "No hay una empresa asignada a la sesion." },
        { status: 403 },
      );
    }

    const requestedEmpresaId = Number(searchParams.get("empresaId") || 0);
    if (requestedEmpresaId > 0 && requestedEmpresaId !== assignedEmpresaId) {
      return NextResponse.json(
        { message: "Solo puedes consultar locomotoras de tu empresa." },
        { status: 403 },
      );
    }
    searchParams.set("empresaId", String(assignedEmpresaId));

    if (role === "CLIENTE" && Number.isFinite(assignedLocalidadId) && assignedLocalidadId > 0) {
      const requestedLocalidadId = Number(searchParams.get("localidadId") || 0);
      if (requestedLocalidadId > 0 && requestedLocalidadId !== assignedLocalidadId) {
        return NextResponse.json(
          { message: "Solo puedes consultar locomotoras de tu localidad." },
          { status: 403 },
        );
      }
      searchParams.set("localidadId", String(assignedLocalidadId));
    }
  }

  if (isCompanyWrite && role !== "ADMINISTRADOR") {
    return NextResponse.json(
      { message: "Solo un administrador puede gestionar empresas." },
      { status: 403 },
    );
  }

  if (restrictedLocality && isMovementPath) {
    if (!Number.isFinite(assignedLocalidadId) || assignedLocalidadId <= 0) {
      return NextResponse.json(
        { message: "No hay una localidad asignada a la sesion." },
        { status: 403 },
      );
    }

    const requestedLocalidadId = Number(searchParams.get("localidadId") || 0);
    if (requestedLocalidadId > 0 && requestedLocalidadId !== assignedLocalidadId) {
      return NextResponse.json(
        { message: "Solo puedes consultar movimientos de tu localidad." },
        { status: 403 },
      );
    }

    const embeddedLocalidad = upstreamPath.match(/\/localidad\/(\d+)(?:\/|$)/);
    if (embeddedLocalidad && Number(embeddedLocalidad[1]) !== assignedLocalidadId) {
      return NextResponse.json(
        { message: "Solo puedes consultar movimientos de tu localidad." },
        { status: 403 },
      );
    }

    if (upstreamPath === "/movimientos/pendientes") {
      upstreamPath = `/movimientos/localidad/${assignedLocalidadId}/pendientes`;
    } else {
      const empresaPendientes = upstreamPath.match(/^\/movimientos\/empresa\/(\d+)\/pendientes$/);
      if (empresaPendientes) {
        upstreamPath = `/movimientos/empresa/${empresaPendientes[1]}/localidad/${assignedLocalidadId}/pendientes`;
      }
    }

    if (isMovementListing) searchParams.set("localidadId", String(assignedLocalidadId));
  }

  if (restrictedCompany && isMovementPath) {
    if (!Number.isFinite(assignedEmpresaId) || assignedEmpresaId <= 0) {
      return NextResponse.json(
        { message: "No hay una empresa asignada a la sesion." },
        { status: 403 },
      );
    }

    const requestedEmpresaId = Number(searchParams.get("empresaId") || 0);
    if (requestedEmpresaId > 0 && requestedEmpresaId !== assignedEmpresaId) {
      return NextResponse.json(
        { message: "Solo puedes consultar movimientos de tu empresa." },
        { status: 403 },
      );
    }

    const embeddedEmpresa = upstreamPath.match(/\/empresa\/(\d+)(?:\/|$)/);
    if (embeddedEmpresa && Number(embeddedEmpresa[1]) !== assignedEmpresaId) {
      return NextResponse.json(
        { message: "Solo puedes consultar movimientos de tu empresa." },
        { status: 403 },
      );
    }

    if (isMovementListing) searchParams.set("empresaId", String(assignedEmpresaId));

    const localidadPendientes = upstreamPath.match(/^\/movimientos\/localidad\/(\d+)\/pendientes$/);
    if (localidadPendientes) {
      upstreamPath = `/movimientos/empresa/${assignedEmpresaId}/localidad/${localidadPendientes[1]}/pendientes`;
    } else if (upstreamPath === "/movimientos/pendientes") {
      upstreamPath = `/movimientos/empresa/${assignedEmpresaId}/localidad/${assignedLocalidadId}/pendientes`;
    }
  }

  if (restrictedCoordinator && isUsersPath) {
    if (!Number.isFinite(assignedLocalidadId) || assignedLocalidadId <= 0) {
      return NextResponse.json(
        { message: "No hay una localidad asignada a la sesion." },
        { status: 403 },
      );
    }

    const requestedLocalidadId = Number(searchParams.get("localidadId") || 0);
    if (requestedLocalidadId > 0 && requestedLocalidadId !== assignedLocalidadId) {
      return NextResponse.json(
        { message: "Solo puedes gestionar usuarios de tu localidad." },
        { status: 403 },
      );
    }

    if (isUsersCollection && req.method === "GET") {
      searchParams.set("localidadId", String(assignedLocalidadId));
    }
  }

  const search = searchParams.toString();
  const url = upstreamUrl(upstreamPath, search ? `?${search}` : "");
  const headers = buildUpstreamHeaders(req, token);

  let body: BodyInit | undefined;
  if (hasBody) {
    if (restrictedCoordinator && isUsersPath && userTarget) {
      const canManageTarget = await coordinatorCanManageUser(
        headers,
        Number(userTarget[1]),
        assignedLocalidadId,
      ).catch(() => false);
      if (!canManageTarget) {
        return NextResponse.json(
          { message: "Solo puedes gestionar usuarios de tu localidad." },
          { status: 403 },
        );
      }
    }

    if (restrictedCoordinator && isUsersPath && ["POST", "PUT", "PATCH"].includes(req.method)) {
      const payload = await req.json().catch(() => null);
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return NextResponse.json({ message: "Payload invalido" }, { status: 400 });
      }
      if (
        String((payload as Record<string, unknown>).rol || "").toUpperCase() === "ADMINISTRADOR"
      ) {
        return NextResponse.json(
          { message: "Solo un administrador puede gestionar administradores." },
          { status: 403 },
        );
      }
      body = JSON.stringify(
        upstreamPath.endsWith("/estado")
          ? payload
          : { ...payload, localidadId: assignedLocalidadId },
      );
      headers.set("content-type", "application/json");
    } else if (
      (restrictedLocality || restrictedCompany) &&
      ["/movimientos", "/torreon/movimientos"].includes(upstreamPath) &&
      req.method === "POST"
    ) {
      if (
        (restrictedCompany && assignedEmpresaId <= 0) ||
        (restrictedLocality && assignedLocalidadId <= 0)
      ) {
        return NextResponse.json(
          { message: "No se pudo validar tu empresa o localidad." },
          { status: 403 },
        );
      }
      const payload = await req.json().catch(() => null);
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return NextResponse.json({ message: "Payload invalido" }, { status: 400 });
      }
      body = JSON.stringify({
        ...payload,
        ...(restrictedLocality ? { localidadId: assignedLocalidadId } : {}),
        ...(restrictedCompany ? { empresaId: assignedEmpresaId } : {}),
        creadoPorId: session.userId,
        ...(capabilities.isClientLike ? { clienteId: session.userId } : {}),
      });
      headers.set("content-type", "application/json");
    } else {
      body = await req.arrayBuffer();
    }
  }

  const init: RequestInit = {
    method: req.method,
    headers,
    body,
    cache: "no-store",
    redirect: "manual",
  };

  try {
    const r = await fetchUpstream(url, init, req.signal);
    const contentType = r.headers.get("content-type") ?? "application/json";

    if (
      restrictedCoordinator &&
      isUsersCollection &&
      req.method === "GET" &&
      r.ok &&
      contentType.includes("application/json")
    ) {
      const parsed = (await r.json()) as unknown;
      return NextResponse.json(filterUsersPayload(parsed, assignedLocalidadId), {
        status: r.status,
        headers: { "cache-control": "no-store" },
      });
    }

    return new NextResponse(r.body, { status: r.status, headers: upstreamResponseHeaders(r) });
  } catch (error) {
    const status = getErrorStatus(error);
    return NextResponse.json(
      { error: status === 504 ? "El servicio tardó demasiado" : "Servicio no disponible" },
      { status },
    );
  }
}

// Handlers HTTP
export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
