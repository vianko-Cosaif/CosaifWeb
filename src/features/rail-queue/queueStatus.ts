import type { RondaMovement } from "./types";

/** A stopped GDL movement stays active until its operation is finalized. */
export function isCosaifMovementFinished(movement: Pick<RondaMovement, "estado" | "finalizado"> | null | undefined) {
  return movement?.finalizado === true ||
    ["CONCLUIDO", "CANCELADO", "RESUELTO"].includes(
      String(movement?.estado ?? "").trim().toUpperCase(),
    );
}
