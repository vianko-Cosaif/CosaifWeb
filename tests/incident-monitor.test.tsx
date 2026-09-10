// @vitest-environment jsdom
import { StrictMode } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useIncidentMonitor } from "@/features/incidentes/useIncidentMonitor";

const { fetcher } = vi.hoisted(() => ({ fetcher: vi.fn() }));
vi.mock("@/hooks/useAuthErrorHandler", () => ({
  useAuthErrorHandler: () => ({ handleFetchRequest: fetcher }),
}));

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { configurable: true, value: state });
  document.dispatchEvent(new Event("visibilitychange"));
}

function response(id?: number) {
  return Response.json({ data: id ? [{ id, estado: "ABIERTO", descripcion: "Prueba", fechaInicio: "2026-09-08T10:00:00Z" }] : [] });
}

beforeEach(() => {
  vi.useFakeTimers();
  setVisibility("visible");
  fetcher.mockImplementation(async () => response());
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("incident monitor request scheduling", () => {
  it("coalesces initial loading, realtime readiness and focus recovery", async () => {
    const { result } = renderHook(() => useIncidentMonitor());
    await act(async () => {});
    expect(fetcher).toHaveBeenCalledTimes(1);
    await act(async () => {
      await result.current.checkIfStale();
      window.dispatchEvent(new Event("focus"));
      setVisibility("visible");
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(fetcher).toHaveBeenCalledTimes(2);
    await act(async () => { await result.current.checkNow(); });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("does no initial or polling work in a hidden tab and refreshes once on return", async () => {
    setVisibility("hidden");
    const { result } = renderHook(() => useIncidentMonitor());
    await act(async () => { await vi.advanceTimersByTimeAsync(180_000); });
    expect(fetcher).not.toHaveBeenCalled();
    await act(async () => {
      setVisibility("visible");
      window.dispatchEvent(new Event("focus"));
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBeNull();
  });

  it("does not reset the polling interval on unrelated rerenders", async () => {
    const { rerender } = renderHook(() => useIncidentMonitor({ intervalMs: 60_000 }));
    await act(async () => {});
    await act(async () => { await vi.advanceTimersByTimeAsync(45_000); });
    rerender();
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("cancels a hidden request without reporting a timeout or accepting stale data", async () => {
    let finish!: (value: Response) => void;
    fetcher.mockImplementationOnce(() => new Promise<Response>((resolve) => { finish = resolve; }));
    const { result } = renderHook(() => useIncidentMonitor());
    const signal = fetcher.mock.calls[0][1].signal as AbortSignal;
    act(() => { setVisibility("hidden"); });
    expect(signal.aborted).toBe(true);
    await act(async () => { finish(response(99)); });
    expect(result.current.activeIncidents).toEqual([]);
    expect(result.current.error).toBeNull();
    await act(async () => { setVisibility("visible"); });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("cancels old scopes and ignores late results after changing locality", async () => {
    let finish!: (value: Response) => void;
    fetcher.mockImplementationOnce(() => new Promise<Response>((resolve) => { finish = resolve; }));
    fetcher.mockImplementationOnce(async () => response(2));
    const { result, rerender } = renderHook(({ localidadId }) => useIncidentMonitor({ localidadId }), { initialProps: { localidadId: 1 } });
    const oldSignal = fetcher.mock.calls[0][1].signal as AbortSignal;
    rerender({ localidadId: 2 });
    await act(async () => {});
    expect(oldSignal.aborted).toBe(true);
    expect(fetcher.mock.calls[1][0]).toContain("localidadId=2");
    await act(async () => { finish(response(1)); });
    expect(result.current.activeIncidents.map((incident) => incident.id)).toEqual([2]);
  });

  it("emits an incident callback once under Strict Mode and preserves real HTTP failures", async () => {
    fetcher.mockImplementation(async () => response(7));
    const onIncidentDetected = vi.fn();
    const { result } = renderHook(() => useIncidentMonitor({ onIncidentDetected }), { wrapper: StrictMode });
    await act(async () => {});
    expect(onIncidentDetected).toHaveBeenCalledTimes(1);
    fetcher.mockImplementationOnce(async () => Response.json({}, { status: 503 }));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    await act(async () => { await result.current.checkNow(); });
    expect(result.current.error).toContain("503");
    expect(result.current.activeIncidents.map((incident) => incident.id)).toEqual([7]);
    expect(consoleError).toHaveBeenCalled();
  });
});
