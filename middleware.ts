import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { evaluateRoute } from "@/lib/routePolicy";

const JWT_COOKIE = process.env.JWT_COOKIE_NAME || "token";
const ROLE_COOKIE = process.env.ROLE_COOKIE_NAME || "role";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

async function verify(req: NextRequest) {
  const raw = req.cookies.get(JWT_COOKIE)?.value;
  if (!raw) return null;
  try {
    const { payload } = await jwtVerify(raw, JWT_SECRET);
    const role = String(payload.role || payload.rol || req.cookies.get(ROLE_COOKIE)?.value || "").toUpperCase();
    if (!role) return null;
    return { role, payload };
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Assets/APIs
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/bff") ||
    pathname.startsWith("/xapi") ||
    pathname === "/favicon.ico" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    /\.[^/]+$/.test(pathname)
  ) return NextResponse.next();

  const session = await verify(req);
  const evaluation = evaluateRoute({
    pathname,
    search,
    isAuthenticated: Boolean(session),
    role: session?.role,
  });

  if (!evaluation.allow && evaluation.redirectTo) {
    const u = new URL(evaluation.redirectTo, req.url);
    return NextResponse.redirect(u);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|robots.txt|sitemap.xml|api|bff|xapi).*)"],
};
