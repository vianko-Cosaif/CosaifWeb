import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ================== CONFIGURACIÓN ================== */
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/bff";
const URL_LISTADO = `${API_BASE}/movimientos`;
const URL_EMPRESAS = `${API_BASE}/empresas`;
const URL_LOCALIDADES = `${API_BASE}/localidades`;
const AUTO_REFRESH_MS = 10_000;

/* ================== TIPOS ================== */
export type Rol =
  | "ADMINISTRADOR"
  | "COORDINADOR"
  | "SUPERVISOR"
  | "CLIENTE";

export type Ambito = "actuales" | "pasados";
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
  pagina: number;
  tamPagina: number;
  campoOrden: CampoOrden;
  direccionOrden: DireccionOrden;
  busqueda: string;
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
  total?: number;
}

/* ================== CONSTANTES DE NEGOCIO ================== */

const ESTADOS_ACTUALES = new Set<Movement["estado"]>([
  "SOLICITADO",
  "EN_PROCESO",
]);

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

function extraerItemsYTotal(
  data: unknown
): { items: MovementDTO[]; total: number } {
  if (esMovementDTOArray(data)) {
    return { items: data, total: data.length };
  }

  if (esMovimientosEnvelope(data)) {
    const { items, data: innerData, rows, total } = data as MovimientosEnvelope;
    const lista = items ?? innerData ?? rows ?? [];
    const totalSeguro =
      typeof total === "number" && total >= 0 ? total : lista.length;
    return { items: lista, total: totalSeguro };
  }

  return { items: [], total: 0 };
}

/* ================== HOOK ================== */

export function useMovimientos(rol: Rol, token?: string) {
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

  const [filtros, setFiltros] = useState<FiltrosMovimientos>({
    pagina: 1,
    tamPagina: 25,
    campoOrden: "id",
    direccionOrden: "desc",
    busqueda: "",
  });

  const [empresas, setEmpresas] = useState<OpcionEmpresa[]>([]);
  const [localidades, setLocalidades] = useState<OpcionLocalidad[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [status, setStatus] = useState<
    { message: string; type: "info" | "success" | "error" } | null
  >(null);

  const abortRef = useRef<AbortController | null>(null);

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

    // Pedimos siempre la primera página grande al backend.
    // La paginación REAL la hacemos nosotros en el front.
    qs.set("page", "1");
    qs.set("pageSize", "1000"); // o 2000 si quieres más margen

    if (filtros.busqueda.trim()) qs.set("q", filtros.busqueda.trim());
    if (filtros.empresaId) qs.set("empresaId", String(filtros.empresaId));
    if (filtros.localidadId)
      qs.set("localidadId", String(filtros.localidadId));
    if (filtros.desde) {
      // Restamos 1 día para asegurar que el backend (posiblemente UTC) incluya transiciones de hora local
      const d = new Date(filtros.desde);
      d.setDate(d.getDate() - 1);
      qs.set("fechaInicio", d.toISOString().split("T")[0]);
    }
    if (filtros.hasta) {
      // Sumamos 1 día para cubrir el final del día local en UTC
      const d = new Date(filtros.hasta);
      d.setDate(d.getDate() + 1);
      qs.set("fechaFin", d.toISOString().split("T")[0]);
    }

    if (filtros.campoOrden) qs.set("orderBy", filtros.campoOrden);
    if (filtros.direccionOrden) qs.set("orderDir", filtros.direccionOrden);

    if (ambito === "actuales") {
      qs.append("estado", "SOLICITADO");
      qs.append("estado", "EN_PROCESO");
    } else {
      qs.set("finalizado", "true");
    }

    return qs.toString();
  }, [
    filtros.busqueda,
    filtros.empresaId,
    filtros.localidadId,
    filtros.desde,
    filtros.hasta,
    filtros.campoOrden,
    filtros.direccionOrden,
    ambito,
  ]);


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
        }
      } catch {
        // silencioso
      }
    };

    cargarCatalogo(URL_EMPRESAS, setEmpresas);
    cargarCatalogo(URL_LOCALIDADES, setLocalidades);
  }, [authHeaders]);

  /* ---------- Fetch de movimientos + filtros front ---------- */
  const fetchMovimientos = useCallback(async () => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    setCargando(true);
    try {
      const res = await fetch(`${URL_LISTADO}?${queryString}`, {
        headers: authHeaders,
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`Error HTTP ${res.status}`);
      }

      const data: unknown = await res.json();
      const { items: dtoItems } = extraerItemsYTotal(data);

      // Mapear DTO → Movement
      let movimientos: Movement[] = dtoItems.map(mapearDTO);

      // 1) Ambito (actuales/pasados)
      if (ambito === "actuales") {
        movimientos = movimientos.filter((m) =>
          ESTADOS_ACTUALES.has(m.estado)
        );
      } else {
        movimientos = movimientos.filter(
          (m) => !ESTADOS_ACTUALES.has(m.estado)
        );
      }

      // 2) Filtros front como en la app móvil
      const {
        empresaId,
        localidadId,
        desde,
        hasta,
        busqueda,
        pagina,
        tamPagina,
        campoOrden,
        direccionOrden,
      } = filtros;

      if (empresaId != null) {
        movimientos = movimientos.filter((m) => m.empresaId === empresaId);
      }

      if (localidadId != null) {
        movimientos = movimientos.filter((m) => m.localidadId === localidadId);
      }

      if (desde) {
        // "Desde" al inicio del día local (00:00:00)
        // Ojo: "desde" viene del input date, ej "2023-10-27"
        // Construimos la fecha local y obtenemos su timestamp
        const [y, m, d] = desde.split("-").map(Number);
        const fromDate = new Date(y, m - 1, d, 0, 0, 0, 0); // Local start of day
        const fromTs = fromDate.getTime();

        movimientos = movimientos.filter((m) => {
          const base = m.fechaInicio ?? m.fechaSolicitud;
          if (!base) return false;
          // Parseamos la fecha del item (que suele estar en ISO/UTC) a objeto Date
          const ts = new Date(base).getTime();
          return !isNaN(ts) && ts >= fromTs;
        });
      }

      if (hasta) {
        // "Hasta" al final del día local (23:59:59.999)
        const [y, m, d] = hasta.split("-").map(Number);
        const toDate = new Date(y, m - 1, d, 23, 59, 59, 999); // Local end of day
        const toTs = toDate.getTime();

        movimientos = movimientos.filter((m) => {
          const base = m.fechaFin ?? m.fechaInicio ?? m.fechaSolicitud;
          if (!base) return false;
          const ts = new Date(base).getTime();
          return !isNaN(ts) && ts <= toTs;
        });
      }

      if (busqueda.trim()) {
        const q = busqueda.trim().toLowerCase();
        movimientos = movimientos.filter((m) => {
          return (
            String(m.id).includes(q) ||
            String(m.locomotora ?? "")
              .toString()
              .toLowerCase()
              .includes(q) ||
            (m.estado ?? "").toLowerCase().includes(q) ||
            (m.prioridad ?? "").toLowerCase().includes(q) ||
            (m.tipoMovimiento ?? "").toLowerCase().includes(q) ||
            (m.localidadNombre ?? "").toLowerCase().includes(q) ||
            (m.empresaNombre ?? "").toLowerCase().includes(q)
          );
        });
      }

      // 3) Orden
      const campo = campoOrden || "id";
      const direccion: DireccionOrden = direccionOrden || "desc";
      const ordenados = ordenarMovimientos(movimientos, campo, direccion);

      // 4) Paginación frontend SIEMPRE (como la móvil)
      const start = (pagina - 1) * tamPagina;
      const end = start + tamPagina;
      const paginados = ordenados.slice(start, end);

      setFilas(paginados);
      setTotal(ordenados.length);
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
    } finally {
      setCargando(false);
      setRefreshing(false);
    }
  }, [authHeaders, queryString, ambito, filtros]);

  /* ---------- Auto-refresh ---------- */
  useEffect(() => {
    fetchMovimientos();

    if (ambito !== "actuales") {
      return;
    }

    const intervalId = setInterval(fetchMovimientos, AUTO_REFRESH_MS);
    return () => clearInterval(intervalId);
  }, [fetchMovimientos, ambito]);

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
