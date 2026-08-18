import "server-only";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { normalizeHttpOrigin } from "@/lib/serverOrigin";
import { PERMISSIONS, hasPermission } from "@/lib/accessControl";
import { getVerifiedSession } from "@/lib/server/session";

export const dynamic = "force-dynamic";

const JWT = process.env.JWT_COOKIE_NAME ?? "token";
const ORIGIN = normalizeHttpOrigin(process.env.API_ORIGIN || process.env.API_URL);

async function fetchOne(id: string, token: string) {
  const url = `${ORIGIN}/movimientos/ronda/${encodeURIComponent(id)}/info`;
  const r = await fetch(url, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return null;
  const data = await r.json().catch(() => ({}));
  return [Number(id), data] as const;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const raw = searchParams.get("ids") ?? "";
    const ids = Array.from(new Set(raw.split(",").map(s => s.trim()).filter((id) => /^\d+$/.test(id)))).slice(0, 50);
    if (ids.length === 0) return NextResponse.json({});
    if (!ORIGIN) return NextResponse.json({ message: "API no configurada" }, { status: 503 });

    const c = await cookies(); // solo lectura en Next 15
    const token = c.get(JWT)?.value;
    const session = await getVerifiedSession();
    if (!token || !session) return NextResponse.json({ message: "No autorizado" }, { status: 401 });
    if (!hasPermission(session.authorization, PERMISSIONS.ROUNDS_READ)) {
      return NextResponse.json({ message: "No autorizado para consultar rondas" }, { status: 403 });
    }

    const results = await Promise.allSettled(ids.map(id => fetchOne(id, token)));
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
