// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import TorreonBatchCapture from "@/features/torreon/naturales/components/TorreonBatchCapture";
import NaturalQueueTable from "@/features/torreon/naturales/components/NaturalQueueTable";
import type { QueueUnit } from "@/features/torreon/naturales/queueView";
const json = (data: unknown) =>
  new Response(JSON.stringify(data), { headers: { "content-type": "application/json" } });
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const props = {
  localidadId: 2,
  empresaId: 3,
  creadoPorId: 7,
  initialMovement: {
    locomotiveNumber: "121",
    viaOrigenId: "8",
    viaDestinoId: "9",
    poloOrigen: "NORTE",
    poloDestino: "SUR",
  },
  vias: [
    { id: 8, nombre: "Vía A" },
    { id: 9, nombre: "Vía B" },
  ],
  sectionsByVia: { 8: [{ id: 81, numero: 1, nombre: "Taller" }], 9: [{ id: 91, numero: 2 }] },
  ensureSections: vi.fn(),
  onFinish: vi.fn(),
  onCancel: vi.fn(),
};
it.each(["NORTE", "SUR"])(
  "submits %s without sections even when the section catalog is unavailable",
  async (pole) => {
    const fetcher = vi.fn(async (_url: string, _options?: RequestInit) => json([{ id: 101 }]));
    vi.stubGlobal("fetch", fetcher);
    render(
      <TorreonBatchCapture
        {...props}
        initialMovement={{ ...props.initialMovement, poloOrigen: pole, poloDestino: pole }}
        sectionsByVia={{}}
        sectionsError={{ 8: "Offline", 9: "Offline" }}
      />,
    );
    expect(screen.getByLabelText("Posición de origen").getAttribute("aria-required")).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "Revisar envío" }));
    fireEvent.click(screen.getByRole("button", { name: "Enviar 1 solicitud" }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
    const movement = JSON.parse(fetcher.mock.calls[0][1]!.body as string).movimientos[0];
    expect(movement).toMatchObject({ poloOrigen: pole, poloDestino: pole });
    expect(movement).not.toHaveProperty("seccionOrigenId");
    expect(movement).not.toHaveProperty("seccionDestinoId");
  },
);
it.each(["Origen", "Destino"] as const)(
  "requires only the section for the Centro endpoint %s",
  async (side) => {
    const fetcher = vi.fn(async (_url: string, _options?: RequestInit) => json([{ id: 101 }]));
    vi.stubGlobal("fetch", fetcher);
    render(<TorreonBatchCapture {...props} />);
    const pole = screen.getByLabelText(side === "Origen" ? "Polo de salida" : "Polo de llegada");
    fireEvent.change(pole, { target: { value: "CENTRO" } });
    const section = screen.getByLabelText(`Posición de ${side.toLowerCase()}`);
    expect(section.getAttribute("aria-required")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Revisar envío" }));
    expect(screen.getByRole("alert").textContent).toContain(
      `sección de ${side.toLowerCase()} para el polo Centro`,
    );
    expect(fetcher).not.toHaveBeenCalled();
    fireEvent.change(section, { target: { value: side === "Origen" ? "81" : "91" } });
    fireEvent.click(screen.getByRole("button", { name: "Revisar envío" }));
    fireEvent.click(screen.getByRole("button", { name: "Enviar 1 solicitud" }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
    const movement = JSON.parse(fetcher.mock.calls[0][1]!.body as string).movimientos[0];
    expect(movement[`seccion${side}Id`]).toBe(side === "Origen" ? 81 : 91);
    expect(movement).not.toHaveProperty(side === "Origen" ? "seccionDestinoId" : "seccionOrigenId");
  },
);
it("validates explicitly selected sections even for Norte", () => {
  render(
    <TorreonBatchCapture
      {...props}
      initialMovement={{ ...props.initialMovement, seccionOrigenId: "999" }}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Revisar envío" }));
  expect(screen.getByRole("alert").textContent).toContain("selecciona una sección válida");
});
it("uses the GDL table component and exposes operational data while preserving group assignment", () => {
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
  const movement = {
    id: 101,
    empresaId: 3,
    empresaNombreSnapshot: "Empresa A",
    localidadNombreSnapshot: "Torreón",
    locomotiveNumber: 121,
    estado: "SOLICITADO",
    poloOrigen: "NORTE",
    poloDestino: "CENTRO",
    viaOrigenNombreSnapshot: "Vía A",
    viaDestinoNombreSnapshot: "Vía B",
    seccionDestinoId: 91,
    seccionDestinoNumero: 2,
    tipoMovimiento: "MD_TRABAJANDO",
    cliente: { nombre: "Cliente A" },
    coordinador: { nombre: "Coordinador A" },
    supervisor: { nombre: "Supervisor A" },
    fechaSolicitud: "2026-10-13T14:00:00Z",
  };
  const unit: QueueUnit = {
    id: 20,
    modalidad: "CONJUNTO",
    estado: "PENDIENTE",
    operadorId: null,
    disponible: true,
    posicion: 1,
    ordenManual: null,
    movimientos: [movement, { ...movement, id: 102, locomotiveNumber: 122 }],
    incidentes: [],
  };
  const select = vi.fn();
  render(
    <NaturalQueueTable
      units={[unit]}
      dispatch
      showWaitTime
      showImages
      showFinish
      selected={[]}
      onSelect={select}
      operators={[]}
      busy={false}
      mutate={vi.fn()}
      onHistory={vi.fn()}
    />,
  );
  for (const name of [
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
    "Estado",
  ])
    expect(screen.getByRole("columnheader", { name })).toBeTruthy();
  expect(document.querySelector(".cosaif-ant-table .ant-table")).toBeTruthy();
  for (const name of ["Cliente A", "Coordinador A", "Supervisor A", "Sección 2"])
    expect(screen.getAllByText(name)).toHaveLength(2);
  fireEvent.click(screen.getByRole("checkbox", { name: "Seleccionar unidad 20" }));
  expect(select).toHaveBeenCalledWith(20, true);
  fireEvent.click(screen.getByRole("button", { name: "Ver detalle del movimiento 101" }));
  expect(screen.getByLabelText("Asignar unidad 20")).toBeTruthy();
  expect(screen.queryByText(/chimenea|cabina/i)).toBeNull();
});
