import type { QueueMovement, QueueUnit } from "./queueView";

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
  const pending = Boolean(
    client &&
    client.userId > 0 &&
    client.empresaId > 0 &&
    client.empresaId === movement.empresaId &&
    unit.estado === "PENDIENTE" &&
    ["SOLICITADO", "ASIGNADO"].includes(movement.estado) &&
    !movement.fechaInicio &&
    !unit.fechaInicio,
  );
  return {
    canEdit: pending && ownsRequest && Boolean(client?.canEdit),
    canCancel: pending && Boolean(client?.canCancel),
  };
}
