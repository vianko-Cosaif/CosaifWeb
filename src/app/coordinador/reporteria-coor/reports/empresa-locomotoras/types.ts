export type Meta = Partial<{
  empresaId: number;
  empresaNombre: string;
  tz: string;
  rangoLocal: { desde: string; hastaExclusivo: string };
  rangoUTC: { desde: string; hastaExclusivo: string };
  localidadId?: number;
}>;

export type Resumen = Partial<{
  totalMovimientos: number;
  totalLocomotoras: number;
  estadosGeneral: Record<string, number>;
  usuarioCliente: string;
  totalUsuarioCliente: number;
  estadosUsuarioCliente: Record<string, number>;
}>;

export type Locomotora = {
  locomotiveNumber: string | number;
  totalMovimientos: number;
  estados?: Record<string, number>;
};

export type Movimiento = {
  id: number;
  locomotiveNumber?: number | string;
  estado?: string;
  solicitadoPor?: string;
  cliente?: string | null;
  fechaSolicitudMX?: string;
  fechaInicioMX?: string;
  fechaFinMX?: string;
  viaOrigen?: string;
  viaDestino?: string;
  lavado?: boolean;
  torno?: boolean;
  tipoMovimiento?: string;
  prioridad?: string;
  descripcion?: string;
};

export type ReporteEmpresaLocomotoras = Partial<{
  meta: Meta;
  resumen: Resumen;
  locomotoras: Locomotora[];
  movimientos: Movimiento[];
  movimientosUsuarioCliente: Movimiento[];
}>;
