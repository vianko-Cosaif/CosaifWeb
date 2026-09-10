// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminIncidentCenter from "@/features/incidentes/AdminIncidentCenter";
import type { RealtimeMovementEvent } from "@/features/movimientos/useRealtimeMovimientos";

const realtime = vi.hoisted(() => ({ onEvent: (_event: RealtimeMovementEvent) => { void _event; } }));
vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("@/features/movimientos/useRealtimeMovimientos", () => ({
  useRealtimeMovimientos: ({ onEvent }: { onEvent: typeof realtime.onEvent }) => { realtime.onEvent = onEvent; return "connected"; },
}));
vi.mock("@/features/incidentes/components/IncidentCatalogSelect", () => ({ default: () => null }));
vi.mock("@/components/ui", () => ({ SearchInput: () => null }));
vi.mock("@/features/incidentes/operacion/IncidentesTable", () => ({
  default: ({ data, meta }: { data: { id: number }[]; meta: { total: number } }) => <div data-testid="incident-table" data-total={meta.total}>{data.map((row) => row.id).join(",")}</div>,
}));

function payload(ids: number[] = [], totalPages = 1) {
  return Response.json({ data: ids.map((id) => ({ id, estado: "ABIERTO", fechaInicio: "2026-09-08T10:00:00Z" })), meta: { totalPages } });
}
function visibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { configurable: true, value: state });
  document.dispatchEvent(new Event("visibilitychange"));
}
const fetcher = vi.fn();
function listCalls() { return fetcher.mock.calls.filter(([url]) => String(url).startsWith("/api/incidentes?")); }
beforeEach(() => {
  vi.useFakeTimers();
  visibility("visible");
  fetcher.mockImplementation(async (url: string) => url.startsWith("/bff/") ? Response.json([]) : payload());
  vi.stubGlobal("fetch", fetcher);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
async function flush() { await act(async () => {}); }

describe("administrator incident history lifecycle", () => {
  it("shares the initial load with realtime ready/resume and skips an immediate duplicate", async () => {
    const finishes: ((response: Response) => void)[] = [];
    fetcher.mockImplementation((url: string) => url.startsWith("/bff/")
      ? Promise.resolve(Response.json([]))
      : new Promise<Response>((resolve) => { finishes.push(resolve); }));
    render(<AdminIncidentCenter />);
    expect(listCalls()).toHaveLength(2);
    act(() => {
      realtime.onEvent({ type: "realtime.ready" });
      realtime.onEvent({ type: "realtime.resume" });
    });
    expect(listCalls()).toHaveLength(2);
    await act(async () => { finishes.forEach((finish) => finish(payload())); });
    await act(async () => {
      realtime.onEvent({ type: "realtime.ready" });
      realtime.onEvent({ type: "realtime.resume" });
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(listCalls()).toHaveLength(2);
  });

  it("aborts all requests on navigation and never starts the next history page batch", async () => {
    const finishes: ((response: Response) => void)[] = [];
    fetcher.mockImplementation((url: string) => {
      if (url.startsWith("/bff/")) return Promise.resolve(Response.json([]));
      const query = new URL(url, "http://localhost").searchParams;
      if (query.get("source") === "torreon") return Promise.resolve(payload());
      if (query.get("page") === "1") return Promise.resolve(payload([1], 12));
      return new Promise<Response>((resolve) => { finishes.push(resolve); });
    });
    const { unmount } = render(<AdminIncidentCenter />);
    await flush();
    expect(listCalls()).toHaveLength(6); // Both sources plus the first batch of four pages.
    const signals = fetcher.mock.calls.map(([, init]) => init.signal as AbortSignal);
    unmount();
    expect(signals.every((signal) => signal.aborted)).toBe(true);
    // Even a transport that resolves after cancellation cannot start more pages.
    await act(async () => { finishes.forEach((finish) => finish(payload())); });
    await act(async () => { await vi.advanceTimersByTimeAsync(120_000); });
    expect(listCalls()).toHaveLength(6);
  });

  it("cancels an obsolete scope and ignores its late response", async () => {
    const finishes: ((response: Response) => void)[] = [];
    fetcher.mockImplementation((url: string) => {
      if (url.startsWith("/bff/")) return Promise.resolve(Response.json([]));
      if (finishes.length < 2) return new Promise<Response>((resolve) => { finishes.push(resolve); });
      return Promise.resolve(payload([42]));
    });
    render(<AdminIncidentCenter />);
    const oldSignals = listCalls().map(([, init]) => init.signal as AbortSignal);
    fireEvent.click(screen.getByRole("button", { name: "Guadalajara" }));
    await flush();
    expect(oldSignals.every((signal) => signal.aborted)).toBe(true);
    expect(screen.getByTestId("incident-table").textContent).toBe("42");
    await act(async () => { finishes.forEach((finish) => finish(payload([7]))); });
    expect(screen.getByTestId("incident-table").textContent).toBe("42");
    expect(listCalls()).toHaveLength(3);
  });

  it("stops automatic reads while hidden and coalesces visible recovery with realtime", async () => {
    render(<AdminIncidentCenter />);
    await flush();
    expect(listCalls()).toHaveLength(2);
    act(() => { visibility("hidden"); });
    await act(async () => {
      realtime.onEvent({ type: "incidente.estado" });
      realtime.onEvent({ type: "realtime.resume" });
      await vi.advanceTimersByTimeAsync(180_000);
    });
    expect(listCalls()).toHaveLength(2);
    await act(async () => {
      visibility("visible");
      realtime.onEvent({ type: "realtime.resume" });
    });
    expect(listCalls()).toHaveLength(4);
  });

  it("keeps a completed recent history when switching tabs briefly", async () => {
    render(<AdminIncidentCenter />);
    await flush();
    act(() => { visibility("hidden"); });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
      visibility("visible");
      realtime.onEvent({ type: "realtime.resume" });
    });
    expect(listCalls()).toHaveLength(2);
  });

  it("keeps complete pagination statistics after all pages finish", async () => {
    fetcher.mockImplementation(async (url: string) => {
      if (url.startsWith("/bff/")) return Response.json([]);
      const query = new URL(url, "http://localhost").searchParams;
      if (query.get("source") === "torreon") return payload();
      return query.get("page") === "1" ? payload([1, 2], 2) : payload([3], 2);
    });
    render(<AdminIncidentCenter />);
    await flush();
    expect(screen.getByTestId("incident-table").getAttribute("data-total")).toBe("3");
    expect(screen.getByTestId("incident-table").textContent).toBe("1,2,3");
    expect(listCalls()).toHaveLength(3);
  });
});
