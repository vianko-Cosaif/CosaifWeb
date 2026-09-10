// @vitest-environment jsdom
import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import DeferredTerminalQueueTable from "@/features/rail-queue/coordinador/DeferredTerminalQueueTable";

vi.mock("next/dynamic", () => ({ default: () => () => <div>Tabla cargada</div> }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("desktop rounds table loading", () => {
  it("does not load the hidden desktop table on mobile", () => {
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener, removeEventListener })));
    const observe = vi.fn();
    vi.stubGlobal("IntersectionObserver", class { observe = observe; disconnect = vi.fn(); });
    const view = render(<DeferredTerminalQueueTable items={[]} info={{}} loading={false} onViewMeasures={vi.fn()} />);
    expect(screen.queryByText("Tabla cargada")).toBeNull();
    expect(observe).not.toHaveBeenCalled();
    view.unmount();
    expect(removeEventListener).toHaveBeenCalledOnce();
  });

  it("loads once the desktop table approaches the viewport and disconnects its observer", () => {
    let intersect!: (entries: { isIntersecting: boolean }[]) => void;
    const disconnect = vi.fn();
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    vi.stubGlobal("IntersectionObserver", class { constructor(callback: typeof intersect) { intersect = callback; } observe = vi.fn(); disconnect = disconnect; });
    render(<DeferredTerminalQueueTable items={[]} info={{}} loading={false} onViewMeasures={vi.fn()} />);
    expect(screen.queryByText("Tabla cargada")).toBeNull();
    act(() => intersect([{ isIntersecting: true }]));
    expect(screen.getByText("Tabla cargada")).toBeTruthy();
    expect(disconnect).toHaveBeenCalledOnce();
  });
});
