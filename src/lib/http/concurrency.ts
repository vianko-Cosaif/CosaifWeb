/** Preserve input order while bounding independent read requests. */
export async function mapConcurrent<T, R>(items: readonly T[], concurrency: number, map: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const result = new Array<R>(items.length);
  let cursor = 0, failed = false;
  await Promise.all(Array.from({ length: Math.min(items.length, Math.max(1, Math.trunc(concurrency))) }, async () => {
    while (!failed && cursor < items.length) {
      const index = cursor++;
      try { result[index] = await map(items[index], index); }
      catch (error) { failed = true; throw error; }
    }
  }));
  return result;
}
