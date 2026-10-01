import { describe, expect, it } from 'vitest';
import { parseMovementView, scopedMovementFilters } from '@/features/movimientos/list/views';
import type { FiltrosMovimientos } from '@/features/movimientos/list/useMovimientos';
import { parseTelemetry, routeFamily } from '@/lib/observability/events';
import { normalizeConfigShape } from '@/features/actualizaciones/BannerService';
describe('saved views and safe observability', () => {
  it('validates view input and always applies the authenticated scope', () => {
    const view = parseMovementView(JSON.stringify({ ambito: 'actuales', filtros: { empresaId: 99, localidadId: 22, tamPagina: 10000, pagina: -3, campoOrden: 'DROP TABLE', estado: 'DETENIDO' } }))!;
    expect(view.filtros.tamPagina).toBeUndefined(); expect(view.filtros.campoOrden).toBeUndefined();
    const current: FiltrosMovimientos = { pagina: 1, tamPagina: 25, campoOrden: 'id', direccionOrden: 'desc', busqueda: '' };
    expect(scopedMovementFilters(current, view, { empresaId: 5, localidadId: 7 })).toMatchObject({ empresaId: 5, localidadId: 7, estado: 'DETENIDO', pagina: 1 });
  });
  it('rejects malformed or excessive saved views', () => {
    expect(parseMovementView('bad json')).toBeNull(); expect(parseMovementView('x'.repeat(5000))).toBeNull();
  });
  it('does not retain query values, identifiers or error text in telemetry', () => {
    expect(routeFamily('/cliente/editar?id=secret')).toBe('/cliente');
    const result = parseTelemetry([{ kind: 'error', name: 'render', route: '/cliente/private-name?token=secret', at: 1, message: 'password' }]);
    expect(result).toEqual([{ kind: 'error', name: 'render', route: '/cliente', at: 1, value: undefined }]);
    expect(parseTelemetry([{ kind: 'vital', name: 'LCP', value: -1, route: '/', at: 1 }])).toEqual([]);
  });
  it('normalizes legacy banners and preserves explicit order', () => {
    const result = normalizeConfigShape({ banners: [{ id: 'b', layers: [] }, { banner: { id: 'a', layers: [] } }], bannerItems: [{ id: 'a', order: 0 }, { id: 'b', order: 1 }], activeBannerId: 'a' });
    expect(result?.banner?.id).toBe('a'); expect(result?.banners?.map(item => item?.id)).toEqual(['a', 'b']); expect(result?.banner?.designWidth).toBe(800);
  });
});
