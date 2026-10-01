import type { StatusTab } from "./types";

export const STATUS_TABS: Array<{ value: StatusTab; label: string }> = [
  { value: "activos", label: "Actuales" },
  { value: "concluidos", label: "Pasados" },
  { value: "todos", label: "Todos" },
];

export const STAGES = [
  { key: "ANTES_MOVIMIENTO", label: "Inicio" },
  { key: "PROCESO_MOVIMIENTO", label: "Traslado" },
  { key: "FIN_MOVIMIENTO", label: "Fin" },
] as const;
