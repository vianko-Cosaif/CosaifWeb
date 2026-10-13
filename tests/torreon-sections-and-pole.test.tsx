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
