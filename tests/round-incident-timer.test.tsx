// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import RoundIncidentTimer from "@/features/rail-queue/components/RoundIncidentTimer";
import { shouldUseIncidentCountdown } from "@/lib/incidentCountdownPolicy";

afterEach(() => { cleanup(); vi.useRealTimers(); });
it("restores elapsed time from the incident start and stays visible at expiry", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-01T12:09:59Z"));
  render(<RoundIncidentTimer incident={{ id: 7, fechaInicio: "2026-10-01T12:00:00Z", estado: "ABIERTO", source: "torreon" }} />);
  expect(screen.getByText(/09:59 transcurridos/)).toBeTruthy();
  act(() => vi.advanceTimersByTime(1000));
  expect(screen.getByText(/10:00 transcurridos/)).toBeTruthy();
  expect(screen.getByText(/Tiempo vencido/)).toBeTruthy();
});
it("does not show a timer for a resolved incident", () => {
  const { container } = render(<RoundIncidentTimer incident={{ id: 7, fechaInicio: "2026-10-01T12:00:00Z", estado: "RESUELTO", source: "torreon" }} />);
  expect(container.textContent).toBe("");
});
it("enables the natural Torreón deadline without applying it to arrastres", () => {
  expect(shouldUseIncidentCountdown({ source: "torreon", _torreonTipo: "NATURAL" })).toBe(true);
  expect(shouldUseIncidentCountdown({ source: "torreon", _torreonTipo: "ARRASTRE" })).toBe(false);
  expect(shouldUseIncidentCountdown({ source: "cosaif" })).toBe(true);
});
