// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ClientsPage from "@/features/comercial/pages/clientes";
import ContractsPage from "@/features/comercial/pages/contratos";
import type { Contract, CrmClient } from "@/features/comercial/types";
import { commercialApi } from "@/features/comercial/lib/api";

const state = vi.hoisted(() => ({ clients: [] as CrmClient[], contracts: [] as Contract[], loading: false, reload: vi.fn() }));
vi.mock("@/features/comercial/lib/useCrmList", () => ({
  useCrmList: (path: string) => ({ items: path.includes("/contratos") ? state.contracts : state.clients, loading: state.loading, error: "", reload: state.reload, page: 1, setPage: vi.fn(), meta: { page: 1, totalPages: 1, total: 2 } }),
  useCrmCatalog: () => ({ items: state.clients, loading: false, error: "", reload: vi.fn() }),
}));
vi.mock("@/features/comercial/components/CommercialDataProvider", () => ({
  useCommercialData: () => ({ analytics: { catalogs: { companies: [], localities: [] } }, catalogs: { companies: [], localities: [] } }),
}));
vi.mock("@/features/comercial/lib/api", async original => ({ ...await original<object>(), commercialApi: vi.fn() }));

const client = (id: number, empresaNombre: string): CrmClient => ({ id, empresaId: id, empresaNombre, razonSocial: null, rfc: null, moneda: "MXN", diasCredito: 30, correoFacturacion: null, correoCobranza: null, requiereOrdenCompra: false, notas: null, activo: true, contactos: [] });
const contract = (id: number, nombre: string, estado: Contract["estado"] = "VIGENTE", fechaFin: string | null = "2099-12-31"): Contract => ({ id, nombre, estado, fechaFin, fechaInicio: "2020-01-01", clienteComercialId: 1, folio: `F-${id}`, ordenCompra: null, moneda: "MXN", montoMaximo: null, diaCorte: 31, documentoUrl: null, notas: null, cliente: { id: 1, empresaId: 1, empresaNombre: "Empresa uno" } });

beforeEach(() => {
  state.clients = [client(1, "Café del patio"), client(2, "Empresa dos")];
  state.contracts = [contract(1, "Contrato vigente"), contract(2, "Contrato cancelado", "CANCELADO"), contract(3, "Contrato vencido", "VIGENTE", "2000-01-01")];
  state.loading = false;
  state.reload.mockClear();
  vi.mocked(commercialApi).mockResolvedValue({});
});
afterEach(cleanup);

describe("acciones comerciales después de adaptar el listado", () => {
  it("conserva foco y texto del buscador mientras carga una búsqueda", () => {
    const view = render(<ClientsPage />);
    const search = screen.getByRole("textbox", { name: "Buscar cliente o RFC" });
    search.focus();
    fireEvent.change(search, { target: { value: "Café" } });
    state.loading = true;
    view.rerender(<ClientsPage />);
    expect(screen.getByRole("textbox", { name: "Buscar cliente o RFC" })).toBe(search);
    expect(document.activeElement).toBe(search);
    expect((search as HTMLInputElement).value).toBe("Café");
    expect(screen.getByRole("status").textContent).toContain("Cargando expedientes");
  });

  it("no descarta coincidencias del servidor por un segundo filtro local con espacios", () => {
    render(<ClientsPage />);
    fireEvent.change(screen.getByRole("textbox", { name: "Buscar cliente o RFC" }), { target: { value: " Café " } });
    expect(screen.getByRole("button", { name: /Café del patio/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Empresa dos/ }));
    expect(screen.getByRole("heading", { name: "Empresa dos" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Empresa dos/ }).getAttribute("aria-pressed")).toBe("true");
  });

  it("mantiene una sola acción por contrato y conserva bloqueos por cancelación y vigencia", () => {
    render(<ContractsPage />);
    const table = screen.getByRole("table", { name: "Contratos comerciales" });
    expect(within(table).getAllByRole("row")).toHaveLength(4);
    expect(within(table).getAllByRole("button", { name: "Editar" })).toHaveLength(1);
    expect(within(table).getAllByText("Cerrado")).toHaveLength(2);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("abre el editor bajo demanda y guarda el mismo contrato sin perder la acción", async () => {
    render(<ContractsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    const dialog = await screen.findByRole("dialog", { name: "Editar contrato" });
    fireEvent.change(within(dialog).getByLabelText("Nombre del contrato"), { target: { value: "Nombre actualizado" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(commercialApi).toHaveBeenCalledOnce());
    const [url, options] = vi.mocked(commercialApi).mock.calls[0];
    expect(url).toBe("/bff/comercial/contratos/1");
    expect(options?.method).toBe("PATCH");
    expect(JSON.parse(String(options?.body))).toMatchObject({ nombre: "Nombre actualizado", estado: "VIGENTE", fechaFin: "2099-12-31" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(state.reload).toHaveBeenCalledOnce();
  });
});
