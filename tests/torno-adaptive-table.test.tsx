// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TornoServiceTable from "@/features/torno/components/TornoServiceTable/TornoServiceTable";
import type { TornoHistoryItem } from "@/features/torno/lib/types";

vi.mock("@/features/capacitacion", () => ({ GuidedTarget: ({ children, as = "div", id, ...props }: { children: React.ReactNode; as?: React.ElementType; id: string }) => React.createElement(as, { ...props, "data-guide-id": id }, children) }));
const item: TornoHistoryItem = { id: 37, status: "EN_PROCESO", numeroLocomotora: "0123", companyName: "Empresa ferroviaria", localityName: "Guadalajara", date: "2026-09-09T10:00:00Z", work: { totalWheels: 4, completedWheels: 2, wheels: [], startAt: "2026-09-09T11:00:00Z" } };
let matches = false;
let listeners: Array<(event: { matches: boolean }) => void>;
beforeEach(() => {
  matches = false;
  listeners = [];
  vi.stubGlobal("React", React);
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches, addEventListener: (_: string, callback: (event: { matches: boolean }) => void) => listeners.push(callback), removeEventListener: (_: string, callback: (event: { matches: boolean }) => void) => { listeners = listeners.filter((entry) => entry !== callback); } })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const props = () => ({ items: [item], loading: false, refreshing: false, canViewDurations: false, onView: vi.fn(), onRefresh: vi.fn(), onPageChange: vi.fn(), meta: { page: 1, pageSize: 25, total: 26, totalPages: 2 } });

describe("adaptive Torno service list", () => {
  it("shows complete compact cards and opens the selected detail with one action", () => {
    const callbacks = props();
    render(<TornoServiceTable {...callbacks} />);
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByRole("list", { name: "Servicios de torno" })).toBeTruthy();
    expect(screen.getByText("Empresa ferroviaria")).toBeTruthy();
    expect(screen.getByText("Locomotora 0123")).toBeTruthy();
    expect(screen.getByText("Solicitud")).toBeTruthy();
    expect(screen.getByText("Inicio")).toBeTruthy();
    expect(screen.getByText("Fin")).toBeTruthy();
    expect(screen.queryByText("Tiempo")).toBeNull();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("50");
    fireEvent.click(screen.getByRole("button", { name: /Ver detalle de servicio/ }));
    expect(callbacks.onView).toHaveBeenCalledExactlyOnceWith(item);
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(callbacks.onPageChange).toHaveBeenCalledExactlyOnceWith(2);
  });

  it("mounts only one representation when resizing and preserves role-specific durations", () => {
    render(<TornoServiceTable {...props()} canViewDurations />);
    expect(screen.getByText("Tiempo")).toBeTruthy();
    act(() => { matches = true; listeners.forEach((listener) => listener({ matches })); });
    expect(screen.getByRole("table")).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Servicios de torno" })).toBeNull();
    expect(screen.getAllByRole("button", { name: /Ver detalle de servicio/ })).toHaveLength(1);
    act(() => { matches = false; listeners.forEach((listener) => listener({ matches })); });
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getAllByRole("button", { name: /Ver detalle de servicio/ })).toHaveLength(1);
  });

  it("uses compact loading placeholders and prevents pagination while loading", () => {
    render(<TornoServiceTable {...props()} loading />);
    expect(screen.getByRole("status", { name: "Cargando servicios de torno" })).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByRole("button", { name: /Ver detalle de servicio/ })).toBeNull();
    expect((screen.getByRole("button", { name: "Siguiente" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
