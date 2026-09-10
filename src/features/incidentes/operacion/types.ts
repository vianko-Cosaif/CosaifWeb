/* eslint-disable @typescript-eslint/no-explicit-any */
export type IncidenteRow = {
  id?: number | string;
  fecha?: string;
  estatus?: string;
  estadoRaw?: string;
  empresa?: string;
  empresaId?: number | null;
  localidad?: string;
  localidadId?: number | null;
  locomotora?: string | number;
  origen?: string;
  destino?: string;
  descripcion?: string;
  usuario?: string;
  fuente?: string;
  tipoIncidente?: string;
  fechaISO?: string;
  _original?: any;
};

export type Meta = {
  page: number;
  pageSize?: number;
  total?: number;
  totalPages: number;
};

export type Role =
  | "CLIENTE"
  | "CLIENTE_ADMIN"
  | "CLIENTE_COOR"
  | "ARRASTRE_TORREON"
  | "ADMINISTRADOR"
  | "SUPERVISOR"
  | "COORDINADOR"
  | "MAQUINISTA"
  | "MAQUINISTA_ARRASTRE";
