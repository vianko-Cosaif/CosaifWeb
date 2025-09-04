import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const loc = searchParams.get("localidadId");
    if (!loc) return NextResponse.json([], { status: 200 });

    const API = process.env.API_URL; 
    if (!API) return NextResponse.json([], { status: 200 });

    // si tu backend requiere JWT:
    const name = process.env.JWT_COOKIE_NAME || "token";
    const cookieStore = await cookies();
    const token = cookieStore.get(name)?.value;

    const url = `${API}/rondas/localidad/${loc}/estado/false`;
    const r = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: "no-store",
    });

    if (!r.ok) return NextResponse.json([], { status: 200 });
    const data = await r.json();
    return NextResponse.json(data);
  } catch (e) {
    console.error("[cliente/rondas] error:", e);
    return NextResponse.json([], { status: 200 });
  }
}
