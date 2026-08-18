/* eslint-disable @typescript-eslint/no-explicit-any */
import { fetchJSON } from "@/lib/api";
import type {
  TornoFilters,
  TornoFinalMeasuresPayload,
  TornoHistoryItem,
  TornoHistoryTab,
  TornoImageRef,
  TornoIncidentChild,
  TornoIncidentParent,
  TornoIncidentPayload,
  TornoListResult,
  TornoLocalidadLite,
  TornoMeasurePosition,
  TornoMeasures,
  TornoNavajaChange,
  TornoNavajaStats,
  TornoPagination,
  TornoReopenPayload,
  TornoResolvePayload,
  TornoServiceStartPayload,
  TornoServiceStatus,
  TornoWheelSide,
  TornoWheelStatus,
  TornoWheelCount,
  TornoWheelWork,
  TornoWorkSummary,
} from "./types";

const API_BASE = "/bff";
const DEFAULT_PAGE_SIZE = 25;
const ACTIVE_STATUSES = new Set(["SOLICITADO", "EN_PROCESO", "DETENIDO"]);
const DONE_STATUSES = new Set(["CONCLUIDO", "CANCELADO"]);
const MEASURE_POSITIONS: TornoMeasurePosition[] = [
  "L1",
  "R1",
  "L2",
  "R2",
  "L3",
  "R3",
  "L4",
  "R4",
  "L5",
  "R5",
  "L6",
  "R6",
];

function withCreds<T>(url: string, init: RequestInit = {}) {
  return fetchJSON<T>(url, {
    credentials: "include",
    mode: "same-origin",
    ...init,
    headers: { ...(init.headers as Record<string, string> | undefined) },
  });
}

function buildQuery(filters: TornoFilters & { tab?: TornoHistoryTab; status?: string }) {
  const params = new URLSearchParams();
  if (filters.page) params.set("page", String(filters.page));
  if (filters.pageSize) params.set("pageSize", String(filters.pageSize));
  if (filters.status) params.set("status", filters.status);
  if (filters.empresaId) params.set("empresaId", String(filters.empresaId));
  if (filters.localidadId) params.set("localidadId", String(filters.localidadId));
  if (filters.search?.trim()) params.set("q", filters.search.trim());
  if (filters.servicioId) params.set("servicioId", String(filters.servicioId));
  if (filters.torneroId) params.set("torneroId", String(filters.torneroId));
  if (filters.numeroLocomotora) params.set("numeroLocomotora", String(filters.numeroLocomotora));
  if (filters.rondaServicioId) params.set("rondaServicioId", String(filters.rondaServicioId));
  if (filters.ruedaSolicitudId) params.set("ruedaSolicitudId", String(filters.ruedaSolicitudId));
  if (filters.numeroNavaja) params.set("numeroNavaja", String(filters.numeroNavaja));
  if (filters.fechaInicio) params.set("fechaInicio", filters.fechaInicio);
  if (filters.fechaFin) params.set("fechaFin", filters.fechaFin);
  return params.toString();
}

async function firstJson<T>(urls: string[], init: RequestInit = {}): Promise<T> {
  let lastError: unknown;
  for (const url of urls) {
    try {
      return await withCreds<T>(url, init);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("No se pudo consultar Torno");
}

async function firstMutation<T>(
  requests: Array<{ url: string; init: RequestInit }>,
): Promise<T> {
  let lastError: unknown;
  for (const req of requests) {
    try {
      return await withCreds<T>(req.url, req.init);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("No se pudo guardar el cambio");
}

function unwrapArray(input: any): any[] {
  if (Array.isArray(input)) return input;
  if (Array.isArray(input?.data)) return input.data;
  if (Array.isArray(input?.items)) return input.items;
  if (Array.isArray(input?.rows)) return input.rows;
  if (Array.isArray(input?.result)) return input.result;
  if (Array.isArray(input?.data?.items)) return input.data.items;
  if (Array.isArray(input?.data?.rows)) return input.data.rows;
  return [];
}

function metaFrom(input: any, fallbackLength: number, page = 1, pageSize = DEFAULT_PAGE_SIZE): TornoPagination {
  const raw = input?.meta ?? input?.pagination ?? input?.data?.meta ?? input?.data?.pagination ?? {};
  const total = Number(input?.total ?? input?.count ?? raw.total ?? raw.count ?? fallbackLength) || fallbackLength;
  const finalPageSize = Number(raw.pageSize ?? raw.limit ?? pageSize) || pageSize;
  const finalPage = Number(raw.page ?? page) || page;
  const totalPages = Number(raw.totalPages ?? Math.max(1, Math.ceil(total / finalPageSize))) || 1;
  return {
    page: finalPage,
    pageSize: finalPageSize,
    total,
    totalPages,
    hasNextPage: Boolean(raw.hasNextPage ?? finalPage < totalPages),
    hasPrevPage: Boolean(raw.hasPrevPage ?? finalPage > 1),
  };
}

function asText(value: any, fallback = "—"): string {
  if (value == null || value === "") return fallback;
  if (typeof value === "string" || typeof value === "number") return String(value);
  return value.nombre ?? value.name ?? value.numero ?? value.id ?? fallback;
}

function upper(value: any): string {
  return String(value ?? "").trim().toUpperCase();
}

function normalizeStatus(value: any): TornoServiceStatus {
  return upper(value || "SIN_ESTADO") as TornoServiceStatus;
}

function normalizeWheelStatus(value: any): TornoWheelStatus {
  return upper(value || "PENDIENTE") as TornoWheelStatus;
}

function isMovementLikeRecord(input: any) {
  return (
    input?.movimiento === input ||
    input?.torno === true ||
    input?.lavado === true ||
    input?.viaOrigenId != null ||
    input?.viaDestinoId != null ||
    input?.fechaSolicitud != null ||
    input?.locomotiveNumber != null
  );
}

function getTornoServiceStatus(input: any) {
  const explicit =
    input?.historialStatus ??
    input?.statusAlmacenado ??
    input?.status ??
    input?.rondaServicio?.status ??
    input?.rondaServicio?.estado ??
    input?.rondaStatus ??
    input?.estadoRonda ??
    input?.estatus;

  if (explicit != null) return explicit;

  // `estado` can be the state of the underlying Movimiento. Movimiento and
  // Torneado are independent; do not infer the Torneado status from it.
  if (!isMovementLikeRecord(input)) return input?.estado ?? input?.tornoG?.estado;
  return input?.tornoG?.estado;
}

function normalizeDate(value: any): string | null {
  if (!value) return null;
  return String(value);
}

function measureValue(input: any): string | number | null {
  if (input == null || input === "") return null;
  if (typeof input === "string" || typeof input === "number") return input;
  return input.valor ?? input.value ?? input.medida ?? input.diametro ?? input.mm ?? null;
}

function normalizePosition(input: any): TornoMeasurePosition | null {
  const raw = upper(input?.posicion ?? input?.position ?? input?.ubicacion ?? input?.key ?? input);
  const direct = MEASURE_POSITIONS.find((pos) => pos === raw);
  if (direct) return direct;
  const side = upper(input?.lado ?? input?.side);
  const idx = input?.eje ?? input?.axis ?? input?.numero ?? input?.index;
  const composed = `${side}${idx}` as TornoMeasurePosition;
  return MEASURE_POSITIONS.includes(composed) ? composed : null;
}

function normalizeWheelCount(input: any): TornoWheelCount | undefined {
  const value = Number(input);
  return value === 4 || value === 6 || value === 8 || value === 12 ? value : undefined;
}

export function normalizeMeasures(input: any): TornoMeasures {
  const measures: TornoMeasures = {};
  if (!input) return measures;

  if (Array.isArray(input)) {
    for (const item of input) {
      const position = normalizePosition(item);
      if (position) measures[position] = measureValue(item);
    }
    return measures;
  }

  if (typeof input === "object") {
    const wheelCount = normalizeWheelCount(
      input.wheelCount ?? input.cantidadRuedas ?? input.totalWheels ?? input.numeroRuedas
    );
    if (wheelCount) measures.wheelCount = wheelCount;

    for (const position of MEASURE_POSITIONS) {
      const lower = position.toLowerCase();
      const raw = input[position] ?? input[lower] ?? input[position.replace("", "")];
      if (raw != null) measures[position] = measureValue(raw);
    }

    for (const key of Object.keys(input)) {
      const position = normalizePosition(key);
      if (position && measures[position] == null) measures[position] = measureValue(input[key]);
    }
  }

  return measures;
}

function normalizeImages(input: any): TornoImageRef[] {
  const pieces = [
    ...(Array.isArray(input?.imagenes) ? input.imagenes : []),
    ...(Array.isArray(input?.images) ? input.images : []),
    ...(Array.isArray(input?.fotos) ? input.fotos : []),
    input?.imagen1,
    input?.imagen2,
    input?.imagen3,
    input?.foto1,
    input?.foto2,
    input?.foto3,
  ].filter(Boolean);

  return pieces
    .slice(0, 3)
    .map((image: any, index) => {
      const url = typeof image === "string" ? image : image.url ?? image.ruta ?? image.path ?? image.src;
      return url ? { id: image.id ?? index, url: String(url), name: image.nombre ?? image.name } : null;
    })
    .filter(Boolean) as TornoImageRef[];
}

function normalizeWheelSide(input: any): TornoWheelSide {
  const side = upper(input);
  return side === "R" ? "R" : "L";
}

function normalizeWheelWork(input: any): TornoWheelWork {
  return {
    id: input.id ?? `${input.lado ?? input.side ?? "L"}-${input.posicion ?? input.position ?? 0}`,
    side: normalizeWheelSide(input.lado ?? input.side),
    position: Number(input.posicion ?? input.position ?? input.eje ?? 0) || 0,
    status: normalizeWheelStatus(input.estado ?? input.status),
    startAt: normalizeDate(input.fechaInicio ?? input.startAt),
    endAt: normalizeDate(input.fechaFin ?? input.endAt),
    durationSeconds: input.duracionSegundos == null ? null : Number(input.duracionSegundos),
    original: input,
  };
}

function normalizeWorkSummary(input: any): TornoWorkSummary | null {
  const source = input?.torno ?? input?.tornoG ?? input;
  if (!source) return null;
  const requestedWheelCount = normalizeWheelCount(
    input?.medidasSolicitadas?.wheelCount ??
      input?.ruedaSolicitud?.wheelCount ??
      input?.wheelCount ??
      input?.cantidadRuedas
  );
  const rawWheels = source.detalleRuedas ?? source.wheels ?? source.ruedas ?? [];
  const wheels = Array.isArray(rawWheels)
    ? rawWheels
        .map(normalizeWheelWork)
        .filter((wheel) => wheel.position >= 1 && wheel.position <= 6)
        .sort((a, b) => a.position - b.position || a.side.localeCompare(b.side))
    : [];

  return {
    id: source.id,
    status: source.estado ?? source.status,
    totalWheels:
      Number(source.cantidadRuedas ?? source.totalWheels ?? requestedWheelCount ?? wheels.length) ||
      requestedWheelCount ||
      wheels.length,
    completedWheels:
      Number(source.ruedasTerminadas ?? source.completedWheels) ||
      wheels.filter((wheel) => upper(wheel.status) === "TERMINADO").length,
    startAt: normalizeDate(source.fechaInicio ?? source.startAt),
    endAt: normalizeDate(source.fechaFin ?? source.endAt),
    wheels,
  };
}

function normalizeChildIncident(input: any, parentId?: string | number): TornoIncidentChild {
  const resolved = input.resuelto === true || isResolvedStatus(input.estado ?? input.status ?? input.estatus);
  return {
    id: input.id ?? input.seguimientoId ?? cryptoSafeId(),
    parentId: input.parentId ?? input.incidentePadreId ?? input.incidenteTornoId ?? input.incidenteId ?? parentId,
    description: input.descripcion ?? input.description ?? input.comentario ?? input.comments ?? "Seguimiento",
    status: resolved ? "RESUELTO" : upper(input.estado ?? input.status ?? input.estatus ?? "PENDIENTE"),
    createdAt: normalizeDate(input.fechaCreacion ?? input.createdAt ?? input.fechaInicio ?? input.fecha),
    resolvedAt: normalizeDate(input.fechaTerminacion ?? input.fechaResolucion ?? input.resolvedAt ?? input.fechaFin),
    user: asText(input.usuario ?? input.user ?? input.creadoPor, ""),
    comments: input.comentarioResolucion ?? input.comentarios ?? input.comments,
    images: normalizeImages(input),
    original: input,
  };
}

function normalizeParentIncident(input: any): TornoIncidentParent {
  const rawChildren = input.hijos ?? input.seguimientos ?? input.children ?? input.incidentesHijos ?? [];
  const failureType = normalizeFailureType(input.tipoFalla ?? input.failureType ?? input.tipo ?? "FALLO_SISTEMA");
  const resolved = input.resuelto === true || isResolvedStatus(input.estado ?? input.status ?? input.estatus);
  return {
    id: input.id ?? input.incidenteId ?? cryptoSafeId(),
    title: input.titulo ?? input.title ?? humanFailureType(failureType),
    description: input.descripcion ?? input.description ?? input.comentario ?? "Sin descripcion",
    failureType,
    status: resolved ? "RESUELTO" : upper(input.estado ?? input.status ?? input.estatus ?? "ABIERTO"),
    createdAt: normalizeDate(input.fechaCreacion ?? input.createdAt ?? input.fechaInicio ?? input.fecha),
    resolvedAt: normalizeDate(input.fechaTerminacion ?? input.fechaAtencion ?? input.fechaResolucion ?? input.resolvedAt ?? input.fechaFin),
    user: asText(input.usuario ?? input.user ?? input.creadoPor, ""),
    comments: input.comentarioResolucion ?? input.comentarios ?? input.comments,
    images: normalizeImages(input),
    children: Array.isArray(rawChildren)
      ? rawChildren.map((child: any) => normalizeChildIncident(child, input.id ?? input.incidenteId))
      : [],
    original: input,
  };
}

function groupIncidents(input: any[]): TornoIncidentParent[] {
  const parents = new Map<string | number, TornoIncidentParent>();
  const children: TornoIncidentChild[] = [];

  for (const item of input) {
    const parentId = item.parentId ?? item.incidentePadreId ?? item.incidenteTornoId ?? item.padreId;
    const isChild = parentId != null || item.tipoRegistro === "HIJO" || item.esSeguimiento === true;
    if (isChild) {
      children.push(normalizeChildIncident(item, parentId));
      continue;
    }
    const parent = normalizeParentIncident(item);
    parents.set(parent.id, parent);
  }

  for (const child of children) {
    const parentId = child.parentId;
    if (parentId != null && parents.has(parentId)) {
      parents.get(parentId)?.children.push(child);
    }
  }

  return Array.from(parents.values());
}

function normalizeFailureType(input: any) {
  const value = upper(input).replace(/\s+/g, "_");
  if (value.includes("NAVAJA")) return "NAVAJAS";
  return "FALLO_SISTEMA";
}

function humanFailureType(input: any) {
  const value = normalizeFailureType(input);
  if (value === "NAVAJAS") return "Navajas";
  return "Fallo sistema";
}

function isResolvedStatus(value: any) {
  const status = upper(value);
  return status === "RESUELTO" || status === "CERRADO" || status === "CONCLUIDO";
}

function normalizeHistoryItem(input: any): TornoHistoryItem {
  const status = normalizeStatus(getTornoServiceStatus(input));
  const incidentSource = input.incidentesPadre ?? input.incidentes ?? input.incidents ?? [];
  const original = input?.original && typeof input.original === "object" ? input.original : input;
  const movimiento = input.movimiento ?? input.ruedaSolicitud?.movimiento ?? input.ruedaSolicitud?.movimientoOriginal;
  const work = normalizeWorkSummary(input);

  return {
    id: input.rondaServicioId ?? input.servicioId ?? input.id ?? input.tornoId ?? input.servicioTornoId,
    servicioId: input.servicioId,
    rondaServicioId: input.rondaServicioId ?? input.id,
    ruedaSolicitudId: input.ruedaSolicitudId ?? input.ruedaSolicitud?.id ?? null,
    movimientoId: input.movimientoId ?? movimiento?.id ?? movimiento?.movimientoId ?? null,
    localidadId: input.localidadId ?? movimiento?.localidadId ?? movimiento?.localidad?.id ?? null,
    empresaId: input.empresaId ?? movimiento?.empresaId ?? movimiento?.empresa?.id ?? null,
    status,
    storedStatus: normalizeStatus(input.statusAlmacenado ?? input.storedStatus ?? status),
    locomotive: input.numeroLocomotora ?? input.locomotiveNumber ?? input.locomotora,
    numeroLocomotora: input.numeroLocomotora ?? input.locomotiveNumber ?? input.locomotora,
    service: input.servicio ?? input.service ?? "Torno",
    companyName: asText(input.empresaNombre ?? input.companyName ?? input.empresa ?? movimiento?.empresa, ""),
    localityName: asText(input.localidadNombre ?? input.localityName ?? input.localidad ?? movimiento?.localidad, ""),
    originName: asText(input.origenNombre ?? input.originName ?? input.origen ?? movimiento?.viaOrigen, ""),
    destinationName: asText(input.destinoNombre ?? input.destinationName ?? input.destino ?? movimiento?.viaDestino, ""),
    priority: input.prioridad ?? movimiento?.prioridad ?? null,
    rondaNumber: input.rondaNumero ?? input.ronda?.numero ?? input.rondaId ?? null,
    orderNumber: input.orden ?? input.numeroOrden ?? movimiento?.orden ?? null,
    startAt: normalizeDate(input.inicio ?? input.fechaInicio ?? input.torno?.fechaInicio ?? input.tornoG?.fechaInicio),
    endAt: normalizeDate(input.fin ?? input.fechaFin ?? input.torno?.fechaFin ?? input.tornoG?.fechaFin),
    date: normalizeDate(input.creadoEn ?? input.fecha ?? input.fechaSolicitud ?? input.createdAt),
    updatedAt: normalizeDate(input.actualizadoEn ?? input.updatedAt),
    operator: asText(input.tornero ?? input.operador ?? input.usuario ?? input.user ?? input.torneroNombre ?? input.torneroId, ""),
    operatorId: input.torneroId ?? input.operadorId ?? null,
    measuresRequested: normalizeMeasures(input.medidasSolicitadas ?? input.medidasInicio ?? input.medidasIniciales),
    measuresFinal: normalizeMeasures(input.medidasFinales ?? input.medidasFin),
    work,
    activeIncidents: Number(input.incidentesActivos ?? 0) || 0,
    hasIncident: Boolean(input.tieneIncidente ?? (Array.isArray(incidentSource) && incidentSource.length > 0)),
    incidents: Array.isArray(incidentSource) ? groupIncidents(incidentSource) : [],
    original,
  };
}

function filterHistoryByTab(items: TornoHistoryItem[], tab: TornoHistoryTab) {
  const allowed = tab === "activos" ? ACTIVE_STATUSES : DONE_STATUSES;
  return items.filter((item) => allowed.has(upper(item.status)));
}

function filterHistoryByScope(items: TornoHistoryItem[], filters: TornoFilters) {
  const empresaId = Number(filters.empresaId);
  const localidadId = Number(filters.localidadId);
  const hasEmpresaScope = Number.isFinite(empresaId) && empresaId > 0;
  const hasLocalidadScope = Number.isFinite(localidadId) && localidadId > 0;

  return items.filter((item) => {
    if (hasEmpresaScope && Number(item.empresaId) !== empresaId) return false;
    if (hasLocalidadScope && Number(item.localidadId) !== localidadId) return false;
    return true;
  });
}

function cryptoSafeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `tmp-${Date.now()}-${Math.round(Math.random() * 10000)}`;
}

function isHttpStatus(error: unknown, status: number) {
  return error instanceof Error && error.message.startsWith(`HTTP ${status}:`);
}

function jsonInit(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

function numberField(value?: string | number | null) {
  if (value == null || value === "") return undefined;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error ?? new Error("No se pudo leer la imagen"));
    reader.readAsDataURL(file);
  });
}

async function imageFields(files?: File[]) {
  const selected = (files ?? []).slice(0, 3);
  const encoded = await Promise.all(selected.map(fileToBase64));
  return {
    imagen1: encoded[0],
    imagen2: encoded[1],
    imagen3: encoded[2],
  };
}

async function parentIncidentBody(payload: TornoIncidentPayload) {
  const images = await imageFields(payload.images);
  return {
    tipoFalla: normalizeFailureType(payload.failureType),
    comentario: payload.comments || payload.description,
    creadoPorId: payload.creadoPorId,
    numeroLocomotora: payload.numeroLocomotora,
    rondaServicioId: payload.rondaServicioId,
    ruedaSolicitudId: payload.ruedaSolicitudId,
    ...images,
  };
}

async function childIncidentBody(payload: TornoIncidentPayload) {
  const images = await imageFields(payload.images);
  return {
    comentario: payload.comments || payload.description,
    ...images,
  };
}

export async function listTornoHistory(
  tab: TornoHistoryTab,
  filters: TornoFilters = {},
): Promise<TornoListResult<TornoHistoryItem>> {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE;
  const status = tab === "activos" ? "SOLICITADO,EN_PROCESO,DETENIDO" : "CONCLUIDO,CANCELADO";
  const query = buildQuery({ ...filters, status, page, pageSize });
  const raw = await firstJson<any>([`${API_BASE}/torno/rondas-servicio/historial?${query}`]);
  const rows = unwrapArray(raw);
  const normalized = filterHistoryByTab(rows.map(normalizeHistoryItem), tab);
  const scoped = filterHistoryByScope(normalized, filters);
  const upstreamScopeWasApplied = scoped.length === normalized.length;
  return {
    items: scoped,
    meta: upstreamScopeWasApplied
      ? metaFrom(raw, scoped.length, page, pageSize)
      : {
          page: 1,
          pageSize,
          total: scoped.length,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        },
  };
}

export async function getTornoHistoryDetail(id: string | number): Promise<TornoHistoryItem> {
  const raw = await firstJson<any>([
    `${API_BASE}/torno/rondas-servicio/historial?rondaServicioId=${encodeURIComponent(String(id))}`,
    `${API_BASE}/torno/rondas-servicio/historial?servicioId=${encodeURIComponent(String(id))}`,
  ]);
  const first = Array.isArray(raw) ? raw[0] : unwrapArray(raw)[0] ?? raw;
  if (!first) throw new Error("Servicio Torno no encontrado");
  let detail = normalizeHistoryItem(first);
  try {
    const serviceId = detail.rondaServicioId ?? detail.id;
    const rawDetail = await firstJson<any>([
      `${API_BASE}/torno/rondas-servicio/${encodeURIComponent(String(serviceId))}`,
    ]);
    const serviceDetail = normalizeHistoryItem(rawDetail);
    detail = {
      ...serviceDetail,
      ...detail,
      ruedaSolicitudId: serviceDetail.ruedaSolicitudId ?? detail.ruedaSolicitudId,
      measuresRequested: Object.keys(detail.measuresRequested ?? {}).length
        ? detail.measuresRequested
        : serviceDetail.measuresRequested,
      measuresFinal: Object.keys(detail.measuresFinal ?? {}).length
        ? detail.measuresFinal
        : serviceDetail.measuresFinal,
      work: serviceDetail.work ?? detail.work,
    };
  } catch {
    // Historial puede operar sin detalle crudo, salvo cierre con medidas finales.
  }
  try {
    const incidentResult = await listTornoIncidents({
      rondaServicioId: detail.rondaServicioId ?? id,
      ruedaSolicitudId: detail.servicioId,
      numeroLocomotora: detail.numeroLocomotora,
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
    });
    detail.incidents = incidentResult.items;
  } catch {
    detail.incidents = detail.incidents ?? [];
  }
  return detail;
}

export async function startTornoService(
  rondaServicioId: string | number,
  payload: TornoServiceStartPayload,
) {
  return firstMutation([
    {
      url: `${API_BASE}/torno/rondas-servicio/${rondaServicioId}/iniciar`,
      init: jsonInit("POST", payload),
    },
  ]);
}

export async function startTornoAxis(
  rondaServicioId: string | number,
  position: number,
  payload: { lados?: TornoWheelSide[]; fechaInicio?: string } = {},
) {
  return firstMutation([
    {
      url: `${API_BASE}/torno/rondas-servicio/${rondaServicioId}/ejes/${position}/iniciar`,
      init: jsonInit("POST", payload),
    },
  ]);
}

export async function finishTornoAxis(
  rondaServicioId: string | number,
  position: number,
  payload: { lados?: TornoWheelSide[]; fechaFin?: string } = {},
) {
  return firstMutation([
    {
      url: `${API_BASE}/torno/rondas-servicio/${rondaServicioId}/ejes/${position}/finalizar`,
      init: jsonInit("POST", payload),
    },
  ]);
}

function measuresBody(payload: TornoFinalMeasuresPayload) {
  const body: Record<string, unknown> = {
    ruedaSolicitudId: Number(payload.ruedaSolicitudId),
    torneroId: Number(payload.torneroId),
  };
  for (const position of MEASURE_POSITIONS) {
    const key = position.toLowerCase();
    body[key] = payload.measures[position] ?? "";
  }
  return body;
}

export async function upsertTornoFinalMeasures(payload: TornoFinalMeasuresPayload) {
  return firstMutation([
    {
      url: `${API_BASE}/torno/ruedas-finales`,
      init: jsonInit("POST", measuresBody(payload)),
    },
  ]);
}

export async function concludeTornoService(
  rondaServicioId: string | number,
  payload: { ruedasFinalId?: string | number; fin?: string } = {},
) {
  return firstMutation([
    {
      url: `${API_BASE}/torno/rondas-servicio/${rondaServicioId}/concluir`,
      init: jsonInit("POST", {
        ruedasFinalId: payload.ruedasFinalId == null ? undefined : Number(payload.ruedasFinalId),
        fin: payload.fin,
      }),
    },
  ]);
}

export async function cancelTornoService(
  rondaServicioId: string | number,
  payload: { fin?: string } = {},
) {
  return firstMutation([
    {
      url: `${API_BASE}/torno/rondas-servicio/${rondaServicioId}/cancelar-externo`,
      init: jsonInit("POST", payload),
    },
  ]);
}

export async function listTornoIncidents(filters: TornoFilters = {}) {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE;
  const query = buildQuery({ ...filters, page, pageSize });
  const url = query ? `${API_BASE}/torno/incidentes?${query}` : `${API_BASE}/torno/incidentes`;
  try {
    const raw = await firstJson<any>([url]);
    const rows = groupIncidents(unwrapArray(raw));
    return { items: rows, meta: metaFrom(raw, rows.length, page, pageSize) };
  } catch (error) {
    if (isHttpStatus(error, 404)) {
      return { items: [], meta: metaFrom(null, 0, page, pageSize) };
    }
    throw error;
  }
}

export async function createParentIncident(payload: TornoIncidentPayload) {
  const body = await parentIncidentBody(payload);
  return firstMutation([{ url: `${API_BASE}/torno/incidentes`, init: jsonInit("POST", body) }]);
}

export async function addIncidentChild(parentId: string | number, payload: TornoIncidentPayload) {
  const body = await childIncidentBody({ ...payload, parentId });
  return firstMutation([{ url: `${API_BASE}/torno/incidentes/${parentId}/hijos`, init: jsonInit("POST", body) }]);
}

export async function updateParentIncident(
  incident: TornoIncidentParent,
  patch: Partial<TornoIncidentPayload> & { status?: string },
) {
  if (upper(patch.status) === "RESUELTO" || upper(patch.status) === "CERRADO") {
    return resolveParentIncident(incident, {
      comments: patch.comments,
      atendidoPorId: patch.atendidoPorId,
    });
  }
  if (upper(patch.status) === "EN_PROCESO") {
    return reopenParentIncident(incident, { comments: patch.comments });
  }
  const body = {
    tipoFalla: "FALLO_SISTEMA",
    comentario: patch.comments || patch.description,
    descripcion: patch.description,
    comments: patch.comments,
    fechaActualizacion: new Date().toISOString(),
  };
  return firstMutation([
    {
      url: `${API_BASE}/torno/incidentes/${incident.id}`,
      init: jsonInit("PATCH", body),
    },
    {
      url: `${API_BASE}/torno/incidentes/${incident.id}`,
      init: jsonInit("PUT", body),
    },
  ]);
}

export async function resolveParentIncident(
  incident: TornoIncidentParent,
  payload: TornoResolvePayload = {},
) {
  const body = {
    status: "RESUELTO",
    resuelto: true,
    atendidoPorId: payload.atendidoPorId,
    fechaTerminacion: new Date().toISOString(),
  };
  const result = await withCreds(`${API_BASE}/torno/incidentes/${incident.id}`, jsonInit("PATCH", body));

  const pendingChildren = incident.children.filter((child) => !isResolvedStatus(child.status));
  await Promise.all(
    pendingChildren.map((child) =>
      withCreds(`${API_BASE}/torno/incidentes-hijos/${child.id}`, jsonInit("PATCH", {
        status: "RESUELTO",
        resuelto: true,
      })),
    ),
  );

  return result;
}

export async function resolveChildIncident(child: TornoIncidentChild, payload: TornoResolvePayload = {}) {
  void payload;
  const body = {
    status: "RESUELTO",
    resuelto: true,
  };
  return withCreds(`${API_BASE}/torno/incidentes-hijos/${child.id}`, jsonInit("PATCH", body));
}

export async function reopenParentIncident(
  incident: TornoIncidentParent,
  payload: TornoReopenPayload = {},
) {
  const body = {
    status: "EN_PROCESO",
    resuelto: false,
    fechaTerminacion: null,
    comentario: payload.comments || undefined,
  };
  return withCreds(`${API_BASE}/torno/incidentes/${incident.id}`, jsonInit("PATCH", body));
}

export async function listNavajaChanges(filters: TornoFilters = {}): Promise<TornoListResult<TornoNavajaChange>> {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE;
  const query = buildQuery({ ...filters, page, pageSize });
  const raw = await firstJson<any>([`${API_BASE}/torno/cambios-navaja?${query}`]);
  const rows = unwrapArray(raw).map(normalizeNavajaChange);
  return { items: rows, meta: metaFrom(raw, rows.length, page, pageSize) };
}

export async function getNavajaStats(filters: Pick<TornoFilters, "localidadId"> = {}): Promise<TornoNavajaStats> {
  const params = new URLSearchParams();
  if (filters.localidadId) params.set("localidadId", String(filters.localidadId));
  const query = params.toString();
  return firstJson<TornoNavajaStats>([
    `${API_BASE}/torno/cambios-navaja/estadisticas${query ? `?${query}` : ""}`,
  ]);
}

export async function createNavajaChange(payload: {
  localidadId?: string | number;
  numeroNavaja?: string | number;
  creadoPorId?: string | number;
  fechaCambio?: string;
  comments?: string;
  images?: File[];
}) {
  const images = await imageFields(payload.images);
  return firstMutation([
    {
      url: `${API_BASE}/torno/cambios-navaja`,
      init: jsonInit("POST", {
        localidadId: numberField(payload.localidadId),
        numeroNavaja: numberField(payload.numeroNavaja),
        comentario: payload.comments,
        creadoPorId: numberField(payload.creadoPorId),
        fechaCambio: payload.fechaCambio,
        ...images,
      }),
    },
  ]);
}

export async function listLocalidadesLite(): Promise<TornoLocalidadLite[]> {
  const raw = await firstJson<any>([`${API_BASE}/localidades/lite`]);
  return unwrapArray(raw).map((item) => ({
    id: item.id,
    nombre: asText(item.nombre ?? item.name ?? item.id, "Localidad"),
  }));
}

export async function configureNavajas(payload: { localidadId?: string | number; cantidad?: string | number }) {
  return firstMutation([
    {
      url: `${API_BASE}/torno/navajas`,
      init: jsonInit("POST", {
        localidadId: numberField(payload.localidadId),
        cantidad: payload.cantidad == null ? undefined : Number(payload.cantidad),
      }),
    },
  ]);
}

function normalizeNavajaChange(input: any): TornoNavajaChange {
  return {
    id: input.id ?? input.cambioId ?? cryptoSafeId(),
    localidadId: input.localidadId,
    numeroNavaja: input.numeroNavaja,
    status: input.estado ?? input.status ?? "PENDIENTE",
    fechaCambio: normalizeDate(input.fechaCambio),
    requestedAt: normalizeDate(input.fechaCambio ?? input.createdAt),
    completedAt: normalizeDate(input.fechaFin ?? input.completedAt),
    user: asText(input.usuario ?? input.user ?? input.creadoPorId, ""),
    comments: input.comentario ?? input.comentarios ?? input.comments ?? input.observaciones,
    images: normalizeImages(input),
    nava: input.nava
      ? {
          id: input.nava.id,
          localidadId: input.nava.localidadId,
          cantidad: Number(input.nava.cantidad) || undefined,
          createdAt: normalizeDate(input.nava.createdAt),
          updatedAt: normalizeDate(input.nava.updatedAt),
        }
      : undefined,
    original: input,
  };
}

export function toTornoImageUrl(url: string) {
  if (!url) return "";
  if (url.startsWith("blob:") || url.startsWith("data:")) return url;
  if (url.startsWith(`${API_BASE}/`)) return url;
  if (url.startsWith("/torno/imagenes")) return `${API_BASE}${url}`;
  if (/^https?:\/\//i.test(url)) {
    try {
      const parsed = new URL(url);
      if (parsed.pathname.includes("/torno/imagenes")) {
        return `${API_BASE}${parsed.pathname}${parsed.search}`;
      }
      return `${API_BASE}/torno/imagenes?ruta=${encodeURIComponent(parsed.pathname + parsed.search)}`;
    } catch {
      return url;
    }
  }
  return `${API_BASE}/torno/imagenes?ruta=${encodeURIComponent(url)}`;
}
