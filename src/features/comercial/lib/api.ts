import { cachedFetchJson, invalidateCachedJson } from "@/lib/http/client";

export async function commercialApi<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has("content-type")) headers.set("content-type", "application/json");
  const result = await cachedFetchJson<T>(url, { ...init, headers }, { ttlMs: 15_000 });
  if (init.method && init.method.toUpperCase() !== "GET") invalidateCachedJson("/comercial/");
  return result;
}

export function buildQuery(values: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== "") query.set(key, String(value));
  });
  return query.toString();
}
