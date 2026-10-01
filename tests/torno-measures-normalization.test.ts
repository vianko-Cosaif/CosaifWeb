import { describe, expect, it } from "vitest";
import { firstMeasureSource, normalizeMeasures } from "@/features/torno/lib/tornoMeasures";

describe("torno measurements from service responses", () => {
  it("accepts named wheel fields and the configured wheel count", () => {
    expect(
      normalizeMeasures({ cantidadRuedas: "8", l1: { valor: 903 }, R1: "901", unrelated: true }),
    ).toEqual({ wheelCount: 8, L1: 903, R1: "901" });
  });

  it("accepts row-style responses without treating malformed values as measurements", () => {
    expect(
      normalizeMeasures([
        { lado: "L", eje: 2, medida: 899 },
        { posicion: "r2", value: "900" },
        { posicion: "L3", valor: { unexpected: true } },
      ]),
    ).toEqual({ L2: 899, R2: "900", L3: null });
  });

  it("uses the first populated source when the service sends several formats", () => {
    const populated = { wheelCount: 4, L1: 890 };
    expect(firstMeasureSource(null, {}, populated, { L1: 999 })).toBe(populated);
  });
});
