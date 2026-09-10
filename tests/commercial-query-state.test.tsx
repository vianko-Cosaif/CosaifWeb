// @vitest-environment jsdom
import React from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CommercialDataProvider, { useCommercialData } from "@/features/comercial/components/CommercialDataProvider";
import { commercialApi } from "@/features/comercial/lib/api";
import { loadCrmPage } from "@/features/comercial/lib/pagination";
import { useCrmList } from "@/features/comercial/lib/useCrmList";

vi.mock("@/features/comercial/lib/api", async original => ({ ...await original<object>(), commercialApi: vi.fn() }));
vi.mock("@/features/comercial/lib/pagination", () => ({ loadCrmPage: vi.fn(), loadCrmCatalog: vi.fn() }));
const api = vi.mocked(commercialApi);
const pageApi = vi.mocked(loadCrmPage);
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { resolve, promise };
}
const summary = (operations: number) => ({ kpis: { operations } });
const page = (number: number) => ({ data: [number], meta: { page: number, total: 75, pageSize: 25, totalPages: 3 } });
const wrapper = ({ children }: { children: React.ReactNode }) => <CommercialDataProvider>{children}</CommercialDataProvider>;
beforeEach(() => { api.mockReset(); pageApi.mockReset(); });
afterEach(cleanup);

describe("consultas comerciales", () => {
  it("no repite la consulta al seleccionar de nuevo los mismos filtros", async () => {
    api.mockResolvedValue(summary(8));
    const { result } = renderHook(useCommercialData, { wrapper });
    await waitFor(() => expect(result.current.analytics?.kpis.operations).toBe(8));
    act(() => result.current.setFilters({ period: "MONTH", page: 1 }));
    expect(api).toHaveBeenCalledOnce();
  });

  it("oculta datos de otra página y descarta respuestas que llegan después de cancelar", async () => {
    const old = deferred<unknown>();
    api.mockResolvedValueOnce(summary(8)).mockImplementationOnce(() => old.promise).mockResolvedValueOnce(summary(3));
    const { result } = renderHook(useCommercialData, { wrapper });
    await waitFor(() => expect(result.current.analytics?.kpis.operations).toBe(8));
    act(() => result.current.setFilters({ page: 2 }));
    expect(result.current.analytics).toBeNull();
    act(() => result.current.setFilters({ empresaId: 5 }));
    await waitFor(() => expect(result.current.analytics?.kpis.operations).toBe(3));
    expect(result.current.filters.page).toBe(1);
    expect(api.mock.calls[1][1]?.signal?.aborted).toBe(true);
    await act(async () => old.resolve(summary(99)));
    expect(result.current.analytics?.kpis.operations).toBe(3);
  });

  it("mantiene las opciones del filtro visibles durante una consulta de otro periodo", async () => {
    const next = deferred<unknown>();
    const catalogs = { companies: [{ id: 5, nombre: "Empresa" }], localities: [{ id: 2, nombre: "Patio", estado: "Estado" }] };
    api.mockResolvedValueOnce({ ...summary(8), catalogs }).mockImplementationOnce(() => next.promise);
    const { result, unmount } = renderHook(useCommercialData, { wrapper });
    await waitFor(() => expect(result.current.catalogs).toEqual(catalogs));
    act(() => result.current.setFilters({ period: "YEAR" }));
    expect(result.current.analytics).toBeNull();
    expect(result.current.catalogs).toEqual(catalogs);
    unmount();
    expect(api.mock.calls[1][1]?.signal?.aborted).toBe(true);
    await act(async () => next.resolve({ ...summary(1), catalogs }));
  });

  it("CRM reinicia la página antes de pedir un filtro nuevo y no muestra filas anteriores", async () => {
    pageApi.mockImplementation(async (_, number) => page(number));
    const { result, rerender } = renderHook(({ path }) => useCrmList<number>(path), { initialProps: { path: "/bff/comercial/contratos?estado=VIGENTE" } });
    await waitFor(() => expect(result.current.items).toEqual([1]));
    act(() => result.current.setPage(3));
    await waitFor(() => expect(result.current.items).toEqual([3]));
    const next = deferred<ReturnType<typeof page>>();
    pageApi.mockImplementation(() => next.promise);
    rerender({ path: "/bff/comercial/contratos?estado=BORRADOR" });
    expect(result.current.page).toBe(1);
    expect(result.current.items).toEqual([]);
    expect(pageApi.mock.calls.at(-1)?.[1]).toBe(1);
    await act(async () => next.resolve(page(1)));
    expect(result.current.items).toEqual([1]);
  });
});
