// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invalidateCachedJson } from "@/lib/http/client";
import RailQueueBoardAdmin from "@/features/rail-queue/administrador/RailQueueBoardAdmin";

vi.mock("@/features/rail-queue/useRealtimeBoardRefresh", () => ({ useRealtimeBoardRefresh: () => "connected" }));
vi.mock("@/lib/torreonLocalidad", () => ({ isTorreonLocalidadId: () => false }));
vi.mock("next/dynamic", () => ({ default: () => () => null }));

const originalFullscreenElement = Object.getOwnPropertyDescriptor(document, "fullscreenElement");
const originalExitFullscreen = Object.getOwnPropertyDescriptor(document, "exitFullscreen");
const originalRequestFullscreen = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "requestFullscreen");
let fullscreenElement: Element | null = null;

function updateFullscreen(element: Element | null) {
  fullscreenElement = element;
  document.dispatchEvent(new Event("fullscreenchange"));
}

function restoreProperty(target: object, property: string, descriptor?: PropertyDescriptor) {
  if (descriptor) Object.defineProperty(target, property, descriptor);
  else Reflect.deleteProperty(target, property);
}

const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } });

beforeEach(() => {
  invalidateCachedJson();
  localStorage.clear();
  localStorage.setItem("rail-queue:polling", "0");
  document.cookie = "locId=2; path=/";
  fullscreenElement = null;
  Object.defineProperty(document, "fullscreenElement", { configurable: true, get: () => fullscreenElement });
  Object.defineProperty(document, "exitFullscreen", { configurable: true, value: vi.fn(async () => updateFullscreen(null)) });
  Object.defineProperty(HTMLElement.prototype, "requestFullscreen", {
    configurable: true,
    value: vi.fn(async function (this: HTMLElement) { updateFullscreen(this); }),
  });
  vi.stubGlobal("fetch", vi.fn(async (url: string) => url.endsWith("/localidades")
    ? json([{ id: 2, nombre: "Guadalajara" }])
    : json([{ id: 12, localidadId: 2, rondaNumero: 1, orden: 1, concluido: false, movimiento: { id: 33, locomotiveNumber: 33, estado: "SOLICITADO" } }])));
});

afterEach(() => {
  cleanup();
  invalidateCachedJson();
  document.cookie = "locId=; max-age=0; path=/";
  restoreProperty(document, "fullscreenElement", originalFullscreenElement);
  restoreProperty(document, "exitFullscreen", originalExitFullscreen);
  restoreProperty(HTMLElement.prototype, "requestFullscreen", originalRequestFullscreen);
  vi.unstubAllGlobals();
});

async function renderDashboard() {
  const view = render(<RailQueueBoardAdmin />);
  await screen.findAllByText("0033");
  const board = view.container.querySelector<HTMLElement>('[data-admin-dashboard="true"]');
  expect(board).not.toBeNull();
  return board!;
}

describe("administrator dashboard fullscreen", () => {
  it("expands the dashboard itself and exits without resetting the selected patio or its queue", async () => {
    const board = await renderDashboard();
    const selector = screen.getByRole("combobox", { name: "Localidad" });
    const enter = screen.getByRole("button", { name: "Pantalla completa" });
    expect(enter.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(enter);
    await waitFor(() => expect(document.fullscreenElement).toBe(board));
    const exit = await screen.findByRole("button", { name: "Salir de pantalla completa" });
    expect(exit.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("combobox", { name: "Localidad" })).toBe(selector);
    expect((selector as HTMLSelectElement).value).toBe("2");
    fireEvent.click(exit);
    await waitFor(() => expect(document.fullscreenElement).toBeNull());
    expect((await screen.findByRole("button", { name: "Pantalla completa" })).getAttribute("aria-pressed")).toBe("false");
    expect(document.exitFullscreen).toHaveBeenCalledOnce();
    expect(screen.getAllByText("0033").length).toBeGreaterThan(0);
  });

  it("updates the control when the browser exits fullscreen through Escape", async () => {
    await renderDashboard();
    fireEvent.click(screen.getByRole("button", { name: "Pantalla completa" }));
    await screen.findByRole("button", { name: "Salir de pantalla completa" });
    act(() => updateFullscreen(null));
    expect(screen.getByRole("button", { name: "Pantalla completa" }).getAttribute("aria-pressed")).toBe("false");
    expect(document.exitFullscreen).not.toHaveBeenCalled();
  });

  it("reports a rejected fullscreen request and leaves the control available to retry", async () => {
    const board = await renderDashboard();
    vi.mocked(HTMLElement.prototype.requestFullscreen).mockRejectedValueOnce(new DOMException("Denied", "NotAllowedError"));
    fireEvent.click(screen.getByRole("button", { name: "Pantalla completa" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/pantalla completa/i);
    const retry = screen.getByRole("button", { name: "Pantalla completa" }) as HTMLButtonElement;
    expect(retry.disabled).toBe(false);
    expect(retry.getAttribute("aria-pressed")).toBe("false");
    expect(document.fullscreenElement).toBeNull();
    fireEvent.click(retry);
    await waitFor(() => expect(document.fullscreenElement).toBe(board));
    await screen.findByRole("button", { name: "Salir de pantalla completa" });
    expect(HTMLElement.prototype.requestFullscreen).toHaveBeenCalledTimes(2);
  });

  it("does not mark the dashboard as expanded when another element is fullscreen", async () => {
    await renderDashboard();
    const otherElement = document.createElement("video");
    act(() => updateFullscreen(otherElement));
    expect(screen.getByRole("button", { name: "Pantalla completa" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.queryByRole("button", { name: "Salir de pantalla completa" })).toBeNull();
    expect(document.exitFullscreen).not.toHaveBeenCalled();
  });
});
