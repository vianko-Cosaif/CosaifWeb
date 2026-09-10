// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invalidateCachedJson } from "@/lib/http/client";
import { useClientQueueData } from "@/features/rail-queue/cliente/useClientQueueData";
import type { ClientQueueSelection } from "@/features/rail-queue/cliente/queueData";

function Fixture(props: Partial<ClientQueueSelection> & { onChanged?: () => void }) {
  const queue = useClientQueueData({ localidadId: 1, empresaId: 8, entity: "movimientos", ...props });
  return <><output data-testid="items">{queue.items.map((item) => item.id).join(",")}</output><output data-testid="loading">{String(queue.loading)}</output>{queue.error && <p role="alert">{queue.error}</p>}<button onClick={() => queue.load(true)}>Actualizar</button></>;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } });
const row = (id: number, estado = "SOLICITADO") => ({ id, localidadId: 1, empresa: { id: 8, nombre: "Empresa" }, rondaNumero: 1, orden: id, concluido: false, movimiento: { id, estado } });
beforeEach(() => invalidateCachedJson());
afterEach(() => { cleanup(); invalidateCachedJson(); vi.unstubAllGlobals(); });

describe("client queue requests on filter changes", () => {
  it("does not show a previous entity's response after filters change", async () => {
    const old = deferred<Response>();
    const fresh = deferred<Response>();
    vi.stubGlobal("fetch", vi.fn((url: string) => url.includes("entity=torneados") ? fresh.promise : old.promise));
    const view = render(<Fixture />);
    view.rerender(<Fixture entity="torneados" />);
    expect(screen.getByTestId("items").textContent).toBe("");
    fresh.resolve(json([row(20)]));
    await waitFor(() => expect(screen.getByTestId("items").textContent).toBe("20"));
    await act(async () => old.resolve(json([row(10)])));
    expect(screen.getByTestId("items").textContent).toBe("20");
  });

  it("clears rows immediately when changing locality, including while the new request is pending", async () => {
    const next = deferred<Response>();
    vi.stubGlobal("fetch", vi.fn((url: string) => url.includes("localidadId=2") ? next.promise : Promise.resolve(json([row(10)]))));
    const view = render(<Fixture />);
    await waitFor(() => expect(screen.getByTestId("items").textContent).toBe("10"));
    view.rerender(<Fixture localidadId={2} />);
    expect(screen.getByTestId("items").textContent).toBe("");
    expect(screen.getByTestId("loading").textContent).toBe("true");
    next.resolve(json([{ ...row(20), localidadId: 2 }]));
    await waitFor(() => expect(screen.getByTestId("items").textContent).toBe("20"));
  });

  it("removes a completed movement after an explicit refresh without waiting for cache expiry", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(json([row(10)])).mockResolvedValueOnce(json([row(10, "CONCLUIDO")]));
    vi.stubGlobal("fetch", fetch);
    render(<Fixture />);
    await waitFor(() => expect(screen.getByTestId("items").textContent).toBe("10"));
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(screen.getByTestId("items").textContent).toBe(""));
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("keeps the last data from the same selection visible on refresh errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json([row(10)])).mockResolvedValueOnce(new Response("Unavailable", { status: 503 })));
    render(<Fixture />);
    await waitFor(() => expect(screen.getByTestId("items").textContent).toBe("10"));
    fireEvent.click(screen.getByRole("button"));
    await screen.findByRole("alert");
    expect(screen.getByTestId("items").textContent).toBe("10");
  });

  it("aborts pending reads and does not notify after navigation away", async () => {
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

  it("coalesces refresh events during a pending read into one subsequent request", async () => {
    const pending = deferred<Response>();
    const fetch = vi.fn().mockImplementationOnce(() => pending.promise).mockResolvedValue(json([row(20)]));
    vi.stubGlobal("fetch", fetch);
    render(<Fixture />);
    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(screen.getByRole("button"));
    expect(fetch).toHaveBeenCalledTimes(1);
    pending.resolve(json([row(10)]));
    await waitFor(() => expect(screen.getByTestId("items").textContent).toBe("20"));
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
