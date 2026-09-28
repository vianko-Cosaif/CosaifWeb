import { afterEach, describe, expect, it, vi } from "vitest";
import { requestArrastreMutation } from "@/features/torreon/cliente/arrastreMutationClient";

afterEach(() => vi.unstubAllGlobals());

describe("arrastre mutation transport", () => {
  it("sends creation to the scoped endpoint with same-origin credentials", async () => {
    const send = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", send);

    await requestArrastreMutation("create", { localidadId: 2, vagones: [] }, "No se pudo crear");

    expect(send).toHaveBeenCalledWith(
      "/api/cliente/torreon/arrastres",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ localidadId: 2, vagones: [] }),
      }),
    );
  });

  it("preserves the server's useful error on every action", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "Fuera de empresa", message: "Acceso denegado" }), {
          status: 403,
        }),
      ),
    );
    await expect(
      requestArrastreMutation("action", { action: "CANCELAR", arrastreId: 7 }, "No se pudo operar"),
    ).rejects.toThrow("Fuera de empresa. Acceso denegado");
  });
});
