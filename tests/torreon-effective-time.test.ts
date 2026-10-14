import { expect, it } from "vitest";
import {
  filterQueue,
  naturalTiming,
  type QueueMovement,
  type QueueUnit,
} from "@/features/torreon/naturales/queueView";

const movement: QueueMovement = {
  id: 1,
  empresaId: 3,
  locomotiveNumber: 100,
  estado: "EN_PROCESO",
  fechaInicio: "2026-10-11T18:00:00Z",
  tiempoActivoSegundos: 600,
  tiempoCalculadoEn: "2026-10-11T18:30:00Z",
};
const unit: QueueUnit = {
  id: 1,
  modalidad: "INDIVIDUAL",
  estado: "EN_PROCESO",
  operadorId: 1,
  disponible: false,
  posicion: 1,
  ordenManual: null,
  movimientos: [movement],
  incidentes: [],
};

it("distinguishes effective work from total time and advances only the active interval", () => {
  expect(naturalTiming(unit, movement, Date.parse("2026-10-11T18:31:00Z"))).toEqual({
    label: "Trabajo efectivo",
    value: "11 min",
    total: "31 min",
  });
});

it.each(["DETENIDA", "LISTA_REANUDAR", "CONCLUIDA", "CANCELADA"])(
  "freezes effective work for %s",
  (estado) => {
    expect(
      naturalTiming({ ...unit, estado }, movement, Date.parse("2026-10-11T19:00:00Z")).value,
    ).toBe("10 min");
  },
);

it("uses the recorded finish and never labels a legacy total as effective work", () => {
  const finished = {
    ...movement,
    estado: "CONCLUIDO",
    fechaFin: "2026-10-11T18:45:00Z",
  };
  expect(naturalTiming({ ...unit, estado: "CONCLUIDA" }, finished)).toEqual({
    label: "Trabajo efectivo",
    value: "10 min",
    total: "45 min",
  });
  expect(naturalTiming(unit, { ...finished, tiempoActivoSegundos: undefined })).toEqual({
    label: "Tiempo total",
    value: "45 min",
  });
});

it("filters the full natural collection by Monterrey calendar dates, including records after the first 100", () => {
  const rows = Array.from({ length: 110 }, (_, index) => ({
    ...unit,
    id: index + 1,
    movimientos: [
      {
        ...movement,
        id: index + 1,
        fechaFin: index === 109 ? "2026-10-12T05:59:59Z" : "2026-10-12T06:00:00Z",
      },
    ],
  }));
  expect(
    filterQueue(rows, "", "", "", {
      field: "fin",
      from: "2026-10-11",
      to: "2026-10-11",
    }).map((row) => row.id),
  ).toEqual([110]);
  expect(
    filterQueue(rows, "", "", "", {
      field: "fin",
      from: "2026-10-12",
      to: "2026-10-11",
    }),
  ).toEqual([]);
});
