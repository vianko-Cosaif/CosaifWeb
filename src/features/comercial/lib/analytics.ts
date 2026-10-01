import type { AnalyticsSummary } from '../types';
import { commercialApi } from './api';
import { withPage } from './pagination';

/** Contract calculations need every operation; API pageSize is capped at 100. */
export async function loadCompleteAnalytics(path: string, init: RequestInit = {}): Promise<AnalyticsSummary> {
  const first = await commercialApi<AnalyticsSummary>(withPage(path, 1, 100), init);
  const meta = first.operations.meta;
  const pages = Math.max(1, meta.totalPages);
  if (!Number.isInteger(pages) || pages > 500) throw new Error('La consulta es demasiado amplia. Selecciona un cliente o reduce el periodo.');
  const rows = new Array<AnalyticsSummary['operations']['data']>(pages); rows[0] = first.operations.data;
  let next = 2;
  await Promise.all(Array.from({ length: Math.min(3, pages - 1) }, async () => {
    while (next <= pages) {
      init.signal?.throwIfAborted();
      const page = next++;
      const part = await commercialApi<AnalyticsSummary>(withPage(path, page, 100), init);
      if (part.operations.meta.total !== meta.total) throw new Error('La operación cambió durante el cálculo. Actualiza la consulta.');
      rows[page - 1] = part.operations.data;
    }
  }));
  const data = rows.flat();
  if (data.length !== meta.total || new Set(data.map(row => row.key)).size !== data.length) throw new Error('Faltan operaciones para calcular el total. Actualiza o reduce el periodo.');
  return { ...first, operations: { data, meta: { ...meta, page: 1, pageSize: data.length, totalPages: 1 } } };
}
