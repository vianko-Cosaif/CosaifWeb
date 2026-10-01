import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import {
  useRealtimeMovimientos,
  type RealtimeMovementEvent,
} from "@/features/movimientos/useRealtimeMovimientos";
import type { AppRole, AuthorizationProfile } from "@/lib/accessControl";
import { cachedFetchJson } from "@/lib/http/client";

import { DEFAULT_MOVEMENT_FILTERS, CLOSED_MOVEMENT_STATES, movementDateBoundary, movementFilterError, movementFilterPolicy, movementSearchParams, normalizeMovementFilters, type MovementFilterScope } from './filterRules';

/* ================== CONFIGURACIÓN ================== */
const DEFAULT_API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL || "/bff";
const DEFAULT_AUTO_REFRESH_MS = 60_000;

function normalizeBase(base?: string): string {
  return (base || DEFAULT_API_BASE).replace(/\/+$/, "");
}

/* ================== TIPOS ================== */
export type Rol = AppRole;

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



export interface Movement {
  id: number;
  idTecnico?: number | null;
  rondaNumero?: number | null;
  ordenEnRonda?: number | null;
  folioLocalidad?: number | null;
  folioLocalidadLabel?: string | null;
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
  clienteNombre?: string;
  supervisorId: number | null;
  supervisorNombre?: string;
  coordinadorId: number | null;
  coordinadorNombre?: string;
  operadorId: number | null;
  operadorNombre?: string;
  maquinistaId: number | null;
  maquinistaNombre?: string;
  empresaId: number;
  empresaNombre?: string;

  fechaCreacion?: string | null;
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
  apiBase?: string;
  autoRefreshMs?: number;
  initialEmpresaId?: number | null;
  initialLocalidadId?: number | null;
  authorization?: AuthorizationProfile;
  bloquearLocalidad?: boolean;
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

interface UsuarioDTO {
  id?: number;
  nombre?: string | null;
  rol?: string | null;
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

export interface MovementDTO {
  id: number;
  idTecnico?: number | null;
  folioLocalidad?: number | null;
  folioLocalidadLabel?: string | null;

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
  clienteNombre?: string | null;
  cliente?: UsuarioDTO | null;
  supervisorId?: number | null;
  supervisorNombre?: string | null;
  supervisor?: UsuarioDTO | null;
  coordinadorId?: number | null;
  coordinadorNombre?: string | null;
  coordinador?: UsuarioDTO | null;
  operadorId?: number | null;
  operadorNombre?: string | null;
  operador?: UsuarioDTO | null;
  maquinistaId?: number | null;
  maquinistaNombre?: string | null;
  maquinista?: UsuarioDTO | null;

  empresaId?: number | null;
  empresaNombre?: string | null;
  empresa?: EmpresaDTO | null;

  createdAt?: string | null;
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
  id: "folioLocalidad",
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

function normalizarNombreUsuario(
  directo: unknown,
  usuario: UsuarioDTO | null | undefined
): string {
  const nombreDirecto = typeof directo === "string" ? directo.trim() : "";
  if (nombreDirecto) return nombreDirecto;
  const nombreUsuario = typeof usuario?.nombre === "string" ? usuario.nombre.trim() : "";
  if (nombreUsuario) return nombreUsuario;
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

export function mapearDTO(dto: MovementDTO): Movement {
  const nombreEmpresaRaw = dto.empresaNombre ?? dto.empresa?.nombre;
  const empresaNombreFinal =
    typeof nombreEmpresaRaw === "string" && nombreEmpresaRaw.trim().length > 0
      ? nombreEmpresaRaw
      : "Sin Nombre";

  const localidadDto =
    typeof dto.localidad === "object" && dto.localidad !== null
      ? (dto.localidad as LocalidadDTO)
      : undefined;
  const folioLocalidad = dto.folioLocalidad ?? null;

  return {
    id: dto.id,
    idTecnico: dto.idTecnico ?? dto.id,
    folioLocalidad,
    folioLocalidadLabel: dto.folioLocalidadLabel ?? (folioLocalidad ? `#${folioLocalidad}` : null),
    locomotora: dto.locomotiveNumber ?? dto.locomotora ?? "S/N",

    localidadId: dto.localidadId ?? localidadDto?.id ?? 0,
    localidadNombre: dto.localidad ? normalizarNombre(dto.localidad) : `Localidad #${dto.localidadId ?? 0}`,
    localidadEstado: localidadDto?.estado ?? "—",

    viaOrigen: normalizarNombre(dto.viaOrigen),
    viaDestino: normalizarNombre(dto.viaDestino),

    tipoAccion: dto.accion ?? dto.tipoMovimiento ?? "Movimiento",
    tipoMovimiento: dto.tipoMovimiento ?? dto.tipo ?? "N/A",
    prioridad: dto.prioridad ?? "Normal",
    estado: dto.estado ?? "DESCONOCIDO",

    clienteId: dto.clienteId ?? 0,
    clienteNombre: normalizarNombreUsuario(dto.clienteNombre, dto.cliente),
    supervisorId: dto.supervisorId ?? null,
    supervisorNombre: normalizarNombreUsuario(dto.supervisorNombre, dto.supervisor),
    coordinadorId: dto.coordinadorId ?? null,
    coordinadorNombre: normalizarNombreUsuario(dto.coordinadorNombre, dto.coordinador),
    operadorId: dto.operadorId ?? null,
    operadorNombre: normalizarNombreUsuario(dto.operadorNombre, dto.operador),
    maquinistaId: dto.maquinistaId ?? null,
    maquinistaNombre: normalizarNombreUsuario(
      dto.maquinistaNombre,
      dto.maquinista ?? dto.operador
    ),
    empresaId: dto.empresaId ?? dto.empresa?.id ?? 0,

    empresaNombre: empresaNombreFinal,

    fechaCreacion: dto.createdAt ?? null,
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
  if (key === "folioLocalidad") {
    return movement.folioLocalidad ?? movement.id;
  }

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

/** Adapt the complete operational queue before filtering, sorting and pagination. */
export function currentQueueMovements(data: unknown, localidadId: number): Movement[] {
  if (!Array.isArray(data)) throw new Error('La consulta de rondas devolvió una respuesta inválida.');
  const unique = new Map<number, Movement>();
  for (const row of data as { movimiento?: MovementDTO; movimientoId?: number; empresa?: EmpresaDTO; localidadId?: number; concluido?: boolean; rondaNumero?: number; orden?: number }[]) {
    const dto = row.movimiento;
    const id = Number(dto?.id ?? row.movimientoId);
    if (!dto || !Number.isSafeInteger(id) || id <= 0 || row.concluido || Number(row.localidadId ?? dto.localidadId) !== localidadId) continue;
    if ((CLOSED_MOVEMENT_STATES as readonly string[]).includes(normalizarEstado(dto.estado))) continue;
    const technicalId = Number(dto.idTecnico ?? row.movimientoId ?? id);
    if (!Number.isSafeInteger(technicalId) || technicalId <= 0) continue;
    unique.set(technicalId, { ...mapearDTO({ ...dto, id, idTecnico: technicalId, empresa: row.empresa ?? dto.empresa, localidadId, finalizado: false }), rondaNumero: row.rondaNumero, ordenEnRonda: row.orden });
  }
  return [...unique.values()];
}

export function filterCurrentMovements(rows: Movement[], filters: FiltrosMovimientos): Movement[] {
  const q = filters.busqueda.trim().toLocaleLowerCase('es-MX');
  const from = filters.desde ? movementDateBoundary(filters.desde) : null;
  const to = filters.hasta ? movementDateBoundary(filters.hasta, true) : null;
  const dateKey = { solicitud: 'fechaSolicitud', inicio: 'fechaInicio', fin: 'fechaFin', creacion: 'fechaCreacion' } as const;
  const filtered = rows.filter(row => {
    if (filters.empresaId && row.empresaId !== filters.empresaId) return false;
    if (filters.localidadId && row.localidadId !== filters.localidadId) return false;
    if (filters.estado && !filters.estado.split(',').includes(normalizarEstado(row.estado))) return false;
    if (filters.prioridad && normalizarEstado(row.prioridad) !== filters.prioridad) return false;
    if (filters.locomotiveNumber && Number(row.locomotora) !== Number(filters.locomotiveNumber)) return false;
    if (filters.locomotivePrefix && !String(row.locomotora).startsWith(filters.locomotivePrefix)) return false;
    if (q && ![row.folioLocalidad ?? row.id, row.locomotora, row.empresaNombre, row.localidadNombre, row.estado, row.prioridad, row.tipoMovimiento].some(value => String(value ?? '').toLocaleLowerCase('es-MX').includes(q))) return false;
    if (from || to) {
      const raw = row[dateKey[filters.fechaCampo ?? 'solicitud']];
      const stamp = raw ? Date.parse(raw) : NaN;
      if (!Number.isFinite(stamp) || (from && stamp < Date.parse(from)) || (to && stamp > Date.parse(to))) return false;
    }
    return true;
  });
  return ordenarMovimientos(filtered, filters.campoOrden, filters.direccionOrden);
}

/* ================== HOOK ================== */
export function useMovimientos({ rol, apiBase, autoRefreshMs, initialEmpresaId = null, initialLocalidadId = null, authorization, bloquearLocalidad }: UseMovimientosOptions) {
  const effectiveRole = authorization?.role ?? rol;
  const scope = useMemo<MovementFilterScope>(() => ({ rol, empresaId: initialEmpresaId, localidadId: initialLocalidadId, authorization, bloquearLocalidad }), [rol, initialEmpresaId, initialLocalidadId, authorization, bloquearLocalidad]);
  const scopeKey = JSON.stringify(scope);
  const [query, setQuery] = useState(() => ({ ambito: 'actuales' as Ambito, filtros: normalizeMovementFilters(DEFAULT_MOVEMENT_FILTERS, 'actuales', scope), scopeKey }));
  const ambito = query.ambito;
  const filtros = useMemo(() => normalizeMovementFilters({ ...query.filtros, ...(query.scopeKey !== scopeKey ? { pagina: 1 } : {}) }, ambito, scope), [query, ambito, scope, scopeKey]);
  const filterPolicy = useMemo(() => movementFilterPolicy(scope, ambito), [scope, ambito]);
  const setFiltros = useCallback<Dispatch<SetStateAction<FiltrosMovimientos>>>((next) => {
    setQuery(prev => {
      const current = normalizeMovementFilters(prev.filtros, prev.ambito, scope);
      const filtros = normalizeMovementFilters(typeof next === 'function' ? next(current) : next, prev.ambito, scope);
      if (JSON.stringify({ ...current, pagina: 1 }) !== JSON.stringify({ ...filtros, pagina: 1 }) || prev.scopeKey !== scopeKey) filtros.pagina = 1;
      if (JSON.stringify(filtros) === JSON.stringify(prev.filtros) && prev.scopeKey === scopeKey) return prev;
      return { ...prev, filtros, scopeKey };
    });
  }, [scope, scopeKey]);
  const setAmbito = useCallback<Dispatch<SetStateAction<Ambito>>>((next) => {
    setQuery(prev => {
      const ambito = typeof next === 'function' ? next(prev.ambito) : next;
      if (ambito === prev.ambito) return prev;
      // An explicit company selection in history must not silently hide the other companies on return.
      return { ambito, scopeKey, filtros: normalizeMovementFilters({ ...prev.filtros, pagina: 1, ...(effectiveRole === 'CLIENTE' ? { empresaId: undefined } : {}) }, ambito, scope) };
    });
  }, [scope, scopeKey, effectiveRole]);
  const applyView = useCallback((view: { ambito: Ambito; filtros: Partial<FiltrosMovimientos> }) => {
    setQuery({ ambito: view.ambito, filtros: normalizeMovementFilters({ ...DEFAULT_MOVEMENT_FILTERS, ...view.filtros }, view.ambito, scope), scopeKey });
  }, [scope, scopeKey]);
  const tab = ambito === 'actuales' ? 'Actuales' as const : 'Pasados' as const;
  const setTab = useCallback((value: 'Actuales' | 'Pasados') => setAmbito(value === 'Actuales' ? 'actuales' : 'pasados'), [setAmbito]);
  const [autoEnabled, setAutoEnabled] = useState(true);
  const [empresas, setEmpresas] = useState<OpcionEmpresa[]>([]);
  const [localidades, setLocalidades] = useState<OpcionLocalidad[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [status, setStatus] = useState<{ message: string; type: 'info' | 'success' | 'error' } | null>(null);
  const base = normalizeBase(apiBase);
  const sharedCurrent = effectiveRole === 'CLIENTE' && ambito === 'actuales';
  const missingScope = (!filterPolicy.canEditEmpresa && !filterPolicy.forcedEmpresaId) || (!filterPolicy.canEditLocalidad && !filterPolicy.forcedLocalidadId) || authorization?.scope.mode === 'DENY';
  const validationError = missingScope ? 'No se pudo resolver la empresa o localidad autorizada. Vuelve a iniciar sesión.' : movementFilterError(filtros);
  const url = sharedCurrent
    ? `/api/cliente/rondas?localidadId=${filterPolicy.forcedLocalidadId ?? ''}&alcance=localidad`
    : `${base}/movimientos/buscar?${movementSearchParams(filtros, ambito)}`;
  const queryKey = JSON.stringify([scopeKey, ambito, filtros]);
  type Snapshot = { key: string; rows: Movement[]; total: number; estimated: boolean; loading: boolean; error: string | null };
  const [snapshot, setSnapshot] = useState<Snapshot>({ key: '', rows: [], total: 0, estimated: false, loading: false, error: null });
  const pendingRef = useRef<{ key: string; controller: AbortController } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerForceRef = useRef(false);
  const needsReloadRef = useRef<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const load = async (path: string, setter: (rows: OpcionCatalogo[]) => void) => {
      try {
        const payload = await cachedFetchJson<unknown>(`${base}/${path}/lite`, { credentials: 'same-origin', signal: controller.signal }, { ttlMs: 300_000 });
        const data = typeof payload === 'object' && payload && 'data' in payload ? payload.data : payload;
        if (!controller.signal.aborted && esOpcionCatalogoArray(data)) setter(data);
      } catch { /* Scope IDs remain visible if the optional names cannot be loaded. */ }
    };
    void load('empresas', setEmpresas); void load('localidades', setLocalidades);
    return () => controller.abort();
  }, [base]);

  const fetchMovimientos = useCallback(async (force = false): Promise<void> => {
    if (validationError) return;
    if (pendingRef.current?.key === queryKey && !pendingRef.current.controller.signal.aborted) {
      if (force) needsReloadRef.current = queryKey;
      return;
    }
    pendingRef.current?.controller.abort();
    const controller = new AbortController();
    const request = { key: queryKey, controller };
    pendingRef.current = request;
    const current = () => pendingRef.current === request && !controller.signal.aborted;
    setSnapshot(prev => ({ key: queryKey, rows: prev.key === queryKey ? prev.rows : [], total: prev.key === queryKey ? prev.total : 0, estimated: prev.key === queryKey && prev.estimated, loading: true, error: null }));
    try {
      const data = await cachedFetchJson<unknown>(url, { credentials: 'same-origin', signal: controller.signal }, { ttlMs: 10_000, force });
      if (!current()) return;
      let rows: Movement[];
      let total: number;
      let estimated = false;
      if (sharedCurrent) {
        const queue = currentQueueMovements(data, filterPolicy.forcedLocalidadId!);
        setEmpresas(prev => {
          const all = new Map(prev.map(company => [company.id, company]));
          for (const row of queue) if (row.empresaId > 0) all.set(row.empresaId, { id: row.empresaId, nombre: row.empresaNombre || `Empresa #${row.empresaId}` });
          return [...all.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
        });
        const items = filterCurrentMovements(queue, filtros);
        total = items.length;
        rows = items.slice((filtros.pagina - 1) * filtros.tamPagina, filtros.pagina * filtros.tamPagina);
      } else {
        if (!esMovementDTOArray(data) && !esMovimientosEnvelope(data)) throw new Error('El servicio devolvió una respuesta inválida.');
        const extracted = extraerItemsYTotal(data);
        rows = extracted.items.map(mapearDTO);
        // The backend orders the whole collection. Never reorder only the visible page.
        estimated = extracted.total == null;
        total = extracted.total ?? ((filtros.pagina - 1) * filtros.tamPagina + rows.length + (rows.length === filtros.tamPagina ? 1 : 0));
      }
      if (!estimated && filtros.pagina > Math.max(1, Math.ceil(total / filtros.tamPagina))) {
        setFiltros(prev => ({ ...prev, pagina: Math.max(1, Math.ceil(total / filtros.tamPagina)) }));
        return;
      }
      setSnapshot({ key: queryKey, rows, total, estimated, loading: false, error: null });
    } catch (error) {
      if (!current()) return;
      setSnapshot(prev => ({ ...prev, loading: false, error: error instanceof Error ? error.message : 'No se pudieron cargar los movimientos. Intenta actualizar.' }));
    } finally {
      if (current()) {
        pendingRef.current = null;
        if (needsReloadRef.current === queryKey) {
          needsReloadRef.current = null;
          void fetchMovimientos(true);
        }
      }
    }
  }, [validationError, queryKey, url, sharedCurrent, filterPolicy.forcedLocalidadId, filtros, setFiltros]);

  useEffect(() => {
    void fetchMovimientos();
    return () => {
      pendingRef.current?.controller.abort();
      pendingRef.current = null;
      needsReloadRef.current = null;
      timerForceRef.current = false;
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    };
  }, [fetchMovimientos]);

  const onEvent = useCallback((event: RealtimeMovementEvent) => {
    if (!autoEnabled || ambito !== 'actuales' || document.visibilityState === 'hidden' || validationError) return;
    const ready = event.type === 'realtime.ready' || event.type === 'realtime.resume';
    if (!ready && !['movimiento.creado', 'movimiento.estado', 'movimiento.incidente', 'incidente.estado'].includes(String(event.type))) return;
    if (!ready) {
      for (const key of ['empresaId', 'localidadId'] as const) {
        const id = Number(event[key]);
        if (filtros[key] && Number.isFinite(id) && id > 0 && id !== filtros[key]) return;
      }
    }
    timerForceRef.current ||= !ready;
    if (timerRef.current) return;
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      const force = timerForceRef.current;
      timerForceRef.current = false;
      if (document.visibilityState !== 'hidden') void fetchMovimientos(force);
    }, 250);
  }, [autoEnabled, ambito, validationError, filtros, fetchMovimientos]);
  const realtimeStatus = useRealtimeMovimientos({ enabled: autoEnabled && ambito === 'actuales' && !validationError, onEvent });

  useEffect(() => {
    const cancelScheduled = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null; timerForceRef.current = false; needsReloadRef.current = null;
    };
    if (!autoEnabled || ambito !== 'actuales' || validationError) { cancelScheduled(); return; }
    const refreshVisible = () => { if (document.visibilityState !== 'hidden') void fetchMovimientos(); else cancelScheduled(); };
    const requested = Math.max(10_000, autoRefreshMs ?? DEFAULT_AUTO_REFRESH_MS);
    const interval = setInterval(refreshVisible, realtimeStatus === 'connected' ? Math.max(30_000, requested) : requested);
    document.addEventListener('visibilitychange', refreshVisible);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', refreshVisible); cancelScheduled(); };
  }, [autoEnabled, ambito, validationError, fetchMovimientos, autoRefreshMs, realtimeStatus]);

  const isCurrent = snapshot.key === queryKey;
  const filas = useMemo(() => isCurrent && !validationError ? snapshot.rows.map(row => ({ ...row, localidadNombre: localidades.find(localidad => localidad.id === row.localidadId)?.nombre ?? row.localidadNombre })) : [], [isCurrent, validationError, snapshot.rows, localidades]);
  const total = isCurrent && !validationError ? snapshot.total : 0;
  const cargando = !validationError && (!isCurrent || snapshot.loading);
  const error = validationError ?? (isCurrent ? snapshot.error : null);
  const recargar = useCallback(() => { void fetchMovimientos(true); }, [fetchMovimientos]);
  return {
    filas, total, totalEstimado: isCurrent && snapshot.estimated, cargando, error, ambito, setAmbito, filtros, setFiltros, applyView, filterPolicy,
    empresas, localidades, recargar, autoEnabled, setAutoEnabled, realtimeStatus,
    data: filas, loading: cargando, refreshing: cargando && filas.length > 0, onRefresh: recargar, tab, setTab,
    badges: { Actuales: ambito === 'actuales' ? total : undefined },
    emptyText: ambito === 'actuales' ? 'No hay movimientos activos' : 'No hay movimientos finalizados',
    showForm, setShowForm, status, setStatus,
  };
}
