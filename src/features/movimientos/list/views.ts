import type { Ambito, FiltrosMovimientos } from './useMovimientos';

export type MovementView = { ambito: Ambito; filtros: Partial<FiltrosMovimientos> };
const ORDERS = ['id', 'locomotora', 'solicitud', 'inicio', 'fin', 'estado', 'prioridad', 'tipo', 'localidad', 'empresa'];
export function parseMovementView(raw: string | null): MovementView | null {
  if (!raw || raw.length > 4000) return null;
  try {
    const value = JSON.parse(raw);
    if (!value || !['actuales', 'pasados'].includes(value.ambito) || !value.filtros || typeof value.filtros !== 'object') return null;
    const input = value.filtros as Record<string, unknown>;
    const filtros: Partial<FiltrosMovimientos> = {};
    for (const name of ['busqueda', 'estado', 'prioridad', 'locomotiveNumber', 'locomotivePrefix', 'desde', 'hasta'] as const) {
      if (typeof input[name] === 'string') filtros[name] = input[name].slice(0, 120);
    }
    for (const name of ['empresaId', 'localidadId'] as const) {
      const id = Number(input[name]);
      if (Number.isSafeInteger(id) && id > 0) filtros[name] = id;
    }
    if (['solicitud', 'inicio', 'fin', 'creacion'].includes(String(input.fechaCampo))) filtros.fechaCampo = input.fechaCampo as FiltrosMovimientos['fechaCampo'];
    if (ORDERS.includes(String(input.campoOrden))) filtros.campoOrden = input.campoOrden as FiltrosMovimientos['campoOrden'];
    if (input.direccionOrden === 'asc' || input.direccionOrden === 'desc') filtros.direccionOrden = input.direccionOrden;
    if ([10, 20, 25, 50, 100].includes(Number(input.tamPagina))) filtros.tamPagina = Math.min(50, Number(input.tamPagina));
    filtros.pagina = Math.min(10_000, Math.max(1, Math.trunc(Number(input.pagina) || 1)));
    return { ambito: value.ambito, filtros };
  } catch { return null; }
}

export function scopedMovementFilters(current: FiltrosMovimientos, view: MovementView, scope: { empresaId?: number | null; localidadId?: number | null }) {
  return { ...current, busqueda: '', estado: undefined, prioridad: undefined, desde: undefined, hasta: undefined, locomotiveNumber: undefined, locomotivePrefix: undefined, empresaId: undefined, localidadId: undefined, ...view.filtros,
    ...(scope.empresaId != null ? { empresaId: scope.empresaId } : {}), ...(scope.localidadId != null ? { localidadId: scope.localidadId } : {}) };
}
