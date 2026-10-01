import type { AuthorizationProfile } from "@/lib/accessControl";
import { isTorreonLocalidadId } from "@/lib/torreonLocalidad";

export type IncidentSource = "cosaif" | "torreon";
export type TorreonIncidentKind = "TODOS" | "NATURAL" | "ARRASTRE";
export type IncidentTab = "Actuales" | "Pasados";

export type IncidentFilters = {
  source: IncidentSource;
  torreonTipo: TorreonIncidentKind;
  empresaId: number | null;
  localidadId: number | null;
  searchQuery: string;
};

type IncidentQueryFilters = Pick<
  IncidentFilters,
  "source" | "torreonTipo" | "empresaId" | "localidadId"
>;

export function incidentScope(profile: AuthorizationProfile) {
  return {
    company: profile.scope.mode === "COMPANY" || profile.scope.mode === "COMPANY_LOCALITY",
    locality: profile.scope.mode === "LOCALITY" || profile.scope.mode === "COMPANY_LOCALITY",
  };
}

export function isTorreonFilter(filters: IncidentQueryFilters) {
  return filters.source === "torreon" || isTorreonLocalidadId(filters.localidadId);
}

export function enforceIncidentScope(filters: IncidentFilters, profile: AuthorizationProfile) {
  const scope = incidentScope(profile);
  const empresaId = scope.company ? profile.scope.empresaId : filters.empresaId;
  const localidadId = scope.locality ? profile.scope.localidadId : filters.localidadId;
  const source = scope.locality
    ? isTorreonLocalidadId(localidadId)
      ? "torreon"
      : "cosaif"
    : filters.source;
  const torreonTipo = scope.locality && source === "cosaif" ? "TODOS" : filters.torreonTipo;
  if (
    empresaId === filters.empresaId &&
    localidadId === filters.localidadId &&
    source === filters.source &&
    torreonTipo === filters.torreonTipo
  )
    return filters;
  return { ...filters, empresaId, localidadId, source, torreonTipo };
}

export function initialIncidentFilters(profile: AuthorizationProfile, params: URLSearchParams) {
  const rawTipo = String(params.get("tipo") || params.get("tipoIncidente") || "").toUpperCase();
  const filters: IncidentFilters = {
    source: params.get("source")?.toLowerCase() === "torreon" ? "torreon" : "cosaif",
    torreonTipo: rawTipo === "ARRASTRE" || rawTipo === "NATURAL" ? rawTipo : "TODOS",
    empresaId: null,
    localidadId: null,
    searchQuery: "",
  };
  return enforceIncidentScope(filters, profile);
}

export function resetIncidentFilters(filters: IncidentFilters, profile: AuthorizationProfile) {
  const scope = incidentScope(profile);
  return enforceIncidentScope(
    {
      ...filters,
      source:
        scope.locality && isTorreonLocalidadId(profile.scope.localidadId) ? "torreon" : "cosaif",
      torreonTipo:
        scope.locality && isTorreonLocalidadId(profile.scope.localidadId)
          ? filters.torreonTipo
          : "TODOS",
      empresaId: null,
      localidadId: null,
      searchQuery: "",
    },
    profile,
  );
}

export function changeIncidentFilter(
  filters: IncidentFilters,
  key: keyof IncidentFilters,
  value: string | number | null,
  profile: AuthorizationProfile,
): IncidentFilters {
  const scope = incidentScope(profile);
  if (scope.locality && (key === "localidadId" || key === "source")) return filters;
  if (scope.company && key === "empresaId") return filters;
  if (filters[key] === value) return filters;

  if (key === "source") {
    if (value !== "cosaif" && value !== "torreon") return filters;
    return {
      ...filters,
      source: value,
      localidadId:
        filters.localidadId && isTorreonLocalidadId(filters.localidadId) !== (value === "torreon")
          ? null
          : filters.localidadId,
      torreonTipo: value === "cosaif" ? "TODOS" : filters.torreonTipo,
    };
  }
  if (key === "localidadId") {
    if (value !== null && (typeof value !== "number" || value <= 0)) return filters;
    return value === null
      ? { ...filters, localidadId: null }
      : {
          ...filters,
          localidadId: value,
          source: isTorreonLocalidadId(value) ? "torreon" : "cosaif",
          torreonTipo: isTorreonLocalidadId(value) ? filters.torreonTipo : "TODOS",
        };
  }
  if (key === "empresaId")
    return value === null || (typeof value === "number" && value > 0)
      ? { ...filters, empresaId: value }
      : filters;
  if (key === "torreonTipo")
    return value === "TODOS" || value === "NATURAL" || value === "ARRASTRE"
      ? { ...filters, torreonTipo: value }
      : filters;
  return typeof value === "string" ? { ...filters, searchQuery: value } : filters;
}

export function incidentApiUrl(
  filters: IncidentQueryFilters,
  tab: IncidentTab,
  clientKind: "NATURAL" | "ARRASTRE" | null,
  page = 1,
) {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: "20",
    estado: tab === "Actuales" ? "ABIERTO" : "PASADOS",
  });
  if (filters.empresaId) params.set("empresaId", String(filters.empresaId));
  if (filters.localidadId) params.set("localidadId", String(filters.localidadId));
  if (isTorreonFilter(filters)) {
    params.set("source", "torreon");
    if (clientKind || filters.torreonTipo !== "TODOS")
      params.set("tipo", clientKind || filters.torreonTipo);
  }
  return `/api/incidentes?${params.toString()}`;
}
