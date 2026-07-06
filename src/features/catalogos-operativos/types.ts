export type CatalogWarning = {
  scope: "localidad" | "via" | "seccion" | "torno";
  message: string;
};

export type CatalogSection = {
  id: number;
  numero: number;
  nombre: string | null;
  ocupada: boolean;
  movimientoId: number | null;
};

export type CatalogTrack = {
  id: number;
  numero: number;
  nombre: string;
  secciones: CatalogSection[];
};

export type CatalogLocation = {
  id: number;
  nombre: string;
  estado: string;
  totalVias: number;
  totalSecciones: number;
  vias: CatalogTrack[];
  torno: {
    configurado: boolean;
    navaId: number | null;
    cantidadNavajas: number;
  };
};

export type CatalogSummary = {
  localidades: CatalogLocation[];
  warnings: CatalogWarning[];
};

export type TrackDraft = {
  id?: number;
  numero: number;
  nombre: string;
  secciones: number;
};

export type LocationPayload = {
  localidad: {
    id?: number;
    nombre: string;
    estado: string;
  };
  vias: TrackDraft[];
  torno: {
    configurar: boolean;
    cantidadNavajas: number;
  };
};
