import { describe, expect, it } from "vitest";
import { buildTornoCopyUpdates } from "@/features/movimientos/crear/tornoCopyPaste";
import type { TornoMeasurements } from "@/features/movimientos/crear/tornoMedicion.types";

const a = { whole: "90", num: "1", den: "2" };
const b = { whole: "91", num: "", den: "" };
const rows: TornoMeasurements = {
  L1: { alturaCeja: a, espesorCeja: b } as TornoMeasurements["L1"],
  R1: { alturaCeja: b } as TornoMeasurements["R1"],
};
const positions = ["L1", "R1"] as const;
const fields = ["alturaCeja", "espesorCeja"] as const;

describe("torno copy and paste plan", () => {
  it("copies one cell to the selected cell", () => {
    expect(
      buildTornoCopyUpdates(
        { scope: "cell", source: { position: "L1", field: "alturaCeja" } },
        [{ scope: "cell", position: "R1", field: "espesorCeja" }],
        positions,
        fields,
        rows,
      ),
    ).toEqual([{ position: "R1", field: "espesorCeja", value: a }]);
  });

  it("copies all visible fields of a row without mixing incompatible targets", () => {
    expect(
      buildTornoCopyUpdates(
        { scope: "row", source: { position: "L1" } },
        [
          { scope: "cell", position: "R1", field: "alturaCeja" },
          { scope: "row", position: "R1" },
        ],
        positions,
        fields,
        rows,
      ),
    ).toEqual([
      { position: "R1", field: "alturaCeja", value: a },
      { position: "R1", field: "espesorCeja", value: b },
    ]);
  });

  it("copies a column across the visible wheel positions", () => {
    expect(
      buildTornoCopyUpdates(
        { scope: "column", source: { field: "alturaCeja" } },
        [{ scope: "column", field: "espesorCeja" }],
        positions,
        fields,
        rows,
      ),
    ).toEqual([
      { position: "L1", field: "espesorCeja", value: a },
      { position: "R1", field: "espesorCeja", value: b },
    ]);
  });
});
