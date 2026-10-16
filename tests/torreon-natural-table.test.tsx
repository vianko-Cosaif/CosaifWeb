// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import TorreonNaturalQueue from "@/features/torreon/naturales/components/TorreonNaturalQueue";
import type { QueueMovement, QueueUnit } from "@/features/torreon/naturales/queueView";

vi.mock("@/features/rail-queue/useRealtimeBoardRefresh", () => ({
  useRealtimeBoardRefresh() {},
}));
const json = (data: unknown) =>
  new Response(JSON.stringify(data), {
    headers: { "content-type": "application/json" },
  });
const requestedAt = "2026-10-08T18:30:00.000Z";
function movement(id: number, locomotiveNumber: number): QueueMovement {
  return {
    id,
    locomotiveNumber,
    empresaId: 3,
    empresaNombreSnapshot: "Ferrocarril del Norte",
    viaOrigenNombreSnapshot: "Vía 29",
    seccionOrigenId: 81,
    seccionOrigenNumero: 1,
    seccionOrigenNombreSnapshot: "Patio sur",
    viaDestinoNombreSnapshot: "Vía 3",
    seccionDestinoId: 91,
    seccionDestinoNumero: 2,
    seccionDestinoNombreSnapshot: "Taller",
    estado: "SOLICITADO",
    tipoMovimiento: "REMOLCADA",
    locomotoraRemolque: 9900,
    direccionEmpuje: "JALAR",
    polo: "SUR",
    poloOrigen: "NORTE",
    poloDestino: "SUR",
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
function movementRows(table: HTMLElement = screen.getByRole("table")) {
  return within(table)
    .getAllByRole("row")
    .filter((row) => within(row).queryByRole("button", { name: /^Ver folio \d+$/ }));
}
function locomotiveOrder() {
  const table = screen.getByRole("table");
  const column = within(table)
    .getAllByRole("columnheader")
    .findIndex((header) => header.textContent === "Locomotora");
  return movementRows(table).map((row) =>
    within(row).getAllByRole("cell")[column].textContent?.trim(),
  );
}
function movementDetail(id: number) {
  const toggle = screen.getByRole("button", { name: `Ocultar detalle del movimiento ${id}` });
  return within(document.getElementById(toggle.getAttribute("aria-controls")!)!);
}
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

it("shows the actual coordinator and machinist with complete route, configuration and local request time", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => json([unit(71, 1, [movement(501, 7620)])])),
  );
  render(<TorreonNaturalQueue localidadId={2} rol="CLIENTE" />);
  const table = await screen.findByRole("table");
  const row = movementRows(table)[0];
  const details = within(row);
  for (const text of [
    "María Cruz",
    "José Hernández",
    "Ferrocarril del Norte",
    "Vía 29",
    "Vía 3",
    "Sección 1 · Patio sur",
    "Sección 2 · Taller",
    "Remolcada",
    "Remolca 9900 · Jalar",
    "Norte",
  ])
    expect(details.getByText(text)).toBeTruthy();
  const time = row.querySelector(`time[datetime="${requestedAt}"]`);
  expect(time?.textContent).toMatch(/08.*oct.*2026.*12:30/);
  expect(details.queryByText("En espera")).toBeNull();
  expect(details.getByText("Pendiente de inicio")).toBeTruthy();
  expect(details.getByText("Polo de salida:")).toBeTruthy();
  expect(details.getByText("Polo de llegada:")).toBeTruthy();
  expect(within(table).getByRole("columnheader", { name: "Inicio" })).toBeTruthy();
  expect(within(table).getByRole("columnheader", { name: "Origen" })).toBeTruthy();
  expect(within(table).getByRole("columnheader", { name: "Destino" })).toBeTruthy();
  expect(within(table).getByRole("columnheader", { name: "Personal" })).toBeTruthy();
  expect(screen.queryByText(/chimenea|cabina/i)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Ver detalle del movimiento 501" }));
  const routeDetail = within(
    screen.getByRole("heading", { name: "Operación de vía" }).closest("section")!,
  );
  expect(routeDetail.getByText("Sección 1 · Patio sur")).toBeTruthy();
  expect(routeDetail.getByText("Sección 2 · Taller")).toBeTruthy();
  expect(screen.queryByText(/chimenea|cabina/i)).toBeNull();
});

it("filters without reordering the backend queue or splitting a matching conjunto", async () => {
  const resumed = {
    ...unit(90, 1, [movement(900, 9100)]),
    estado: "LISTA_REANUDAR",
  };
  const grouped = unit(60, 2, [
    movement(601, 7620),
    {
      ...movement(602, 8820),
      coordinadorId: 43,
      coordinador: { id: 43, nombre: "Ana Gómez" },
    },
  ]);
  const manual = { ...unit(7, 3, [movement(701, 7700)]), ordenManual: 1 };
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => json([resumed, grouped, manual])),
  );
  render(<TorreonNaturalQueue localidadId={2} rol="CLIENTE" />);
  await screen.findByRole("table");
  expect(locomotiveOrder()).toEqual(["9100", "7620", "8820", "7700"]);
  fireEvent.change(screen.getByLabelText("Buscar movimientos"), {
    target: { value: "7620" },
  });
  expect(locomotiveOrder()).toEqual(["7620", "8820"]);
  expect(screen.getAllByText("Conjunto #60")).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: /^Limpiar$/ }));
  fireEvent.change(screen.getByLabelText("Filtrar por estado"), {
    target: { value: "PENDIENTE" },
  });
  expect(locomotiveOrder()).toEqual(["7620", "8820", "7700"]);
  fireEvent.change(screen.getByLabelText("Filtrar por coordinador"), {
    target: { value: "43" },
  });
  expect(locomotiveOrder()).toEqual(["7620", "8820"]);
  fireEvent.change(screen.getByLabelText("Buscar movimientos"), {
    target: { value: "ana gomez" },
  });
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
  render(<TorreonNaturalQueue localidadId={2} rol="COORDINADOR" />);
  const expand = await screen.findByRole("button", {
    name: "Ver detalle del movimiento 501",
  });
  expect(screen.queryByText("Elena García")).toBeNull();
  fireEvent.click(expand);
  expect(screen.getByText("Mover lentamente.")).toBeTruthy();
  expect(screen.queryByText(/META ORIGEN/)).toBeNull();
  for (const name of ["Elena García", "Luis Torres", "Pedro Mendoza"])
    expect(movementDetail(501).getByText(name)).toBeTruthy();
  expect(screen.getAllByText(/08.*oct.*2026.*12:40/)).toHaveLength(2);
  expect(screen.queryByText(/08.*oct.*2026.*13:00/)).toBeNull();
  expect(screen.queryByText(/^Fin$/)).toBeNull();
  const photo = screen.getByRole("link", { name: /Antes del movimiento/ });
  expect(photo.getAttribute("href")).toBe("/api/torreon/imagenes/torreon/antes.jpg");
  expect(photo.getAttribute("target")).toBe("_blank");
  fireEvent.click(screen.getByRole("button", { name: "Ver historial de operación" }));
  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).getByText("Cargando historial…")).toBeTruthy();
  expect(fetcher.mock.calls.some(([url]) => url === "/bff/torreon/cola/71/historial")).toBe(true);
  resolveHistory(
    json([
      {
        id: 1,
        accion: "ASIGNAR",
        usuarioId: 42,
        rol: "COORDINADOR",
        fecha: requestedAt,
      },
    ]),
  );
  await within(dialog).findByText("Maquinista asignado");
  expect(within(dialog).getByText("María Cruz · coordinador")).toBeTruthy();
  fireEvent.click(within(dialog).getByRole("button", { name: "Cerrar historial" }));
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("assigns the entire attention unit using its id and only offers active local machinists", async () => {
  const grouped = unit(71, 1, [movement(501, 7620), movement(502, 8820)]);
  const fetcher = vi.fn(async (url: string, options?: RequestInit) => {
    if (url === "/bff/torreon/cola/maquinistas?localidadId=2")
      return json([{ id: 17, nombre: "José Hernández" }]);
    if (url.startsWith("/bff/usuarios"))
      throw new Error("The picker must use the scoped Torreon catalog");
    return json(options?.method === "PATCH" ? {} : [grouped]);
  });
  vi.stubGlobal("fetch", fetcher);
  render(<TorreonNaturalQueue localidadId={2} rol="COORDINADOR" />);
  fireEvent.click(
    await screen.findByRole("button", {
      name: "Ver detalle del movimiento 501",
    }),
  );
  expect(
    fetcher.mock.calls.some(([url]) => url === "/bff/torreon/cola/maquinistas?localidadId=2"),
  ).toBe(true);
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

it("lets clients inspect incidents across the yard with read-only controls", async () => {
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
  fireEvent.click(
    await screen.findByRole("button", {
      name: "Ver incidentes del movimiento 501",
    }),
  );
  expect(screen.getByText("Incidente #91")).toBeTruthy();
  expect(screen.queryByLabelText("En conjunto")).toBeNull();
  expect(screen.queryByLabelText("Asignar unidad 71")).toBeNull();
  expect(screen.queryByRole("checkbox")).toBeNull();
  expect(screen.queryByRole("button", { name: /^Subir|^Asignar$/ })).toBeNull();
  expect(screen.queryByRole("button", { name: "Confirmar solución" })).toBeNull();
  expect(screen.queryByLabelText("Solución del incidente 91")).toBeNull();
  expect(
    fetcher.mock.calls.some(([, options]) => options?.method && options.method !== "GET"),
  ).toBe(false);
});

it.each(["CLIENTE", "CLIENTE_ADMIN", "CLIENTE_COOR"])(
  "shows %s the same companies and complete groups as coordination without operational controls",
  async (role) => {
    const otherCompany = {
      ...movement(502, 8820),
      empresaId: 4,
      empresaNombreSnapshot: "Empresa del Pacífico",
    };
    const rows = [
      unit(71, 1, [movement(501, 7620), otherCompany]),
      unit(72, 2, [{ ...otherCompany, id: 503, locomotiveNumber: 9901 }]),
    ];
    const fetcher = vi.fn(async (url: string) => json(url.startsWith("/bff/usuarios") ? [] : rows));
    vi.stubGlobal("fetch", fetcher);
    const page = render(<TorreonNaturalQueue localidadId={2} rol={role} />);
    const table = await screen.findByRole("table");
    const clientOrder = locomotiveOrder();
    expect(clientOrder).toEqual(["7620", "8820", "9901"]);
    expect(within(table).getAllByText("Empresa del Pacífico")).toHaveLength(2);
    expect(within(table).getByText("Ferrocarril del Norte")).toBeTruthy();
    expect(
      screen.getByText("Vista general de todas las empresas del patio · solo consulta."),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ver detalle del movimiento 502" }));
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(
      screen.queryByRole("button", {
        name: /^Subir|^Asignar$|Confirmar solución|Iniciar|Finalizar/,
      }),
    ).toBeNull();
    expect(fetcher.mock.calls.every(([url]) => !url.startsWith("/bff/usuarios"))).toBe(true);
    page.rerender(<TorreonNaturalQueue localidadId={2} rol="COORDINADOR" />);
    expect(locomotiveOrder()).toEqual(clientOrder);
    expect(screen.getAllByRole("checkbox").length).toBeGreaterThan(0);
  },
);

it("shows the real size of a partially visible conjunto without adding unavailable rows", async () => {
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
  expect(movementRows(table)).toHaveLength(1);
  expect(screen.getByText("1 de 2 visibles")).toBeTruthy();
  expect(within(table).getAllByText("Ferrocarril del Norte")).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Ver detalle del movimiento 501" }));
  expect(screen.getByText("1 de 2 visibles")).toBeTruthy();
  expect(movementRows(table)).toHaveLength(1);
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
  fireEvent.click(
    await screen.findByRole("button", {
      name: "Ver detalle del movimiento 501",
    }),
  );
  expect(movementDetail(501).getAllByText("Elena García")).toHaveLength(2);
  expect(screen.queryByText("Usuario #88")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Ver detalle del movimiento 601" }));
  expect(screen.getAllByText("Beatriz Ramos")).toHaveLength(1);
  expect(movementDetail(601).getByText("Usuario #89")).toBeTruthy();
});

it.each(["CLIENTE", "CLIENTE_ADMIN", "CLIENTE_COOR", "COORDINADOR", "SUPERVISOR", "ADMINISTRADOR"])(
  "applies Inicio visibility and company incident navigation for %s",
  async (role) => {
    const m = {
      ...movement(501, 7620),
      fotos: [
        {
          id: 11,
          url: "uploads/incidentes/torreon/antes.jpg",
          tipo: "ANTES_MOVIMIENTO",
        },
      ],
      fechaFin: "2026-10-08T19:00:00.000Z",
      incidentes: [
        {
          id: 91,
          estado: "ABIERTO",
          motivo: "Vía obstruida",
          fechaInicio: requestedAt,
          fotos: [{ id: 12, url: "uploads/incidentes/torreon/incidente.jpg" }],
        },
      ],
    };
    const fetcher = vi.fn(async (url: string) =>
      json(url.startsWith("/bff/usuarios") ? [] : [unit(71, 1, [m])]),
    );
    vi.stubGlobal("fetch", fetcher);
    render(<TorreonNaturalQueue localidadId={2} rol={role} />);
    const table = await screen.findByRole("table");
    const client = ["CLIENTE", "CLIENTE_ADMIN", "CLIENTE_COOR"].includes(role);
    const elapsed = ["COORDINADOR", "SUPERVISOR"].includes(role);
    const incidentLink = screen.queryByRole("link", {
      name: "Incidentes de mi empresa",
    });
    expect(Boolean(incidentLink)).toBe(client);
    if (incidentLink)
      expect(incidentLink.getAttribute("href")).toBe(
        "/cliente/incidentes?source=torreon&tipo=NATURAL",
      );
    expect(Boolean(within(table).queryByText("En espera"))).toBe(elapsed);
    expect(
      within(table).getByRole("columnheader", {
        name: "Solicitud",
      }),
    ).toBeTruthy();
    expect(within(table).getByRole("columnheader", { name: "Inicio" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Historial" })).toBeNull();
    expect(fetcher.mock.calls.some(([url]) => url.includes("historial=false"))).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Ver detalle del movimiento 501" }));
    expect(screen.getByRole("link", { name: /Antes del movimiento/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Evidencia 1/ })).toBeTruthy();
    expect(screen.queryByText(/^Fin$/)).toBeNull();
    expect(screen.queryByText(/13:00/)).toBeNull();
  },
);

it("retains final timestamps and concluded requests in Seguimiento", async () => {
  const finished = {
    ...movement(501, 7620),
    fechaInicio: "2026-10-08T18:40:00.000Z",
    fechaFin: "2026-10-08T19:00:00.000Z",
  };
  const fetcher = vi.fn(async (url: string) =>
    json(
      url.startsWith("/bff/usuarios") ? [] : [{ ...unit(71, 1, [finished]), estado: "CONCLUIDA" }],
    ),
  );
  vi.stubGlobal("fetch", fetcher);
  render(<TorreonNaturalQueue localidadId={2} rol="COORDINADOR" view="seguimiento" />);
  await screen.findByRole("table");
  fireEvent.click(screen.getByRole("button", { name: "Historial" }));
  await waitFor(() =>
    expect(fetcher.mock.calls.some(([url]) => url.includes("historial=true"))).toBe(true),
  );
  fireEvent.click(
    await screen.findByRole("button", {
      name: "Ver detalle del movimiento 501",
    }),
  );
  expect(screen.getByRole("columnheader", { name: "Fin" })).toBeTruthy();
  expect(movementDetail(501).getByText(/08.*oct.*2026.*13:00/)).toBeTruthy();
});

it.each(["CLIENTE", "CLIENTE_ADMIN", "CLIENTE_COOR", "COORDINADOR", "SUPERVISOR"])(
  "switches %s from shared active operations to the correct history scope",
  async (role) => {
    const client = role.startsWith("CLIENTE");
    const activeStates = ["PENDIENTE", "DETENIDA", "EN_PROCESO", "LISTA_REANUDAR"];
    const active = activeStates.map((estado, index) => ({
      ...unit(index + 1, index + 1, [
        {
          ...movement(index + 501, index + 7601),
          empresaId: index % 2 ? 4 : 3,
          empresaNombreSnapshot: index % 2 ? "Empresa B" : "Empresa A",
        },
      ]),
      estado,
    }));
    const past = active.map((entry, index) => ({
      ...entry,
      estado: index % 2 ? "CANCELADA" : "CONCLUIDA",
      movimientos: entry.movimientos.map((movement) => ({
        ...movement,
        estado: index % 2 ? "CANCELADO" : "CONCLUIDO",
      })),
    }));
    const ownHistory = past.filter((entry) => entry.movimientos[0].empresaId === 3);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        json(
          url.startsWith("/bff/usuarios")
            ? []
            : url.includes("historial=true")
              ? client
                ? ownHistory
                : past
              : active,
        ),
      ),
    );
    render(<TorreonNaturalQueue localidadId={2} rol={role} view="seguimiento" />);
    await screen.findByRole("table");
    expect(locomotiveOrder()).toEqual(["7604", "7603", "7602", "7601"]);
    expect(screen.getByText("Solicitudes en espera, detenidas y en proceso")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Historial" }));
    await waitFor(() =>
      expect(locomotiveOrder()).toEqual(
        client ? ["7603", "7601"] : ["7604", "7603", "7602", "7601"],
      ),
    );
    expect(
      screen.getByText(
        client
          ? "Solicitudes concluidas y canceladas de tu empresa"
          : "Solicitudes concluidas y canceladas de todas las empresas",
      ),
    ).toBeTruthy();
    if (client) {
      expect(
        screen.getByText("Historial de movimientos de tu empresa · solo consulta."),
      ).toBeTruthy();
      expect(screen.queryByText("Empresa B")).toBeNull();
      expect(screen.queryByText("En espera")).toBeNull();
    }
    fireEvent.click(screen.getByRole("button", { name: "Activos" }));
    await waitFor(() => expect(locomotiveOrder()).toEqual(["7604", "7603", "7602", "7601"]));
  },
);

it("uses the natural queue for client Seguimiento and finds a concluded movement beyond the old page limit", async () => {
  const past = Array.from({ length: 110 }, (_, index) => ({
    ...unit(index + 1, index + 1, [
      {
        ...movement(index + 501, index + 7600),
        estado: "CONCLUIDO",
        fechaInicio: "2026-10-11T18:00:00Z",
        fechaFin: "2026-10-11T18:45:00Z",
      },
    ]),
    estado: "CONCLUIDA",
  }));
  const fetcher = vi.fn(async (url: string) =>
    json(url.includes("historial=true") ? past : [unit(1, 1, [movement(1, 1234)])]),
  );
  vi.stubGlobal("fetch", fetcher);
  render(<TorreonNaturalQueue localidadId={2} rol="CLIENTE" view="seguimiento" />);
  await screen.findByRole("table");
  expect(screen.getByRole("link", { name: "Seguimiento" }).getAttribute("href")).toBe(
    "/cliente/movimientos?loc=2",
  );
  fireEvent.click(screen.getByRole("button", { name: "Historial" }));
  await screen.findByText("7709");
  fireEvent.change(screen.getByLabelText("Buscar movimientos"), {
    target: { value: "7709" },
  });
  fireEvent.change(screen.getByLabelText("Fecha a consultar"), {
    target: { value: "fin" },
  });
  fireEvent.change(screen.getByLabelText("Desde"), {
    target: { value: "2026-10-11" },
  });
  fireEvent.change(screen.getByLabelText("Hasta"), {
    target: { value: "2026-10-11" },
  });
  expect(locomotiveOrder()).toEqual(["7709"]);
  expect(fetcher.mock.calls.every(([url]) => url.startsWith("/bff/torreon/cola?"))).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Ver detalle del movimiento 610" }));
  expect(screen.getByRole("columnheader", { name: "Fin" })).toBeTruthy();
  expect(screen.queryByText("Trabajo efectivo")).toBeNull();
});

it("shows effective and total work separately to coordination", async () => {
  const m = {
    ...movement(501, 7620),
    estado: "CONCLUIDO",
    fechaInicio: "2026-10-11T18:00:00Z",
    fechaFin: "2026-10-11T18:45:00Z",
    tiempoActivoSegundos: 600,
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      json(url.startsWith("/bff/usuarios") ? [] : [{ ...unit(71, 1, [m]), estado: "CONCLUIDA" }]),
    ),
  );
  render(<TorreonNaturalQueue localidadId={2} rol="COORDINADOR" view="seguimiento" />);
  await screen.findByRole("table");
  expect(screen.getByText("Trabajo efectivo")).toBeTruthy();
  expect(screen.getByText("10 min")).toBeTruthy();
  expect(screen.getByText("Tiempo total: 45 min")).toBeTruthy();
});

it("does not disguise database identifiers as section numbers when legacy metadata is missing", async () => {
  const m = {
    ...movement(501, 7620),
    seccionOrigenId: 81,
    seccionDestinoId: 91,
    seccionOrigenNumero: null,
    seccionDestinoNumero: null,
    seccionOrigenNombreSnapshot: null,
    seccionDestinoNombreSnapshot: null,
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => json([unit(71, 1, [m])])),
  );
  render(<TorreonNaturalQueue localidadId={2} rol="CLIENTE" />);
  await screen.findByRole("table");
  expect(screen.getAllByText("Número de sección no disponible")).toHaveLength(2);
  expect(screen.queryByText(/Sección #?(81|91)/)).toBeNull();
});

it("offers movement capture only to clients with creation permission", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => json([unit(71, 1, [movement(501, 7620)])])),
  );
  const page = render(<TorreonNaturalQueue localidadId={2} rol="CLIENTE" canCreateMovements />);
  await screen.findByRole("table");
  expect(screen.getByRole("link", { name: "Solicitar movimientos" }).getAttribute("href")).toBe(
    "/movimientos/crear?tipo=NATURAL",
  );
  page.rerender(<TorreonNaturalQueue localidadId={2} rol="CLIENTE" canCreateMovements={false} />);
  expect(screen.queryByRole("link", { name: "Solicitar movimientos" })).toBeNull();
  page.rerender(<TorreonNaturalQueue localidadId={2} rol="COORDINADOR" canCreateMovements />);
  expect(screen.queryByRole("link", { name: "Solicitar movimientos" })).toBeNull();
});

it("counts movements inside conjuntos in the status summary and identifies their grouping separately", async () => {
  const pendingGroup = unit(60, 1, [movement(601, 7601), movement(602, 7602)]);
  const ready = {
    ...unit(61, 2, [{ ...movement(603, 7603), estado: "DETENIDO" }]),
    estado: "LISTA_REANUDAR",
  };
  const stopped = {
    ...unit(62, 3, [{ ...movement(604, 7604), estado: "DETENIDO" }]),
    estado: "DETENIDA",
  };
  const running = {
    ...unit(63, 4, [{ ...movement(605, 7605), estado: "EN_PROCESO" }]),
    estado: "EN_PROCESO",
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => json([pendingGroup, ready, stopped, running])),
  );
  render(<TorreonNaturalQueue localidadId={2} rol="CLIENTE" />);
  await screen.findByRole("table");
  const summary = within(screen.getByRole("group", { name: "Resumen de movimientos" }));
  expect(summary.getByText("Movimientos").parentElement?.querySelector("strong")?.textContent).toBe(
    "5",
  );
  expect(summary.getByText("Por iniciar").parentElement?.querySelector("strong")?.textContent).toBe(
    "2",
  );
  expect(
    summary.getByText("Con incidente").parentElement?.querySelector("strong")?.textContent,
  ).toBe("1");
  expect(
    summary.getByText("Listos para continuar").parentElement?.querySelector("strong")?.textContent,
  ).toBe("1");
  const table = within(screen.getByRole("table"));
  expect(table.getAllByText("Por iniciar")).toHaveLength(2);
  expect(table.getByText("Listo para continuar")).toBeTruthy();
  expect(table.getByText("Con incidente")).toBeTruthy();
  expect(table.getByText("En curso")).toBeTruthy();
  expect(
    screen.getByText(/de 5 movimientos · 3 solicitudes individuales · 1 conjunto/),
  ).toBeTruthy();
});

it("counts concluded and cancelled members in Historial and connects invalid date fields to their error", async () => {
  const concluded = {
    ...unit(70, 1, [movement(701, 7601), movement(702, 7602)]),
    estado: "CONCLUIDA",
  };
  const cancelled = { ...unit(71, 2, [movement(703, 7603)]), estado: "CANCELADA" };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      json(url.includes("historial=true") ? [concluded, cancelled] : []),
    ),
  );
  render(<TorreonNaturalQueue localidadId={2} rol="CLIENTE" view="seguimiento" />);
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Actualizar" }).hasAttribute("disabled")).toBe(false),
  );
  fireEvent.click(screen.getByRole("button", { name: "Historial" }));
  await screen.findByRole("table");
  const summary = within(screen.getByRole("group", { name: "Resumen de movimientos" }));
  expect(summary.getByText("Concluidos").parentElement?.querySelector("strong")?.textContent).toBe(
    "2",
  );
  expect(summary.getByText("Cancelados").parentElement?.querySelector("strong")?.textContent).toBe(
    "1",
  );
  fireEvent.change(screen.getByLabelText("Desde", { exact: true }), {
    target: { value: "2026-10-12" },
  });
  fireEvent.change(screen.getByLabelText("Hasta", { exact: true }), {
    target: { value: "2026-10-01" },
  });
  expect(screen.getByRole("alert").textContent).toContain("La fecha desde no puede ser posterior");
  expect(screen.getByLabelText("Desde", { exact: true }).getAttribute("aria-invalid")).toBe("true");
  expect(screen.getByLabelText("Hasta", { exact: true }).getAttribute("aria-describedby")).toBe(
    screen.getByRole("alert").id,
  );
});

it.each(["CLIENTE", "COORDINADOR", "SUPERVISOR", "ADMINISTRADOR"])(
  "shows independent route poles for %s in table and expanded detail",
  async (rol) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json([unit(71, 1, [movement(501, 7620)])])),
    );
    render(<TorreonNaturalQueue localidadId={2} rol={rol} />);
    const table = await screen.findByRole("table");
    const row = movementRows(table)[0];
    expect(row.textContent).toContain("Polo de salida: Norte");
    expect(row.textContent).toContain("Polo de llegada: Sur");
    fireEvent.click(screen.getByRole("button", { name: "Ver detalle del movimiento 501" }));
    const detail = screen.getByRole("heading", { name: "Operación de vía" }).closest("section")!;
    expect(detail.textContent).toContain("Polo de salida: Norte");
    expect(detail.textContent).toContain("Polo de llegada: Sur");
  },
);
it("does not infer either route pole from the legacy single value", async () => {
  const legacy = { ...movement(501, 7620), polo: "NORTE", poloOrigen: null, poloDestino: null };
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => json([unit(71, 1, [legacy])])),
  );
  render(<TorreonNaturalQueue localidadId={2} rol="CLIENTE" />);
  const table = await screen.findByRole("table");
  expect(within(table).getAllByText("No registrado")).toHaveLength(2);
  expect(within(table).queryByText("Norte")).toBeNull();
  expect(within(table).queryByText("Sur")).toBeNull();
});

const clientActions = { userId: 89, empresaId: 3, canEdit: true, canCancel: true };
it("allows company cancellation but keeps editing owned pending members only", async () => {
  const own = movement(501, 7620);
  const colleague = { ...movement(502, 7621), clienteId: 90, creadoPorId: 91 };
  const foreign = { ...movement(503, 7622), empresaId: 4 };
  const started = { ...movement(504, 7623), estado: "EN_PROCESO", fechaInicio: requestedAt };
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      json([
        unit(71, 1, [own, colleague, foreign]),
        { ...unit(72, 2, [started]), estado: "EN_PROCESO" },
      ]),
    ),
  );
  render(<TorreonNaturalQueue localidadId={2} rol="CLIENTE" clientActions={clientActions} />);
  expect(
    (await screen.findByRole("link", { name: "Editar movimiento 501" })).getAttribute("href"),
  ).toBe("/cliente/editar?id=501&source=torreon");
  expect(screen.queryByRole("link", { name: "Editar movimiento 502" })).toBeNull();
  expect(screen.getByRole("button", { name: "Cancelar movimiento 501" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Cancelar movimiento 502" })).toBeTruthy();
  for (const id of [503, 504])
    expect(screen.queryByRole("link", { name: `Editar movimiento ${id}` })).toBeNull();
  for (const id of [503, 504])
    expect(screen.queryByRole("button", { name: `Cancelar movimiento ${id}` })).toBeNull();
});
it("cancels only one group member after a reason and refreshes the remaining queue", async () => {
  const first = movement(501, 7620),
    second = movement(502, 7621);
  let cancelled = false;
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === "PATCH") {
      cancelled = true;
      return json({ id: 501, estado: "CANCELADO" });
    }
    return json([
      unit(71, 1, cancelled ? [{ ...first, estado: "CANCELADO" }, second] : [first, second]),
    ]);
  });
  vi.stubGlobal("fetch", fetcher);
  render(<TorreonNaturalQueue localidadId={2} rol="CLIENTE" clientActions={clientActions} />);
  fireEvent.click(await screen.findByRole("button", { name: "Cancelar movimiento 501" }));
  const dialog = screen.getByRole("dialog", { name: "Cancelar solicitud #501" });
  expect(within(dialog).getByText(/únicamente esta solicitud/)).toBeTruthy();
  expect(within(dialog).getByRole("button", { name: "Confirmar cancelación" })).toHaveProperty(
    "disabled",
    true,
  );
  fireEvent.change(within(dialog).getByLabelText("Motivo de cancelación"), {
    target: { value: "  Solicitud duplicada  " },
  });
  fireEvent.click(within(dialog).getByRole("button", { name: "Confirmar cancelación" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(fetcher).toHaveBeenCalledWith(
    "/api/cliente/torreon/movimientos/501/cancelar",
    expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({ razon: "Solicitud duplicada" }),
    }),
  );
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "Cancelar movimiento 501" })).toBeNull(),
  );
  expect(screen.queryByRole("link", { name: "Editar movimiento 501" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Ver folio 501" })).toBeNull();
  expect(screen.queryByText("Cancelado")).toBeNull();
  expect(screen.getByRole("button", { name: "Ver folio 502" })).toBeTruthy();
  expect(screen.getByRole("status").textContent).toContain("Solicitud #501 cancelada");
});
it("keeps a failed cancellation open and preserves the movement when the server rejects stale state", async () => {
  const fetcher = vi.fn(async (_url: string, init?: RequestInit) =>
    init?.method === "PATCH"
      ? new Response(JSON.stringify({ message: "La operación ya inició." }), {
          status: 409,
          headers: { "content-type": "application/json" },
        })
      : json([unit(71, 1, [movement(501, 7620)])]),
  );
  vi.stubGlobal("fetch", fetcher);
  render(<TorreonNaturalQueue localidadId={2} rol="CLIENTE" clientActions={clientActions} />);
  fireEvent.click(await screen.findByRole("button", { name: "Cancelar movimiento 501" }));
  fireEvent.change(screen.getByLabelText("Motivo de cancelación"), {
    target: { value: "Cambio de programación" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Confirmar cancelación" }));
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "La operación ya inició.");
  expect(screen.getByRole("dialog")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Conservar solicitud" }));
  expect(screen.getByRole("button", { name: "Ver folio 501" })).toBeTruthy();
});
it.each([
  ["CLIENTE", { ...clientActions, canEdit: false, canCancel: false }],
  ["COORDINADOR", clientActions],
  ["CLIENTE", undefined],
] as const)(
  "does not introduce client actions without signed authorization for %s",
  async (role, actions) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json([unit(71, 1, [movement(501, 7620)])])),
    );
    render(<TorreonNaturalQueue localidadId={2} rol={role} clientActions={actions} />);
    await screen.findByRole("table");
    expect(screen.queryByRole("link", { name: "Editar movimiento 501" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Cancelar movimiento 501" })).toBeNull();
  },
);

it("hides cancelled members only from the active client projection while retaining the original audit target", async () => {
  const cancelled = { ...movement(501, 7620), estado: "CANCELADO" };
  const sibling = movement(502, 7621);
  const original = unit(71, 1, [cancelled, sibling]);
  const fetcher = vi.fn(async (url: string) =>
    url.endsWith("/71/historial")
      ? json([
          {
            id: 91,
            unidadId: 71,
            movimientoId: 501,
            accion: "CANCELAR_SOLICITUD",
            usuarioId: 89,
            rol: "CLIENTE",
            fecha: requestedAt,
          },
        ])
      : json([original]),
  );
  vi.stubGlobal("fetch", fetcher);
  render(<TorreonNaturalQueue localidadId={2} rol="CLIENTE" clientActions={clientActions} />);
  await screen.findByRole("button", { name: "Ver folio 502" });
  expect(screen.queryByRole("button", { name: "Ver folio 501" })).toBeNull();
  expect(movementRows()).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Ver detalle del movimiento 502" }));
  fireEvent.click(screen.getByRole("button", { name: "Ver historial de operación" }));
  const audit = await screen.findByRole("dialog", {
    name: "Historial de operación · Conjunto #71",
  });
  expect(await within(audit).findByText("Locomotora 7620 · Solicitud #501")).toBeTruthy();
  expect(original.movimientos).toEqual([cancelled, sibling]);
  expect(fetcher).toHaveBeenCalledWith("/bff/torreon/cola/71/historial", expect.anything());
});
it("removes a successfully cancelled request immediately even if reloading the queue fails", async () => {
  let cancelled = false;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "PATCH") {
        cancelled = true;
        return json({ id: 501, estado: "CANCELADO" });
      }
      if (cancelled)
        return new Response(JSON.stringify({ message: "No se pudo actualizar la lista." }), {
          status: 503,
        });
      return json([unit(71, 1, [movement(501, 7620), movement(502, 7621)])]);
    }),
  );
  render(<TorreonNaturalQueue localidadId={2} rol="CLIENTE" clientActions={clientActions} />);
  fireEvent.click(await screen.findByRole("button", { name: "Cancelar movimiento 501" }));
  fireEvent.change(screen.getByLabelText("Motivo de cancelación"), {
    target: { value: "Solicitud duplicada" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Confirmar cancelación" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(screen.queryByRole("button", { name: "Ver folio 501" })).toBeNull();
  expect(screen.getByRole("button", { name: "Ver folio 502" })).toBeTruthy();
  await screen.findByRole("alert");
  expect(screen.getByRole("alert").textContent).toContain("No se pudo actualizar la lista.");
});

it.each(["LISTA_REANUDAR", "DETENIDA"])(
  "cancels a %s member with a historical start while preserving its sibling and incident",
  async (estado) => {
    const historical = "2026-10-15T17:35:00-06:00";
    const first = { ...movement(501, 7620), estado: "DETENIDO", fechaInicio: historical };
    const second = {
      ...movement(502, 7621),
      estado: "DETENIDO",
      fechaInicio: "2026-10-15T14:16:00-06:00",
    };
    const incident = {
      id: 90,
      movimientoId: 501,
      estado: estado === "DETENIDA" ? "ABIERTO" : "RESUELTO",
      motivo: "Inspección",
      fechaInicio: historical,
    };
    const original = {
      ...unit(71, 1, [first, second]),
      estado,
      fechaInicio: historical,
      incidentes: [incident],
    };
    let cancelled = false;
    const fetcher = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "PATCH") {
        cancelled = true;
        return json({ id: 501, estado: "CANCELADO" });
      }
      return json([
        {
          ...original,
          movimientos: cancelled ? [{ ...first, estado: "CANCELADO" }, second] : [first, second],
        },
      ]);
    });
    vi.stubGlobal("fetch", fetcher);
    render(
      <TorreonNaturalQueue
        localidadId={2}
        rol="CLIENTE"
        view="seguimiento"
        clientActions={clientActions}
      />,
    );
    await screen.findByRole("button", { name: "Cancelar movimiento 501" });
    expect(screen.getByRole("button", { name: "Cancelar movimiento 502" })).toBeTruthy();
    if (estado === "LISTA_REANUDAR")
      expect(screen.getAllByText("Listo para continuar")).toHaveLength(2);
    for (const id of [501, 502])
      expect(screen.queryByRole("link", { name: `Editar movimiento ${id}` })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar movimiento 501" }));
    expect(screen.getByText(/Cancelar no resuelve los incidentes pendientes/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Motivo de cancelación"), {
      target: { value: "No continuará la solicitud" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar cancelación" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.queryByRole("button", { name: "Ver folio 501" })).toBeNull();
    expect(screen.getByRole("button", { name: "Cancelar movimiento 502" })).toBeTruthy();
    expect(fetcher).toHaveBeenCalledWith(
      "/api/cliente/torreon/movimientos/501/cancelar",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ razon: "No continuará la solicitud" }),
      }),
    );
    expect(original.movimientos).toEqual([first, second]);
    expect(original.incidentes).toEqual([incident]);
    expect(original.fechaInicio).toBe(historical);
  },
);
