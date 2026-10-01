"use client";

const FETCH_TIMEOUT_MS = 12000;

function baseHeaders(): Headers {
  const headers = new Headers();
  headers.set("Accept", "application/json");
  return headers;
}

function mergeHeaders(...sets: (HeadersInit | undefined)[]): Headers {
  const out = new Headers();
  for (const set of sets) {
    if (!set) continue;
    const headers = new Headers(set);
    headers.forEach((value, key) => out.set(key, value));
  }
  return out;
}

async function fetchWithTimeout(url: string, init: RequestInit = {}) {
  const controller = new AbortController();
  let timedOut = false;
  const abortFromCaller = () => {
    controller.abort(init.signal?.reason ?? new DOMException("La solicitud fue cancelada.", "AbortError"));
  };

  if (init.signal?.aborted) abortFromCaller();
  else init.signal?.addEventListener("abort", abortFromCaller, { once: true });

  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort(new DOMException("La solicitud excedió el tiempo de espera.", "TimeoutError"));
  }, FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      credentials: "include",
      cache: "no-store",
    });
  } catch (error) {
    if (timedOut) {
      throw new Error("La solicitud tardó demasiado. Intenta nuevamente.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    init.signal?.removeEventListener("abort", abortFromCaller);
  }
}

function parseJsonSafe<T>(text: string): T | undefined {
  try {
    return JSON.parse(text) as T;
  } catch {
    return undefined;
  }
}

export async function fetchJSON<T>(url: string, init: RequestInit = {}): Promise<T> {
  const isGet = !init.method || init.method.toUpperCase() === "GET";
  const headers = mergeHeaders(
    baseHeaders(),
    init.headers,
    isGet ? undefined : { "Content-Type": "application/json" }
  );
  const response = await fetchWithTimeout(url, { ...init, headers });
  const contentType = response.headers.get("content-type") || "";
  const text = await response.text().catch(() => "");
  const body = contentType.includes("application/json") ? parseJsonSafe<T>(text) : undefined;

  if (!response.ok) {
    const errorBody = body && typeof body === "object" ? (body as { message?: unknown; error?: unknown }) : undefined;
    const message =
      (typeof errorBody?.message === "string" ? errorBody.message : undefined) ??
      (typeof errorBody?.error === "string" ? errorBody.error : undefined) ??
      text ??
      `HTTP ${response.status}`;
    throw new Error(String(message));
  }

  return body ?? ({} as T);
}

export function readCollection<T>(value: unknown, keys: string[] = []): T[] {
  if (Array.isArray(value)) return value as T[];
  if (!value || typeof value !== "object") return [];

  const record = value as Record<string, unknown>;
  for (const key of ["data", ...keys, "items", "results"]) {
    if (Array.isArray(record[key])) return record[key] as T[];
  }

  return [];
}
