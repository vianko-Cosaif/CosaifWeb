// src/lib/types.ts

/** Opción simple para selects */
export type Option = { id: number; nombre: string };

/** Enums relajados: aceptan strings desconocidos sin romper el tipado */
export type Prioridad = "ALTA" | "BAJA" | (string & {});
export type EstadoMovimiento =
  | "SOLICITADO"
  | "EN_PROCESO"
  | "DETENIDO"
  | "ESPERA"
  | "MODIFICADO"
  | "CONCLUIDO"
  | "CANCELADO"
  | (string & {});
export type PosicionCabina = "Sin_Solicitar" | "DENTRO" | "AFUERA" | (string & {});
export type PosicionChimenea = "Sin_Solicitar" | "DENTRO" | "AFUERA" | (string & {});
export type DireccionEmpuje = "Sin_Solicitar" | "EMPUJAR" | "JALAR" | (string & {});
export type Tab = "Actuales" | "Pasados";

/** Movimiento normalizado para UI */
export type Movement = {
  id: number;

  // IDs
  localidadId?: number;
  empresaId?: number;

  // Nombres
  localidadNombre?: string;
  empresaNombre?: string;

  // Datos base
  locomotora?: string;
  viaOrigen?: string;
  viaDestino?: string;
  tipoAccion?: string;

  // Estado/Prioridad
  prioridad?: Prioridad;
  estado?: EstadoMovimiento;
  finalizado?: boolean;

  // Fechas ISO o null
  fechaSolicitud?: string | null;
  fechaInicio?: string | null;
  fechaFin?: string | null;

  // Extras
  instrucciones?: string;
  posicionCabina?: PosicionCabina;
  posicionChimenea?: PosicionChimenea;
  direccionEmpuje?: DireccionEmpuje;
  incidenteGlobal?: boolean;
  lavado?: boolean;
  torno?: boolean;
};
