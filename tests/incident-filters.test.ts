import { describe, expect, it } from "vitest";
import { loginProfile } from "./fixtures/authorization";
import {
  changeIncidentFilter,
  incidentApiUrl,
  initialIncidentFilters,
  resetIncidentFilters,
} from "@/features/incidentes/operacion/incidentFilters";

describe("incident filters", () => {
  it("uses the signed locality before the first request, even when the URL asks for another source", () => {
    const profile = loginProfile("CLIENTE");
    profile.scope.localidadId = 2;
    const filters = initialIncidentFilters(
      profile,
      new URLSearchParams("source=cosaif&tipo=ARRASTRE"),
    );

    expect(filters).toMatchObject({
      source: "torreon",
      empresaId: 3,
      localidadId: 2,
      torreonTipo: "ARRASTRE",
    });
    expect(incidentApiUrl(filters, "Actuales", "NATURAL")).toContain("source=torreon&tipo=NATURAL");
    expect(changeIncidentFilter(filters, "source", "cosaif", profile)).toBe(filters);
    expect(changeIncidentFilter(filters, "empresaId", 99, profile)).toBe(filters);
    expect(changeIncidentFilter(filters, "localidadId", 1, profile)).toBe(filters);
  });

  it("clears conflicting locality and source selections for unrestricted roles", () => {
    const profile = loginProfile("ADMINISTRADOR");
    profile.scope = { mode: "GLOBAL", empresaId: null, localidadId: null };
    const initial = initialIncidentFilters(profile, new URLSearchParams());
    const torreon = changeIncidentFilter(initial, "localidadId", 2, profile);
    expect(torreon).toMatchObject({ source: "torreon", localidadId: 2 });
    expect(changeIncidentFilter(torreon, "source", "cosaif", profile)).toMatchObject({
      source: "cosaif",
      localidadId: null,
      torreonTipo: "TODOS",
    });

    const guadalajara = changeIncidentFilter(torreon, "localidadId", 1, profile);
    expect(guadalajara).toMatchObject({ source: "cosaif", localidadId: 1 });
    expect(changeIncidentFilter(guadalajara, "source", "torreon", profile)).toMatchObject({
      source: "torreon",
      localidadId: null,
    });
  });

  it("resets editable filters without losing the client's signed company or locality", () => {
    const profile = loginProfile("CLIENTE");
    const filters = initialIncidentFilters(profile, new URLSearchParams("source=torreon"));
    const searched = changeIncidentFilter(filters, "searchQuery", "locomotora", profile);
    expect(incidentApiUrl(searched, "Actuales", "NATURAL")).toBe(
      incidentApiUrl(filters, "Actuales", "NATURAL"),
    );
    expect(resetIncidentFilters(searched, profile)).toMatchObject({
      source: "cosaif",
      empresaId: 3,
      localidadId: 1,
      searchQuery: "",
    });
  });
});
