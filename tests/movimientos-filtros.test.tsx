// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Filtros, { type FiltrosProps } from "@/features/movimientos/list/Filtros";

beforeEach(() => {
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function mobileViewport() {
  let onChange: ((event: MediaQueryListEvent) => void) | undefined;
  vi.stubGlobal("matchMedia", vi.fn(() => ({
    matches: false,
    addEventListener: (_type: string, listener: typeof onChange) => { onChange = listener; },
    removeEventListener: vi.fn(),
  })));
  return (desktop: boolean) => act(() => onChange?.({ matches: desktop } as MediaQueryListEvent));
}

function props(overrides: Partial<FiltrosProps> = {}): FiltrosProps {
  return {
    filtros: { empresaId: 3, localidadId: 2, tamPagina: 25, fechaCampo: "solicitud" },
    listaEmpresas: [{ id: 3, nombre: "Empresa actual" }, { id: 4, nombre: "Otra empresa" }],
    listaLocalidades: [{ id: 2, nombre: "Patio actual" }],
    puedeElegirLocalidad: true,
    onCambiarEmpresaId: vi.fn(),
    onCambiarLocalidadId: vi.fn(),
    onCambiarRangoFechas: vi.fn(),
    onCambiarEstado: vi.fn(),
    onCambiarPrioridad: vi.fn(),
    onCambiarLocomotiveNumber: vi.fn(),
    onCambiarFechaCampo: vi.fn(),
    onCambiarTamPagina: vi.fn(),
    onLimpiarFiltros: vi.fn(),
    ...overrides,
  };
}

describe("movement filters", () => {
  it("collapses mobile filters when only locked scopes are active and preserves the user's expansion across resize", () => {
    const resize = mobileViewport();
    const options = props({ puedeElegirEmpresa: false, puedeElegirLocalidad: false });
    const view = render(<Filtros {...options} />);
    expect(screen.getByRole("button", { name: "Mostrar filtros de movimientos" }).getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("combobox", { name: "Empresa" })).toBeNull();
    expect(screen.getByText("Empresa: Empresa actual").textContent).toContain("fijo");
    expect(screen.getByText("Localidad: Patio actual").textContent).toContain("fijo");
    fireEvent.click(screen.getByRole("button", { name: "Mostrar filtros de movimientos" }));
    view.rerender(<Filtros {...options} listaEmpresas={[...options.listaEmpresas]} />);
    expect(screen.getByRole("button", { name: "Ocultar filtros de movimientos" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ocultar filtros de movimientos" }));
    resize(true);
    expect(screen.getByRole("button", { name: "Mostrar filtros de movimientos" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Mostrar filtros de movimientos" }));
    resize(false);
    expect(screen.getByRole("combobox", { name: "Empresa" })).toBeTruthy();
  });

  it("opens desktop filters even when the assigned company and locality are the only scopes", () => {
    render(<Filtros {...props({ puedeElegirEmpresa: false, puedeElegirLocalidad: false })} />);
    expect(screen.getByRole("button", { name: "Ocultar filtros de movimientos" }).getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("combobox", { name: "Empresa" })).toBeTruthy();
  });

  it("opens mobile filters for restored manual criteria and reopens them when training starts", () => {
    mobileViewport();
    const options = props({ puedeElegirEmpresa: false, puedeElegirLocalidad: false, filtros: { tamPagina: 25, estado: "SOLICITADO" } });
    const view = render(<Filtros {...options} />);
    expect(screen.getByRole("button", { name: "Estado" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ocultar filtros de movimientos" }));
    view.rerender(<Filtros {...options} filtros={{ ...options.filtros, locomotiveNumber: "0123" }} />);
    expect(screen.getByRole("button", { name: "Mostrar filtros de movimientos" })).toBeTruthy();
    expect(screen.getByText("Locomotora: 0123")).toBeTruthy();
    view.rerender(<Filtros {...options} expandirPorCapacitacion />);
    expect(screen.getByRole("button", { name: "Ocultar filtros de movimientos" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Estado" })).toBeTruthy();
  });

  it("allows choosing and clearing company filters when the company is editable", () => {
    const options = props();
    render(<Filtros {...options} />);
    const company = screen.getByRole("combobox", { name: "Empresa" });
    expect((company as HTMLSelectElement).disabled).toBe(false);
    expect(within(company).getByRole("option", { name: "Todas" })).toBeTruthy();
    fireEvent.change(company, { target: { value: "4" } });
    expect(options.onCambiarEmpresaId).toHaveBeenCalledWith(4);
    fireEvent.click(screen.getByRole("button", { name: "Ocultar filtros de movimientos" }));
    fireEvent.click(screen.getByRole("button", { name: "Quitar filtro Empresa: Empresa actual" }));
    expect(options.onCambiarEmpresaId).toHaveBeenLastCalledWith(null);
  });

  it("keeps an assigned company locked in both the select and collapsed chip", () => {
    const options = props({ puedeElegirEmpresa: false });
    render(<Filtros {...options} />);
    const company = screen.getByRole("combobox", { name: "Empresa" });
    expect((company as HTMLSelectElement).disabled).toBe(true);
    expect(within(company).queryByRole("option", { name: "Todas" })).toBeNull();
    fireEvent.change(company, { target: { value: "4" } });
    expect(options.onCambiarEmpresaId).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Ocultar filtros de movimientos" }));
    expect(screen.getByText("Empresa: Empresa actual").textContent).toContain("fijo");
    expect(screen.queryByRole("button", { name: /Quitar filtro Empresa/ })).toBeNull();
  });

  it("shows the assigned company id while its catalog is unavailable", () => {
    render(<Filtros {...props({ puedeElegirEmpresa: false, listaEmpresas: [] })} />);
    const company = screen.getByRole("combobox", { name: "Empresa" }) as HTMLSelectElement;
    expect(company.value).toBe("3");
    expect(within(company).getByRole("option", { name: "Empresa #3" })).toBeTruthy();
  });

  it.each([
    { ambito: "actuales" as const, expected: ["SOLICITADO", "EN PROCESO", "ESPERA"], excluded: "DETENIDO" },
    { ambito: "pasados" as const, expected: ["DETENIDO", "CANCELADO", "CONCLUIDO"], excluded: "SOLICITADO" },
  ])("only offers states compatible with $ambito", ({ ambito, expected, excluded }) => {
    const options = props({ ambito, filtros: { tamPagina: 25, estado: excluded } });
    render(<Filtros {...options} />);
    fireEvent.click(screen.getByRole("button", { name: "Estado" }));
    const choices = screen.getByRole("group", { name: "Estados de movimientos" });
    expect(within(choices).getAllByRole("checkbox").map(input => input.closest("label")?.textContent)).toEqual(expected);
    expect(within(choices).queryByRole("checkbox", { name: excluded })).toBeNull();
    fireEvent.click(within(choices).getByRole("checkbox", { name: expected[0] }));
    expect(options.onCambiarEstado).toHaveBeenCalledWith(expected[0]);
  });

  it("allows stopped and scheduled rounds in the shared current queue and clears them when returning to generic current movements", () => {
    const onChange = vi.fn();
    function Harness({ shared }: { shared: boolean }) {
      const [estado, setEstado] = React.useState<string | null>(null);
      return <Filtros {...props()} ambito="actuales" actualesCompartidos={shared}
        filtros={{ tamPagina: 25, estado }}
        onCambiarEstado={value => { onChange(value); setEstado(value); }} />;
    }
    const view = render(<Harness shared />);
    fireEvent.click(screen.getByRole("button", { name: "Estado" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "DETENIDO" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "AGENDADO" }));
    expect(onChange).toHaveBeenLastCalledWith("DETENIDO,AGENDADO");
    expect((screen.getByRole("checkbox", { name: "DETENIDO" }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("checkbox", { name: "AGENDADO" }) as HTMLInputElement).checked).toBe(true);
    view.rerender(<Harness shared={false} />);
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(screen.queryByRole("checkbox", { name: "DETENIDO" })).toBeNull();
    expect(screen.queryByRole("checkbox", { name: "AGENDADO" })).toBeNull();
    expect(screen.getByRole("button", { name: "Estado" }).textContent).toBe("Todos");
  });

  it("constrains date fields and keeps an invalid range notice visible when collapsed", () => {
    const options = props({ filtros: { tamPagina: 25, desde: "2026-09-08T12:00", hasta: "2026-09-08T10:00" } });
    const view = render(<Filtros {...options} />);
    const from = screen.getByLabelText("Desde (fecha/hora)") as HTMLInputElement;
    const to = screen.getByLabelText("Hasta (fecha/hora)") as HTMLInputElement;
    expect(from.max).toBe("2026-09-08T10:00");
    expect(to.min).toBe("2026-09-08T12:00");
    expect(from.getAttribute("aria-invalid")).toBe("true");
    expect(to.getAttribute("aria-describedby")).toBe(screen.getByRole("alert").id);
    fireEvent.change(to, { target: { value: "2026-09-08T13:00" } });
    expect(options.onCambiarRangoFechas).toHaveBeenCalledWith("2026-09-08T12:00", "2026-09-08T13:00");
    fireEvent.click(screen.getByRole("button", { name: "Ocultar filtros de movimientos" }));
    expect(screen.getByRole("alert").textContent).toContain("La fecha desde no puede ser posterior");
    view.rerender(<Filtros {...options} filtros={{ ...options.filtros, hasta: "2026-09-08T13:00" }} />);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(from.getAttribute("aria-invalid")).toBe("false");
  });

  it("removes collapsed panels from keyboard interaction and closes the state overlay", () => {
    render(<Filtros {...props()} />);
    const toggle = screen.getByRole("button", { name: "Ocultar filtros de movimientos" });
    const panel = document.getElementById(toggle.getAttribute("aria-controls")!)!;
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Estado" }));
    expect(screen.getByRole("group", { name: "Estados de movimientos" })).toBeTruthy();
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(panel.hasAttribute("inert")).toBe(true);
    expect(panel.getAttribute("aria-hidden")).toBe("true");
    expect(screen.queryByRole("combobox", { name: "Empresa" })).toBeNull();
    expect(screen.queryByRole("group", { name: "Estados de movimientos", hidden: true })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Mostrar filtros de movimientos" }));
    expect(panel.hasAttribute("inert")).toBe(false);
    expect(screen.getByRole("combobox", { name: "Empresa" })).toBeTruthy();
  });

  it("supports Escape in the state picker and removes closed advanced controls", () => {
    render(<Filtros {...props()} />);
    const stateToggle = screen.getByRole("button", { name: "Estado" });
    fireEvent.click(stateToggle);
    const requested = screen.getByRole("checkbox", { name: "SOLICITADO" });
    requested.focus();
    fireEvent.keyDown(requested, { key: "Escape" });
    expect(screen.queryByRole("checkbox", { name: "SOLICITADO" })).toBeNull();
    expect(document.activeElement).toBe(stateToggle);
    expect(stateToggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByLabelText("Prioridad")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Mostrar filtros avanzados" }));
    expect(screen.getByRole("combobox", { name: "Prioridad" })).toBeTruthy();
    const pageSize = screen.getByRole("combobox", { name: "Por página" });
    expect(within(pageSize).getAllByRole("option").map(option => option.textContent)).toEqual(["10", "25", "50"]);
    fireEvent.click(screen.getByRole("button", { name: "Ocultar filtros avanzados" }));
    expect(screen.queryByLabelText("Prioridad")).toBeNull();
  });
});
