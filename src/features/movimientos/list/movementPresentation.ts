import type { Movement } from "./useMovimientos";

export function getMovementFolio(movement: Movement) {
  if (movement.folioLocalidadLabel) return movement.folioLocalidadLabel;
  if (movement.folioLocalidad) return `#${movement.folioLocalidad}`;
  return `#${movement.id}`;
}

export function getMovementTechnicalId(movement: Movement) {
  const raw = movement.idTecnico ?? movement.id;
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : movement.id;
}

export function getMovementRowKey(movement: Movement) {
  return `${movement.localidadId || 0}:${getMovementTechnicalId(movement)}`;
}

