// @vitest-environment jsdom
import { StrictMode } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useCrearMovimientoController } from "@/features/movimientos/crear/useCrearMovimientoController";
import type { MovementFormData } from "@/features/movimientos/movimientos.shared";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  loadCatalogos: vi.fn(),
  hydrateDraft: vi.fn(),
  hydratePendingCount: vi.fn(),
  initFormLocked: vi.fn(),
  enforceLockedLocality: vi.fn(),
  ensureSections: vi.fn(),
  adminRoles: ["ADMINISTRADOR"],
  localityAdminRoles: ["ADMINISTRADOR"],
  setForm: null as null | ((update: (prev: MovementFormData) => MovementFormData) => void),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/features/movimientos/crear/useCrearMovimientoSession", () => ({
  getRoleClient: () => "CLIENTE",
  readStoredUserClient: () => ({ id: 7, empresaId: 3, localidadId: 2 }),
  readNumericCookieClient: () => NaN,
  useCrearMovimientoSession: () => ({
    rol: "CLIENTE",
    user: { id: 7, empresaId: 3, localidadId: 2 },
    canManageAll: false,
    canChooseLocality: false,
    userCompanyName: "Ferrocarril del Norte",
    adminRoles: mocks.adminRoles,
    localityAdminRoles: mocks.localityAdminRoles,
    initFormLocked: mocks.initFormLocked,
    enforceLockedLocality: mocks.enforceLockedLocality,
  }),
}));
vi.mock("@/features/movimientos/crear/useCrearMovimientoCatalogos", () => ({
  useCrearMovimientoCatalogos: () => ({
    empresas: [],
    localidades: [],
    vias: [],
    viasLoading: false,
    viasError: null,
    sectionsByVia: {},
    secLoading: {},
    loadCatalogos: mocks.loadCatalogos,
    reloadVias: mocks.ensureSections,
    ensureSections: mocks.ensureSections,
  }),
}));
vi.mock("@/features/movimientos/crear/useCrearMovimientoDraft", () => ({
  useCrearMovimientoDraft: ({ setForm }: { setForm: typeof mocks.setForm }) => {
    mocks.setForm = setForm;
    return {
      hydrateDraft: mocks.hydrateDraft,
      clearDraft: mocks.ensureSections,
      savedAt: null,
      saveError: null,
    };
  },
}));
vi.mock("@/features/movimientos/crear/useCrearMovimientoOutbox", () => ({
  useCrearMovimientoOutbox: () => ({
    online: true,
    pendingCount: 0,
    pendingItems: [],
    syncing: false,
    banner: null,
    hydratePendingCount: mocks.hydratePendingCount,
  }),
}));
vi.mock("@/features/movimientos/crear/useCrearMovimientoSubmit", () => ({
  useCrearMovimientoSubmit: () => ({ sending: false, submit: mocks.ensureSections }),
}));
vi.mock("@/features/movimientos/crear/tornoPdf", () => ({ downloadTornoPdf: () => {} }));

let resolveCatalogs!: (data: {
  eList: { id: number; nombre: string }[];
  lList: { id: number; nombre: string }[];
}) => void;
function Context() {
  const value = useCrearMovimientoController();
  return (
    <output>{value.contextReady ? `Ready: ${value.form.locomotiveNumber}` : "Preparing"}</output>
  );
}
beforeEach(() => {
  const pending = new Promise((resolve) => {
    resolveCatalogs = resolve;
  });
  mocks.loadCatalogos.mockReturnValue(pending);
  mocks.hydrateDraft.mockImplementation(() => {
    mocks.setForm?.((prev) => ({
      ...prev,
      locomotiveNumber: "121",
      empresaId: 3,
      creadoPorId: 7,
      selectedLocalityId: 2,
    }));
  });
});
afterEach(() => cleanup());

it("finishes restored context under StrictMode instead of remaining in the cancelled initial bootstrap", async () => {
  render(
    <StrictMode>
      <Context />
    </StrictMode>,
  );
  expect(screen.getByText("Preparing")).toBeTruthy();
  expect(mocks.hydrateDraft).not.toHaveBeenCalled();
  await act(async () =>
    resolveCatalogs({
      eList: [{ id: 3, nombre: "Ferrocarril del Norte" }],
      lList: [{ id: 2, nombre: "Torreón" }],
    }),
  );
  expect(await screen.findByText("Ready: 121")).toBeTruthy();
  expect(mocks.hydrateDraft).toHaveBeenCalledOnce();
  expect(mocks.hydratePendingCount).toHaveBeenCalledOnce();
});

it("does not restore a draft after leaving the creation page during initialization", async () => {
  const page = render(<Context />);
  expect(screen.getByText("Preparing")).toBeTruthy();
  page.unmount();
  await act(async () => resolveCatalogs({ eList: [], lList: [] }));
  expect(mocks.hydrateDraft).not.toHaveBeenCalled();
  expect(mocks.hydratePendingCount).not.toHaveBeenCalled();
});
