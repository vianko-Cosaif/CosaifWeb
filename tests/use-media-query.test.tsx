// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useMediaQuery } from "@/hooks/useMediaQuery";

function mediaQuery(initial: boolean, legacy = false) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const add = vi.fn((listener: (event: MediaQueryListEvent) => void) => listeners.add(listener));
  const remove = vi.fn((listener: (event: MediaQueryListEvent) => void) => listeners.delete(listener));
  const media = {
    matches: initial,
    ...(legacy ? { addListener: add, removeListener: remove } : {
      addEventListener: (_event: string, listener: (event: MediaQueryListEvent) => void) => add(listener),
      removeEventListener: (_event: string, listener: (event: MediaQueryListEvent) => void) => remove(listener),
    }),
  };
  return {
    media, add, remove, listeners,
    emit: (matches: boolean) => {
      media.matches = matches;
      listeners.forEach(listener => listener({ matches } as MediaQueryListEvent));
    },
  };
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("useMediaQuery subscriptions", () => {
  it("reads the current match, follows changes and does not resubscribe on an unchanged query", () => {
    const query = mediaQuery(true);
    const matchMedia = vi.fn(() => query.media);
    vi.stubGlobal("matchMedia", matchMedia);
    const { result, rerender, unmount } = renderHook(() => useMediaQuery("(min-width: 1152px)"));
    expect(result.current).toBe(true);
    act(() => query.emit(false));
    expect(result.current).toBe(false);
    rerender();
    expect(matchMedia).toHaveBeenCalledOnce();
    expect(query.add).toHaveBeenCalledOnce();
    unmount();
    expect(query.remove).toHaveBeenCalledWith(query.add.mock.calls[0][0]);
    expect(query.listeners.size).toBe(0);
  });

  it("cleans up the old query, immediately reads the new query and ignores events from the previous one", () => {
    const first = mediaQuery(true);
    const second = mediaQuery(false);
    const firstQuery = "(min-width: 1152px)";
    const secondQuery = "(orientation: portrait)";
    const matchMedia = vi.fn((query: string) => query === firstQuery ? first.media : second.media);
    vi.stubGlobal("matchMedia", matchMedia);
    const { result, rerender, unmount } = renderHook(({ query }) => useMediaQuery(query), { initialProps: { query: firstQuery } });
    expect(result.current).toBe(true);
    rerender({ query: secondQuery });
    expect(matchMedia.mock.calls.map(([query]) => query)).toEqual([firstQuery, secondQuery]);
    expect(first.remove).toHaveBeenCalledWith(first.add.mock.calls[0][0]);
    expect(first.listeners.size).toBe(0);
    expect(second.add).toHaveBeenCalledOnce();
    expect(result.current).toBe(false);
    act(() => first.emit(true));
    expect(result.current).toBe(false);
    act(() => second.emit(true));
    expect(result.current).toBe(true);
    act(() => first.emit(false));
    expect(result.current).toBe(true);
    unmount();
    expect(first.remove).toHaveBeenCalledOnce();
    expect(second.remove).toHaveBeenCalledWith(second.add.mock.calls[0][0]);
    expect(second.listeners.size).toBe(0);
  });

  it("subscribes and cleans up through legacy Safari listeners when EventTarget methods are unavailable", () => {
    const query = mediaQuery(false, true);
    vi.stubGlobal("matchMedia", vi.fn(() => query.media));
    const { result, unmount } = renderHook(() => useMediaQuery("(prefers-reduced-motion: reduce)", true));
    expect(result.current).toBe(false);
    expect(query.add).toHaveBeenCalledOnce();
    act(() => query.emit(true));
    expect(result.current).toBe(true);
    unmount();
    expect(query.remove).toHaveBeenCalledWith(query.add.mock.calls[0][0]);
    expect(query.listeners.size).toBe(0);
  });
});
