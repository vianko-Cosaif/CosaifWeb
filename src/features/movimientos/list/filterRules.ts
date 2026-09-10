import { getFilterPolicy, type UserMeta } from '@/lib/routePolicy';
import type { Ambito, FiltrosMovimientos } from './useMovimientos';

export const MOVEMENT_STATES = {
  actuales: ['SOLICITADO', 'EN_PROCESO', 'ESPERA'],
  pasados: ['DETENIDO', 'CANCELADO', 'CONCLUIDO'],
} as const;
export const CURRENT_QUEUE_STATES = [...MOVEMENT_STATES.actuales, 'DETENIDO', 'AGENDADO'] as const;
const ORDERS = ['id', 'locomotora', 'solicitud', 'inicio', 'fin', 'estado', 'prioridad', 'tipo', 'localidad', 'empresa'];
export const DEFAULT_MOVEMENT_FILTERS: FiltrosMovimientos = {
  pagina: 1, tamPagina: 25, campoOrden: 'id', direccionOrden: 'desc', busqueda: '', fechaCampo: 'solicitud',
};
export type MovementFilterScope = UserMeta & { bloquearLocalidad?: boolean };
const positiveId = (value: unknown) => Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : undefined;
const text = (value: unknown) => typeof value === 'string' ? value.slice(0, 120) : '';

export function movementFilterPolicy(scope: MovementFilterScope, ambito: Ambito) {
  const policy = getFilterPolicy(scope, { movementPeriod: ambito });
  if (scope.bloquearLocalidad) {
    policy.canEditLocalidad = false;
    policy.forcedLocalidadId = scope.authorization?.scope.mode === 'GLOBAL'
      ? positiveId(scope.localidadId)
      : policy.forcedLocalidadId ?? positiveId(scope.authorization?.scope.localidadId) ?? positiveId(scope.localidadId);
  }
  return policy;
}

/** Every entry point (controls, saved URLs and period changes) uses the same rules. */
export function normalizeMovementFilters(input: Partial<FiltrosMovimientos>, ambito: Ambito, scope: MovementFilterScope = {}): FiltrosMovimientos {
  const policy = movementFilterPolicy(scope, ambito);
  const allowedStates: readonly string[] = (scope.authorization?.role ?? scope.rol) === 'CLIENTE' && ambito === 'actuales' ? CURRENT_QUEUE_STATES : MOVEMENT_STATES[ambito];
  const estado = [...new Set(text(input.estado).split(',').map(value => value.trim().toUpperCase()).filter(value => allowedStates.includes(value)))].join(',');
  const prioridad = text(input.prioridad).trim().toUpperCase();
  return {
    empresaId: policy.forcedEmpresaId ?? positiveId(input.empresaId),
    localidadId: policy.forcedLocalidadId ?? positiveId(input.localidadId),
    busqueda: text(input.busqueda),
    estado: estado || undefined,
    prioridad: ['ALTA', 'BAJA'].includes(prioridad) ? prioridad : undefined,
    locomotiveNumber: text(input.locomotiveNumber).trim() || undefined,
    locomotivePrefix: text(input.locomotivePrefix).trim() || undefined,
    desde: text(input.desde).trim() || undefined,
    hasta: text(input.hasta).trim() || undefined,
    fechaCampo: ['solicitud', 'inicio', 'fin', 'creacion'].includes(String(input.fechaCampo)) ? input.fechaCampo : 'solicitud',
    pagina: Math.min(10_000, Math.max(1, Math.trunc(Number(input.pagina) || 1))),
    tamPagina: [10, 20, 25, 50].includes(Number(input.tamPagina)) ? Number(input.tamPagina) : Number(input.tamPagina) > 50 ? 50 : 25,
    campoOrden: ORDERS.includes(String(input.campoOrden)) ? input.campoOrden! : 'id',
    direccionOrden: input.direccionOrden === 'asc' ? 'asc' : 'desc',
  };
}

/** Date-only boundaries use the user's timezone; ISO timestamps retain their offset. */
export function movementDateBoundary(input: string, end = false): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})?)?$/.exec(input);
  if (!match) return null;
  const [, yy, mm, dd, hh, min, ss, zone] = match;
  const year = Number(yy), month = Number(mm), day = Number(dd);
  const calendar = new Date(Date.UTC(year, month - 1, day));
  if (year < 1000 || calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day || Number(hh ?? 0) > 23 || Number(min ?? 0) > 59 || Number(ss ?? 0) > 59) return null;
  const date = zone ? new Date(input) : new Date(year, month - 1, day, hh ? Number(hh) : end ? 23 : 0, min ? Number(min) : end ? 59 : 0, ss ? Number(ss) : !hh && end ? 59 : 0, !hh && end ? 999 : 0);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function movementFilterError(filters: FiltrosMovimientos) {
  const from = filters.desde ? movementDateBoundary(filters.desde) : null;
  const to = filters.hasta ? movementDateBoundary(filters.hasta, true) : null;
  if ((filters.desde && !from) || (filters.hasta && !to)) return 'Selecciona fechas válidas para consultar movimientos.';
  if (from && to && from > to) return 'La fecha desde no puede ser posterior a la fecha hasta.';
  if ([filters.locomotiveNumber, filters.locomotivePrefix].some(value => value && !/^\d+$/.test(value))) return 'El número de locomotora debe contener solo dígitos.';
  return null;
}

export function movementSearchParams(filters: FiltrosMovimientos, ambito: Ambito) {
  const params = new URLSearchParams({ page: String(filters.pagina), pageSize: String(filters.tamPagina), sortBy: filters.campoOrden, sortDir: filters.direccionOrden, ambito });
  if (filters.busqueda.trim()) params.set('q', filters.busqueda.trim());
  for (const key of ['empresaId', 'localidadId', 'estado', 'prioridad', 'locomotiveNumber', 'locomotivePrefix'] as const) {
    if (filters[key] != null && filters[key] !== '') params.set(key, String(filters[key]));
  }
  if (filters.desde || filters.hasta) params.set('fechaCampo', filters.fechaCampo ?? 'solicitud');
  if (filters.desde) params.set('fechaDesde', movementDateBoundary(filters.desde) ?? '');
  if (filters.hasta) params.set('fechaHasta', movementDateBoundary(filters.hasta, true) ?? '');
  return params.toString();
}
