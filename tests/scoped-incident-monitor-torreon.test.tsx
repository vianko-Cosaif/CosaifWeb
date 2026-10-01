// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import ScopedIncidentMonitor from "@/features/incidentes/monitor/ScopedIncidentMonitor";

const state = vi.hoisted(() => ({ props: null as null | Record<string, unknown> }));

vi.mock("next/dynamic", () => ({
  default: () => (props: Record<string, unknown>) => {
    state.props = props;
    return null;
  },
}));
vi.mock("@/lib/cookies", () => ({
  getClientCookie: () => null,
  getEmpresaIdClient: () => 3,
  getLocIdClient: () => 2,
  getRoleClient: () => "ARRASTRE_TORREON",
}));

beforeEach(() => {
  vi.useFakeTimers();
  state.props = null;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it("uses the Torreón incident API for the automatic arrastre monitor", () => {
  render(<ScopedIncidentMonitor scope="cliente" autoOpenNewIncidents />);
  act(() => vi.advanceTimersByTime(900));
  expect(state.props).toMatchObject({
    apiBase: "/api",
    empresaId: 3,
    localidadId: 2,
    autoOpenNewIncidents: true,
  });
});
