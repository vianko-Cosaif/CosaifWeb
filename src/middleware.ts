import { type NextRequest, NextResponse } from "next/server";
import { evaluateRoute } from "@/lib/routePolicy";

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // público
  if (
    pathname === "/login" ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/offline.html" ||
    pathname === "/sw.js"
  ) return NextResponse.next();

  const token = req.cookies.get("token")?.value;
  const role = req.cookies.get("role")?.value?.toUpperCase() || "";
  const evaluation = evaluateRoute({
    pathname,
    search,
    isAuthenticated: Boolean(token),
    role,
  });

  if (!evaluation.allow && evaluation.redirectTo) {
    return NextResponse.redirect(new URL(evaluation.redirectTo, req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|bff|_next|manifest.webmanifest|offline.html|sw.js|.*\\.(?:png|jpg|jpeg|gif|svg|ico|css|js|map|txt|webmanifest)).*)"],
};
