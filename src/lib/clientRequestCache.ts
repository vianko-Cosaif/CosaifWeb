"use client";

type CacheEntry = {
  data: unknown;
  expiresAt: number;
};

type CachedFetchOptions = {
  ttlMs?: number;
  force?: boolean;
  key?: string;
};

const responseCache = new Map<string, CacheEntry>();
const pendingRequests = new Map<string, Promise<unknown>>();

function requestKey(url: string, init?: RequestInit, explicitKey?: string) {
  if (explicitKey) return explicitKey;
  return `${String(init?.method || "GET").toUpperCase()}:${url}`;
}

function abortError() {
  return new DOMException("The operation was aborted", "AbortError");
}

function withConsumerAbort<T>(promise: Promise<T>, signal?: AbortSignal | null): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(abortError());

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(abortError());
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort));
  });
}

export function peekCachedJson<T>(url: string, key?: string): T | undefined {
  const entry = responseCache.get(key || `GET:${url}`);
  if (!entry || entry.expiresAt <= Date.now()) {
    if (entry) responseCache.delete(key || `GET:${url}`);
    return undefined;
  }
  return entry.data as T;
}

export function invalidateCachedJson(match?: string | RegExp) {
  if (!match) {
    responseCache.clear();
    return;
  }

  for (const key of responseCache.keys()) {
    const matches = typeof match === "string" ? key.includes(match) : match.test(key);
    if (matches) responseCache.delete(key);
  }
}

export async function cachedFetchJson<T>(
  url: string,
  init: RequestInit = {},
  options: CachedFetchOptions = {}
): Promise<T> {
  const ttlMs = Math.max(0, options.ttlMs ?? 20_000);
  const key = requestKey(url, init, options.key);
  const cached = responseCache.get(key);

  if (!options.force && cached && cached.expiresAt > Date.now()) {
    return cached.data as T;
  }

  let pending = pendingRequests.get(key) as Promise<T> | undefined;
  if (!pending) {
    const sharedInit = { ...init };
    delete sharedInit.signal;
    pending = fetch(url, sharedInit)
      .then(async (response) => {
        if (!response.ok) {
          const message = await response.text().catch(() => "");
          throw new Error(`${response.status} ${response.statusText}${message ? ` :: ${message.slice(0, 200)}` : ""}`);
        }
        return response.json() as Promise<T>;
      })
      .then((data) => {
        if (ttlMs > 0) responseCache.set(key, { data, expiresAt: Date.now() + ttlMs });
        return data;
      })
      .finally(() => {
        pendingRequests.delete(key);
      });
    pendingRequests.set(key, pending);
  }

  return withConsumerAbort(pending, init.signal);
}
