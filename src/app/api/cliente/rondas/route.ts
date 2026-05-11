// app/api/cliente/rondas/route.ts
import { NextResponse, NextRequest } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

type RondaOut = {
  id: number;
  rondaNumero: number;
  orden: number;
  concluido: boolean;
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
    fechaSolicitud?: string | null;
    fechaInicio?: string | null;
    fechaFin?: string | null;
    instrucciones?: string | null;
  } | null;
  movimientoId?: number | null;
  createdAt?: string | null;
};

type TornoServiceRecord = {
  servicioId?: number | string | null;
  rondaServicioId?: number | string | null;
  movimientoId?: number | string | null;
  status?: string | null;
  historialStatus?: string | null;
  inicio?: string | null;
  fin?: string | null;
  creadoEn?: string | null;
  actualizadoEn?: string | null;
};

type MovimientoRecord = {
  id?: number;
  empresa?: { id?: number; nombre?: string } | null;
  localidadId?: number | null;
  localidad?: { id?: number; nombre?: string } | null;
  viaOrigen?: { nombre?: string | null } | null;
  viaDestino?: { nombre?: string | null } | null;
  lavado?: boolean | null;
  Lavado?: boolean | null;
  torno?: boolean | null;
  estado?: string | null;
  prioridad?: "BAJA" | "ALTA" | null;
  locomotiveNumber?: number | string | null;
  locomotora?: string | null;
  fechaSolicitud?: string | null;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  createdAt?: string | null;
  instrucciones?: string | null;
};

function getApiBase(origin: string) {
  return (process.env.API_ORIGIN || process.env.NEXT_PUBLIC_API_URL || `${origin}/bff`).replace(/\/$/, "");
}

function extractArray(input: unknown): any[] {
  const anyInput = input as any;
  if (Array.isArray(input)) return input as any[];
  if (Array.isArray(anyInput?.data)) return anyInput.data;
  if (Array.isArray(anyInput?.items)) return anyInput.items;
  if (Array.isArray(anyInput?.rows)) return anyInput.rows;
  if (Array.isArray(anyInput?.value)) return anyInput.value;
  return [];
}

function normalizeRondas(input: unknown): Array<{ id: number; rondaNumero: number; orden: number; concluido: boolean }> {
  return extractArray(input)
    .map((x: any) => ({
      id: Number(x.id ?? x.rondaId ?? x.ronda?.id),
      rondaNumero: Number(x.rondaNumero ?? x.numero ?? x.num ?? x.ronda?.numero ?? 0),
      orden: Number(x.orden ?? x.order ?? 0),
      concluido: Boolean(
        x.concluido ??
          x.finalizado ??
          x.terminado ??
          (typeof x.estado === "string" ? x.estado.toUpperCase() === "CONCLUIDO" : x.estado === true)
      ),
    }))
    .filter((r) => Number.isFinite(r.id));
}

function isTornoConcluido(status?: string | null) {
  return ["CONCLUIDO", "CANCELADO"].includes(String(status ?? "").toUpperCase());
}

function normalizeMovimientoCollection(input: unknown): MovimientoRecord[] {
  const source = input as any;
  return extractArray(source?.data ?? source?.items ?? source?.rows ?? source);
}

function movementToRondaOut(mv: MovimientoRecord, index: number, concluido: boolean): RondaOut | null {
  const movimientoId = Number(mv.id);
  if (!Number.isFinite(movimientoId)) return null;
  return {
    id: -Math.abs(1_000_000 + movimientoId),
    rondaNumero: 1,
    orden: index + 1,
    concluido,
    empresa: mv.empresa ? { id: Number(mv.empresa.id ?? 0), nombre: String(mv.empresa.nombre ?? "—") } : null,
    movimiento: {
      id: movimientoId,
      viaOrigen: mv.viaOrigen ?? null,
      viaDestino: mv.viaDestino ?? null,
      lavado: Boolean(mv.lavado ?? mv.Lavado),
      torno: Boolean(mv.torno),
      estado: mv.estado ?? (concluido ? "CONCLUIDO" : "SOLICITADO"),
      prioridad: mv.prioridad ?? null,
      locomotiveNumber: mv.locomotiveNumber ?? mv.locomotora ?? null,
      locomotora: mv.locomotora ?? null,
      fechaSolicitud: mv.fechaSolicitud ?? mv.createdAt ?? null,
      fechaInicio: mv.fechaInicio ?? null,
      fechaFin: mv.fechaFin ?? null,
      instrucciones: mv.instrucciones ?? null,
    },
    movimientoId,
    createdAt: mv.fechaSolicitud ?? mv.createdAt ?? null,
  };
}

async function readTextAsJsonSafe(r: Response): Promise<unknown> {
  const t = await r.text();
  try {
    return JSON.parse(t);
  } catch {
    return t ? { message: t } : {};
  }
}

function authHeaders(req: NextRequest, token?: string) {
  return {
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    "user-agent": req.headers.get("user-agent") || "",
    "x-forwarded-for": req.headers.get("x-forwarded-for") || "",
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams, origin } = new URL(req.url);
    const localidadId = searchParams.get("localidadId");
    if (!localidadId) return NextResponse.json<RondaOut[]>([], { status: 200 });

    const entity = String(searchParams.get("entity") ?? "movimientos").toLowerCase();
    const estado = String(searchParams.get("estado") ?? searchParams.get("tab") ?? "pendientes").toLowerCase();
    const concluido = estado === "terminados" || estado === "finalizados" || estado === "true";

    const cookieStore = await cookies();
    const token = cookieStore.get(process.env.JWT_COOKIE_NAME || "token")?.value;
    const empresaId = Number(cookieStore.get("empresaId")?.value) || null;
    const base = getApiBase(origin);
    const headers = authHeaders(req, token);

    if (entity === "torneados") {
      const statusParam = concluido ? "CONCLUIDO,CANCELADO" : "SOLICITADO,EN_PROCESO,DETENIDO";
      const r = await fetch(`${base}/torno/rondas-servicio/historial?status=${encodeURIComponent(statusParam)}`, {
        cache: "no-store",
        headers,
      });
      if (!r.ok) return NextResponse.json<RondaOut[]>([], { status: 200 });

      const records = extractArray(await readTextAsJsonSafe(r)) as TornoServiceRecord[];
      const out = await Promise.all(records.map(async (record, index): Promise<RondaOut | null> => {
        const status = String(record.historialStatus ?? record.status ?? "SOLICITADO").toUpperCase();
        const movimientoId = Number(record.movimientoId);
        const servicioId = Number(record.servicioId ?? record.rondaServicioId ?? index + 1);
        if (!Number.isFinite(movimientoId) || !Number.isFinite(servicioId)) return null;

        let empresa: RondaOut["empresa"] = null;
        let localidadMovimientoId: number | null = null;
        let movimiento: RondaOut["movimiento"] = {
          id: movimientoId,
          torno: true,
          estado: status,
          fechaSolicitud: record.creadoEn ?? null,
          fechaInicio: record.inicio ?? null,
          fechaFin: record.fin ?? null,
        };

        try {
          const rr = await fetch(`${base}/movimientos/${encodeURIComponent(String(movimientoId))}/edicion`, {
            cache: "no-store",
            headers,
          });
          if (rr.ok) {
            const detail = (await readTextAsJsonSafe(rr)) as any;
            const mv = detail?.movimiento ?? detail;
            localidadMovimientoId = Number(mv?.localidad?.id ?? mv?.localidadId ?? NaN) || null;
            empresa = mv?.empresa ? { id: Number(mv.empresa.id ?? 0), nombre: String(mv.empresa.nombre ?? "—") } : null;
            movimiento = {
              id: mv?.id ?? movimientoId,
              viaOrigen: mv?.viaOrigen ?? null,
              viaDestino: mv?.viaDestino ?? null,
              lavado: Boolean(mv?.lavado ?? mv?.Lavado),
              torno: true,
              estado: status,
              prioridad: mv?.prioridad ?? null,
              locomotiveNumber: mv?.locomotiveNumber ?? mv?.locomotora ?? null,
              locomotora: mv?.locomotora ?? null,
              fechaSolicitud: mv?.fechaSolicitud ?? record.creadoEn ?? null,
              fechaInicio: record.inicio ?? mv?.fechaInicio ?? null,
              fechaFin: record.fin ?? mv?.fechaFin ?? null,
              instrucciones: mv?.instrucciones ?? null,
            };
          }
        } catch {
          // Si el detalle falla, el registro se conserva solo si no hay filtros verificables.
        }

        if (localidadMovimientoId && Number(localidadId) !== localidadMovimientoId) return null;
        if (empresaId && empresa && empresa.id !== empresaId) return null;

        return {
          id: -Math.abs(servicioId),
          rondaNumero: 1,
          orden: index + 1,
          concluido: isTornoConcluido(status),
          empresa,
          movimiento,
          movimientoId,
          createdAt: record.creadoEn ?? record.inicio ?? null,
        };
      }));

      const filtered = out
        .filter((item): item is RondaOut => Boolean(item))
        .sort((a, b) => a.orden - b.orden || a.id - b.id);
      return NextResponse.json(filtered, { status: 200 });
    }

    if (concluido) {
      const qs = new URLSearchParams({
        localidadId,
        ambito: "pasados",
        page: "1",
        pageSize: "100",
      });
      if (empresaId) qs.set("empresaId", String(empresaId));
      const r = await fetch(`${base}/movimientos/buscar?${qs.toString()}`, {
        method: "GET",
        headers,
        cache: "no-store",
      });
      if (!r.ok) return NextResponse.json<RondaOut[]>([], { status: 200 });
      const movements = normalizeMovimientoCollection(await readTextAsJsonSafe(r));
      const out = movements
        .map((mv, index) => movementToRondaOut(mv, index, true))
        .filter((item): item is RondaOut => Boolean(item));
      return NextResponse.json(out, { status: 200 });
    }

    const concluidoParam = "false";
    const candidates = [
      `${base}/rondas/localidad/${encodeURIComponent(localidadId)}/estado/${concluidoParam}`,
      `${base}/rondas?localidadId=${encodeURIComponent(localidadId)}&concluido=${concluidoParam}`,
      `${base}/movimientos/rondas?localidadId=${encodeURIComponent(localidadId)}&concluido=${concluidoParam}`,
    ];

    let raw: unknown = [];
    for (const url of candidates) {
      const r = await fetch(url, { method: "GET", headers, cache: "no-store" });
      if (!r.ok) continue;
      raw = await readTextAsJsonSafe(r);
      break;
    }

    const baseList = normalizeRondas(raw);
    if (baseList.length === 0) return NextResponse.json<RondaOut[]>([], { status: 200 });

    const infoPairs = await Promise.all(
      baseList.map(async (r) => {
        try {
          const rr = await fetch(`${base}/movimientos/ronda/${r.id}/info`, {
            cache: "no-store",
            headers,
          });
          if (!rr.ok) return [r.id, null] as const;
          return [r.id, await readTextAsJsonSafe(rr)] as const;
        } catch {
          return [r.id, null] as const;
        }
      })
    );
    const infoMap = new Map<number, any>(infoPairs);

    let out: RondaOut[] = baseList.map((r) => {
      const inf = infoMap.get(r.id);
      const mv = inf?.movimiento ?? null;
      const emp = inf?.empresa ?? mv?.empresa ?? null;
      return {
        ...r,
        empresa: emp ? { id: Number(emp.id ?? 0), nombre: String(emp.nombre ?? "—") } : null,
        movimiento: mv
          ? {
              id: mv.id,
              viaOrigen: mv.viaOrigen ?? null,
              viaDestino: mv.viaDestino ?? null,
              lavado: Boolean(mv.lavado ?? mv.Lavado),
              torno: Boolean(mv.torno),
              estado: mv.estado ?? null,
              prioridad: mv.prioridad ?? null,
              locomotiveNumber: mv.locomotiveNumber ?? mv.locomotora ?? null,
              locomotora: mv.locomotora ?? null,
              fechaSolicitud: mv.fechaSolicitud ?? mv.createdAt ?? null,
              fechaInicio: mv.fechaInicio ?? null,
              fechaFin: mv.fechaFin ?? null,
              instrucciones: mv.instrucciones ?? null,
            }
          : null,
        movimientoId: inf?.movimientoId ?? mv?.id ?? null,
        createdAt: mv?.fechaSolicitud ?? mv?.createdAt ?? null,
      };
    });

    if (empresaId) out = out.filter((r) => r.empresa?.id === empresaId);
    out.sort((a, b) => a.rondaNumero - b.rondaNumero || a.orden - b.orden || a.id - b.id);

    return NextResponse.json(out, { status: 200 });
  } catch (err) {
    console.error("[api/cliente/rondas] error:", err);
    return NextResponse.json<RondaOut[]>([], { status: 200 });
  }
}
