// app/api/cliente/rondas/route.ts
import { NextResponse, NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getRoleCapabilities } from "@/lib/accessControl";
import { normalizeHttpOrigin } from "@/lib/serverOrigin";
import { fetchTorreonMsJson, isTorreonLocalidad } from "@/lib/torreonMs";
import { containsTrainingReservedId } from "@/lib/routePolicy";

export const dynamic = "force-dynamic";

type RondaOut = {
  id: number;
  rondaNumero: number;
  orden: number;
  concluido: boolean;
  empresa?: { id: number; nombre: string } | null;
  movimiento?: {
    id?: number;
    idTecnico?: number | string | null;
    folioLocalidad?: number | null;
    folioLocalidadLabel?: string | null;
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
  idTecnico?: number | string | null;
  folioLocalidad?: number | null;
  folioLocalidadLabel?: string | null;
  empresaId?: number | string | null;
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
  const movimientoId = firstPositiveNumber(mv.idTecnico, mv.id);
  if (!movimientoId) return null;
  const visibleId = firstPositiveNumber(mv.folioLocalidad, mv.id) ?? movimientoId;
  return {
    id: -Math.abs(1_000_000 + movimientoId),
    rondaNumero: 1,
    orden: index + 1,
    concluido,
    empresa: mv.empresa ? { id: Number(mv.empresa.id ?? 0), nombre: String(mv.empresa.nombre ?? "—") } : null,
    movimiento: {
      id: visibleId,
      idTecnico: movimientoId,
      folioLocalidad: mv.folioLocalidad ?? visibleId,
      folioLocalidadLabel: mv.folioLocalidadLabel ?? `#${visibleId}`,
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

function readLocalidadId(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return (
    Number(cookieStore.get("locId")?.value) ||
    Number(cookieStore.get("localidadId")?.value) ||
    null
  );
}

function shouldScopeToEmpresa(role: string, empresaId: number | null) {
  if (!empresaId) return false;
  return !canSeeAllEmpresas(role);
}

function canSeeAllEmpresas(role: string) {
  return ["ADMINISTRADOR", "COORDINADOR"].includes(role);
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
          idTecnico: movimientoId,
          folioLocalidad: movimientoId,
          folioLocalidadLabel: `#${movimientoId}`,
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

function getInfoLocalidadId(info: RondaInfoRecord | null) {
  return firstPositiveNumber(info?.movimiento?.localidadId, info?.movimiento?.localidad?.id);
}

function getMovimientoLocalidadId(movimiento: MovimientoRecord | null) {
  return firstPositiveNumber(movimiento?.localidadId, movimiento?.localidad?.id);
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

function assertLocalidadScope(localidadId: number | null, targetLocalidadIds: Array<number | null>) {
  if (!localidadId) throw new Error("No se pudo validar tu localidad.");
  if (targetLocalidadIds.some((id) => id !== localidadId)) {
    throw new Error("Solo puedes modificar movimientos de tu localidad.");
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

async function fetchCosaifRondasOut({
  base,
  headers,
  localidadId,
  concluido,
  empresaScopeId,
}: {
  base: string;
  headers: HeadersInit;
  localidadId: string;
  concluido: boolean;
  empresaScopeId?: number | null;
}): Promise<RondaOut[]> {
  if (concluido) {
    const qs = new URLSearchParams({
      localidadId,
      ambito: "pasados",
      page: "1",
      pageSize: "100",
    });
    if (empresaScopeId) qs.set("empresaId", String(empresaScopeId));

    const response = await fetch(`${base}/movimientos/buscar?${qs.toString()}`, {
      method: "GET",
      headers,
      cache: "no-store",
    });
    if (!response.ok) return [];

    return normalizeMovimientoCollection(await readTextAsJsonSafe(response))
      .filter((mv) => {
        if (!empresaScopeId) return true;
        const recordEmpresaId = firstPositiveNumber(mv.empresaId, mv.empresa?.id);
        return recordEmpresaId === empresaScopeId;
      })
      .map((mv, index) => movementToRondaOut(mv, index, true))
      .filter((item): item is RondaOut => Boolean(item));
  }

  const candidates = [
    `${base}/rondas/localidad/${encodeURIComponent(localidadId)}/estado/false`,
    `${base}/rondas?localidadId=${encodeURIComponent(localidadId)}&concluido=false`,
    `${base}/movimientos/rondas?localidadId=${encodeURIComponent(localidadId)}&concluido=false`,
  ];

  let raw: unknown = [];
  for (const url of candidates) {
    const response = await fetch(url, { method: "GET", headers, cache: "no-store" });
    if (!response.ok) continue;
    raw = await readTextAsJsonSafe(response);
    break;
  }

  const baseList = normalizeRondas(raw);
  if (!baseList.length) return [];

  const infoPairs = await Promise.all(
    baseList.map(async (r) => {
      try {
        return [r.id, await fetchRondaInfo(base, headers, r.id)] as const;
      } catch {
        return [r.id, null] as const;
      }
    })
  );
  const infoMap = new Map<number, RondaInfoRecord | null>(infoPairs);

  const mapped: RondaOut[] = [];
  for (const r of baseList) {
    const info = infoMap.get(r.id);
    const mv = info?.movimiento ?? null;
    const emp = info?.empresa ?? mv?.empresa ?? null;
    const empresaId = firstPositiveNumber(emp?.id, mv?.empresaId);
    if (empresaScopeId && empresaId !== empresaScopeId) continue;
    const movimientoId = mv ? firstPositiveNumber(mv.idTecnico, info?.movimientoId, mv.id) : null;
    const visibleId = mv ? firstPositiveNumber(mv.folioLocalidad, mv.id) ?? movimientoId : null;

    mapped.push({
      ...r,
      empresa: emp ? { id: Number(emp.id ?? 0), nombre: String(emp.nombre ?? "—") } : null,
      movimiento: mv
        ? {
            id: visibleId ?? undefined,
            idTecnico: movimientoId,
            folioLocalidad: mv.folioLocalidad ?? visibleId ?? null,
            folioLocalidadLabel: mv.folioLocalidadLabel ?? (visibleId ? `#${visibleId}` : null),
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
      movimientoId,
      createdAt: mv?.fechaSolicitud ?? mv?.createdAt ?? null,
      source: "cosaif",
    });
  }

  return mapped.sort((a, b) => a.rondaNumero - b.rondaNumero || a.orden - b.orden || a.id - b.id);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams, origin } = new URL(req.url);
    const requestedLocalidadId = firstPositiveNumber(searchParams.get("localidadId"));

    const entity = String(searchParams.get("entity") ?? "movimientos").toLowerCase();
    const estado = String(searchParams.get("estado") ?? searchParams.get("tab") ?? "pendientes").toLowerCase();
    const concluido = estado === "terminados" || estado === "finalizados" || estado === "true";
    const requestedGeneralLocalityView = searchParams.get("alcance") === "localidad";

    const cookieStore = await cookies();
    const token = cookieStore.get(process.env.JWT_COOKIE_NAME || "token")?.value;
    const role = readRole(cookieStore);
    const capabilities = getRoleCapabilities(role);
    const empresaId = readEmpresaId(cookieStore);
    const assignedLocalidadId = readLocalidadId(cookieStore);
    const localidadId = role === "ADMINISTRADOR"
      ? requestedLocalidadId
      : assignedLocalidadId;
    // El dashboard del cliente es una vista operativa de toda la localidad.
    // Las consultas sin `alcance=localidad` (como el editor) siguen limitadas a su empresa.
    const generalLocalityView = requestedGeneralLocalityView;

    const requestedEmpresaId = firstPositiveNumber(searchParams.get("empresaId"));
    if (
      capabilities.isClientLike &&
      (!empresaId || (requestedEmpresaId && requestedEmpresaId !== empresaId))
    ) {
      return NextResponse.json({ message: "Solo puedes consultar locomotoras de tu empresa." }, { status: 403 });
    }

    if (role !== "ADMINISTRADOR" && requestedLocalidadId && requestedLocalidadId !== assignedLocalidadId) {
      return NextResponse.json({ message: "Solo puedes consultar rondas de tu localidad." }, { status: 403 });
    }
    if (!localidadId) {
      return NextResponse.json({ message: "No hay una localidad asignada a la sesion." }, { status: 403 });
    }

    const localidadIdParam = String(localidadId);
    const base = getApiBase(origin);
    const headers = authHeaders(req, token);

    if (entity === "torneados") {
      const statusParam = concluido ? "CONCLUIDO,CANCELADO" : "SOLICITADO,EN_PROCESO,DETENIDO";
      const qs = new URLSearchParams({ status: statusParam, localidadId: localidadIdParam });
      const empresaScopeId = generalLocalityView || canSeeAllEmpresas(role) ? null : empresaId;
      if (empresaScopeId) qs.set("empresaId", String(empresaScopeId));
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

        const recordEmpresa = asRecord(movimientoRecord.empresa);
        const recordEmpresaId = firstPositiveNumber(movimientoRecord.empresaId, recordEmpresa.id);
        let empresa: RondaOut["empresa"] = recordEmpresaId
          ? { id: recordEmpresaId, nombre: String(recordEmpresa.nombre ?? "—") }
          : null;
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
              const visibleId = firstPositiveNumber(mv?.folioLocalidad, mv?.id) ?? movimientoId;
              movimiento = {
                id: visibleId,
                idTecnico: firstPositiveNumber(mv?.idTecnico, movimientoId) ?? movimientoId,
                folioLocalidad: mv?.folioLocalidad ?? visibleId,
                folioLocalidadLabel: mv?.folioLocalidadLabel ?? `#${visibleId}`,
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

        if (localidadMovimientoId && localidadId !== localidadMovimientoId) return null;
        if (empresaScopeId && Number(empresa?.id) !== empresaScopeId) return null;
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

    if (isTorreonLocalidad(localidadIdParam)) {
      const scopedEmpresaId = generalLocalityView || canSeeAllEmpresas(role) ? null : empresaId;
      const canReadTorreon = generalLocalityView || Boolean(scopedEmpresaId || canSeeAllEmpresas(role));
      if (!canReadTorreon) return NextResponse.json<RondaOut[]>([], { status: 200 });

      let out: RondaOut[] = [];
      try {
        const params = new URLSearchParams({ localidadId: localidadIdParam });
        if (generalLocalityView) params.set("alcance", "localidad");
        if (concluido) params.set("estado", "CERRADA");
        const raw = await fetchTorreonMsJson(`/rondas?${params.toString()}`);
        out = mapTorreonRondasToOut(raw, concluido, scopedEmpresaId);
      } catch (error) {
        console.warn("[api/cliente/rondas] rondas Torreon error:", error);
      }

      return NextResponse.json(sortRondaQueue(out), { status: 200 });
    }

    const empresaScopeId = generalLocalityView || canSeeAllEmpresas(role) ? null : empresaId;
    const out = await fetchCosaifRondasOut({
      base,
      headers,
      localidadId: localidadIdParam,
      concluido,
      empresaScopeId,
    });
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
    if (containsTrainingReservedId(body)) {
      return NextResponse.json(
        { message: "Los registros SIM sólo existen dentro de la capacitación." },
        { status: 409 }
      );
    }
    const action = String(body?.action || "").toLowerCase();

    const cookieStore = await cookies();
    const token = cookieStore.get(process.env.JWT_COOKIE_NAME || "token")?.value;
    if (!token) return NextResponse.json({ message: "No autorizado" }, { status: 401 });

    const role = readRole(cookieStore);
    const empresaId = readEmpresaId(cookieStore);
    const assignedLocalidadId = readLocalidadId(cookieStore);
    const requestedLocalidadId = firstPositiveNumber(body?.localidadId);
    if (role !== "ADMINISTRADOR" && requestedLocalidadId && requestedLocalidadId !== assignedLocalidadId) {
      return NextResponse.json({ message: "Solo puedes modificar rondas de tu localidad." }, { status: 403 });
    }
    const scopedLocalidadId = role === "ADMINISTRADOR" ? requestedLocalidadId : assignedLocalidadId;
    if (!scopedLocalidadId) {
      return NextResponse.json({ message: "No hay una localidad asignada a la sesion." }, { status: 403 });
    }
    body.localidadId = scopedLocalidadId;
    const shouldScopeEmpresa = shouldScopeToEmpresa(role, empresaId);
    const base = getApiBase(origin);
    const headers = authHeaders(req, token);
    const jsonHeaders = { ...headers, "content-type": "application/json" };

    if (isTorreonLocalidad(body?.localidadId)) {
      if (action === "orden") {
        const id = Number(body?.id ?? body?.rondaMovimientoId);
        const orden = Number(body?.orden);
        if (!Number.isFinite(id) || id <= 0 || !Number.isFinite(orden) || orden <= 0) {
          return NextResponse.json({ message: "Faltan id y orden:number" }, { status: 400 });
        }

        const payload = {
          rondaMovimientoId: id,
          orden,
          ...(shouldScopeEmpresa && empresaId ? { empresaId } : {}),
        };
        const data = await fetchTorreonMsJson("/rondas/movimientos/orden", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        return NextResponse.json(data, { status: 200 });
      }

      return NextResponse.json(
        { message: "Las rondas de Torreon se consultan desde ms_torreon; esta accion no aplica para Torreon." },
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
        if (role !== "ADMINISTRADOR") {
          assertLocalidadScope(scopedLocalidadId, [getInfoLocalidadId(infoA), getInfoLocalidadId(infoB)]);
        }
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
        if (role !== "ADMINISTRADOR") {
          assertLocalidadScope(scopedLocalidadId, [getMovimientoLocalidadId(movimiento)]);
        }
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
