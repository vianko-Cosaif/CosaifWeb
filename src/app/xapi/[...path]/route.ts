import { MovementScopeError, scopePrivateClientMovementRead } from "@/lib/auth/movementScope";
import { buildUpstreamHeaders, fetchUpstream, getErrorStatus, upstreamResponseHeaders } from "@/lib/server/upstream";
// src/app/xapi/[...path]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { normalizeHttpOrigin } from "@/lib/serverOrigin";
import { containsTrainingReservedId } from "@/lib/routePolicy";
import { getVerifiedSession } from "@/lib/server/session";
import { rejectCrossSiteMutation } from "@/lib/server/requestSecurity";
import { canForwardApiRequest } from "@/lib/server/requestAuthorization";

const API_URL = normalizeHttpOrigin(process.env.API_ORIGIN);
const TOKEN_COOKIE = process.env.JWT_COOKIE_NAME ?? "token";

export const dynamic = "force-dynamic";
export const fetchCache = "default-no-store";

async function proxy(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const crossSite = rejectCrossSiteMutation(req);
  if (crossSite) return crossSite;
  if (!API_URL) return NextResponse.json({ message: "Servicio no configurado" }, { status: 500 });

  const { path } = await ctx.params;                         // params async
  if (!path.length || path.some((segment) => !segment || segment === "." || segment === ".." || segment.includes("/"))) {
    return NextResponse.json({ message: "Ruta inválida" }, { status: 400 });
  }
  const hasBody = !["GET", "HEAD"].includes(req.method);
  const jsonBody = hasBody && (req.headers.get("content-type") || "").includes("application/json")
    ? await req.clone().json().catch(() => null)
    : null;
  if (containsTrainingReservedId(path) || containsTrainingReservedId(req.nextUrl.search) || containsTrainingReservedId(jsonBody)) {
    return NextResponse.json(
      { message: "Los registros SIM sólo existen dentro de la capacitación." },
      { status: 409 }
    );
  }
  const jar = await cookies();                               // cookies async
  const token = jar.get(TOKEN_COOKIE)?.value || "";
  const session = await getVerifiedSession();
  if (!token || !session) return NextResponse.json({ message: "No autenticado" }, { status: 401 });
  if (!canForwardApiRequest(session.authorization, `/${path.join("/")}`, req.method)) {
    return NextResponse.json({ message: "Esta acción no está habilitada para tu perfil." }, { status: 403 });
  }
  const assignedEmpresaId = Number(session.empresaId || 0);
  const assignedLocalidadId = Number(session.localidadId || 0);
  const scopeMode = session.authorization.scope.mode;
  const restrictedLocality = scopeMode === "LOCALITY" || scopeMode === "COMPANY_LOCALITY";
  const restrictedCompany = scopeMode === "COMPANY" || scopeMode === "COMPANY_LOCALITY";

  const orig = new URL(req.url);
  const scopedPath = [...path];
  const searchParams = new URLSearchParams(orig.searchParams);
  try {
    scopePrivateClientMovementRead(session, `/${scopedPath.join("/")}`, req.method, searchParams);
  } catch (error) {
    if (error instanceof MovementScopeError) return NextResponse.json({ message: error.message }, { status: error.status });
    throw error;
  }

  const isMovementRequest = scopedPath[0] === "movimientos";
  const isMovementCreate = isMovementRequest && scopedPath.length === 1 && req.method === "POST";
  const isTorreonMovementCreate = scopedPath[0] === "torreon" && scopedPath[1] === "movimientos" && req.method === "POST";

  if (restrictedLocality && (isMovementRequest || isTorreonMovementCreate)) {
    if (!Number.isFinite(assignedLocalidadId) || assignedLocalidadId <= 0) {
      return NextResponse.json({ message: "No hay una localidad asignada a la sesion." }, { status: 403 });
    }

    const requestedLocalidadId = Number(searchParams.get("localidadId") || 0);
    if (requestedLocalidadId > 0 && requestedLocalidadId !== assignedLocalidadId) {
      return NextResponse.json({ message: "Solo puedes consultar movimientos de tu localidad." }, { status: 403 });
    }
    searchParams.set("localidadId", String(assignedLocalidadId));

    if (scopedPath[1] === "localidad" && Number(scopedPath[2]) !== assignedLocalidadId) {
      return NextResponse.json({ message: "Solo puedes consultar movimientos de tu localidad." }, { status: 403 });
    }
    if (scopedPath[1] === "empresa" && scopedPath[3] === "localidad" && Number(scopedPath[4]) !== assignedLocalidadId) {
      return NextResponse.json({ message: "Solo puedes consultar movimientos de tu localidad." }, { status: 403 });
    }
    if (scopedPath[1] === "pendientes") {
      scopedPath.splice(1, scopedPath.length - 1, "localidad", String(assignedLocalidadId), "pendientes");
    } else if (scopedPath[1] === "empresa" && scopedPath[3] === "pendientes") {
      scopedPath.splice(3, scopedPath.length - 3, "localidad", String(assignedLocalidadId), "pendientes");
    }
  }

  if (restrictedCompany && (isMovementRequest || isTorreonMovementCreate)) {
    if (!Number.isFinite(assignedEmpresaId) || assignedEmpresaId <= 0) {
      return NextResponse.json({ message: "No hay una empresa asignada a la sesion." }, { status: 403 });
    }

    const requestedEmpresaId = Number(searchParams.get("empresaId") || 0);
    if (requestedEmpresaId > 0 && requestedEmpresaId !== assignedEmpresaId) {
      return NextResponse.json({ message: "Solo puedes consultar movimientos de tu empresa." }, { status: 403 });
    }
    searchParams.set("empresaId", String(assignedEmpresaId));

    if (isMovementRequest && scopedPath[1] === "empresa" && Number(scopedPath[2]) !== assignedEmpresaId) {
      return NextResponse.json({ message: "Solo puedes consultar movimientos de tu empresa." }, { status: 403 });
    }

    if (isMovementRequest && scopedPath[1] === "localidad" && scopedPath[3] === "pendientes") {
      scopedPath.splice(
        1,
        scopedPath.length - 1,
        "empresa",
        String(assignedEmpresaId),
        "localidad",
        String(assignedLocalidadId),
        "pendientes"
      );
    }
  }

  const search = searchParams.toString();
  const destURL = `${API_URL}/${scopedPath.join("/")}${search ? `?${search}` : ""}`;

  const h = buildUpstreamHeaders(req, token);

  let body: BodyInit | undefined;
  if (hasBody && restrictedLocality && (isMovementCreate || isTorreonMovementCreate)) {
    const payload = await req.json().catch(() => null);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return NextResponse.json({ message: "Payload invalido" }, { status: 400 });
    }
    body = JSON.stringify({
      ...payload,
      localidadId: assignedLocalidadId,
      ...(restrictedCompany ? { empresaId: assignedEmpresaId } : {}),
    });
    h.set("content-type", "application/json");
  } else if (hasBody) {
    body = req.body ?? undefined;
  }
  let upstream: Response;
  try {
    upstream = await fetchUpstream(destURL, {
      method: req.method,
      headers: h,
      body,
      duplex: hasBody ? "half" : undefined,
      cache: "no-store",
      redirect: "manual",
    } as RequestInit & { duplex?: "half" }, req.signal, destURL.includes("/realtime/events"));
  } catch (error) {
    return NextResponse.json({ message: "Servicio no disponible" }, { status: getErrorStatus(error) });
  }

  return new NextResponse(upstream.body, { status: upstream.status, headers: upstreamResponseHeaders(upstream) });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) { return proxy(req, ctx); }
export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) { return proxy(req, ctx); }
export async function PUT(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) { return proxy(req, ctx); }
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) { return proxy(req, ctx); }
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) { return proxy(req, ctx); }
