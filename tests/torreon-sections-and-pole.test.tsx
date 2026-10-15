// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { poleLabel, sectionPositionLabel } from "@/features/torreon/naturales/queueView";
import TorreonNaturalEdit from "@/features/movimientos/editar/TorreonNaturalEdit";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
const json = (value: unknown) =>
  new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } });
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it("prefers verified section numbers, keeps explicit legacy numbers and never turns a database id into a section number", () => {
  expect(poleLabel("CENTRO")).toBe("Centro");
  expect(sectionPositionLabel(1, "Salida sur", true)).toBe("Sección 1 · Salida sur");
  expect(sectionPositionLabel(2, "Sección 2", true)).toBe("Sección 2");
  expect(sectionPositionLabel(3, "Sección 91 · Taller", true)).toBe("Sección 3 · Taller");
  expect(sectionPositionLabel(null, "Sección 2 · Taller", true)).toBe("Sección 2 · Taller");
  expect(sectionPositionLabel(null, "Salida sur", true)).toBe("Sección sin número · Salida sur");
  expect(sectionPositionLabel(null, null, true)).toBe("Número de sección no disponible");
  expect(sectionPositionLabel(null, "Sección #81", true)).toBe("Número de sección no disponible");
  expect(sectionPositionLabel(null, null, false)).toBe("Sin sección especificada");
});

const movement = {
  id: 501,
  estado: "SOLICITADO",
  locomotiveNumber: 7620,
  prioridad: "BAJA",
  tipoMovimiento: "MD_TRABAJANDO",
  instrucciones: "Mover lentamente",
  polo: "SUR",
  poloOrigen: "NORTE",
  poloDestino: "SUR",
  posicionChimenea: "DENTRO",
  posicionCabina: "AFUERA",
  direccionEmpuje: "Sin_Solicitar",
  seccionOrigenId: 81,
  seccionOrigenNumero: 1,
  seccionOrigenNombreSnapshot: "Salida sur",
  viaOrigenNombreSnapshot: "Vía 29",
  seccionDestinoId: 91,
  seccionDestinoNumero: 3,
  seccionDestinoNombreSnapshot: "Sección 3",
  viaDestinoNombreSnapshot: "Vía 3",
};

it.each(["NORTE", "CENTRO"])(
  "shows real sections and asymmetric poles, sending only the edited destination pole %s",
  async (destination) => {
    const fetcher = vi.fn(async (_url: string, options?: RequestInit) =>
      json(options?.method === "PATCH" ? { ok: true } : movement),
    );
    vi.stubGlobal("fetch", fetcher);
    render(<TorreonNaturalEdit movimientoId={501} />);
    const origin = await screen.findByLabelText("Polo de salida");
    expect(origin).toHaveProperty("value", "NORTE");
    expect(screen.getByLabelText("Polo de llegada")).toHaveProperty("value", "SUR");
    expect(screen.getByText("Sección 1 · Salida sur")).toBeTruthy();
    expect(screen.getByText("Sección 3")).toBeTruthy();
    expect(screen.queryByLabelText(/chimenea|cabina/i)).toBeNull();
    fireEvent.change(screen.getByLabelText("Polo de llegada"), { target: { value: destination } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/cliente/movimientos"));
    const patch = fetcher.mock.calls.find(([, options]) => options?.method === "PATCH")!;
    expect(JSON.parse(patch[1]!.body as string)).toEqual({ poloDestino: destination });
  },
);
it("opens legacy data with no inferred poles and edits instructions without overwriting them", async () => {
  const fetcher = vi.fn(async (_url: string, options?: RequestInit) =>
    json(
      options?.method === "PATCH"
        ? { ok: true }
        : { ...movement, polo: "NORTE", poloOrigen: null, poloDestino: null },
    ),
  );
  vi.stubGlobal("fetch", fetcher);
  render(<TorreonNaturalEdit movimientoId={501} />);
  const pole = await screen.findByLabelText("Polo de salida");
  expect(pole).toHaveProperty("value", "");
  expect(screen.getByLabelText("Polo de llegada")).toHaveProperty("value", "");
  expect(screen.getAllByRole("option", { name: "No registrado" })).toHaveLength(2);
  fireEvent.change(screen.getByLabelText("Instrucciones"), {
    target: { value: "Confirmar posición" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  await waitFor(() => expect(router.push).toHaveBeenCalled());
  const patch = fetcher.mock.calls.find(([, options]) => options?.method === "PATCH")!;
  expect(JSON.parse(patch[1]!.body as string)).toEqual({ instrucciones: "Confirmar posición" });
});
it("can explicitly complete both missing legacy poles as Centro to Centro", async () => {
  const fetcher = vi.fn(async (_url: string, options?: RequestInit) =>
    json(
      options?.method === "PATCH"
        ? { ok: true }
        : { ...movement, poloOrigen: null, poloDestino: null },
    ),
  );
  vi.stubGlobal("fetch", fetcher);
  render(<TorreonNaturalEdit movimientoId={501} />);
  fireEvent.change(await screen.findByLabelText("Polo de salida"), { target: { value: "CENTRO" } });
  fireEvent.change(screen.getByLabelText("Polo de llegada"), { target: { value: "CENTRO" } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  await waitFor(() => expect(router.push).toHaveBeenCalled());
  const patch = fetcher.mock.calls.find(([, options]) => options?.method === "PATCH")!;
  expect(JSON.parse(patch[1]!.body as string)).toEqual({
    poloOrigen: "CENTRO",
    poloDestino: "CENTRO",
  });
});
it("rejects clearing an existing pole while preserving the other value", async () => {
  const fetcher = vi.fn(async () => json(movement));
  vi.stubGlobal("fetch", fetcher);
  render(<TorreonNaturalEdit movimientoId={501} />);
  fireEvent.change(await screen.findByLabelText("Polo de salida"), { target: { value: "" } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  expect(screen.getByRole("alert").textContent).toBe("Selecciona el polo de salida.");
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it("allows clearing an optional Norte section without changing the other endpoint", async () => {
  const fetcher = vi.fn(async (_url: string, options?: RequestInit) =>
    json(options?.method === "PATCH" ? { ok: true } : movement),
  );
  vi.stubGlobal("fetch", fetcher);
  render(<TorreonNaturalEdit movimientoId={501} />);
  fireEvent.change(await screen.findByLabelText("Sección de origen"), { target: { value: "" } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  await waitFor(() => expect(router.push).toHaveBeenCalled());
  const patch = fetcher.mock.calls.find(([, options]) => options?.method === "PATCH")!;
  expect(JSON.parse(patch[1]!.body as string)).toEqual({ seccionOrigenId: null });
});
it("requires a section when editing a destination to Centro and sends the selected catalogue ID", async () => {
  const fetcher = vi.fn(async (url: string, options?: RequestInit) =>
    json(
      options?.method === "PATCH"
        ? { ok: true }
        : url.includes("/secciones/")
          ? [{ id: 91, numero: 3, nombre: "Taller" }]
          : {
              ...movement,
              viaDestinoId: 9,
              seccionDestinoId: null,
              seccionDestinoNumero: null,
              seccionDestinoNombreSnapshot: null,
            },
    ),
  );
  vi.stubGlobal("fetch", fetcher);
  render(<TorreonNaturalEdit movimientoId={501} />);
  fireEvent.change(await screen.findByLabelText("Polo de llegada"), {
    target: { value: "CENTRO" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  expect(screen.getByRole("alert").textContent).toContain("sección de destino para el polo Centro");
  expect(fetcher.mock.calls.some(([, options]) => options?.method === "PATCH")).toBe(false);
  await screen.findByRole("option", { name: "Sección 3 · Taller" });
  fireEvent.change(screen.getByLabelText("Sección de destino"), { target: { value: "91" } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  await waitFor(() => expect(router.push).toHaveBeenCalled());
  const patch = fetcher.mock.calls.find(([, options]) => options?.method === "PATCH")!;
  expect(JSON.parse(patch[1]!.body as string)).toEqual({
    poloDestino: "CENTRO",
    seccionDestinoId: 91,
  });
});

it("edits real routes, sections and towing details without changing the signed scope", async () => {
  const fetcher = vi.fn(async (url: string, options?: RequestInit) => {
    if (options?.method === "PATCH") return json({ ok: true });
    if (url.includes("/vias/localidad/2/lite"))
      return json([
        { id: 8, nombre: "Vía 29" },
        { id: 9, nombre: "Vía 3" },
        { id: 10, nombre: "Vía nueva" },
      ]);
    if (url.includes("/secciones/secciones/via/"))
      return json(
        url.endsWith("/10")
          ? [{ id: 101, numero: 4, nombre: "Acceso" }]
          : [
              { id: 81, numero: 1, nombre: "Patio" },
              { id: 91, numero: 3, nombre: "Taller" },
            ],
      );
    return json({ ...movement, localidadId: 2, empresaId: 3, viaOrigenId: 8, viaDestinoId: 9 });
  });
  vi.stubGlobal("fetch", fetcher);
  render(<TorreonNaturalEdit movimientoId={501} />);
  await waitFor(() => expect(screen.getAllByRole("option", { name: "Vía nueva" })).toHaveLength(2));
  expect(screen.getByRole("link", { name: "Volver a movimientos" }).getAttribute("href")).toBe(
    "/cliente/movimientos?loc=2",
  );
  fireEvent.change(screen.getByLabelText("Vía de destino"), { target: { value: "10" } });
  expect(screen.getByLabelText("Sección de destino")).toHaveProperty("value", "");
  fireEvent.change(screen.getByLabelText("Polo de llegada"), { target: { value: "CENTRO" } });
  await screen.findByRole("option", { name: "Sección 4 · Acceso" });
  fireEvent.change(screen.getByLabelText("Sección de destino"), { target: { value: "101" } });
  fireEvent.change(screen.getByLabelText("Tipo de movimiento"), { target: { value: "REMOLCADA" } });
  fireEvent.change(screen.getByLabelText("Locomotora que remolca"), { target: { value: "9900" } });
  fireEvent.change(screen.getByLabelText("Dirección de empuje"), { target: { value: "JALAR" } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  await waitFor(() => expect(router.push).toHaveBeenCalledWith("/cliente/movimientos?loc=2"));
  const patch = fetcher.mock.calls.find(([, options]) => options?.method === "PATCH")!;
  expect(JSON.parse(patch[1]!.body as string)).toEqual({
    viaDestinoId: 10,
    seccionDestinoId: 101,
    poloDestino: "CENTRO",
    tipoMovimiento: "REMOLCADA",
    locomotoraRemolque: 9900,
    direccionEmpuje: "JALAR",
  });
});
it("requires a different towing locomotive and a direction when changing to remolcada", async () => {
  const fetcher = vi.fn(async () => json(movement));
  vi.stubGlobal("fetch", fetcher);
  render(<TorreonNaturalEdit movimientoId={501} />);
  fireEvent.change(await screen.findByLabelText("Tipo de movimiento"), {
    target: { value: "REMOLCADA" },
  });
  fireEvent.change(screen.getByLabelText("Locomotora que remolca"), { target: { value: "7620" } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  expect(screen.getByRole("alert").textContent).toContain("distinta a la solicitada");
  fireEvent.change(screen.getByLabelText("Locomotora que remolca"), { target: { value: "9900" } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  expect(screen.getByRole("alert").textContent).toContain("Empujar o Jalar");
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("clears towing data explicitly when changing back to its own means", async () => {
  const fetcher = vi.fn(async (_url: string, options?: RequestInit) =>
    json(
      options?.method === "PATCH"
        ? { ok: true }
        : {
            ...movement,
            tipoMovimiento: "REMOLCADA",
            locomotoraRemolque: 9900,
            direccionEmpuje: "JALAR",
          },
    ),
  );
  vi.stubGlobal("fetch", fetcher);
  render(<TorreonNaturalEdit movimientoId={501} />);
  fireEvent.change(await screen.findByLabelText("Tipo de movimiento"), {
    target: { value: "MD_TRABAJANDO" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  await waitFor(() => expect(router.push).toHaveBeenCalled());
  const patch = fetcher.mock.calls.find(([, options]) => options?.method === "PATCH")!;
  expect(JSON.parse(patch[1]!.body as string)).toEqual({
    tipoMovimiento: "MD_TRABAJANDO",
    locomotoraRemolque: null,
    direccionEmpuje: "Sin_Solicitar",
  });
});
it("keeps legacy towing and section values unchanged when only instructions are corrected", async () => {
  const fetcher = vi.fn(async (_url: string, options?: RequestInit) =>
    json(
      options?.method === "PATCH"
        ? { ok: true }
        : {
            ...movement,
            tipoMovimiento: "REMOLCADA",
            locomotoraRemolque: null,
            poloDestino: "CENTRO",
            seccionDestinoId: null,
          },
    ),
  );
  vi.stubGlobal("fetch", fetcher);
  render(<TorreonNaturalEdit movimientoId={501} />);
  fireEvent.change(await screen.findByLabelText("Instrucciones"), {
    target: { value: "Nueva indicación" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  await waitFor(() => expect(router.push).toHaveBeenCalled());
  const patch = fetcher.mock.calls.find(([, options]) => options?.method === "PATCH")!;
  expect(JSON.parse(patch[1]!.body as string)).toEqual({ instrucciones: "Nueva indicación" });
});
it.each([
  { estado: "EN_PROCESO" },
  { fechaInicio: "2026-10-15T12:00:00Z" },
  { unidad: { estado: "DETENIDA" } },
])("opens stale or started movement data read-only: %j", async (patch) => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => json({ ...movement, ...patch })),
  );
  render(<TorreonNaturalEdit movimientoId={501} />);
  expect(await screen.findByLabelText("Locomotora")).toHaveProperty("disabled", true);
  expect(screen.queryByRole("button", { name: "Guardar cambios" })).toBeNull();
});
