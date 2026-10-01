// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMovimientos, type UseMovimientosOptions } from "@/features/movimientos/list/useMovimientos";
import type { RealtimeMovementEvent } from "@/features/movimientos/useRealtimeMovimientos";
import { loginProfile } from "./fixtures/authorization";

const mocks = vi.hoisted(() => ({
  cachedFetchJson: vi.fn(),
  realtime: vi.fn<(options: { enabled: boolean; onEvent: (event: RealtimeMovementEvent) => void }) => string>(),
}));
vi.mock("@/lib/http/client", () => ({ cachedFetchJson: mocks.cachedFetchJson }));
vi.mock("@/features/movimientos/useRealtimeMovimientos", () => ({ useRealtimeMovimientos: mocks.realtime }));

const originalVisibility = Object.getOwnPropertyDescriptor(document, "visibilityState");
let visibility: DocumentVisibilityState = "visible";
const movement = (id: number, estado = "SOLICITADO", empresaId = 3, localidadId = 1) => ({
  id, estado, empresaId, localidadId, locomotiveNumber: id, empresa: { id: empresaId, nombre: `Empresa ${empresaId}` },
  localidad: { id: localidadId, nombre: `Patio ${localidadId}` }, finalizado: estado === "CONCLUIDO",
});
const round = (id: number, estado = "SOLICITADO", empresaId = 3, localidadId = 1) => ({
  id: id + 1000, localidadId, empresa: { id: empresaId, nombre: `Empresa ${empresaId}` },
  concluido: false, movimiento: movement(id, estado, empresaId, localidadId),
});
const page = (data: ReturnType<typeof movement>[], total = data.length) => ({ data, meta: { total } });
const urlParts = (url: string) => new URL(url, "https://test.local");
const collectionCalls = () => mocks.cachedFetchJson.mock.calls.filter(([url]) => !String(url).endsWith("/lite"));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
function serveCollections(read: (url: string, options: RequestInit) => Promise<unknown>) {
  mocks.cachedFetchJson.mockImplementation((url: string, options: RequestInit) => {
    if (url.endsWith("/lite")) return Promise.resolve([]);
    return read(url, options);
  });
}
function renderClient(overrides: Partial<UseMovimientosOptions> = {}) {
  const options: UseMovimientosOptions = {
    rol: "CLIENTE", apiBase: "/bff", authorization: loginProfile("CLIENTE"),
    initialEmpresaId: 3, initialLocalidadId: 1, autoRefreshMs: 10_000,
    ...overrides,
  };
  return renderHook(() => useMovimientos(options));
}

beforeEach(() => {
  mocks.cachedFetchJson.mockReset();
  mocks.realtime.mockReset().mockReturnValue("connected");
  visibility = "visible";
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibility });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  if (originalVisibility) Object.defineProperty(document, "visibilityState", originalVisibility);
  else Reflect.deleteProperty(document, "visibilityState");
});

describe("movement query lifecycle", () => {
  it("loads all companies in the client's assigned current queue, including stopped and scheduled rounds", async () => {
    serveCollections(async () => [
      round(10), round(20, "EN_PROCESO", 4), round(30, "SOLICITADO", 3, 2),
      { ...round(40), concluido: true }, round(50, "CONCLUIDO"),
      round(60, "DETENIDO", 4), round(70, "AGENDADO", 4),
    ]);
    const { result } = renderClient();
    await waitFor(() => expect(result.current.cargando).toBe(false));
    const request = urlParts(String(collectionCalls()[0][0]));
    expect(request.pathname).toBe("/api/cliente/rondas");
    expect(request.searchParams.get("alcance")).toBe("localidad");
    expect(request.searchParams.get("localidadId")).toBe("1");
    expect(request.searchParams.has("empresaId")).toBe(false);
    expect(result.current.filas.map(row => row.id)).toEqual([70, 60, 20, 10]);
    expect(result.current.total).toBe(4);
    expect(result.current.totalEstimado).toBe(false);
    expect(result.current.filterPolicy.canEditEmpresa).toBe(true);
  });

  it("switches history to server search with the client's company and locality enforced", async () => {
    serveCollections(async url => url.startsWith("/api/cliente/rondas") ? [round(10, "SOLICITADO", 4)] : page([movement(90, "CONCLUIDO")]));
    const { result } = renderClient();
    await waitFor(() => expect(result.current.cargando).toBe(false));
    act(() => result.current.setAmbito("pasados"));
    await waitFor(() => expect(result.current.filas.map(row => row.id)).toEqual([90]));
    const request = urlParts(String(collectionCalls().at(-1)![0]));
    expect(request.pathname).toBe("/bff/movimientos/buscar");
    expect(request.searchParams.get("ambito")).toBe("pasados");
    expect(request.searchParams.get("empresaId")).toBe("3");
    expect(request.searchParams.get("localidadId")).toBe("1");
    expect(request.searchParams.has("alcance")).toBe(false);
    act(() => result.current.setFiltros(prev => ({ ...prev, empresaId: 999, localidadId: 999 })));
    expect(result.current.filtros.empresaId).toBe(3);
    expect(result.current.filtros.localidadId).toBe(1);
    expect(collectionCalls()).toHaveLength(2);
  });

  it("does not let a late current-queue response replace the selected history", async () => {
    const current = deferred<unknown>();
    const history = deferred<unknown>();
    serveCollections(url => url.startsWith("/api/cliente/rondas") ? current.promise : history.promise);
    const { result } = renderClient();
    act(() => result.current.setAmbito("pasados"));
    expect(result.current.filas).toEqual([]);
    expect(result.current.cargando).toBe(true);
    expect((collectionCalls()[0][1] as RequestInit).signal?.aborted).toBe(true);
    await act(async () => { history.resolve(page([movement(90, "CONCLUIDO")])); });
    expect(result.current.filas.map(row => row.id)).toEqual([90]);
    await act(async () => { current.resolve([round(10)]); });
    expect(result.current.ambito).toBe("pasados");
    expect(result.current.filas.map(row => row.id)).toEqual([90]);
    expect(result.current.error).toBeNull();
  });

  it("retains data from the same query and exposes refresh failures", async () => {
    const read = vi.fn().mockResolvedValueOnce([round(10)]).mockRejectedValueOnce(new Error("Servicio temporalmente no disponible"));
    serveCollections(read);
    const { result } = renderClient();
    await waitFor(() => expect(result.current.filas).toHaveLength(1));
    act(() => result.current.recargar());
    await waitFor(() => expect(result.current.error).toBe("Servicio temporalmente no disponible"));
    expect(result.current.cargando).toBe(false);
    expect(result.current.filas.map(row => row.id)).toEqual([10]);
    expect(result.current.total).toBe(1);
  });

  it("reports an initial request failure instead of treating it as a successful empty collection", async () => {
    serveCollections(async () => { throw new Error("No se pudo consultar la fila"); });
    const { result } = renderClient();
    await waitFor(() => expect(result.current.cargando).toBe(false));
    expect(result.current.error).toBe("No se pudo consultar la fila");
    expect(result.current.filas).toEqual([]);
  });

  it("keeps an exact total of 50 on a full last page without inventing another page", async () => {
    serveCollections(async url => {
      if (url.startsWith("/api/cliente/rondas")) return [];
      const currentPage = Number(urlParts(url).searchParams.get("page"));
      return page(Array.from({ length: 25 }, (_, index) => movement((currentPage - 1) * 25 + index + 1, "CONCLUIDO")), 50);
    });
    const { result } = renderClient();
    await waitFor(() => expect(result.current.cargando).toBe(false));
    act(() => result.current.setAmbito("pasados"));
    await waitFor(() => expect(result.current.total).toBe(50));
    act(() => result.current.setFiltros(prev => ({ ...prev, pagina: 2 })));
    await waitFor(() => expect(result.current.cargando).toBe(false));
    expect(result.current.filas).toHaveLength(25);
    expect(result.current.filas[0].id).toBe(26);
    expect(result.current.total).toBe(50);
    expect(result.current.totalEstimado).toBe(false);
    expect(Math.ceil(result.current.total / result.current.filtros.tamPagina)).toBe(2);
    expect(collectionCalls()).toHaveLength(3);
  });

  it("groups forced refreshes during a pending read into one subsequent fresh request", async () => {
    const response = deferred<unknown>();
    const read = vi.fn().mockReturnValueOnce(response.promise).mockResolvedValueOnce([round(20)]);
    serveCollections(read);
    const { result } = renderClient();
    act(() => { result.current.recargar(); result.current.recargar(); result.current.recargar(); });
    expect(collectionCalls()).toHaveLength(1);
    await act(async () => { response.resolve([round(10)]); });
    await waitFor(() => expect(result.current.filas.map(row => row.id)).toEqual([20]));
    expect(result.current.cargando).toBe(false);
    expect(collectionCalls()).toHaveLength(2);
    expect(collectionCalls()[1][2]).toMatchObject({ force: true });
  });

  it.each(["paused", "hidden"] as const)("cancels an already queued movement refresh when %s before its timer runs", async mode => {
    vi.useFakeTimers();
    serveCollections(async () => [round(10)]);
    const { result } = renderClient();
    await act(async () => {});
    act(() => mocks.realtime.mock.lastCall?.[0].onEvent({ type: "movimiento.estado", localidadId: 1, eventId: "queued" }));
    if (mode === "paused") act(() => result.current.setAutoEnabled(false));
    else act(() => { visibility = "hidden"; document.dispatchEvent(new Event("visibilitychange")); });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(collectionCalls()).toHaveLength(1);
    expect(result.current.filas.map(row => row.id)).toEqual([10]);
  });

  it("upgrades a scheduled ready refresh to forced when an actual movement changes before the timer", async () => {
    vi.useFakeTimers();
    serveCollections(async () => [round(10)]);
    renderClient();
    await act(async () => {});
    act(() => mocks.realtime.mock.lastCall?.[0].onEvent({ type: "realtime.ready" }));
    act(() => mocks.realtime.mock.lastCall?.[0].onEvent({ type: "movimiento.estado", localidadId: 1, eventId: "changed" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(collectionCalls()).toHaveLength(2);
    expect(collectionCalls()[1][2]).toMatchObject({ force: true });
  });

  it("discards a pending forced refresh of current movements after selecting history", async () => {
    const current = deferred<unknown>();
    serveCollections(url => url.startsWith("/api/cliente/rondas") ? current.promise : Promise.resolve(page([movement(90, "CONCLUIDO")])));
    const { result } = renderClient();
    act(() => result.current.recargar());
    act(() => result.current.setAmbito("pasados"));
    await waitFor(() => expect(result.current.filas.map(row => row.id)).toEqual([90]));
    await act(async () => { current.resolve([round(10)]); });
    expect(collectionCalls()).toHaveLength(2);
    expect(result.current.ambito).toBe("pasados");
    expect(result.current.filas.map(row => row.id)).toEqual([90]);
  });

  it("pauses polling while hidden or auto-refresh is off and preserves manual refresh", async () => {
    vi.useFakeTimers();
    serveCollections(async () => [round(10)]);
    const { result } = renderClient();
    await act(async () => {});
    expect(collectionCalls()).toHaveLength(1);
    visibility = "hidden";
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      vi.advanceTimersByTime(120_000);
      mocks.realtime.mock.lastCall?.[0].onEvent({ type: "movimiento.creado", localidadId: 1 });
      vi.advanceTimersByTime(300);
    });
    expect(collectionCalls()).toHaveLength(1);
    visibility = "visible";
    await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(collectionCalls()).toHaveLength(2);
    act(() => result.current.setAutoEnabled(false));
    expect(mocks.realtime.mock.lastCall?.[0].enabled).toBe(false);
    await act(async () => {
      mocks.realtime.mock.lastCall?.[0].onEvent({ type: "movimiento.creado", localidadId: 1 });
      document.dispatchEvent(new Event("visibilitychange"));
      vi.advanceTimersByTime(120_000);
    });
    expect(collectionCalls()).toHaveLength(2);
    await act(async () => { result.current.recargar(); });
    expect(collectionCalls()).toHaveLength(3);
  });

  it("resets to page one atomically when search filters change", async () => {
    serveCollections(async url => url.startsWith("/api/cliente/rondas") ? [] : page([movement(90, "CONCLUIDO")], 100));
    const { result } = renderClient();
    await waitFor(() => expect(result.current.cargando).toBe(false));
    act(() => result.current.setAmbito("pasados"));
    await waitFor(() => expect(result.current.total).toBe(100));
    act(() => result.current.setFiltros(prev => ({ ...prev, pagina: 3 })));
    await waitFor(() => expect(result.current.cargando).toBe(false));
    expect(result.current.filtros.pagina).toBe(3);
    mocks.cachedFetchJson.mockClear();
    act(() => result.current.setFiltros(prev => ({ ...prev, busqueda: "locomotora" })));
    await waitFor(() => expect(result.current.cargando).toBe(false));
    expect(result.current.filtros.pagina).toBe(1);
    expect(collectionCalls()).toHaveLength(1);
    const request = urlParts(String(collectionCalls()[0][0]));
    expect(request.searchParams.get("q")).toBe("locomotora");
    expect(request.searchParams.get("page")).toBe("1");
  });
});
