import "server-only";
import { NextResponse } from "next/server";
import { normalizeHttpOrigin } from "@/lib/serverOrigin";

const ORIGIN = normalizeHttpOrigin(process.env.API_ORIGIN);
const FCM_TIMEOUT_MS = Number(process.env.BFF_TIMEOUT_MS || 12000);

function toPositiveInt(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

function getErrorStatus(error: unknown): 502 | 504 {
  const code = (error as { code?: string })?.code;
  const name = (error as { name?: string })?.name;
  if (code === "UND_ERR_HEADERS_TIMEOUT" || name === "AbortError") return 504;
  return 502;
}

export async function POST(req: Request) {
  if (!ORIGIN) {
    return NextResponse.json({ error: "API_ORIGIN not set" }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const token = String(body?.token ?? "").trim();
  const accessToken = String(body?.accessToken ?? "").trim();
  const localidadId = toPositiveInt(body?.localidadId);

  if (!token || !accessToken) {
    return NextResponse.json({ error: "token y accessToken son requeridos" }, { status: 400 });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FCM_TIMEOUT_MS);

  try {
    const upstream = await fetch(`${ORIGIN}/fcm`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        token,
        ...(localidadId ? { localidadId } : {}),
      }),
      cache: "no-store",
      signal: controller.signal,
    });

    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "application/json",
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    const status = getErrorStatus(error);
    console.error("[api/fcm/register] fetch error:", error);
    return NextResponse.json(
      { error: status === 504 ? "Upstream timeout" : "Upstream unavailable" },
      { status }
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
