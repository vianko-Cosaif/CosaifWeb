import type { QueueMovement, QueueUnit } from "./queueView";
import { canCancelNaturalState } from "./cancellationPolicy";

export type NaturalClientActions = {
  userId: number;
  empresaId: number;
  canEdit: boolean;
  canCancel: boolean;
};

export function naturalClientActions(
  unit: QueueUnit,
  movement: QueueMovement,
  client?: NaturalClientActions,
) {
  const ownsRequest = Boolean(
    client &&
    client.userId > 0 &&
    (movement.clienteId === client.userId || movement.creadoPorId === client.userId),
  );
  const sameCompany = Boolean(
    client && client.userId > 0 && client.empresaId > 0 && client.empresaId === movement.empresaId,
  );
  const pending = Boolean(
    sameCompany &&
    unit.estado === "PENDIENTE" &&
    ["SOLICITADO", "ASIGNADO"].includes(movement.estado) &&
    !movement.fechaInicio &&
    !unit.fechaInicio,
  );
  return {
    canEdit: pending && ownsRequest && Boolean(client?.canEdit),
    canCancel: sameCompany && Boolean(client?.canCancel) && canCancelNaturalState(movement, unit),
  };
}
