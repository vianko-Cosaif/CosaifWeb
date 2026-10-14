import { beforeEach, expect, it, vi } from "vitest";
import Page from "@/app/cliente/movimientos/page";
import MovimientosPanel from "@/features/movimientos/list/MovimientosPanel";
import TorreonNaturalQueue from "@/features/torreon/naturales/components/TorreonNaturalQueue";
import { loginProfile } from "./fixtures/authorization";

const session = vi.hoisted(() => vi.fn());
vi.mock("@/lib/server/session", () => ({ getVerifiedSession: session }));
vi.mock("@/features/movimientos/list/MovimientosPanel", () => ({
  default: () => null,
}));
vi.mock("@/features/torreon/naturales/components/TorreonNaturalQueue", () => ({
  default: () => null,
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));

beforeEach(() => {
  session.mockResolvedValue({
    role: "CLIENTE",
    empresaId: 3,
    localidadId: 2,
    authorization: loginProfile(),
  });
});

it("opens current and past natural units for the Torreón client's Seguimiento", async () => {
  const page = await Page({ searchParams: Promise.resolve({}) });
  expect(page.type).toBe(TorreonNaturalQueue);
  expect(page.props).toMatchObject({
    localidadId: 2,
    rol: "CLIENTE",
    view: "seguimiento",
    canCreateMovements: true,
  });
});

it("keeps the GDL panel and its exact props, ignoring a locality override for a restricted client", async () => {
  const authorization = loginProfile();
  session.mockResolvedValue({
    role: "CLIENTE",
    empresaId: 3,
    localidadId: 1,
    authorization,
  });
  const page = await Page({ searchParams: Promise.resolve({ loc: "2" }) });
  const panel = page.props.children.props.children;
  expect(panel.type).toBe(MovimientosPanel);
  expect(panel.props).toEqual({
    apiBase: process.env.NEXT_PUBLIC_API_BASE || "/bff",
    authorization,
    empresaIdUsuario: 3,
    localidadIdUsuario: 1,
    bloquearLocalidad: true,
    puedeCrear: authorization.capabilities.canCreateMovements,
    intervaloAutoMs: 15000,
  });
});

it("retains Torreón when an authorized company client follows a locality link", async () => {
  const authorization = loginProfile("CLIENTE_ADMIN");
  authorization.scope = { mode: "COMPANY", empresaId: 3, localidadId: null };
  authorization.capabilities = {
    ...authorization.capabilities,
    canSwitchLocalidad: true,
  };
  session.mockResolvedValue({
    role: "CLIENTE_ADMIN",
    empresaId: 3,
    localidadId: null,
    authorization,
  });
  const page = await Page({ searchParams: Promise.resolve({ loc: "2" }) });
  expect(page.type).toBe(TorreonNaturalQueue);
  expect(page.props).toMatchObject({
    localidadId: 2,
    rol: "CLIENTE_ADMIN",
    view: "seguimiento",
  });
});

it("preserves the Arrastre route", async () => {
  session.mockResolvedValue({
    role: "ARRASTRE_TORREON",
    empresaId: 3,
    localidadId: 2,
    authorization: loginProfile("ARRASTRE_TORREON"),
  });
  await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow(
    "redirect:/cliente/torreon/movimientos",
  );
});
