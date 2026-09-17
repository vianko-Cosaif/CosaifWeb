// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useTornoMeasuresModal } from "@/features/torno-measures/useTornoMeasuresModal";
import TornoMeasuresDialog from "@/features/torno-measures/TornoMeasuresDialog";
import { DEFAULT_TORNO_MEDICION_STATE } from "@/features/movimientos/crear/tornoMedicion.types";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
it("aborts the previous selection and ignores late responses from another locomotive", async () => {
  const first = deferred<Response>();
  const second = deferred<Response>();
  const fetch = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  vi.stubGlobal("fetch", fetch);
  const { result } = renderHook(() => useTornoMeasuresModal("/api/cliente"));
  let initial!: Promise<void>, latest!: Promise<void>;
  act(() => {
    initial = result.current.openMeasuresModal({ movementId: 1 });
  });
  act(() => {
    latest = result.current.openMeasuresModal({ movementId: 2 });
  });
  expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);
  await act(async () => {
    second.resolve(Response.json({ movimiento: { locomotiveNumber: "0022" } }));
    await latest;
  });
  await act(async () => {
    first.resolve(Response.json({ movimiento: { locomotiveNumber: "0011" } }));
    await initial;
  });
  expect(result.current.measuresModal.locomotiveLabel).toBe("0022");
});
it("cancels outstanding work when closing or unmounting", async () => {
  const fetch = vi.fn().mockReturnValue(new Promise(() => {}));
  vi.stubGlobal("fetch", fetch);
  const { result, unmount } = renderHook(() => useTornoMeasuresModal("/xapi"));
  act(() => {
    void result.current.openMeasuresModal({ movementId: 1 });
  });
  act(() => result.current.closeMeasuresModal());
  expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);
  expect(result.current.measuresModal.open).toBe(false);
  act(() => {
    void result.current.openMeasuresModal({ movementId: 2 });
  });
  unmount();
  expect(fetch.mock.calls[1][1].signal.aborted).toBe(true);
});
it("keeps the loading dialog interactive inside fullscreen and restores the board", () => {
  const board = document.createElement("main"),
    control = document.createElement("button");
  board.append(control);
  document.body.append(board);
  const original = Object.getOwnPropertyDescriptor(document, "fullscreenElement");
  Object.defineProperty(document, "fullscreenElement", { configurable: true, value: board });
  const close = vi.fn();
  try {
    const view = render(
      <TornoMeasuresDialog
        state={{
          open: true,
          loading: true,
          error: null,
          tornoMedicion: DEFAULT_TORNO_MEDICION_STATE,
        }}
        onClose={close}
      />,
    );
    expect(board.contains(screen.getByRole("dialog", { name: "Medidas de torno" }))).toBe(true);
    expect(board.inert).not.toBe(true);
    expect(control.inert).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(close).toHaveBeenCalledOnce();
    view.unmount();
    expect(control.inert).not.toBe(true);
  } finally {
    if (original) Object.defineProperty(document, "fullscreenElement", original);
    else Reflect.deleteProperty(document, "fullscreenElement");
    board.remove();
  }
});
