import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PATCH } from "@/app/api/cliente/torreon/movimientos/[id]/cancelar/route";
import { loginProfile } from "./fixtures/authorization";
import { PERMISSIONS, type AppRole } from "@/lib/accessControl";
import { canForwardApiRequest } from "@/lib/server/requestAuthorization";

const mock = vi.hoisted(() => ({ session: vi.fn(), cookie: vi.fn(), fetch: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: mock.cookie }) }));
vi.mock("@/lib/server/session", () => ({ getVerifiedSession: mock.session }));
vi.mock("@/lib/server/upstream", () => ({ fetchUpstream: mock.fetch }));
const movement = {
  id: 500,
  empresaId: 3,
  localidadId: 2,
  estado: "SOLICITADO",
  clienteId: 7,
  creadoPorId: 8,
  fechaInicio: null,
  unidad: { id: 40, estado: "PENDIENTE", movimientos: [{ id: 500 }, { id: 501 }] },
};
const context = () => ({ params: Promise.resolve({ id: "500" }) });
const request = (body: unknown = { razon: "Cambio de programación" }) =>
  new NextRequest("http://localhost/api/cliente/torreon/movimientos/500/cancelar", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
function session(role: AppRole = "CLIENTE") {
  const authorization = loginProfile(role);
  authorization.scope.localidadId = 2;
  return { role, userId: 7, empresaId: 3, localidadId: 2, authorization };
}
beforeEach(() => {
  vi.stubEnv("API_ORIGIN", "http://synthetic-backend.invalid");
  mock.cookie.mockReturnValue({ value: "synthetic-jwt" });
  mock.session.mockResolvedValue(session());
  mock.fetch.mockImplementation(async () => Response.json(movement));
});
afterEach(() => vi.unstubAllEnvs());

it.each(["CLIENTE", "CLIENTE_ADMIN", "CLIENTE_COOR"] as const)(
  "cancels only the selected member through the signed gateway for %s",
  async (role) => {
    mock.session.mockResolvedValue(session(role));
    const response = await PATCH(request({ razon: "  Cambio de programación  " }), context());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mock.fetch).toHaveBeenLastCalledWith(
      "http://synthetic-backend.invalid/torreon/movimientos/500/cancelar",
      {
        method: "PATCH",
        headers: { authorization: "Bearer synthetic-jwt", "content-type": "application/json" },
        body: JSON.stringify({ razon: "Cambio de programación" }),
      },
    );
    expect(mock.fetch).toHaveBeenCalledTimes(2);
  },
);
it("allows the creator to cancel a request made on behalf of another client", async () => {
  mock.fetch.mockImplementation(async () =>
    Response.json({ ...movement, clienteId: 8, creadoPorId: 7 }),
  );
  expect((await PATCH(request(), context())).status).toBe(200);
});
it.each([{ empresaId: 999 }, { localidadId: 1 }, { clienteId: 8, creadoPorId: 9 }])(
  "rejects requests outside ownership or company/locality: %j",
  async (patch) => {
    mock.fetch.mockResolvedValue(Response.json({ ...movement, ...patch }));
    expect((await PATCH(request(), context())).status).toBe(403);
    expect(mock.fetch).toHaveBeenCalledTimes(1);
  },
);
it.each(["EN_PROCESO", "DETENIDO", "CONCLUIDO"])(
  "rejects cancellation of %s without a write",
  async (estado) => {
    mock.fetch.mockResolvedValue(Response.json({ ...movement, estado }));
    expect((await PATCH(request(), context())).status).toBe(409);
    expect(mock.fetch).toHaveBeenCalledTimes(1);
  },
);
it.each([{ fechaInicio: "2026-10-15T12:00:00Z" }, { unidad: { estado: "EN_PROCESO" } }])(
  "rejects stale pending movement data after the group started: %j",
  async (patch) => {
    mock.fetch.mockResolvedValue(Response.json({ ...movement, ...patch }));
    expect((await PATCH(request(), context())).status).toBe(409);
    expect(mock.fetch).toHaveBeenCalledTimes(1);
  },
);
it("preserves a conflict if operation starts between the read and cancellation", async () => {
  mock.fetch
    .mockResolvedValueOnce(Response.json(movement))
    .mockResolvedValueOnce(Response.json({ error: "El movimiento ya inició" }, { status: 409 }));
  const response = await PATCH(request(), context());
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ message: "El movimiento ya inició" });
});
it.each([
  {},
  { razon: "   " },
  { razon: "x".repeat(1001) },
  { razon: 7 },
  { razon: "Cambio", empresaId: 999 },
  null,
])("rejects invalid reason or forged fields", async (body) => {
  expect((await PATCH(request(body), context())).status).toBe(400);
  expect(mock.fetch).toHaveBeenCalledTimes(1);
});
it("requires a cancel permission separately from creating Torreón requests", async () => {
  const signed = session();
  signed.authorization.permissions = signed.authorization.permissions.filter(
    (permission) => permission !== PERMISSIONS.MOVEMENTS_CANCEL,
  );
  mock.session.mockResolvedValue(signed);
  expect((await PATCH(request(), context())).status).toBe(403);
  expect(
    canForwardApiRequest(signed.authorization, "/torreon/movimientos/500/cancelar", "PATCH"),
  ).toBe(false);
  expect(mock.fetch).not.toHaveBeenCalled();
});
it.each(["ARRASTRE_TORREON", "COORDINADOR", "ADMINISTRADOR"] as const)(
  "does not expose the client route to %s",
  async (role) => {
    mock.session.mockResolvedValue(session(role));
    expect((await PATCH(request(), context())).status).toBe(403);
    expect(mock.fetch).not.toHaveBeenCalled();
  },
);
it("requires both the verified session and its JWT", async () => {
  mock.session.mockResolvedValueOnce(null);
  expect((await PATCH(request(), context())).status).toBe(401);
  mock.cookie.mockReturnValue(undefined);
  expect((await PATCH(request(), context())).status).toBe(401);
  expect(mock.fetch).not.toHaveBeenCalled();
});
it("rejects already-cancelled requests without sending another write", async () => {
  mock.fetch.mockImplementation(async () =>
    Response.json({ ...movement, estado: "CANCELADO", unidad: { estado: "CANCELADA" } }),
  );
  expect((await PATCH(request(), context())).status).toBe(409);
  expect(mock.fetch).toHaveBeenCalledTimes(1);
});
