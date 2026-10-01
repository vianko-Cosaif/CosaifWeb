// app/bff/route.ts
import "server-only";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { normalizeHttpOrigin } from "@/lib/serverOrigin";

const ORIGIN = normalizeHttpOrigin(process.env.API_ORIGIN);
const BFF_TIMEOUT_MS = Number(process.env.BFF_TIMEOUT_MS || 12000);

function upstreamUrl(path: string, search: string) {
  const p = path.replace(/^\/+/, "");
  return `${ORIGIN}/${p}${search || ""}`;
}

function getErrorStatus(error: unknown): 502 | 504 {
  const code = (error as { code?: string })?.code;
  const name = (error as { name?: string })?.name;
  if (code === "UND_ERR_HEADERS_TIMEOUT" || name === "AbortError") return 504;
  return 502;
}

async function proxy(req: NextRequest) {
  const up = upstreamUrl(req.nextUrl.pathname.replace(/^\/bff/, ""), req.nextUrl.search);
  if (!ORIGIN) {
    console.error("[/bff] API_ORIGIN vacio");
    return NextResponse.json({ error: "API_ORIGIN not set" }, { status: 500 });
  }

  const token = (await cookies()).get("token")?.value || "";
  const headers = new Headers(req.headers);
  headers.set("host", new URL(ORIGIN).host);
  headers.set("origin", ORIGIN);
  headers.set("referer", ORIGIN);
  if (token) headers.set("authorization", `Bearer ${token}`);
  headers.delete("cookie");

  const init: RequestInit = {
    method: req.method,
    headers,
    body: ["GET", "HEAD"].includes(req.method) ? undefined : await req.arrayBuffer(),
    cache: "no-store",
    redirect: "manual",
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), BFF_TIMEOUT_MS);

  try {
    const r = await fetch(up, { ...init, signal: controller.signal });
    return new NextResponse(await r.arrayBuffer(), {
      status: r.status,
      headers: {
        "content-type": r.headers.get("content-type") ?? "application/json",
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    const status = getErrorStatus(error);
    console.error("[/bff] fetch error:", error);
    return NextResponse.json(
      { error: status === 504 ? "Upstream timeout" : "Upstream unavailable" },
      { status }
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
