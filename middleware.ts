import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { jwtVerify } from "jose";

const JWT_COOKIE = process.env.JWT_COOKIE_NAME || "token";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

const AREAS: Record<string, RegExp> = {
  CLIENTE: /^\/cliente(\/|$)/,
  ADMINISTRADOR: /^\/administrador(\/|$)/,
  COORDINADOR: /^\/coordinador(\/|$)/,
  SUPERVISOR: /^\/supervisor(\/|$)/,
};
const HOME: Record<string, string> = {
  CLIENTE: "/cliente",
  ADMINISTRADOR: "/administrador",
  COORDINADOR: "/coordinador",
  SUPERVISOR: "/supervisor",
};

// Bloqueados siempre
const DENY_ROLES = new Set(["MAQUINISTA", "OPERADOR", "SUPERVISOR"]);

function sanitizeNext(n?: string) {
  if (!n) return "";
  try {
    if (n.startsWith("/") && !n.startsWith("//")) return `?next=${encodeURIComponent(n)}`;
  } catch {}
  return "";
}

async function verify(req: NextRequest) {
  const raw = req.cookies.get(JWT_COOKIE)?.value;
  if (!raw) return null;
  try {
    const { payload } = await jwtVerify(raw, JWT_SECRET);
    const role = String(payload.role || payload.rol || "").toUpperCase();
    if (!role) return null;
    return { role, payload };
  } catch {
    return null;
  }
}

function deny(req: NextRequest) {
  const res = NextResponse.rewrite(new URL("/404", req.url));
  // invalidar cookie
  res.cookies.set(JWT_COOKIE, "", {
    httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: 0,
  });
  return res;
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Assets/APIs
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/xapi") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    /\.[^/]+$/.test(pathname)
  ) return NextResponse.next();

  // Público: raíz, login y 404
  if (pathname === "/" || pathname === "/login" || pathname === "/404") {
    const session = await verify(req);
    if (session?.role && DENY_ROLES.has(session.role)) return deny(req);

    if (pathname === "/login" && session?.role) {
      const u = req.nextUrl.clone();
      u.pathname = HOME[session.role] ?? "/cliente";
      u.search = search;
      return NextResponse.redirect(u);
    }
    return NextResponse.next();
  }

  // Todo lo demás requiere token válido
  const session = await verify(req);
  if (!session) {
    const u = req.nextUrl.clone();
    u.pathname = "/login";
    u.search = sanitizeNext(pathname + search);
    return NextResponse.redirect(u);
  }

  // Si el rol está bloqueado, negar siempre
  if (DENY_ROLES.has(session.role)) return deny(req);

  // Evita cruzar de área
  const isInAnyArea = Object.values(AREAS).some((rx) => rx.test(pathname));
  const okHere = AREAS[session.role]?.test(pathname) ?? false;
  if (isInAnyArea && !okHere) {
    const u = req.nextUrl.clone();
    u.pathname = HOME[session.role] ?? "/login";
    u.search = "";
    return NextResponse.redirect(u);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|api|xapi).*)"],
};
