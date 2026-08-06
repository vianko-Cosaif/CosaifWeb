import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { evaluateRoute } from "@/lib/routePolicy";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/sessionToken";

async function verify(req: NextRequest) {
  return verifySessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value);
}

function contextMatches(req: NextRequest, session: NonNullable<Awaited<ReturnType<typeof verify>>>) {
  const roleCookie = String(req.cookies.get(process.env.ROLE_COOKIE_NAME || "role")?.value || "").toUpperCase();
  if (roleCookie !== session.role) return false;
  const checks: Array<[string, number | null]> = [
    ["userId", session.userId],
    ["empresaId", session.empresaId],
    ["locId", session.localidadId],
  ];
  return checks.every(([name, expected]) => expected == null || Number(req.cookies.get(name)?.value) === expected);
}

function isCrossSiteMutation(req: NextRequest) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return false;
  if (req.headers.get("sec-fetch-site")?.toLowerCase() === "cross-site") return true;
  const origin = req.headers.get("origin");
  if (!origin) return false;
  const forwardedHost = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "").split(",")[0].trim();
  const forwardedProto = (req.headers.get("x-forwarded-proto") || req.nextUrl.protocol.replace(":", "")).split(",")[0].trim();
  try {
    const allowed = new Set([req.nextUrl.origin]);
    if (forwardedHost) allowed.add(new URL(`${forwardedProto}://${forwardedHost}`).origin);
    return !allowed.has(new URL(origin).origin);
  } catch {
    return true;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const isProtectedTransport =
    pathname.startsWith("/api/") ||
    pathname === "/bff" ||
    pathname.startsWith("/bff/") ||
    pathname.startsWith("/xapi/");

  if (
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    (!isProtectedTransport && /\.[^/]+$/.test(pathname))
  ) return NextResponse.next();

  const session = await verify(req);
  const isOpenSessionRoute =
    pathname === "/bff/login" ||
    pathname === "/api/auth/login" ||
    pathname === "/api/auth/logout";

  if (isProtectedTransport) {
    if (isCrossSiteMutation(req)) {
      return NextResponse.json({ error: "Origen no permitido" }, { status: 403, headers: { "Cache-Control": "no-store" } });
    }
    if (isOpenSessionRoute) return NextResponse.next();
    if (!session) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401, headers: { "Cache-Control": "no-store" } });
    }
    if (!contextMatches(req, session)) {
      return NextResponse.json({ error: "Contexto de sesión inválido" }, { status: 403, headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.next();
  }

  const evaluation = evaluateRoute({
    pathname,
    search,
    isAuthenticated: Boolean(session),
    role: session?.role,
  });

  if (!evaluation.allow && evaluation.redirectTo) {
    return NextResponse.redirect(new URL(evaluation.redirectTo, req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|robots.txt|sitemap.xml|sw.js|offline.html).*)"],
};
