import { currentStorageScope } from '@/lib/auth/storageScope';
import { ClientRequestError, responseError } from './errors';
export { ClientRequestError } from './errors';

type CachedFetchOptions = { ttlMs?: number; force?: boolean; key?: string; timeoutMs?: number };
type CacheEntry = { data: unknown; expiresAt: number };
type Pending = { promise: Promise<unknown>; controller: AbortController; consumers: number; settled: boolean };
const responseCache = new Map<string, CacheEntry>();
const pendingRequests = new Map<string, Pending>();
const MAX_ENTRIES = 150;
let generation = 0;

function canonicalUrl(url: string) {
  const split = url.indexOf('?'); if (split < 0) return url;
  const params = new URLSearchParams(url.slice(split + 1)); params.sort();
  return `${url.slice(0, split)}?${params}`;
}
function keyFor(url: string, init: RequestInit = {}, explicit?: string) {
  const headers = JSON.stringify([...new Headers(init.headers).entries()].sort(([a], [b]) => a.localeCompare(b)));
  return `${currentStorageScope() || 'anonymous'}|${explicit || `GET:${canonicalUrl(url)}`}|${init.credentials || 'same-origin'}|${headers}`;
}
function abortError() { return new DOMException('The operation was aborted', 'AbortError'); }

async function readJson<T>(url: string, init: RequestInit, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const onAbort = () => controller.abort(init.signal?.reason);
  if (init.signal?.aborted) throw abortError();
  init.signal?.addEventListener('abort', onAbort, { once: true });
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  try {
    const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...init, signal: controller.signal });
    if (!response.ok) throw await responseError(response);
    if (response.status === 204) return undefined as T;
    return await response.json() as T;
  } catch (error) {
    if (timedOut) throw new ClientRequestError('El servicio tardó demasiado. Puedes reintentar.', 408, 'TIMEOUT', true);
    if (error instanceof TypeError) throw new ClientRequestError('No hay conexión con el servicio.', 0, 'NETWORK', true);
    throw error;
  } finally { clearTimeout(timer); init.signal?.removeEventListener('abort', onAbort); }
}

function consume<T>(entry: Pending, signal?: AbortSignal | null): Promise<T> {
  if (signal?.aborted) return Promise.reject(abortError());
  entry.consumers++;
  return new Promise<T>((resolve, reject) => {
    let done = false;
    const release = () => {
      if (done) return false;
      done = true; signal?.removeEventListener('abort', onAbort); entry.consumers--;
      if (!entry.settled && entry.consumers === 0) entry.controller.abort();
      return true;
    };
    const onAbort = () => { if (release()) reject(abortError()); };
    signal?.addEventListener('abort', onAbort, { once: true });
    entry.promise.then(value => { if (release()) resolve(value as T); }, error => { if (release()) reject(error); });
  });
}

export function peekCachedJson<T>(url: string, key?: string): T | undefined {
  const cacheKey = keyFor(url, {}, key); const entry = responseCache.get(cacheKey);
  if (!entry || entry.expiresAt <= Date.now()) { responseCache.delete(cacheKey); return undefined; }
  return entry.data as T;
}

export function invalidateCachedJson(match?: string | RegExp) {
  generation++;
  const matches = (key: string) => !match || (typeof match === 'string' ? key.includes(match) : (match.lastIndex = 0, match.test(key)));
  for (const key of responseCache.keys()) if (matches(key)) responseCache.delete(key);
  for (const [key, entry] of pendingRequests) if (matches(key)) { pendingRequests.delete(key); entry.controller.abort(); }
}

/** Only reads are shared/cached. Mutations always retain their own body and request. */
export async function cachedFetchJson<T>(url: string, init: RequestInit = {}, options: CachedFetchOptions = {}): Promise<T> {
  if (init.signal?.aborted) throw abortError();
  const timeoutMs = Math.max(1000, options.timeoutMs ?? 12_000);
  const read = !init.method || init.method.toUpperCase() === 'GET';
  if (!read || init.body) return readJson<T>(url, init, timeoutMs);
  const key = keyFor(url, init, options.key);
  const cached = responseCache.get(key);
  if (!options.force && cached && cached.expiresAt > Date.now()) return cached.data as T;
  if (cached) responseCache.delete(key);
  let entry = pendingRequests.get(key);
  if (entry?.controller.signal.aborted) { pendingRequests.delete(key); entry = undefined; }
  if (!entry) {
    const startedGeneration = generation;
    const controller = new AbortController();
    const next: Pending = { controller, consumers: 0, settled: false, promise: Promise.resolve() };
    next.promise = readJson<T>(url, { ...init, signal: controller.signal }, timeoutMs).then(data => {
      const ttlMs = Math.max(0, options.ttlMs ?? 20_000);
      if (ttlMs && generation === startedGeneration && !controller.signal.aborted) {
        responseCache.set(key, { data, expiresAt: Date.now() + ttlMs });
        for (const [oldKey, value] of responseCache) if (value.expiresAt <= Date.now()) responseCache.delete(oldKey);
        while (responseCache.size > MAX_ENTRIES) responseCache.delete(responseCache.keys().next().value!);
      }
      return data;
    }).finally(() => {
      next.settled = true;
      if (pendingRequests.get(key) === next) pendingRequests.delete(key);
    });
    pendingRequests.set(key, next); entry = next;
  }
  return consume<T>(entry, init.signal);
}
