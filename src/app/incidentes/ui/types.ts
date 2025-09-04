export type IncidenteRow = {
  id?: number | string;
  fecha?: string;
  estatus?: string;
  estadoRaw?: string;
  empresa?: string;
  locomotora?: string | number;
  origen?: string;
  destino?: string;
  descripcion?: string;
  usuario?: string;
  _original?: any;
};

export type Meta = {
  page: number;
  pageSize?: number;
  total?: number;
  totalPages: number;
};

export type Role = "ADMIN" | "COOORDINADOR" | "CLIENTE" | "SUPERVISOR";
