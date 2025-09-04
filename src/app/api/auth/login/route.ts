import { NextResponse } from "next/server";

const NAME = process.env.JWT_COOKIE_NAME ?? "token";
const ROLE = process.env.ROLE_COOKIE_NAME ?? "role";
const MAX_AGE = 60 * 60 * 24 * 7;

export async function POST(req: Request) {
  console.log("[api/auth/login] POST hit");
  try {
    const { token, role } = await req.json();

    if (!token || typeof token !== "string") {
      console.warn("[api/auth/login] missing token");
      return NextResponse.json({ error: "missing token" }, { status: 400 });
    }

    const res = NextResponse.json({ ok: true });

    res.cookies.set(NAME, token, {
      httpOnly: true, 
      sameSite: "lax",
      secure: process.env.NODE_ENV !== "development",
      path: "/",
      maxAge: MAX_AGE,
    });

    const roleUp = role ? String(role).toUpperCase() : undefined;
    if (roleUp) {
      res.cookies.set(ROLE, roleUp, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV !== "development",
        path: "/",
        maxAge: MAX_AGE,
      });
    }

    console.log("[api/auth/login] cookie set ✓", {
      role: roleUp,
      at: new Date().toISOString(),
    });

    return res;
  } catch (e) {
    console.error("[api/auth/login] bad payload", e);
    return NextResponse.json({ error: "bad payload" }, { status: 400 });
  }
}
