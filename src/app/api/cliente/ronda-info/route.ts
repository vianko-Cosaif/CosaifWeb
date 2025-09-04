// app/api/cliente/ronda-info/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(req: Request) {
  const API = process.env.API_URL!;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({}, { status: 200 });

  const name = process.env.JWT_COOKIE_NAME || "token";
  const token = (await cookies()).get(name)?.value;

  const r = await fetch(`${API}/movimientos/ronda/${id}/info`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: "no-store",
  });

  if (!r.ok) return NextResponse.json({}, { status: 200 });
  return NextResponse.json(await r.json());
}
