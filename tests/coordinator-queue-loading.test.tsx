// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invalidateCachedJson } from "@/lib/http/client";
import { useCoordinatorQueueData } from "@/features/rail-queue/coordinador/useCoordinatorQueueData";

function Fixture(props: { localidadId?: number; onChanged?: () => void; autoRefresh?: boolean }) {
  const queue = useCoordinatorQueueData({ localidadId: 1, ...props });
  return <><output data-testid="items">{queue.items.map((item) => item.id).join(",")}</output><output data-testid="loading">{String(queue.loading)}</output>{queue.error && <p role="alert">{queue.error}</p>}<button onClick={() => queue.load(true)}>Actualizar</button><button onClick={() => queue.load(false)}>Conectado</button></>;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } });
const row = (id: number, localidadId = 1) => ({ id, localidadId, rondaNumero: 1, orden: id, concluido: false, movimiento: { id, estado: "SOLICITADO" } });
function visibility(value: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { configurable: true, value });
  document.dispatchEvent(new Event("visibilitychange"));
}
beforeEach(() => { invalidateCachedJson(); visibility("visible"); });
afterEach(() => { cleanup(); invalidateCachedJson(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("coordinator queue request lifecycle", () => {
  it("joins connection readiness to the initial request and groups movement updates into one subsequent read", async () => {
    const pending = deferred<Response>();
    const fetch = vi.fn().mockImplementationOnce(() => pending.promise).mockResolvedValue(json([row(20)]));
    vi.stubGlobal("fetch", fetch);
    render(<Fixture />);
    fireEvent.click(screen.getByRole("button", { name: "Conectado" }));
    fireEvent.click(screen.getByRole("button", { name: "Actualizar" }));
    fireEvent.click(screen.getByRole("button", { name: "Actualizar" }));
    expect(fetch).toHaveBeenCalledTimes(1);
    pending.resolve(json([row(10)]));
    await waitFor(() => expect(screen.getByTestId("items").textContent).toBe("20"));
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("does not request the same fresh data again when realtime connects", async () => {
    const fetch = vi.fn().mockResolvedValue(json([row(10)]));
    vi.stubGlobal("fetch", fetch);
    render(<Fixture />);
    await waitFor(() => expect(screen.getByTestId("items").textContent).toBe("10"));
    fireEvent.click(screen.getByRole("button", { name: "Conectado" }));
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("clears the former locality immediately and rejects stale responses and notifications", async () => {
    const old = deferred<Response>();
    const fresh = deferred<Response>();
    const notify = vi.fn();
    vi.stubGlobal("fetch", vi.fn((url: string) => url.includes("localidadId=2") ? fresh.promise : old.promise));
    const view = render(<Fixture onChanged={notify} />);
    view.rerender(<Fixture localidadId={2} onChanged={notify} />);
    expect(screen.getByTestId("items").textContent).toBe("");
    fresh.resolve(json([row(20, 2), row(99, 1)]));
    await waitFor(() => expect(screen.getByTestId("items").textContent).toBe("20"));
    await act(async () => old.resolve(json([row(10)])));
    expect(screen.getByTestId("items").textContent).toBe("20");
    expect(notify).not.toHaveBeenCalled();
  });

  it("keeps the last successful queue visible when refresh fails and recovers on retry", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json([row(10)])).mockResolvedValueOnce(new Response("Unavailable", { status: 503 })).mockResolvedValueOnce(json([row(30)])));
    render(<Fixture />);
    await waitFor(() => expect(screen.getByTestId("items").textContent).toBe("10"));
    fireEvent.click(screen.getByRole("button", { name: "Actualizar" }));
    await screen.findByRole("alert");
    expect(screen.getByTestId("items").textContent).toBe("10");
    fireEvent.click(screen.getByRole("button", { name: "Actualizar" }));
    await waitFor(() => expect(screen.getByTestId("items").textContent).toBe("30"));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("aborts pending reads on navigation and never notifies after unmount", async () => {
    const pending = deferred<Response>();
    let signal: AbortSignal | null = null;
    const notify = vi.fn();
    vi.stubGlobal("fetch", vi.fn((_url: string, init: RequestInit) => { signal = init.signal as AbortSignal; return pending.promise; }));
    const view = render(<Fixture onChanged={notify} />);
    view.unmount();
    expect(signal).toHaveProperty("aborted", true);
    await act(async () => pending.resolve(json([row(10)])));
    expect(notify).not.toHaveBeenCalled();
  });

  it("waits while hidden and coalesces missed changes into a single refresh on return", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(json([row(10)])).mockResolvedValueOnce(json([row(20)]));
    vi.stubGlobal("fetch", fetch);
    render(<Fixture />);
    await waitFor(() => expect(screen.getByTestId("items").textContent).toBe("10"));
    act(() => visibility("hidden"));
    fireEvent.click(screen.getByRole("button", { name: "Actualizar" }));
    fireEvent.click(screen.getByRole("button", { name: "Actualizar" }));
    expect(fetch).toHaveBeenCalledTimes(1);
    act(() => visibility("visible"));
    await waitFor(() => expect(screen.getByTestId("items").textContent).toBe("20"));
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("does not revalidate on window return while automatic updates are paused", async () => {
    const fetch = vi.fn().mockResolvedValue(json([row(10)]));
    vi.stubGlobal("fetch", fetch);
    render(<Fixture autoRefresh={false} />);
    await waitFor(() => expect(screen.getByTestId("items").textContent).toBe("10"));
    invalidateCachedJson();
    act(() => visibility("hidden"));
    act(() => visibility("visible"));
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
