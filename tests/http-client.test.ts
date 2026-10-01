import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cachedFetchJson, invalidateCachedJson, ClientRequestError } from "@/lib/http/client";
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
const response = (value: unknown) =>
  new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } });
beforeEach(() => invalidateCachedJson());
afterEach(() => {
  invalidateCachedJson();
  vi.unstubAllGlobals();
});
describe("shared HTTP reads", () => {
  it("shares equivalent reads and caches successful results", async () => {
    const pending = deferred<Response>();
    const fetch = vi.fn(() => pending.promise);
    vi.stubGlobal("fetch", fetch);
    const a = cachedFetchJson("/bff/movimientos?b=2&a=1");
    const b = cachedFetchJson("/bff/movimientos?a=1&b=2");
    pending.resolve(response({ total: 3 }));
    expect(await a).toEqual(await b);
    await cachedFetchJson("/bff/movimientos?a=1&b=2");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("does not merge mutations with different bodies", async () => {
    const fetch = vi.fn(async (_url: string, init: RequestInit) => response(init.body));
    vi.stubGlobal("fetch", fetch);
    const values = await Promise.all(
      ["A", "B"].map((body) => cachedFetchJson("/bff/movimientos", { method: "POST", body })),
    );
    expect(values).toEqual(["A", "B"]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("cancels one consumer without canceling another", async () => {
    const pending = deferred<Response>();
    let signal!: AbortSignal;
    vi.stubGlobal(
      "fetch",
      vi.fn((_url, init) => {
        signal = init.signal;
        return pending.promise;
      }),
    );
    const first = new AbortController();
    const a = cachedFetchJson("/shared", { signal: first.signal });
    const b = cachedFetchJson("/shared");
    const rejected = expect(a).rejects.toMatchObject({ name: "AbortError" });
    first.abort();
    await rejected;
    expect(signal.aborted).toBe(false);
    pending.resolve(response(7));
    expect(await b).toBe(7);
  });
  it("aborts the network when its last consumer leaves", async () => {
    const pending = deferred<Response>();
    let signal!: AbortSignal;
    vi.stubGlobal(
      "fetch",
      vi.fn((_url, init) => {
        signal = init.signal;
        return pending.promise;
      }),
    );
    const controller = new AbortController();
    const request = cachedFetchJson("/leave", { signal: controller.signal });
    const rejected = expect(request).rejects.toMatchObject({ name: "AbortError" });
    controller.abort();
    await rejected;
    expect(signal.aborted).toBe(true);
    pending.resolve(response(1));
  });
  it("prevents a late invalidated result from repopulating the cache", async () => {
    const pending = deferred<Response>();
    const fetch = vi
      .fn()
      .mockImplementationOnce(() => pending.promise)
      .mockResolvedValue(response("new"));
    vi.stubGlobal("fetch", fetch);
    const old = cachedFetchJson("/stale");
    invalidateCachedJson("/stale");
    pending.resolve(response("old"));
    await old;
    expect(await cachedFetchJson("/stale")).toBe("new");
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("keeps an unrelated pending read cacheable after targeted invalidation", async () => {
    const pending = deferred<Response>();
    const fetch = vi
      .fn()
      .mockImplementationOnce(() => pending.promise)
      .mockResolvedValue(response("unexpected-refetch"));
    vi.stubGlobal("fetch", fetch);
    const unrelated = cachedFetchJson("/catalogs/localidades");
    invalidateCachedJson("/movimientos");
    pending.resolve(response("localidades"));
    expect(await unrelated).toBe("localidades");
    expect(await cachedFetchJson("/catalogs/localidades")).toBe("localidades");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("keeps distinct authorization headers separate", async () => {
    const fetch = vi.fn(async () => response({ ok: true }));
    vi.stubGlobal("fetch", fetch);
    await cachedFetchJson("/scope", { headers: { authorization: "A" } });
    await cachedFetchJson("/scope", { headers: { authorization: "B" } });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("never caches failures and does not expose a server stack trace", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("private database password", { status: 500 }))
      .mockResolvedValue(response(1));
    vi.stubGlobal("fetch", fetch);
    await expect(cachedFetchJson("/failure")).rejects.toBeInstanceOf(ClientRequestError);
    expect(await cachedFetchJson("/failure")).toBe(1);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("bounds the cache size", async () => {
    const fetch = vi.fn(async () => response(1));
    vi.stubGlobal("fetch", fetch);
    for (let i = 0; i < 151; i++) await cachedFetchJson(`/bounded/${i}`);
    await cachedFetchJson("/bounded/0");
    expect(fetch).toHaveBeenCalledTimes(152);
  });
  it("evicts the least recently used response instead of a recently revisited one", async () => {
    const fetch = vi.fn(async (url: string) => response(url));
    vi.stubGlobal("fetch", fetch);
    for (let i = 0; i < 150; i++) await cachedFetchJson(`/lru/${i}`);
    await cachedFetchJson("/lru/0");
    await cachedFetchJson("/lru/new");
    await cachedFetchJson("/lru/0");
    await cachedFetchJson("/lru/1");
    expect(fetch).toHaveBeenCalledTimes(152);
  });
});
