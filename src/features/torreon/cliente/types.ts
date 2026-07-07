export type TorreonPanelView = "dashboard" | "movimientos" | "crear" | "incidentes";
export type Ambito = "actuales" | "pasados";
export type CargaVagon = "VACIO" | "LLENO";

export type ActionPayload = {
  action: "CREAR_INCIDENTE" | "RESOLVER_INCIDENTE" | "CANCELAR";
  arrastreId: number;
  vagonId?: number;
  incidenteId?: number;
  motivo?: string;
  solucion?: string;
  fotos?: Array<{ dataUrl: string; tomadaPorId?: number }>;
};

export type VagonDraft = {
  tempId: number;
  numeroVagon: string;
  carga: CargaVagon;
  viaId: string;
  seccionId: string;
};

export type FotoDraft = {
  name: string;
  dataUrl: string;
};

export type IncidentDraft = {
  motivo: string;
  vagonId: string;
  fotos: FotoDraft[];
  solucion: string;
};

export type EditVagonDraft = {
  arrastreId: number;
  vagonId: number;
  numeroVagon: string;
  carga: CargaVagon;
  viaId: string;
  seccionId: string;
};

export type ClienteArrastreStats = {
  total: number;
  solicitados: number;
  proceso: number;
  detenidos: number;
  concluidos: number;
  pendientesVagon: number;
};

export const emptyIncidentDraft: IncidentDraft = {
  motivo: "",
  vagonId: "",
  fotos: [],
  solucion: "",
};

export const makeVagonDraft = (tempId: number): VagonDraft => ({
  tempId,
  numeroVagon: "",
  carga: "VACIO",
  viaId: "",
  seccionId: "",
});
