import { describe, expect, it } from "vitest";
import { operationalMessage } from "@/lib/operationalMessage";

describe("operational notification text", () => {
  it.each([
    ["EN_PROCESO", "Torneado iniciado"],
    ["CONCLUIDO", "Torneado finalizado"],
  ])("describes the actual torno event %s without a generic update", (estado, title) => {
    expect(
      operationalMessage({
        type: "torno.estado",
        estado,
        movimientoId: 42,
        locomotiveNumber: 701,
        localidadId: 10,
      }),
    ).toMatchObject({ title, body: "Locomotora 701 · Movimiento #42 · Patio 10" });
  });

  it("keeps incident context alongside its description", () => {
    expect(
      operationalMessage({
        type: "movimiento.incidente",
        movimientoId: 42,
        locomotiveNumber: 701,
        incidenteId: 8,
        localidadNombre: "Guadalajara",
        descripcion: "Obstrucción en vía 3",
      }),
    ).toMatchObject({
      title: "Incidente reportado",
      body: "Locomotora 701 · Movimiento #42 · Incidente #8 · Guadalajara · Obstrucción en vía 3",
    });
  });

  it.each([
    ["torreon.arrastre.creado", "SOLICITADO", "Nueva solicitud de arrastre"],
    ["torreon.arrastre.estado", "ASIGNADO", "Arrastre asignado"],
    ["torreon.arrastre.estado", "EN_PROCESO", "Arrastre iniciado"],
    ["torreon.arrastre.estado", "DETENIDO", "Arrastre detenido"],
    ["torreon.arrastre.estado", "CONCLUIDO", "Arrastre finalizado"],
    ["torreon.arrastre.estado", "CANCELADO", "Arrastre cancelado"],
    ["torreon.arrastre.incidente", "DETENIDO", "Incidente reportado"],
  ])("identifies %s %s when the server has no formatted message", (type, estado, title) => {
    expect(operationalMessage({ type, estado, arrastreId: 9, localidadId: 2 })).toMatchObject({
      title,
      body: "Arrastre #9 · Patio 2",
    });
  });

  it("distinguishes resumption from the first start", () => {
    expect(
      operationalMessage({
        type: "movimiento.estado",
        estado: "EN_PROCESO",
        estadoAnterior: "DETENIDO",
      }).title,
    ).toBe("Movimiento reanudado");
  });

  it.each([
    {
      notificationTitle: "Incidente resuelto en Torreón",
      notificationBody: "Movimiento #42 · Solución confirmada por supervisor",
    },
    {
      title: "Incidente resuelto en Torreón",
      body: "Movimiento #42 · Solución confirmada por supervisor",
    },
  ])(
    "preserves complete server text instead of replacing it with a generic fallback",
    (message) => {
      expect(
        operationalMessage({
          type: "incidente.estado",
          estado: "RESUELTO",
          descripcion: "Old description",
          ...message,
        }),
      ).toMatchObject({
        title: "Incidente resuelto en Torreón",
        body: "Movimiento #42 · Solución confirmada por supervisor",
      });
    },
  );
});
