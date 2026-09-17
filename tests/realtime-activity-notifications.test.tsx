// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import RealtimeActivityCenter from "@/components/layout/RealtimeActivityCenter";
import { claimNotification } from "@/lib/notificationDelivery";
import { playNotificationSound } from "@/lib/notificationSound";
vi.mock("@/features/movimientos/useRealtimeMovimientos", () => ({
  useRealtimeMovimientos: () => "connected",
}));
vi.mock("@/lib/cookies", () => ({ getEmpresaIdClient: () => null, getLocIdClient: () => null }));
vi.mock("@/lib/notificationSound", () => ({ playNotificationSound: vi.fn() }));
vi.mock("@/lib/notificationDelivery", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/notificationDelivery")>();
  return { ...actual, claimNotification: vi.fn(actual.claimNotification) };
});
beforeEach(() => {
  vi.stubGlobal("indexedDB", new IDBFactory());
  localStorage.setItem("user", JSON.stringify({ rol: "ADMINISTRADOR" }));
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});
async function emit(eventId: string, estado = "EN_PROCESO") {
  await act(async () => {
    window.dispatchEvent(
      new CustomEvent("cosaif:realtime-event", {
        detail: { eventId, type: "movimiento.estado", movimientoId: 123, estado },
      }),
    );
    await Promise.all(vi.mocked(claimNotification).mock.results.map((result) => result.value));
  });
}
it("does not reopen a dismissed alert or sound again after rerender, navigation, and replay", async () => {
  let view = render(<RealtimeActivityCenter />);
  await emit("event-one");
  expect(playNotificationSound).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("status"));
  expect(screen.queryByRole("status")).toBeNull();
  await emit("event-one");
  view.rerender(<RealtimeActivityCenter />);
  await emit("event-one");
  expect(screen.queryByRole("status")).toBeNull();
  expect(playNotificationSound).toHaveBeenCalledTimes(1);
  view.unmount();
  view = render(<RealtimeActivityCenter />);
  await emit("event-one");
  expect(screen.queryByRole("status")).toBeNull();
  await emit("event-two", "CONCLUIDO");
  expect(screen.getByRole("status").textContent).toContain("finalizado");
  expect(playNotificationSound).toHaveBeenCalledTimes(2);
});
it("stores one connection indicator instead of flooding the activity list on retries", () => {
  render(<RealtimeActivityCenter />);
  act(() => {
    for (let i = 0; i < 3; i++)
      for (const status of ["connecting", "disconnected", "connected"])
        window.dispatchEvent(new CustomEvent("cosaif:realtime-status", { detail: { status } }));
  });
  fireEvent.click(screen.getByRole("button", { name: "Abrir actividad en tiempo real" }));
  expect(screen.getAllByText("Monitor conectado")).toHaveLength(1);
  expect(screen.queryByText("Monitor desconectado")).toBeNull();
  expect(playNotificationSound).not.toHaveBeenCalled();
});
