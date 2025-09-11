// app/api/cliente/rondas/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

type Ronda = { id: number; rondaNumero: number; orden: number; concluido: boolean };

function normalize(input: any): Ronda[] {
  const src = Array.isArray(input) ? input : Array.isArray(input?.data) ? input.data : Array.isArray(input?.rows) ? input.rows : [];
  const out = src
    .map((x: any): Ronda => ({
      id: Number(x.id ?? x.rondaId ?? x.ronda?.id),
      rondaNumero: Number(x.rondaNumero ?? x.numero ?? x.num ?? x.ronda?.numero ?? 0),
      orden: Number(x.orden ?? x.order ?? 0),
      concluido: Boolean(
        x.concluido ?? x.finalizado ?? x.terminado ??
        (typeof x.estado === "string" ? x.estado.toUpperCase() === "CONCLUIDO" : x.estado === true)
      ),
    }))
    .filter((r) => Number.isFinite(r.id));
  return out;
}

export async function GET(req: Request) {
  try {
    const { searchParams, origin } = new URL(req.url);
    const loc = searchParams.get("localidadId");
    console.log("[/api/cliente/rondas] incoming", { loc, url: req.url });

    if (!loc) return NextResponse.json([], { status: 200 });

    const base = process.env.NEXT_PUBLIC_API_URL || `${origin}/bff`;
    const urls = [
      `${base}/rondas/localidad/${encodeURIComponent(loc)}/estado/false`,
      `${base}/rondas?localidadId=${encodeURIComponent(loc)}&concluido=false`,
      `${base}/movimientos/rondas?localidadId=${encodeURIComponent(loc)}&concluido=false`,
    ];

    const token = cookies().get(process.env.JWT_COOKIE_NAME ?? "token")?.value;

    let raw: any = [];
    for (const u of urls) {
      console.log("[/api/cliente/rondas] → fetch", u);
      const r = await fetch(u, {
        cache: "no-store",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const text = await r.text();
      console.log("[/api/cliente/rondas] status", r.status, r.statusText);
      console.log("[/api/cliente/rondas] bodyPreview", text.slice(0, 800));
      if (!r.ok) continue;
      try { raw = JSON.parse(text); } catch (e) { console.warn("[/api/cliente/rondas] JSON parse fail", e); raw = []; }
      break;
    }

    const out = normalize(raw);
    console.log("[/api/cliente/rondas] normalized", { count: out.length, first: out[0] });
    return NextResponse.json(out, { status: 200 });
  } catch (e) {
    console.error("[/api/cliente/rondas] error:", e);
    return NextResponse.json([], { status: 200 });
  }
}
