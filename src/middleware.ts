import { NextRequest, NextResponse } from "next/server";
// home por rol
const HOME: Record<string, string> = {
  CLIENTE: "/cliente",
  SUPERVISOR: "/supervisor",
  MAQUINISTA: "/maquinista",
  OPERADOR: "/operador",
  ADMINISTRADOR: "/admin",
  COORDINADOR: "/coordinador",
};
// reglas por ruta
const RULES: [RegExp, string[]][] = [
  [/^\/cliente(\/|$)/i, ["CLIENTE"]],
  [/^\/supervisor(\/|$)/i, ["SUPERVISOR"]],
  [/^\/administrador(\/|$)/i, ["ADMINISTRADOR"]],
  [/^\/coordinador(\/|$)/i, ["COORDINADOR"]],
];

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // público
  if (
    pathname === "/login" ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  ) return NextResponse.next();

  // requiere sesión
  const token = req.cookies.get("token")?.value;
  const role  = req.cookies.get("role")?.value?.toUpperCase() || "";
  if (!token) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }

  // autorización por rol
  for (const [re, roles] of RULES) {
    if (re.test(pathname) && !roles.includes(role)) {
      const url = new URL(HOME[role] ?? "/login", req.url);
      return NextResponse.redirect(url);
    }
  }

  if (pathname === "/") {
    const url = new URL(HOME[role] ?? "/cliente", req.url);
    return NextResponse.redirect(url);

  }if(pathname === "/"){
    const url = new URL (HOME [role] ?? "/supervisor", req.url);
    return NextResponse.redirect (url);
  }if(pathname === "/"){
    const url = new URL (HOME [role] ?? "/administrador", req.url);
    return NextResponse.redirect (url);

  } if (pathname === "/") { 
    const url = new  URL  (HOME [role] ?? "/coordinador", req.url);
    return NextResponse.redirect (url);
  } 
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|bff|_next|.*\\.(?:png|jpg|jpeg|gif|svg|ico|css|js|map|txt)).*)"],
};
