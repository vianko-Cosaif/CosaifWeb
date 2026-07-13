import type { ArrastreStatus, VagonStatusFilter } from "./types";

export const STATUS_OPTIONS: Array<{ value: ArrastreStatus; label: string }> = [
  { value: "TODOS", label: "Todos" },
  { value: "SOLICITADO", label: "Solicitados" },
  { value: "EN_PROCESO", label: "En proceso" },
  { value: "DETENIDO", label: "Detenidos" },
  { value: "CONCLUIDO", label: "Concluidos" },
  { value: "CANCELADO", label: "Cancelados" },
];

export const VAGON_STATUS_OPTIONS: Array<{ value: VagonStatusFilter; label: string }> = [
  { value: "TODOS", label: "Todos los vagones" },
  { value: "PENDIENTE", label: "Pendientes" },
  { value: "EN_PROCESO", label: "En proceso" },
  { value: "BLOQUEADO", label: "Bloqueados" },
  { value: "CONCLUIDO", label: "Listos" },
];

export const OPERATIONAL_STATUSES = new Set(["SOLICITADO", "EN_PROCESO", "DETENIDO"]);
export const HISTORY_STATUSES = new Set(["CONCLUIDO", "CANCELADO"]);
