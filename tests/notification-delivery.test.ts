import { afterEach, expect, test, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { runInNewContext } from "node:vm";
import { claimNotification } from "../src/lib/notificationDelivery";
import { GET } from "../src/app/firebase-messaging-sw.js/route";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

test("un evento se reserva una sola vez entre pestañas y recargas", async () => {
  vi.stubGlobal("indexedDB", new IDBFactory());
  expect(await Promise.all([claimNotification("one"), claimNotification("one")])).toEqual([
    true,
    false,
  ]);
  expect(await claimNotification("one")).toBe(false);
  expect(await claimNotification("two")).toBe(true);
});

test("el worker no duplica notificaciones mostradas por Firebase", async () => {
  for (const key of ["API_KEY", "AUTH_DOMAIN", "PROJECT_ID", "MESSAGING_SENDER_ID", "APP_ID"]) {
    vi.stubEnv(`NEXT_PUBLIC_FIREBASE_${key}`, "test");
  }
  let handler: (payload: unknown) => Promise<void> | undefined;
  const showNotification = vi.fn();
  runInNewContext(await GET().text(), {
    self: { addEventListener() {}, registration: { showNotification } },
    importScripts() {},
    firebase: {
      initializeApp() {},
      messaging: () => ({
        onBackgroundMessage: (callback: typeof handler) => {
          handler = callback;
        },
      }),
    },
  });
  await handler!({ notification: { title: "Automático" }, data: { eventId: "one" } });
  expect(showNotification).not.toHaveBeenCalled();
  await handler!({ data: { title: "Sólo datos", eventId: "two" } });
  expect(showNotification).toHaveBeenCalledOnce();
  expect(showNotification.mock.calls[0][1]).toMatchObject({
    renotify: false,
    requireInteraction: false,
  });
});

test("permite una transición posterior sin ID y sigue bloqueando reintentos inmediatos", async () => {
  vi.stubGlobal("indexedDB", new IDBFactory());
  const time = vi.spyOn(Date, "now").mockReturnValue(10000);
  expect(await claimNotification("anonymous", 5000)).toBe(true);
  expect(await claimNotification("anonymous", 5000)).toBe(false);
  time.mockReturnValue(15001);
  expect(await claimNotification("anonymous", 5000)).toBe(true);
});
test("el almacenamiento no disponible conserva avisos nuevos sin repetirlos", async () => {
  vi.stubGlobal("indexedDB", undefined);
  expect(await claimNotification("memory-only")).toBe(true);
  expect(await claimNotification("memory-only")).toBe(false);
});
