import { buildUpstreamHeaders, fetchUpstream, getErrorStatus, upstreamResponseHeaders } from "@/lib/server/upstream";
// app/bff/route.ts
import "server-only";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { normalizeHttpOrigin } from "@/lib/serverOrigin";
import { getVerifiedSession } from "@/lib/server/session";
import { rejectCrossSiteMutation } from "@/lib/server/requestSecurity";
import { canForwardApiRequest } from "@/lib/server/requestAuthorization";

const ORIGIN = normalizeHttpOrigin(process.env.API_ORIGIN);


function upstreamUrl(path: string, search: string) {
  const p = path.replace(/^\/+/, "");
  return `${ORIGIN}/${p}${search || ""}`;
}





async function proxy(req: NextRequest) {
  const crossSite = rejectCrossSiteMutation(req);
  if (crossSite) return crossSite;
  if (!ORIGIN) {
    return NextResponse.json({ error: "Servicio no configurado" }, { status: 500 });
  }
  const up = upstreamUrl(req.nextUrl.pathname.replace(/^\/bff/, ""), req.nextUrl.search);

  const cookieStore = await cookies();
  const cookieName = process.env.JWT_COOKIE_NAME ?? "token";
  const token =
    cookieStore.get(cookieName)?.value ||
    cookieStore.get("token")?.value ||
    "";
  const session = await getVerifiedSession();
  if (!token || !session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const upstreamPath = req.nextUrl.pathname.replace(/^\/bff/, "");
  if (!canForwardApiRequest(session.authorization, upstreamPath, req.method)) {
    return NextResponse.json({ error: "Esta acción no está habilitada para tu perfil." }, { status: 403 });
  }
  const headers = buildUpstreamHeaders(req, token);

  const init: RequestInit = {
    method: req.method,
    headers,
    body: ["GET", "HEAD"].includes(req.method) ? undefined : await req.arrayBuffer(),
    cache: "no-store",
    redirect: "manual",
  };



  try {
    const r = await fetchUpstream(up, init, req.signal);
    return new NextResponse(r.body, { status: r.status, headers: upstreamResponseHeaders(r) });
  } catch (error) {
    const status = getErrorStatus(error);
    return NextResponse.json(
      { error: status === 504 ? "El servicio tardó demasiado" : "Servicio no disponible" },
      { status }
    );
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
