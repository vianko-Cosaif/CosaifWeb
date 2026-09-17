// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setRealtimeNotificationConnection } from "@/lib/notificationDelivery";
import FirebaseNotificationPrompt from "@/components/layout/FirebaseNotificationPrompt";

const runtime = vi.hoisted(() => ({
  pathname: "/administrador",
  enabled: true,
  requestToken: vi.fn(),
  registerToken: vi.fn(),
  listen: vi.fn(),
  preloadSound: vi.fn(),
  primeSound: vi.fn(),
  playSound: vi.fn(),
}));
vi.mock("next/navigation", () => ({ usePathname: () => runtime.pathname }));
vi.mock("@/lib/notificationRuntime", () => ({
  getNotificationRuntimePolicy: () => ({
    enabled: runtime.enabled,
    statusKey: "notification-test-status",
  }),
  assertSameOriginUrl: (url: string) => url,
}));
vi.mock("@/lib/firebase", () => ({
  requestFirebaseNotificationToken: runtime.requestToken,
  registerFirebaseNotificationToken: runtime.registerToken,
  listenFirebaseForegroundMessages: runtime.listen,
}));
vi.mock("@/lib/notificationSound", () => ({
  preloadNotificationSound: runtime.preloadSound,
  primeNotificationSound: runtime.primeSound,
  playNotificationSound: runtime.playSound,
}));

beforeEach(() => {
  vi.useFakeTimers();
  setRealtimeNotificationConnection(false);
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  runtime.pathname = "/administrador";
  runtime.enabled = true;
  runtime.requestToken.mockResolvedValue("synthetic-fcm-token");
  runtime.registerToken.mockResolvedValue(undefined);
  runtime.listen.mockResolvedValue(vi.fn());
  runtime.primeSound.mockResolvedValue(true);
  const notification = Object.assign(vi.fn(), {
    permission: "granted",
    requestPermission: vi.fn().mockResolvedValue("granted"),
  });
  vi.stubGlobal("Notification", notification);
  vi.stubGlobal("isSecureContext", true);
  Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: {} });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
async function advance(ms = 1200) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
    await vi.dynamicImportSettled();
  });
}

describe("notification runtime lifecycle", () => {
  it.each(["login", "disabled"])("does not initialize Firebase or audio when %s", async (mode) => {
    runtime.pathname = mode === "login" ? "/login" : "/administrador";
    runtime.enabled = mode !== "disabled";
    const { container } = render(<FirebaseNotificationPrompt />);
    fireEvent.pointerDown(window);
    await advance(5000);
    expect(runtime.requestToken).not.toHaveBeenCalled();
    expect(runtime.listen).not.toHaveBeenCalled();
    expect(runtime.preloadSound).not.toHaveBeenCalled();
    expect(runtime.primeSound).not.toHaveBeenCalled();
    expect(container.textContent).toBe("");
  });

  it("keeps one listener while token registration and navigation change UI state", async () => {
    let finish!: (value: string) => void;
    runtime.requestToken.mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          finish = resolve;
        }),
    );
    const unsubscribe = vi.fn();
    runtime.listen.mockResolvedValue(unsubscribe);
    const { rerender } = render(<FirebaseNotificationPrompt />);
    await advance();
    expect(runtime.listen).toHaveBeenCalledTimes(1);
    await act(async () => {
      finish("synthetic-fcm-token");
    });
    runtime.pathname = "/administrador/movimientos";
    rerender(<FirebaseNotificationPrompt />);
    await advance(5000);
    expect(runtime.listen).toHaveBeenCalledTimes(1);
    expect(runtime.registerToken).toHaveBeenCalledTimes(1);
    expect(unsubscribe).not.toHaveBeenCalled();
  });

  it("unsubscribes an asynchronous listener that finishes after cleanup", async () => {
    let finish!: (unsubscribe: () => void) => void;
    runtime.listen.mockImplementationOnce(
      () =>
        new Promise<() => void>((resolve) => {
          finish = resolve;
        }),
    );
    const { unmount } = render(<FirebaseNotificationPrompt />);
    await advance();
    expect(runtime.listen).toHaveBeenCalledTimes(1);
    unmount();
    const unsubscribe = vi.fn();
    await act(async () => {
      finish(unsubscribe);
    });
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("does not register a token that finishes after returning to login", async () => {
    let finish!: (value: string) => void;
    runtime.requestToken.mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          finish = resolve;
        }),
    );
    const { rerender } = render(<FirebaseNotificationPrompt />);
    await advance();
    runtime.pathname = "/login";
    rerender(<FirebaseNotificationPrompt />);
    await act(async () => {
      finish("synthetic-fcm-token");
    });
    expect(runtime.registerToken).not.toHaveBeenCalled();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("explains denied permission without making it a login requirement", async () => {
    Object.assign(Notification, { permission: "denied" });
    render(<FirebaseNotificationPrompt />);
    await advance();
    expect(screen.getByText("Notificaciones bloqueadas")).toBeTruthy();
    expect(screen.queryByText(/para poder entrar/)).toBeNull();
    expect(runtime.requestToken).not.toHaveBeenCalled();
    expect(runtime.preloadSound).not.toHaveBeenCalled();
  });
  it("uses realtime for operational pushes and keeps Firebase as fallback", async () => {
    render(<FirebaseNotificationPrompt />);
    await advance();
    const callback = runtime.listen.mock.calls[0][0];
    setRealtimeNotificationConnection(true);
    await act(async () =>
      callback({
        data: { eventId: "push-realtime", eventType: "torreon.arrastre.creado", title: "Creado" },
      }),
    );
    expect(Notification).not.toHaveBeenCalled();
    expect(runtime.playSound).not.toHaveBeenCalled();
    setRealtimeNotificationConnection(false);
    await act(async () =>
      callback({
        data: { eventId: "push-fallback", eventType: "torreon.arrastre.creado", title: "Creado" },
      }),
    );
    await advance(0);
    expect(Notification).toHaveBeenCalledTimes(1);
    expect(runtime.playSound).toHaveBeenCalledTimes(1);
    await act(async () =>
      callback({
        data: { eventId: "push-fallback", eventType: "torreon.arrastre.creado", title: "Creado" },
      }),
    );
    expect(Notification).toHaveBeenCalledTimes(1);
  });
  it("keeps unrelated push notices even when realtime is connected", async () => {
    render(<FirebaseNotificationPrompt />);
    await advance();
    setRealtimeNotificationConnection(true);
    await act(async () =>
      runtime.listen.mock.calls[0][0]({
        data: {
          eventId: "maintenance-notice",
          tipo: "mantenimiento_programado",
          title: "Mantenimiento",
        },
      }),
    );
    expect(Notification).toHaveBeenCalledTimes(1);
  });
});
