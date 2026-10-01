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
vi.mock("@/lib/cookies", () => ({ getEmpresaIdClient: () => null, getLocIdClient: () => null, getRoleClient: () => null }));
vi.mock("@/lib/notificationSound", () => ({ playNotificationSound: vi.fn() }));
vi.mock("@/lib/notificationDelivery", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/notificationDelivery")>();
  return { ...actual, claimNotification: vi.fn(actual.claimNotification) };
});
beforeEach(() => {
  vi.stubGlobal("indexedDB", new IDBFactory());
  localStorage.setItem("user", JSON.stringify({ rol: "CLIENTE", empresaId: 100, localidadId: 10 }));
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
        detail: { recipientRoles: ["CLIENTE"], empresaId: 100, localidadId: 10, eventId, type: "movimiento.estado", movimientoId: 123, estado },
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
  expect(screen.getAllByText("Conectado")).toHaveLength(1);
  expect(screen.queryByText("Monitor desconectado")).toBeNull();
  expect(playNotificationSound).not.toHaveBeenCalled();
});

it("does not alert a client for an internal reminder or events from another patio or company", async () => {
  render(<RealtimeActivityCenter />);
  await act(async () => {
    for (const patch of [{ recipientRoles: ["MAQUINISTA", "COORDINADOR", "SUPERVISOR"] }, { localidadId: 20 }, { empresaId: 200 }]) {
      window.dispatchEvent(new CustomEvent("cosaif:realtime-event", { detail: {
        eventId: JSON.stringify(patch), type: "movimiento.recordatorio", empresaId: 100, localidadId: 10,
        recipientRoles: ["CLIENTE"], ...patch,
      } }));
    }
  });
  expect(playNotificationSound).not.toHaveBeenCalled();
  expect(screen.queryByRole("status")).toBeNull();
});
it("shows the hourly reminder text supplied by the backend", async () => {
  localStorage.setItem("user", JSON.stringify({ rol: "SUPERVISOR", localidadId: 10 }));
  render(<RealtimeActivityCenter />);
  await act(async () => {
    window.dispatchEvent(new CustomEvent("cosaif:realtime-event", { detail: {
      type: "movimiento.recordatorio", eventId: "pending-hour-1", recipientRoles: ["SUPERVISOR"],
      localidadId: 10, empresaId: 100, notificationTitle: "Movimiento pendiente de iniciar",
      notificationBody: "#15 · Guadalajara · 1 hora pendiente",
    } }));
    await Promise.all(vi.mocked(claimNotification).mock.results.map(result => result.value));
  });
  expect(screen.getByRole("status").textContent).toContain("1 hora pendiente");
  expect(playNotificationSound).toHaveBeenCalledTimes(1);
});

it("deletes notices after viewing and closing, clears legacy history and never restores content", async () => {
  const historyKey = "cosaif:activity:v1:old";
  localStorage.setItem(historyKey, JSON.stringify({ items: [{ title: "Old notice" }] }));
  render(<RealtimeActivityCenter />);
  expect(localStorage.getItem(historyKey)).toBeNull();
  await emit("view-once");
  fireEvent.click(screen.getByRole("status"));
  expect(screen.getByText("Movimiento iniciado")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Cerrar actividad" }));
  fireEvent.click(screen.getByRole("button", { name: "Abrir actividad en tiempo real" }));
  expect(screen.queryByText("Movimiento iniciado")).toBeNull();
  expect(screen.getByText(/Estás al día/)).toBeTruthy();
  expect(Object.keys(localStorage).filter(key => key.startsWith("cosaif:activity:"))).toEqual([]);
  await emit("view-once");
  expect(screen.queryByRole("status")).toBeNull();
  expect(playNotificationSound).toHaveBeenCalledTimes(1);
});
