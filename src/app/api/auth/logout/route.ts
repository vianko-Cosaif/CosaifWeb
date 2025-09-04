import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  // Usa el MISMO nombre, path y dominio que pusiste al crear la cookie en /api/auth/login
  res.cookies.set("auth", "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
