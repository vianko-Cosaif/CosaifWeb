// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import TorreonNaturalQueue from "@/features/torreon/naturales/components/TorreonNaturalQueue";
import type { QueueMovement, QueueUnit } from "@/features/torreon/naturales/queueView";

vi.mock("@/features/rail-queue/useRealtimeBoardRefresh", () => ({
  useRealtimeBoardRefresh() {},
}));
const json = (data: unknown) =>
  new Response(JSON.stringify(data), { headers: { "content-type": "application/json" } });
const requestedAt = "2026-10-08T18:30:00.000Z";
function movement(id: number, locomotiveNumber: number): QueueMovement {
  return {
    id,
    locomotiveNumber,
    empresaId: 3,
    empresaNombreSnapshot: "Ferrocarril del Norte",
    viaOrigenNombreSnapshot: "Vía 29",
    seccionOrigenNombreSnapshot: "Sección patio sur",
    viaDestinoNombreSnapshot: "Vía 3",
    seccionDestinoNombreSnapshot: "Sección taller",
    estado: "SOLICITADO",
    tipoMovimiento: "REMOLCADA",
    locomotoraRemolque: 9900,
    direccionEmpuje: "JALAR",
    polo: "NORTE",
    posicionChimenea: "SUR",
    posicionCabina: "DENTRO",
    coordinadorId: 42,
    coordinador: { id: 42, nombre: "María Cruz" },
    operadorId: 17,
    operador: { id: 17, nombre: "José Hernández" },
    creadoPorId: 88,
    creadoPor: { id: 88, nombre: "Elena García" },
    clienteId: 89,
    cliente: { id: 89, nombre: "Luis Torres" },
    supervisorId: 90,
    supervisor: { id: 90, nombre: "Pedro Mendoza" },
    fechaSolicitud: requestedAt,
    instrucciones: "Mover lentamente. [META ORIGEN:8] [META DESTINO:9]",
    fotos: [],
  };
}
function unit(id: number, posicion: number, movimientos: QueueMovement[]): QueueUnit {
  return {
    id,
    posicion,
    movimientos,
    modalidad: movimientos.length > 1 ? "CONJUNTO" : "INDIVIDUAL",
    estado: "PENDIENTE",
    operadorId: 17,
    operador: { id: 17, nombre: "José Hernández" },
    disponible: true,
    ordenManual: null,
    fechaRecepcion: requestedAt,
    incidentes: [],
  };
}
function locomotiveOrder() {
  return within(screen.getByRole("table"))
    .getAllByRole("rowheader")
    .map((row) => row.querySelector("strong")?.textContent);
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("shows the actual coordinator and machinist with complete route, configuration and local request time", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => json([unit(71, 1, [movement(501, 7620)])])),
  );
  render(<TorreonNaturalQueue localidadId={2} rol="CLIENTE" />);
  const table = await screen.findByRole("table");
  const row = within(table).getByRole("rowheader").closest("tr")!;
  const details = within(row);
  for (const text of [
    "María Cruz",
    "José Hernández",
    "Ferrocarril del Norte",
    "Vía 29",
    "Vía 3",
    "Sección patio sur",
    "Sección taller",
    "Remolcada",
    "Remolca 9900 · Jalar",
    "Norte",
    "Sur",
    "Dentro",
  ])
    expect(details.getByText(text)).toBeTruthy();
  const time = row.querySelector(`time[datetime="${requestedAt}"]`);
  expect(time?.textContent).toMatch(/08.*oct.*2026.*12:30/);
  expect(details.getByText("En espera")).toBeTruthy();
  expect(within(table).getByRole("columnheader", { name: "Responsables" })).toBeTruthy();
});

it("filters without reordering the backend queue or splitting a matching conjunto", async () => {
  const resumed = { ...unit(90, 1, [movement(900, 9100)]), estado: "LISTA_REANUDAR" };
  const grouped = unit(60, 2, [
    movement(601, 7620),
    { ...movement(602, 8820), coordinadorId: 43, coordinador: { id: 43, nombre: "Ana Gómez" } },
  ]);
  const manual = { ...unit(7, 3, [movement(701, 7700)]), ordenManual: 1 };
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => json([resumed, grouped, manual])),
  );
  render(<TorreonNaturalQueue localidadId={2} rol="CLIENTE" />);
  await screen.findByRole("table");
  expect(locomotiveOrder()).toEqual(["9100", "7620", "8820", "7700"]);
  fireEvent.change(screen.getByLabelText("Buscar movimientos"), { target: { value: "7620" } });
  expect(locomotiveOrder()).toEqual(["7620", "8820"]);
  expect(screen.getAllByText("Conjunto #60")).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: /^Limpiar$/ }));
  fireEvent.change(screen.getByLabelText("Filtrar por estado"), { target: { value: "PENDIENTE" } });
  expect(locomotiveOrder()).toEqual(["7620", "8820", "7700"]);
  fireEvent.change(screen.getByLabelText("Filtrar por coordinador"), { target: { value: "43" } });
  expect(locomotiveOrder()).toEqual(["7620", "8820"]);
  fireEvent.change(screen.getByLabelText("Buscar movimientos"), { target: { value: "ana gomez" } });
  expect(locomotiveOrder()).toEqual(["7620", "8820"]);
});

it("expands participants, operation times and photo evidence, then loads history for the attention unit", async () => {
  let resolveHistory!: (response: Response) => void;
  const historyResponse = new Promise<Response>((resolve) => {
    resolveHistory = resolve;
  });
  const row = {
    ...movement(501, 7620),
    fechaInicio: "2026-10-08T18:40:00.000Z",
    fechaFin: "2026-10-08T19:00:00.000Z",
    fotos: [
      {
        id: 11,
        url: "uploads/incidentes/torreon/antes.jpg",
        tipo: "ANTES_MOVIMIENTO",
        tomadaAt: requestedAt,
        comentario: "Evidencia inicial",
      },
    ],
  };
  const fetcher = vi.fn(async (url: string) =>
    url.endsWith("/historial") ? historyResponse : json([unit(71, 1, [row])]),
  );
  vi.stubGlobal("fetch", fetcher);
  render(<TorreonNaturalQueue localidadId={2} rol="CLIENTE" />);
  const expand = await screen.findByRole("button", { name: "Ver detalle del movimiento 501" });
  expect(screen.queryByText("Elena García")).toBeNull();
  fireEvent.click(expand);
  expect(screen.getByText("Mover lentamente.")).toBeTruthy();
  expect(screen.queryByText(/META ORIGEN/)).toBeNull();
  for (const name of ["Elena García", "Luis Torres", "Pedro Mendoza"])
    expect(screen.getByText(name)).toBeTruthy();
  expect(screen.getByText(/08.*oct.*2026.*12:40/)).toBeTruthy();
  expect(screen.getByText(/08.*oct.*2026.*13:00/)).toBeTruthy();
  const photo = screen.getByRole("link", { name: /Antes del movimiento/ });
  expect(photo.getAttribute("href")).toBe("/api/torreon/imagenes/torreon/antes.jpg");
  expect(photo.getAttribute("target")).toBe("_blank");
  fireEvent.click(screen.getByRole("button", { name: "Ver historial de operación" }));
  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).getByText("Cargando historial…")).toBeTruthy();
  expect(fetcher.mock.calls.some(([url]) => url === "/bff/torreon/cola/71/historial")).toBe(true);
  resolveHistory(
    json([{ id: 1, accion: "ASIGNAR", usuarioId: 42, rol: "COORDINADOR", fecha: requestedAt }]),
  );
  await within(dialog).findByText("Maquinista asignado");
  expect(within(dialog).getByText("María Cruz · coordinador")).toBeTruthy();
  fireEvent.click(within(dialog).getByRole("button", { name: "Cerrar historial" }));
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("assigns the entire attention unit using its id and only offers active local machinists", async () => {
  const grouped = unit(71, 1, [movement(501, 7620), movement(502, 8820)]);
  const fetcher = vi.fn(async (url: string, options?: RequestInit) => {
    if (url.startsWith("/bff/usuarios"))
      return json([
        { id: 17, nombre: "José Hernández", rol: "MAQUINISTA", localidadId: 2, activo: true },
        { id: 18, nombre: "Otro patio", rol: "MAQUINISTA", localidadId: 1, activo: true },
        { id: 19, nombre: "Inactivo", rol: "MAQUINISTA", localidadId: 2, activo: false },
        { id: 42, nombre: "María Cruz", rol: "COORDINADOR", localidadId: 2, activo: true },
      ]);
    return json(options?.method === "PATCH" ? {} : [grouped]);
  });
  vi.stubGlobal("fetch", fetcher);
  render(<TorreonNaturalQueue localidadId={2} rol="COORDINADOR" />);
  fireEvent.click(await screen.findByRole("button", { name: "Ver detalle del movimiento 501" }));
  const assign = screen.getByLabelText("Asignar unidad 71");
  await within(assign).findByRole("option", { name: "José Hernández" });
  for (const name of ["Otro patio", "Inactivo", "María Cruz"])
    expect(within(assign).queryByRole("option", { name })).toBeNull();
  expect(
    screen.getByText("La asignación aplica a todos los movimientos del conjunto."),
  ).toBeTruthy();
  fireEvent.change(assign, { target: { value: "17" } });
  fireEvent.click(screen.getByRole("button", { name: /^Asignar$/ }));
  await waitFor(() =>
    expect(fetcher.mock.calls.some(([, options]) => options?.method === "PATCH")).toBe(true),
  );
  const [url, options] = fetcher.mock.calls.find(([, init]) => init?.method === "PATCH")!;
  expect(url).toBe("/bff/torreon/cola/71/asignar");
  expect(JSON.parse(options!.body as string)).toEqual({ operadorId: 17 });
});

it("lets clients inspect and confirm an incident solution without dispatcher controls", async () => {
  const detained = {
    ...unit(71, 1, [movement(501, 7620)]),
    estado: "DETENIDA",
    incidentes: [
      {
        id: 91,
        movimientoId: 501,
        estado: "ABIERTO",
        motivo: "Vía obstruida",
        fechaInicio: requestedAt,
        fotos: [],
      },
    ],
  };
  const fetcher = vi.fn(async (_url: string, options?: RequestInit) =>
    json(options?.method === "PATCH" ? {} : [detained]),
  );
  vi.stubGlobal("fetch", fetcher);
  render(<TorreonNaturalQueue localidadId={2} rol="CLIENTE" />);
  fireEvent.click(await screen.findByRole("button", { name: "Ver incidentes del movimiento 501" }));
  expect(screen.getByText("Incidente #91")).toBeTruthy();
  expect(screen.queryByLabelText("En conjunto")).toBeNull();
  expect(screen.queryByLabelText("Asignar unidad 71")).toBeNull();
  expect(screen.queryByRole("checkbox")).toBeNull();
  expect(screen.queryByRole("button", { name: /^Subir|^Asignar$/ })).toBeNull();
  const confirm = screen.getByRole("button", { name: "Confirmar solución" });
  expect((confirm as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText("Solución del incidente 91"), {
    target: { value: "Vía despejada" },
  });
  fireEvent.click(confirm);
  await waitFor(() =>
    expect(fetcher.mock.calls.some(([, options]) => options?.method === "PATCH")).toBe(true),
  );
  const [url, options] = fetcher.mock.calls.find(([, init]) => init?.method === "PATCH")!;
  expect(url).toBe("/bff/torreon/incidentes/91/resolver?tipo=NATURAL");
  expect(JSON.parse(options!.body as string)).toEqual({ solucion: "Vía despejada" });
});

it("shows the real size of a partially visible conjunto without adding movements outside the client scope", async () => {
  const scopedGroup: QueueUnit = {
    ...unit(71, 1, [movement(501, 7620)]),
    modalidad: "CONJUNTO",
    totalIntegrantes: 2,
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => json([scopedGroup])),
  );
  render(<TorreonNaturalQueue localidadId={2} rol="CLIENTE" />);
  const table = await screen.findByRole("table");
  expect(locomotiveOrder()).toEqual(["7620"]);
  expect(within(table).getAllByRole("rowheader")).toHaveLength(1);
  expect(screen.getByText("1 de 2 visibles")).toBeTruthy();
  expect(within(table).getAllByText("Ferrocarril del Norte")).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Ver detalle del movimiento 501" }));
  expect(
    screen.getByText("Parte del conjunto #71, con 2 movimientos. Se muestran 1 de tu empresa."),
  ).toBeTruthy();
  expect(within(table).getAllByRole("rowheader")).toHaveLength(1);
  expect(screen.getAllByRole("button", { name: /detalle del movimiento/ })).toHaveLength(1);
});

it("uses the requester's name for the client only when both user ids match", async () => {
  const sameClient = { ...movement(501, 7620), clienteId: 88, cliente: null };
  const distinctClient = {
    ...movement(601, 8820),
    creadoPor: { id: 88, nombre: "Beatriz Ramos" },
    clienteId: 89,
    cliente: null,
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => json([unit(71, 1, [sameClient]), unit(72, 2, [distinctClient])])),
  );
  render(<TorreonNaturalQueue localidadId={2} rol="CLIENTE" />);
  fireEvent.click(await screen.findByRole("button", { name: "Ver detalle del movimiento 501" }));
  expect(screen.getAllByText("Elena García")).toHaveLength(2);
  expect(screen.queryByText("Usuario #88")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Ver detalle del movimiento 601" }));
  expect(screen.getAllByText("Beatriz Ramos")).toHaveLength(1);
  expect(screen.getByText("Usuario #89")).toBeTruthy();
});
