import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const JWT = process.env.JWT_COOKIE_NAME || "token";
const ROLE = process.env.ROLE_COOKIE_NAME || "role";
const MAX  = Number(process.env.COOKIE_MAX_AGE || 28800);

export async function POST(req: Request) {
  const { token, role } = await req.json().catch(() => ({}));
  if (!token || !role) {
    return NextResponse.json({ error: "bad_payload" }, { status: 400 });
  }
  const c = cookies();
  c.set(JWT, token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: MAX });
  c.set(ROLE, String(role).toUpperCase(), { httpOnly: true, sameSite: "lax", path: "/", maxAge: MAX });
  return NextResponse.json({ ok: true });
}
