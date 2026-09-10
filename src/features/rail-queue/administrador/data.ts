import { mapConcurrent } from "@/lib/http/concurrency";
import { attachLocalidad, fetchJson, isAbortError } from "../utils";
import type { Localidad, Ronda, RondaInfo } from "../types";

export const ADMIN_QUEUE_CONCURRENCY = 3;

export function sortRounds(items: Ronda[]): Ronda[] {
  return items.sort((a, b) => a.rondaNumero - b.rondaNumero || a.orden - b.orden || a.id - b.id);
}

export function replaceLocalidadRounds(previous: Ronda[], localidadId: number, incoming: Ronda[]) {
  return sortRounds([
    ...previous.filter((item) => (item.localidadId ?? item.localidad?.id) !== localidadId),
    ...incoming,
  ]);
}

/** A failed locality never becomes an empty, apparently healthy queue. */
export async function loadAdminRounds({
  localidades,
  signal,
  force = false,
  onLocalidadLoaded,
}: {
  localidades: readonly Localidad[];
  signal: AbortSignal;
  force?: boolean;
  onLocalidadLoaded?: (localidad: Localidad, items: Ronda[]) => void;
}) {
  const results = await mapConcurrent(localidades, ADMIN_QUEUE_CONCURRENCY, async (localidad) => {
    signal.throwIfAborted();
    try {
      const result = await fetchJson<Ronda[]>(`/api/cliente/rondas?localidadId=${localidad.id}`, signal, { force });
      signal.throwIfAborted();
      if (!Array.isArray(result)) throw new Error("Respuesta de rondas inválida");
      const items = sortRounds(attachLocalidad(result, localidad));
      onLocalidadLoaded?.(localidad, items);
      return { items, unavailableLocalidad: null };
    } catch (error) {
      if (signal.aborted || isAbortError(error)) throw error;
      return { items: [] as Ronda[], unavailableLocalidad: localidad };
    }
  });
  return {
    items: sortRounds(results.flatMap((result) => result.items)),
    unavailableLocalidades: results.flatMap((result) => result.unavailableLocalidad ? [result.unavailableLocalidad] : []),
  };
}

export function rondaInfoMap(items: readonly Ronda[]): Record<number, RondaInfo> {
  const result: Record<number, RondaInfo> = {};
  for (const item of items) {
    const movement = item.movimiento;
    result[item.id] = {
      empresa: item.empresa ?? { id: 0, nombre: "—" },
      movimientoId: movement?.id ?? item.movimientoId ?? undefined,
      movimiento: {
        ...movement,
        lavado: Boolean(movement?.lavado),
        torno: Boolean(movement?.torno),
        estado: movement?.estado ?? undefined,
        prioridad: movement?.prioridad ?? undefined,
        locomotiveNumber: movement?.locomotiveNumber ?? movement?.locomotora ?? undefined,
      },
    };
  }
  return result;
}

export function summarizeAdminQueue(items: readonly Ronda[]) {
  const localidades = new Set<number>();
  let highPriority = 0;
  let stopped = 0;
  for (const item of items) {
    const localidadId = item.localidadId ?? item.localidad?.id;
    if (localidadId) localidades.add(localidadId);
    if (item.movimiento?.prioridad === "ALTA") highPriority++;
    if (item.movimiento?.estado === "DETENIDO") stopped++;
  }
  return { total: items.length, activeLocalidades: localidades.size, highPriority, stopped };
}
