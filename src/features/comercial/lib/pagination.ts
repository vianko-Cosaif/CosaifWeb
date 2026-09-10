import type { PageResponse } from '../types';
import { commercialApi } from './api';

export function withPage(path: string, page: number, pageSize = 25) {
  const [base, search = ''] = path.split('?');
  const params = new URLSearchParams(search);
  params.set('page', String(page));
  params.set('pageSize', String(pageSize));
  return `${base}?${params}`;
}

export async function loadCrmPage<T>(path: string, page: number, signal: AbortSignal, pageSize = 25) {
  const payload = await commercialApi<PageResponse<T>>(withPage(path, page, pageSize), { signal });
  if (!Array.isArray(payload.data) || !payload.meta || !Number.isInteger(payload.meta.totalPages) || payload.meta.totalPages < 0) {
    throw new Error('El servicio devolvió una lista incompleta. Actualiza la vista.');
  }
  return payload;
}

/** Complete data for selectors and reconciliations; never expose a truncated financial total. */
export async function loadCrmCatalog<T>(path: string, signal: AbortSignal) {
  const first = await loadCrmPage<T>(path, 1, signal, 100);
  const count = Math.max(1, first.meta.totalPages);
  if (count > 500) throw new Error('La consulta contiene demasiados registros. Reduce el periodo o selecciona un cliente.');
  const pages = new Array<T[]>(count);
  pages[0] = first.data;
  let next = 2;
  await Promise.all(Array.from({ length: Math.min(3, count - 1) }, async () => {
    while (next <= count) {
      signal.throwIfAborted();
      const page = next++;
      const result = await loadCrmPage<T>(path, page, signal, 100);
      if (result.meta.total !== first.meta.total || result.meta.totalPages !== first.meta.totalPages) {
        throw new Error('Los registros cambiaron durante la consulta. Actualiza para obtener una lista completa.');
      }
      pages[page - 1] = result.data;
    }
  }));
  const items = pages.flat();
  if (items.length !== first.meta.total) throw new Error('La consulta no está completa. Actualiza antes de continuar.');
  return items;
}
