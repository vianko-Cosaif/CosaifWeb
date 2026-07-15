import "server-only";
import { NextResponse } from "next/server";

const JWT  = process.env.JWT_COOKIE_NAME  ?? "token";
const ROLE = process.env.ROLE_COOKIE_NAME ?? "role";
const MAX  = Number(process.env.COOKIE_MAX_AGE ?? 60 * 60 * 8); // 8h

export async function POST(req: Request) {
  const { token, role, locId } = await req.json().catch(() => ({}));
  if (!token || !role) {
    return NextResponse.json({ error: "bad_payload" }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true });

  const base = {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: MAX,
    secure: process.env.NODE_ENV === "production",
  };

  res.cookies.set(JWT, String(token), base);
  res.cookies.set(ROLE, String(role).toUpperCase(), base);

  const localidadId = Number(locId);
  if (Number.isFinite(localidadId) && localidadId > 0) {
    res.cookies.set("locId", String(Math.trunc(localidadId)), {
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      secure: process.env.NODE_ENV === "production",
    });
  }

  return res;
}
