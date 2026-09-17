import { NextRequest } from "next/server";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import * as canonical from "@/app/api/cliente/rondas/route";
import * as compatibility from "@/app/cliente/rondas/route";
import { loginProfile } from "./fixtures/authorization";
import { PERMISSIONS } from "@/lib/accessControl";

const upstream = vi.hoisted(() => ({ fetch: vi.fn(), session: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "synthetic-token" }) }),
}));
vi.mock("@/lib/server/session", () => ({ getVerifiedSession: upstream.session }));
vi.mock("@/lib/server/upstream", async (original) => ({
  ...(await original<typeof import("@/lib/server/upstream")>()),
  fetchUpstream: upstream.fetch,
}));
const session = () => ({
  role: "CLIENTE",
  userId: 7,
  empresaId: 3,
  localidadId: 1,
  authorization: loginProfile(),
});
const detail = (empresaId = 3, localidadId = 1) => ({
  empresa: { id: empresaId },
  movimiento: { id: 10, localidadId },
});
beforeEach(() => {
  vi.stubEnv("API_ORIGIN", "http://synthetic-backend.invalid");
  vi.stubEnv("TORREON_LOCALIDAD_IDS", "2");
  upstream.session.mockResolvedValue(session());
  upstream.fetch.mockImplementation(async (_url, init) =>
    Response.json(init.method === "GET" ? detail() : { ok: true }),
  );
});
afterEach(() => vi.unstubAllEnvs());

describe.each([
  ["/api/cliente/rondas", canonical],
  ["/cliente/rondas", compatibility],
] as const)("round route %s", (url, route) => {
  const post = (body: unknown) =>
    route.POST(
      new NextRequest(`http://localhost${url}`, { method: "POST", body: JSON.stringify(body) }),
    );
  it("rejects a forged history scope before contacting upstream", async () => {
    const response = await route.GET(
      new NextRequest(`http://localhost${url}?estado=terminados&empresaId=4`),
    );
    expect(response.status).toBe(403);
    expect(upstream.fetch).not.toHaveBeenCalled();
  });
  it("keeps the compatibility order action and validates ownership before its write", async () => {
    expect((await post({ action: "orden", id: 10, orden: 2 })).status).toBe(200);
    expect(upstream.fetch).toHaveBeenCalledTimes(2);
    const [url, init, signal] = upstream.fetch.mock.calls[1];
    expect(url).toBe("http://synthetic-backend.invalid/rondas/10/orden");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({ orden: 2 });
    expect(signal).toBeInstanceOf(AbortSignal);
  });
  it.each([
    [4, 1],
    [3, 2],
  ])("does not reorder a round from company %i and locality %i", async (company, locality) => {
    upstream.fetch.mockResolvedValue(Response.json(detail(company, locality)));
    expect((await post({ action: "orden", id: 10, orden: 2 })).status).toBe(403);
    expect(upstream.fetch.mock.calls.every(([, init]) => init.method === "GET")).toBe(true);
  });
  it("validates both sides of a swap", async () => {
    upstream.fetch.mockResolvedValueOnce(Response.json(detail()));
    upstream.fetch.mockResolvedValueOnce(Response.json(detail(4)));
    expect((await post({ action: "swap", rondaAId: 10, rondaBId: 11 })).status).toBe(403);
    expect(upstream.fetch).toHaveBeenCalledTimes(2);
    expect(upstream.fetch.mock.calls.every(([, init]) => init.method === "GET")).toBe(true);
  });
  it("rejects the action without its permission", async () => {
    const viewer = session();
    viewer.authorization.permissions = viewer.authorization.permissions.filter(
      (permission) => permission !== PERMISSIONS.ROUNDS_EDIT,
    );
    upstream.session.mockResolvedValue(viewer);
    expect((await post({ action: "orden", id: 10, orden: 2 })).status).toBe(403);
    expect(upstream.fetch).not.toHaveBeenCalled();
  });
  it.each([0, -1, 1.5])("rejects invalid order %i without requests", async (orden) => {
    expect((await post({ action: "orden", id: 10, orden })).status).toBe(400);
    expect(upstream.fetch).not.toHaveBeenCalled();
  });
  it("rejects training IDs on both URLs", async () => {
    expect((await post({ action: "orden", id: 930_000_204, orden: 2 })).status).toBe(409);
    expect(upstream.fetch).not.toHaveBeenCalled();
  });
});
