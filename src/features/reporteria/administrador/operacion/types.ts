export type Metrics = { total: number; concluded: number; cancelled: number; stopped: number; pending: number; incidents: number; affected: number; incidentRate: number | null; waitN: number; waitMedian: number | null; waitP90: number | null; executionN: number; executionMedian: number | null; executionP90: number | null; withinTarget: number; targetRate: number | null; overTarget: number; missingWait: number; withIssues: number; durationShort: number; durationAcceptable: number; durationLong: number; durationUnassessed: number; acceptableRate: number | null; waitAverage: number | null; executionAverage: number | null; excessMinutes: number; incidentMinutes: number; incidentDays: number | null; incidentTimeN: number; incidentTimeMissing: number; clientDelayMinutes: number; clientDelayDays: number | null; clientDelayN: number; clientDelayMissing: number; concludedMinutes: number; durationOpen: number; durationMissing: number; cancelledByIncidentLimit: number; reprogrammed: number; elapsedN: number; elapsedTotal: number; elapsedAverage: number | null; liveExecutionMinutes: number; elapsedOpenN: number };
export type Group = Metrics & { key: string; label: string; smallSample: boolean };
export type ClientGroup = Group & { companyId: number; company: string; clientId: number | null; client: string };
export type IncidentMetrics = { total: number; movements: number; open: number; closed: number; resolved: number; resolutionN: number; resolutionAverage: number | null; resolutionMedian: number | null; resolutionP90: number | null; resolutionMissing: number; oldestOpen: number; durationN: number; medianClose: number | null; missingClose: number };
export type ExploreGroup = { group: string; groupKey: string; label: string };
export type Explore = (filter?: string, q?: string, issue?: string, state?: string, group?: ExploreGroup) => void;
export type OperationReport = {
  meta: { id: string; generatedAt: string; expiresAt: string; zone: string; from: string; to: string; start: string; endExclusive: string; previousStart: string; previousEndExclusive: string; partialDay: boolean; target: number; company: string; client: string; locality: string; type: string; firstRequest: string | null; lastRequest: string | null; comparisonCovered: boolean; warnings: string[] };
  summary: Metrics; baseline: Metrics; companies: Group[]; shifts: Group[]; days: Group[]; hours: Group[]; routes: Group[]; locomotives: Group[]; operators: Group[]; states: Group[];
  destinations: (Metrics & { key: 'lathe' | 'wash'; label: string; completedVia: number; completedService: number; serviceRequests: number; completed: Metrics; clients: (Group & { completed: Metrics; completedVia: number; completedService: number; serviceRequests: number })[]; companies: Group[] })[];
  retries: { key: string; company: string; client: string; locomotive: number; ids: number[]; attempts: number; state: string; clientDelayMinutes: number; clientDelayMissing: number; waitMinutes: number; executionMinutes: number; incidents: number; cancelledByIncidentLimit: boolean; continuesOutside: boolean }[];
  clients: ClientGroup[]; vias: (Group & { origins: number; destinations: number })[];
  quality: { key: string; label: string; count: number }[];
  insights: { title: string; detail: string; action: string; filter: string }[];
  methodology: { label: string; text: string }[];
  catalogs: { companies: { id: number; nombre: string }[]; localities: { id: number; nombre: string }[]; clients: { id: number; nombre: string; companyIds: number[] }[] };
  incidents: IncidentMetrics & { frequent: { description: string; count: number; movements: number; share: number | null }[]; reporters: (IncidentMetrics & { key: string; label: string })[] };
};
export type DetailRow = {
  id: number; company: string; locality: string; locomotive: number; state: string; stateLabel: string; type: string;
  origin: string; destination: string; destinationRaw: string | null; destinationEvidence: 'via' | 'service' | 'ambiguous' | 'missing'; operator: string; supervisor: string; coordinator: string;
  requestedAt: string; startedAt: string | null; endedAt: string | null; wait: number | null; execution: number | null;
  pending: boolean; durationEnd: string | null; stoppedAt: string | null; clientDelay: number | null; elapsed: number | null; elapsedProvisional: boolean; reprogrammedTo: number | null; cancelledByIncidentLimit: boolean;
  incidentCount: number; issues: string[];
  client: string; durationBand: 'short' | 'acceptable' | 'long' | 'unassessed'; incidentMinutes: number | null;
  incidents: { id: number; description: string; state: string; startedAt: string; endedAt: string | null }[];
};
export type Detail = { page: number; pages: number; total: number; pageSize: number; rows: DetailRow[] };
export type Filters = { from: string; to: string; companyId: string; clientId: string; localityId: string; type: string; target: string };
