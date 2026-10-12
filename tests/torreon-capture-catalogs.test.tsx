// @vitest-environment jsdom
import { useEffect } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useCrearMovimientoCatalogos } from "@/features/movimientos/crear/useCrearMovimientoCatalogos";

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@/lib/http/client", () => ({ cachedFetchJson: mocks.fetch }));
const sections = [{ id: 82, numero: 2, nombre: "Dos" }, { id: 81, numero: 1, nombre: "Uno" }];
const sectionCalls = () => mocks.fetch.mock.calls.filter(([url]) => String(url).includes("/via/8"));
function useSelectedTrack(localidadId: number) {
  const catalogs = useCrearMovimientoCatalogos(localidadId);
  const { ensureSections } = catalogs;
  useEffect(() => { void ensureSections(8); }, [ensureSections]);
  return catalogs;
}
afterEach(cleanup);
beforeEach(() => {
  mocks.fetch.mockReset();
  vi.stubEnv("NEXT_PUBLIC_TORREON_LOCALIDAD_IDS", "2");
  mocks.fetch.mockResolvedValue([]);
});
afterEach(() => vi.unstubAllEnvs());

it("keeps failed Torreón sections unknown and retries only on request", async () => {
  let reject!: (reason: Error) => void;
  const pending = new Promise((_, fail) => { reject = fail; });
  let attempts = 0;
  mocks.fetch.mockImplementation((url: string) => {
    if (!url.includes("/via/8")) return Promise.resolve([]);
    return ++attempts === 1 ? pending : Promise.resolve(sections);
  });
  const { result, rerender } = renderHook(() => useSelectedTrack(2));
  await waitFor(() => expect(result.current.secLoading[8]).toBe(true));
  expect(result.current.sectionsByVia[8]).toBeUndefined();
  const ensure = result.current.ensureSections;
  await act(async () => { reject(new Error("offline")); });
  await waitFor(() => expect(result.current.secErrors[8]).toMatch(/Vuelve a intentarlo/));
  expect(result.current.sectionsByVia[8]).toBeUndefined();
  expect(result.current.secLoading[8]).toBe(false);
  expect(result.current.ensureSections).toBe(ensure);
  rerender();
  expect(sectionCalls()).toHaveLength(1);
  await act(async () => { await result.current.ensureSections(8); });
  expect(sectionCalls()).toHaveLength(2);
  expect(result.current.sectionsByVia[8].map(row => row.id)).toEqual([81, 82]);
  expect(result.current.secErrors[8]).toBeUndefined();
  expect(result.current.secLoading[8]).toBe(false);
  await act(async () => { await result.current.ensureSections(8); });
  expect(sectionCalls()).toHaveLength(2);
});

it("keeps Guadalajara's existing empty-section failure cache", async () => {
  mocks.fetch.mockImplementation((url: string) => url.includes("/via/8")
    ? Promise.reject(new Error("offline")) : Promise.resolve([]));
  const { result } = renderHook(() => useSelectedTrack(1));
  await waitFor(() => expect(result.current.sectionsByVia[8]).toEqual([]));
  expect(result.current.secErrors).toEqual({});
  expect(result.current.secLoading[8]).toBe(false);
  await act(async () => { await result.current.ensureSections(8); });
  expect(sectionCalls()).toHaveLength(1);
});

it("exposes a retryable track failure and replaces it with the loaded Torreón catalog", async () => {
  mocks.fetch.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce([{ id: 8, nombre: "Vía 8" }]);
  const { result } = renderHook(() => useCrearMovimientoCatalogos(2));
  await waitFor(() => expect(result.current.viasError).toMatch(/No se pudieron cargar/));
  expect(result.current.viasLoading).toBe(false);
  await act(async () => { await result.current.reloadVias(); });
  expect(result.current.viasError).toBeNull();
  expect(result.current.vias).toEqual([{ id: 8, nombre: "Vía 8" }]);
  expect(mocks.fetch.mock.calls[1][2].force).toBe(true);
});
