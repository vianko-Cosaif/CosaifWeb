import type { CatalogCompany, CatalogSummary, LocationPayload, LocationSaveResult } from "./types";

const API_BASE = "/bff/catalogos-operativos";

async function requestJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");

  const response = await fetch(url, {
    ...init,
    headers,
    credentials: "include",
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null) as Record<string, unknown> | null;

  if (!response.ok) {
    const message = String(payload?.message || payload?.error || `Error HTTP ${response.status}`);
    throw new Error(message);
  }

  return payload as T;
}

function catalogRequest<T>(path: string, init: RequestInit = {}) {
  return requestJson<T>(`${API_BASE}${path}`, init);
}

function readCompanies(payload: unknown): CatalogCompany[] {
  const source = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object"
      ? (["data", "empresas", "items", "results"]
          .map((key) => (payload as Record<string, unknown>)[key])
          .find(Array.isArray) ?? [])
      : [];

  return (source as unknown[])
    .map((item) => {
      const record = item && typeof item === "object" ? item as Record<string, unknown> : {};
      return { id: Number(record.id), nombre: String(record.nombre || "").trim() };
    })
    .filter((company) => Number.isInteger(company.id) && company.id > 0 && company.nombre)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es-MX", { sensitivity: "base" }));
}

export function fetchCatalogSummary() {
  return catalogRequest<CatalogSummary>("/resumen");
}

export function saveOperationalLocation(payload: LocationPayload) {
  return catalogRequest<LocationSaveResult>("/localidades-operativas", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchCompanies() {
  return readCompanies(await requestJson<unknown>("/bff/empresas"));
}

export function createCompany(nombre: string) {
  return requestJson<CatalogCompany>("/bff/empresas", {
    method: "POST",
    body: JSON.stringify({ nombre }),
  });
}
