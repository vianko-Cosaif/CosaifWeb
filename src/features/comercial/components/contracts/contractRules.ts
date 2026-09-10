import type { Contract } from "../../types";
import { todayIso } from "../../lib/format";

export type ContractRule = NonNullable<Contract["paquetes"]>[number];
export type Locality = { id: number; nombre: string };
export type ContractService = "MOVIMIENTO" | "LAVADO" | "TORNEADO";
export type ContractWorkType = "NATURAL" | "ARRASTRE" | "LAVADO" | "TORNEADO";
export type RuleUnit = "MOVIMIENTO" | "VAGON" | "SERVICIO" | "TARIFA_FIJA";
export type RulePeriodicity = ContractRule["periodicidad"];

export const DEFAULT_BILLABLE_STATUSES = ["CONCLUIDO", "CANCELADO", "DETENIDO", "EN_PROCESO"];
export const BILLABLE_STATUS_OPTIONS = [
  { value: "CONCLUIDO", label: "Concluidos" },
  { value: "CANCELADO", label: "Cancelados" },
  { value: "DETENIDO", label: "Detenidos" },
  { value: "EN_PROCESO", label: "En proceso" },
] as const;

export function primaryRule(contract: Contract) {
  return contract.paquetes?.[0];
}

export function canEditContract(contract: Contract) {
  return contract.estado !== "CANCELADO" && (!contract.fechaFin || dateInput(contract.fechaFin) >= todayIso());
}

export function dateInput(value?: string | null) {
  return value ? value.slice(0, 10) : "";
}

export function workTypeFromRule(rule?: ContractRule): ContractWorkType {
  if (rule?.servicio === "LAVADO") return "LAVADO";
  if (rule?.servicio === "TORNEADO") return "TORNEADO";
  if (rule?.origenOperacion === "ARRASTRE") return "ARRASTRE";
  return "NATURAL";
}

export function serviceForWorkType(value: ContractWorkType): ContractService {
  if (value === "LAVADO") return "LAVADO";
  if (value === "TORNEADO") return "TORNEADO";
  return "MOVIMIENTO";
}

export function originForWorkType(value: ContractWorkType) {
  if (value === "ARRASTRE") return "ARRASTRE";
  if (value === "NATURAL") return "NATURAL";
  return null;
}

export function normalizeRuleUnit(value: ContractRule["unidad"] | undefined, workType: ContractWorkType): RuleUnit {
  if (value === "TARIFA_FIJA") return value;
  if (value === "VAGON") return workType === "ARRASTRE" ? "VAGON" : "MOVIMIENTO";
  if (value === "SERVICIO") return "SERVICIO";
  return workType === "LAVADO" || workType === "TORNEADO" ? "SERVICIO" : "MOVIMIENTO";
}

export function workTypeLabel(value: ContractWorkType) {
  if (value === "ARRASTRE") return "Arrastre Torreón";
  if (value === "LAVADO") return "Lavado";
  if (value === "TORNEADO") return "Torneado";
  return "Movimiento natural";
}

export function torreonLocalityId(localities: Locality[]) {
  return localities.find((locality) => isTorreon(locality.nombre))?.id;
}

export function cutLabel(day: number | null) {
  return !day || day === 31 ? "Fin de mes" : `Día ${day}`;
}

export function unitPlural(value: ContractRule["unidad"]) {
  if (value === "VAGON") return "vagones";
  if (value === "SERVICIO") return "servicios";
  if (value === "TARIFA_FIJA") return "cuota fija";
  return "movimientos";
}

export function excessUnitLabel(value: RuleUnit) {
  if (value === "VAGON") return "vagón";
  if (value === "SERVICIO") return "servicio";
  return "movimiento";
}

export function isTorreon(value?: string) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes("torreon");
}

