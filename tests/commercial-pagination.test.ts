import { describe, expect, it, vi } from 'vitest';
import { commercialApi } from '@/features/comercial/lib/api';
import { loadCrmCatalog, loadCrmPage } from '@/features/comercial/lib/pagination';
vi.mock('@/features/comercial/lib/api', () => ({ commercialApi: vi.fn() }));
const api = vi.mocked(commercialApi);
const page = (number: number, total = 4) => ({ data: [number], meta: { page: number, pageSize: 1, total, totalPages: total } });
describe('commercial pagination', () => {
  it('loads exactly one page for a navigable list', async () => {
    api.mockResolvedValue(page(3)); const result = await loadCrmPage('/bff/comercial/contratos?estado=VIGENTE&pageSize=100', 3, new AbortController().signal);
    expect(result.data).toEqual([3]); expect(api).toHaveBeenCalledTimes(1); expect(api.mock.calls[0][0]).toContain('pageSize=25');
  });
  it('loads complete catalogues in order with at most three concurrent calls', async () => {
    let active = 0, peak = 0;
    api.mockImplementation(async path => { const number = Number(new URL(path, 'http://test').searchParams.get('page')); active++; peak = Math.max(peak, active); await new Promise(r => setTimeout(r, number % 2)); active--; return page(number, 8); });
    expect(await loadCrmCatalog('/catalog', new AbortController().signal)).toEqual([1,2,3,4,5,6,7,8]); expect(peak).toBeLessThanOrEqual(3);
  });
  it('refuses incomplete totals instead of returning a truncated catalogue', async () => {
    api.mockResolvedValue({ data: [], meta: { page: 1, pageSize: 100, total: 20, totalPages: 1 } });
    await expect(loadCrmCatalog('/catalog', new AbortController().signal)).rejects.toThrow('completa');
  });
  it('fails if records change during pagination', async () => {
    api.mockImplementation(async path => page(Number(new URL(path, 'http://test').searchParams.get('page')), path.includes('page=1&') ? 4 : 5));
    await expect(loadCrmCatalog('/catalog', new AbortController().signal)).rejects.toThrow('cambiaron');
  });
});
