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
  const pending = Boolean(
    client &&
    client.empresaId === movement.empresaId &&
    unit.estado === "PENDIENTE" &&
    ["SOLICITADO", "ASIGNADO"].includes(movement.estado) &&
    !movement.fechaInicio &&
    !unit.fechaInicio,
  );
  return {
    canEdit: pending && Boolean(client?.canEdit),
    canCancel:
      pending &&
      Boolean(client?.canCancel) &&
      (movement.clienteId === client?.userId || movement.creadoPorId === client?.userId),
  };
}
