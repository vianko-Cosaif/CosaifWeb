import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/cliente/torreon/arrastres/action/route";
import { loginProfile } from "./fixtures/authorization";

const mock = vi.hoisted(() => ({ session: vi.fn(), upstream: vi.fn() }));
vi.mock("@/lib/server/session", () => ({ getVerifiedSession: mock.session }));
vi.mock("@/lib/torreonMs", async (original) => ({
  ...(await original<typeof import("@/lib/torreonMs")>()),
  fetchTorreonMsJson: mock.upstream,
}));
beforeEach(() => {
  const authorization = loginProfile("ARRASTRE_TORREON");
  authorization.scope.localidadId = 2;
  mock.session.mockResolvedValue({
    authorization,
    role: "ARRASTRE_TORREON",
    userId: 7,
    empresaId: 3,
    localidadId: 2,
  });
  mock.upstream.mockResolvedValue({
    id: 150,
    empresaId: 3,
    localidadId: 2,
    estado: "SOLICITADO",
    vagones: [{ id: 1, estado: "PENDIENTE" }],
  });
});
const action = (body: Record<string, unknown>) =>
  POST(
    new NextRequest("http://localhost/api/cliente/torreon/arrastres/action", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    }),
  );
describe("Arrastre queue actions", () => {
  it("sends a relative move and signed company to the service without loading the entire queue", async () => {
    const response = await action({
      action: "REORDENAR_SOLICITUDES",
      arrastreId: 150,
      direction: "up",
      arrastreIds: [999],
      empresaId: 999,
    });
    expect(response.status).toBe(200);
    expect(mock.upstream).toHaveBeenCalledTimes(2);
    expect(JSON.parse(mock.upstream.mock.calls[1][1].body)).toEqual({
      arrastreIds: [150],
      direction: "up",
      empresaId: 3,
    });
  });
  it("delegates the complete incident/priority check to the transactional service", async () => {
    expect((await action({ action: "PRIORIZAR_SOLICITUD", arrastreId: 150 })).status).toBe(200);
    expect(mock.upstream).toHaveBeenCalledTimes(2);
    expect(JSON.parse(mock.upstream.mock.calls[1][1].body)).toEqual({
      arrastreIds: [150],
      direction: "front",
      empresaId: 3,
    });
  });
  it("rejects invalid directions before writing", async () => {
    expect(
      (await action({ action: "REORDENAR_SOLICITUDES", arrastreId: 150, direction: "front" }))
        .status,
    ).toBe(400);
    expect(mock.upstream).toHaveBeenCalledTimes(1);
  });
});
