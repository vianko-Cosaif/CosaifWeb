import { describe, expect, it } from "vitest";
import { MovementScopeError, recordMatchesMovementScope, resolveMovementReadScope, scopePrivateClientMovementRead } from "@/lib/auth/movementScope";
import { loginProfile } from "./fixtures/authorization";
import type { VerifiedSession } from "@/lib/sessionToken";

const session: VerifiedSession = { userId: 7, role: "CLIENTE", empresaId: 3, localidadId: 1, authorization: loginProfile() };

describe("signed client movement scope", () => {
  it.each(["history-list", "detail"] as const)("keeps %s private even with a forged locality scope flag", (context) => {
    expect(resolveMovementReadScope(session, context, new URLSearchParams("alcance=localidad"))).toMatchObject({ empresaId: 3, localidadId: 1, sharedCurrentLocality: false });
  });
  it("shares only the current collection and allows company filters inside the assigned locality", () => {
    expect(resolveMovementReadScope(session, "current-list", new URLSearchParams())).toMatchObject({ empresaId: null, localidadId: 1, sharedCurrentLocality: true });
    expect(resolveMovementReadScope(session, "current-list", new URLSearchParams("empresaId=4"))).toMatchObject({ empresaId: 4, localidadId: 1 });
  });
  it.each(["localidadId=2", "empresaId=4", "localidadId=-1", "empresaId=unknown"])("rejects manipulated private filters: %s", (query) => {
    expect(() => resolveMovementReadScope(session, "history-list", new URLSearchParams(query))).toThrow(MovementScopeError);
  });
  it("rejects another locality even for current shared operation", () => {
    expect(() => resolveMovementReadScope(session, "current-list", new URLSearchParams("localidadId=2"))).toThrow(MovementScopeError);
  });
  it.each(["/movimientos/buscar", "/movimientos/7/edicion", "/rondas", "/torno/rondas-servicio/historial"])("does not widen the generic proxy %s", (path) => {
    const params = new URLSearchParams("alcance=localidad&finalizado=true");
    scopePrivateClientMovementRead(session, path, "GET", params);
    expect(params.get("empresaId")).toBe("3");
    expect(params.get("localidadId")).toBe("1");
    expect(params.has("alcance")).toBe(false);
  });
  it("rejects company/locality identifiers embedded in a private proxy path", () => {
    for (const path of ["/movimientos/empresa/4/pendientes", "/rondas/localidad/2/estado/false"]) {
      expect(() => scopePrivateClientMovementRead(session, path, "GET", new URLSearchParams())).toThrow(MovementScopeError);
    }
  });
  it("fails closed when records omit the required scope identity", () => {
    const scope = resolveMovementReadScope(session, "detail", new URLSearchParams());
    expect(recordMatchesMovementScope({ empresaId: 3, localidadId: 1 }, scope)).toBe(true);
    expect(recordMatchesMovementScope({ empresaId: 3 }, scope)).toBe(false);
    expect(recordMatchesMovementScope({ empresaId: 4, localidadId: 1 }, scope)).toBe(false);
  });

  it.each([
    { role: "COORDINADOR", mode: "LOCALITY", query: "empresaId=4", expectedEmpresa: 4, expectedLocality: 1 },
    { role: "CLIENTE_ADMIN", mode: "COMPANY", query: "localidadId=2", expectedEmpresa: 3, expectedLocality: 2 },
    { role: "CLIENTE_COOR", mode: "COMPANY_LOCALITY", query: "", expectedEmpresa: 3, expectedLocality: 1 },
    { role: "ADMINISTRADOR", mode: "GLOBAL", query: "empresaId=4&localidadId=2", expectedEmpresa: 4, expectedLocality: 2 },
  ] as const)("preserves the signed $mode scope for $role", ({ role, mode, query, expectedEmpresa, expectedLocality }) => {
    const scopedSession = { ...session, role, authorization: loginProfile(role) };
    scopedSession.authorization.scope.mode = mode;
    for (const context of ["current-list", "history-list"] as const) {
      expect(resolveMovementReadScope(scopedSession, context, new URLSearchParams(query))).toMatchObject({
        sharedCurrentLocality: false, empresaId: expectedEmpresa, localidadId: expectedLocality,
      });
    }
  });
});
