import { fetchJSON } from "@/lib/api";
import type { CatalogSummary, LocationPayload } from "./types";

const API_BASE = "/bff/catalogos-operativos";

export function fetchCatalogSummary() {
  return fetchJSON<CatalogSummary>(`${API_BASE}/resumen`);
}

export function saveOperationalLocation(payload: LocationPayload) {
  return fetchJSON(`${API_BASE}/localidades-operativas`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
