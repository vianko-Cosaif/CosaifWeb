import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/cliente/rondas/route";
import { GET as readPrivateRoundInfo } from "@/app/api/cliente/ronda-info/route";
import { GET as readArrastres } from "@/app/api/cliente/torreon/arrastres/route";
import { TorreonMsError } from "@/lib/torreonMs";
import { loginProfile } from "./fixtures/authorization";
import type { VerifiedSession } from "@/lib/sessionToken";

const upstream = vi.hoisted(() => ({ fetch: vi.fn(), torreon: vi.fn(), session: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "synthetic-upstream-token" }) }) }));
vi.mock("@/lib/server/session", () => ({ getVerifiedSession: upstream.session }));
vi.mock("@/lib/server/upstream", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/server/upstream")>(),
  fetchUpstream: upstream.fetch,
}));
vi.mock("@/lib/torreonMs", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/torreonMs")>(),
  fetchTorreonMsJson: upstream.torreon,
}));

function clientSession(localidadId = 1): VerifiedSession {
  const authorization = loginProfile();
  authorization.scope.localidadId = localidadId;
  return { role: "CLIENTE", userId: 7, empresaId: 3, localidadId, authorization };
}

function read(query = "", init?: ConstructorParameters<typeof NextRequest>[1]) {
  return GET(new NextRequest(`http://localhost:3012/api/cliente/rondas?${query}`, init));
}

beforeEach(() => {
  vi.stubEnv("API_ORIGIN", "http://synthetic-backend.invalid");
  vi.stubEnv("TORREON_LOCALIDAD_IDS", "2");
  upstream.session.mockResolvedValue(clientSession());
  upstream.fetch.mockImplementation(async () => Response.json([]));
  upstream.torreon.mockResolvedValue([]);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

function round(id: number, empresaId = 3, localidadId = 1, concluido = false) {
  return {
    id, empresaId, localidadId, concluido, rondaNumero: 1, orden: id,
    empresa: { id: empresaId, nombre: `Empresa ${empresaId}` },
    movimiento: {
      id: id * 10, estado: concluido ? "CONCLUIDO" : "EN_PROCESO", locomotiveNumber: `LOC-${id}`,
      createdAt: "2026-09-08T10:00:00Z", fechaSolicitud: "2026-09-08T11:00:00Z", tipoMovimiento: "NATURAL", accion: "TRASLADO",
      instrucciones: `Private notes ${empresaId}`, viaOrigen: { nombre: "Vía 1" }, viaDestino: { nombre: "Vía 2" },
    },
  };
}

describe("client current rounds and private history", () => {
  it("returns all current companies only in the signed locality without fetching private details", async () => {
    upstream.fetch.mockResolvedValueOnce(Response.json([round(1), round(2, 4), round(3, 4, 2), round(4, 4, 1, true)]));
    const response = await read();
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.map((row: { id: number }) => row.id)).toEqual([1, 2]);
    expect(data[0]).toMatchObject({ localidadId: 1, movimiento: { createdAt: "2026-09-08T10:00:00Z", tipoMovimiento: "NATURAL", accion: "TRASLADO" } });
    expect(data[0].movimiento.instrucciones).toBe("Private notes 3");
    expect(data[1].movimiento.instrucciones).toBeNull();
    expect(upstream.fetch).toHaveBeenCalledTimes(1);
    const params = new URL(upstream.fetch.mock.calls[0][0]).searchParams;
    expect(params.get("alcance")).toBe("localidad");
    expect(params.get("localidadId")).toBe("1");
    expect(params.has("empresaId")).toBe(false);
  });

  it("allows filtering another company only in the current assigned locality", async () => {
    upstream.fetch.mockResolvedValueOnce(Response.json([round(1), round(2, 4), round(3, 4, 2)]));
    const response = await read("empresaId=4&alcance=localidad");
    expect(response.status).toBe(200);
    expect((await response.json()).map((row: { id: number }) => row.id)).toEqual([2]);
    expect(new URL(upstream.fetch.mock.calls[0][0]).searchParams.get("empresaId")).toBe("4");
  });

  it("filters completed and other-locality rows even when the fallback ignores its query", async () => {
    upstream.fetch.mockResolvedValueOnce(Response.json({}, { status: 404 }));
    upstream.fetch.mockResolvedValueOnce(Response.json([round(1), round(2, 4), round(3, 3, 2), round(4, 4, 1, true)]));
    const response = await read("alcance=localidad");
    expect(response.status).toBe(200);
    expect((await response.json()).map((row: { id: number }) => row.id)).toEqual([1, 2]);
    expect(upstream.fetch).toHaveBeenCalledTimes(2);
  });

  it("forces private company and locality for history even if alcance is manipulated", async () => {
    upstream.fetch.mockResolvedValueOnce(Response.json({ data: [
      { id: 1, empresaId: 3, localidadId: 1, estado: "CONCLUIDO" },
      { id: 2, empresaId: 4, localidadId: 1, estado: "CONCLUIDO" },
      { id: 3, empresaId: 3, localidadId: 2, estado: "CONCLUIDO" },
    ] }));
    const response = await read("estado=terminados&alcance=localidad");
    expect(response.status).toBe(200);
    expect((await response.json()).map((row: { movimientoId: number }) => row.movimientoId)).toEqual([1]);
    const url = new URL(upstream.fetch.mock.calls[0][0]);
    expect(url.pathname).toBe("/movimientos/buscar");
    expect(url.searchParams.get("empresaId")).toBe("3");
    expect(url.searchParams.get("localidadId")).toBe("1");
    expect(url.searchParams.has("alcance")).toBe(false);
  });

  it("rejects forged history company IDs before contacting the backend", async () => {
    expect((await read("estado=terminados&alcance=localidad&empresaId=4")).status).toBe(403);
    expect(upstream.fetch).not.toHaveBeenCalled();
  });

  it("does not grant private detail access through the shared locality flag", async () => {
    upstream.fetch.mockResolvedValueOnce(Response.json({ empresa: { id: 4 }, movimiento: { id: 7, localidadId: 1, instrucciones: "Other company secret" } }));
    const response = await readPrivateRoundInfo(new Request("http://localhost:3012/api/cliente/ronda-info?ids=7&alcance=localidad"));
    expect(response.status).toBe(403);
    expect(await response.text()).not.toContain("Other company secret");
  });

  it("does not return private details from another locality of the same company", async () => {
    upstream.fetch.mockResolvedValueOnce(Response.json({ empresa: { id: 3 }, movimiento: { id: 7, localidadId: 2 } }));
    const response = await readPrivateRoundInfo(new Request("http://localhost:3012/api/cliente/ronda-info?ids=7"));
    expect(response.status).toBe(403);
  });

  it("keeps own company/locality details available", async () => {
    const data = { empresa: { id: 3 }, movimiento: { id: 7, localidadId: 1 } };
    upstream.fetch.mockResolvedValueOnce(Response.json(data));
    const response = await readPrivateRoundInfo(new Request("http://localhost:3012/api/cliente/ronda-info?ids=7"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ 7: data });
  });

  it("keeps arrastre history private even when the locality flag is forged", async () => {
    upstream.session.mockResolvedValue(clientSession(2));
    upstream.torreon.mockResolvedValueOnce([
      { id: 1, empresaId: 3, localidadId: 2, estado: "CONCLUIDO" },
      { id: 2, empresaId: 4, localidadId: 2, estado: "CONCLUIDO" },
      { id: 3, empresaId: 3, localidadId: 3, estado: "CONCLUIDO" },
    ]);
    const response = await readArrastres(new NextRequest("http://localhost:3012/api/cliente/torreon/arrastres?localidadId=2&vista=HISTORIAL&alcance=localidad"));
    expect(response.status).toBe(200);
    expect((await response.json()).map((row: { id: number }) => row.id)).toEqual([1]);
    const params = new URL(upstream.torreon.mock.calls[0][0], "http://synthetic-torreon.invalid").searchParams;
    expect(params.get("empresaId")).toBe("3");
    expect(params.get("localidadId")).toBe("2");
    expect(params.has("alcance")).toBe(false);
  });

  it("shares current arrastres only in the signed locality and excludes history", async () => {
    upstream.session.mockResolvedValue(clientSession(2));
    upstream.torreon.mockResolvedValueOnce([
      { id: 1, empresaId: 3, localidadId: 2, estado: "EN_PROCESO" },
      { id: 2, empresaId: 4, localidadId: 2, estado: "SOLICITADO" },
      { id: 3, empresaId: 4, localidadId: 2, estado: "CONCLUIDO" },
      { id: 4, empresaId: 4, localidadId: 3, estado: "SOLICITADO" },
    ]);
    const response = await readArrastres(new NextRequest("http://localhost:3012/api/cliente/torreon/arrastres?alcance=localidad"));
    expect(response.status).toBe(200);
    expect((await response.json()).map((row: { id: number }) => row.id)).toEqual([1, 2]);
  });

  it("does not expose another company's arrastre details through alcance", async () => {
    upstream.session.mockResolvedValue(clientSession(2));
    upstream.torreon.mockResolvedValueOnce({ id: 8, empresaId: 4, localidadId: 2, instrucciones: "Other company secret" });
    const response = await readArrastres(new NextRequest("http://localhost:3012/api/cliente/torreon/arrastres?localidadId=2&id=8&alcance=localidad"));
    expect(response.status).toBe(403);
    expect(await response.text()).not.toContain("Other company secret");
  });
});
afterEach(() => { vi.unstubAllEnvs(); });

describe("rondas GET upstream failures", () => {
  it.each(["", "estado=terminados", "entity=torneados"])("returns 502 instead of an empty successful queue for %s", async (query) => {
    upstream.fetch.mockResolvedValueOnce(Response.json({ message: "sensitive database detail" }, { status: 503 }));
    const response = await read(query);
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ message: "No se pudieron cargar las rondas. Inténtalo de nuevo." });
    expect(upstream.fetch).toHaveBeenCalledTimes(1);
  });

  it.each([401, 403, 504])("preserves the actionable upstream status %s without fallback", async (status) => {
    upstream.fetch.mockResolvedValueOnce(Response.json({ message: "private upstream message" }, { status }));
    const response = await read();
    expect(response.status).toBe(status);
    expect(await response.text()).not.toContain("private upstream message");
    expect(upstream.fetch).toHaveBeenCalledTimes(1);
  });

  it.each([404, 405])("uses a compatible endpoint only after %s", async (status) => {
    upstream.fetch.mockResolvedValueOnce(Response.json({}, { status }));
    const response = await read();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
    expect(upstream.fetch).toHaveBeenCalledTimes(2);
    expect(upstream.fetch.mock.calls[1][0]).toContain("/rondas?localidadId=1");
  });

  it("reports a missing API contract when all fallback endpoints are unavailable", async () => {
    upstream.fetch.mockImplementation(async () => Response.json({}, { status: 404 }));
    const response = await read();
    expect(response.status).toBe(502);
    expect(upstream.fetch).toHaveBeenCalledTimes(2);
  });

  it.each(["", "estado=terminados", "entity=torneados"])("preserves a valid empty collection for %s", async (query) => {
    upstream.fetch.mockResolvedValueOnce(Response.json({ data: [] }));
    const response = await read(query);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
    expect(upstream.fetch).toHaveBeenCalledTimes(1);
  });

  it.each(["<html>backend error</html>", JSON.stringify({ message: "unexpected payload" }), JSON.stringify([null]), JSON.stringify([{}])])("rejects malformed collections without retrying another endpoint: %s", async (body) => {
    upstream.fetch.mockResolvedValueOnce(new Response(body));
    const response = await read();
    expect(response.status).toBe(502);
    expect(upstream.fetch).toHaveBeenCalledTimes(1);
  });

  it("does not hide failed movement enrichment behind company filtering", async () => {
    const session = clientSession();
    session.role = "COORDINADOR";
    session.authorization.role = "COORDINADOR";
    upstream.session.mockResolvedValue(session);
    upstream.fetch.mockResolvedValueOnce(Response.json([{ id: 1, rondaNumero: 1, orden: 1, movimientoId: 7 }]));
    upstream.fetch.mockResolvedValueOnce(Response.json({}, { status: 503 }));
    const response = await read();
    expect(response.status).toBe(502);
    expect(upstream.fetch).toHaveBeenCalledTimes(2);
  });

  it("propagates a Torno detail outage instead of dropping its queue row", async () => {
    upstream.fetch.mockResolvedValueOnce(Response.json([{ id: 1, movimientoId: 7, localidadId: 1, status: "SOLICITADO", movimiento: { empresa: { id: 3 } } }]));
    upstream.fetch.mockResolvedValueOnce(Response.json({}, { status: 503 }));
    const response = await read("entity=torneados");
    expect(response.status).toBe(502);
    expect(upstream.fetch).toHaveBeenCalledTimes(2);
  });

  it("forwards cancellation and returns 504 for an aborted read", async () => {
    const controller = new AbortController();
    upstream.fetch.mockImplementationOnce((_url, _init, signal: AbortSignal) => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(new DOMException("Cancelled", "AbortError")), { once: true });
    }));
    const pending = read("", { signal: controller.signal });
    await vi.waitFor(() => expect(upstream.fetch).toHaveBeenCalledTimes(1));
    const forwardedSignal = upstream.fetch.mock.calls[0][2] as AbortSignal;
    controller.abort();
    expect(forwardedSignal.aborted).toBe(true);
    expect((await pending).status).toBe(504);
  });

  it("keeps the client locality boundary before any upstream work", async () => {
    const response = await read("localidadId=8");
    expect(response.status).toBe(403);
    expect(upstream.fetch).not.toHaveBeenCalled();
    expect(upstream.torreon).not.toHaveBeenCalled();
  });

  it.each([401, 403, 503, 504])("reports Torreón service failure %s without expiring the user session", async (status) => {
    upstream.session.mockResolvedValue(clientSession(2));
    upstream.torreon.mockRejectedValueOnce(new TorreonMsError("private service error", status));
    const response = await read("localidadId=2");
    expect(response.status).toBe(status === 504 ? 504 : 502);
    expect(await response.text()).not.toContain("private service error");
    expect(upstream.fetch).not.toHaveBeenCalled();
  });

  it("preserves a valid empty Torreón queue and passes an abort signal", async () => {
    upstream.session.mockResolvedValue(clientSession(2));
    const response = await read("localidadId=2");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
    expect(upstream.torreon.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });
});
