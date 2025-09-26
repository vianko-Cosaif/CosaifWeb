import "server-only";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const JWT = process.env.JWT_COOKIE_NAME ?? "token";

async function fetchOne(base: URL, id: string, token?: string) {
  const url = new URL(`/movimientos/ronda/${encodeURIComponent(id)}/info`, base);
  const r = await fetch(url, {
    cache: "no-store",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!r.ok) return null;
  const data = await r.json().catch(() => ({}));
  return [Number(id), data] as const;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const raw = searchParams.get("ids") ?? "";
    const ids = Array.from(new Set(raw.split(",").map(s => s.trim()).filter(Boolean)));
    if (ids.length === 0) return NextResponse.json({});

    const c = await cookies(); // solo lectura en Next 15
    const token = c.get(JWT)?.value;
    const base = new URL("/bff", req.url);

    const results = await Promise.allSettled(ids.map(id => fetchOne(base, id, token)));
    const out: Record<string, unknown> = {};
    for (const res of results) {
      if (res.status === "fulfilled" && res.value) {
        const [id, data] = res.value;
        out[String(id)] = data;
      }
    }
    return NextResponse.json(out);
  } catch (err) {
    console.error("[rondas-info] error:", err);
    return NextResponse.json({}, { status: 200 });
  }
}
