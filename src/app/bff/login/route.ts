import "server-only";
import { NextResponse } from "next/server";

const ORIGIN = (process.env.API_ORIGIN || "").replace(/\/$/, "");
const BFF_TIMEOUT_MS = Number(process.env.BFF_TIMEOUT_MS || 12000);

function getErrorStatus(error: unknown): 502 | 504 {
  const code = (error as { code?: string })?.code;
  const name = (error as { name?: string })?.name;
  if (code === "UND_ERR_HEADERS_TIMEOUT" || name === "AbortError") return 504;
  return 502;
}

export async function GET() {
  console.log("[BFF] GET /bff/login");
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  if (!ORIGIN) {
    return NextResponse.json({ error: "API_ORIGIN not set" }, { status: 500 });
  }

  console.log("[BFF] POST /bff/login ->", ORIGIN);
  const body = await req.text();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), BFF_TIMEOUT_MS);

  try {
    const r = await fetch(`${ORIGIN}/usuarios/login`, {
      method: "POST",
      headers: { "content-type": req.headers.get("content-type") ?? "application/json" },
      body,
      cache: "no-store",
      signal: controller.signal,
    });

    const text = await r.text();
    // evita filtrar la URL real en errores
    return new NextResponse(text, {
      status: r.status,
      headers: { "content-type": r.headers.get("content-type") ?? "application/json" },
    });
  } catch (error) {
    const status = getErrorStatus(error);
    console.error("[BFF] /bff/login fetch error:", error);
    return NextResponse.json(
      { error: status === 504 ? "Upstream timeout" : "Upstream unavailable" },
      { status }
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
