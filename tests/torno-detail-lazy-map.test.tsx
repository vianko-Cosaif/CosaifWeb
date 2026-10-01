// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import TornoServiceDetail from "@/features/torno/components/TornoServiceDetail/TornoServiceDetail";
import { getTornoPermissions } from "@/features/torno/lib/permissions";
import type { TornoHistoryItem } from "@/features/torno/lib/types";

const lazy = vi.hoisted(() => ({ loaded: vi.fn() }));
vi.mock("@/features/capacitacion", () => ({ GuidedTarget: ({ children, as = "div", id, ...props }: { children: React.ReactNode; as?: React.ElementType; id: string }) => React.createElement(as, { ...props, "data-guide-id": id }, children) }));
vi.mock("next/dynamic", async () => {
  const react = await import("react");
  return { default: (loader: () => Promise<{ default: React.ComponentType }>) => {
    const Lazy = react.lazy(loader);
    return function Deferred(props: object) { return react.createElement(react.Suspense, { fallback: react.createElement("span", null, "Cargando mapa") }, react.createElement(Lazy, props)); };
  } };
});
vi.mock("@/features/torno/components/TornoServiceDetail/GraphicWheelServiceMap", () => {
  lazy.loaded();
  return { default: () => <div>Mapa de prueba</div> };
});
beforeEach(() => vi.stubGlobal("React", React));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("loads the graphic map only when selected and unmounts it when returning to the wheel board", async () => {
  const item: TornoHistoryItem = { id: 37, status: "SOLICITADO", numeroLocomotora: "0123", companyName: "Empresa", work: { totalWheels: 4, completedWheels: 0, wheels: [] } };
  render(<TornoServiceDetail item={item} loading={false} permissions={getTornoPermissions("CLIENTE")} onBack={vi.fn()} onRefresh={vi.fn().mockResolvedValue(undefined)} />);
  expect(lazy.loaded).not.toHaveBeenCalled();
  expect(screen.queryByText("Mapa de prueba")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Mapa de ruedas" }));
  await screen.findByText("Mapa de prueba");
  expect(lazy.loaded).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", { name: "Tablero" }));
  expect(screen.queryByText("Mapa de prueba")).toBeNull();
  expect(screen.getByRole("button", { name: "Tablero" }).getAttribute("aria-pressed")).toBe("true");
});
