import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invalidateCachedJson } from "@/lib/http/client";
import { ADMIN_QUEUE_CONCURRENCY, loadAdminRounds, replaceLocalidadRounds, summarizeAdminQueue } from "@/features/rail-queue/administrador/data";
import type { Localidad, Ronda } from "@/features/rail-queue/types";

const localidades: Localidad[] = Array.from({ length: 8 }, (_, index) => ({ id: index + 1, nombre: `Patio ${index + 1}` }));
const response = (items: Ronda[]) => new Response(JSON.stringify(items), { headers: { "content-type": "application/json" } });
const ronda = (id: number, localidadId = id): Ronda => ({ id, localidadId, rondaNumero: 1, orden: id, concluido: false });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
beforeEach(() => invalidateCachedJson());
afterEach(() => { invalidateCachedJson(); vi.unstubAllGlobals(); });

describe("administrator queue requests", () => {
  it("only requests the selected patio, without an absent aggregate endpoint", async () => {
    const fetch = vi.fn<(url: string) => Promise<Response>>(async () => response([ronda(42, 2)]));
    vi.stubGlobal("fetch", fetch);
    const result = await loadAdminRounds({ localidades: [localidades[1]], signal: new AbortController().signal });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe("/api/cliente/rondas?localidadId=2");
    expect(result.items[0].localidad).toEqual({ id: 2, nombre: "Patio 2" });
  });

  it("bounds all-patio requests and publishes ready patios before the slowest finishes", async () => {
    const slow = deferred<Response>();
    let inFlight = 0;
    let peak = 0;
    const loaded: number[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const id = Number(new URL(url, "https://test.local").searchParams.get("localidadId"));
      inFlight++;
      peak = Math.max(peak, inFlight);
      const result = id === 1 ? await slow.promise : await Promise.resolve(response([ronda(id)]));
      inFlight--;
      return result;
    }));
    const pending = loadAdminRounds({ localidades, signal: new AbortController().signal, onLocalidadLoaded: (loc) => loaded.push(loc.id) });
    await vi.waitFor(() => expect(loaded).toHaveLength(7));
    expect(loaded).not.toContain(1);
    expect(peak).toBeLessThanOrEqual(ADMIN_QUEUE_CONCURRENCY);
    slow.resolve(response([ronda(1)]));
    expect((await pending).items).toHaveLength(8);
  });

  it("reports a failed patio explicitly and keeps successful data", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url.endsWith("=2") ? new Response("unavailable", { status: 503 }) : response([ronda(1)])));
    const result = await loadAdminRounds({ localidades: localidades.slice(0, 2), signal: new AbortController().signal });
    expect(result.items.map((item) => item.id)).toEqual([1]);
    expect(result.unavailableLocalidades).toEqual([localidades[1]]);
  });

  it("refreshes changed rows immediately rather than reusing the 20-second response cache", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(response([ronda(1)])).mockResolvedValueOnce(response([ronda(9, 1)]));
    vi.stubGlobal("fetch", fetch);
    const args = { localidades: [localidades[0]], signal: new AbortController().signal };
    await loadAdminRounds(args);
    const result = await loadAdminRounds({ ...args, force: true });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result.items[0].id).toBe(9);
  });

  it("stops queued reads on navigation and never publishes an aborted response", async () => {
    const slow = deferred<Response>();
    const ac = new AbortController();
    const publish = vi.fn();
    const fetch = vi.fn(() => slow.promise);
    vi.stubGlobal("fetch", fetch);
    const request = loadAdminRounds({ localidades, signal: ac.signal, onLocalidadLoaded: publish });
    const rejection = expect(request).rejects.toMatchObject({ name: "AbortError" });
    ac.abort();
    await rejection;
    slow.resolve(response([ronda(1)]));
    await Promise.resolve();
    expect(publish).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(ADMIN_QUEUE_CONCURRENCY);
  });

  it("keeps other patios while replacing a completed locality, including an empty queue", () => {
    const previous = [ronda(1), ronda(2), ronda(3, 1)];
    expect(replaceLocalidadRounds(previous, 1, []).map((item) => item.id)).toEqual([2]);
    expect(previous).toHaveLength(3);
  });

  it("derives attention counts only from supplied round data", () => {
    expect(summarizeAdminQueue([
      { ...ronda(1), movimiento: { estado: "DETENIDO", prioridad: "ALTA" } },
      { ...ronda(2, 1), movimiento: { estado: "SOLICITADO", prioridad: "BAJA" } },
      ronda(3, 2),
    ])).toEqual({ total: 3, activeLocalidades: 2, highPriority: 1, stopped: 1 });
  });
});
