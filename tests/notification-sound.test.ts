// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const audio = vi.hoisted(() => ({ create: vi.fn(), state: "running", start: vi.fn() }));
vi.mock("@/lib/notificationAudio", () => ({
  PolySynth: class {
    volume = { value: 0 };
    constructor() {
      audio.create();
    }
    toDestination() {}
    triggerAttackRelease() {}
    releaseAll() {}
    dispose() {}
  },
  Synth: class {},
  getContext: () => ({ state: audio.state }),
  start: audio.start,
  now: () => 0,
}));
beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  localStorage.clear();
  audio.state = "running";
  audio.start.mockResolvedValue(undefined);
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});
it("coalesces a burst instead of replaying an audio queue", async () => {
  const { playNotificationSound } = await import("@/lib/notificationSound");
  await Promise.all(Array.from({ length: 10 }, () => playNotificationSound("movimiento_iniciado")));
  expect(audio.create).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1_000);
  await playNotificationSound("movimiento_iniciado");
  expect(audio.create).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1_100);
  await playNotificationSound("movimiento_finalizado");
  expect(audio.create).toHaveBeenCalledTimes(2);
});
it("does not duplicate an action confirmation when realtime owns the notification", async () => {
  const { setRealtimeNotificationConnection } = await import("@/lib/notificationDelivery");
  const { playOperationConfirmation } = await import("@/lib/notificationSound");
  setRealtimeNotificationConnection(true);
  await playOperationConfirmation("arrastre_creado");
  expect(audio.create).not.toHaveBeenCalled();
  setRealtimeNotificationConnection(false);
  await playOperationConfirmation("arrastre_creado");
  expect(audio.create).toHaveBeenCalledOnce();
});
it("respects silence and lets a new incident interrupt a lower-priority confirmation", async () => {
  const { playNotificationSound } = await import("@/lib/notificationSound");
  localStorage.setItem("rail-queue:soundOn", "0");
  await playNotificationSound("movimiento_creado");
  expect(audio.create).not.toHaveBeenCalled();
  localStorage.setItem("rail-queue:soundOn", "1");
  await playNotificationSound("movimiento_creado");
  await playNotificationSound("incidente_creado");
  await playNotificationSound("incidente_creado");
  expect(audio.create).toHaveBeenCalledTimes(2);
});
