// @vitest-environment jsdom
import React, { lazy, Suspense, type ComponentType, type ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Tabla from "@/features/movimientos/list/Tabla";
import IncidentesTable from "@/features/incidentes/operacion/IncidentesTable";
import type { Movement } from "@/features/movimientos/list/useMovimientos";
import type { TablaProps } from "@/features/movimientos/list/table.types";

const mocks = vi.hoisted(() => ({ dynamicLoad: vi.fn(), table: vi.fn() }));

vi.mock("next/dynamic", () => ({
  default: (loader: () => Promise<{ default: ComponentType }>) => {
    const Component = lazy(() => { mocks.dynamicLoad(); return loader(); });
    return function Dynamic(props: Record<string, unknown>) {
      return <Suspense fallback={<div role="status">Cargando módulo</div>}><Component {...props} /></Suspense>;
    };
  },
}));
vi.mock("@/features/capacitacion", () => ({
  GuidedTarget: ({ as = "div", id, children, ...props }: { as?: string; id: string; children: ReactNode }) =>
    React.createElement(as, { ...props, "data-guide-id": id }, children),
}));
vi.mock("@/features/capacitacion/TrainingTourContext", () => ({
  useTrainingTour: () => ({ isTrainingMovement: () => false }),
}));
vi.mock("@/features/torno-measures", () => ({
  useTornoMeasuresModal: () => ({ measuresModal: { open: false }, openMeasuresModal: vi.fn(), closeMeasuresModal: vi.fn() }),
}));
vi.mock("antd/es/button", () => ({
  default: ({ children, onClick }: { children: ReactNode; onClick: React.MouseEventHandler<HTMLButtonElement> }) => <button onClick={onClick}>{children}</button>,
}));
vi.mock("antd/es/config-provider", () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("antd/es/empty", () => ({ default: () => <span>Vacío</span> }));

type DesktopTableProps = {
  dataSource: Movement[];
  rowKey: (movement: Movement) => string;
  columns: { key: string; title: ReactNode; dataIndex?: keyof Movement; render?: (value: unknown, row: Movement, index: number) => ReactNode }[];
  expandable: { expandedRowKeys: string[]; expandedRowRender: (row: Movement) => ReactNode };
  pagination: { current: number };
  onChange: (pagination: { current: number }, filters: object, sorter: { columnKey?: string; order?: string }, extra: { action: string }) => void;
};

vi.mock("antd/es/table", () => ({
  default: (props: DesktopTableProps) => {
    mocks.table(props);
    return <>
      <table aria-label="Movimientos de escritorio">
        <thead><tr>{props.columns.map(column => <th key={column.key}>{column.title}</th>)}</tr></thead>
        <tbody>{props.dataSource.map((row, index) => <React.Fragment key={props.rowKey(row)}>
          <tr>{props.columns.map(column => <td key={column.key}>{column.render?.(column.dataIndex ? row[column.dataIndex] : undefined, row, index)}</td>)}</tr>
          {props.expandable.expandedRowKeys.includes(props.rowKey(row)) ? <tr><td colSpan={props.columns.length}>{props.expandable.expandedRowRender(row)}</td></tr> : null}
        </React.Fragment>)}</tbody>
      </table>
      <button onClick={() => props.onChange(props.pagination, {}, { columnKey: "solicitud", order: "ascend" }, { action: "sort" })}>Ordenar solicitud</button>
      <button onClick={() => props.onChange({ current: props.pagination.current + 1 }, {}, {}, { action: "paginate" })}>Página siguiente escritorio</button>
    </>;
  },
}));

function viewport(initialWidth: number) {
  let width = initialWidth;
  const listeners = new Set<() => void>();
  vi.stubGlobal("matchMedia", vi.fn((query: string) => {
    const min = Number(query.match(/min-width:\s*(\d+)px/)?.[1]);
    const handlers = new Map<(event: MediaQueryListEvent) => void, () => void>();
    return {
      get matches() { return width >= min; },
      addEventListener: (_event: string, handler: (event: MediaQueryListEvent) => void) => {
        const notify = () => handler({ matches: width >= min } as MediaQueryListEvent);
        handlers.set(handler, notify); listeners.add(notify);
      },
      removeEventListener: (_event: string, handler: (event: MediaQueryListEvent) => void) => {
        const notify = handlers.get(handler);
        if (notify) listeners.delete(notify);
      },
    };
  }));
  return { resize: (next: number) => act(() => { width = next; listeners.forEach(notify => notify()); }), listeners };
}

const movement = (id: number, overrides: Partial<Movement> = {}): Movement => ({
  id, idTecnico: id + 1000, folioLocalidadLabel: `#${id}`, locomotora: "0123", localidadId: 1, localidadNombre: "Guadalajara",
  viaOrigen: "Vía 3", viaDestino: "Vía 5", tipoAccion: "MOVER", tipoMovimiento: "NORMAL", prioridad: "BAJA", estado: "SOLICITADO",
  clienteId: 11, supervisorId: 12, coordinadorId: 13, operadorId: 14, maquinistaId: 15, empresaId: 3, empresaNombre: "Empresa propia",
  clienteNombre: "Nombre privado cliente", supervisorNombre: "Nombre privado supervisor", operadorNombre: "Nombre privado operador", maquinistaNombre: "Nombre privado maquinista",
  fechaSolicitud: "2026-09-09T12:00:00Z", fechaInicio: "2026-09-09T12:01:00Z", fechaFin: "2026-09-09T12:04:00Z",
  instrucciones: "Revisar la vía antes de continuar", incidenteGlobal: false, finalizado: false, lavado: true, torno: false,
  posicionCabina: "NORTE", posicionChimenea: "SUR", direccionEmpuje: "NORTE", ...overrides,
});
const tablaProps = (overrides: Partial<TablaProps> = {}): TablaProps => ({
  filas: [movement(1)], pagina: 2, tamPagina: 20, total: 60, campoOrden: "id", direccionOrden: "desc",
  onPagina: vi.fn(), onOrden: vi.fn(), onEditar: vi.fn(), rol: "CLIENTE", ...overrides,
});

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("responsive operational list rendering", () => {
  it("does not load desktop dependencies or hidden details on mobile/tablet and preserves expansion and page after resizing", async () => {
    const media = viewport(390);
    const props = tablaProps();
    const view = render(<Tabla {...props} />);
    expect(mocks.dynamicLoad).not.toHaveBeenCalled();
    expect(mocks.table).not.toHaveBeenCalled();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByText("Personal Asignado")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ver detalles del movimiento #1" }));
    expect(screen.getByText("Personal Asignado")).toBeTruthy();
    expect(screen.queryByText(/Nombre privado/)).toBeNull();
    expect(screen.queryByText("Resolución")).toBeNull();
    media.resize(1024);
    expect(mocks.dynamicLoad).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Ocultar detalles del movimiento #1" }).getAttribute("aria-expanded")).toBe("true");

    media.resize(1440);
    await screen.findByRole("table", { name: "Movimientos de escritorio" });
    expect(mocks.dynamicLoad).toHaveBeenCalledOnce();
    expect(screen.getAllByRole("button", { name: "Ocultar detalles del movimiento #1" })).toHaveLength(1);
    expect(screen.getAllByText("Personal Asignado")).toHaveLength(1);
    expect(screen.queryByText(/Nombre privado/)).toBeNull();
    expect(screen.queryByRole("columnheader", { name: "Resolución" })).toBeNull();
    expect((mocks.table.mock.lastCall?.[0] as DesktopTableProps).pagination.current).toBe(2);

    media.resize(800);
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByRole("button", { name: "Ocultar detalles del movimiento #1" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Página 2" }).getAttribute("aria-current")).toBe("page");
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    expect(props.onEditar).toHaveBeenCalledWith(1001);
    expect(screen.getByRole("button", { name: "Ocultar detalles del movimiento #1" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ocultar detalles del movimiento #1" }));
    expect(screen.queryByText("Personal Asignado")).toBeNull();
    view.unmount();
    expect(media.listeners.size).toBe(0);
  });

  it("keeps row permissions, technical edit IDs, sorting and pagination in the deferred desktop table", async () => {
    const media = viewport(1440);
    const props = tablaProps({
      rol: "ADMINISTRADOR",
      filas: [movement(1), movement(2, { empresaId: 4 }), movement(3, { estado: "EN_PROCESO" })],
      puedeEditarFila: row => row.empresaId === 3,
    });
    render(<Tabla {...props} />);
    const desktop = await screen.findByRole("table");
    expect(within(desktop).getAllByRole("button", { name: "Editar" })).toHaveLength(1);
    expect(within(desktop).getAllByText("No editable")).toHaveLength(2);
    expect(within(desktop).getByRole("columnheader", { name: "Resolución" })).toBeTruthy();
    expect(within(desktop).getAllByText("Nombre privado supervisor")).toHaveLength(3);
    fireEvent.click(within(desktop).getByRole("button", { name: "Editar" }));
    expect(props.onEditar).toHaveBeenCalledWith(1001);
    fireEvent.click(screen.getByRole("button", { name: "Ordenar solicitud" }));
    expect(props.onOrden).toHaveBeenCalledWith("solicitud", "asc");
    expect(props.onPagina).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Página siguiente escritorio" }));
    expect(props.onPagina).toHaveBeenCalledWith(3);
    fireEvent.click(within(desktop).getByRole("button", { name: "Ver detalles del movimiento #1" }));
    expect(screen.getByRole("button", { name: "Ocultar detalles del movimiento #1" }).getAttribute("aria-expanded")).toBe("true");
    expect(screen.getAllByText("Personal Asignado")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Ocultar detalles del movimiento #1" }));
    expect(screen.queryByText("Personal Asignado")).toBeNull();
    media.resize(390);
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getAllByRole("button", { name: "Editar" })).toHaveLength(1);
    expect(screen.getAllByText("No editable")).toHaveLength(2);
  });

  it("mounts incidents as cards on tablet, keeps dates and detail actions, and never duplicates rows on resize", async () => {
    const media = viewport(1024);
    const row = { id: 21, descripcion: "Revisión de acoplamiento", fecha: "9 sep 2026, 11:30 a.m.", estatus: "Abierto", localidad: "Guadalajara", empresa: "Empresa propia", locomotora: "0123", origen: "Vía 3", destino: "Vía 5", tipoIncidente: "Operación" };
    const onRowPress = vi.fn();
    const onPageChange = vi.fn();
    const view = render(<IncidentesTable data={[row]} onRowPress={onRowPress} onPageChange={onPageChange} meta={{ page: 2, totalPages: 3, total: 60, pageSize: 20 }} />);
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getAllByText(row.descripcion)).toHaveLength(1);
    expect(screen.getByText(row.fecha)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ver incidente 21 de Guadalajara" }));
    expect(onRowPress).toHaveBeenLastCalledWith(row);
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(onPageChange).toHaveBeenCalledWith(3);
    media.resize(1440);
    await waitFor(() => expect(screen.getByRole("table")).toBeTruthy());
    expect(screen.queryByRole("button", { name: "Ver incidente 21 de Guadalajara" })).toBeNull();
    expect(screen.getAllByText(row.descripcion)).toHaveLength(1);
    expect(screen.getAllByText(row.fecha)).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Abrir incidente 21" }));
    expect(onRowPress).toHaveBeenLastCalledWith(row);
    media.resize(390);
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByRole("button", { name: "Ver incidente 21 de Guadalajara" })).toBeTruthy();
    view.unmount();
    expect(media.listeners.size).toBe(0);
  });
});
