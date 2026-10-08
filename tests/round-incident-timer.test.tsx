// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import RoundIncidentTimer from "@/features/rail-queue/components/RoundIncidentTimer";
import { shouldUseIncidentCountdown } from "@/lib/incidentCountdownPolicy";

afterEach(() => { cleanup(); vi.useRealTimers(); });
it("restores elapsed time from the incident start and stays visible at expiry", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-01T12:09:59Z"));
  render(<RoundIncidentTimer incident={{ id: 7, fechaInicio: "2026-10-01T12:00:00Z", estado: "ABIERTO", source: "cosaif" }} />);
  expect(screen.getByText(/09:59 transcurridos/)).toBeTruthy();
  act(() => vi.advanceTimersByTime(1000));
  expect(screen.getByText(/10:00 transcurridos/)).toBeTruthy();
  expect(screen.getByText(/Tiempo vencido/)).toBeTruthy();
});
it("does not show a timer for a resolved incident", () => {
  const { container } = render(<RoundIncidentTimer incident={{ id: 7, fechaInicio: "2026-10-01T12:00:00Z", estado: "RESUELTO", source: "torreon" }} />);
  expect(container.textContent).toBe("");
});
it("keeps the GDL deadline while Torreón natural and arrastre incidents have no deadline", () => {
  expect(shouldUseIncidentCountdown({ source: "torreon", _torreonTipo: "NATURAL" })).toBe(false);
  expect(shouldUseIncidentCountdown({ source: "torreon", _torreonTipo: "ARRASTRE" })).toBe(false);
  expect(shouldUseIncidentCountdown({ source: "cosaif" })).toBe(true);
});

it("never declares a persistent Torreón incident expired even after a month", () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-01T12:00:00Z"));
  const { container } = render(<RoundIncidentTimer incident={{ id: 7, fechaInicio: "2026-09-01T12:00:00Z", estado: "ABIERTO", source: "torreon" }} />);
  expect(container.textContent).toBe("");
});
