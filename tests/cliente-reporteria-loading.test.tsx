// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ClienteReporteriaClient from "@/features/reporteria/cliente/ClienteReporteriaClient";

const scope = vi.hoisted(() => ({ empresaId: 3 as number | null, localidadId: 2 as number | null, role: "CLIENTE" }));
vi.mock("@/lib/cookies", () => ({
  getEmpresaIdClient: () => scope.empresaId,
  getLocIdClient: () => scope.localidadId,
  getRoleClient: () => scope.role,
}));
vi.mock("@/features/reporteria/cliente/components/ReportKit", () => ({
  LoadingState: () => <p role="status">Cargando reporte</p>,
  EmptyState: () => <p>Sin reporte</p>,
}));
vi.mock("@/features/reporteria/cliente/components/ReportRenderers", () => ({
  ReportContent: ({ report, reportKey, cronologiaPage, onCronologiaPageChange }: {
    report: { marker: string };
    reportKey: string;
    cronologiaPage: number;
    onCronologiaPageChange: (page: number) => void;
  }) => <div>
    <p>{reportKey}: {report.marker}</p>
    {reportKey === "cronologia" ? <>
      <p>Página {cronologiaPage}</p>
      <button onClick={() => onCronologiaPageChange(cronologiaPage + 1)}>Página siguiente</button>
    </> : null}
  </div>,
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
const json = (marker: string) => new Response(JSON.stringify({ reporte: { marker } }), { headers: { "content-type": "application/json" } });

beforeEach(() => {
  localStorage.clear();
  Object.assign(scope, { empresaId: 3, localidadId: 2, role: "CLIENTE" });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("client report loading", () => {
  it("waits for the session scope and sends one initial scoped request", async () => {
    const fetch = vi.fn(async () => json("inicial"));
    vi.stubGlobal("fetch", fetch);
    render(<ClienteReporteriaClient />);
    await screen.findByText("carga: inicial");
    expect(fetch).toHaveBeenCalledOnce();
    const [url] = vi.mocked(globalThis.fetch).mock.calls[0];
    const query = new URL(String(url), "https://test.local").searchParams;
    expect(query.get("empresaId")).toBe("3");
    expect(query.get("localidadId")).toBe("2");
  });

  it("does not use a previous user's company stored in the browser over the current company", async () => {
    localStorage.setItem("user", JSON.stringify({ empresa: { id: 99, nombre: "Empresa anterior" } }));
    vi.stubGlobal("fetch", vi.fn(async () => json("actual")));
    render(<ClienteReporteriaClient />);
    await screen.findByText("carga: actual");
    const [url] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(new URL(String(url), "https://test.local").searchParams.get("empresaId")).toBe("3");
    expect(screen.queryByText("Empresa anterior")).toBeNull();
  });

  it.each(["empresaId", "localidadId"] as const)("does not request reports when required %s is absent", async (field) => {
    scope[field] = null;
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    render(<ClienteReporteriaClient />);
    expect((await screen.findByRole("alert")).textContent).toMatch(/asignada a la sesión/);
    expect(fetch).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: "Actualizar" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("keeps company-wide client roles usable without an assigned locality", async () => {
    Object.assign(scope, { role: "CLIENTE_ADMIN", localidadId: null });
    const fetch = vi.fn(async () => json("empresa"));
    vi.stubGlobal("fetch", fetch);
    render(<ClienteReporteriaClient />);
    await screen.findByText("carga: empresa");
    const [url] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(new URL(String(url), "https://test.local").searchParams.get("empresaId")).toBe("3");
    expect(new URL(String(url), "https://test.local").searchParams.has("localidadId")).toBe(false);
  });

  it.each([200, 503])("aborts the previous report and ignores its late %i response", async (status) => {
    const old = deferred<Response>();
    const fetch = vi.fn<(url: string, options: RequestInit) => Promise<Response>>()
      .mockImplementationOnce(() => old.promise)
      .mockImplementationOnce(async () => json("vigente"));
    vi.stubGlobal("fetch", fetch);
    render(<ClienteReporteriaClient />);
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "vias" } });
    await screen.findByText("vias: vigente");
    expect(fetch.mock.calls[0][1].signal?.aborted).toBe(true);
    await act(async () => {
      old.resolve(status === 200 ? json("anterior") : new Response("Fallo anterior", { status }));
    });
    expect(screen.getByText("vias: vigente")).toBeTruthy();
    expect(screen.queryByText(/anterior/)).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("hides the prior report while a different report is loading", async () => {
    const next = deferred<Response>();
    const fetch = vi.fn().mockResolvedValueOnce(json("anterior")).mockImplementationOnce(() => next.promise);
    vi.stubGlobal("fetch", fetch);
    render(<ClienteReporteriaClient />);
    await screen.findByText("carga: anterior");
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "vias" } });
    expect(screen.queryByText(/anterior/)).toBeNull();
    expect(screen.getByRole("status").textContent).toBe("Cargando reporte");
    expect((screen.getByRole("button", { name: "PDF" }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => { next.resolve(json("nuevo")); });
    expect(screen.getByText("vias: nuevo")).toBeTruthy();
  });

  it("resets chronology pagination before requesting changed filters", async () => {
    const fetch = vi.fn(async () => json("historial"));
    vi.stubGlobal("fetch", fetch);
    render(<ClienteReporteriaClient />);
    await screen.findByText("carga: historial");
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "cronologia" } });
    await screen.findByText("Página 1");
    fireEvent.click(screen.getByRole("button", { name: "Página siguiente" }));
    await screen.findByText("Página 2");
    fetch.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Día" }));
    await screen.findByText("Página 1");
    expect(fetch).toHaveBeenCalledOnce();
    const [url] = vi.mocked(globalThis.fetch).mock.calls[0];
    const query = new URL(String(url), "https://test.local").searchParams;
    expect(query.get("periodo")).toBe("DIA");
    expect(query.get("page")).toBe("1");
  });

  it("aborts an unfinished request on unmount", async () => {
    const response = deferred<Response>();
    const fetch = vi.fn<(url: string, options: RequestInit) => Promise<Response>>(() => response.promise);
    vi.stubGlobal("fetch", fetch);
    const view = render(<ClienteReporteriaClient />);
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    view.unmount();
    expect(fetch.mock.calls[0][1].signal?.aborted).toBe(true);
    await act(async () => { response.resolve(json("desmontado")); });
  });
});
