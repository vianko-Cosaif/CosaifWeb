import type { QueueEntityKind, Ronda, RondaInfo } from "../types";

export type ClientQueueSelection = {
  localidadId: number;
  empresaId?: number | null;
  entity: QueueEntityKind;
};

export function clientQueueUrl(selection: ClientQueueSelection) {
  const params = new URLSearchParams({
    localidadId: String(selection.localidadId),
    estado: "pendientes",
    entity: selection.entity,
    alcance: "localidad",
  });
  return `/api/cliente/rondas?${params}`;
}

function isFinished(item: Ronda) {
  return item.concluido || ["CONCLUIDO", "CANCELADO"].includes(String(item.movimiento?.estado ?? "").toUpperCase());
}

/** Presentation safeguards complement the signed scope enforced by the API. */
export function selectClientQueue(items: readonly Ronda[], selection: ClientQueueSelection) {
  return items.filter((item) => {
    const localidadId = item.localidadId ?? item.localidad?.id;
    if (localidadId && localidadId !== selection.localidadId) return false;
    return !isFinished(item);
  }).sort((a, b) => a.rondaNumero - b.rondaNumero || a.orden - b.orden || a.id - b.id);
}

export function clientQueueInfo(items: readonly Ronda[]): Record<number, RondaInfo> {
  return Object.fromEntries(items.map((item) => [item.id, {
    empresa: item.empresa ?? { id: 0, nombre: "—" },
    movimientoId: item.movimiento?.id ?? item.movimientoId ?? undefined,
    movimiento: {
      ...item.movimiento,
      lavado: Boolean(item.movimiento?.lavado),
      torno: Boolean(item.movimiento?.torno),
      estado: item.movimiento?.estado ?? undefined,
      prioridad: item.movimiento?.prioridad ?? undefined,
      locomotiveNumber: item.movimiento?.locomotiveNumber ?? item.movimiento?.locomotora ?? undefined,
    },
  }]));
}
