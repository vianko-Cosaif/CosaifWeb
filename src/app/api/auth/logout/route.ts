import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/sessionToken";

const JWT = process.env.JWT_COOKIE_NAME ?? "token";
const ROLE = process.env.ROLE_COOKIE_NAME ?? "role";

export async function POST() {
  const res = NextResponse.json({ ok: true });

  for (const name of [SESSION_COOKIE_NAME, JWT, ROLE]) {
    res.cookies.set(name, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 0,
      expires: new Date(0),
    });
  }

  for (const name of ["locId", "empresaId", "userId"]) {
    res.cookies.set(name, "", {
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 0,
      expires: new Date(0),
    });
  }

  res.headers.set("Cache-Control", "no-store");
  return res;
}
