// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTornoHistory, useTornoSession } from "@/features/torno/hooks/useTorno";
import { getTornoPermissions } from "@/features/torno/lib/permissions";
import type { TornoHistoryItem, TornoListResult } from "@/features/torno/lib/types";

const service = vi.hoisted(() => ({ list: vi.fn(), detail: vi.fn() }));
vi.mock("@/features/torno/lib/tornoService", () => ({ listTornoHistory: service.list, getTornoHistoryDetail: service.detail }));
const row = (id: number) => ({ id, status: "SOLICITADO" }) as TornoHistoryItem;
const list = (id: number): TornoListResult<TornoHistoryItem> => ({ items: [row(id)], meta: { page: 1, pageSize: 25, total: 1, totalPages: 1, hasNextPage: false, hasPrevPage: false } });
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  return { promise: new Promise<T>((done) => { resolve = done; }), resolve: (value: T) => resolve(value) };
};
beforeEach(() => { service.list.mockReset(); service.detail.mockReset(); service.list.mockResolvedValue(list(1)); });
afterEach(() => { cleanup(); vi.useRealTimers(); localStorage.clear(); });

describe("Torno entry and reads", () => {
  it("waits for resolved session scope and loads once without the old initial filter effect", async () => {
    const hook = renderHook(({ enabled }) => useTornoHistory({ empresaId: 8, localidadId: 1 }, enabled), { initialProps: { enabled: false } });
    expect(service.list).not.toHaveBeenCalled();
    hook.rerender({ enabled: true });
    await waitFor(() => expect(hook.result.current.items).toHaveLength(1));
    expect(service.list).toHaveBeenCalledTimes(1);
    expect(service.list.mock.calls[0][1]).toMatchObject({ empresaId: 8, localidadId: 1 });
    hook.rerender({ enabled: true });
    expect(service.list).toHaveBeenCalledTimes(1);
  });

  it("waits for typing to settle and resets the page without requesting the old search on page one", async () => {
    vi.useFakeTimers();
    const hook = renderHook(() => useTornoHistory({ empresaId: 8, localidadId: 1 }));
    await act(async () => {});
    act(() => hook.result.current.setPage(3));
    await act(async () => {});
    expect(service.list).toHaveBeenCalledTimes(2);
    act(() => hook.result.current.setSearch("10"));
    act(() => hook.result.current.setSearch("109"));
    act(() => hook.result.current.setSearch("1098"));
    expect(service.list).toHaveBeenCalledTimes(2);
    expect(hook.result.current.filters.search).toBe("1098");
    await act(async () => vi.advanceTimersByTimeAsync(250));
    expect(service.list).toHaveBeenCalledTimes(3);
    expect(service.list.mock.calls[2][1]).toMatchObject({ search: "1098", page: 1 });
  });

  it("aborts a previous locality and never displays its late result under the new locality", async () => {
    const old = deferred<TornoListResult<TornoHistoryItem>>();
    const fresh = deferred<TornoListResult<TornoHistoryItem>>();
    service.list.mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
    const hook = renderHook(({ localidadId }) => useTornoHistory({ empresaId: 8, localidadId }), { initialProps: { localidadId: 1 } });
    const firstSignal = service.list.mock.calls[0][2].signal as AbortSignal;
    hook.rerender({ localidadId: 2 });
    expect(firstSignal.aborted).toBe(true);
    await act(async () => fresh.resolve(list(2)));
    await act(async () => old.resolve(list(1)));
    expect(hook.result.current.items.map((item) => item.id)).toEqual([2]);
  });

  it("does not reopen a detail closed before its response arrives", async () => {
    const detail = deferred<TornoHistoryItem>();
    service.detail.mockReturnValue(detail.promise);
    const hook = renderHook(() => useTornoHistory());
    act(() => { void hook.result.current.openDetail(row(1)); });
    expect(hook.result.current.detail?.id).toBe(1);
    act(() => hook.result.current.closeDetail());
    expect(service.detail.mock.calls[0][1].signal.aborted).toBe(true);
    await act(async () => detail.resolve(row(1)));
    expect(hook.result.current.detail).toBeNull();
  });

  it("keeps the successful list visible if refreshing the same selection fails", async () => {
    const hook = renderHook(() => useTornoHistory());
    await waitFor(() => expect(hook.result.current.items).toHaveLength(1));
    service.list.mockRejectedValueOnce(new Error("El servicio tardó demasiado"));
    await act(async () => hook.result.current.reload());
    expect(hook.result.current.items).toHaveLength(1);
    expect(hook.result.current.error).toBe("El servicio tardó demasiado");
    expect(hook.result.current.refreshing).toBe(false);
  });

  it("uses verified client-wide role and scope without waiting for or trusting local storage", () => {
    localStorage.setItem("user", JSON.stringify({ id: 99, rol: "ADMINISTRADOR", empresaId: 99, localidadId: 99 }));
    const hook = renderHook(() => useTornoSession({ id: 8, rol: "CLIENTE_ADMIN", empresaId: 8, localidadId: null }));
    expect(hook.result.current).toMatchObject({ mounted: true, role: "CLIENTE_ADMIN", empresaId: 8, localidadId: null, user: { id: 8 } });
    expect(hook.result.current.permissions.scopeLocalidadId).toBe(false);
    expect(getTornoPermissions("SUPERVISOR").scopeLocalidadId).toBe(true);
    expect(getTornoPermissions("COORDINADOR").scopeLocalidadId).toBe(true);
  });
});
