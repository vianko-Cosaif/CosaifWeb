// @vitest-environment jsdom
import React, { useState } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import NaturalQueueTable from "@/features/torreon/naturales/components/NaturalQueueTable";
import type { QueueUnit } from "@/features/torreon/naturales/queueView";

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: false,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
    })),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const unit: QueueUnit = {
  id: 20,
  modalidad: "CONJUNTO",
  estado: "PENDIENTE",
  operadorId: null,
  disponible: true,
  posicion: 1,
  ordenManual: null,
  incidentes: [],
  movimientos: [101, 102].map((id) => ({
    id,
    empresaId: 3,
    empresaNombreSnapshot: "Empresa de prueba",
    locomotiveNumber: id + 7500,
    estado: "SOLICITADO",
    tipoMovimiento: "MD_TRABAJANDO",
    fechaSolicitud: "2026-10-13T14:00:00Z",
    viaOrigenNombreSnapshot: "Vía 29",
    viaDestinoNombreSnapshot: "Vía 3",
    poloOrigen: "NORTE",
    poloDestino: "CENTRO",
    seccionDestinoId: 91,
    seccionDestinoNumero: 2,
    seccionDestinoNombreSnapshot: "Taller",
    coordinador: { nombre: "Coordinador de prueba" },
    supervisor: { nombre: "Supervisor de prueba" },
    operador: { nombre: "Maquinista de prueba" },
    cliente: { nombre: "Cliente de prueba" },
    instrucciones: "Indicación de prueba",
  })),
};
const base = {
  units: [unit],
  dispatch: true,
  followUp: true,
  showFinish: true,
  showImages: true,
  showWaitTime: true,
  selected: [],
  onSelect: vi.fn(),
  operators: [{ id: 8, nombre: "Maquinista de prueba" }],
  busy: false,
  mutate: vi.fn(async () => {}),
  onHistory: vi.fn(),
};

it("uses the Guadalajara column order and opens the movement details from its row", () => {
  render(<NaturalQueueTable {...base} />);
  const record = within(screen.getByText("7601").closest("tr")!);
  const headers = screen.getAllByRole("columnheader").map((cell) => cell.textContent);
  expect(headers.slice(0, 12)).toEqual([
    "Fila",
    "Folio",
    "Locomotora",
    "Tipo",
    "Localidad",
    "Empresa",
    "Personal",
    "Origen",
    "Destino",
    "Solicitud",
    "Inicio",
    "Fin",
  ]);
  expect(screen.queryByRole("group", { name: "Presentación de movimientos" })).toBeNull();
  for (const text of [
    "Vía 29",
    "Vía 3",
    "Sección 2 · Taller",
    "Norte",
    "Centro",
    "Cliente de prueba",
    "Coordinador de prueba",
    "Supervisor de prueba",
    "Maquinista de prueba",
  ])
    expect(record.getByText(text)).toBeTruthy();
  expect(screen.getAllByRole("checkbox", { name: "Seleccionar unidad 20" })).toHaveLength(1);
  fireEvent.click(record.getByText("7601"));
  expect(screen.getByText("Indicación de prueba")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Ver historial de operación" }));
  expect(base.onHistory).toHaveBeenCalledWith(20);
});

it("keeps group selection separate from row expansion and preserves an assignment while collapsing details", () => {
  function Harness() {
    const [selected, setSelected] = useState<number[]>([]);
    return (
      <NaturalQueueTable
        {...base}
        selected={selected}
        onSelect={(id, checked) => setSelected(checked ? [id] : [])}
      />
    );
  }
  render(<Harness />);
  fireEvent.click(screen.getByLabelText("Seleccionar unidad 20"));
  fireEvent.click(screen.getByRole("button", { name: "Ver detalle del movimiento 101" }));
  fireEvent.change(screen.getByLabelText("Asignar unidad 20"), { target: { value: "8" } });
  fireEvent.click(screen.getByRole("button", { name: "Ver folio 101" }));
  expect(screen.queryByRole("combobox", { name: "Asignar unidad 20" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Ver folio 101" }));
  expect((screen.getByLabelText("Seleccionar unidad 20") as HTMLInputElement).checked).toBe(true);
  expect((screen.getByLabelText("Asignar unidad 20") as HTMLSelectElement).value).toBe("8");
  fireEvent.click(screen.getByRole("button", { name: "Asignar" }));
  expect(base.mutate).toHaveBeenCalledWith("/cola/20/asignar", { operadorId: 8 });
  expect(
    screen
      .getByRole("button", { name: "Ocultar detalle del movimiento 101" })
      .getAttribute("aria-expanded"),
  ).toBe("true");
  expect((screen.getByLabelText("Seleccionar unidad 20") as HTMLInputElement).checked).toBe(true);
});

it("preserves incident drafts when collapsing details and respects read-only access", () => {
  const stopped: QueueUnit = {
    ...unit,
    modalidad: "INDIVIDUAL",
    estado: "DETENIDA",
    movimientos: [{ ...unit.movimientos[0], estado: "DETENIDO" }],
    incidentes: [
      { id: 90, estado: "ABIERTO", motivo: "Vía ocupada", fechaInicio: "2026-10-13T14:10:00Z" },
    ],
  };
  const { rerender } = render(<NaturalQueueTable {...base} units={[stopped]} />);
  fireEvent.click(screen.getByRole("button", { name: "Ver incidentes del movimiento 101" }));
  const solution = screen.getByRole("textbox");
  fireEvent.change(solution, { target: { value: "Vía liberada" } });
  fireEvent.click(screen.getByRole("button", { name: "Ocultar detalle del movimiento 101" }));
  fireEvent.click(screen.getByRole("button", { name: "Ver incidentes del movimiento 101" }));
  expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("Vía liberada");
  fireEvent.click(screen.getByRole("button", { name: "Confirmar solución" }));
  expect(base.mutate).toHaveBeenCalledWith("/incidentes/90/resolver?tipo=NATURAL", {
    solucion: "Vía liberada",
  });
  rerender(
    <NaturalQueueTable
      {...base}
      units={[stopped]}
      dispatch={false}
      canResolveIncidents={false}
      showWaitTime={false}
    />,
  );
  {
    expect(screen.getByText("Incidente #90")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Confirmar solución" })).toBeNull();
    expect(screen.queryByRole("combobox", { name: "Asignar unidad 20" })).toBeNull();
    expect(screen.queryByText("Pausado hace")).toBeNull();
  }
});

it("leaves the operation screen on its existing table presentation", () => {
  render(<NaturalQueueTable {...base} followUp={false} />);
  expect(screen.getByRole("table")).toBeTruthy();
  expect(screen.queryByRole("group", { name: "Presentación de movimientos" })).toBeNull();
});

const visibleFolios = () =>
  screen
    .getAllByRole("button", { name: /^Ver folio \d+$/ })
    .map((button) => Number(button.getAttribute("aria-label")!.replace("Ver folio ", "")));
const manyUnits = (): QueueUnit[] =>
  Array.from({ length: 58 }, (_, index) => ({
    ...unit,
    id: index + 1,
    modalidad: "INDIVIDUAL",
    posicion: index + 1,
    movimientos: [{ ...unit.movimientos[0], id: index + 501 }],
  }));

it("orders all follow-up movements by descending folio before pagination, without mutating the operational queue", () => {
  const grouped = {
    ...unit,
    movimientos: [unit.movimientos[0], { ...unit.movimientos[0], id: 104 }],
  };
  const individual = {
    ...unit,
    id: 21,
    posicion: 2,
    modalidad: "INDIVIDUAL",
    movimientos: [unit.movimientos[1]],
  };
  const { rerender } = render(<NaturalQueueTable {...base} units={[individual, grouped]} />);
  expect(visibleFolios()).toEqual([104, 102, 101]);
  for (const [index, id] of [104, 102, 101].entries()) {
    const row = screen.getByRole("button", { name: `Ver folio ${id}` }).closest("tr")!;
    expect(within(row).getAllByRole("cell")[0].textContent).toContain(
      String(index + 1).padStart(2, "0"),
    );
  }
  expect(grouped.movimientos.map((movement) => movement.id)).toEqual([101, 104]);
  rerender(<NaturalQueueTable {...base} units={[individual, grouped]} followUp={false} />);
  expect(visibleFolios()).toEqual([102, 101, 104]);
});

it("paginates the full descending result with continuous row numbers and returns to page one when filters change", () => {
  const units = manyUnits();
  const { rerender } = render(<NaturalQueueTable {...base} units={units} paginationKey="all" />);
  expect(visibleFolios()).toEqual(Array.from({ length: 25 }, (_, i) => 558 - i));
  expect(screen.getAllByText("1–25 de 58 movimientos · Página 1 de 3")).toHaveLength(2);
  fireEvent.click(screen.getAllByTitle("Página siguiente")[0]);
  expect(visibleFolios()).toEqual(Array.from({ length: 25 }, (_, i) => 533 - i));
  const row = screen.getByRole("button", { name: "Ver folio 533" }).closest("tr")!;
  expect(within(row).getAllByRole("cell")[0].textContent).toBe("26");
  rerender(<NaturalQueueTable {...base} units={[...units].reverse()} paginationKey="all" />);
  expect(visibleFolios()[0]).toBe(533);
  fireEvent.click(screen.getAllByTitle("Página siguiente")[1]);
  expect(visibleFolios()).toEqual([508, 507, 506, 505, 504, 503, 502, 501]);
  expect(screen.getAllByText("51–58 de 58 movimientos · Página 3 de 3")).toHaveLength(2);
  rerender(<NaturalQueueTable {...base} units={units.slice(0, 51)} paginationKey="filtered" />);
  expect(visibleFolios()[0]).toBe(551);
  expect(screen.getAllByText("1–25 de 51 movimientos · Página 1 de 3")).toHaveLength(2);
});

it("keeps selection available for a group across pages and preserves its assignment draft", () => {
  const group = {
    ...unit,
    movimientos: manyUnits()
      .slice(0, 30)
      .map((item) => item.movimientos[0]),
  };
  render(<NaturalQueueTable {...base} units={[group]} />);
  expect(screen.getAllByRole("checkbox", { name: "Seleccionar unidad 20" })).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Ver folio 530" }));
  fireEvent.change(screen.getByLabelText("Asignar unidad 20"), { target: { value: "8" } });
  fireEvent.click(screen.getAllByTitle("Página siguiente")[0]);
  expect(screen.getAllByRole("checkbox", { name: "Seleccionar unidad 20" })).toHaveLength(1);
  fireEvent.click(screen.getByLabelText("Seleccionar unidad 20"));
  expect(base.onSelect).toHaveBeenCalledWith(20, true);
  fireEvent.click(screen.getAllByTitle("Página anterior")[0]);
  expect((screen.getByLabelText("Asignar unidad 20") as HTMLSelectElement).value).toBe("8");
});

it("clamps the current page when movements disappear during refresh", () => {
  const units = manyUnits();
  const { rerender } = render(<NaturalQueueTable {...base} units={units} />);
  fireEvent.click(screen.getAllByTitle("Página siguiente")[0]);
  fireEvent.click(screen.getAllByTitle("Página siguiente")[0]);
  rerender(<NaturalQueueTable {...base} units={units.slice(0, 28)} />);
  expect(visibleFolios()).toEqual([503, 502, 501]);
  expect(screen.getAllByText("26–28 de 28 movimientos · Página 2 de 2")).toHaveLength(2);
});
