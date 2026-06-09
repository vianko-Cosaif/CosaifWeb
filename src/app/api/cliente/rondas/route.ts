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

type RondaInfoRecord = {
  empresa?: { id?: number; nombre?: string } | null;
  movimiento?: MovimientoRecord | null;
  movimientoId?: number | null;
};

type UnknownRecord = Record<string, unknown>;
type MovimientoDetailRecord = MovimientoRecord & { movimiento?: MovimientoRecord | null };

function getApiBase(origin: string) {
  return (process.env.API_ORIGIN || process.env.NEXT_PUBLIC_API_URL || `${origin}/bff`).replace(/\/$/, "");
}

function asRecord(input: unknown): UnknownRecord {
  return input && typeof input === "object" ? (input as UnknownRecord) : {};
}

function extractArray(input: unknown): UnknownRecord[] {
  const record = asRecord(input);
  if (Array.isArray(input)) return input as UnknownRecord[];
  if (Array.isArray(record.data)) return record.data as UnknownRecord[];
  if (Array.isArray(record.items)) return record.items as UnknownRecord[];
  if (Array.isArray(record.rows)) return record.rows as UnknownRecord[];
  if (Array.isArray(record.value)) return record.value as UnknownRecord[];
  return [];
}

function normalizeRondas(input: unknown): Array<{ id: number; rondaNumero: number; orden: number; concluido: boolean }> {
  return extractArray(input)
    .map((x) => {
      const ronda = asRecord(x.ronda);
      return {
        id: Number(x.id ?? x.rondaId ?? ronda.id),
        rondaNumero: Number(x.rondaNumero ?? x.numero ?? x.num ?? ronda.numero ?? 0),
        orden: Number(x.orden ?? x.order ?? 0),
        concluido: Boolean(
          x.concluido ??
            x.finalizado ??
            x.terminado ??
            (typeof x.estado === "string" ? x.estado.toUpperCase() === "CONCLUIDO" : x.estado === true)
        ),
      };
    })
    .filter((r) => Number.isFinite(r.id));
}

function isTornoConcluido(status?: string | null) {
  return ["CONCLUIDO", "CANCELADO"].includes(String(status ?? "").toUpperCase());
}

function normalizeMovimientoCollection(input: unknown): MovimientoRecord[] {
  const source = asRecord(input);
  return extractArray(source.data ?? source.items ?? source.rows ?? input) as MovimientoRecord[];
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

function readRole(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return String(cookieStore.get(process.env.ROLE_COOKIE_NAME || "role")?.value || "").toUpperCase();
}

function readEmpresaId(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return (
    Number(cookieStore.get("empresaId")?.value) ||
    Number(cookieStore.get("empresald")?.value) ||
    Number(cookieStore.get("empresaID")?.value) ||
    null
  );
}

function shouldScopeToEmpresa(role: string, empresaId: number | null) {
  if (!empresaId) return false;
  return !["ADMINISTRADOR", "COORDINADOR", "SUPERVISOR"].includes(role);
}

function getInfoEmpresaId(info: RondaInfoRecord | null) {
  return Number(info?.empresa?.id ?? info?.movimiento?.empresa?.id ?? NaN) || null;
}

async function fetchJsonFirst(urls: string[], headers: HeadersInit) {
  let lastStatus = 404;
  for (const url of urls) {
    const response = await fetch(url, { method: "GET", headers, cache: "no-store" });
    lastStatus = response.status;
    if (!response.ok) continue;
    return await readTextAsJsonSafe(response);
  }
  throw new Error(`No se pudo validar pertenencia (${lastStatus})`);
}

async function fetchRondaInfo(base: string, headers: HeadersInit, rondaId: number) {
  const raw = await fetchJsonFirst(
    [
      `${base}/movimientos/ronda/${encodeURIComponent(String(rondaId))}/info`,
      `${base}/rondas/${encodeURIComponent(String(rondaId))}/info`,
    ],
    headers
  );
  return raw as RondaInfoRecord;
}

async function fetchMovimientoDetail(base: string, headers: HeadersInit, movimientoId: number) {
  const raw = await fetchJsonFirst(
    [
      `${base}/movimientos/${encodeURIComponent(String(movimientoId))}/edicion`,
      `${base}/movimientos/${encodeURIComponent(String(movimientoId))}`,
    ],
    headers
  );
  const data = raw as MovimientoDetailRecord;
  return (data?.movimiento ?? data) as MovimientoRecord;
}

function assertEmpresaScope(shouldScopeEmpresa: boolean, empresaId: number | null, targetEmpresaIds: Array<number | null>) {
  if (!shouldScopeEmpresa) return;
  if (!empresaId) {
    throw new Error("No se pudo validar tu empresa.");
  }
  if (targetEmpresaIds.some((id) => id !== empresaId)) {
    throw new Error("Solo puedes modificar movimientos de tu empresa.");
  }
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
    const empresaId = readEmpresaId(cookieStore);
    const role = readRole(cookieStore);
    const shouldScopeEmpresa = shouldScopeToEmpresa(role, empresaId);
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
            const detail = (await readTextAsJsonSafe(rr)) as MovimientoDetailRecord;
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
        if (shouldScopeEmpresa && empresa?.id !== empresaId) return null;

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
      if (shouldScopeEmpresa && empresaId) qs.set("empresaId", String(empresaId));
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
          return [r.id, (await readTextAsJsonSafe(rr)) as RondaInfoRecord] as const;
        } catch {
          return [r.id, null] as const;
        }
      })
    );
    const infoMap = new Map<number, RondaInfoRecord | null>(infoPairs);

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

    if (shouldScopeEmpresa) out = out.filter((r) => r.empresa?.id === empresaId);
    out.sort((a, b) => a.rondaNumero - b.rondaNumero || a.orden - b.orden || a.id - b.id);

    return NextResponse.json(out, { status: 200 });
  } catch (err) {
    console.error("[api/cliente/rondas] error:", err);
    return NextResponse.json<RondaOut[]>([], { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { origin } = new URL(req.url);
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "").toLowerCase();

    const cookieStore = await cookies();
    const token = cookieStore.get(process.env.JWT_COOKIE_NAME || "token")?.value;
    if (!token) return NextResponse.json({ message: "No autorizado" }, { status: 401 });

    const role = readRole(cookieStore);
    const empresaId = readEmpresaId(cookieStore);
    const shouldScopeEmpresa = shouldScopeToEmpresa(role, empresaId);
    const base = getApiBase(origin);
    const headers = authHeaders(req, token);
    const jsonHeaders = { ...headers, "content-type": "application/json" };

    if (action === "swap") {
      const rondaAId = Number(body?.rondaAId);
      const rondaBId = Number(body?.rondaBId);
      if (!Number.isFinite(rondaAId) || !Number.isFinite(rondaBId) || rondaAId <= 0 || rondaBId <= 0) {
        return NextResponse.json({ message: "Faltan rondaAId y rondaBId numéricos" }, { status: 400 });
      }

      try {
        const [infoA, infoB] = await Promise.all([
          fetchRondaInfo(base, headers, rondaAId),
          fetchRondaInfo(base, headers, rondaBId),
        ]);
        assertEmpresaScope(shouldScopeEmpresa, empresaId, [getInfoEmpresaId(infoA), getInfoEmpresaId(infoB)]);
      } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudo validar el intercambio.";
        return NextResponse.json({ message }, { status: message.includes("Solo puedes") ? 403 : 400 });
      }

      const response = await fetch(`${base}/rondas/intercambiar-movimientos`, {
        method: "PATCH",
        headers: jsonHeaders,
        body: JSON.stringify({ rondaAId, rondaBId }),
        cache: "no-store",
      });
      const data = await readTextAsJsonSafe(response);
      return NextResponse.json(data, { status: response.ok ? 200 : response.status });
    }

    if (action === "cancel") {
      const movimientoId = Number(body?.movimientoId);
      const razon = String(body?.razon || "Cancelado por cliente");
      if (!Number.isFinite(movimientoId) || movimientoId <= 0) {
        return NextResponse.json({ message: "Falta movimientoId numérico" }, { status: 400 });
      }

      try {
        const movimiento = await fetchMovimientoDetail(base, headers, movimientoId);
        const targetEmpresaId = Number(movimiento?.empresa?.id ?? NaN) || null;
        assertEmpresaScope(shouldScopeEmpresa, empresaId, [targetEmpresaId]);
      } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudo validar el movimiento.";
        return NextResponse.json({ message }, { status: message.includes("Solo puedes") ? 403 : 400 });
      }

      const response = await fetch(`${base}/movimientos/${encodeURIComponent(String(movimientoId))}/cancelar`, {
        method: "PATCH",
        headers: jsonHeaders,
        body: JSON.stringify({ razon }),
        cache: "no-store",
      });
      const data = await readTextAsJsonSafe(response);
      return NextResponse.json(data, { status: response.ok ? 200 : response.status });
    }

    return NextResponse.json({ message: "Acción no soportada" }, { status: 400 });
  } catch (err) {
    console.error("[api/cliente/rondas] POST error:", err);
    return NextResponse.json({ message: "Error inesperado" }, { status: 500 });
  }
}
