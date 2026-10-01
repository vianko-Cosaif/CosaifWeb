// @vitest-environment jsdom
import React, { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PwaInstallPrompt from "@/components/layout/PwaInstallPrompt";

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("isSecureContext", true);
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("PWA initialization", () => {
  it("waits for page load and idle time, captures install events immediately, and shares registration across mounts", async () => {
    vi.stubEnv("NODE_ENV", "production");
    Object.defineProperty(document, "readyState", { configurable: true, value: "loading" });
    let idle!: IdleRequestCallback;
    vi.stubGlobal("requestIdleCallback", vi.fn((callback: IdleRequestCallback) => { idle = callback; return 1; }));
    vi.stubGlobal("cancelIdleCallback", vi.fn());
    let finish!: (value: { waiting: { postMessage: ReturnType<typeof vi.fn> } }) => void;
    const register = vi.fn(() => new Promise((resolve) => { finish = resolve; }));
    Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: { register } });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("Storage blocked"); });

    const { unmount } = render(<StrictMode><PwaInstallPrompt /></StrictMode>);
    expect(register).not.toHaveBeenCalled();
    expect(window.requestIdleCallback).not.toHaveBeenCalled();
    fireEvent(window, Object.assign(new Event("beforeinstallprompt"), { prompt: vi.fn(), userChoice: Promise.resolve({ outcome: "dismissed" }) }));
    expect(screen.getByRole("button", { name: "Descargar app" })).toBeTruthy();
    fireEvent.load(window);
    expect(window.requestIdleCallback).toHaveBeenCalledTimes(1);
    expect(register).not.toHaveBeenCalled();
    act(() => { idle({ didTimeout: false, timeRemaining: () => 10 }); });
    expect(register).toHaveBeenCalledTimes(1);
    unmount();
    const postMessage = vi.fn();
    await act(async () => { finish({ waiting: { postMessage } }); });
    expect(postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });

    Object.defineProperty(document, "readyState", { configurable: true, value: "complete" });
    render(<PwaInstallPrompt />);
    await act(async () => { idle({ didTimeout: false, timeRemaining: () => 10 }); });
    expect(register).toHaveBeenCalledTimes(1);
  });

  it("cleans the development worker only once in Strict Mode and preserves the push worker", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const unregisterApp = vi.fn().mockResolvedValue(true);
    const unregisterPush = vi.fn();
    const getRegistrations = vi.fn().mockResolvedValue([
      { active: { scriptURL: "http://localhost/sw.js" }, unregister: unregisterApp },
      { active: { scriptURL: "http://localhost/firebase-messaging-sw.js" }, unregister: unregisterPush },
    ]);
    Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: { getRegistrations } });
    const cacheKeys = vi.fn().mockResolvedValue(["cosaif-pwa-v2:runtime", "push-data"]);
    const deleteCache = vi.fn().mockResolvedValue(true);
    vi.stubGlobal("caches", { keys: cacheKeys, delete: deleteCache });
    render(<StrictMode><PwaInstallPrompt /></StrictMode>);
    await act(async () => {});
    expect(getRegistrations).toHaveBeenCalledTimes(1);
    expect(cacheKeys).toHaveBeenCalledTimes(1);
    expect(unregisterApp).toHaveBeenCalledTimes(1);
    expect(unregisterPush).not.toHaveBeenCalled();
    expect(deleteCache).toHaveBeenCalledExactlyOnceWith("cosaif-pwa-v2:runtime");
  });
});
