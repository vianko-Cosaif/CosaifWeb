import { describe, expect, it } from "vitest";
import {
  DEFAULT_MOVEMENT_FILTERS,
  movementDateBoundary,
  movementFilterError,
  movementFilterPolicy,
  movementSearchParams,
  normalizeMovementFilters,
  type MovementFilterScope,
} from "@/features/movimientos/list/filterRules";
import { getFilterPolicy } from "@/lib/routePolicy";
import type { AppRole, AuthorizationScopeMode } from "@/lib/accessControl";
import { currentQueueMovements, filterCurrentMovements, type FiltrosMovimientos } from "@/features/movimientos/list/useMovimientos";
import { loginProfile } from "./fixtures/authorization";

function signedScope(role: AppRole, mode: AuthorizationScopeMode): MovementFilterScope {
  const authorization = loginProfile(role);
  authorization.scope = { mode, empresaId: 3, localidadId: 1 };
  return { rol: role, empresaId: 30, localidadId: 10, authorization };
}

describe("movement filters follow the signed role and contextual scope", () => {
  it.each([
    { role: "ADMINISTRADOR", mode: "GLOBAL", company: true, locality: true, empresaId: 99, localidadId: 88 },
    { role: "COORDINADOR", mode: "LOCALITY", company: true, locality: false, empresaId: 99, localidadId: 1 },
    { role: "CLIENTE_ADMIN", mode: "COMPANY", company: false, locality: true, empresaId: 3, localidadId: 88 },
    { role: "CLIENTE_COOR", mode: "COMPANY", company: false, locality: true, empresaId: 3, localidadId: 88 },
    { role: "CLIENTE", mode: "COMPANY_LOCALITY", company: false, locality: false, empresaId: 3, localidadId: 1 },
  ] as const)("enforces $role/$mode on a restored history URL", ({ role, mode, company, locality, empresaId, localidadId }) => {
    const scope = signedScope(role, mode);
    expect(movementFilterPolicy(scope, "pasados")).toMatchObject({ canEditEmpresa: company, canEditLocalidad: locality });
    const filters = normalizeMovementFilters({ empresaId: 99, localidadId: 88, estado: "CONCLUIDO" }, "pasados", scope);
    expect(filters).toMatchObject({ empresaId, localidadId, estado: "CONCLUIDO" });
    const query = new URLSearchParams(movementSearchParams(filters, "pasados"));
    expect(query.get("empresaId")).toBe(String(empresaId));
    expect(query.get("localidadId")).toBe(String(localidadId));
  });

  it("shares current CLIENTE companies only inside the signed locality, then restores the private history scope", () => {
    const scope = signedScope("CLIENTE", "COMPANY_LOCALITY");
    const current = normalizeMovementFilters({ empresaId: 9, localidadId: 88 }, "actuales", scope);
    expect(current).toMatchObject({ empresaId: 9, localidadId: 1 });
    expect(movementFilterPolicy(scope, "actuales")).toMatchObject({ canEditEmpresa: true, canEditLocalidad: false });
    expect(normalizeMovementFilters(current, "pasados", scope)).toMatchObject({ empresaId: 3, localidadId: 1 });
    expect(normalizeMovementFilters({ empresaId: null }, "actuales", scope).empresaId).toBeUndefined();
  });

  it("uses the signed CLIENTE role over a stale role prop, and keeps history private for every signed mode", () => {
    for (const mode of ["GLOBAL", "LOCALITY", "COMPANY", "COMPANY_LOCALITY"] as const) {
      const scope = { ...signedScope("CLIENTE", mode), rol: "ADMINISTRADOR" };
      expect(movementFilterPolicy(scope, "pasados")).toMatchObject({ canEditEmpresa: false, canEditLocalidad: false, forcedEmpresaId: 3, forcedLocalidadId: 1 });
      expect(normalizeMovementFilters({ empresaId: 99, localidadId: 88 }, "pasados", scope)).toMatchObject({ empresaId: 3, localidadId: 1 });
    }
  });

  it("does not widen unrelated filter contexts for CLIENTE", () => {
    const scope = signedScope("CLIENTE", "COMPANY_LOCALITY");
    expect(getFilterPolicy(scope)).toMatchObject({ canEditEmpresa: false, canEditLocalidad: false });
  });

  it("preserves the signed locality when a wrapper lock has no locality prop or a stale one", () => {
    for (const localidadId of [undefined, 99]) {
      const scope = { ...signedScope("CLIENTE", "COMPANY_LOCALITY"), localidadId, bloquearLocalidad: true };
      expect(normalizeMovementFilters({ localidadId: 88 }, "actuales", scope).localidadId).toBe(1);
    }
  });

  it("lets a GLOBAL wrapper lock its explicitly selected locality", () => {
    const scope = { ...signedScope("ADMINISTRADOR", "GLOBAL"), localidadId: 7, bloquearLocalidad: true };
    expect(movementFilterPolicy(scope, "actuales")).toMatchObject({ canEditLocalidad: false, forcedLocalidadId: 7 });
    expect(normalizeMovementFilters({ localidadId: 88 }, "actuales", scope).localidadId).toBe(7);
  });

  it("bounds manipulated URL controls and sends the actual backend page size", () => {
    const filters = normalizeMovementFilters({
      empresaId: -3, localidadId: Number.NaN, pagina: -2, tamPagina: 100,
      campoOrden: "unknown", direccionOrden: "invalid", prioridad: "urgent", fechaCampo: "unknown",
    } as unknown as Partial<FiltrosMovimientos>, "actuales", signedScope("ADMINISTRADOR", "GLOBAL"));
    expect(filters).toMatchObject({ empresaId: undefined, localidadId: undefined, pagina: 1, tamPagina: 50, campoOrden: "id", direccionOrden: "desc", prioridad: undefined, fechaCampo: "solicitud" });
    const query = new URLSearchParams(movementSearchParams(filters, "actuales"));
    expect(query.get("pageSize")).toBe("50");
    expect(query.has("empresaId")).toBe(false);
    expect(query.has("localidadId")).toBe(false);
  });

  it("keeps current shared stopped/scheduled multi-state filters and clears terminal states", () => {
    const scope = signedScope("CLIENTE", "COMPANY_LOCALITY");
    const filters = normalizeMovementFilters({ estado: " DETENIDO,AGENDADO,CONCLUIDO " }, "actuales", scope);
    expect(filters.estado?.split(",").sort()).toEqual(["AGENDADO", "DETENIDO"]);
    expect(new URLSearchParams(movementSearchParams(filters, "actuales")).get("estado")).toBe(filters.estado);
    expect(normalizeMovementFilters(filters, "pasados", scope).estado).toBe("DETENIDO");
    expect(normalizeMovementFilters(filters, "actuales", signedScope("ADMINISTRADOR", "GLOBAL")).estado).toBeUndefined();
  });

  it("retains multiple compatible generic states instead of dropping a checkbox selection", () => {
    const filters = normalizeMovementFilters({ estado: "solicitado,en_proceso,CONCLUIDO" }, "actuales", signedScope("COORDINADOR", "LOCALITY"));
    expect(filters.estado?.split(",").sort()).toEqual(["EN_PROCESO", "SOLICITADO"]);
  });
});

describe("movement dates and search parameters", () => {
  it.each(["2026-02-29", "2026-04-31", "2026-13-01", "2026-09-08T25:00", "2026-09-08T12:60", "2026-09-08T12:00:60Z", "2026-09-08T12:00+99:00", "not-a-date"])("rejects invalid calendar/time input %s", value => {
    expect(movementDateBoundary(value)).toBeNull();
    expect(movementFilterError({ ...DEFAULT_MOVEMENT_FILTERS, desde: value })).toBe("Selecciona fechas válidas para consultar movimientos.");
  });

  it("uses both complete date-only bounds in the browser timezone", () => {
    expect(movementDateBoundary("2024-02-29")).toBe(new Date(2024, 1, 29, 0, 0, 0, 0).toISOString());
    expect(movementDateBoundary("2024-02-29", true)).toBe(new Date(2024, 1, 29, 23, 59, 59, 999).toISOString());
  });

  it("preserves explicit ISO offsets and milliseconds when constructing the backend query", () => {
    const filters = { ...DEFAULT_MOVEMENT_FILTERS, desde: "2026-09-08T08:15:30.123-06:00", hasta: "2026-09-08T17:00:00+02:00", fechaCampo: "inicio" as const, busqueda: "  Ferromex  " };
    expect(movementFilterError(filters)).toBeNull();
    const query = new URLSearchParams(movementSearchParams(filters, "pasados"));
    expect(query.get("fechaDesde")).toBe("2026-09-08T14:15:30.123Z");
    expect(query.get("fechaHasta")).toBe("2026-09-08T15:00:00.000Z");
    expect(query.get("fechaCampo")).toBe("inicio");
    expect(query.get("q")).toBe("Ferromex");
    expect(query.get("ambito")).toBe("pasados");
  });

  it("checks reversed ranges by instant, including different offsets", () => {
    const filters = { ...DEFAULT_MOVEMENT_FILTERS, desde: "2026-09-08T09:00:00-06:00", hasta: "2026-09-08T14:00:00Z" };
    expect(movementFilterError(filters)).toBe("La fecha desde no puede ser posterior a la fecha hasta.");
    expect(movementFilterError({ ...filters, hasta: "2026-09-08T15:00:00Z" })).toBeNull();
  });

  it("rejects nonnumeric locomotive controls before a request", () => {
    expect(movementFilterError({ ...DEFAULT_MOVEMENT_FILTERS, locomotiveNumber: "123x" })).toContain("solo dígitos");
    expect(movementFilterError({ ...DEFAULT_MOVEMENT_FILTERS, locomotivePrefix: "12-" })).toContain("solo dígitos");
    expect(movementFilterError({ ...DEFAULT_MOVEMENT_FILTERS, locomotiveNumber: "0042", locomotivePrefix: "00" })).toBeNull();
  });
});

function round(id: number, empresaId = 3, localidadId = 1, estado = "SOLICITADO") {
  return {
    id: id + 1000, movimientoId: id, localidadId, concluido: false,
    empresa: { id: empresaId, nombre: empresaId === 3 ? "Empresa propia" : "Ferromex" },
    movimiento: {
      id, idTecnico: id + 5000, folioLocalidad: id, folioLocalidadLabel: `GDL-${id}`,
      locomotiveNumber: 4000 + id, estado, prioridad: id % 2 ? "ALTA" : "BAJA",
      localidad: { id: localidadId, nombre: localidadId === 1 ? "Guadalajara" : "Otro patio" },
      tipoMovimiento: "TRASLADO", lavado: false, torno: false,
      createdAt: "2026-09-07T14:00:00Z", fechaSolicitud: "2026-09-08T14:00:00Z", fechaInicio: "2026-09-08T15:00:00Z",
      viaOrigen: { nombre: "Vía 1" }, viaDestino: { nombre: "Vía 2" },
    },
  };
}

describe("complete current-round movement projection", () => {
  it("maps the signed locality and round company while retaining stopped/scheduled rounds of every company", () => {
    const rows = currentQueueMovements([round(1), round(2, 4, 1, "DETENIDO"), round(3, 4, 1, "AGENDADO")], 1);
    expect(rows.map(row => row.id)).toEqual([1, 2, 3]);
    expect(rows[1]).toMatchObject({ id: 2, idTecnico: 5002, folioLocalidad: 2, folioLocalidadLabel: "GDL-2", empresaId: 4, empresaNombre: "Ferromex", localidadId: 1, locomotora: 4002, estado: "DETENIDO", finalizado: false, viaOrigen: "Vía 1", viaDestino: "Vía 2" });
  });

  it("excludes closed rounds, terminal movements, missing identities and another locality, and deduplicates movement IDs", () => {
    const items = [
      round(1), { ...round(1), id: 9001 }, round(2, 4, 2),
      { ...round(3), concluido: true }, round(4, 3, 1, "CONCLUIDO"), round(5, 3, 1, "CANCELADO"),
      { ...round(6), localidadId: undefined }, { ...round(7), movimiento: undefined }, round(-1),
    ];
    expect(currentQueueMovements(items, 1).map(row => row.id)).toEqual([1]);
    expect(() => currentQueueMovements({ data: items }, 1)).toThrow("respuesta inválida");
  });

  it("filters and sorts all 125 rows before selecting a page instead of filtering a server-sized slice", () => {
    const input = Array.from({ length: 125 }, (_, index) => round(index + 1, (index + 1) % 5 === 0 ? 4 : 3));
    const rows = currentQueueMovements(input, 1);
    expect(rows).toHaveLength(125);
    const filters = { ...DEFAULT_MOVEMENT_FILTERS, empresaId: 4, localidadId: 1, tamPagina: 10, pagina: 2 };
    const filtered = filterCurrentMovements(rows, filters);
    expect(filtered).toHaveLength(25);
    expect(filtered.every(row => row.empresaId === 4 && row.localidadId === 1)).toBe(true);
    expect(filtered.slice((filters.pagina - 1) * filters.tamPagina, filters.pagina * filters.tamPagina).map(row => row.id)).toEqual([75, 70, 65, 60, 55, 50, 45, 40, 35, 30]);
    expect(rows[0].id).toBe(1);
    expect(input[0].movimiento.id).toBe(1);
  });

  it("combines company, locality, multi-state, priority and locomotive controls over the complete collection", () => {
    const rows = [
      ...currentQueueMovements([round(1, 4, 1, "DETENIDO"), round(2, 4, 1, "AGENDADO"), round(3, 3, 1, "DETENIDO"), round(4, 4, 1, "EN_PROCESO")], 1),
      ...currentQueueMovements([round(5, 4, 2, "DETENIDO")], 2),
    ];
    const filters = { ...DEFAULT_MOVEMENT_FILTERS, empresaId: 4, localidadId: 1, estado: "DETENIDO,AGENDADO", prioridad: "ALTA", locomotivePrefix: "400", locomotiveNumber: "4001" };
    expect(filterCurrentMovements(rows, filters).map(row => row.id)).toEqual([1]);
    expect(filterCurrentMovements(rows, { ...filters, locomotiveNumber: "4002" })).toEqual([]);
    expect(filterCurrentMovements(rows, { ...DEFAULT_MOVEMENT_FILTERS, busqueda: "fErRoMeX", localidadId: 1 }).map(row => row.id)).toEqual([4, 2, 1]);
  });

  it("filters the selected date field inclusively and excludes records without a usable date", () => {
    const rows = currentQueueMovements([round(1), round(2), round(3)], 1);
    rows[1].fechaInicio = null;
    rows[2].fechaInicio = "invalid";
    const filters = { ...DEFAULT_MOVEMENT_FILTERS, desde: "2026-09-08T09:00:00-06:00", hasta: "2026-09-08T15:00:00Z", fechaCampo: "inicio" as const };
    expect(filterCurrentMovements(rows, filters).map(row => row.id)).toEqual([1]);
    expect(filterCurrentMovements(rows, { ...filters, fechaCampo: "solicitud" })).toEqual([]);
    expect(filterCurrentMovements(rows, { ...filters, fechaCampo: "creacion", desde: "2026-09-07T14:00:00Z", hasta: "2026-09-07T14:00:00Z" })).toHaveLength(3);
  });
});
