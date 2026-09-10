// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cachedFetchJson } from "@/lib/http/client";
import { useReportBase } from "@/features/reporteria/administrador/hooks/useReportBase";
import { useReporteriaCoor } from "@/features/reporteria/coordinador/hooks/useReporteriaCoor";
import { useEmpresaLocomotorasReport } from "@/features/reporteria/coordinador/reports/empresa-locomotoras/useEmpresaLocomotorasReport";

vi.mock("@/lib/http/client", () => ({ cachedFetchJson: vi.fn() }));
vi.mock("@/lib/cookies", () => ({ getEmpresaIdClient: () => 9 }));
const api = vi.mocked(cachedFetchJson);
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { resolve, promise };
}
const reportCalls = () => api.mock.calls.filter(([url]) => url.includes("/reporteria/"));

beforeEach(() => {
  api.mockReset();
  api.mockImplementation(async url => url.includes("/empresas/") ? [{ id: 9, nombre: "Alstom" }] : url.includes("/localidades/") ? [{ id: 2, nombre: "Patio asignado" }, { id: 4, nombre: "Otro patio" }] : { kpis: { totalMovimientos: 8 } });
});
afterEach(cleanup);

describe("reportes por rol", () => {
  it("coordinador consulta una sola vez el BFF con su localidad desde el inicio", async () => {
    const { result } = renderHook(() => useReporteriaCoor(2));
    await waitFor(() => expect(result.current.totalMov).toBe(8));
    expect(reportCalls()).toHaveLength(1);
    const [url, , cache] = reportCalls()[0];
    expect(url.startsWith("/bff/reporteria/coordinador?")).toBe(true);
    expect(new URL(url, "http://test").searchParams.get("localidadId")).toBe("2");
    expect(cache).toMatchObject({ force: false, ttlMs: 20_000 });
    expect(result.current.lockLocalidad).toBe(true);
    expect(result.current.lockEmpresa).toBe(false);
    act(() => result.current.setLocalidadId());
    expect(result.current.localidadId).toBe("2");
    expect(result.current.filteredLocalidades).toEqual([{ id: 2, nombre: "Patio asignado" }]);
  });

  it("oculta el reporte administrativo anterior mientras cambia la empresa", async () => {
    const next = deferred<unknown>();
    const { result } = renderHook(() => useReportBase({ endpoint: "/bff/reporteria/admin", pdfEndpoint: "/pdf" }));
    await waitFor(() => expect(result.current.totalMov).toBe(8));
    api.mockImplementation(async url => url.includes("/reporteria/") ? next.promise : []);
    act(() => result.current.setEmpresaId("5"));
    expect(result.current.rawReport).toBeNull();
    expect(result.current.fetchedAt).toBeNull();
    await act(async () => next.resolve({ kpis: { totalMovimientos: 3 } }));
    expect(result.current.totalMov).toBe(3);
  });

  it("cancela y descarta respuestas tardías de otra localidad de coordinador", async () => {
    const old = deferred<unknown>();
    api.mockImplementation(async url => url.includes("localidadId=2") ? old.promise : url.includes("/reporteria/") ? { kpis: { totalMovimientos: 4 } } : []);
    const { result, rerender, unmount } = renderHook(({ locality }) => useReporteriaCoor(locality), { initialProps: { locality: 2 } });
    await waitFor(() => expect(reportCalls()).toHaveLength(1));
    const signal = reportCalls()[0][1]?.signal;
    rerender({ locality: 4 });
    await waitFor(() => expect(result.current.totalMov).toBe(4));
    expect(signal?.aborted).toBe(true);
    await act(async () => old.resolve({ kpis: { totalMovimientos: 99 } }));
    expect(result.current.totalMov).toBe(4);
    unmount();
  });

  it("reutiliza catálogo y caché al navegar, pero Actualizar solicita datos nuevos", async () => {
    const { result } = renderHook(() => useReportBase({ endpoint: "/bff/reporteria/admin", pdfEndpoint: "/pdf" }));
    await waitFor(() => expect(result.current.totalMov).toBe(8));
    const catalogCalls = api.mock.calls.filter(([url]) => url.endsWith("/lite"));
    expect(catalogCalls).toHaveLength(2);
    expect(catalogCalls.every(([, init, cache]) => cache?.ttlMs === 300_000 && !!init?.signal)).toBe(true);
    await act(async () => result.current.fetchReport());
    expect(reportCalls().at(-1)?.[2]?.force).toBe(true);
  });

  it("limpia una localidad incompatible en la misma consulta que cambia la empresa", async () => {
    api.mockImplementation(async url => url.includes("/localidades/") ? [{ id: 2, nombre: "Patio", empresaId: 9 }] : url.includes("/empresas/") ? [] : { kpis: { totalMovimientos: 8 } });
    const { result } = renderHook(() => useReportBase({ endpoint: "/bff/reporteria/admin", pdfEndpoint: "/pdf" }));
    await waitFor(() => expect(result.current.localidades).toHaveLength(1));
    act(() => { result.current.setEmpresaId("9"); result.current.setLocalidadId("2"); });
    await waitFor(() => expect(result.current.loading).toBe(false));
    const previousCalls = reportCalls().length;
    act(() => result.current.setEmpresaId("5"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(reportCalls()).toHaveLength(previousCalls + 1);
    const query = new URL(reportCalls().at(-1)![0], "http://test").searchParams;
    expect(query.get("empresaId")).toBe("5");
    expect(query.has("localidadId")).toBe(false);
  });

  it("el concentrado no pierde un cambio de fecha mientras la petición anterior sigue activa", async () => {
    const old = deferred<unknown>();
    let count = 0;
    api.mockImplementation(async url => {
      if (url.includes("/empresas/")) return [{ id: 9, nombre: "Alstom" }];
      count++;
      return count === 1 ? old.promise : { resumen: { totalMovimientos: 6 } };
    });
    const { result, unmount } = renderHook(() => useEmpresaLocomotorasReport(2));
    await waitFor(() => expect(count).toBe(1));
    const oldSignal = reportCalls()[0][1]?.signal;
    act(() => result.current.setMesYM("2025-03"));
    await waitFor(() => expect(result.current.resumen.totalMovimientos).toBe(6));
    expect(oldSignal?.aborted).toBe(true);
    expect(reportCalls().every(([url]) => new URL(url, "http://test").searchParams.get("localidadId") === "2")).toBe(true);
    await act(async () => old.resolve({ resumen: { totalMovimientos: 99 } }));
    expect(result.current.resumen.totalMovimientos).toBe(6);
    unmount();
  });
});
