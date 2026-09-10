
export type PanelGraficoProps = {
  backHref?: string;
  backLabel?: string;
  localidadId?: number | null;
  empresaId?: number | null;
  autoMs?: number;
};

export type IncidentSeverity = "CRITICO" | "ALTO" | "MEDIO" | "BAJO";

export type MovementStatus = "DETENIDO" | "EN PROCESO" | "SOLICITADO" | "EN COLA" | "EN ESPERA";

export type MovementType = "Torno" | "Lavado" | "Normal";

export type IncidentRow = {
  key: string;
  id: string;
  severity: IncidentSeverity;
  title: string;
  equipment: string;
  equipmentKey: string;
  time: string;
  occurredAtMs: number;
  rawStatus: string;
  active: boolean;
  signature: string;
};

export type MovementRow = {
  key: string;
  equipment: string;
  company: string;
  route: string;
  origin: string;
  destination: string;
  type: MovementType;
  status: MovementStatus;
  time: string;
  requestedAtMs: number;
  rondaNumero: number;
  orden: number;
  activeIncidentCount: number;
  signature: string;
};

export type PanelData = {
  incidents: IncidentRow[];
  movements: MovementRow[];
  torneados: MovementRow[];
};

export type PanelLoadingState = {
  movements: boolean;
  torneados: boolean;
  incidents: boolean;
  tracks: boolean;
};

export type PatioTrackCatalogItem = {
  id: string;
  label: string;
  number: number | null;
  sourceId: number | null;
};

export type HeaderEventTone = "incident" | "movement" | "torno" | "lavado" | "state";

export type HeaderEvent = {
  key: string;
  label: string;
  detail: string;
  subject: string;
  typeLabel: string;
  company: string;
  time: string;
  occurredAtMs: number;
  tone: HeaderEventTone;
  firstSeenAtMs?: number;
};

export type ChangeKind = "updated" | "moved" | "removed";

export type PanelRow = MovementRow | IncidentRow;

export type PatioTrackMode = "idle" | "entry" | "exit" | "blocked";

export type PatioLocomotiveStatus = "operating" | "moving" | "stopped" | "waiting";

export type PatioPlacement = "origin" | "destination" | "both";

export type PatioTrack = {
  id: string;
  label: string;
  angle: number;
  mode: PatioTrackMode;
  locomotive: {
    key: string;
    number: string;
    status: PatioLocomotiveStatus;
    type: MovementType;
    activeIncidentCount: number;
    placement: PatioPlacement | null;
    originTrackId: string | null;
    destinationTrackId: string | null;
  } | null;
  locomotives: Array<NonNullable<PatioTrack["locomotive"]>>;
  originTrackId: string | null;
  destinationTrackId: string | null;
  placement: PatioPlacement | null;
};

export type PatioRemovedGhost = PatioTrack & {
  removedAt: number;
  locomotive: NonNullable<PatioTrack["locomotive"]>;
};

export type PatioServiceActivity = {
  number: string;
  status: PatioLocomotiveStatus;
  type: MovementType;
} | null;

export type PatioTrackDefinition = {
  id: string;
  label: string;
  angle: number;
};

export type JsonRecord = Record<string, unknown>;
