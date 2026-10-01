import { mapConcurrent } from "@/lib/http/concurrency";
import { arrastreListUrl, parseArrastrePage } from "../arrastres/listQuery";
import type { Arrastre } from "../arrastres";
import { readTorreonJson, type TorreonPage } from "../useTorreonCollection";

const HISTORY_SCOPES = [false, true] as const;
const PAGE_SIZE = 100;
const MAX_CONCURRENT_PAGES = 4;

/** Read both scopes concurrently, then bound additional pages without changing their order. */
export async function readIncidentArrastres(
  localidadId: number,
  signal: AbortSignal,
  force: boolean,
): Promise<Arrastre[]> {
  const readPage = async (history: boolean, page: number): Promise<TorreonPage<Arrastre>> => {
    if (signal.aborted) throw signal.reason;
    return parseArrastrePage(
      await readTorreonJson<unknown>(
        arrastreListUrl({ localidadId, page, pageSize: PAGE_SIZE, history, conIncidentes: true }),
        signal,
        force,
      ),
    );
  };
  const first = await Promise.all(HISTORY_SCOPES.map((history) => readPage(history, 1)));
  const remaining = first.flatMap((response, scopeIndex) =>
    Array.from({ length: response.meta.totalPages - 1 }, (_, index) => ({
      scopeIndex,
      page: index + 2,
    })),
  );
  const pages = await mapConcurrent(remaining, MAX_CONCURRENT_PAGES, ({ scopeIndex, page }) =>
    readPage(HISTORY_SCOPES[scopeIndex], page),
  );
  if (signal.aborted) throw signal.reason;
  const rows = first.map((response) => [...response.data]);
  pages.forEach((response, index) => rows[remaining[index].scopeIndex].push(...response.data));
  return rows.flat();
}
