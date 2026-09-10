// @vitest-environment jsdom
import React, { StrictMode, act } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLocalStorageBoolean } from "@/features/rail-queue/hooks";

function Preference({ storageKey = "rail-queue:soundOn", initial = false }: { storageKey?: string; initial?: boolean }) {
  const [enabled, setEnabled] = useLocalStorageBoolean(storageKey, initial);
  return <button type="button" aria-pressed={enabled} onClick={() => setEnabled((value) => !value)}>{enabled ? "Activo" : "Inactivo"}</button>;
}
beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe("rail queue preferences", () => {
  it("hydrates the server HTML consistently and preserves a saved preference through Strict Mode", async () => {
    localStorage.setItem("rail-queue:soundOn", "1");
    const read = vi.spyOn(Storage.prototype, "getItem");
    const write = vi.spyOn(Storage.prototype, "setItem");
    const element = <StrictMode><Preference /></StrictMode>;
    const container = document.createElement("div");
    container.innerHTML = renderToString(element);
    document.body.appendChild(container);
    const originalButton = container.querySelector("button");
    expect(originalButton?.textContent).toBe("Inactivo");
    expect(read).not.toHaveBeenCalled();
    const recoverableError = vi.fn();
    let root!: Root;
    try {
      await act(async () => { root = hydrateRoot(container, element, { onRecoverableError: recoverableError }); });
      expect(container.querySelector("button")).toBe(originalButton);
      expect(originalButton?.textContent).toBe("Activo");
      expect(recoverableError).not.toHaveBeenCalled();
      expect(localStorage.getItem("rail-queue:soundOn")).toBe("1");
      expect(write.mock.calls.every(([, value]) => value === "1")).toBe(true);
    } finally {
      await act(async () => root?.unmount());
      container.remove();
    }
  });

  it("reads each new key before writing and does not copy the previous key's value", () => {
    localStorage.setItem("first", "1");
    localStorage.setItem("second", "0");
    const write = vi.spyOn(Storage.prototype, "setItem");
    const view = render(<Preference storageKey="first" />);
    expect(screen.getByRole("button").getAttribute("aria-pressed")).toBe("true");
    view.rerender(<Preference storageKey="second" />);
    expect(screen.getByRole("button").getAttribute("aria-pressed")).toBe("false");
    expect(write.mock.calls.filter(([key]) => key === "second")).toEqual([["second", "0"]]);
    fireEvent.click(screen.getByRole("button"));
    expect(localStorage.getItem("second")).toBe("1");
    expect(localStorage.getItem("first")).toBe("1");
  });

  it("keeps toggles usable without overwriting unreadable storage", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new DOMException("Blocked", "SecurityError"); });
    const write = vi.spyOn(Storage.prototype, "setItem");
    render(<Preference initial />);
    expect(screen.getByRole("button").getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("button").getAttribute("aria-pressed")).toBe("false");
    expect(write).not.toHaveBeenCalled();
  });

  it("retains changes in memory when reading works but persistence is blocked", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Full", "QuotaExceededError"); });
    render(<Preference />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("button").getAttribute("aria-pressed")).toBe("true");
  });
});
