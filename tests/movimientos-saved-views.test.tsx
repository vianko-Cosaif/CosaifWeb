// @vitest-environment jsdom
import React, { useState } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SavedViews from "@/features/movimientos/list/SavedViews";
import type { Ambito, FiltrosMovimientos } from "@/features/movimientos/list/useMovimientos";
import type { MovementView } from "@/features/movimientos/list/views";

const owner = vi.hoisted(() => ({ value: "synthetic-owner-a" as string | null }));
vi.mock("@/lib/auth/storageScope", () => ({ currentStorageScope: () => owner.value }));

const storageKey = (value = "synthetic-owner-a") => `cosaif:movement-views:${value}`;
const defaults: FiltrosMovimientos = { pagina: 1, tamPagina: 25, campoOrden: "id", direccionOrden: "desc", busqueda: "" };
const firstView: MovementView = { ambito: "pasados", filtros: { busqueda: "consulta anterior", empresaId: 3, localidadId: 1, pagina: 2 } };
const secondView: MovementView = { ambito: "actuales", filtros: { busqueda: "consulta elegida", localidadId: 1, pagina: 1 } };

function Fixture({ onApply, version = 0 }: { onApply: (view: MovementView) => void; version?: number }) {
  const [query, setQuery] = useState<{ ambito: Ambito; filtros: FiltrosMovimientos }>({ ambito: "actuales", filtros: defaults });
  return <>
    <div data-testid="query">{JSON.stringify(query)}</div>
    <span>{version}</span>
    <SavedViews filtros={query.filtros} ambito={query.ambito} onApply={view => {
      onApply(view);
      setQuery({ ambito: view.ambito, filtros: { ...defaults, ...view.filtros } });
    }} />
    <button onClick={() => setQuery({ ambito: "actuales", filtros: { ...defaults, busqueda: "filtro manual" } })}>Cambiar consulta</button>
  </>;
}
const currentQuery = () => JSON.parse(screen.getByTestId("query").textContent || "{}");
const openControls = () => fireEvent.click(screen.getByRole("button", { name: "Mostrar vistas guardadas" }));

beforeEach(() => {
  vi.useFakeTimers();
  owner.value = "synthetic-owner-a";
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState(null, "", "/cliente/movimientos");
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("saved movement views", () => {
  it.each(["url", "session"] as const)("restores the %s view once despite new callback identities and filter renders", (source) => {
    if (source === "url") {
      const query = new URLSearchParams({ vista: JSON.stringify(firstView) });
      window.history.replaceState(null, "", `/cliente/movimientos?${query}`);
    } else {
      sessionStorage.setItem(`${storageKey()}:last`, JSON.stringify(firstView));
    }
    const onApply = vi.fn();
    const view = render(<Fixture onApply={onApply} />);
    expect(screen.getByRole("button", { name: "Mostrar vistas guardadas" }).getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("combobox", { name: "Vistas guardadas" })).toBeNull();
    expect(onApply).toHaveBeenCalledOnce();
    expect(currentQuery()).toMatchObject(firstView);
    view.rerender(<Fixture onApply={onApply} version={1} />);
    fireEvent.click(screen.getByRole("button", { name: "Cambiar consulta" }));
    expect(currentQuery()).toMatchObject({ ambito: "actuales", filtros: { busqueda: "filtro manual" } });
    act(() => vi.advanceTimersByTime(350));
    expect(onApply).toHaveBeenCalledOnce();
    expect(JSON.parse(sessionStorage.getItem(`${storageKey()}:last`) || "{}")).toMatchObject({ ambito: "actuales", filtros: { busqueda: "filtro manual" } });
  });

  it("keeps the newly selected saved view instead of restoring the previous last view after applying it", () => {
    sessionStorage.setItem(`${storageKey()}:last`, JSON.stringify(firstView));
    localStorage.setItem(storageKey(), JSON.stringify([
      { id: "old", name: "Anterior", view: firstView },
      { id: "new", name: "Elegida", view: secondView },
    ]));
    const onApply = vi.fn();
    const view = render(<Fixture onApply={onApply} />);
    expect(onApply).toHaveBeenCalledOnce();
    openControls();
    fireEvent.change(screen.getByRole("combobox", { name: "Vistas guardadas" }), { target: { value: "new" } });
    expect(onApply).toHaveBeenCalledTimes(2);
    expect(onApply).toHaveBeenLastCalledWith(secondView);
    expect(currentQuery()).toMatchObject(secondView);
    view.rerender(<Fixture onApply={onApply} version={2} />);
    act(() => vi.advanceTimersByTime(350));
    expect(onApply).toHaveBeenCalledTimes(2);
    expect(currentQuery()).toMatchObject(secondView);
    expect((screen.getByRole("combobox", { name: "Vistas guardadas" }) as HTMLSelectElement).value).toBe("new");
    expect(JSON.parse(sessionStorage.getItem(`${storageKey()}:last`) || "{}")).toMatchObject(secondView);
  });

  it("replaces the previous owner's saved views and clears the selection when the account changes", () => {
    localStorage.setItem(storageKey(), JSON.stringify([{ id: "old", name: "Vista cuenta A", view: firstView }]));
    localStorage.setItem(storageKey("synthetic-owner-b"), JSON.stringify([{ id: "new", name: "Vista cuenta B", view: secondView }]));
    const onApply = vi.fn();
    render(<Fixture onApply={onApply} />);
    openControls();
    fireEvent.change(screen.getByRole("combobox", { name: "Vistas guardadas" }), { target: { value: "old" } });
    expect(screen.getByRole("button", { name: "Quitar vista" })).toBeTruthy();
    act(() => {
      owner.value = "synthetic-owner-b";
      window.dispatchEvent(new StorageEvent("storage"));
    });
    const selector = screen.getByRole("combobox", { name: "Vistas guardadas" }) as HTMLSelectElement;
    expect(within(selector).queryByRole("option", { name: "Vista cuenta A" })).toBeNull();
    expect(within(selector).getByRole("option", { name: "Vista cuenta B" })).toBeTruthy();
    expect(selector.value).toBe("");
    expect(screen.queryByRole("button", { name: "Quitar vista" })).toBeNull();
    act(() => {
      owner.value = null;
      window.dispatchEvent(new Event("cosaif:session-ended"));
    });
    expect(within(selector).getAllByRole("option")).toHaveLength(1);
    fireEvent.change(screen.getByRole("textbox", { name: "Nombre de la vista" }), { target: { value: "Prueba" } });
    expect((screen.getByRole("button", { name: "Guardar vista" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("handles malformed stored views without crashing or applying an invalid query", () => {
    localStorage.setItem(storageKey(), "{broken-json");
    sessionStorage.setItem(`${storageKey()}:last`, "not-a-view");
    const onApply = vi.fn();
    render(<Fixture onApply={onApply} />);
    expect(onApply).not.toHaveBeenCalled();
    expect(screen.getByRole("status").textContent).toContain("No se pudieron recuperar las vistas");
    openControls();
    expect(within(screen.getByRole("combobox", { name: "Vistas guardadas" })).getAllByRole("option")).toHaveLength(1);
    expect(currentQuery()).toEqual({ ambito: "actuales", filtros: defaults });
  });

  it("keeps restoration and query persistence active while the controls are collapsed and preserves an unfinished view name", () => {
    sessionStorage.setItem(`${storageKey()}:last`, JSON.stringify(firstView));
    const onApply = vi.fn();
    render(<Fixture onApply={onApply} />);
    expect(onApply).toHaveBeenCalledOnce();
    const toggle = screen.getByRole("button", { name: "Mostrar vistas guardadas" });
    const panel = document.getElementById(toggle.getAttribute("aria-controls")!)!;
    expect(panel.hidden).toBe(true);
    expect(screen.queryByRole("textbox", { name: "Nombre de la vista" })).toBeNull();
    openControls();
    fireEvent.change(screen.getByRole("textbox", { name: "Nombre de la vista" }), { target: { value: "Mi consulta" } });
    fireEvent.click(screen.getByRole("button", { name: "Ocultar vistas guardadas" }));
    expect(panel.hidden).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Cambiar consulta" }));
    act(() => vi.advanceTimersByTime(350));
    expect(JSON.parse(sessionStorage.getItem(`${storageKey()}:last`) || "{}").filtros.busqueda).toBe("filtro manual");
    expect(JSON.parse(new URLSearchParams(window.location.search).get("vista") || "{}").filtros.busqueda).toBe("filtro manual");
    openControls();
    expect((screen.getByRole("textbox", { name: "Nombre de la vista" }) as HTMLInputElement).value).toBe("Mi consulta");
    expect(onApply).toHaveBeenCalledOnce();
  });
});
