import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import RailQueueBoardAdmin from "@/features/rail-queue/administrador/RailQueueBoardAdmin";

describe("administrator dashboard initial HTML", () => {
  it("renders a useful loading state without browser storage or a previous update timestamp", () => {
    const html = renderToString(<RailQueueBoardAdmin />);
    expect(html).toContain("Control de operaciones");
    expect(html).toContain("Esperando actualización");
    expect(html).toContain("Los totales estarán disponibles al completar la consulta.");
    expect(html).not.toContain("No se pudo actualizar");
  });
});
