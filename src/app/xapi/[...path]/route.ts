/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/xapi/[...path]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { normalizeHttpOrigin } from "@/lib/serverOrigin";
import { containsTrainingReservedId } from "@/lib/routePolicy";
import { getVerifiedSession } from "@/lib/server/session";
import { rejectCrossSiteMutation } from "@/lib/server/requestSecurity";

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
  const role = session.role;
  const assignedLocalidadId = Number(session.localidadId || 0);
  const restrictedLocality = role !== "ADMINISTRADOR";

  const orig = new URL(req.url);
  const scopedPath = [...path];
  const searchParams = new URLSearchParams(orig.searchParams);
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

  const search = searchParams.toString();
  const destURL = `${API_URL}/${scopedPath.join("/")}${search ? `?${search}` : ""}`;

  const h = new Headers();
  h.set("accept", req.headers.get("accept") || "application/json");
  const contentType = req.headers.get("content-type");
  if (contentType) h.set("content-type", contentType);
  h.set("authorization", `Bearer ${token}`);

  let body: BodyInit | undefined;
  if (hasBody && restrictedLocality && (isMovementCreate || isTorreonMovementCreate)) {
    const payload = await req.json().catch(() => null);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return NextResponse.json({ message: "Payload invalido" }, { status: 400 });
    }
    body = JSON.stringify({ ...payload, localidadId: assignedLocalidadId });
    h.set("content-type", "application/json");
  } else if (hasBody) {
    body = (req as any).body;
  }
  let upstream: Response;
  try {
    upstream = await fetch(destURL, {
      method: req.method,
      headers: h,
      body,
      duplex: hasBody ? "half" : undefined,
      cache: "no-store",
      redirect: "manual",
    } as any);
  } catch {
    return NextResponse.json({ message: "Servicio no disponible" }, { status: 502 });
  }

  const rh = new Headers({
    "content-type": upstream.headers.get("content-type") || "application/json",
    "cache-control": "no-store",
  });
  const disposition = upstream.headers.get("content-disposition");
  if (disposition) rh.set("content-disposition", disposition);

  return new NextResponse(upstream.body, { status: upstream.status, headers: rh });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) { return proxy(req, ctx); }
export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) { return proxy(req, ctx); }
export async function PUT(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) { return proxy(req, ctx); }
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) { return proxy(req, ctx); }
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) { return proxy(req, ctx); }
