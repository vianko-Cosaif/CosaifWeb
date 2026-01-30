/** * 1. CONFIGURACIÓN Y CONSTANTES TÉCNICAS
 * Se usa 'as const' para que TypeScript trate los valores como literales exactos.
 */
export const MOV_CONFIG = {
  API: {
    BASE: process.env.NEXT_PUBLIC_API_URL || "/xapi",
    SECCIONES: `${process.env.NEXT_PUBLIC_API_URL || "/xapi"}/secciones/secciones`,
  },
  STORAGE: {
    DRAFT: "movement_draft_v3",
    OUTBOX: "movement_outbox_v1",
  },
  TIMEOUTS: {
    DOUBLE_TAP: 250,
    FETCH: 12000,
    FLUSH: 15000,
  }
} as const;

/** * 2. DICCIONARIOS DE NEGOCIO (Passwords y Rutas)
 */
export const ALTA_PASSWORDS: Record<number, string> = {
  1: "ALTA-EMPRESA-1",
  2: "ALTA-EMPRESA-2",
  3: "ALTA-EMPRESA-3",
  4: "ALTA-EMPRESA-4",
  5: "ALTA-EMPRESA-5"
};
export const roleBase = (r?: string) => BASE_BY_ROLE[String(r || "").toUpperCase()] || "/cliente";
export const BASE_BY_ROLE: Record<string, string> = {
  ADMINISTRADOR: "/administrador",
  COORDINADOR: "/coordinador",
  SUPERVISOR: "/supervisor",
  CLIENTE: "/cliente",
};

/** * 3. TIPOS E INTERFACES
 */
export type Servicio = "Lavado" | "Torno" | "";
export type Direccion = "EMPUJAR" | "JALAR" | "Sin_Solicitar";
export type Polo = "NORTE" | "SUR" | "Sin_Solicitar";
export type Posicion = "DENTRO" | "AFUERA" | "Sin_Solicitar";
export type Rol = keyof typeof BASE_BY_ROLE;
export type Option = { label: string; value: string }
export interface Empresa { id: number; nombre: string }
export interface Localidad { id: number; nombre: string; estado?: string }
export interface Via { id: number; nombre: string }

export interface Seccion {
  id: number;
  numero: number;
  nombre?: string | null;
  ocupada: boolean;
  movimientoId?: number | null;
  movimiento?: { id: number; locomotiveNumber?: string | null } | null;
}

export interface MovementFormData {
  empresaId: number | null;
  locomotiveNumber: string;
  priority: boolean;
  fromTrack: number | null;
  toTrack: number | null;
  selectedLocalityId?: number | null;
  cabinPosition: Posicion;
  chimneyPosition: Posicion;
  polo: Polo;
  pushPull: "" | "EMPUJAR" | "JALAR";
  movementType: "" | "MD_TRABAJANDO" | "REMOLCADA";
  comments: string;
  service?: Servicio;
  creadoPorId: number | null;
  clienteId: number | null;
  fechaInicio: string;
  fechaFin: string;
  posicionChimenea?: Posicion | null;
  direccionEmpuje?: Direccion;
}

export type InfoEdicion = {
  editable: boolean;
  restricciones: {
    motivo: string | null;
    estadosPermitidos: string[];
    mismaLocalidadParaVias: boolean;
  };
  movimiento: {
    id: number;
    empresa: Empresa | null;
    localidad: Localidad;
    estado: string;
    finalizado: boolean;
    instrucciones?: string | null;
    locomotiveNumber?: number | null;
    viaOrigen?: Via | null;
    viaDestino?: Via | null;
    tipoMovimiento?: "MD_TRABAJANDO" | "REMOLCADA" | null;
    posicionCabina?: Posicion | null;
    posicionChimenea?: Posicion | null;
    direccionEmpuje?: Direccion | null;
    polo?: Polo | null;
    meta?: { destinoId?: number; seccion?: number; liberar?: boolean };
  };
  editableKeys: Array<
    | "instrucciones"
    | "locomotiveNumber"
    | "viaOrigenId"
    | "viaDestinoId"
    | "tipoMovimiento"
    | "posicionCabina"
    | "posicionChimenea"
    | "direccionEmpuje"
    | "torno"
    | "lavado"
    | "polo"
  >;
};

export type EditablePayload = Partial<{
  instrucciones: string;
  locomotiveNumber: number;
  viaOrigenId: number | null;
  viaDestinoId: number | null;
  tipoMovimiento: "MD_TRABAJANDO" | "REMOLCADA";
  posicionCabina: Posicion;
  posicionChimenea: Posicion;
  direccionEmpuje: Direccion;
  torno:boolean;
  lavado:boolean
}>;
export const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || "/xapi";
export const SECC_BASE = `${API_BASE}/secciones/secciones`;
export const DRAFT_KEY = "movement_draft_v3";
export const OUTBOX_KEY = "movement_outbox_v1";
export const DOUBLE_TAP_MS = 250;
export const FETCH_TIMEOUT_MS = 12000;
export const FLUSH_INTERVAL_MS = 15000;
export const baseInitialForm: MovementFormData = {
  empresaId: null,
  locomotiveNumber: "",
  priority: false,
  fromTrack: null,
  toTrack: null,
  selectedLocalityId: null,
  cabinPosition: "Sin_Solicitar",
  chimneyPosition: "Sin_Solicitar",
  polo: "Sin_Solicitar",
  pushPull: "",
  movementType: "",
  comments: "",
  service: "",
  creadoPorId: null,
  clienteId: null,
  fechaInicio: new Date().toISOString(),
  fechaFin: new Date().toISOString(),
  posicionChimenea: null,
  direccionEmpuje: "Sin_Solicitar",
};

/** * 4. VALORES INICIALES (FUENTE DE VERDAD)
 * Útil para resetear formularios o inicializar estados de Redux/Context.
 */
export const INITIAL_MOVEMENT_FORM: Readonly<MovementFormData> = Object.freeze({
  empresaId: null,
  locomotiveNumber: "",
  priority: false,
  fromTrack: null,
  toTrack: null,
  selectedLocalityId: null,
  cabinPosition: "Sin_Solicitar",
  chimneyPosition: "Sin_Solicitar",
  polo: "Sin_Solicitar",
  pushPull: "",
  movementType: "",
  comments: "",
  service: "",
  creadoPorId: null,
  clienteId: null,
  fechaInicio: new Date().toISOString(),
  fechaFin: new Date().toISOString(),
  posicionChimenea: null,
  direccionEmpuje: "Sin_Solicitar",
});

/** * 5. HELPERS OPTIMIZADOS (Lógica reutilizable)
 */
export const MovementUtils = {
  /** Obtiene la ruta base según el rol del usuario */
  getRoleBase: (role?: string): string => {
    const r = (role || "").toUpperCase();
    return BASE_BY_ROLE[r] || "/cliente";
  },

  /** Valida si una contraseña es correcta para una empresa */
  isValidPassword: (empresaId: number, pass: string): boolean => {
    return ALTA_PASSWORDS[empresaId] === pass;
  },

  /** Formatea el objeto para envío a API (limpieza de datos) */
  prepareForSubmit: (data: MovementFormData) => ({
    ...data,
    fechaInicio: new Date(data.fechaInicio).toISOString(),
    locomotiveNumber: data.locomotiveNumber.trim().toUpperCase(),
  })
};
