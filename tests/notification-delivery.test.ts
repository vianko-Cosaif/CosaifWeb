import { afterEach, expect, test, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { runInNewContext } from "node:vm";
import { claimNotification } from "../src/lib/notificationDelivery";
import nextConfig from "../next.config";
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

test("la CSP del worker permite sus imports de Firebase sin habilitar scripts arbitrarios", async () => {
  const response = GET();
  const source = await response.text();
  const policy = response.headers.get("content-security-policy") ?? "";
  const scripts =
    policy
      .split(";")
      .map((directive) => directive.trim())
      .find((directive) => directive.startsWith("script-src ")) ?? "";
  const allowedSources = scripts.split(/\s+/).slice(1);
  const importedUrls = [...source.matchAll(/importScripts\("([^"]+)"\)/g)].map((match) => match[1]);
  expect(importedUrls).toHaveLength(2);
  for (const url of importedUrls) {
    expect(
      allowedSources.some(
        (allowed) =>
          allowed.startsWith("https://www.gstatic.com/firebasejs/") && url.startsWith(allowed),
      ),
    ).toBe(true);
  }
  expect(allowedSources).not.toContain("'unsafe-inline'");
  expect(allowedSources).not.toContain("'unsafe-eval'");
  expect(allowedSources).not.toContain("https:");
  expect(allowedSources).not.toContain("*");
  expect(policy).toContain("default-src 'none'");
  expect(policy).toContain("connect-src 'self' https://*.googleapis.com");
  expect(response.headers.get("service-worker-allowed")).toBe("/");
});

test("Next aplica la CSP de Firebase despues de la politica general", async () => {
  const headers = await nextConfig.headers!();
  const generalIndex = headers.findIndex((entry) => entry.source === "/:path*");
  const workerIndex = headers.findIndex((entry) => entry.source === "/firebase-messaging-sw.js");
  expect(workerIndex).toBeGreaterThan(generalIndex);
  const workerPolicy = headers[workerIndex].headers.find(
    (header) => header.key === "Content-Security-Policy",
  )?.value;
  const pagePolicy = headers[generalIndex].headers.find(
    (header) => header.key === "Content-Security-Policy",
  )?.value;
  expect(workerPolicy).toBe(GET().headers.get("content-security-policy"));
  expect(pagePolicy).not.toContain("www.gstatic.com");
});
