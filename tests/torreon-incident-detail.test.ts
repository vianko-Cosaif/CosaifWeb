import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchTorreonIncidentDetail,
  torreonIncidentDetailUrl,
} from "@/features/torreon/incidents/incidentDetail";
import { getTorreonUploadsRoots } from "@/lib/server/torreonImageStorage";

afterEach(() => vi.unstubAllGlobals());

describe("Torreon incident evidence detail", () => {
  it("requests the arrastre incident detail with its operation scope", () => {
    const url = new URL(
      torreonIncidentDetailUrl({ incidentId: 31, localidadId: 2, tipo: "ARRASTRE" }),
      "http://localhost",
    );
    expect(url.pathname).toBe("/api/incidentes/31");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      source: "torreon",
      tipo: "ARRASTRE",
      localidadId: "2",
    });
  });

  it("unwraps the detail response including proxied photos", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        success: true,
        data: {
          id: 31,
          fotos: [{ id: 4, url: "/api/torreon/imagenes/2026/09/21/torreon_incidente_31_1.jpeg" }],
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const detail = await fetchTorreonIncidentDetail({
      incidentId: 31,
      localidadId: 2,
      tipo: "ARRASTRE",
    });

    expect(detail.fotos).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/incidentes/31?source=torreon&tipo=ARRASTRE&localidadId=2",
      expect.objectContaining({ cache: "no-store", credentials: "include" }),
    );
  });

  it("reports a failed detail request instead of treating it as an incident without photos", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ error: "Servicio no disponible" }, { status: 503 })),
    );
    await expect(
      fetchTorreonIncidentDetail({ incidentId: 31, localidadId: 2, tipo: "ARRASTRE" }),
    ).rejects.toThrow("Servicio no disponible");
  });

  it("prefers the configured upload directory and supports both backend folder names", () => {
    const cwd = path.resolve("C:/workspace/CosaifWeb");
    const configured = path.resolve("D:/shared/torreon/incidentes");
    const roots = getTorreonUploadsRoots(cwd, configured);

    expect(roots[0]).toBe(configured);
    expect(roots).toContain(path.resolve(cwd, "../BackCosaif/uploads/incidentes"));
    expect(roots).toContain(path.resolve(cwd, "../BackCosaif2/uploads/incidentes"));
  });
});
