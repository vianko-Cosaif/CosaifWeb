// src/lib/api.ts
export const API_BASE = "/api/passthrough";

export async function fetchJSON<T = any>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers as any);
  const isJSON = init.body && !(init.body instanceof FormData);
  if (isJSON && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  // Authorization opcional desde cookie NO HttpOnly
  if (typeof document !== "undefined") {
    const m = document.cookie.match(/(?:^|;\s*)token=([^;]+)/);
    if (m && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${decodeURIComponent(m[1])}`);
  }

  const res = await fetch(url, { ...init, headers, credentials: "include", cache: "no-store" });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`);
  try { return JSON.parse(text) as T; } catch { return text as any as T; }
}
