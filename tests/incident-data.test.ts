import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  detailCache,
  fetchIncidenteDetailsBulk,
  IncidentDetailCache,
  incidentCacheKey,
  incidentRows,
  parseIncidentPage,
} from "@/features/incidentes/operacion/incidentData";

const state = vi.hoisted(() => ({ read: vi.fn(), scope: "company-a" }));
vi.mock("@/lib/http/client", () => ({ cachedFetchJson: state.read }));
vi.mock("@/lib/auth/storageScope", () => ({ currentStorageScope: () => state.scope }));
const incident = (id: number) => ({ id, estado: "ABIERTO" });
beforeEach(() => {
  state.read.mockReset();
  state.scope = "company-a";
  detailCache.clear();
});
afterEach(() => vi.useRealTimers());

describe("incident data loading", () => {
  it("starts another detail as soon as a worker is free, even if the first read is slow", async () => {
    let release!: (value: unknown) => void;
    state.read.mockImplementation((url: string) =>
      url.endsWith("/1")
        ? new Promise((resolve) => {
            release = resolve;
          })
        : Promise.resolve({ data: { id: Number(url.split("/").at(-1)) } }),
    );
    const result = fetchIncidenteDetailsBulk(
      [1, 2, 3, 4, 5].map(incident),
      new AbortController().signal,
      2,
    );
    await vi.waitFor(() => expect(state.read).toHaveBeenCalledTimes(5));
    release({ data: { id: 1 } });
    expect(Object.keys(await result)).toHaveLength(5);
  });

  it("never starts more than the configured concurrency and stops scheduling on abort", async () => {
    const controller = new AbortController();
    const releases: ((value: unknown) => void)[] = [];
    state.read.mockImplementation(() => new Promise((resolve) => releases.push(resolve)));
    const result = fetchIncidenteDetailsBulk([1, 2, 3, 4, 5].map(incident), controller.signal, 2);
    expect(state.read).toHaveBeenCalledTimes(2);
    controller.abort();
    releases.forEach((resolve) => resolve({ data: { id: 1 } }));
    expect(await result).toEqual({});
    expect(state.read).toHaveBeenCalledTimes(2);
  });

  it("deduplicates reads and skips records already complete for display", async () => {
    state.read.mockResolvedValue({ data: { id: 1 } });
    const complete = {
      ...incident(2),
      movimiento: {
        empresa: { nombre: "A" },
        viaOrigen: { nombre: "1" },
        viaDestino: { nombre: "2" },
      },
    };
    await fetchIncidenteDetailsBulk(
      [incident(1), incident(1), complete, { ...incident(3), _source: "torreon" }],
      new AbortController().signal,
    );
    expect(state.read).toHaveBeenCalledTimes(1);
    await fetchIncidenteDetailsBulk([incident(1)], new AbortController().signal);
    expect(state.read).toHaveBeenCalledTimes(1);
  });

  it("discards a delayed result when the account changes", async () => {
    let release!: (value: unknown) => void;
    state.read.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    const result = fetchIncidenteDetailsBulk([incident(1)], new AbortController().signal);
    state.scope = "company-b";
    release({ data: { id: 1 } });
    expect(await result).toEqual({});
    expect(detailCache.get(incidentCacheKey(incident(1), "company-a"))).toBeNull();
    expect(detailCache.get(incidentCacheKey(incident(1), "company-b"))).toBeNull();
  });

  it("keeps the list usable when optional details fail or have invalid contracts", async () => {
    state.read
      .mockRejectedValueOnce(new Error("Timeout"))
      .mockResolvedValueOnce({ data: { movimiento: [] } });
    expect(
      await fetchIncidenteDetailsBulk([incident(1), incident(2)], new AbortController().signal),
    ).toEqual({});
  });

  it("rejects malformed pages and maps rows without changing shared responses", () => {
    expect(() => parseIncidentPage({ success: true, data: [{}] })).toThrow("Formato de respuesta");
    const data = Object.freeze([Object.freeze(incident(1))]);
    const page = Object.freeze({ success: true, data });
    const parsed = parseIncidentPage(page);
    expect(incidentRows(parsed.data, {})).toEqual([
      expect.objectContaining({ id: 1, estatus: "Activo" }),
    ]);
    expect(page.data).toBe(data);
    expect(parsed.data).not.toBe(data);
  });
});

describe("bounded incident cache", () => {
  it("expires entries and evicts the least recently used without extending freshness on reads", () => {
    vi.useFakeTimers();
    const cache = new IncidentDetailCache(2, 1_000);
    cache.set("a", { id: 1 });
    cache.set("b", { id: 2 });
    expect(cache.get("a")).toEqual({ id: 1 });
    cache.set("c", { id: 3 });
    expect(cache.get("b")).toBeNull();
    vi.advanceTimersByTime(1_000);
    expect(cache.get("a")).toBeNull();
  });
  it("separates accounts, sources, localities and Torreón incident kinds", () => {
    const base = { id: 1, _source: "torreon", _torreonTipo: "NATURAL", localidadId: 1 };
    expect(
      new Set([
        incidentCacheKey(base, "a"),
        incidentCacheKey(base, "b"),
        incidentCacheKey({ ...base, localidadId: 2 }, "a"),
        incidentCacheKey({ ...base, _torreonTipo: "ARRASTRE" }, "a"),
        incidentCacheKey({ id: 1 }, "a"),
      ]).size,
    ).toBe(5);
  });
});
