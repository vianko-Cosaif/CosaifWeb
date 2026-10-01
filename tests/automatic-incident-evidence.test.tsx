// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import IncidentMonitor from "@/features/incidentes/monitor/IncidentMonitor";
import IncidentModal from "@/features/incidentes/monitor/IncidentModal";
import {
  torreonIncidentRequest,
  torreonIncidentSourceQuery,
  withTorreonIncidentDetail,
} from "@/features/incidentes/monitor/torreonIncidentDetail";
import type { IncidenteEmergente } from "@/features/incidentes/useIncidentMonitor";

const state = vi.hoisted(() => ({
  onIncidentDetected: null as null | ((incident: unknown) => void),
  modalProps: null as null | Record<string, unknown>,
  detail: vi.fn(),
}));

vi.mock("next/dynamic", () => ({
  default: () => (props: Record<string, unknown>) => {
    state.modalProps = props;
    return null;
  },
}));
vi.mock("@/features/incidentes/useIncidentMonitor", () => ({
  useIncidentMonitor: (args: { onIncidentDetected: (incident: unknown) => void }) => {
    state.onIncidentDetected = args.onIncidentDetected;
    return {
      isMonitoring: true,
      lastCheck: null,
      error: null,
      activeIncidents: [],
      checkNow: vi.fn(),
      checkIfStale: vi.fn(),
    };
  },
}));
vi.mock("@/features/torreon/incidents/incidentDetail", () => ({
  fetchTorreonIncidentDetail: state.detail,
}));
vi.mock("@/features/capacitacion", () => ({ useGuidedManual: () => null }));
vi.mock("@/features/capacitacion/TrainingTourContext", () => ({
  TRAINING_INCIDENT_ID: -1,
  useTrainingTour: () => ({ active: false }),
}));
vi.mock("@/features/movimientos/useRealtimeMovimientos", () => ({
  useRealtimeMovimientos: () => "connected",
}));
vi.mock("@/hooks/useAuthErrorHandler", () => ({
  useAuthErrorHandler: () => ({ handleFetchRequest: vi.fn() }),
}));
vi.mock("@/features/incidentes/monitor/ImageGallery", () => ({
  ImageGallery: ({ images }: { images: string[] }) => <p>Galería: {images.join(", ")}</p>,
}));

const arrastreIncident: IncidenteEmergente = {
  id: 31,
  descripcion: "Incidente de arrastre",
  estado: "ABIERTO",
  fechaInicio: "2026-09-21T10:00:00Z",
  imagenes: [],
  _original: {
    id: 31,
    _source: "torreon",
    _torreonTipo: "ARRASTRE",
    localidadId: 2,
    movimiento: { empresaId: 3, empresa: { id: 3 } },
    fotosCount: 1,
  },
};

beforeEach(() => {
  state.onIncidentDetected = null;
  state.modalProps = null;
  state.detail.mockReset();
});
afterEach(() => cleanup());

it("loads the incident detail when the automatic alert opens, then supplies its photos to the modal", async () => {
  let resolveDetail!: (value: unknown) => void;
  state.detail.mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveDetail = resolve;
      }),
  );
  render(<IncidentMonitor apiBase="/api" empresaId={3} localidadId={2} />);

  act(() => state.onIncidentDetected?.(arrastreIncident));
  expect(state.detail).toHaveBeenCalledWith(
    { incidentId: 31, localidadId: 2, tipo: "ARRASTRE" },
    expect.any(AbortSignal),
  );
  expect(state.modalProps?.loadingImages).toBe(true);

  await act(async () => {
    resolveDetail({
      id: 31,
      imagenes: ["/api/torreon/imagenes/2026/09/21/torreon_incidente_arrastre_31_1.jpeg"],
    });
  });
  await waitFor(() => expect(state.modalProps?.loadingImages).toBe(false));
  expect((state.modalProps?.incident as IncidenteEmergente).imagenes).toEqual([
    "/api/torreon/imagenes/2026/09/21/torreon_incidente_arrastre_31_1.jpeg",
  ]);
});

it("keeps the arrastre kind in detail and mutation requests even when natural IDs can overlap", () => {
  expect(torreonIncidentRequest(arrastreIncident, 2)).toEqual({
    incidentId: 31,
    localidadId: 2,
    tipo: "ARRASTRE",
  });
  expect(torreonIncidentSourceQuery(arrastreIncident, 2)).toBe(
    "?source=torreon&tipo=ARRASTRE&localidadId=2",
  );
  expect(
    withTorreonIncidentDetail(arrastreIncident, {
      fotos: [{ url: "/api/torreon/imagenes/2026/09/21/torreon_incidente_arrastre_31_1.jpeg" }],
    }).imagenes,
  ).toHaveLength(1);
});

it("shows loading rather than saying there are no images while the automatic detail is pending", () => {
  const props = {
    incident: arrastreIncident,
    isOpen: true,
    onClose: vi.fn(),
    onResolve: vi.fn(),
    onSkip: vi.fn(),
    onContinue: vi.fn(),
  };
  const view = render(<IncidentModal {...props} loadingImages />);
  fireEvent.click(screen.getByRole("tab", { name: /imágenes/i }));
  expect(screen.getByText("Cargando imágenes del incidente…")).toBeTruthy();
  expect(screen.queryByText("No hay imágenes disponibles")).toBeNull();

  view.rerender(
    <IncidentModal
      {...props}
      incident={withTorreonIncidentDetail(arrastreIncident, {
        imagenes: ["/api/torreon/imagenes/2026/09/21/torreon_incidente_arrastre_31_1.jpeg"],
      })}
    />,
  );
  expect(screen.getByText(/Galería: \/api\/torreon\/imagenes/)).toBeTruthy();
});
