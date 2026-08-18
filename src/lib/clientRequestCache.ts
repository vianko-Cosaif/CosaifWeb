"use client";

type CacheEntry = {
  data: unknown;
  expiresAt: number;
};

type CachedFetchOptions = {
  ttlMs?: number;
  force?: boolean;
  key?: string;
  timeoutMs?: number;
};

export class ClientRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = "ClientRequestError";
  }
}

const responseCache = new Map<string, CacheEntry>();
const pendingRequests = new Map<string, Promise<unknown>>();

function requestKey(url: string, init?: RequestInit, explicitKey?: string) {
  if (explicitKey) return explicitKey;
  return `${String(init?.method || "GET").toUpperCase()}:${url}`;
}

function abortError() {
  return new DOMException("The operation was aborted", "AbortError");
}

function cleanServerMessage(value: unknown) {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, 180);
}

async function responseError(response: Response) {
  let serverMessage = "";
  if ((response.headers.get("content-type") || "").includes("application/json")) {
    const payload = await response.json().catch(() => null) as { message?: unknown; error?: unknown } | null;
    serverMessage = cleanServerMessage(payload?.message) || cleanServerMessage(payload?.error);
  }

  const known = {
    400: serverMessage || "Revisa los datos enviados.",
    401: "Tu sesión terminó. Vuelve a iniciar sesión.",
    403: "Esta acción no está habilitada para tu cuenta.",
    404: serverMessage || "El registro solicitado ya no está disponible.",
    409: serverMessage || "La información cambió. Actualiza e inténtalo de nuevo.",
    422: serverMessage || "Hay datos que necesitan corrección.",
    429: "Hay muchas solicitudes en curso. Espera un momento e inténtalo de nuevo.",
  } as Record<number, string>;
  const retryable = response.status === 408 || response.status === 425 || response.status === 429 || response.status >= 500;
  const message = known[response.status]
    || (response.status >= 500 ? "El servicio está temporalmente ocupado. Puedes reintentar." : "No se pudo completar la solicitud.");

  return new ClientRequestError(message, response.status, `HTTP_${response.status}`, retryable);
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
    const controller = new AbortController();
    const timeoutMs = Math.max(1_000, options.timeoutMs ?? 12_000);
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

    pending = fetch(url, { ...sharedInit, signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw await responseError(response);
        }
        return response.json() as Promise<T>;
      })
      .then((data) => {
        if (ttlMs > 0) responseCache.set(key, { data, expiresAt: Date.now() + ttlMs });
        return data;
      })
      .finally(() => {
        window.clearTimeout(timeoutId);
        pendingRequests.delete(key);
      });
    pendingRequests.set(key, pending);
  }

  return withConsumerAbort(pending, init.signal);
}
