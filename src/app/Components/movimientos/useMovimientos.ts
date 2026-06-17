import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useRealtimeMovimientos,
  type RealtimeMovementEvent,
} from "@/app/hooks/useRealtimeMovimientos";

/* ================== CONFIGURACIÓN ================== */
const DEFAULT_API_BASE = process.env.NEXT_PUBLIC_API_URL || "/bff";
const DEFAULT_AUTO_REFRESH_MS = 60_000;

function normalizeBase(base?: string): string {
  return (base || DEFAULT_API_BASE).replace(/\/+$/, "");
}

function hasTime(input: string): boolean {
  return input.includes("T");
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function formatOffset(date: Date): string {
  const offsetMin = -date.getTimezoneOffset();
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  const hh = pad2(Math.floor(abs / 60));
  const mm = pad2(abs % 60);
  return `${sign}${hh}:${mm}`;
}

function toLocalIso(date: Date): string {
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  const hh = pad2(date.getHours());
  const mm = pad2(date.getMinutes());
  const ss = pad2(date.getSeconds());
  return `${y}-${m}-${d}T${hh}:${mm}:${ss}${formatOffset(date)}`;
}

function toIsoLocalDateTime(input: string): string {
  const [datePart, timePart = "00:00"] = input.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [hh, mm] = timePart.split(":").map(Number);
  if (
    !Number.isFinite(y) ||
    !Number.isFinite(m) ||
    !Number.isFinite(d) ||
    !Number.isFinite(hh) ||
    !Number.isFinite(mm)
  ) {
    return input;
  }
  const dt = new Date(y, m - 1, d, hh, mm, 0, 0);
  return toLocalIso(dt);
}

function toIsoLocalStartOfDay(input: string): string {
  const [y, m, d] = input.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    return input;
  }
  return toLocalIso(new Date(y, m - 1, d, 0, 0, 0, 0));
}

function toIsoLocalEndOfDay(input: string): string {
  const [y, m, d] = input.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    return input;
  }
  return toLocalIso(new Date(y, m - 1, d, 23, 59, 59, 0));
}

function normalizeFechaDesde(input: string): string {
  return hasTime(input) ? toIsoLocalDateTime(input) : toIsoLocalStartOfDay(input);
}

function normalizeFechaHasta(input: string): string {
  return hasTime(input) ? toIsoLocalDateTime(input) : toIsoLocalEndOfDay(input);
}

/* ================== TIPOS ================== */
export type Rol =
  | "ADMINISTRADOR"
  | "COORDINADOR"
  | "SUPERVISOR"
  | "CLIENTE";

export type Ambito = "actuales" | "pasados";
export type FechaCampo = "solicitud" | "inicio" | "fin" | "creacion";
export type DireccionOrden = "asc" | "desc";
export type CampoOrden =
  | "id"
  | "locomotora"
  | "solicitud"
  | "inicio"
  | "fin"
  | "estado"
  | "prioridad"
  | "tipo"
  | "localidad"
  | "empresa";

const DEFAULT_FECHA_CAMPO: FechaCampo = "solicitud";

export interface Movement {
  id: number;
  locomotora: number | string;

  localidadId: number;
  localidadNombre?: string;
  localidadEstado?: string;

  viaOrigen: number | string | null;
  viaDestino: number | string | null;

  tipoAccion: string;
  tipoMovimiento: string;
  prioridad: string;
  estado: string;

  clienteId: number;
  supervisorId: number | null;
  coordinadorId: number | null;
  operadorId: number | null;
  maquinistaId: number | null;
  empresaId: number;
  empresaNombre?: string;

  fechaSolicitud: string | null;
  fechaInicio: string | null;
  fechaFin: string | null;

  instrucciones: string;
  incidenteGlobal: boolean;
  finalizado: boolean;
  lavado: boolean;
  torno: boolean;
  posicionCabina: string;
  posicionChimenea: string;
  direccionEmpuje: string;
  comentarioPostergacion?: string;
  nuevaFechaPostergacion?: string | null;
}

export interface FiltrosMovimientos {
  empresaId?: number | null;
  localidadId?: number | null;
  desde?: string | null;
  hasta?: string | null;
  estado?: string | null;
  prioridad?: string | null;
  locomotiveNumber?: string | null;
  locomotivePrefix?: string | null;
  fechaCampo?: FechaCampo | null;
  pagina: number;
  tamPagina: number;
  campoOrden: CampoOrden;
  direccionOrden: DireccionOrden;
  busqueda: string;
}

export interface UseMovimientosOptions {
  rol: Rol;
  token?: string;
  apiBase?: string;
  autoRefreshMs?: number;
  initialEmpresaId?: number | null;
  initialLocalidadId?: number | null;
}

export interface OpcionCatalogo {
  id: number;
  nombre: string;
}

export type OpcionEmpresa = OpcionCatalogo;
export type OpcionLocalidad = OpcionCatalogo;

/* ================== DTOs DEL BACK ================== */

interface EmpresaDTO {
  id?: number;
  nombre?: string | null;
}

interface LocalidadDTO {
  id?: number;
  nombre?: string | null;
  estado?: string | null;
}

interface ViaDTO {
  id?: number;
  nombre?: string | null;
  numero?: number | null;
}

interface MovementDTO {
  id: number;

  locomotiveNumber?: number | string | null;
  locomotora?: number | string | null;

  localidadId?: number | null;
  localidad?: LocalidadDTO | string | null;

  viaOrigen?: ViaDTO | string | number | null;
  viaDestino?: ViaDTO | string | number | null;

  accion?: string | null;
  tipoMovimiento?: string | null;
  tipo?: string | null;
  prioridad?: string | null;
  estado?: string | null;

  clienteId?: number | null;
  supervisorId?: number | null;
  coordinadorId?: number | null;
  operadorId?: number | null;
  maquinistaId?: number | null;

  empresaId?: number | null;
  empresaNombre?: string | null;
  empresa?: EmpresaDTO | null;

  fechaSolicitud?: string | null;
  fechaInicio?: string | null;
  inicio?: string | null;
  fechaFin?: string | null;
  fin?: string | null;

  instrucciones?: string | null;
  incidenteGlobal?: boolean | null;
  finalizado?: boolean | null;
  lavado?: boolean | null;
  torno?: boolean | null;
  posicionCabina?: string | null;
  posicionChimenea?: string | null;
  direccionEmpuje?: string | null;
  comentarioPostergacion?: string | null;
  nuevaFechaPostergacion?: string | null;
}

interface MovimientosEnvelope {
  items?: MovementDTO[];
  data?: MovementDTO[];
  rows?: MovementDTO[];
  total?: number | string;
  totalItems?: number | string;
  count?: number | string;
  meta?: {
    total?: number | string;
    totalItems?: number | string;
    count?: number | string;
    pagination?: {
      total?: number | string;
      totalItems?: number | string;
      count?: number | string;
    };
  };
  pagination?: {
    total?: number | string;
    totalItems?: number | string;
    count?: number | string;
  };
}

/* ================== CONSTANTES DE NEGOCIO ================== */

const SORT_KEY_MAP: Record<CampoOrden, keyof Movement> = {
  id: "id",
  locomotora: "locomotora",
  inicio: "fechaInicio",
  fin: "fechaFin",
  estado: "estado",
  prioridad: "prioridad",
  tipo: "tipoMovimiento",
  localidad: "localidadNombre",
  empresa: "empresaNombre",
  solicitud: "fechaSolicitud",
};

type SortableKey = (typeof SORT_KEY_MAP)[CampoOrden];
type SortableValue = string | number | null | undefined;

const ESTADOS_ACTUALES = new Set(["SOLICITADO", "EN_PROCESO", "ESPERA"]);
const ESTADOS_PASADOS = new Set(["DETENIDO", "CANCELADO", "CONCLUIDO"]);

function normalizarEstado(estado?: string | null): string {
  return String(estado || "").trim().toUpperCase();
}

/* ================== TYPE GUARDS / HELPERS ================== */

interface WithNombre {
  nombre: string;
}

function hasNombre(value: unknown): value is WithNombre {
  return (
    typeof value === "object" &&
    value !== null &&
    "nombre" in value &&
    typeof (value as { nombre: unknown }).nombre === "string"
  );
}

function normalizarNombre(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (hasNombre(value)) return value.nombre;
  return "—";
}

function esMovementDTOArray(value: unknown): value is MovementDTO[] {
  return Array.isArray(value);
}

function esMovimientosEnvelope(value: unknown): value is MovimientosEnvelope {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as MovimientosEnvelope;
  return (
    Array.isArray(obj.items) ||
    Array.isArray(obj.data) ||
    Array.isArray(obj.rows)
  );
}

function esOpcionCatalogoArray(value: unknown): value is OpcionCatalogo[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as { id?: unknown }).id === "number" &&
        typeof (item as { nombre?: unknown }).nombre === "string"
    )
  );
}

/* ================== MAPEOS ================== */

function mapearDTO(dto: MovementDTO): Movement {
  const nombreEmpresaRaw = dto.empresaNombre ?? dto.empresa?.nombre;
  const empresaNombreFinal =
    typeof nombreEmpresaRaw === "string" && nombreEmpresaRaw.trim().length > 0
      ? nombreEmpresaRaw
      : "Sin Nombre";

  const localidadDto =
    typeof dto.localidad === "object" && dto.localidad !== null
      ? (dto.localidad as LocalidadDTO)
      : undefined;

  return {
    id: dto.id,
    locomotora: dto.locomotiveNumber ?? dto.locomotora ?? "S/N",

    localidadId: dto.localidadId ?? 0,
    localidadNombre: normalizarNombre(dto.localidad),
    localidadEstado: localidadDto?.estado ?? "—",

    viaOrigen: normalizarNombre(dto.viaOrigen),
    viaDestino: normalizarNombre(dto.viaDestino),

    tipoAccion: dto.accion ?? dto.tipoMovimiento ?? "Movimiento",
    tipoMovimiento: dto.tipoMovimiento ?? dto.tipo ?? "N/A",
    prioridad: dto.prioridad ?? "Normal",
    estado: dto.estado ?? "DESCONOCIDO",

    clienteId: dto.clienteId ?? 0,
    supervisorId: dto.supervisorId ?? null,
    coordinadorId: dto.coordinadorId ?? null,
    operadorId: dto.operadorId ?? null,
    maquinistaId: dto.maquinistaId ?? null,
    empresaId: dto.empresaId ?? 0,

    empresaNombre: empresaNombreFinal,

    fechaSolicitud: dto.fechaSolicitud ?? null,
    fechaInicio: dto.fechaInicio ?? dto.inicio ?? null,
    fechaFin: dto.fechaFin ?? dto.fin ?? null,

    instrucciones: dto.instrucciones ?? "",
    incidenteGlobal: Boolean(dto.incidenteGlobal),
    finalizado: Boolean(dto.finalizado),
    lavado: Boolean(dto.lavado),
    torno: Boolean(dto.torno),
    posicionCabina: dto.posicionCabina ?? "N/A",
    posicionChimenea: dto.posicionChimenea ?? "N/A",
    direccionEmpuje: dto.direccionEmpuje ?? "N/A",
    comentarioPostergacion: dto.comentarioPostergacion ?? undefined,
    nuevaFechaPostergacion: dto.nuevaFechaPostergacion ?? null,
  };
}

function obtenerValorOrdenable(
  movement: Movement,
  key: SortableKey
): SortableValue {
  const raw = movement[key];

  if (
    typeof raw === "string" ||
    typeof raw === "number" ||
    raw === null ||
    typeof raw === "undefined"
  ) {
    return raw;
  }

  return String(raw);
}

function compararValores(
  a: SortableValue,
  b: SortableValue,
  direccion: DireccionOrden
): number {
  const factor = direccion === "asc" ? 1 : -1;

  if (a == null && b == null) return 0;
  if (a == null) return 1 * factor;
  if (b == null) return -1 * factor;

  if (typeof a === "number" && typeof b === "number") {
    return (a - b) * factor;
  }

  return (
    String(a).localeCompare(String(b), "es-MX", {
      numeric: true,
      sensitivity: "base",
    }) * factor
  );
}

function ordenarMovimientos(
  items: Movement[],
  campoOrden: CampoOrden,
  direccionOrden: DireccionOrden
): Movement[] {
  const key: SortableKey = SORT_KEY_MAP[campoOrden] ?? "fechaInicio";
  const direction: DireccionOrden = direccionOrden || "desc";

  return [...items].sort((a, b) => {
    const aVal = obtenerValorOrdenable(a, key);
    const bVal = obtenerValorOrdenable(b, key);
    return compararValores(aVal, bVal, direction);
  });
}

function parseTotal(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const num = Number(trimmed);
    if (Number.isFinite(num) && num >= 0) return num;
  }
  return null;
}

function extraerItemsYTotal(
  data: unknown
): { items: MovementDTO[]; total: number | null } {
  if (esMovementDTOArray(data)) {
    return { items: data, total: null };
  }

  if (esMovimientosEnvelope(data)) {
    const { items, data: innerData, rows } = data as MovimientosEnvelope;
    const lista = items ?? innerData ?? rows ?? [];
    const payload = data as MovimientosEnvelope;
    const totalRaw =
      payload.total ??
      payload.totalItems ??
      payload.count ??
      payload.meta?.total ??
      payload.meta?.totalItems ??
      payload.meta?.count ??
      payload.meta?.pagination?.total ??
      payload.meta?.pagination?.totalItems ??
      payload.meta?.pagination?.count ??
      payload.pagination?.total ??
      payload.pagination?.totalItems ??
      payload.pagination?.count;
    return { items: lista, total: parseTotal(totalRaw) };
  }

  return { items: [], total: null };
}

/* ================== HOOK ================== */

export function useMovimientos({
  rol,
  token,
  apiBase,
  autoRefreshMs,
  initialEmpresaId = null,
  initialLocalidadId = null,
}: UseMovimientosOptions) {
  const [ambito, setAmbito] = useState<Ambito>("actuales");

  const tab = useMemo<"Actuales" | "Pasados">(
    () => (ambito === "actuales" ? "Actuales" : "Pasados"),
    [ambito]
  );
  const setTab = useCallback((next: "Actuales" | "Pasados") => {
    setAmbito(next === "Actuales" ? "actuales" : "pasados");
  }, []);

  const [cargando, setCargando] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filas, setFilas] = useState<Movement[]>([]);
  const [total, setTotal] = useState(0);
  const [totalEstimado, setTotalEstimado] = useState(false);

  const [filtros, setFiltros] = useState<FiltrosMovimientos>({
    empresaId: initialEmpresaId ?? undefined,
    localidadId: initialLocalidadId ?? undefined,
    pagina: 1,
    tamPagina: 25,
    campoOrden: "id",
    direccionOrden: "desc",
    busqueda: "",
    fechaCampo: DEFAULT_FECHA_CAMPO,
  });

  const [empresas, setEmpresas] = useState<OpcionEmpresa[]>([]);
  const [localidades, setLocalidades] = useState<OpcionLocalidad[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [status, setStatus] = useState<
    { message: string; type: "info" | "success" | "error" } | null
  >(null);

  const abortRef = useRef<AbortController | null>(null);
  const realtimeRefreshTimerRef = useRef<number | null>(null);
  const base = normalizeBase(apiBase);
  const urlEmpresas = `${base}/empresas/lite`;
  const urlLocalidades = `${base}/localidades/lite`;

  const shouldUseBuscar = useMemo(() => {
    const hasBusqueda = filtros.busqueda.trim().length > 0;
    const hasEstado = Boolean(filtros.estado && String(filtros.estado).trim());
    const hasPrioridad = Boolean(filtros.prioridad && String(filtros.prioridad).trim());
    const hasLocoNum = Boolean(
      filtros.locomotiveNumber && String(filtros.locomotiveNumber).trim()
    );
    const hasLocoPrefix = Boolean(
      filtros.locomotivePrefix && String(filtros.locomotivePrefix).trim()
    );
    const hasFechas = Boolean(filtros.desde || filtros.hasta);

    return (
      ambito === "pasados" ||
      hasBusqueda ||
      hasEstado ||
      hasPrioridad ||
      hasLocoNum ||
      hasLocoPrefix ||
      hasFechas
    );
  }, [
    ambito,
    filtros.busqueda,
    filtros.estado,
    filtros.prioridad,
    filtros.locomotiveNumber,
    filtros.locomotivePrefix,
    filtros.desde,
    filtros.hasta,
  ]);

  /* ---------- HEADERS AUTH ---------- */
  const authHeaders = useMemo(
    () =>
      token
        ? ({
          Authorization: `Bearer ${token}`,
        } satisfies HeadersInit)
        : undefined,
    [token]
  );

  const queryString = useMemo(() => {
    const qs = new URLSearchParams();

    qs.set("page", String(filtros.pagina));
    qs.set("pageSize", String(filtros.tamPagina));

    if (shouldUseBuscar) {
      if (filtros.busqueda.trim()) qs.set("q", filtros.busqueda.trim());
      if (filtros.empresaId != null)
        qs.set("empresaId", String(filtros.empresaId));
      if (filtros.localidadId != null)
        qs.set("localidadId", String(filtros.localidadId));
      if (filtros.estado && String(filtros.estado).trim()) {
        qs.set("estado", String(filtros.estado).trim());
      }
      if (filtros.prioridad && String(filtros.prioridad).trim()) {
        qs.set("prioridad", String(filtros.prioridad).trim());
      }
      if (filtros.locomotiveNumber && String(filtros.locomotiveNumber).trim()) {
        qs.set("locomotiveNumber", String(filtros.locomotiveNumber).trim());
      }
      if (filtros.locomotivePrefix && String(filtros.locomotivePrefix).trim()) {
        qs.set("locomotivePrefix", String(filtros.locomotivePrefix).trim());
      }

      if (ambito === "pasados") qs.set("finalizado", "true");
      if (ambito === "actuales") qs.set("finalizado", "false");

      if (filtros.desde || filtros.hasta) {
        const campo = filtros.fechaCampo ?? DEFAULT_FECHA_CAMPO;
        qs.set("fechaCampo", campo);
        if (filtros.desde) qs.set("fechaDesde", normalizeFechaDesde(filtros.desde));
        if (filtros.hasta) qs.set("fechaHasta", normalizeFechaHasta(filtros.hasta));
      }
    }

    return qs.toString();
  }, [
    filtros.pagina,
    filtros.tamPagina,
    filtros.busqueda,
    filtros.empresaId,
    filtros.localidadId,
    filtros.estado,
    filtros.prioridad,
    filtros.locomotiveNumber,
    filtros.locomotivePrefix,
    filtros.desde,
    filtros.hasta,
    filtros.fechaCampo,
    ambito,
    shouldUseBuscar,
  ]);

  const urlListado = useMemo(() => {
    if (shouldUseBuscar) {
      return `${base}/movimientos/buscar`;
    }
    const emp = filtros.empresaId != null ? String(filtros.empresaId) : "";
    const loc = filtros.localidadId != null ? String(filtros.localidadId) : "";

    if (emp && loc) {
      return `${base}/movimientos/empresa/${encodeURIComponent(emp)}/localidad/${encodeURIComponent(loc)}/pendientes`;
    }
    if (emp) {
      return `${base}/movimientos/empresa/${encodeURIComponent(emp)}/pendientes`;
    }
    if (loc) {
      return `${base}/movimientos/localidad/${encodeURIComponent(loc)}/pendientes`;
    }
    return `${base}/movimientos/pendientes`;
  }, [base, filtros.empresaId, filtros.localidadId, shouldUseBuscar]);


  /* ---------- Catálogos (empresas/localidades) ---------- */
  useEffect(() => {
    const cargarCatalogo = async (
      url: string,
      setter: (d: OpcionCatalogo[]) => void
    ) => {
      try {
        const res = await fetch(url, { headers: authHeaders });
        if (!res.ok) return;
        const data: unknown = await res.json();
        if (esOpcionCatalogoArray(data)) {
          setter(data);
        } else if (
          typeof data === "object" &&
          data !== null &&
          "data" in data &&
          esOpcionCatalogoArray((data as { data?: unknown }).data)
        ) {
          setter((data as { data: OpcionCatalogo[] }).data);
        }
      } catch {
        // silencioso
      }
    };

    cargarCatalogo(urlEmpresas, setEmpresas);
    cargarCatalogo(urlLocalidades, setLocalidades);
  }, [authHeaders, urlEmpresas, urlLocalidades]);

  /* ---------- Fetch de movimientos (filtros backend + orden local) ---------- */
  const fetchMovimientos = useCallback(async () => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    setCargando(true);
    try {
      const res = await fetch(`${urlListado}?${queryString}`, {
        headers: authHeaders,
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`Error HTTP ${res.status}`);
      }

      const data: unknown = await res.json();
      const { items: dtoItems, total: totalItems } = extraerItemsYTotal(data);

      // Mapear DTO → Movement
      let movimientos: Movement[] = dtoItems.map(mapearDTO);

      const estadoFilterRaw = filtros.estado?.trim();
      const beforeFilterCount = movimientos.length;
      let filteredByAmbito = false;
      if (!estadoFilterRaw && !shouldUseBuscar) {
        if (ambito === "actuales") {
          movimientos = movimientos.filter((m) =>
            ESTADOS_ACTUALES.has(normalizarEstado(m.estado))
          );
          filteredByAmbito = true;
        } else if (ambito === "pasados") {
          movimientos = movimientos.filter((m) =>
            ESTADOS_PASADOS.has(normalizarEstado(m.estado))
          );
          filteredByAmbito = true;
        }
      }

      // Orden local (la API no expone orden, así que ordenamos la página actual)
      const campo = filtros.campoOrden || "id";
      const direccion: DireccionOrden = filtros.direccionOrden || "desc";
      movimientos = ordenarMovimientos(movimientos, campo, direccion);

      const pageSize = filtros.tamPagina;
      const page = filtros.pagina;
      const totalConocido = typeof totalItems === "number";
      const looksUnreliable =
        totalConocido &&
        ((totalItems === 0 && movimientos.length > 0) ||
          (totalItems <= page * pageSize && movimientos.length === pageSize));

      let totalFinal = 0;
      let estimado = false;

      const trimmedByAmbito = filteredByAmbito && movimientos.length < beforeFilterCount;

      if (totalConocido && !trimmedByAmbito && !looksUnreliable) {
        totalFinal = totalItems;
      } else if (trimmedByAmbito) {
        estimado = true;
        totalFinal =
          movimientos.length === 0 ? Math.max(0, (page - 1) * pageSize) : page * pageSize + 1;
      } else {
        estimado = true;
        totalFinal =
          movimientos.length < pageSize
            ? (page - 1) * pageSize + movimientos.length
            : page * pageSize + 1;
      }

      setFilas(movimientos);
      setTotal(totalFinal);
      setTotalEstimado(estimado);
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      if (error instanceof Error) {
        console.error("[useMovimientos] Error:", error.message);
      } else {
        console.error("[useMovimientos] Error desconocido:", error);
      }
      setFilas([]);
      setTotal(0);
      setTotalEstimado(false);
    } finally {
      setCargando(false);
      setRefreshing(false);
    }
  }, [
    ambito,
    authHeaders,
    queryString,
    urlListado,
    filtros.campoOrden,
    filtros.direccionOrden,
    filtros.estado,
    filtros.pagina,
    filtros.tamPagina,
    shouldUseBuscar,
  ]);

  const eventMatchesCurrentScope = useCallback(
    (event: RealtimeMovementEvent): boolean => {
      if (event.type === "realtime.ready" || event.type === "realtime.resume") return true;
      if (!event.type) return false;

      const eventEmpresaId = Number(event.empresaId ?? NaN);
      const eventLocalidadId = Number(event.localidadId ?? NaN);

      if (
        filtros.empresaId != null &&
        Number.isFinite(eventEmpresaId) &&
        eventEmpresaId !== Number(filtros.empresaId)
      ) {
        return false;
      }

      if (
        filtros.localidadId != null &&
        Number.isFinite(eventLocalidadId) &&
        eventLocalidadId !== Number(filtros.localidadId)
      ) {
        return false;
      }

      return true;
    },
    [filtros.empresaId, filtros.localidadId]
  );

  const scheduleRealtimeRefresh = useCallback(
    (event: RealtimeMovementEvent) => {
      if (!eventMatchesCurrentScope(event)) return;
      if (typeof window === "undefined") return;
      if (realtimeRefreshTimerRef.current != null) return;

      const jitterMs = 700 + Math.floor(Math.random() * 1_300);
      realtimeRefreshTimerRef.current = window.setTimeout(() => {
        realtimeRefreshTimerRef.current = null;
        fetchMovimientos();
      }, jitterMs);
    },
    [eventMatchesCurrentScope, fetchMovimientos]
  );

  const realtimeLocalidadId = useMemo(() => {
    const normalizedRole = String(rol || "").toUpperCase();
    if (normalizedRole !== "COORDINADOR") return null;
    return filtros.localidadId != null ? Number(filtros.localidadId) : null;
  }, [rol, filtros.localidadId]);

  useRealtimeMovimientos({
    enabled: true,
    localidadId: realtimeLocalidadId,
    onEvent: scheduleRealtimeRefresh,
  });

  useEffect(() => {
    return () => {
      if (realtimeRefreshTimerRef.current != null) {
        clearTimeout(realtimeRefreshTimerRef.current);
      }
    };
  }, []);

  /* ---------- Auto-refresh ---------- */
  useEffect(() => {
    fetchMovimientos();

    if (ambito !== "actuales") {
      return;
    }

    const intervalMs = autoRefreshMs ?? DEFAULT_AUTO_REFRESH_MS;
    const intervalId = setInterval(fetchMovimientos, intervalMs);
    return () => clearInterval(intervalId);
  }, [fetchMovimientos, ambito, autoRefreshMs]);

  /* ---------- Pull to refresh ---------- */
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchMovimientos();
  }, [fetchMovimientos]);

  /* ---------- BADGES / EMPTY TEXT ---------- */
  const badges = useMemo(
    () => ({
      Actuales: filas.filter((m) => !m.finalizado).length,
    }),
    [filas]
  );

  const emptyText =
    ambito === "actuales"
      ? "No hay movimientos activos"
      : "No hay movimientos finalizados";

  /* ---------- API DEL HOOK ---------- */
  return {
    filas,
    total,
    totalEstimado,
    cargando,
    ambito,
    setAmbito,
    filtros,
    setFiltros,
    empresas,
    localidades,
    recargar: fetchMovimientos,

    data: filas,
    loading: cargando,
    refreshing,
    onRefresh,
    tab,
    setTab,
    badges,
    emptyText,
    showForm,
    setShowForm,
    status,
    setStatus,
  };
}
