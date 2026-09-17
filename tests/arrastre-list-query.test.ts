import { describe, expect, it } from "vitest";
import {
  arrastreDateError,
  arrastreListUrl,
  parseArrastrePage,
} from "@/features/torreon/arrastres/listQuery";
import { buildArrastreFolio } from "@/features/torreon/arrastres/utils";

describe("Arrastre paginated contract", () => {
  it("keeps server filters and page in the request without sharing history", () => {
    const url = new URL(
      arrastreListUrl({
        localidadId: 2,
        page: 6,
        pageSize: 25,
        history: true,
        shared: true,
        q: "FXE & 10",
        estado: "TODOS",
        vagonEstado: "CONCLUIDO",
        desde: "2026-09-01T00:00:00Z",
      }),
      "http://localhost",
    );
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      pagination: "1",
      vista: "historial",
      page: "6",
      pageSize: "25",
      q: "FXE & 10",
      includeFotos: "0",
      vagonEstado: "CONCLUIDO",
    });
    expect(url.searchParams.has("alcance")).toBe(false);
    expect(url.searchParams.has("estado")).toBe(false);
    expect(arrastreListUrl({ localidadId: 2, page: 1, pageSize: 8, shared: true })).toContain(
      "alcance=localidad",
    );
  });
  it("rejects legacy arrays and malformed pagination instead of displaying truncated totals", () => {
    expect(() => parseArrastrePage([])).toThrow(/servicio de Torreón/);
    const page = {
      data: [{ id: 150 }],
      meta: { page: 6, pageSize: 25, total: 150, totalPages: 6 },
    };
    expect(parseArrastrePage(page)).toEqual(page);
    for (const invalid of [
      { pageSize: 0 },
      { total: -1 },
      { page: 0 },
      { totalPages: 1 },
      { pageSize: 101 },
    ])
      expect(() => parseArrastrePage({ ...page, meta: { ...page.meta, ...invalid } })).toThrow();
    expect(() => parseArrastrePage({ ...page, data: [{}] })).toThrow();
  });
  it("rejects reversed date ranges before sending a request", () => {
    expect(arrastreDateError("2026-09-10", "2026-09-09")).toMatch(/posterior/);
    expect(arrastreDateError("invalid", "")).toMatch(/fechas/);
    expect(arrastreDateError("2026-09-09", "2026-09-09")).toBeNull();
  });
  it("uses the same server folio across pages and daily counters", () => {
    const row = { id: 150, folioLabel: "#150", fechaSolicitud: "2026-09-01T12:00:00Z" };
    expect(buildArrastreFolio(row)).toBe("#150");
  });
});
