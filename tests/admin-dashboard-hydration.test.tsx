// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RailQueueBoardAdmin from "@/features/rail-queue/administrador/RailQueueBoardAdmin";
import { useOnline } from "@/features/rail-queue/hooks";
import { invalidateCachedJson } from "@/lib/http/client";

vi.mock("@/features/rail-queue/useRealtimeBoardRefresh", () => ({ useRealtimeBoardRefresh: () => "connected" }));
vi.mock("@/lib/torreonLocalidad", () => ({ isTorreonLocalidadId: () => false }));
vi.mock("next/dynamic", () => ({ default: () => () => null }));
const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } });

beforeEach(() => {
  invalidateCachedJson();
  localStorage.clear();
  document.cookie = "locId=; max-age=0; path=/";
  vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(json([]))));
});
afterEach(() => { cleanup(); invalidateCachedJson(); vi.unstubAllGlobals(); });

function OnlineProbe() {
  const online = useOnline();
  return <output>{online ? "online" : "offline"}</output>;
}

describe("administrator dashboard hydration across server/browser navigator", () => {
  it.each([true, false])("hydrates the same DOM when Node navigator lacks onLine and browser online is %s", async (online) => {
    // Node 24 exposes navigator without navigator.onLine.
    vi.stubGlobal("navigator", { userAgent: "Node.js/24" });
    const container = document.createElement("div");
    container.innerHTML = renderToString(<RailQueueBoardAdmin />);
    document.body.appendChild(container);
    const initialHeading = container.querySelector("h1");
    vi.stubGlobal("navigator", { userAgent: "test-browser", onLine: online });
    const recoverableError = vi.fn();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    let root!: Root;
    try {
      await act(async () => { root = hydrateRoot(container, <RailQueueBoardAdmin />, { onRecoverableError: recoverableError }); });
      expect(recoverableError).not.toHaveBeenCalled();
      expect(consoleError).not.toHaveBeenCalled();
      expect(container.querySelector("h1")).toBe(initialHeading);
      expect(container.textContent?.includes("Sin conexión. La información puede haber cambiado.")).toBe(!online);
    } finally {
      await act(async () => root?.unmount());
      container.remove();
    }
  });

  it("synchronizes initial offline state and responds to connection events", () => {
    vi.stubGlobal("navigator", { onLine: false });
    render(<OnlineProbe />);
    expect(screen.getByText("offline")).toBeTruthy();
    fireEvent(window, new Event("online"));
    expect(screen.getByText("online")).toBeTruthy();
    fireEvent(window, new Event("offline"));
    expect(screen.getByText("offline")).toBeTruthy();
  });
});
