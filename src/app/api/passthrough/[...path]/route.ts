// app/api/passthrough/[...path]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { normalizeHttpOrigin } from "@/lib/serverOrigin";
import { containsTrainingReservedId } from "@/lib/routePolicy";
import { getVerifiedSession } from "@/lib/server/session";
import { rejectCrossSiteMutation } from "@/lib/server/requestSecurity";
import { canForwardApiRequest } from "@/lib/server/requestAuthorization";

const API_BASE = normalizeHttpOrigin(
  process.env.API_BASE ||
  process.env.API_URL ||
  process.env.API_ORIGIN ||
  process.env.NEXT_PUBLIC_API_URL ||
  ""
);
const JWT_NAME = process.env.JWT_COOKIE_NAME || "token";
type RouteCtx = { params: Promise<{ path: string[] }> };

function targetUrl(base: string, path: string[], search: string) {
  const cleanBase = base.trim();
  if (!cleanBase) throw new Error("Falta configurar API_ORIGIN, API_BASE o API_URL");
  const u = new URL(cleanBase);
  u.pathname = `${u.pathname.replace(/\/$/, "")}/${path.join("/")}`;
  u.search = search;
  return u.toString();
}

async function forward(req: NextRequest, ctx: RouteCtx) {
  const crossSite = rejectCrossSiteMutation(req);
  if (crossSite) return crossSite;
  const { path } = await ctx.params; // <- clave
  if (!path.length || path.some((segment) => !segment || segment === "." || segment === ".." || segment.includes("/"))) {
    return NextResponse.json({ message: "Ruta inválida" }, { status: 400 });
  }
  const hasBody = !["GET", "HEAD"].includes(req.method);
  const isRealtimeStream = req.method === "GET" && path.join("/") === "realtime/events";
  const jsonBody = hasBody && (req.headers.get("content-type") || "").includes("application/json")
    ? await req.clone().json().catch(() => null)
    : null;
  if (containsTrainingReservedId(path) || containsTrainingReservedId(req.nextUrl.search) || containsTrainingReservedId(jsonBody)) {
    return NextResponse.json(
      { message: "Los registros SIM sólo existen dentro de la capacitación." },
      { status: 409 }
    );
  }
  let url: string;
  try {
    url = targetUrl(API_BASE, path, req.nextUrl.search);
  } catch (error) {
    const message = error instanceof Error ? error.message : "URL de API invalida";
    return NextResponse.json({ message }, { status: 503 });
  }

  const session = await getVerifiedSession();
  const token = req.cookies.get(JWT_NAME)?.value;
  if (!session || !token) return NextResponse.json({ message: "No autenticado" }, { status: 401 });
  if (!canForwardApiRequest(session.authorization, `/${path.join("/")}`, req.method)) {
    return NextResponse.json({ message: "Esta acción no está habilitada para tu perfil." }, { status: 403 });
  }

  const headers = new Headers();
  headers.set("accept", req.headers.get("accept") || "application/json");
  headers.set("authorization", `Bearer ${token}`);
  for (const name of ["content-type", "range", "if-none-match", "last-event-id"]) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }

  const body = req.method === "GET" || req.method === "HEAD" ? undefined : Buffer.from(await req.arrayBuffer());

  let upstream: Response;
  try {
    upstream = await fetch(url, { method: req.method, headers, body, redirect: "manual", cache: "no-store" });
  } catch {
    return NextResponse.json({ message: "Upstream unavailable" }, { status: 502 });
  }

  const responseHeaders = new Headers({
    "content-type": upstream.headers.get("content-type") || "application/json",
    "cache-control": isRealtimeStream ? "no-cache, no-transform" : "no-store",
  });
  if (isRealtimeStream) {
    // Sin esta cabecera Nginx retiene el evento `realtime.ready`; el navegador
    // vence a los 10 s y entra en un ciclo conectar/desconectar.
    responseHeaders.set("x-accel-buffering", "no");
  }
  for (const name of ["content-disposition", "content-range", "etag"]) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  const resp = new NextResponse(upstream.body, { status: upstream.status, headers: responseHeaders });

  return resp;
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Exporta todos los verbos usando el mismo forward
export async function GET(req: NextRequest, ctx: RouteCtx)  { return forward(req, ctx); }
export async function POST(req: NextRequest, ctx: RouteCtx) { return forward(req, ctx); }
export async function PUT(req: NextRequest, ctx: RouteCtx)  { return forward(req, ctx); }
export async function PATCH(req: NextRequest, ctx: RouteCtx){ return forward(req, ctx); }
export async function DELETE(req: NextRequest, ctx: RouteCtx){ return forward(req, ctx); }
export async function OPTIONS() { return new NextResponse(null, { status: 204 }); }
export async function HEAD(req: NextRequest, ctx: RouteCtx) { return forward(req, ctx); }
