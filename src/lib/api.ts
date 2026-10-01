// src/lib/api.ts
export const API_BASE = "/api/passthrough";

export const API = {
  BASE: API_BASE,
  IMG(ruta: string): string {
    if (!ruta) return "";
    if (/^https?:\/\//i.test(ruta)) return ruta; // ya es absoluta
    const base = this.BASE.replace(/\/+$/, "");
    const path = String(ruta).replace(/^\.?\//, "");
    return `${base}/${path}`;
  },
};

export async function fetchJSON<T = unknown>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers as HeadersInit | undefined);
  const isForm = init.body instanceof FormData;

  if (init.body && !isForm && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(url, { ...init, headers, credentials: "include", cache: "no-store" });
  const text = await res.text();

  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`);

  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    return (text ? JSON.parse(text) : ({} as unknown)) as T;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

/** Descarga imagen protegida y retorna un Object URL para <img src=...> */
export async function fetchImageObjectURL(url: string): Promise<string> {
  const r = await fetch(url, { credentials: "include", cache: "no-store" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const blob = await r.blob();
  return URL.createObjectURL(blob);
}
