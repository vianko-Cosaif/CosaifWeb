import type { Ronda, RondaMovement } from "../types";

export type RondaOut = Ronda;

export type TornoServiceRecord = {
  id?: number | string | null;
  servicioId?: number | string | null;
  rondaServicioId?: number | string | null;
  movimientoId?: number | string | null;
  ruedaSolicitudId?: number | string | null;
  localidadId?: number | string | null;
  rondaNumero?: number | string | null;
  orden?: number | string | null;
  movimientoRondaNumero?: number | string | null;
  movimientoOrden?: number | string | null;
  movimientoFechaSolicitud?: string | null;
  numeroLocomotora?: number | string | null;
  locomotiveNumber?: number | string | null;
  locomotora?: number | string | null;
  movimiento?: MovimientoRecord | null;
  movimientoResumen?: MovimientoRecord | null;
  ronda?: {
    rondaNumero?: number | string | null;
    orden?: number | string | null;
  } | null;
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

export type MovimientoRecord = Omit<RondaMovement, "lavado" | "torno"> & {
  empresaId?: number | string | null;
  empresa?: { id?: number; nombre?: string } | null;
  localidadId?: number | null;
  localidad?: { id?: number; nombre?: string } | null;
  lavado?: boolean | null;
  Lavado?: boolean | null;
  torno?: boolean | null;
  ronda?: { rondaNumero?: number | string | null; orden?: number | string | null } | null;
};

export type RondaInfoRecord = {
  empresa?: { id?: number; nombre?: string } | null;
  movimiento?: MovimientoRecord | null;
  movimientoId?: number | null;
};

export type UnknownRecord = Record<string, unknown>;

export type MovimientoDetailRecord = MovimientoRecord & { movimiento?: MovimientoRecord | null };

export type NormalizedRondaBase = {
  id: number;
  localidadId: number | null;
  rondaNumero: number;
  orden: number;
  concluido: boolean;
  empresa?: { id?: number; nombre?: string } | null;
  movimiento?: MovimientoRecord | null;
  movimientoId?: number | null;
  createdAt?: string | null;
};

export type TorreonIncidenteRecord = {
  id?: number | string | null;
  estado?: string | null;
  motivo?: string | null;
  viaBloqueadaId?: number | string | null;
  seccionBloqueadaId?: number | string | null;
  fechaInicio?: string | null;
};

export type TorreonMovimientoRecord = {
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

export type TorreonRondaMovimientoRecord = {
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

export type TorreonRondaRecord = {
  id?: number | string | null;
  localidadId?: number | string | null;
  numeroRonda?: number | string | null;
  estado?: string | null;
  fechaApertura?: string | null;
  createdAt?: string | null;
  movimientos?: TorreonRondaMovimientoRecord[] | null;
};
