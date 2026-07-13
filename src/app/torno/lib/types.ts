export type TornoRole =
  | "CLIENTE"
  | "CLIENTE_ADMIN"
  | "CLIENTE_COOR"
  | "ARRASTRE_TORREON"
  | "ADMINISTRADOR"
  | "SUPERVISOR"
  | "COORDINADOR";

export type TornoHistoryTab = "activos" | "concluidos";

export type TornoServiceStatus =
  | "SOLICITADO"
  | "EN_PROCESO"
  | "CONCLUIDO"
  | "DETENIDO"
  | "CANCELADO"
  | (string & {});

export type TornoMeasurePosition =
  | "L1"
  | "R1"
  | "L2"
  | "R2"
  | "L3"
  | "R3"
  | "L4"
  | "R4"
  | "L5"
  | "R5"
  | "L6"
  | "R6";

export type TornoWheelCount = 4 | 6 | 8 | 12;
export type TornoMeasures = Partial<Record<TornoMeasurePosition, string | number | null>> & {
  wheelCount?: TornoWheelCount;
};

export type TornoWheelSide = "L" | "R";

export type TornoWheelStatus =
  | "PENDIENTE"
  | "EN_PROCESO"
  | "PAUSADO"
  | "TERMINADO"
  | (string & {});

export type TornoWheelWork = {
  id: string | number;
  side: TornoWheelSide;
  position: number;
  status: TornoWheelStatus;
  startAt?: string | null;
  endAt?: string | null;
  durationSeconds?: number | null;
  original?: unknown;
};

export type TornoWorkSummary = {
  id?: string | number;
  status?: string;
  totalWheels: number;
  completedWheels: number;
  startAt?: string | null;
  endAt?: string | null;
  wheels: TornoWheelWork[];
};

export type TornoIncidentStatus =
  | "ABIERTO"
  | "PENDIENTE"
  | "EN_PROCESO"
  | "RESUELTO"
  | "CERRADO"
  | (string & {});

export type TornoFailureType = "FALLO_SISTEMA" | "NAVAJAS" | (string & {});

export type TornoImageRef = {
  id?: string | number;
  url: string;
  name?: string;
};

export type TornoIncidentChild = {
  id: string | number;
  parentId?: string | number;
  description: string;
  status: TornoIncidentStatus;
  createdAt?: string | null;
  resolvedAt?: string | null;
  user?: string;
  comments?: string;
  images: TornoImageRef[];
  original?: unknown;
};

export type TornoIncidentParent = {
  id: string | number;
  title: string;
  description: string;
  failureType: TornoFailureType;
  status: TornoIncidentStatus;
  createdAt?: string | null;
  resolvedAt?: string | null;
  user?: string;
  comments?: string;
  images: TornoImageRef[];
  children: TornoIncidentChild[];
  original?: unknown;
};

export type TornoHistoryItem = {
  id: string | number;
  servicioId?: string | number;
  rondaServicioId?: string | number;
  ruedaSolicitudId?: string | number | null;
  movimientoId?: string | number | null;
  localidadId?: string | number | null;
  empresaId?: string | number | null;
  status: TornoServiceStatus;
  storedStatus?: TornoServiceStatus;
  locomotive?: string | number;
  numeroLocomotora?: string | number;
  service?: string;
  companyName?: string;
  localityName?: string;
  originName?: string;
  destinationName?: string;
  priority?: string | null;
  rondaNumber?: string | number | null;
  orderNumber?: string | number | null;
  startAt?: string | null;
  endAt?: string | null;
  date?: string | null;
  updatedAt?: string | null;
  operator?: string;
  operatorId?: string | number | null;
  measuresRequested?: TornoMeasures;
  measuresFinal?: TornoMeasures;
  work?: TornoWorkSummary | null;
  activeIncidents?: number;
  hasIncident?: boolean;
  incidents?: TornoIncidentParent[];
  original?: unknown;
};

export type TornoPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage?: boolean;
  hasPrevPage?: boolean;
};

export type TornoListResult<T> = {
  items: T[];
  meta: TornoPagination;
};

export type TornoFilters = {
  empresaId?: number | null;
  localidadId?: number | null;
  servicioId?: string | number | null;
  torneroId?: string | number | null;
  numeroLocomotora?: string | number | null;
  rondaServicioId?: string | number | null;
  ruedaSolicitudId?: string | number | null;
  numeroNavaja?: string | number | null;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  search?: string;
  page?: number;
  pageSize?: number;
};

export type TornoPermissions = {
  role: TornoRole;
  scopeEmpresaId: boolean;
  scopeLocalidadId: boolean;
  canViewHistory: boolean;
  canViewDurations: boolean;
  canOperateServices: boolean;
  canCancelServices: boolean;
  canManageFinalMeasures: boolean;
  canViewIncidents: boolean;
  canManageIncidents: boolean;
  canResolveParentIncident: boolean;
  canResolveChildIncident: boolean;
  canViewNavajas: boolean;
  canManageNavajas: boolean;
};

export type TornoServiceStartPayload = {
  torneroId: string | number;
  inicio?: string;
};

export type TornoAxisPayload = {
  lados?: TornoWheelSide[];
  fechaInicio?: string;
  fechaFin?: string;
};

export type TornoFinalMeasuresPayload = {
  ruedaSolicitudId: string | number;
  torneroId: string | number;
  measures: TornoMeasures;
};

export type TornoIncidentPayload = {
  creadoPorId?: string | number;
  atendidoPorId?: string | number;
  numeroLocomotora?: string | number;
  rondaServicioId?: string | number;
  ruedaSolicitudId?: string | number;
  parentId?: string | number;
  failureType: TornoFailureType;
  description: string;
  comments?: string;
  images?: File[];
};

export type TornoResolvePayload = {
  comments?: string;
  atendidoPorId?: string | number;
};

export type TornoReopenPayload = {
  comments?: string;
};

export type TornoNavajaChange = {
  id: string | number;
  localidadId?: string | number;
  numeroNavaja?: string | number;
  status?: string;
  fechaCambio?: string | null;
  requestedAt?: string | null;
  completedAt?: string | null;
  user?: string;
  comments?: string;
  images?: TornoImageRef[];
  nava?: {
    id?: string | number;
    localidadId?: string | number;
    cantidad?: number;
    createdAt?: string | null;
    updatedAt?: string | null;
  };
  original?: unknown;
};

export type TornoLocalidadLite = {
  id: string | number;
  nombre: string;
};
