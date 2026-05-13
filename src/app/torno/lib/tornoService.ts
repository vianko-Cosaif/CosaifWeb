/* eslint-disable @typescript-eslint/no-explicit-any */
import { fetchJSON } from "@/lib/api";
import type {
  TornoFilters,
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
  TornoPagination,
  TornoReopenPayload,
  TornoResolvePayload,
  TornoServiceStatus,
} from "./types";

const API_BASE = "/bff";
const DEFAULT_PAGE_SIZE = 25;
const ACTIVE_STATUSES = new Set(["SOLICITADO", "EN_PROCESO"]);
const DONE_STATUSES = new Set(["CONCLUIDO", "DETENIDO", "CANCELADO"]);
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

function authFromCookie(): HeadersInit {
  if (typeof document === "undefined") return {};
  const match = document.cookie.match(/(?:^|;\s*)token=([^;]+)/);
  return match ? { Authorization: `Bearer ${decodeURIComponent(match[1])}` } : {};
}

function withCreds<T>(url: string, init: RequestInit = {}) {
  return fetchJSON<T>(url, {
    credentials: "include",
    mode: "same-origin",
    ...init,
    headers: { ...(init.headers as Record<string, string> | undefined), ...authFromCookie() },
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

  return {
    id: input.rondaServicioId ?? input.servicioId ?? input.id ?? input.tornoId ?? input.servicioTornoId,
    servicioId: input.servicioId,
    rondaServicioId: input.rondaServicioId,
    status,
    locomotive: input.numeroLocomotora ?? input.locomotiveNumber ?? input.locomotora,
    numeroLocomotora: input.numeroLocomotora ?? input.locomotiveNumber ?? input.locomotora,
    service: input.servicio ?? input.service ?? "Torno",
    startAt: normalizeDate(input.inicio ?? input.fechaInicio ?? input.torno?.fechaInicio),
    endAt: normalizeDate(input.fin ?? input.fechaFin ?? input.torno?.fechaFin),
    date: normalizeDate(input.creadoEn ?? input.fecha ?? input.fechaSolicitud ?? input.createdAt),
    operator: asText(input.tornero ?? input.operador ?? input.usuario ?? input.user ?? input.torneroId, ""),
    measuresRequested: normalizeMeasures(input.medidasSolicitadas ?? input.medidasInicio ?? input.medidasIniciales),
    measuresFinal: normalizeMeasures(input.medidasFinales ?? input.medidasFin),
    incidents: Array.isArray(incidentSource) ? groupIncidents(incidentSource) : [],
    original: input,
  };
}

function filterHistoryByTab(items: TornoHistoryItem[], tab: TornoHistoryTab) {
  const allowed = tab === "activos" ? ACTIVE_STATUSES : DONE_STATUSES;
  return items.filter((item) => allowed.has(upper(item.status)));
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
  const status = tab === "activos" ? "SOLICITADO,EN_PROCESO" : "CONCLUIDO,DETENIDO,CANCELADO";
  const query = buildQuery({ ...filters, status, page, pageSize });
  const raw = await firstJson<any>([`${API_BASE}/torno/rondas-servicio/historial?${query}`]);
  const rows = unwrapArray(raw);
  const normalized = filterHistoryByTab(rows.map(normalizeHistoryItem), tab);
  return {
    items: normalized,
    meta: metaFrom(raw, normalized.length, page, pageSize),
  };
}

export async function getTornoHistoryDetail(id: string | number): Promise<TornoHistoryItem> {
  const raw = await firstJson<any>([
    `${API_BASE}/torno/rondas-servicio/historial?rondaServicioId=${encodeURIComponent(String(id))}`,
    `${API_BASE}/torno/rondas-servicio/historial?servicioId=${encodeURIComponent(String(id))}`,
  ]);
  const first = Array.isArray(raw) ? raw[0] : unwrapArray(raw)[0] ?? raw;
  if (!first) throw new Error("Servicio Torno no encontrado");
  const detail = normalizeHistoryItem(first);
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
        localidadId: payload.localidadId,
        numeroNavaja: payload.numeroNavaja,
        comentario: payload.comments,
        creadoPorId: payload.creadoPorId,
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
        localidadId: payload.localidadId,
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
