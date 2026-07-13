import type { Arrastre, VagonArrastre } from "@/features/torreon/arrastres";
import { statusText } from "../../utils";

export type Direction = "up" | "down";

export function orderedVagones(arrastre: Arrastre) {
  return [...(arrastre.vagones || [])].sort((left, right) => (left.orden ?? 0) - (right.orden ?? 0) || left.id - right.id);
}

export function vagonLabel(vagon?: VagonArrastre | null) {
  if (!vagon) return "-";
  return vagon.numeroVagon || `Vagon ${vagon.orden}`;
}

export function statusCount(arrastre: Arrastre, status: string) {
  return orderedVagones(arrastre).filter((vagon) => statusText(vagon.estado) === status).length;
}

export function getStats(arrastre: Arrastre) {
  const vagones = orderedVagones(arrastre);
  const total = arrastre.resumen?.totalVagones ?? vagones.length;
  const pendientes = arrastre.resumen?.pendientes ?? statusCount(arrastre, "PENDIENTE");
  const proceso = arrastre.resumen?.enProceso ?? statusCount(arrastre, "EN_PROCESO");
  const bloqueados = arrastre.resumen?.bloqueados ?? statusCount(arrastre, "BLOQUEADO");
  const concluidos = arrastre.resumen?.concluidos ?? statusCount(arrastre, "CONCLUIDO");
  const pct = total > 0 ? Math.round((concluidos / total) * 100) : 0;

  return { total, pendientes, proceso, bloqueados, concluidos, pct };
}

export function getCurrentVagon(arrastre: Arrastre) {
  const vagones = orderedVagones(arrastre);
  return vagones.find((vagon) => statusText(vagon.estado) === "EN_PROCESO")
    || vagones.find((vagon) => statusText(vagon.estado) === "PENDIENTE")
    || vagones.find((vagon) => statusText(vagon.estado) === "BLOQUEADO")
    || null;
}

export function getNextVagones(arrastre: Arrastre) {
  return orderedVagones(arrastre).filter((vagon) => statusText(vagon.estado) !== "CONCLUIDO").slice(0, 2);
}

export function canMoveWithNeighbor(vagones: VagonArrastre[], index: number, direction: Direction) {
  const nextIndex = direction === "up" ? index - 1 : index + 1;
  if (nextIndex < 0 || nextIndex >= vagones.length) return false;
  const blockedForMove = new Set(["EN_PROCESO", "CONCLUIDO"]);
  return !blockedForMove.has(statusText(vagones[index]?.estado)) && !blockedForMove.has(statusText(vagones[nextIndex]?.estado));
}
