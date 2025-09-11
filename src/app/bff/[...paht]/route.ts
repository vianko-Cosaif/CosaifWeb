import "server-only";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const ORIGIN = (process.env.API_ORIGIN || "").replace(/\/$/, "");

function upstreamUrl(path: string, search: string) {
  const p = path.replace(/^\/+/, "");
  return `${ORIGIN}/${p}${search || ""}`;
}

async function proxy(req: NextRequest) {
  const url = upstreamUrl(req.nextUrl.pathname.replace(/^\/bff/, ""), req.nextUrl.search);
  const token = (await cookies()).get("token")?.value || "";
  const headers = new Headers(req.headers);
  headers.set("host", new URL(ORIGIN).host);
  headers.set("origin", ORIGIN);
  headers.set("referer", ORIGIN);
  headers.set("authorization", token ? `Bearer ${token}` : "");
  headers.delete("cookie"); // no reenvíes cookies internas

  const init: RequestInit = {
    method: req.method,
    headers,
    body: ["GET", "HEAD"].includes(req.method) ? undefined : await req.arrayBuffer(),
    // evita caché del framework
    cache: "no-store",
    redirect: "manual",
  };

  const r = await fetch(url, init);
  const body = await r.arrayBuffer();
  const resp = new NextResponse(body, {
    status: r.status,
    headers: {
      "content-type": r.headers.get("content-type") ?? "application/json",
      "cache-control": "no-store",
    },
  });
  return resp;
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
