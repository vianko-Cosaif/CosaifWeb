import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GET, PATCH } from "@/app/api/cliente/torreon/movimientos/[id]/edicion/route";
import { loginProfile } from "./fixtures/authorization";
import { PERMISSIONS } from "@/lib/accessControl";

const mock = vi.hoisted(() => ({
  session: vi.fn(),
  cookie: vi.fn(),
  fetch: vi.fn(),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: mock.cookie }),
}));
vi.mock("@/lib/server/session", () => ({ getVerifiedSession: mock.session }));
vi.mock("@/lib/server/upstream", () => ({ fetchUpstream: mock.fetch }));
const movement = {
  id: 500,
  empresaId: 3,
  localidadId: 2,
  estado: "SOLICITADO",
  poloOrigen: "NORTE",
  poloDestino: "SUR",
  seccionOrigenId: 81,
  seccionOrigenNumero: 1,
  seccionOrigenNombreSnapshot: "Sección 1 · Patio",
  seccionDestinoId: 93,
  seccionDestinoNumero: 3,
  seccionDestinoNombreSnapshot: "Sección 3 · Salida",
};
const context = () => ({ params: Promise.resolve({ id: "500" }) });
const request = (body?: Record<string, unknown>) =>
  new NextRequest("http://localhost/api/cliente/torreon/movimientos/500/edicion", {
    method: body ? "PATCH" : "GET",
    ...(body
      ? {
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });
function session() {
  const authorization = loginProfile("CLIENTE");
  authorization.scope.localidadId = 2;
  return {
    role: "CLIENTE",
    userId: 7,
    empresaId: 3,
    localidadId: 2,
    authorization,
  };
}
beforeEach(() => {
  vi.stubEnv("API_ORIGIN", "http://synthetic-backend.invalid/");
  vi.stubEnv("JWT_COOKIE_NAME", "custom-token");
  vi.stubEnv("TORREON_LOCALIDAD_ID", "2");
  mock.cookie.mockImplementation((name) =>
    name === "custom-token" ? { value: "synthetic-jwt" } : undefined,
  );
  mock.session.mockResolvedValue(session());
  mock.fetch.mockImplementation(async () => Response.json({ data: movement }));
});
afterEach(() => vi.unstubAllEnvs());

it("reads the gateway's verified section numbers with the signed user's JWT", async () => {
  const response = await GET(request(), context());
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(movement);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(mock.fetch).toHaveBeenCalledExactlyOnceWith(
    "http://synthetic-backend.invalid/torreon/movimientos/500",
    {
      method: "GET",
      headers: { authorization: "Bearer synthetic-jwt" },
    },
  );
});
it("accepts one independent pole and sends the allowed edit through the authenticated gateway", async () => {
  mock.fetch
    .mockResolvedValueOnce(Response.json(movement))
    .mockResolvedValueOnce(Response.json({ ...movement, poloDestino: "NORTE" }));
  const body = { poloDestino: "NORTE", instrucciones: "Confirmar posición" };
  const response = await PATCH(request(body), context());
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    poloDestino: "NORTE",
    seccionOrigenNumero: 1,
    seccionDestinoNumero: 3,
  });
  expect(mock.fetch).toHaveBeenLastCalledWith(
    "http://synthetic-backend.invalid/torreon/movimientos/500",
    {
      method: "PATCH",
      headers: {
        authorization: "Bearer synthetic-jwt",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
});
it.each(["polo", "posicionChimenea", "posicionCabina", "seccionOrigenNumero", "empresaId"])(
  "rejects obsolete, derived or scoped field %s",
  async (field) => {
    expect((await PATCH(request({ [field]: 9 }), context())).status).toBe(400);
    expect(mock.fetch).toHaveBeenCalledTimes(1);
  },
);
it.each([{ empresaId: 999 }, { localidadId: 1 }])(
  "rejects movements outside the signed scope: %j",
  async (scope) => {
    mock.fetch.mockResolvedValue(Response.json({ ...movement, ...scope }));
    expect((await PATCH(request({ poloDestino: "NORTE" }), context())).status).toBe(403);
    expect(mock.fetch).toHaveBeenCalledTimes(1);
  },
);
it("requires edit permission before consulting the movement", async () => {
  const signed = session();
  signed.authorization.permissions = signed.authorization.permissions.filter(
    (permission) => permission !== PERMISSIONS.MOVEMENTS_EDIT,
  );
  mock.session.mockResolvedValue(signed);
  expect((await GET(request(), context())).status).toBe(403);
  expect(mock.fetch).not.toHaveBeenCalled();
});
it("requires both a verified session and a JWT without service-credential fallback", async () => {
  mock.session.mockResolvedValueOnce(null);
  expect((await GET(request(), context())).status).toBe(401);
  mock.cookie.mockReturnValue(undefined);
  expect((await GET(request(), context())).status).toBe(401);
  expect(mock.fetch).not.toHaveBeenCalled();
});
it("rejects editing once a movement is in progress", async () => {
  mock.fetch.mockResolvedValue(Response.json({ ...movement, estado: "EN_PROCESO" }));
  expect((await PATCH(request({ poloDestino: "NORTE" }), context())).status).toBe(409);
  expect(mock.fetch).toHaveBeenCalledTimes(1);
});
it("preserves the gateway status when its detail read fails", async () => {
  mock.fetch.mockResolvedValue(
    Response.json({ message: "Movimiento no encontrado." }, { status: 404 }),
  );
  const response = await GET(request(), context());
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({
    message: "Movimiento no encontrado.",
  });
});

it("preserves the gateway validation reason from its error envelope", async () => {
  mock.fetch
    .mockResolvedValueOnce(Response.json(movement))
    .mockResolvedValueOnce(
      Response.json({ error: "Selecciona el polo de salida." }, { status: 400 }),
    );
  const response = await PATCH(request({ poloOrigen: "SIN_SOLICITAR" }), context());
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({
    message: "Selecciona el polo de salida.",
  });
});

it("forwards both asymmetric poles without the obsolete single value", async () => {
  const body = { poloOrigen: "NORTE", poloDestino: "SUR" };
  const response = await PATCH(request(body), context());
  expect(response.status).toBe(200);
  expect(JSON.parse(mock.fetch.mock.calls[1][1].body)).toEqual(body);
});
it("preserves missing legacy poles when only instructions are edited", async () => {
  mock.fetch.mockImplementation(async () =>
    Response.json({ ...movement, polo: "NORTE", poloOrigen: null, poloDestino: null }),
  );
  const body = { instrucciones: "Confirmar acceso" };
  const response = await PATCH(request(body), context());
  expect(response.status).toBe(200);
  expect(JSON.parse(mock.fetch.mock.calls[1][1].body)).toEqual(body);
  expect(await response.json()).toMatchObject({ poloOrigen: null, poloDestino: null });
});

it.each([null, 93])(
  "forwards section updates %s with the signed movement scope",
  async (sectionId) => {
    mock.fetch
      .mockResolvedValueOnce(Response.json(movement))
      .mockResolvedValueOnce(Response.json({ ...movement, seccionDestinoId: sectionId }));
    const body = { poloDestino: sectionId ? "CENTRO" : "SUR", seccionDestinoId: sectionId };
    expect((await PATCH(request(body), context())).status).toBe(200);
    expect(JSON.parse(mock.fetch.mock.calls.at(-1)![1].body)).toEqual(body);
  },
);
