import "server-only";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const ORIGIN = (process.env.API_ORIGIN || "").replace(/\/$/, "");
const BFF_TIMEOUT_MS = Number(process.env.BFF_TIMEOUT_MS || 12000);

function getErrorStatus(error: unknown): 502 | 504 {
  const code = (error as { code?: string })?.code;
  const name = (error as { name?: string })?.name;
  if (code === "UND_ERR_HEADERS_TIMEOUT" || name === "AbortError") return 504;
  return 502;
}

function upstreamUrl(path: string, search: string) {
  const p = path.replace(/^\/+/, "");
  return `${ORIGIN}/${p}${search || ""}`;
}

async function proxy(req: NextRequest) {
  if (!ORIGIN) {
    return NextResponse.json({ error: "API_ORIGIN not set" }, { status: 500 });
  }

  // 1) Construir URL hacia el backend
  const url = upstreamUrl(
    req.nextUrl.pathname.replace(/^\/bff/, ""),
    req.nextUrl.search
  );

  // 2) Leer cookies **DENTRO** del handler y con await
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value || "";

  // 3) Copiar headers y meter Authorization
  const headers = new Headers(req.headers);
  headers.set("host", new URL(ORIGIN).host);
  headers.set("origin", ORIGIN);
  headers.set("referer", ORIGIN);
  headers.set("authorization", token ? `Bearer ${token}` : "");
  headers.delete("cookie"); // no reenvíes cookies internas

  const init: RequestInit = {
    method: req.method,
    headers,
    body: ["GET", "HEAD"].includes(req.method)
      ? undefined
      : await req.arrayBuffer(),
    cache: "no-store",
    redirect: "manual",
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), BFF_TIMEOUT_MS);

  try {
    const r = await fetch(url, { ...init, signal: controller.signal });
    const body = await r.arrayBuffer();

    return new NextResponse(body, {
      status: r.status,
      headers: {
        "content-type": r.headers.get("content-type") ?? "application/json",
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    const status = getErrorStatus(error);
    console.error("[/bff/*] fetch error:", error);
    return NextResponse.json(
      { error: status === 504 ? "Upstream timeout" : "Upstream unavailable" },
      { status }
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

// Handlers HTTP
export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
