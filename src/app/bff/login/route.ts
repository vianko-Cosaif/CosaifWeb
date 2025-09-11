import "server-only";
import { NextResponse } from "next/server";

const ORIGIN = (process.env.API_ORIGIN || "").replace(/\/$/, "");

export async function GET() {
  console.log("[BFF] GET /bff/login");
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  console.log("[BFF] POST /bff/login ->", ORIGIN);
  const body = await req.text();
  const r = await fetch(`${ORIGIN}/usuarios/login`, {
    method: "POST",
    headers: { "content-type": req.headers.get("content-type") ?? "application/json" },
    body,
  });

  const text = await r.text();
  // evita filtrar la URL real en errores
  return new NextResponse(text, {
    status: r.status,
    headers: { "content-type": r.headers.get("content-type") ?? "application/json" },
  });
}
