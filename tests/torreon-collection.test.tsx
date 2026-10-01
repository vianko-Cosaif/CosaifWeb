// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useTorreonCollection } from "@/features/torreon/useTorreonCollection";

afterEach(cleanup);
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
};

describe("Torreón collection lifecycle", () => {
  it("aborts the old scope and never shows its late response under another company", async () => {
    const first = deferred<number[]>();
    const second = deferred<number[]>();
    const fetchFirst = vi.fn<(signal: AbortSignal) => Promise<number[]>>(() => first.promise);
    const fetchSecond = vi.fn<(signal: AbortSignal) => Promise<number[]>>(() => second.promise);
    const hook = renderHook(
      ({ key, fetchRows }) => useTorreonCollection({ queryKey: key, fetchRows }),
      {
        initialProps: { key: "company-1", fetchRows: fetchFirst },
      },
    );
    hook.rerender({ key: "company-2", fetchRows: fetchSecond });
    expect(fetchFirst.mock.calls[0]?.[0]?.aborted).toBe(true);
    expect(hook.result.current.rows).toEqual([]);
    await act(async () => second.resolve([20]));
    await act(async () => first.resolve([10]));
    expect(hook.result.current.rows).toEqual([20]);
  });

  it("shares an in-flight initial load with ready/resume, while grouping forced updates into one subsequent read", async () => {
    const first = deferred<number[]>();
    const second = deferred<number[]>();
    const fetchRows = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const hook = renderHook(() => useTorreonCollection<number>({ queryKey: "scope", fetchRows }));
    act(() => {
      void hook.result.current.load();
      void hook.result.current.load();
    });
    expect(fetchRows).toHaveBeenCalledTimes(1);
    act(() => {
      void hook.result.current.load(true);
      void hook.result.current.load(true);
    });
    await act(async () => first.resolve([1]));
    expect(fetchRows).toHaveBeenCalledTimes(2);
    await act(async () => second.resolve([2]));
    expect(hook.result.current.rows).toEqual([2]);
    expect(hook.result.current.refreshing).toBe(false);
  });

  it("keeps the last successful rows and exposes a refresh failure instead of an empty operation", async () => {
    const fetchRows = vi
      .fn()
      .mockResolvedValueOnce([8])
      .mockRejectedValueOnce(new Error("Servicio no disponible"))
      .mockResolvedValueOnce([9]);
    const hook = renderHook(() => useTorreonCollection<number>({ queryKey: "scope", fetchRows }));
    await waitFor(() => expect(hook.result.current.rows).toEqual([8]));
    await act(async () => hook.result.current.load(true));
    expect(hook.result.current.rows).toEqual([8]);
    expect(hook.result.current.error).toBe("Servicio no disponible");
    expect(hook.result.current.refreshing).toBe(false);
    await act(async () => hook.result.current.load(true));
    expect(hook.result.current.rows).toEqual([9]);
    expect(hook.result.current.error).toBeNull();
  });

  it("hides old rows while another scope loads and does not preserve them if that scope fails", async () => {
    const second = deferred<number[]>();
    const initial = vi.fn().mockResolvedValue([8]);
    const next = vi.fn(() => second.promise);
    const hook = renderHook(
      ({ key, fetchRows }) => useTorreonCollection<number>({ queryKey: key, fetchRows }),
      {
        initialProps: { key: "current", fetchRows: initial },
      },
    );
    await waitFor(() => expect(hook.result.current.rows).toEqual([8]));
    hook.rerender({ key: "history", fetchRows: next });
    expect(hook.result.current.rows).toEqual([]);
    expect(hook.result.current.loading).toBe(true);
    await act(async () => second.reject(new Error("Sin conexión")));
    expect(hook.result.current.rows).toEqual([]);
    expect(hook.result.current.error).toBe("Sin conexión");
    expect(hook.result.current.loading).toBe(false);
  });

  it("aborts collection and detail reads on unmount", async () => {
    let listSignal!: AbortSignal;
    const pendingList = deferred<number[]>();
    const fetchRows = vi.fn((signal: AbortSignal) => {
      listSignal = signal;
      return pendingList.promise;
    });
    const first = renderHook(() => useTorreonCollection<number>({ queryKey: "scope", fetchRows }));
    first.unmount();
    expect(listSignal.aborted).toBe(true);

    let itemSignal!: AbortSignal;
    const pendingItem = deferred<number>();
    const loadedRows = vi.fn().mockResolvedValue([1]);
    const second = renderHook(() =>
      useTorreonCollection<number>({ queryKey: "scope", fetchRows: loadedRows }),
    );
    await waitFor(() => expect(second.result.current.rows).toEqual([1]));
    act(() => {
      void second.result.current.refreshItem(
        1,
        (signal) => {
          itemSignal = signal;
          return pendingItem.promise;
        },
        (_, value) => [value],
      );
    });
    second.unmount();
    expect(itemSignal.aborted).toBe(true);
    await act(async () => pendingItem.resolve(2));
  });

  it("runs item refresh after a pending collection so the collection cannot overwrite a newer item", async () => {
    const list = deferred<number[]>();
    const fetchRows = vi.fn(() => list.promise);
    const fetchItem = vi.fn().mockResolvedValue(2);
    const hook = renderHook(() => useTorreonCollection<number>({ queryKey: "scope", fetchRows }));
    act(() => {
      void hook.result.current.refreshItem(1, fetchItem, (_, item) => [item]);
    });
    expect(fetchItem).not.toHaveBeenCalled();
    await act(async () => list.resolve([1]));
    expect(fetchItem).toHaveBeenCalledOnce();
    expect(hook.result.current.rows).toEqual([2]);
  });

  it("does not overwrite a realtime update with a collection response already in flight", async () => {
    const stale = deferred<number[]>();
    const fresh = deferred<number[]>();
    const fetchRows = vi
      .fn()
      .mockResolvedValueOnce([1])
      .mockReturnValueOnce(stale.promise)
      .mockReturnValueOnce(fresh.promise);
    const hook = renderHook(() => useTorreonCollection<number>({ queryKey: "scope", fetchRows }));
    await waitFor(() => expect(hook.result.current.rows).toEqual([1]));
    act(() => {
      void hook.result.current.load(true);
    });
    act(() => hook.result.current.setRows([2]));
    await act(async () => stale.resolve([1]));
    expect(hook.result.current.rows).toEqual([2]);
    expect(fetchRows).toHaveBeenCalledTimes(3);
    await act(async () => fresh.resolve([2]));
    expect(hook.result.current.rows).toEqual([2]);
  });

  it("does not fetch or retain rows when scope is disabled", async () => {
    const fetchRows = vi.fn().mockResolvedValue([1]);
    const hook = renderHook(
      ({ enabled }) => useTorreonCollection<number>({ queryKey: "scope", fetchRows, enabled }),
      { initialProps: { enabled: true } },
    );
    await waitFor(() => expect(hook.result.current.rows).toEqual([1]));
    hook.rerender({ enabled: false });
    expect(hook.result.current.rows).toEqual([]);
    expect(hook.result.current.loading).toBe(false);
    await act(async () => hook.result.current.load(true));
    expect(fetchRows).toHaveBeenCalledOnce();
  });
});

it("moves pagination totals with their rows and retains both on refresh failure", async () => {
  const first = { data: [1], meta: { page: 1, pageSize: 1, total: 150, totalPages: 150 } };
  const pending = deferred<typeof first>();
  const initial = vi.fn().mockResolvedValue(first);
  const second = vi
    .fn()
    .mockReturnValueOnce(pending.promise)
    .mockRejectedValueOnce(new Error("Sin conexión"));
  const hook = renderHook(
    ({ key, fetchRows }) => useTorreonCollection<number>({ queryKey: key, fetchRows }),
    { initialProps: { key: "page1", fetchRows: initial } },
  );
  await waitFor(() => expect(hook.result.current.meta?.total).toBe(150));
  hook.rerender({ key: "page2", fetchRows: second });
  expect(hook.result.current.rows).toEqual([]);
  expect(hook.result.current.meta).toBeUndefined();
  await act(async () =>
    pending.resolve({ data: [2], meta: { page: 2, pageSize: 1, total: 151, totalPages: 151 } }),
  );
  expect(hook.result.current.rows).toEqual([2]);
  expect(hook.result.current.meta?.page).toBe(2);
  await act(async () => hook.result.current.load(true));
  expect(hook.result.current.rows).toEqual([2]);
  expect(hook.result.current.meta?.total).toBe(151);
  expect(hook.result.current.error).toBe("Sin conexión");
});
