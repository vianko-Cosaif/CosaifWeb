import { expect, it } from "vitest";
import { canCancelNaturalState } from "@/features/torreon/naturales/cancellationPolicy";

it.each(["SOLICITADO", "ASIGNADO", "DETENIDO"])(
  "allows %s in each stopped unit state regardless of an earlier start",
  (estado) => {
    const movement = { estado, fechaInicio: "2026-10-15T17:35:00-06:00" };
    for (const unitState of ["PENDIENTE", "DETENIDA", "LISTA_REANUDAR"]) {
      const unit = {
        estado: unitState,
        fechaInicio: movement.fechaInicio,
        movimientos: [movement],
      };
      expect(canCancelNaturalState(movement, unit)).toBe(true);
    }
  },
);
it.each(["EN_PROCESO", "CONCLUIDO", "CANCELADO", "UNKNOWN"])(
  "rejects member state %s even in a ready unit",
  (estado) => expect(canCancelNaturalState({ estado }, { estado: "LISTA_REANUDAR" })).toBe(false),
);
it.each(["EN_PROCESO", "CONCLUIDA", "CANCELADA", "UNKNOWN"])(
  "rejects unit state %s even with a stopped member",
  (estado) => expect(canCancelNaturalState({ estado: "DETENIDO" }, { estado })).toBe(false),
);
it("rejects any running sibling, including another company, without relying on stale unit state", () => {
  const movement = { estado: "DETENIDO", empresaId: 3 };
  expect(
    canCancelNaturalState(movement, {
      estado: "LISTA_REANUDAR",
      movimientos: [movement, { estado: "EN_PROCESO", empresaId: 4 }],
    }),
  ).toBe(false);
});
it("supports legacy requests with no unit but rejects a missing referenced unit", () => {
  expect(canCancelNaturalState({ estado: "DETENIDO", unidadId: null }, null)).toBe(true);
  expect(canCancelNaturalState({ estado: "DETENIDO", unidadId: 71 }, null)).toBe(false);
});
