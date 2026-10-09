// @vitest-environment jsdom
import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import CrearMovimiento from "@/features/movimientos/crear/CrearMovimiento";
import { baseInitialForm, type MovementFormData } from "@/features/movimientos/movimientos.shared";

const state = vi.hoisted(() => ({
  query: "tipo=NATURAL",
  controller: {} as Record<string, unknown>,
  push: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: state.push }),
  useSearchParams: () => new URLSearchParams(state.query),
}));
vi.mock("@/hooks/useMounted", () => ({ useMounted: () => true }));
vi.mock("@/lib/theme", () => ({
  getInitialTheme: () => "light",
  applyTheme() {},
  onThemeChange: () => () => {},
}));
vi.mock("@/features/capacitacion", () => ({
  GuidedTarget: ({ children }: { children: ReactNode }) => children,
  useGuidedManual: () => null,
  useGuidedManualApi: () => null,
}));
vi.mock("@/features/capacitacion/TrainingTourContext", () => ({
  useTrainingTour: () => ({ active: false, roleBase: "/cliente", trainingScenario: "natural" }),
}));
vi.mock("@/features/movimientos/crear/useCrearMovimientoController", () => ({
  useCrearMovimientoController: () => state.controller,
}));
vi.mock("@/features/movimientos/Movimiento", () => ({
  Movimiento: { clsx: (...values: unknown[]) => values.filter(Boolean).join(" ") },
}));
vi.mock("@/features/movimientos/offline/OutboxPanel", () => ({ OutboxPanel: () => null }));
vi.mock("@/features/movimientos/crear/components/ui", () => ({
  Badge: ({ children }: { children: ReactNode }) => children,
  RoleBadge: () => null,
}));
vi.mock("@/features/movimientos/crear/components/StepOne", () => ({
  default: ({ form }: { form: MovementFormData }) => (
    <div>Paso legado de datos{form.service ? ` · ${form.service}` : ""}</div>
  ),
}));
vi.mock("@/features/movimientos/crear/components/StepTwo", () => ({
  default: () => <div>Detalles legados</div>,
}));
vi.mock("@/features/movimientos/crear/components/StepTwoTorno", () => ({
  default: () => <div>Medidas de Torno</div>,
}));
vi.mock("@/features/movimientos/crear/components/StepThree", () => ({
  default: () => <div>Confirmación legada</div>,
}));
vi.mock("@/features/movimientos/crear/components/StepFourTorno", () => ({
  default: () => <div>PDF de Torno</div>,
}));
vi.mock("@/features/movimientos/crear/components/MobileGuidedTornoMeasuresStep", () => ({
  default: () => <div>Medidas guiadas de Torno</div>,
  getGuidedTornoMeasuresPageCount: () => 3,
  getGuidedTornoMeasuresPageTitle: () => "Mediciones",
}));
const json = (data: unknown) =>
  new Response(JSON.stringify(data), { headers: { "content-type": "application/json" } });
function controller(formPatch: Partial<MovementFormData> = {}) {
  return {
    step: 1,
    contextReady: true,
    form: { ...baseInitialForm, empresaId: 3, creadoPorId: 7, selectedLocalityId: 2, ...formPatch },
    setForm: vi.fn(),
    sending: false,
    errors: {},
    banner: null,
    empresas: [{ id: 3, nombre: "Ferrocarril del Norte" }],
    localidades: [],
    vias: [
      { id: 8, nombre: "Vía A" },
      { id: 9, nombre: "Vía B" },
    ],
    viasLoading: false,
    viasError: null,
    reloadVias: vi.fn(),
    sectionsByVia: { 8: [], 9: [] } as Record<
      number,
      { id: number; numero: number; nombre: string }[]
    >,
    secLoading: {},
    rol: "CLIENTE",
    canManageAll: false,
    canChooseLocality: false,
    userCompanyName: "Ferrocarril del Norte",
    showFromOpts: false,
    showToOpts: false,
    selectionMode: "de_via",
    fromSection: undefined as number | undefined,
    toSection: undefined as number | undefined,
    locoLockedBy: null,
    tornoMedicion: { wheelCount: 8, rows: {} },
    hasTornoPdfStep: false,
    tornoStep2Completed: false,
    tornoMovimientoId: null,
    scheduledTornoMovements: [],
    online: true,
    pendingItems: [],
    syncing: false,
    savedAt: null,
    saveError: null,
    validate1: vi.fn(() => true),
    validate2: vi.fn(() => true),
    ensureSections: vi.fn(),
    lockedClienteMissingData: false,
    goSalir: vi.fn(),
    goPrev: vi.fn(),
    goNext: vi.fn(),
    clearForm: vi.fn(),
    clearTornoMedicion: vi.fn(),
  };
}
beforeEach(() => {
  state.query = "tipo=NATURAL";
  state.controller = controller();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("opens Torreón natural capture directly from its explicit entry without the service wizard", () => {
  render(<CrearMovimiento />);
  expect(screen.getByRole("heading", { name: "Solicitar movimientos" })).toBeTruthy();
  expect(screen.getByLabelText("Locomotora solicitada")).toBeTruthy();
  expect(screen.queryByText(/Paso legado de datos/)).toBeNull();
  expect(screen.queryByRole("button", { name: "Continuar" })).toBeNull();
});

it("waits for restored context before initializing the natural draft", () => {
  const current = controller();
  state.controller = { ...current, contextReady: false };
  const page = render(<CrearMovimiento />);
  expect(screen.getByRole("status").textContent).toBe("Preparando la captura de Torreón…");
  expect(screen.queryByLabelText("Locomotora solicitada")).toBeNull();
  state.controller = {
    ...current,
    form: { ...current.form, locomotiveNumber: "9876", fromTrack: 8, toTrack: 9, polo: "NORTE" },
    contextReady: true,
  };
  page.rerender(<CrearMovimiento />);
  expect((screen.getByLabelText("Locomotora solicitada") as HTMLInputElement).value).toBe("9876");
  expect((screen.getByLabelText("Vía de origen") as HTMLSelectElement).value).toBe("8");
});

it.each([
  ["old route", "", {}, {}],
  ["other requested type", "tipo=TORNO", {}, {}],
  ["GDL", "tipo=NATURAL", { selectedLocalityId: 1 }, {}],
  ["missing company", "tipo=NATURAL", { empresaId: null }, {}],
  ["missing user", "tipo=NATURAL", { creadoPorId: null }, {}],
  ["non-client role", "tipo=NATURAL", {}, { rol: "COORDINADOR" }],
  ["client allowed to choose locality", "tipo=NATURAL", {}, { canChooseLocality: true }],
  ["client allowed to choose company", "tipo=NATURAL", {}, { canManageAll: true }],
  ["training sandbox", "tipo=NATURAL&training=1", {}, {}],
] as const)("preserves the existing wizard for %s", (_name, query, formPatch, controllerPatch) => {
  state.query = query;
  state.controller = { ...controller(formPatch), ...controllerPatch };
  render(<CrearMovimiento />);
  expect(screen.getByText("Paso legado de datos")).toBeTruthy();
  expect(screen.queryByLabelText("Locomotora solicitada")).toBeNull();
});

it("keeps the normal Torno entry in its original wizard", () => {
  state.query = "";
  state.controller = controller({ service: "Torno", locomotiveNumber: "800" });
  render(<CrearMovimiento />);
  expect(screen.getByText("Paso legado de datos · Torno")).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "Solicitar movimientos" })).toBeNull();
});

it("starts a fresh natural capture and preserves an existing service draft after sending", async () => {
  const current = controller({
    service: "Torno",
    locomotiveNumber: "800",
    fromTrack: 8,
    toTrack: null,
    comments: "Conservar medidas de Torno",
  });
  current.tornoMedicion.rows = { L1: { alturaCeja: { whole: "12", num: "", den: "" } } };
  state.controller = current;
  const oldForm = { ...current.form };
  const oldMeasures = structuredClone(current.tornoMedicion);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => json([{ id: 101 }])),
  );
  render(<CrearMovimiento />);
  expect((screen.getByLabelText("Locomotora solicitada") as HTMLInputElement).value).toBe("");
  expect((screen.getByLabelText("Indicaciones adicionales") as HTMLTextAreaElement).value).toBe("");
  fireEvent.change(screen.getByLabelText("Locomotora solicitada"), { target: { value: "121" } });
  fireEvent.change(screen.getByLabelText("Vía de origen"), { target: { value: "8" } });
  fireEvent.change(screen.getByLabelText("Vía de destino"), { target: { value: "9" } });
  fireEvent.change(screen.getByLabelText("Polo de patio"), { target: { value: "NORTE" } });
  fireEvent.click(screen.getByRole("button", { name: "Revisar envío" }));
  fireEvent.click(screen.getByRole("button", { name: "Enviar 1 solicitud" }));
  await waitFor(() => expect(current.goSalir).toHaveBeenCalledOnce());
  expect(current.clearForm).not.toHaveBeenCalled();
  expect(current.setForm).not.toHaveBeenCalled();
  expect(current.form).toEqual(oldForm);
  expect(current.tornoMedicion).toEqual(oldMeasures);
});

it("transfers a natural draft with its real section ids and clears it only after a successful send", async () => {
  const current = controller({
    locomotiveNumber: "121",
    fromTrack: 8,
    toTrack: 9,
    polo: "NORTE",
    comments: "Mover lentamente",
  });
  current.sectionsByVia = {
    8: [{ id: 81, numero: 1, nombre: "Salida sur" }],
    9: [{ id: 91, numero: 2, nombre: "Taller" }],
  };
  current.fromSection = 1;
  current.toSection = 2;
  state.controller = current;
  const fetcher = vi.fn<(url: string, options?: RequestInit) => Promise<Response>>(async () =>
    json([{ id: 101 }]),
  );
  vi.stubGlobal("fetch", fetcher);
  render(<CrearMovimiento />);
  expect((screen.getByLabelText("Locomotora solicitada") as HTMLInputElement).value).toBe("121");
  expect((screen.getByLabelText("Posición de origen") as HTMLSelectElement).value).toBe("81");
  expect((screen.getByLabelText("Posición de destino") as HTMLSelectElement).value).toBe("91");
  expect(current.clearForm).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Revisar envío" }));
  fireEvent.click(screen.getByRole("button", { name: "Enviar 1 solicitud" }));
  await waitFor(() => expect(current.goSalir).toHaveBeenCalledOnce());
  expect(current.clearForm).toHaveBeenCalledOnce();
  const sent = JSON.parse(fetcher.mock.calls[0][1]!.body as string);
  expect(sent.movimientos[0]).toMatchObject({
    seccionOrigenId: 81,
    seccionDestinoId: 91,
    instrucciones: "Mover lentamente",
  });
});
