// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ThemeToggle from "@/components/ui/ThemeToggle/ThemeToggle";
import { THEME_STORAGE_KEY } from "@/lib/theme";

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("dark");
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
});
afterEach(() => {
  cleanup();
  document.documentElement.classList.remove("dark");
  vi.unstubAllGlobals();
});

function externalTheme(newValue: string | null, key: string | null = THEME_STORAGE_KEY) {
  fireEvent(window, new StorageEvent("storage", { key, newValue }));
}

function expectTheme(dark: boolean) {
  expect(document.documentElement.classList.contains("dark")).toBe(dark);
  expect(screen.getByRole("button").getAttribute("aria-pressed")).toBe(String(dark));
  expect(screen.getByRole("button").getAttribute("aria-label")).toBe(`Tema: ${dark ? "Oscuro" : "Claro"}`);
}

describe("theme toggle across tabs", () => {
  it("applies a saved preference without rewriting storage on mount", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    const write = vi.spyOn(Storage.prototype, "setItem");
    render(<ThemeToggle />);
    expectTheme(true);
    expect(write).not.toHaveBeenCalled();
  });

  it("keeps the document and button synchronized for external light and dark changes without circular writes", () => {
    const write = vi.spyOn(Storage.prototype, "setItem");
    render(<ThemeToggle />);
    expectTheme(false);
    externalTheme("dark");
    expectTheme(true);
    externalTheme("light");
    expectTheme(false);
    expect(write).not.toHaveBeenCalled();
  });

  it.each([
    { key: THEME_STORAGE_KEY, value: null, description: "removed preference" },
    { key: THEME_STORAGE_KEY, value: "unexpected", description: "invalid preference" },
    { key: null, value: null, description: "cleared storage" },
  ])("returns to the system preference for $description", ({ key, value }) => {
    localStorage.setItem(THEME_STORAGE_KEY, "light");
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })));
    const write = vi.spyOn(Storage.prototype, "setItem");
    render(<ThemeToggle />);
    expectTheme(false);
    externalTheme(value, key);
    expectTheme(true);
    expect(write).not.toHaveBeenCalled();
  });

  it("ignores unrelated storage keys and continues to persist direct user choices", () => {
    const write = vi.spyOn(Storage.prototype, "setItem");
    render(<ThemeToggle />);
    externalTheme("dark", "other-preference");
    expectTheme(false);
    expect(write).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button"));
    expectTheme(true);
    expect(write).toHaveBeenCalledExactlyOnceWith(THEME_STORAGE_KEY, "dark");
  });

  it("removes its storage listener when it unmounts", () => {
    const view = render(<ThemeToggle />);
    view.unmount();
    externalTheme("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});
