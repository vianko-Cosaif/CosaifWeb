import type { TornoMedicionState } from "@/app/movimientos/crear/tornoMedicion.types";

export type RondaMovement = {
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
  instrucciones?: string | null;
};

export type Ronda = {
  id: number;
  rondaNumero: number;
  orden: number;
  concluido: boolean;
  empresa?: { id: number; nombre: string } | null;
  localidadId?: number | null;
  localidad?: { id: number; nombre: string } | null;
  movimiento?: RondaMovement | null;
  movimientoId?: number | null;
  createdAt?: string | null;
};

export type RondaInfo = {
  empresa: { id: number; nombre: string };
  movimiento: RondaMovement & {
    lavado: boolean;
    torno: boolean;
    estado?: string;
    prioridad?: "BAJA" | "ALTA";
    locomotiveNumber?: number | string;
  };
  movimientoId?: number;
};

export type Localidad = {
  id: number;
  nombre: string;
  estado?: string | null;
};

export type ToastKind = "move" | "new" | "done" | "warning" | "ok" | "error";

export type Toast = {
  id: number;
  text: string;
  kind: ToastKind;
};

export type MeasuresModalState = {
  open: boolean;
  loading: boolean;
  error: string | null;
  tornoMedicion: TornoMedicionState;
  locomotiveLabel?: string;
  companyName?: string;
};

export type QueueEntityKind = "movimientos" | "torneados";
export type QueueStatusKind = "pendientes" | "terminados";
