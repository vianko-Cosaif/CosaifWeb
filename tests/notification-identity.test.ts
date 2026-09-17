import { describe, expect, it } from "vitest";
import { createRealtimeEventDeduplicator, notificationIdentity } from "@/lib/notificationIdentity";

describe("notification event identity", () => {
  it("suppresses the same ID after the old 1.2-second window and on reconnection", () => {
    const suppress = createRealtimeEventDeduplicator();
    const event = {
      eventId: "a",
      type: "movimiento.estado",
      movimientoId: 10,
      estado: "EN_PROCESO",
    };
    expect(suppress(event, 1)).toBe(false);
    expect(suppress(event, 5_001)).toBe(true);
    expect(suppress({ ...event, transport: "sse" }, 120_001)).toBe(true);
    expect(suppress({ ...event, eventId: "b", estado: "CONCLUIDO" }, 120_002)).toBe(false);
  });
  it("uses revisions without losing distinct edits or subsequent anonymous transitions", () => {
    const suppress = createRealtimeEventDeduplicator();
    const event = { type: "movimiento.estado", movimientoId: 10, estado: "EN_PROCESO" };
    expect(suppress({ ...event, version: 1 }, 1)).toBe(false);
    expect(suppress({ ...event, version: 2 }, 2)).toBe(false);
    expect(suppress({ ...event, version: 1 }, 100_000)).toBe(true);
    expect(suppress({ ...event, eventId: "regenerated-id", version: 1 }, 100_000)).toBe(true);
    expect(suppress(event, 100_001)).toBe(false);
    expect(suppress(event, 100_002)).toBe(true);
    expect(suppress(event, 105_002)).toBe(false);
    expect(notificationIdentity(event).key).toBe(
      notificationIdentity({ ...event, transport: "sse" }).key,
    );
  });
  it("does not discard synchronization signals needed to refresh the data", () => {
    const suppress = createRealtimeEventDeduplicator();
    for (const type of ["realtime.ready", "realtime.resume", "realtime.pong"]) {
      expect(suppress({ type, eventId: "same" }, 1)).toBe(false);
      expect(suppress({ type, eventId: "same" }, 2)).toBe(false);
    }
  });
});
