import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as createNatural } from "@/app/bff/[...paht]/route";
import { GET as readArrastres } from "@/app/api/cliente/torreon/arrastres/route";
import { POST as actArrastre } from "@/app/api/cliente/torreon/arrastres/action/route";
import { GET as readRounds } from "@/app/api/cliente/rondas/route";
import { GET as readIncidents } from "@/app/api/incidentes/[[...path]]/route";
import { canClientUseTorreonPath, scopeTorreonClientPath } from "@/lib/auth/torreonClientPolicy";
import { canForwardApiRequest } from "@/lib/server/requestAuthorization";
import { loginProfile } from "./fixtures/authorization";
import type { AppRole } from "@/lib/accessControl";

const mock = vi.hoisted(() => ({ session: vi.fn(), fetch: vi.fn(), ms: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "synthetic-token" }) }),
}));
vi.mock("@/lib/server/session", () => ({ getVerifiedSession: mock.session }));
vi.mock("@/lib/serverOrigin", () => ({
  normalizeHttpOrigin: () => "http://synthetic-backend.invalid",
}));
vi.mock("@/lib/server/upstream", async (original) => ({
  ...(await original<typeof import("@/lib/server/upstream")>()),
  fetchUpstream: mock.fetch,
}));
vi.mock("@/lib/torreonMs", async (original) => ({
  ...(await original<typeof import("@/lib/torreonMs")>()),
  fetchTorreonMsJson: mock.ms,
}));
function session(role: AppRole = "CLIENTE") {
  const authorization = loginProfile(role);
  authorization.scope.localidadId = 2;
  mock.session.mockResolvedValue({ role, userId: 7, empresaId: 3, localidadId: 2, authorization });
  return authorization;
}
const request = (path: string, body: unknown) =>
  new NextRequest(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  session();
  mock.fetch.mockImplementation(async () => Response.json({ id: 701 }));
  mock.ms.mockResolvedValue([]);
});

describe.each(["CLIENTE", "CLIENTE_ADMIN", "CLIENTE_COOR"] as const)(
  "Torreón natural %s",
  (role) => {
    it("creates for the signed company, locality and actor even with forged form fields", async () => {
      session(role);
      const response = await createNatural(
        request("/bff/torreon/movimientos", {
          empresaId: 999,
          localidadId: 999,
          clienteId: 999,
          creadoPorId: 999,
          locomotiveNumber: "4800",
        }),
      );
      expect(response.status).toBe(200);
      const [url, init] = mock.fetch.mock.calls[0];
      expect(url).toBe("http://synthetic-backend.invalid/torreon/movimientos");
      expect(JSON.parse(init.body)).toMatchObject({
        empresaId: 3,
        localidadId: 2,
        clienteId: 7,
        creadoPorId: 7,
      });
    });
    it("does not expose or mutate arrastres through service credentials", async () => {
      session(role);
      expect(
        (
          await readArrastres(
            new NextRequest("http://localhost/api/cliente/torreon/arrastres?localidadId=2"),
          )
        ).status,
      ).toBe(403);
      expect(
        (
          await actArrastre(
            request("/api/cliente/torreon/arrastres/action", {
              action: "EDITAR_VAGON",
              arrastreId: 1,
              vagonId: 1,
            }),
          )
        ).status,
      ).toBe(403);
      expect(mock.ms).not.toHaveBeenCalled();
    });
    it("does not allow starting, finishing or crossing domains through generic proxies", () => {
      const auth = session(role);
      expect(canForwardApiRequest(auth, "/torreon/movimientos", "POST")).toBe(true);
      for (const [path, verb] of [
        ["/torreon/arrastres", "GET"],
        ["/torreon/arrastres", "POST"],
        ["/torreon/movimientos/1/iniciar", "POST"],
        ["/torreon/movimientos/1/finalizar", "PATCH"],
      ]) {
        expect(canForwardApiRequest(auth, path, verb)).toBe(false);
      }
    });
  },
);

it("blocks natural creation and rounds for an arrastre client", async () => {
  const auth = session("ARRASTRE_TORREON");
  expect(
    (await createNatural(request("/bff/torreon/movimientos", { empresaId: 3, localidadId: 2 })))
      .status,
  ).toBe(403);
  expect(
    (await readRounds(new NextRequest("http://localhost/api/cliente/rondas?localidadId=2"))).status,
  ).toBe(403);
  expect(canForwardApiRequest(auth, "/movimientos", "POST")).toBe(false);
  expect(mock.fetch).not.toHaveBeenCalled();
  expect(mock.ms).not.toHaveBeenCalled();
});
it.each(["CLIENTE", "ARRASTRE_TORREON"] as const)(
  "scopes incidents to the domain of %s",
  async (role) => {
    session(role);
    const response = await readIncidents(
      new NextRequest("http://localhost/api/incidentes?source=torreon&localidadId=2&tipo=TODOS"),
      { params: Promise.resolve({ path: [] }) },
    );
    expect(response.status).toBe(200);
    const params = new URL(mock.ms.mock.calls[0][0], "http://synthetic-ms.invalid").searchParams;
    expect(params.get("tipo")).toBe(role === "CLIENTE" ? "NATURAL" : "ARRASTRE");
    expect(params.get("empresaId")).toBe("3");
  },
);
it("allows arrastre request management but never operational start/finish", () => {
  for (const path of [
    "/arrastres/1",
    "/arrastres/1/cancelar",
    "/arrastres/1/vagones/2",
    "/arrastres/1/incidentes/3/resolver",
  ])
    expect(canClientUseTorreonPath("ARRASTRE_TORREON", "PATCH", path)).toBe(true);
  for (const path of [
    "/arrastres/1/vagones/2/iniciar",
    "/arrastres/1/vagones/2/finalizar",
    "/movimientos/1/finalizar",
  ])
    expect(canClientUseTorreonPath("ARRASTRE_TORREON", "PATCH", path)).toBe(false);
  expect(scopeTorreonClientPath("ARRASTRE_TORREON", "/incidentes?empresaId=3")).toBe(
    "/incidentes?empresaId=3&tipo=ARRASTRE",
  );
});

it.each(["INICIAR_VAGON", "FINALIZAR_VAGON"])(
  "does not grant %s to an arrastre client through service credentials",
  async (action) => {
    session("ARRASTRE_TORREON");
    mock.ms.mockResolvedValue({ id: 1, empresaId: 3, localidadId: 2, estado: "SOLICITADO" });
    const response = await actArrastre(
      request("/api/cliente/torreon/arrastres/action", {
        action,
        arrastreId: 1,
        vagonId: 1,
      }),
    );
    expect(response.status).toBe(403);
    expect(mock.ms.mock.calls).toEqual([["/arrastres/1"]]);
  },
);

it("rejects opposite-domain incident IDs instead of remapping them to a different incident", async () => {
  session("CLIENTE");
  const response = await readIncidents(
    new NextRequest("http://localhost/api/incidentes/1?source=torreon&tipo=ARRASTRE"),
    { params: Promise.resolve({ path: ["1"] }) },
  );
  expect(response.status).toBe(403);
  expect(mock.ms).not.toHaveBeenCalled();
});

it("loads arrastre evidence from the incident detail and maps it to the image proxy", async () => {
  session("ARRASTRE_TORREON");
  mock.ms.mockResolvedValue({
    id: 31,
    _torreonTipo: "ARRASTRE",
    localidadId: 2,
    arrastreId: 8,
    arrastre: { id: 8, localidadId: 2, empresaId: 3 },
    fotos: [{ id: 4, orden: 1, url: "2026/09/21/torreon_incidente_arrastre_31_1.jpeg" }],
  });

  const response = await readIncidents(
    new NextRequest("http://localhost/api/incidentes/31?source=torreon&tipo=ARRASTRE&localidadId=2"),
    { params: Promise.resolve({ path: ["31"] }) },
  );

  expect(response.status).toBe(200);
  expect(mock.ms).toHaveBeenCalledWith("/incidentes/31?tipo=ARRASTRE");
  expect((await response.json()).data.fotos).toEqual([
    expect.objectContaining({
      id: 4,
      url: "/api/torreon/imagenes/2026/09/21/torreon_incidente_arrastre_31_1.jpeg",
    }),
  ]);
});
