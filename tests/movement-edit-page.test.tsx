import { beforeEach, describe, expect, it, vi } from "vitest";
import { loginProfile } from "./fixtures/authorization";
import MovementEditPage from "@/features/movimientos/editar/MovementEditPage";
import TorreonNaturalEdit from "@/features/movimientos/editar/TorreonNaturalEdit";
import EditarMovimiento from "@/features/movimientos/editar/EditarMovimiento";
import { PERMISSIONS } from "@/lib/accessControl";
import { TRAINING_MOVEMENT_ID } from "@/features/capacitacion/TrainingTourContext";

const session = vi.hoisted(() => vi.fn());
vi.mock("@/lib/server/session", () => ({ getVerifiedSession: session }));
vi.mock("@/features/movimientos/editar/EditarMovimiento", () => ({ default: () => null }));
vi.mock("@/features/movimientos/editar/TorreonNaturalEdit", () => ({ default: () => null }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));

beforeEach(() =>
  session.mockResolvedValue({ role: "CLIENTE", localidadId: 2, authorization: loginProfile() }),
);

describe("movement editor source and role", () => {
  it("opens Torreón for a local client even through an old link", async () => {
    const page = await MovementEditPage({ searchParams: Promise.resolve({ id: "4" }) });
    expect(page.props.children.type).toBe(TorreonNaturalEdit);
    expect(page.props.children.props).toEqual({ movimientoId: 4 });
  });
  it.each([
    { localidadId: 1, source: "torreon" },
    { localidadId: 2, source: "cosaif" },
  ])(
    "keeps the selected movement source $source when the session locality is $localidadId",
    async ({ localidadId, source }) => {
      session.mockResolvedValue({
        role: "CLIENTE_ADMIN",
        localidadId,
        authorization: loginProfile("CLIENTE_ADMIN"),
      });
      const page = await MovementEditPage({ searchParams: Promise.resolve({ id: "4", source }) });
      expect(page.props.children.type).toBe(
        source === "torreon" ? TorreonNaturalEdit : EditarMovimiento,
      );
      if (source === "cosaif")
        expect(page.props.children.props).toMatchObject({ movimientoId: 4, source });
    },
  );
  it.each(["SUPERVISOR", "COORDINADOR"] as const)(
    "does not open the editor for %s with old permissions",
    async (role) => {
      session.mockResolvedValue({ role, localidadId: 2, authorization: loginProfile(role) });
      await expect(
        MovementEditPage({ searchParams: Promise.resolve({ id: "4", source: "torreon" }) }),
      ).rejects.toThrow("redirect:");
    },
  );
});

it.each(["CLIENTE", "CLIENTE_ADMIN", "CLIENTE_COOR"] as const)(
  "mounts the real natural editor for %s",
  async (role) => {
    session.mockResolvedValue({ role, localidadId: 2, authorization: loginProfile(role) });
    const page = await MovementEditPage({
      searchParams: Promise.resolve({ id: "501", source: "torreon" }),
    });
    expect(page.props.children.type).toBe(TorreonNaturalEdit);
    expect(page.props.children.props).toEqual({ movimientoId: 501 });
  },
);
it("keeps GDL in its existing editor with exactly the previous props", async () => {
  session.mockResolvedValue({ role: "CLIENTE", localidadId: 1, authorization: loginProfile() });
  const page = await MovementEditPage({ searchParams: Promise.resolve({ id: "501" }) });
  expect(page.props.children.type).toBe(EditarMovimiento);
  expect(page.props.children.props).toEqual({
    movimientoId: 501,
    initialRole: "CLIENTE",
    source: "cosaif",
  });
});
it("keeps administrator editing in its existing component", async () => {
  session.mockResolvedValue({
    role: "ADMINISTRADOR",
    localidadId: 2,
    authorization: loginProfile("ADMINISTRADOR"),
  });
  const page = await MovementEditPage({
    searchParams: Promise.resolve({ id: "501", source: "torreon" }),
  });
  expect(page.props.children.type).toBe(EditarMovimiento);
  expect(page.props.children.props).toEqual({
    movimientoId: 501,
    initialRole: "ADMINISTRADOR",
    source: "torreon",
  });
});
it("does not mount either live editor without the edit permission", async () => {
  const authorization = loginProfile();
  authorization.permissions = authorization.permissions.filter(
    (permission) => permission !== PERMISSIONS.MOVEMENTS_EDIT,
  );
  session.mockResolvedValue({ role: "CLIENTE", localidadId: 2, authorization });
  await expect(
    MovementEditPage({ searchParams: Promise.resolve({ id: "501", source: "torreon" }) }),
  ).rejects.toThrow("redirect:/cliente");
});
it("keeps reserved training movements in the existing simulation editor", async () => {
  const page = await MovementEditPage({
    searchParams: Promise.resolve({
      id: String(TRAINING_MOVEMENT_ID),
      source: "torreon",
      training: "1",
    }),
  });
  expect(page.props.children.type).toBe(EditarMovimiento);
  expect(page.props.children.props.source).toBe("cosaif");
});
