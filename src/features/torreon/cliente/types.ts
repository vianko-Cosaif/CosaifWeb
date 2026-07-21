export type TorreonPanelView = "dashboard" | "movimientos" | "crear" | "incidentes";
export type Ambito = "actuales" | "pasados";
export type CargaVagon = "VACIO" | "LLENO";

export type OperationalSection = {
  id: number;
  numero: number;
  nombre: string;
  ocupada?: boolean;
};

export type OperationalVia = {
  id: number;
  numero: number;
  nombre: string;
  ocupada?: boolean;
  secciones: OperationalSection[];
};

export type ActionPayload = {
  action: "CANCELAR" | "PRIORIZAR_SOLICITUD" | "REORDENAR_VAGONES" | "REORDENAR_SOLICITUDES" | "RESOLVER_INCIDENTE" | "INICIAR_VAGON" | "FINALIZAR_VAGON";
  arrastreId: number;
  arrastreIds?: number[];
  vagonId?: number;
  vagonIds?: number[];
  incidenteId?: number;
  motivo?: string;
  solucion?: string;
};

export type VagonDraft = {
  tempId: number;
  numeroVagon: string;
  carga: CargaVagon;
  viaOrigenId: string;
  seccionOrigenId: string;
  viaId: string;
  seccionId: string;
};

export type EditVagonDraft = {
  arrastreId: number;
  vagonId: number;
  numeroVagon: string;
  carga: CargaVagon;
  viaOrigenId?: string;
  seccionOrigenId?: string;
  viaId: string;
  seccionId: string;
};

export type EditArrastreVagonDraft = VagonDraft & {
  vagonId: number;
};

export type EditArrastreDraft = {
  arrastreId: number;
  instrucciones: string;
  motivoEdicion: string;
  vagones: EditArrastreVagonDraft[];
};

export type CancelArrastreDraft = {
  arrastreId: number;
  referencia: string;
  motivo: string;
};

export type ClienteArrastreStats = {
  total: number;
  solicitados: number;
  proceso: number;
  detenidos: number;
  concluidos: number;
  pendientesVagon: number;
};

export const makeVagonDraft = (tempId: number): VagonDraft => ({
  tempId,
  numeroVagon: "",
  carga: "VACIO",
  viaOrigenId: "",
  seccionOrigenId: "",
  viaId: "",
  seccionId: "",
});
