import type { TorreonIncidentDetail } from "@/app/coordinador/torreon/TorreonIncidentDetailModal";

export type FotoMovimiento = {
  id?: number | null;
  tipo: string;
  orden: number;
  url: string;
  comentario?: string | null;
  tomadaAt?: string | null;
};

export type IncidenteMovimientoNatural = TorreonIncidentDetail;

export type MovimientoNatural = {
  id: number | string;
  idTecnico?: number | string | null;
  folioLocalidad?: number | null;
  folioLocalidadLabel?: string | null;
  empresaId?: number | null;
  empresaNombre?: string | null;
  clienteId?: number | null;
  clienteNombre?: string | null;
  supervisorId?: number | null;
  supervisorNombre?: string | null;
  coordinadorId?: number | null;
  coordinadorNombre?: string | null;
  operadorId?: number | null;
  operadorNombre?: string | null;
  creadoPorId?: number | null;
  creadoPorNombre?: string | null;
  iniciadoPorId?: number | null;
  iniciadoPorNombre?: string | null;
  locomotiveNumber?: number | string | null;
  estado?: string | null;
  prioridad?: string | null;
  tipoMovimiento?: string | null;
  viaOrigen?: string | null;
  viaDestino?: string | null;
  fechaSolicitud?: string | null;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  instrucciones?: string | null;
  rondaNumero?: number | null;
  ordenRonda?: number | null;
  estadoRonda?: string | null;
  fotosCount?: number | null;
  fotos?: FotoMovimiento[];
  fotosPorTipo?: Record<string, FotoMovimiento[]>;
  incidentes?: IncidenteMovimientoNatural[];
};

export type EmpresaOption = {
  id: number;
  nombre: string;
};

export type StatusTab = "activos" | "concluidos" | "todos";
export type FechaCampo = "solicitud" | "inicio" | "fin";
export type SortKey = "cronologia" | "solicitud" | "inicio" | "fin" | "id";
export type SortDir = "asc" | "desc";

export type NaturalesMetrics = {
  active: number;
  process: number;
  done: number;
  withPhotos: number;
  withIncidents: number;
  avg: number | null;
};

export type SelectedIncident = {
  incident: TorreonIncidentDetail;
  title: string;
  subtitle?: string;
};
