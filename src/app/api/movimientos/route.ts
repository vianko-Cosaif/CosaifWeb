import "server-only";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { containsTrainingReservedId } from "@/lib/routePolicy";

const API_URL = process.env.API_URL!;
const JWT_COOKIE_NAME = process.env.JWT_COOKIE_NAME ?? "token";

export async function POST(req: Request) {
  try {
    const c = await cookies(); // solo lectura en Next 15
    const token = c.get(JWT_COOKIE_NAME)?.value;
    if (!token) {
      return NextResponse.json({ message: "No autenticado" }, { status: 401 });
    }

    const payload: unknown = await req.json().catch(() => null);
    if (payload == null) {
      return NextResponse.json({ message: "Payload inválido" }, { status: 400 });
    }
    if (containsTrainingReservedId(payload)) {
      return NextResponse.json(
        { message: "Los datos SIM de capacitación no se envían al sistema productivo." },
        { status: 409 },
      );
    }

    const r = await fetch(`${API_URL}/movimientos`, {
      method: "POST",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const text = await r.text();
    const isJSON = (r.headers.get("content-type") || "").includes("application/json");
    const data: unknown = text ? (isJSON ? JSON.parse(text) : { message: text }) : null;

    return NextResponse.json(data ?? {}, { status: r.status });
  } catch {
    return NextResponse.json(
      { message: "Fallo al contactar el API externo" },
      { status: 502 }
    );
  }
}
