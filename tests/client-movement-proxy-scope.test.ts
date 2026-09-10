import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as bff } from "@/app/bff/[...paht]/route";
import { GET as xapi } from "@/app/xapi/[...path]/route";
import { GET as passthrough } from "@/app/api/passthrough/[...path]/route";
import { POST as createMovement } from "@/app/api/movimientos/route";
import { loginProfile } from "./fixtures/authorization";

const upstream = vi.hoisted(() => ({ fetch: vi.fn(), session: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "synthetic-token" }) }) }));
vi.mock("@/lib/server/session", () => ({ getVerifiedSession: upstream.session }));
vi.mock("@/lib/serverOrigin", () => ({ normalizeHttpOrigin: () => "http://synthetic-backend.invalid" }));
vi.mock("@/lib/server/upstream", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/server/upstream")>(),
  fetchUpstream: upstream.fetch,
}));

beforeEach(() => {
  upstream.session.mockResolvedValue({ userId: 7, role: "CLIENTE", empresaId: 3, localidadId: 1, authorization: loginProfile() });
  upstream.fetch.mockImplementation(async () => Response.json([]));
});
afterEach(() => { vi.unstubAllGlobals(); });

const proxies = [
  { name: "bff", prefix: "/bff", read: (req: NextRequest) => bff(req) },
  { name: "xapi", prefix: "/xapi", read: (req: NextRequest, path: string[]) => xapi(req, { params: Promise.resolve({ path }) }) },
  { name: "passthrough", prefix: "/api/passthrough", read: (req: NextRequest, path: string[]) => passthrough(req, { params: Promise.resolve({ path }) }) },
];

describe("private movement proxy boundaries", () => {
  for (const proxy of proxies) {
    it.each(["rondas", "movimientos/buscar", "torreon/rondas"])(`${proxy.name} keeps %s private despite alcance=localidad`, async (path) => {
      const req = new NextRequest(`http://localhost:3012${proxy.prefix}/${path}?alcance=localidad&concluido=true`, { headers: { cookie: "token=synthetic-token" } });
      expect((await proxy.read(req, path.split("/"))).status).toBe(200);
      const params = new URL(upstream.fetch.mock.calls[0][0]).searchParams;
      expect(params.has("alcance")).toBe(false);
      expect(params.get("empresaId")).toBe("3");
      expect(params.get("localidadId")).toBe("1");
    });
    it(`${proxy.name} rejects forged company scope before forwarding`, async () => {
      const req = new NextRequest(`http://localhost:3012${proxy.prefix}/rondas?empresaId=4&alcance=localidad`, { headers: { cookie: "token=synthetic-token" } });
      expect((await proxy.read(req, ["rondas"])).status).toBe(403);
      expect(upstream.fetch).not.toHaveBeenCalled();
    });
  }

  it("uses signed company/locality when a client submits a direct movement create", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ id: 20 }));
    vi.stubGlobal("fetch", fetcher);
    const response = await createMovement(new Request("http://localhost:3012/api/movimientos", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ empresaId: 4, localidadId: 2, instrucciones: "Synthetic operation" }),
    }));
    expect(response.status).toBe(200);
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({ empresaId: 3, localidadId: 1 });
  });
});
