"use client";

import { getCookie } from "./utils";

const FETCH_TIMEOUT_MS = 12000;

function tokenHeader(): Headers {
  const headers = new Headers();
  headers.set("Accept", "application/json");
  const token = getCookie("token");
  if (token) headers.set("Authorization", `Bearer ${token}`);
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
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      signal: init.signal ?? controller.signal,
      credentials: "include",
      cache: "no-store",
    });
  } finally {
    clearTimeout(timeout);
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
    tokenHeader(),
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
