// src/app/cliente/rondas/route.ts
import "server-only";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { normalizeHttpOrigin } from "@/lib/serverOrigin";
import { PERMISSIONS, hasPermission } from "@/lib/accessControl";
import { getVerifiedSession } from "@/lib/server/session";

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
    fechaSolicitud?: string | null;
    fechaInicio?: string | null;
    fechaFin?: string | null;
    createdAt?: string | null;
    instrucciones?: string | null;
  } | null;
  movimientoId?: number | null;
  createdAt?: string | null;
};

type UnknownRecord = Record<string, unknown>;
type MovimientoRecord = NonNullable<RondaOut["movimiento"]> & {
  empresa?: { id?: number | string | null; nombre?: string | null } | null;
  localidad?: { id?: number | string | null; nombre?: string | null } | null;
  localidadId?: number | string | null;
  Lavado?: boolean | null;
};
type MovimientoDetailRecord = MovimientoRecord & { movimiento?: MovimientoRecord | null };
type RondaInfoRecord = {
  empresa?: { id?: number | string | null; nombre?: string | null } | null;
  movimiento?: MovimientoRecord | null;
  movimientoId?: number | string | null;
};

type TornoServiceRecord = {
  id?: number | string | null;
  servicioId?: number | string | null;
  rondaServicioId?: number | string | null;
  movimientoId?: number | string | null;
  ruedaSolicitudId?: number | string | null;
  localidadId?: number | string | null;
  numeroLocomotora?: number | string | null;
  locomotiveNumber?: number | string | null;
  locomotora?: number | string | null;
  movimiento?: {
    id?: number | string | null;
    localidadId?: number | string | null;
    localidad?: { id?: number | string | null } | null;
    fechaSolicitud?: string | null;
  } | null;
  servicio?: {
    id?: number | string | null;
    movimientoId?: number | string | null;
    ruedaSolicitudId?: number | string | null;
  } | null;
  rondaServicio?: {
    id?: number | string | null;
    servicioId?: number | string | null;
    movimientoId?: number | string | null;
    ruedaSolicitudId?: number | string | null;
  } | null;
  status?: string | null;
  historialStatus?: string | null;
  inicio?: string | null;
  fin?: string | null;
  creadoEn?: string | null;
  actualizadoEn?: string | null;
};

function asRecord(input: unknown): UnknownRecord {
  return input && typeof input === "object" ? (input as UnknownRecord) : {};
}

function normalize(input: unknown): RondaBase[] {
  const record = asRecord(input);
  const src: unknown[] = Array.isArray(input)
    ? (input as unknown[])
    : Array.isArray(record.data)
    ? record.data
    : Array.isArray(record.rows)
    ? record.rows
    : [];

  const mapped: RondaBase[] = src.map((x): RondaBase => {
    const item = asRecord(x);
    const ronda = asRecord(item.ronda);
    return {
      id: Number(item.id ?? item.rondaId ?? ronda.id),
      rondaNumero: Number(item.rondaNumero ?? item.numero ?? item.num ?? ronda.numero ?? 0),
      orden: Number(item.orden ?? item.order ?? 0),
      concluido: Boolean(
        item.concluido ??
          item.finalizado ??
          item.terminado ??
          (typeof item.estado === "string" ? item.estado.toUpperCase() === "CONCLUIDO" : item.estado === true)
      ),
    };
  });

  return mapped.filter((r: RondaBase) => Number.isFinite(r.id));
}

function extractArray(input: unknown): UnknownRecord[] {
  const record = asRecord(input);
  return Array.isArray(input)
    ? input.filter((item): item is UnknownRecord => Boolean(item && typeof item === "object"))
    : Array.isArray(record.data)
    ? record.data.filter((item): item is UnknownRecord => Boolean(item && typeof item === "object"))
    : Array.isArray(record.items)
    ? record.items.filter((item): item is UnknownRecord => Boolean(item && typeof item === "object"))
    : Array.isArray(record.rows)
    ? record.rows.filter((item): item is UnknownRecord => Boolean(item && typeof item === "object"))
    : Array.isArray(record.value)
    ? record.value.filter((item): item is UnknownRecord => Boolean(item && typeof item === "object"))
    : [];
}

function asNumber(input: unknown): number | null {
  const value = Number(input);
  return Number.isFinite(value) ? value : null;
}

function firstPositiveNumber(...values: unknown[]): number | null {
  for (const value of values) {
    const parsed = asNumber(value);
    if (parsed && parsed > 0) return parsed;
  }
  return null;
}

function isTornoConcluido(status?: string | null) {
  return ["CONCLUIDO", "CANCELADO"].includes(String(status ?? "").toUpperCase());
}

async function readTextAsJsonSafe(r: Response): Promise<unknown> {
  const t = await r.text();
  try {
    return JSON.parse(t);
  } catch {
    return t ? { message: t } : {};
  }
}

function getTornoQueueCreatedTime(item: RondaOut): number {
  const candidates = [
    item.createdAt,
    item.movimiento?.fechaSolicitud,
    item.movimiento?.createdAt
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const timestamp = Date.parse(String(candidate));
    if (Number.isFinite(timestamp)) return timestamp;
  }

  const numericId = Math.abs(Number(item.id));
  return Number.isFinite(numericId) ? numericId : Number.MAX_SAFE_INTEGER;
}

function getApiBase(origin: string) {
  const raw = String(process.env.API_ORIGIN || process.env.NEXT_PUBLIC_API_URL || "").trim();
  if (!raw) return `${origin}/bff`.replace(/\/+$/, "");
  if (raw.startsWith("/")) return `${origin}${raw}`.replace(/\/+$/, "");
  return normalizeHttpOrigin(raw).replace(/\/+$/, "");
}

export async function GET(req: Request) {
  try {
    const { searchParams, origin } = new URL(req.url);
    const requestedLocalidadId = firstPositiveNumber(searchParams.get("localidadId"));
    const entity = String(searchParams.get("entity") ?? "movimientos").toLowerCase();
    const estado = String(searchParams.get("estado") ?? searchParams.get("tab") ?? "pendientes").toLowerCase();
    const concluido = estado === "terminados" || estado === "finalizados" || estado === "true";

    const c = await cookies();
    const token = c.get(process.env.JWT_COOKIE_NAME ?? "token")?.value ?? "";
    const session = await getVerifiedSession();
    if (!token || !session) return NextResponse.json({ message: "No autorizado" }, { status: 401 });
    if (!hasPermission(session.authorization, PERMISSIONS.ROUNDS_READ)) {
      return NextResponse.json({ message: "No autorizado para consultar rondas" }, { status: 403 });
    }
    const localityScoped = session.authorization.scope.mode === "LOCALITY"
      || session.authorization.scope.mode === "COMPANY_LOCALITY";
    const companyScoped = session.authorization.scope.mode === "COMPANY"
      || session.authorization.scope.mode === "COMPANY_LOCALITY";
    if (localityScoped && requestedLocalidadId && requestedLocalidadId !== session.localidadId) {
      return NextResponse.json({ message: "Localidad fuera del alcance de la sesion" }, { status: 403 });
    }
    const localidadId = localityScoped ? session.localidadId : requestedLocalidadId;
    if (!localidadId) return NextResponse.json<RondaOut[]>([], { status: 200 });
    const loc = String(localidadId);
    const empresaId = companyScoped ? session.empresaId : null;
    if (companyScoped && !empresaId) return NextResponse.json({ message: "Empresa no asignada" }, { status: 403 });

    const base = getApiBase(origin);

    if (entity === "torneados") {
      const statusParam = concluido ? "CONCLUIDO,CANCELADO" : "SOLICITADO,EN_PROCESO,DETENIDO";
      const qs = new URLSearchParams({ status: statusParam, localidadId: loc });
      if (empresaId) qs.set("empresaId", String(empresaId));
      const r = await fetch(`${base}/torno/rondas-servicio/historial?${qs.toString()}`, {
        cache: "no-store",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!r.ok) return NextResponse.json<RondaOut[]>([], { status: 200 });
      const raw = await readTextAsJsonSafe(r);
      const records = extractArray(raw) as TornoServiceRecord[];

      const out = await Promise.all(records.map(async (record, index): Promise<RondaOut | null> => {
        const movimientoRecord = record.movimiento ?? {};
        const servicioRecord = record.servicio ?? {};
        const rondaServicioRecord = record.rondaServicio ?? {};
        const status = String(record.historialStatus ?? record.status ?? "SOLICITADO").toUpperCase();
        const movimientoId = firstPositiveNumber(
          record.movimientoId,
          movimientoRecord.id,
          servicioRecord.movimientoId,
          servicioRecord.ruedaSolicitudId,
          rondaServicioRecord.movimientoId,
          rondaServicioRecord.ruedaSolicitudId,
          record.ruedaSolicitudId,
        );
        const servicioId = firstPositiveNumber(
          record.servicioId,
          record.rondaServicioId,
          record.id,
          servicioRecord.id,
          rondaServicioRecord.id,
          rondaServicioRecord.servicioId,
          index + 1,
        );
        if (!servicioId) return null;

        let movimiento: RondaOut["movimiento"] = {
          id: movimientoId ?? undefined,
          torno: true,
          estado: status,
          locomotiveNumber: record.numeroLocomotora ?? record.locomotiveNumber ?? record.locomotora ?? null,
          locomotora: record.locomotora == null ? null : String(record.locomotora),
          fechaSolicitud: record.creadoEn ?? movimientoRecord.fechaSolicitud ?? null,
          fechaInicio: record.inicio ?? null,
          fechaFin: record.fin ?? null,
        };
        let empresa: RondaOut["empresa"] = null;
        let localidadMovimientoId = firstPositiveNumber(
          record.localidadId,
          movimientoRecord.localidadId,
          movimientoRecord.localidad?.id,
        );

        if (movimientoId) {
          try {
            const rr = await fetch(`${base}/movimientos/${encodeURIComponent(String(movimientoId))}/edicion`, {
              cache: "no-store",
              headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            });
            if (rr.ok) {
              const detail = (await readTextAsJsonSafe(rr)) as MovimientoDetailRecord;
              const mv = detail?.movimiento ?? detail;
              localidadMovimientoId = firstPositiveNumber(mv?.localidad?.id, mv?.localidadId) ?? localidadMovimientoId;
              empresa = mv?.empresa ? { id: Number(mv.empresa.id ?? 0), nombre: String(mv.empresa.nombre ?? "—") } : null;
              movimiento = {
                id: mv?.id ?? movimientoId,
                viaOrigen: mv?.viaOrigen ?? null,
                viaDestino: mv?.viaDestino ?? null,
                lavado: Boolean(mv?.lavado),
                torno: true,
                estado: status,
                prioridad: mv?.prioridad ?? null,
                locomotiveNumber: mv?.locomotiveNumber ?? mv?.locomotora ?? null,
                locomotora: mv?.locomotora ?? null,
                fechaSolicitud: mv?.fechaSolicitud ?? record.creadoEn ?? null,
                fechaInicio: record.inicio ?? mv?.fechaInicio ?? null,
                fechaFin: record.fin ?? mv?.fechaFin ?? null,
              };
            }
          } catch {
            // El servicio de torno puede listarse aun si el detalle del movimiento no responde.
          }
        }

        if (localidadMovimientoId && Number(loc) !== localidadMovimientoId) return null;

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

      let filtered = out.filter((item): item is RondaOut => Boolean(item));
      if (empresaId) filtered = filtered.filter((item) => !item.empresa || item.empresa.id === empresaId);

      if (concluido) {
        // Concluidos: más recientes primero (updatedAt desc o createdAt desc)
        filtered.sort((a, b) => getTornoQueueCreatedTime(b) - getTornoQueueCreatedTime(a));
      } else {
        // Activos/pendientes: FIFO (oldest first), igual a CosaifLogistcs
        filtered.sort((a, b) => {
          const diff = getTornoQueueCreatedTime(a) - getTornoQueueCreatedTime(b);
          if (diff !== 0) return diff;
          return a.id - b.id; // Desempate por ID (que son negativos)
        });
      }

      // Re-asignar orden secuencialmente para que el frontend lo ordene de forma estable
      const finalized = filtered.map((item, idx) => ({
        ...item,
        orden: idx + 1,
      }));

      return NextResponse.json<RondaOut[]>(finalized, { status: 200 });
    }

    const concluidoParam = concluido ? "true" : "false";
    const candidates = [
      `${base}/rondas/localidad/${encodeURIComponent(loc)}/estado/${concluidoParam}`,
      `${base}/rondas?localidadId=${encodeURIComponent(loc)}&concluido=${concluidoParam}`,
      `${base}/movimientos/rondas?localidadId=${encodeURIComponent(loc)}&concluido=${concluidoParam}`,
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
          const info = (await readTextAsJsonSafe(rr)) as RondaInfoRecord;
          return [r.id, info] as const;
        } catch {
          return [r.id, null] as const;
        }
      })
    );
    const infoMap = new Map<number, RondaInfoRecord | null>(infoPairs);

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
              fechaSolicitud: mv.fechaSolicitud ?? null,
              fechaInicio: mv.fechaInicio ?? null,
              fechaFin: mv.fechaFin ?? null,
              instrucciones: mv.instrucciones ?? null,
            }
          : null,
        movimientoId: firstPositiveNumber(inf?.movimientoId, mv?.id),
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
    const session = await getVerifiedSession();
    if (!token || !session) return NextResponse.json({ message: "No autorizado" }, { status: 401 });
    if (!hasPermission(session.authorization, PERMISSIONS.ROUNDS_EDIT)) {
      return NextResponse.json({ message: "No autorizado para modificar rondas" }, { status: 403 });
    }
    const base = getApiBase(origin);

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
