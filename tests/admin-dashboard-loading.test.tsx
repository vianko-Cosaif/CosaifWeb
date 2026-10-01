// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invalidateCachedJson } from "@/lib/http/client";
import RailQueueBoardAdmin from "@/features/rail-queue/administrador/RailQueueBoardAdmin";

vi.mock("@/features/rail-queue/useRealtimeBoardRefresh", () => ({ useRealtimeBoardRefresh: () => "connected" }));
vi.mock("@/lib/torreonLocalidad", () => ({ isTorreonLocalidadId: () => false }));
vi.mock("next/dynamic", () => ({ default: () => () => null }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } });
beforeEach(() => {
  invalidateCachedJson();
  localStorage.clear();
  localStorage.setItem("rail-queue:polling", "0");
  document.cookie = "locId=2; path=/";
  vi.stubGlobal("matchMedia", () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => {
  cleanup();
  invalidateCachedJson();
  document.cookie = "locId=; max-age=0; path=/";
  vi.unstubAllGlobals();
});

describe("administrator dashboard loading", () => {
  it("shows the selected patio without waiting for the catalog and does not fetch other patios", async () => {
    const catalog = deferred<Response>();
    const fetch = vi.fn(async (url: string) => {
      if (url.endsWith("/localidades")) return catalog.promise;
      return json([{ id: 12, localidadId: 2, rondaNumero: 1, orden: 1, concluido: false, movimiento: { id: 33, locomotiveNumber: 33, estado: "SOLICITADO" } }]);
    });
    vi.stubGlobal("fetch", fetch);
    render(<RailQueueBoardAdmin />);
    await screen.findAllByText("0033");
    expect(fetch.mock.calls.filter(([url]) => url.includes("/rondas"))).toEqual([
      ["/api/cliente/rondas?localidadId=2", expect.anything()],
    ]);
    catalog.resolve(json([{ id: 2, nombre: "Guadalajara" }, { id: 99, nombre: "Otro patio" }]));
    await screen.findByRole("option", { name: "Guadalajara (#2)" });
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Localidad" })).toHaveProperty("value", "2"));
    expect(fetch.mock.calls.filter(([url]) => url.includes("/rondas"))).toHaveLength(1);
  });

  it("keeps the previous movement visible and marks totals unavailable when refresh fails", async () => {
    let reads = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.endsWith("/localidades")) return json([{ id: 2, nombre: "Guadalajara" }]);
      if (reads++) return new Response("Unavailable", { status: 503 });
      return json([{ id: 12, localidadId: 2, rondaNumero: 1, orden: 1, concluido: false, movimiento: { id: 33, locomotiveNumber: 33 } }]);
    }));
    render(<RailQueueBoardAdmin />);
    await screen.findAllByText("0033");
    fireEvent.click(screen.getAllByRole("button", { name: "Actualizar" })[0]);
    await screen.findByRole("alert");
    expect(screen.getAllByText("0033").length).toBeGreaterThan(0);
    expect(screen.getByText("Totales no disponibles: hay localidades sin actualizar.")).toBeTruthy();
  });

  it("does not confuse movements from different patios when their upstream ids coincide", async () => {
    document.cookie = "locId=0; path=/";
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.endsWith("/localidades")) return json([{ id: 1, nombre: "Patio A" }, { id: 2, nombre: "Patio B" }]);
      const localidadId = Number(new URL(url, "https://test.local").searchParams.get("localidadId"));
      return json([{ id: 12, localidadId, rondaNumero: 1, orden: 1, concluido: false, movimiento: { id: 33, locomotiveNumber: localidadId } }]);
    }));
    render(<RailQueueBoardAdmin />);
    await screen.findByText("Locomotora 0001");
    await screen.findByText("Locomotora 0002");
  });
});
