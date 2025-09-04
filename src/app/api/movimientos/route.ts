import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_URL = process.env.API_URL!;
const JWT_COOKIE_NAME = process.env.JWT_COOKIE_NAME || "token";

export async function POST(req: Request) {
  try {
    const token = cookies().get(JWT_COOKIE_NAME)?.value;
    if (!token) {
      return NextResponse.json({ message: "No autenticado" }, { status: 401 });
    }

    const payload = await req.json();

    const r = await fetch(`${API_URL}/movimientos`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const text = await r.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { message: text };
    }

    return NextResponse.json(data ?? {}, { status: r.status });
  } catch (e: any) {
    return NextResponse.json(
      { message: "Fallo al contactar el API externo" },
      { status: 502 }
    );
  }
}
