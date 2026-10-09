// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import TorreonBatchCapture from "@/features/torreon/naturales/components/TorreonBatchCapture";
import TorreonNaturalQueue from "@/features/torreon/naturales/components/TorreonNaturalQueue";
vi.mock("@/features/rail-queue/useRealtimeBoardRefresh", () => ({ useRealtimeBoardRefresh() {} }));
const json = (data: unknown) =>
  new Response(JSON.stringify(data), { headers: { "content-type": "application/json" } });
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const unit = (id: number) => ({
  id,
  modalidad: "INDIVIDUAL",
  estado: "PENDIENTE",
  ordenManual: null,
  incidentes: [],
  movimientos: [
    {
      id: 100 + id,
      locomotiveNumber: 120 + id,
      estado: "SOLICITADO",
      tipoMovimiento: "MD_TRABAJANDO",
      polo: "NORTE",
    },
  ],
});
it("client can review 1–5 independent rows, including the distinct towing locomotive, before submitting", async () => {
  const fetcher = vi.fn(async () => json([{ id: 101 }]));
  vi.stubGlobal("fetch", fetcher);
  const finish = vi.fn();
  render(
    <TorreonBatchCapture
      localidadId={2}
      empresaId={3}
      creadoPorId={7}
      vias={[
        { id: 8, nombre: "Vía A" },
        { id: 9, nombre: "Vía B" },
      ]}
      sectionsByVia={{ 8: [], 9: [] }}
      ensureSections={() => {}}
      onFinish={finish}
      onCancel={() => {}}
    />,
  );
  for (let i = 1; i < 5; i++)
    fireEvent.click(screen.getByRole("button", { name: /Agregar solicitud/ }));
  expect(screen.getByRole("button", { name: /Agregar solicitud/ }).hasAttribute("disabled")).toBe(
    true,
  );
  const rows = screen.getAllByRole("article");
  expect(rows).toHaveLength(5);
  for (let i = 0; i < rows.length; i++) {
    const row = within(rows[i]);
    fireEvent.change(row.getByLabelText("Locomotora solicitada"), {
      target: { value: String(120 + i) },
    });
    fireEvent.change(row.getByLabelText("Vía de origen"), { target: { value: "8" } });
    fireEvent.change(row.getByLabelText("Vía de destino"), { target: { value: "9" } });
    fireEvent.change(row.getByLabelText("Polo de patio"), { target: { value: "NORTE" } });
  }
  const first = within(rows[0]);
  fireEvent.change(first.getByLabelText("Tipo de movimiento"), { target: { value: "REMOLCADA" } });
  fireEvent.change(first.getByLabelText("Locomotora que remolca"), { target: { value: "800" } });
  fireEvent.change(first.getByLabelText("Dirección"), { target: { value: "JALAR" } });
  fireEvent.click(screen.getByRole("button", { name: "Revisar envío" }));
  expect(screen.getByText("Remolca: 800 · Jalar")).toBeTruthy();
  expect(fetcher).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Enviar 5 solicitudes" }));
  await waitFor(() => expect(finish).toHaveBeenCalledOnce());
  const [url, options] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe("/bff/torreon/movimientos/lote");
  const sent = JSON.parse(options.body as string);
  expect(sent.movimientos).toHaveLength(5);
  expect(sent.movimientos[0]).toMatchObject({
    locomotiveNumber: 120,
    locomotoraRemolque: 800,
    direccionEmpuje: "JALAR",
    viaOrigenId: 8,
    viaDestinoId: 9,
  });
  expect(sent.enConjunto).toBeUndefined();
  expect(sent.movimientos[0].operadorId).toBeUndefined();
});
it("raising several units keeps separate attention unless En conjunto is explicitly checked", async () => {
  const fetcher = vi.fn<(url: string, options?: RequestInit) => Promise<Response>>(async (url) =>
    json(url.includes("/usuarios") ? [] : [unit(1), unit(2)]),
  );
  vi.stubGlobal("fetch", fetcher);
  render(<TorreonNaturalQueue localidadId={2} rol="SUPERVISOR" />);
  await screen.findByLabelText("Seleccionar unidad 1");
  for (const id of [2, 1]) fireEvent.click(screen.getByLabelText(`Seleccionar unidad ${id}`));
  fireEvent.click(screen.getByRole("button", { name: "Subir (2)" }));
  await waitFor(() =>
    expect(fetcher.mock.calls.some((call) => call[1]?.method === "PATCH")).toBe(true),
  );
  const patch = fetcher.mock.calls.find((call) => call[1]?.method === "PATCH")!;
  expect(JSON.parse(patch[1]!.body as string)).toEqual({ unidadIds: [2, 1], enConjunto: false });
  await waitFor(() =>
    expect((screen.getByLabelText("Seleccionar unidad 1") as HTMLInputElement).checked).toBe(false),
  );
  fireEvent.click(screen.getByLabelText("En conjunto"));
  for (const id of [1, 2]) fireEvent.click(screen.getByLabelText(`Seleccionar unidad ${id}`));
  fireEvent.click(screen.getByRole("button", { name: "Subir (2)" }));
  await waitFor(() =>
    expect(fetcher.mock.calls.filter((call) => call[1]?.method === "PATCH")).toHaveLength(2),
  );
  const grouped = fetcher.mock.calls.filter((call) => call[1]?.method === "PATCH")[1]!;
  expect(JSON.parse(grouped[1]!.body as string)).toEqual({ unidadIds: [1, 2], enConjunto: true });
});
it("client queue exposes persistent incident solution without dispatcher or deadline controls", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      json([
        {
          ...unit(1),
          estado: "DETENIDA",
          incidentes: [
            { id: 90, estado: "ABIERTO", motivo: "Falla", fechaInicio: "2026-01-01", fotos: [] },
          ],
        },
      ]),
    ),
  );
  render(<TorreonNaturalQueue localidadId={2} rol="CLIENTE" />);
  fireEvent.click(await screen.findByRole("button", { name: "Ver incidentes del movimiento 101" }));
  await screen.findByText(/Incidente #90/);
  expect(screen.getByRole("button", { name: "Confirmar solución" })).toBeTruthy();
  expect(screen.queryByLabelText("En conjunto")).toBeNull();
  expect(screen.queryByText(/Tiempo vencido|Cerrar sin resolver/)).toBeNull();
});

it("keeps the first locomotive and route already captured by the existing form", () => {
  render(
    <TorreonBatchCapture
      initialMovement={{
        locomotiveNumber: "121",
        viaOrigenId: "8",
        viaDestinoId: "9",
        polo: "NORTE",
      }}
      localidadId={2}
      empresaId={3}
      creadoPorId={7}
      vias={[
        { id: 8, nombre: "Vía A" },
        { id: 9, nombre: "Vía B" },
      ]}
      sectionsByVia={{ 8: [], 9: [] }}
      ensureSections={() => {}}
      onFinish={() => {}}
      onCancel={() => {}}
    />,
  );
  expect((screen.getByLabelText("Locomotora solicitada") as HTMLInputElement).value).toBe("121");
  expect((screen.getByLabelText("Vía de origen") as HTMLSelectElement).value).toBe("8");
  fireEvent.click(screen.getByRole("button", { name: "Revisar envío" }));
  expect(screen.getByText("Solicitud 1 · Locomotora 121")).toBeTruthy();
});

it("clarifies patio and route positions, clears only the changed route section and reviews section names", () => {
  const ensureSections = vi.fn();
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  render(
    <TorreonBatchCapture
      initialMovement={{
        locomotiveNumber: "121",
        viaOrigenId: "8",
        viaDestinoId: "9",
        seccionOrigenId: "81",
        seccionDestinoId: "91",
        polo: "NORTE",
      }}
      localidadId={2}
      empresaId={3}
      creadoPorId={7}
      vias={[
        { id: 8, nombre: "Vía A" },
        { id: 9, nombre: "Vía B" },
        { id: 10, nombre: "Vía C" },
      ]}
      sectionsByVia={{
        8: [{ id: 81, numero: 1, nombre: "Salida sur" }],
        9: [{ id: 91, numero: 2, nombre: "Taller 2" }],
        10: [{ id: 101, numero: 3, nombre: "Patio 3" }],
      }}
      ensureSections={ensureSections}
      onFinish={() => {}}
      onCancel={() => {}}
    />,
  );
  expect(screen.getByText("De dónde se saca")).toBeTruthy();
  expect(screen.getByText("Dónde se va a colocar")).toBeTruthy();
  expect((screen.getByLabelText("Polo de patio") as HTMLSelectElement).value).toBe("NORTE");
  expect(ensureSections).toHaveBeenCalledWith(8);
  expect(ensureSections).toHaveBeenCalledWith(9);
  fireEvent.change(screen.getByLabelText("Vía de origen"), { target: { value: "10" } });
  expect(ensureSections).toHaveBeenCalledWith(10);
  expect((screen.getByLabelText("Posición de origen") as HTMLSelectElement).value).toBe("");
  expect((screen.getByLabelText("Posición de destino") as HTMLSelectElement).value).toBe("91");
  fireEvent.click(screen.getByRole("button", { name: "Revisar envío" }));
  expect(screen.getByRole("alert").textContent).toContain("selecciona la sección de origen");
  expect(fetcher).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Posición de origen"), { target: { value: "101" } });
  fireEvent.click(screen.getByRole("button", { name: "Revisar envío" }));
  expect(screen.getByText("Patio 3")).toBeTruthy();
  expect(screen.getByText("Taller 2")).toBeTruthy();
  expect(screen.getByText("Norte")).toBeTruthy();
  expect(screen.getByText("MD trabajando")).toBeTruthy();
  expect(screen.queryByText("MD_TRABAJANDO")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Editar datos" }));
  expect((screen.getByLabelText("Locomotora solicitada") as HTMLInputElement).value).toBe("121");
  expect((screen.getByLabelText("Posición de origen") as HTMLSelectElement).value).toBe("101");
});

it("keeps one request id for retries and issues another id only after editing the capture", async () => {
  const fetcher = vi
    .fn<(url: string, options?: RequestInit) => Promise<Response>>()
    .mockImplementationOnce(
      async () => new Response(JSON.stringify({ message: "Error temporal" }), { status: 503 }),
    )
    .mockImplementationOnce(
      async () => new Response(JSON.stringify({ message: "Error temporal" }), { status: 503 }),
    )
    .mockImplementationOnce(async () => json([{ id: 101 }]));
  vi.stubGlobal("fetch", fetcher);
  const finish = vi.fn();
  render(
    <TorreonBatchCapture
      initialMovement={{
        locomotiveNumber: "121",
        viaOrigenId: "8",
        viaDestinoId: "9",
        seccionOrigenId: "81",
        seccionDestinoId: "91",
        polo: "NORTE",
      }}
      localidadId={2}
      empresaId={3}
      creadoPorId={7}
      vias={[
        { id: 8, nombre: "Vía A" },
        { id: 9, nombre: "Vía B" },
      ]}
      sectionsByVia={{
        8: [{ id: 81, numero: 1, nombre: "Salida sur" }],
        9: [{ id: 91, numero: 2, nombre: "Taller 2" }],
      }}
      ensureSections={() => {}}
      onFinish={finish}
      onCancel={() => {}}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Revisar envío" }));
  fireEvent.click(screen.getByRole("button", { name: "Enviar 1 solicitud" }));
  await screen.findByText("Error temporal");
  fireEvent.click(screen.getByRole("button", { name: "Enviar 1 solicitud" }));
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  await waitFor(() =>
    expect(
      (screen.getByRole("button", { name: "Editar datos" }) as HTMLButtonElement).disabled,
    ).toBe(false),
  );
  const first = JSON.parse(fetcher.mock.calls[0][1]!.body as string);
  const retry = JSON.parse(fetcher.mock.calls[1][1]!.body as string);
  expect(first.clientRequestId).toBeTruthy();
  expect(retry.clientRequestId).toBe(first.clientRequestId);
  expect(first.movimientos[0]).toMatchObject({
    locomotiveNumber: 121,
    viaOrigenId: 8,
    viaDestinoId: 9,
    seccionOrigenId: 81,
    seccionDestinoId: 91,
    polo: "NORTE",
    localidadId: 2,
    empresaId: 3,
    creadoPorId: 7,
    seccionOrigenNombreSnapshot: "Salida sur",
    seccionDestinoNombreSnapshot: "Taller 2",
  });
  fireEvent.click(screen.getByRole("button", { name: "Editar datos" }));
  fireEvent.change(screen.getByLabelText("Indicaciones adicionales"), {
    target: { value: "Entrar lentamente" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Revisar envío" }));
  fireEvent.click(screen.getByRole("button", { name: "Enviar 1 solicitud" }));
  await waitFor(() => expect(finish).toHaveBeenCalledOnce());
  const edited = JSON.parse(fetcher.mock.calls[2][1]!.body as string);
  expect(edited.clientRequestId).not.toBe(first.clientRequestId);
  expect(edited.movimientos[0].instrucciones).toBe("Entrar lentamente");
});
