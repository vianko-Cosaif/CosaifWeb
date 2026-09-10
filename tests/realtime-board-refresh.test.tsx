// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRealtimeBoardRefresh } from "@/features/rail-queue/useRealtimeBoardRefresh";
import type { RealtimeMovementEvent } from "@/features/movimientos/useRealtimeMovimientos";

type Options = Parameters<typeof useRealtimeBoardRefresh>[0];
const realtime = vi.hoisted(() => ({ onEvent: null as ((event: RealtimeMovementEvent) => void) | null }));
vi.mock("@/features/movimientos/useRealtimeMovimientos", () => ({
  useRealtimeMovimientos: (options: { onEvent: (event: RealtimeMovementEvent) => void }) => {
    realtime.onEvent = options.onEvent;
    return "connected";
  },
}));

const visibilityDescriptor = Object.getOwnPropertyDescriptor(document, "visibilityState");
function visibility(value: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { configurable: true, value });
  document.dispatchEvent(new Event("visibilitychange"));
}
function event(id: string, localidadId = 1): RealtimeMovementEvent {
  return { type: "movimiento.estado", eventId: id, localidadId, movimientoId: 10 };
}
function emit(value: RealtimeMovementEvent) {
  act(() => realtime.onEvent?.(value));
}
async function tick(ms = 100) {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
}
function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
function setup(overrides: Partial<Options> = {}) {
  const onRefresh = vi.fn<Options["onRefresh"]>();
  const initialProps: Options = {
    enabled: true, realtimeLocalidadId: 1, scopeLocalidadId: 1,
    minDelayMs: 100, maxDelayMs: 100, onRefresh, ...overrides,
  };
  const view = renderHook((props: Options) => useRealtimeBoardRefresh(props), { initialProps });
  return { ...view, onRefresh, props: initialProps };
}

beforeEach(() => {
  vi.useFakeTimers();
  realtime.onEvent = null;
  visibility("visible");
});
afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  if (visibilityDescriptor) Object.defineProperty(document, "visibilityState", visibilityDescriptor);
  else Reflect.deleteProperty(document, "visibilityState");
});

describe("realtime board refresh lifecycle", () => {
  it("cancels a queued refresh on navigation away", async () => {
    const view = setup();
    emit(event("queued"));
    view.unmount();
    await tick(2_000);
    expect(view.onRefresh).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cancels queued updates when paused and ignores further events until enabled", async () => {
    const view = setup();
    emit(event("queued"));
    view.rerender({ ...view.props, enabled: false });
    emit(event("paused"));
    await tick(2_000);
    expect(view.onRefresh).not.toHaveBeenCalled();
    view.rerender(view.props);
    emit(event("resumed"));
    await tick();
    expect(view.onRefresh).toHaveBeenCalledExactlyOnceWith({ event: event("resumed"), forced: false });
  });

  it("discards the old locality's timer and accepts only events in the new locality", async () => {
    const view = setup();
    emit(event("old"));
    view.rerender({ ...view.props, realtimeLocalidadId: 2, scopeLocalidadId: 2 });
    emit(event("wrong-patio", 1));
    await tick();
    expect(view.onRefresh).not.toHaveBeenCalled();
    emit(event("new", 2));
    await tick();
    expect(view.onRefresh).toHaveBeenCalledExactlyOnceWith({ event: event("new", 2), forced: false });
  });

  it("groups events arriving during a request into one follow-up with the latest event", async () => {
    const pending = deferred();
    const refresh = vi.fn<Options["onRefresh"]>().mockReturnValueOnce(pending.promise);
    setup({ onRefresh: refresh });
    emit(event("first"));
    await tick();
    emit(event("second"));
    emit(event("third"));
    await tick(1_000);
    expect(refresh).toHaveBeenCalledTimes(1);
    await act(async () => pending.resolve());
    await tick();
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(refresh).toHaveBeenLastCalledWith({ event: event("third"), forced: true });
    await tick(2_000);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("does not let an older promise clear the current locality's in-flight request", async () => {
    const old = deferred();
    const current = deferred();
    const refresh = vi.fn<Options["onRefresh"]>().mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
    const view = setup({ onRefresh: refresh });
    emit(event("old"));
    await tick();
    view.rerender({ ...view.props, realtimeLocalidadId: 2, scopeLocalidadId: 2 });
    emit(event("new", 2));
    await tick();
    expect(refresh).toHaveBeenCalledTimes(2);
    await act(async () => old.resolve());
    emit(event("newer", 2));
    await tick(1_000);
    expect(refresh).toHaveBeenCalledTimes(2);
    await act(async () => current.resolve());
    await tick();
    expect(refresh).toHaveBeenCalledTimes(3);
    expect(refresh).toHaveBeenLastCalledWith({ event: event("newer", 2), forced: true });
  });

  it("does not restart queued work when an old request settles after pausing", async () => {
    const pending = deferred();
    const refresh = vi.fn<Options["onRefresh"]>().mockReturnValueOnce(pending.promise);
    const view = setup({ onRefresh: refresh });
    emit(event("first"));
    await tick();
    emit(event("queued"));
    view.rerender({ ...view.props, enabled: false });
    await act(async () => pending.resolve());
    await tick(2_000);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("ignores a previous scope's rejected promise without reporting it as a current error", async () => {
    const pending = deferred();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const refresh = vi.fn<Options["onRefresh"]>().mockReturnValueOnce(pending.promise);
    const view = setup({ onRefresh: refresh });
    emit(event("old"));
    await tick();
    view.unmount();
    await act(async () => pending.reject(new Error("Old request failed")));
    expect(error).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cancels pending timers while hidden and revalidates once on return", async () => {
    const view = setup();
    emit(event("before-hide"));
    act(() => visibility("hidden"));
    emit(event("hidden-1"));
    emit(event("hidden-2"));
    await tick(2_000);
    expect(view.onRefresh).not.toHaveBeenCalled();
    act(() => visibility("visible"));
    await tick();
    expect(view.onRefresh).toHaveBeenCalledExactlyOnceWith({ event: { type: "realtime.resume" }, forced: false });
  });

  it("does not refresh on visibility changes while updates are disabled", async () => {
    const view = setup({ enabled: false });
    act(() => visibility("hidden"));
    act(() => visibility("visible"));
    await tick(2_000);
    expect(view.onRefresh).not.toHaveBeenCalled();
  });

  it("catches synchronous refresh failures and remains available for subsequent updates", async () => {
    const failure = new Error("Synchronous refresh failed");
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const refresh = vi.fn<Options["onRefresh"]>().mockImplementationOnce(() => { throw failure; });
    setup({ onRefresh: refresh });
    emit(event("first"));
    await tick();
    expect(error).toHaveBeenCalledExactlyOnceWith("[realtime-board] refresh error", failure);
    emit(event("second"));
    await tick();
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("uses the latest callback when a scheduled refresh runs", async () => {
    const view = setup();
    emit(event("queued"));
    const latest = vi.fn<Options["onRefresh"]>();
    view.rerender({ ...view.props, onRefresh: latest });
    await tick();
    expect(view.onRefresh).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledExactlyOnceWith({ event: event("queued"), forced: false });
  });

  it("ignores heartbeat noise and repeated copies of the same movement event", async () => {
    const view = setup();
    emit({ type: "realtime.pong" });
    await tick();
    expect(view.onRefresh).not.toHaveBeenCalled();
    emit(event("duplicate"));
    await tick();
    emit(event("duplicate"));
    await tick();
    expect(view.onRefresh).toHaveBeenCalledTimes(1);
  });
});
