import type { TorreonIncidentDetail } from "@/app/coordinador/torreon/TorreonIncidentDetailModal";

export type ArrastreStatus =
  | "TODOS"
  | "SOLICITADO"
  | "EN_PROCESO"
  | "DETENIDO"
  | "CONCLUIDO"
  | "CANCELADO";

export type VagonStatus = "PENDIENTE" | "EN_PROCESO" | "BLOQUEADO" | "CONCLUIDO";
export type VagonStatusFilter = "TODOS" | VagonStatus;
export type ArrastreFechaCampo = "solicitud" | "inicio" | "fin";

export type VagonArrastre = {
  id: number;
  orden: number;
  numeroVagon?: string | null;
  carga?: string | null;
  comentario?: string | null;
  estado?: string | null;
  viaOrigenId?: number | null;
  seccionOrigenId?: number | null;
  viaId?: number | null;
  seccionId?: number | null;
  viaOrigenNombre?: string | null;
  seccionOrigenNombre?: string | null;
  viaDestinoNombre?: string | null;
  seccionDestinoNombre?: string | null;
  fechaSolicitud?: string | null;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  metricas?: {
    esperaMin?: number | null;
    operacionMin?: number | null;
    solicitudTotalMin?: number | null;
  } | null;
};

export type IncidenteArrastre = TorreonIncidentDetail & {
  id: number;
  vagonId?: number | null;
  fotosCount?: number | null;
};

export type Arrastre = {
  id: number;
  estado?: string | null;
  ordenSolicitud?: number | null;
  empresaId?: number | null;
  viaOrigenId?: number | null;
  seccionOrigenId?: number | null;
  viaDestinoId?: number | null;
  seccionDestinoId?: number | null;
  fechaSolicitud?: string | null;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  instrucciones?: string | null;
  vagones?: VagonArrastre[] | null;
  incidentes?: IncidenteArrastre[] | null;
  resumen?: {
    totalVagones?: number | null;
    pendientes?: number | null;
    enProceso?: number | null;
    bloqueados?: number | null;
    concluidos?: number | null;
    solicitudTotalMin?: number | null;
    operacionTotalMin?: number | null;
  } | null;
};

export type ArrastreAuditSnapshotVagon = {
  id: number;
  orden?: number | null;
  numeroVagon?: string | null;
  carga?: string | null;
  viaOrigenId?: number | null;
  seccionOrigenId?: number | null;
  viaId?: number | null;
  seccionId?: number | null;
  viaOrigenNombre?: string | null;
  seccionOrigenNombre?: string | null;
  viaDestinoNombre?: string | null;
  seccionDestinoNombre?: string | null;
};

export type ArrastreAuditSnapshot = {
  instrucciones?: string | null;
  vagones?: ArrastreAuditSnapshotVagon[];
};

export type ArrastreEditAudit = {
  id: number;
  arrastreId: number;
  editadoPorId: number;
  editadoPorRol: string;
  editadoPorNombre?: string | null;
  motivo?: string | null;
  antes: ArrastreAuditSnapshot;
  despues: ArrastreAuditSnapshot;
  fechaEdicion: string;
};

export type DailyInfo = {
  index: number;
  total: number;
  date: string;
};

export type ArrastreStats = {
  total: number;
  solicitados: number;
  proceso: number;
  detenidos: number;
  concluidos: number;
  cancelados: number;
  vagonesPendientes: number;
  incidentesAbiertos: number;
};
