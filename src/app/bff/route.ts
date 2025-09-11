// app/bff/route.ts
import "server-only";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const ORIGIN = (process.env.API_ORIGIN || "").replace(/\/$/, "");

function upstreamUrl(path: string, search: string) {
  const p = path.replace(/^\/+/, "");
  return `${ORIGIN}/${p}${search || ""}`;
}

async function proxy(req: NextRequest) {
  const up = upstreamUrl(req.nextUrl.pathname.replace(/^\/bff/, ""), req.nextUrl.search);
  if (!ORIGIN) {
    console.error("[/bff] API_ORIGIN vacío");
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

  console.log("[/bff] →", req.method, up);
  const r = await fetch(up, init).catch((e) => {
    console.error("[/bff] fetch error:", e);
    throw e;
  });
  const preview = (await r.clone().text()).slice(0, 400);
  console.log("[/bff] ←", r.status, r.statusText, "| body:", preview);

  return new NextResponse(await r.arrayBuffer(), {
    status: r.status,
    headers: {
      "content-type": r.headers.get("content-type") ?? "application/json",
      "cache-control": "no-store",
    },
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
