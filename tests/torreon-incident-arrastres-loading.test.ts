import { afterEach, expect, it, vi } from "vitest";
import { readIncidentArrastres } from "@/features/torreon/cliente/readIncidentArrastres";

const read = vi.hoisted(() => vi.fn());
vi.mock("@/features/torreon/useTorreonCollection", () => ({ readTorreonJson: read }));
afterEach(() => read.mockReset());

it("loads active and past incidents with at most four page requests and keeps page order", async () => {
  let pending = 0;
  let maxPending = 0;
  const started: string[] = [];
  read.mockImplementation(async (url: string) => {
    const query = new URL(url, "http://localhost").searchParams;
    const history = query.get("vista") === "historial";
    const page = Number(query.get("page"));
    started.push(`${history ? "history" : "active"}-${page}`);
    pending++;
    maxPending = Math.max(maxPending, pending);
    await new Promise((resolve) => setTimeout(resolve, 2));
    pending--;
    return {
      data: [{ id: (history ? 100 : 0) + page }],
      meta: { page, pageSize: 100, total: 700, totalPages: 7 },
    };
  });

  const rows = await readIncidentArrastres(2, new AbortController().signal, false);
  expect(started.slice(0, 2)).toEqual(["active-1", "history-1"]);
  expect(maxPending).toBe(4);
  expect(read).toHaveBeenCalledTimes(14);
  expect(rows.map((row) => row.id)).toEqual([
    1, 2, 3, 4, 5, 6, 7, 101, 102, 103, 104, 105, 106, 107,
  ]);
});

it("stops scheduling pages when the view is abandoned", async () => {
  const controller = new AbortController();
  let started = 0;
  read.mockImplementation(async (_url: string, signal: AbortSignal) => {
    started++;
    if (started <= 2) {
      return {
        data: [{ id: started }],
        meta: { page: 1, pageSize: 100, total: 700, totalPages: 7 },
      };
    }
    controller.abort();
    throw signal.reason;
  });
  await expect(readIncidentArrastres(2, controller.signal, false)).rejects.toBeTruthy();
  expect(started).toBeLessThanOrEqual(6);
});
