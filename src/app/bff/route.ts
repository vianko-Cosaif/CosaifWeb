// app/bff/route.ts
import "server-only";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { normalizeHttpOrigin } from "@/lib/serverOrigin";
import { getVerifiedSession } from "@/lib/server/session";
import { rejectCrossSiteMutation } from "@/lib/server/requestSecurity";

const ORIGIN = normalizeHttpOrigin(process.env.API_ORIGIN);
const BFF_TIMEOUT_MS = Number(process.env.BFF_TIMEOUT_MS || 12000);

function upstreamUrl(path: string, search: string) {
  const p = path.replace(/^\/+/, "");
  return `${ORIGIN}/${p}${search || ""}`;
}

function getErrorStatus(error: unknown): 502 | 504 {
  const code = (error as { code?: string })?.code;
  const name = (error as { name?: string })?.name;
  if (code === "UND_ERR_HEADERS_TIMEOUT" || name === "AbortError") return 504;
  return 502;
}

function buildUpstreamHeaders(req: NextRequest, token: string) {
  const headers = new Headers();
  const accept = req.headers.get("accept");
  const contentType = req.headers.get("content-type");
  const userAgent = req.headers.get("user-agent");
  const forwardedFor = req.headers.get("x-forwarded-for");
  const forwardedProto = req.headers.get("x-forwarded-proto");

  if (accept) headers.set("accept", accept);
  if (contentType) headers.set("content-type", contentType);
  if (userAgent) headers.set("user-agent", userAgent);
  if (forwardedFor) headers.set("x-forwarded-for", forwardedFor);
  if (forwardedProto) headers.set("x-forwarded-proto", forwardedProto);

  if (token) headers.set("authorization", `Bearer ${token}`);

  return headers;
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
  const headers = buildUpstreamHeaders(req, token);

  const init: RequestInit = {
    method: req.method,
    headers,
    body: ["GET", "HEAD"].includes(req.method) ? undefined : await req.arrayBuffer(),
    cache: "no-store",
    redirect: "manual",
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), BFF_TIMEOUT_MS);

  try {
    const r = await fetch(up, { ...init, signal: controller.signal });
    return new NextResponse(await r.arrayBuffer(), {
      status: r.status,
      headers: {
        "content-type": r.headers.get("content-type") ?? "application/json",
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    const status = getErrorStatus(error);
    return NextResponse.json(
      { error: status === 504 ? "Upstream timeout" : "Upstream unavailable" },
      { status }
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
