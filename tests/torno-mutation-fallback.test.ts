import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateParentIncident } from "@/features/torno/lib/tornoService";
import type { TornoIncidentParent } from "@/features/torno/lib/types";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));

vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

const incident: TornoIncidentParent = {
  id: 18,
  title: "Incidente",
  description: "Descripción",
  failureType: "FALLO_SISTEMA",
  status: "ABIERTO",
  images: [],
  children: [],
};

describe("torno incident mutation fallback", () => {
  beforeEach(() => api.fetchJSON.mockReset());

  it("does not repeat a write after a server failure", async () => {
    const failure = new Error("HTTP 500: fallo interno");
    api.fetchJSON.mockRejectedValueOnce(failure);

    await expect(updateParentIncident(incident, { description: "Nueva descripción" })).rejects.toBe(
      failure,
    );
    expect(api.fetchJSON).toHaveBeenCalledTimes(1);
    expect(api.fetchJSON.mock.calls[0][1].method).toBe("PATCH");
  });

  it("does not retry a missing incident with another method", async () => {
    api.fetchJSON.mockRejectedValueOnce(new Error("HTTP 404: incidente no encontrado"));

    await expect(
      updateParentIncident(incident, { description: "Nueva descripción" }),
    ).rejects.toThrow("HTTP 404");
    expect(api.fetchJSON).toHaveBeenCalledTimes(1);
  });

  it("tries PUT when the server does not support PATCH", async () => {
    api.fetchJSON.mockRejectedValueOnce(new Error("HTTP 405: método no permitido"));
    api.fetchJSON.mockResolvedValueOnce({ id: 18 });

    await expect(
      updateParentIncident(incident, { description: "Nueva descripción" }),
    ).resolves.toEqual({
      id: 18,
    });
    expect(api.fetchJSON).toHaveBeenCalledTimes(2);
    expect(api.fetchJSON.mock.calls.map(([, init]) => init.method)).toEqual(["PATCH", "PUT"]);
  });
});
