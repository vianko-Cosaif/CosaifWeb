// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invalidateCachedJson } from "@/lib/http/client";
import { useTorreonNaturales } from "@/features/torreon/naturales/hooks";

const json = (payload: unknown) => new Response(JSON.stringify(payload), { headers: { "content-type": "application/json" } });
const row = (id: number, empresaId = 8) => ({ id, empresaId, estado: "SOLICITADO" });
const deferred = () => {
  let resolve!: (value: Response) => void;
  return { promise: new Promise<Response>((done) => { resolve = done; }), resolve: (value: Response) => resolve(value) };
};
beforeEach(() => invalidateCachedJson());
afterEach(() => { cleanup(); invalidateCachedJson(); vi.unstubAllGlobals(); });

describe("Torreón natural movements", () => {
  it("does not let a slow current list replace the requested history", async () => {
    const active = deferred();
    const history = deferred();
    vi.stubGlobal("fetch", vi.fn((url: string) => url.includes("/empresas/lite") ? Promise.resolve(json([])) : url.includes("status=concluidos") ? history.promise : active.promise));
    const hook = renderHook(() => useTorreonNaturales(2));
    act(() => hook.result.current.setStatus("concluidos"));
    await act(async () => history.resolve(json({ data: [{ ...row(2), estado: "CONCLUIDO" }] })));
    await act(async () => active.resolve(json({ data: [row(1)] })));
    expect(hook.result.current.filteredRows.map((item) => item.id)).toEqual([2]);
    expect(hook.result.current.status).toBe("concluidos");
  });

  it("keeps a selected company filter when an item refresh belongs to another company", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url.includes("/empresas/lite")) return Promise.resolve(json([{ id: 8, nombre: "Empresa" }]));
      if (new URL(url, "http://localhost").searchParams.has("id")) return Promise.resolve(json({ data: row(2, 9) }));
      return Promise.resolve(json({ data: [row(1)] }));
    }));
    const hook = renderHook(() => useTorreonNaturales(2));
    act(() => hook.result.current.setEmpresaId(8));
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    await act(async () => hook.result.current.refreshById(2));
    expect(hook.result.current.filteredRows.map((item) => item.id)).toEqual([1]);
    expect(hook.result.current.empresaId).toBe(8);
  });

  it("preserves loaded results and reports service failure instead of clearing the table", async () => {
    let listReads = 0;
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url.includes("/empresas/lite")) return Promise.resolve(json([]));
      return Promise.resolve(++listReads === 1 ? json({ data: [row(1)] }) : new Response("Unavailable", { status: 503 }));
    }));
    const hook = renderHook(() => useTorreonNaturales(2));
    await waitFor(() => expect(hook.result.current.filteredRows).toHaveLength(1));
    await act(async () => hook.result.current.load(true));
    expect(hook.result.current.filteredRows).toHaveLength(1);
    expect(hook.result.current.error).toBeTruthy();
    expect(hook.result.current.loading).toBe(false);
  });
});
