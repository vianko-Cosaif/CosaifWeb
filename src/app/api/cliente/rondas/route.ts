// app/api/cliente/rondas/route.ts
import { NextResponse, NextRequest } from "next/server";
import { cookies } from "next/headers";
import { normalizeHttpOrigin } from "@/lib/serverOrigin";
import { fetchTorreonMsJson, isTorreonLocalidad } from "@/lib/torreonMs";

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
    createdAt?: string | null;
    instrucciones?: string | null;
  } | null;
  movimientoId?: number | null;
  createdAt?: string | null;
  source?: "cosaif" | "torreon" | "torno" | string;
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
  movimiento?: MovimientoRecord | null;
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

type TorreonIncidenteRecord = {
  id?: number | string | null;
  estado?: string | null;
  motivo?: string | null;
  viaBloqueadaId?: number | string | null;
  seccionBloqueadaId?: number | string | null;
  fechaInicio?: string | null;
};

type TorreonMovimientoRecord = {
  id?: number | string | null;
  empresaId?: number | string | null;
  localidadId?: number | string | null;
  viaOrigenId?: number | string | null;
  viaDestinoId?: number | string | null;
  seccionOrigenId?: number | string | null;
  seccionDestinoId?: number | string | null;
  locomotiveNumber?: number | string | null;
  prioridad?: string | null;
  estado?: string | null;
  fechaSolicitud?: string | null;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  createdAt?: string | null;
  instrucciones?: string | null;
  empresaNombreSnapshot?: string | null;
  viaOrigenNombreSnapshot?: string | null;
  viaDestinoNombreSnapshot?: string | null;
  seccionOrigenNombreSnapshot?: string | null;
  seccionDestinoNombreSnapshot?: string | null;
};

type TorreonRondaMovimientoRecord = {
  id?: number | string | null;
  movimientoId?: number | string | null;
  empresaId?: number | string | null;
  orden?: number | string | null;
  prioridad?: string | null;
  estado?: string | null;
  fechaAsignado?: string | null;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  movimiento?: TorreonMovimientoRecord | null;
  bloqueadoPorIncidente?: TorreonIncidenteRecord | null;
};

type TorreonRondaRecord = {
  id?: number | string | null;
  numeroRonda?: number | string | null;
  estado?: string | null;
  fechaApertura?: string | null;
  createdAt?: string | null;
  movimientos?: TorreonRondaMovimientoRecord[] | null;
};

function getApiBase(origin: string) {
  const raw = String(process.env.API_ORIGIN || process.env.NEXT_PUBLIC_API_URL || "").trim();
  if (!raw) return `${origin}/bff`.replace(/\/+$/, "");
  if (raw.startsWith("/")) return `${origin}${raw}`.replace(/\/+$/, "");
  return normalizeHttpOrigin(raw).replace(/\/+$/, "");
}

function asRecord(input: unknown): UnknownRecord {
  return input && typeof input === "object" ? (input as UnknownRecord) : {};
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

function asDateString(input: unknown): string | null {
  return typeof input === "string" && input.trim() ? input : null;
}

function asPriority(input: unknown): "BAJA" | "ALTA" | null {
  const value = String(input ?? "").toUpperCase();
  return value === "BAJA" || value === "ALTA" ? value : null;
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
    source: "cosaif",
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
  return !["ADMINISTRADOR", "COORDINADOR", "SUPERVISOR", "CLIENTE_ADMIN", "CLIENTE_COOR"].includes(role);
}

function canSeeAllEmpresas(role: string) {
  return ["ADMINISTRADOR", "COORDINADOR", "SUPERVISOR", "CLIENTE_ADMIN", "CLIENTE_COOR"].includes(role);
}

function formatTorreonRef(snapshot: unknown, fallbackPrefix: string, id: unknown) {
  const snapshotText = typeof snapshot === "string" && snapshot.trim() ? snapshot.trim() : null;
  if (snapshotText) return snapshotText;
  const numericId = asNumber(id);
  return numericId ? `${fallbackPrefix} ${numericId}` : null;
}

function formatTorreonVia(
  viaSnapshot: unknown,
  viaId: unknown,
  seccionSnapshot: unknown,
  seccionId: unknown
) {
  const via = formatTorreonRef(viaSnapshot, "Via", viaId);
  const seccion = formatTorreonRef(seccionSnapshot, "Seccion", seccionId);
  if (via && seccion) return `${via} / ${seccion}`;
  return via || seccion || null;
}

function buildTorreonInstructions(movimiento: TorreonMovimientoRecord, incidente?: TorreonIncidenteRecord | null) {
  const base = typeof movimiento.instrucciones === "string" ? movimiento.instrucciones.trim() : "";
  const incidenteAbierto = String(incidente?.estado ?? "").toUpperCase() === "ABIERTO";
  if (!incidenteAbierto) return base || null;

  const incidenteId = asNumber(incidente?.id);
  const motivo = typeof incidente?.motivo === "string" && incidente.motivo.trim() ? incidente.motivo.trim() : "sin detalle";
  const bloqueo = `Incidente abierto${incidenteId ? ` #${incidenteId}` : ""}: ${motivo}`;
  return [base, bloqueo].filter(Boolean).join("\n");
}

function isTorreonDetailDone(detail: TorreonRondaMovimientoRecord, movimiento: TorreonMovimientoRecord) {
  const detailState = String(detail.estado ?? "").toUpperCase();
  const movementState = String(movimiento.estado ?? "").toUpperCase();
  return ["CONCLUIDO", "CANCELADO"].includes(detailState) || ["CONCLUIDO", "CANCELADO"].includes(movementState);
}

function isTorreonMovimientoDone(movimiento: TorreonMovimientoRecord) {
  return ["CONCLUIDO", "CANCELADO"].includes(String(movimiento.estado ?? "").toUpperCase());
}

function mapTorreonMovimientosToRondasOut(
  input: unknown,
  concluido: boolean,
  empresaScopeId?: number | null,
  excludedMovimientoIds = new Set<number>()
): RondaOut[] {
  const movimientos = extractArray(input) as TorreonMovimientoRecord[];
  return movimientos
    .map((movimiento, index): RondaOut | null => {
      const movimientoId = asNumber(movimiento.id);
      if (!movimientoId || excludedMovimientoIds.has(movimientoId)) return null;

      const empresaId = asNumber(movimiento.empresaId);
      if (empresaScopeId && empresaId !== empresaScopeId) return null;
      if (isTorreonMovimientoDone(movimiento) !== concluido) return null;

      const empresaNombre = typeof movimiento.empresaNombreSnapshot === "string" && movimiento.empresaNombreSnapshot.trim()
        ? movimiento.empresaNombreSnapshot.trim()
        : empresaId ? `Empresa ${empresaId}` : "—";

      return {
        id: -Math.abs(2_000_000 + movimientoId),
        rondaNumero: 1,
        orden: index + 1,
        concluido,
        empresa: empresaId ? { id: empresaId, nombre: empresaNombre } : null,
        movimiento: {
          id: movimientoId,
          viaOrigen: {
            nombre: formatTorreonVia(
              movimiento.viaOrigenNombreSnapshot,
              movimiento.viaOrigenId,
              movimiento.seccionOrigenNombreSnapshot,
              movimiento.seccionOrigenId
            ),
          },
          viaDestino: {
            nombre: formatTorreonVia(
              movimiento.viaDestinoNombreSnapshot,
              movimiento.viaDestinoId,
              movimiento.seccionDestinoNombreSnapshot,
              movimiento.seccionDestinoId
            ),
          },
          lavado: false,
          torno: false,
          estado: movimiento.estado ?? (concluido ? "CONCLUIDO" : "SOLICITADO"),
          prioridad: asPriority(movimiento.prioridad),
          locomotiveNumber: movimiento.locomotiveNumber ?? null,
          locomotora: movimiento.locomotiveNumber == null ? null : String(movimiento.locomotiveNumber),
          fechaSolicitud: asDateString(movimiento.fechaSolicitud ?? movimiento.createdAt),
          fechaInicio: asDateString(movimiento.fechaInicio),
          fechaFin: asDateString(movimiento.fechaFin),
          instrucciones: buildTorreonInstructions(movimiento),
        },
        movimientoId,
        createdAt: asDateString(movimiento.fechaSolicitud ?? movimiento.createdAt),
        source: "torreon",
      };
    })
    .filter((item): item is RondaOut => Boolean(item))
    .sort((a, b) => {
      const aTime = Date.parse(String(a.createdAt ?? a.movimiento?.fechaSolicitud ?? "")) || 0;
      const bTime = Date.parse(String(b.createdAt ?? b.movimiento?.fechaSolicitud ?? "")) || 0;
      return aTime - bTime || a.orden - b.orden || a.id - b.id;
    })
    .map((item, index) => ({ ...item, orden: index + 1 }));
}

function mapTorreonRondasToOut(input: unknown, concluido: boolean, empresaScopeId?: number | null): RondaOut[] {
  const rondas = extractArray(input) as TorreonRondaRecord[];
  const out: RondaOut[] = [];

  for (const ronda of rondas) {
    const numeroRonda = asNumber(ronda.numeroRonda) ?? 0;
    const movimientos = Array.isArray(ronda.movimientos) ? ronda.movimientos : [];

    movimientos.forEach((detail, index) => {
      const movimiento = detail.movimiento ?? {};
      const detailId = asNumber(detail.id);
      const movimientoId = asNumber(detail.movimientoId ?? movimiento.id);
      if (!detailId || !movimientoId) return;

      const empresaId = asNumber(detail.empresaId ?? movimiento.empresaId);
      if (empresaScopeId && empresaId !== empresaScopeId) return;

      const itemDone = isTorreonDetailDone(detail, movimiento);
      if (itemDone !== concluido) return;

      const incidente = detail.bloqueadoPorIncidente ?? null;
      const bloqueado = String(detail.estado ?? "").toUpperCase() === "BLOQUEADO"
        || String(incidente?.estado ?? "").toUpperCase() === "ABIERTO";
      const estado = bloqueado ? "BLOQUEADO" : String(detail.estado ?? movimiento.estado ?? "SOLICITADO").toUpperCase();
      const locomotiveNumber = movimiento.locomotiveNumber ?? null;
      const empresaNombre = typeof movimiento.empresaNombreSnapshot === "string" && movimiento.empresaNombreSnapshot.trim()
        ? movimiento.empresaNombreSnapshot.trim()
        : empresaId ? `Empresa ${empresaId}` : "—";

      out.push({
        id: detailId,
        rondaNumero: numeroRonda,
        orden: asNumber(detail.orden) ?? index + 1,
        concluido: itemDone,
        empresa: empresaId ? { id: empresaId, nombre: empresaNombre } : null,
        movimiento: {
          id: movimientoId,
          viaOrigen: {
            nombre: formatTorreonVia(
              movimiento.viaOrigenNombreSnapshot,
              movimiento.viaOrigenId,
              movimiento.seccionOrigenNombreSnapshot,
              movimiento.seccionOrigenId
            ),
          },
          viaDestino: {
            nombre: formatTorreonVia(
              movimiento.viaDestinoNombreSnapshot,
              movimiento.viaDestinoId,
              movimiento.seccionDestinoNombreSnapshot,
              movimiento.seccionDestinoId
            ),
          },
          lavado: false,
          torno: false,
          estado,
          prioridad: asPriority(detail.prioridad ?? movimiento.prioridad),
          locomotiveNumber,
          locomotora: locomotiveNumber == null ? null : String(locomotiveNumber),
          fechaSolicitud: asDateString(movimiento.fechaSolicitud ?? movimiento.createdAt ?? detail.fechaAsignado),
          fechaInicio: asDateString(detail.fechaInicio ?? movimiento.fechaInicio),
          fechaFin: asDateString(detail.fechaFin ?? movimiento.fechaFin),
          instrucciones: buildTorreonInstructions(movimiento, incidente),
        },
        movimientoId,
        createdAt: asDateString(detail.fechaAsignado ?? movimiento.fechaSolicitud ?? ronda.fechaApertura ?? ronda.createdAt),
        source: "torreon",
      });
    });
  }

  return out.sort((a, b) => a.rondaNumero - b.rondaNumero || a.orden - b.orden || a.id - b.id);
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

function assertEmpresaScope(shouldScopeEmpresa: boolean, empresaId: number | null, targetEmpresaIds: Array<number | null>) {
  if (!shouldScopeEmpresa) return;
  if (!empresaId) {
    throw new Error("No se pudo validar tu empresa.");
  }
  if (targetEmpresaIds.some((id) => id !== empresaId)) {
    throw new Error("Solo puedes modificar movimientos de tu empresa.");
  }
}

function sortRondaQueue(rows: RondaOut[]) {
  return [...rows].sort((a, b) => {
    const rondaDiff = a.rondaNumero - b.rondaNumero;
    if (rondaDiff) return rondaDiff;
    const ordenDiff = a.orden - b.orden;
    if (ordenDiff) return ordenDiff;
    const aTime = Date.parse(String(a.createdAt ?? a.movimiento?.fechaSolicitud ?? "")) || 0;
    const bTime = Date.parse(String(b.createdAt ?? b.movimiento?.fechaSolicitud ?? "")) || 0;
    return aTime - bTime || a.id - b.id;
  }).map((item, index) => ({ ...item, orden: index + 1 }));
}

async function fetchCosaifMovimientosAsRondas(params: {
  base: string;
  headers: HeadersInit;
  localidadId: string;
  concluido: boolean;
  empresaId?: number | null;
}) {
  const qs = new URLSearchParams({
    localidadId: params.localidadId,
    page: "1",
    pageSize: "100",
    sortBy: params.concluido ? "fin" : "solicitud",
    sortDir: params.concluido ? "desc" : "asc",
  });

  if (params.empresaId) qs.set("empresaId", String(params.empresaId));
  if (params.concluido) {
    qs.set("estado", "CONCLUIDO,CANCELADO");
  } else {
    qs.set("estado", "SOLICITADO,EN_PROCESO,ESPERA,DETENIDO,AGENDADO");
    qs.set("finalizado", "false");
  }

  const response = await fetch(`${params.base}/movimientos/buscar?${qs.toString()}`, {
    method: "GET",
    headers: params.headers,
    cache: "no-store",
  });

  if (!response.ok) return [];

  return normalizeMovimientoCollection(await readTextAsJsonSafe(response))
    .map((mv, index) => movementToRondaOut(mv, index, params.concluido))
    .filter((item): item is RondaOut => Boolean(item));
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
    const role = readRole(cookieStore);
    const empresaId = readEmpresaId(cookieStore);
    const base = getApiBase(origin);
    const headers = authHeaders(req, token);

    if (entity === "torneados") {
      const statusParam = concluido ? "CONCLUIDO,CANCELADO" : "SOLICITADO,EN_PROCESO,DETENIDO";
      const qs = new URLSearchParams({ status: statusParam, localidadId });
      if (empresaId && !canSeeAllEmpresas(role)) qs.set("empresaId", String(empresaId));
      const r = await fetch(`${base}/torno/rondas-servicio/historial?${qs.toString()}`, {
        cache: "no-store",
        headers,
      });
      if (!r.ok) return NextResponse.json<RondaOut[]>([], { status: 200 });

      const records = extractArray(await readTextAsJsonSafe(r)) as TornoServiceRecord[];
      const out = await Promise.all(records.map(async (record, index): Promise<RondaOut | null> => {
        const movimientoRecord = asRecord(record.movimiento);
        const servicioRecord = asRecord(record.servicio);
        const rondaServicioRecord = asRecord(record.rondaServicio);
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

        let empresa: RondaOut["empresa"] = null;
        let localidadMovimientoId = firstPositiveNumber(
          record.localidadId,
          movimientoRecord.localidadId,
          asRecord(movimientoRecord.localidad).id,
        );
        let movimiento: RondaOut["movimiento"] = {
          id: movimientoId ?? undefined,
          torno: true,
          estado: status,
          locomotiveNumber: record.numeroLocomotora ?? record.locomotiveNumber ?? record.locomotora ?? null,
          locomotora: record.locomotora == null ? null : String(record.locomotora),
          fechaSolicitud:
            record.creadoEn ??
            (typeof movimientoRecord.fechaSolicitud === "string" ? movimientoRecord.fechaSolicitud : null),
          fechaInicio: record.inicio ?? null,
          fechaFin: record.fin ?? null,
        };

        if (movimientoId) {
          try {
            const rr = await fetch(`${base}/movimientos/${encodeURIComponent(String(movimientoId))}/edicion`, {
              cache: "no-store",
              headers,
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
            // Si el detalle falla, conservamos el registro de Torno con la informacion disponible.
          }
        }

        if (localidadMovimientoId && Number(localidadId) !== localidadMovimientoId) return null;
        return {
          id: -Math.abs(servicioId),
          rondaNumero: 1,
          orden: index + 1,
          concluido: isTornoConcluido(status),
          empresa,
          movimiento,
          movimientoId,
          createdAt: record.creadoEn ?? record.inicio ?? null,
          source: "torno",
        };
      }));

      const filtered = out.filter((item): item is RondaOut => Boolean(item));

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

      return NextResponse.json(finalized, { status: 200 });
    }

    if (isTorreonLocalidad(localidadId)) {
      const scopedEmpresaId = canSeeAllEmpresas(role) ? null : empresaId;
      const canReadTorreon = Boolean(scopedEmpresaId || canSeeAllEmpresas(role));
      if (!canReadTorreon) return NextResponse.json<RondaOut[]>([], { status: 200 });

      let out: RondaOut[] = [];
      try {
        const raw = await fetchTorreonMsJson(`/rondas?localidadId=${encodeURIComponent(localidadId)}`);
        out = mapTorreonRondasToOut(raw, concluido, scopedEmpresaId);
      } catch (error) {
        console.warn("[api/cliente/rondas] rondas Torreon error; se intentara fallback:", error);
      }

      if (!concluido) {
        try {
          const params = new URLSearchParams({ localidadId });
          if (scopedEmpresaId) params.set("empresaId", String(scopedEmpresaId));
          const rawMovimientos = await fetchTorreonMsJson(`/movimientos?${params.toString()}`);
          const excludedIds = new Set(
            out
              .map((item) => Number(item.movimientoId ?? item.movimiento?.id))
              .filter((value) => Number.isFinite(value) && value > 0)
          );
          const fallback = mapTorreonMovimientosToRondasOut(rawMovimientos, concluido, scopedEmpresaId, excludedIds);
          out = sortRondaQueue([...out, ...fallback]);
        } catch (error) {
          console.warn("[api/cliente/rondas] fallback movimientos Torreon error:", error);
        }
      }

      if (out.length) return NextResponse.json(out, { status: 200 });

      try {
        const cosaifFallback = await fetchCosaifMovimientosAsRondas({
          base,
          headers,
          localidadId,
          concluido,
          empresaId: scopedEmpresaId,
        });
        return NextResponse.json(sortRondaQueue(cosaifFallback), { status: 200 });
      } catch (error) {
        console.warn("[api/cliente/rondas] fallback Cosaif para Torreon error:", error);
      }

      return NextResponse.json(out, { status: 200 });
    }

    if (concluido) {
      const qs = new URLSearchParams({
        localidadId,
        ambito: "pasados",
        page: "1",
        pageSize: "100",
      });
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

    const out: RondaOut[] = baseList.map((r) => {
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

    if (isTorreonLocalidad(body?.localidadId)) {
      return NextResponse.json(
        { message: "Las rondas de Torreon se consultan desde ms_torreon; mover/cancelar requiere endpoint propio." },
        { status: 409 }
      );
    }

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
