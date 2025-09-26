// src/app/cliente/rondas/route.ts
import "server-only";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

type RondaBase = { id: number; rondaNumero: number; orden: number; concluido: boolean };
type RondaOut = RondaBase & {
  empresa?: { id: number; nombre: string } | null;
  movimiento?: {
    id?: number;
    viaOrigen?: { nombre?: string | null } | null;
    viaDestino?: { nombre?: string | null } | null;
    lavado?: boolean;
    torno?: boolean;
    estado?: string | null;
    prioridad?: "BAJA" | "ALTA" | null;
    locomotiveNumber?: number | string | null;
    locomotora?: string | null;
  } | null;
  movimientoId?: number | null;
};

function normalize(input: unknown): RondaBase[] {
  const anyInput = input as any;
  const src: unknown[] = Array.isArray(input)
    ? (input as unknown[])
    : Array.isArray(anyInput?.data)
    ? (anyInput.data as unknown[])
    : Array.isArray(anyInput?.rows)
    ? (anyInput.rows as unknown[])
    : [];

  const mapped: RondaBase[] = (src as unknown[]).map((x: any): RondaBase => ({
    id: Number(x.id ?? x.rondaId ?? x.ronda?.id),
    rondaNumero: Number(x.rondaNumero ?? x.numero ?? x.num ?? x.ronda?.numero ?? 0),
    orden: Number(x.orden ?? x.order ?? 0),
    concluido: Boolean(
      x.concluido ??
        x.finalizado ??
        x.terminado ??
        (typeof x.estado === "string" ? x.estado.toUpperCase() === "CONCLUIDO" : x.estado === true)
    ),
  }));

  return mapped.filter((r: RondaBase) => Number.isFinite(r.id));
}

async function readTextAsJsonSafe(r: Response): Promise<unknown> {
  const t = await r.text();
  try {
    return JSON.parse(t);
  } catch {
    return t ? { message: t } : {};
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams, origin } = new URL(req.url);
    const loc = searchParams.get("localidadId");
    if (!loc) return NextResponse.json<RondaOut[]>([], { status: 200 });

    const c = await cookies();
    const token = c.get(process.env.JWT_COOKIE_NAME ?? "token")?.value ?? "";
    const empresaId = Number(c.get("empresaId")?.value) || null;

    const base = process.env.NEXT_PUBLIC_API_URL || `${origin}/bff`;
    const candidates = [
      `${base}/rondas/localidad/${encodeURIComponent(loc)}/estado/false`,
      `${base}/rondas?localidadId=${encodeURIComponent(loc)}&concluido=false`,
      `${base}/movimientos/rondas?localidadId=${encodeURIComponent(loc)}&concluido=false`,
    ];

    // 1) Lista base
    let raw: unknown = [];
    for (const u of candidates) {
      const r = await fetch(u, {
        cache: "no-store",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!r.ok) continue;
      raw = await readTextAsJsonSafe(r);
      break;
    }
    const baseList = normalize(raw);
    if (baseList.length === 0) return NextResponse.json<RondaOut[]>([], { status: 200 });

    // 2) Enriquecer con info por ronda
    const infoPairs = await Promise.all(
      baseList.map(async (r) => {
        try {
          const rr = await fetch(`${base}/movimientos/ronda/${r.id}/info`, {
            cache: "no-store",
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          });
          if (!rr.ok) return [r.id, null] as const;
          const info = (await readTextAsJsonSafe(rr)) as any;
          return [r.id, info] as const;
        } catch {
          return [r.id, null] as const;
        }
      })
    );
    const infoMap = new Map<number, any>(infoPairs);

    let out: RondaOut[] = baseList.map((r) => {
      const inf = infoMap.get(r.id);
      const mv = inf?.movimiento ?? null;
      const emp = inf?.empresa ?? null;
      return {
        ...r,
        empresa: emp ? { id: Number(emp.id ?? 0), nombre: String(emp.nombre ?? "—") } : null,
        movimiento: mv
          ? {
              id: mv.id,
              viaOrigen: mv.viaOrigen ?? null,
              viaDestino: mv.viaDestino ?? null,
              lavado: Boolean(mv.lavado),
              torno: Boolean(mv.torno),
              estado: mv.estado ?? null,
              prioridad: mv.prioridad ?? null,
              locomotiveNumber: mv.locomotiveNumber ?? mv.locomotora ?? null,
              locomotora: mv.locomotora ?? null,
            }
          : null,
        movimientoId: inf?.movimientoId ?? mv?.id ?? null,
      };
    });

    // 3) Filtro por empresa del usuario si existe
    if (empresaId) out = out.filter((r) => r.empresa?.id === empresaId);

    // 4) Orden estable
    out.sort((a, b) => a.rondaNumero - b.rondaNumero || a.orden - b.orden || a.id - b.id);

    return NextResponse.json<RondaOut[]>(out, { status: 200 });
  } catch (e) {
    console.error("[/api/cliente/rondas] GET error:", e);
    return NextResponse.json<RondaOut[]>([], { status: 200 });
  }
}

export async function POST(req: Request) {
  try {
    const { origin } = new URL(req.url);
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "").toLowerCase();

    const c = await cookies();
    const token = c.get(process.env.JWT_COOKIE_NAME ?? "token")?.value ?? "";
    const base = process.env.NEXT_PUBLIC_API_URL || `${origin}/bff`;

    if (action === "swap") {
      const rondaAId = Number(body?.rondaAId);
      const rondaBId = Number(body?.rondaBId);
      if (!Number.isFinite(rondaAId) || !Number.isFinite(rondaBId)) {
        return NextResponse.json({ message: "Faltan rondaAId y rondaBId numéricos" }, { status: 400 });
      }
      const r = await fetch(`${base}/rondas/intercambiar-movimientos`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ rondaAId, rondaBId }),
      });
      const data = await readTextAsJsonSafe(r);
      return NextResponse.json(data, { status: r.ok ? 200 : r.status });
    }

    if (action === "orden") {
      const id = Number(body?.id);
      const orden = Number(body?.orden);
      if (!Number.isFinite(id) || !Number.isFinite(orden)) {
        return NextResponse.json({ message: "Faltan id y orden:number" }, { status: 400 });
      }
      const r = await fetch(`${base}/rondas/${id}/orden`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ orden }),
      });
      const data = await readTextAsJsonSafe(r);
      return NextResponse.json(data, { status: r.ok ? 200 : r.status });
    }

    return NextResponse.json({ message: "Acción no soportada" }, { status: 400 });
  } catch (e) {
    console.error("[/api/cliente/rondas] POST error:", e);
    return NextResponse.json({ message: "Error inesperado" }, { status: 500 });
  }
}
