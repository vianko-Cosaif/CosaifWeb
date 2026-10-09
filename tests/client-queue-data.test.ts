import { describe, expect, it } from "vitest";
import { clientQueueInfo, clientQueueUrl, selectClientQueue } from "@/features/rail-queue/cliente/queueData";
import type { Ronda } from "@/features/rail-queue/types";

const selection = { localidadId: 1, empresaId: 8, entity: "movimientos" as const };
const round = (id: number, empresaId: number, overrides: Partial<Ronda> = {}): Ronda => ({
  id, localidadId: 1, empresa: { id: empresaId, nombre: `Empresa ${empresaId}` }, rondaNumero: 1, orden: id, concluido: false,
  movimiento: { id, estado: "SOLICITADO" }, ...overrides,
});

describe("client current locality queue", () => {
  it("requests the shared current queue without filtering by the client's company", () => {
    const url = new URL(clientQueueUrl(selection), "http://localhost:3012");
    expect(url.pathname).toBe("/api/cliente/rondas");
    expect(Object.fromEntries(url.searchParams)).toEqual({ localidadId: "1", estado: "pendientes", entity: "movimientos", alcance: "localidad" });
  });

  it("retains other companies and paused movements while excluding concluded records and another locality", () => {
    const rows = [round(2, 9), round(1, 8), round(3, 9, { movimiento: { estado: "DETENIDO" } }), round(4, 8, { concluido: true }), round(5, 9, { movimiento: { estado: "CANCELADO" } }), round(6, 8, { localidadId: 2 })];
    expect(selectClientQueue(rows, selection).map((item) => item.id)).toEqual([1, 2, 3]);
    expect(rows.map((item) => item.id)).toEqual([2, 1, 3, 4, 5, 6]);
  });

  it("filters finalized Cosaif movements and terminal states while preserving active stop order", () => {
    const movementRound = (id: number, estado: string, finalizado: boolean) => round(id, 8, {
      source: "cosaif", movimiento: { id, estado, finalizado },
    });
    const rows = [movementRound(8, "DETENIDO", false), movementRound(1, "DETENIDO", true),
      movementRound(2, "SOLICITADO", true), movementRound(3, "CONCLUIDO", false),
      movementRound(4, "CANCELADO", false), movementRound(5, "RESUELTO", false),
      movementRound(7, "EN_PROCESO", false)];
    const items = selectClientQueue(rows, selection);
    expect(items.map(item => item.id)).toEqual([7, 8]);
    expect(items.map(item => item.orden)).toEqual([7, 8]);
    expect(rows.map(item => item.id)).toEqual([8, 1, 2, 3, 4, 5, 7]);
  });

  it("keeps Torreón and Torno outside the GDL movement finalization safeguard", () => {
    const torreon = round(1, 8, { source: "torreon", movimiento: { estado: "DETENIDO", finalizado: true } });
    const torno = round(2, 8, { source: "torno", movimiento: { estado: "DETENIDO", finalizado: true } });
    expect(selectClientQueue([torreon, torno], selection).map(item => item.id)).toEqual([1, 2]);
    expect(selectClientQueue([torno], { ...selection, entity: "torneados" }).map(item => item.id)).toEqual([2]);
  });

  it("keeps every returned active round in a stable operational order", () => {
    const rows = Array.from({ length: 125 }, (_, index) => round(index + 1, 8, { rondaNumero: index < 60 ? 2 : 1 })).reverse();
    const items = selectClientQueue(rows, selection);
    expect(items).toHaveLength(125);
    expect(items[0].id).toBe(61);
    expect(items.at(-1)?.id).toBe(60);
  });

  it("preserves company ownership and movement identifiers alongside the queue data", () => {
    const item = round(3, 9, { movimientoId: 80, movimiento: { id: 80, idTecnico: 80, folioLocalidadLabel: "GDL-80", torno: true, locomotiveNumber: 3400 } });
    const info = clientQueueInfo([item])[3];
    expect(info.empresa.id).toBe(9);
    expect(info.movimientoId).toBe(80);
    expect(info.movimiento.folioLocalidadLabel).toBe("GDL-80");
    expect(info.movimiento.locomotiveNumber).toBe(3400);
  });
});
