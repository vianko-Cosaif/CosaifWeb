"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { invalidateCachedJson } from "@/lib/http/client";
import type { AnalyticsSummary, CommercialOrigin, CommercialPeriod } from "../types";
import { buildQuery, commercialApi } from "../lib/api";
import { todayIso } from "../lib/format";

export type CommercialFilters = {
  period: CommercialPeriod;
  referenceDate: string;
  empresaId?: number;
  localidadId?: number;
  origin?: CommercialOrigin;
  page: number;
};

type CommercialDataContextValue = {
  analytics: AnalyticsSummary | null;
  catalogs: AnalyticsSummary["catalogs"] | null;
  filters: CommercialFilters;
  loading: boolean;
  error: string;
  setFilters: (patch: Partial<CommercialFilters>) => void;
  refresh: () => void;
};

const CommercialDataContext = createContext<CommercialDataContextValue | null>(null);

export default function CommercialDataProvider({ children }: { children: React.ReactNode }) {
  const [filters, setFilterState] = useState<CommercialFilters>({ period: "MONTH", referenceDate: todayIso(), page: 1 });
  const [snapshot, setSnapshot] = useState<{ query: string; data: AnalyticsSummary } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  const setFilters = useCallback((patch: Partial<CommercialFilters>) => {
    setFilterState((current) => {
      const next = { ...current, ...patch, page: patch.page ?? 1 };
      return (Object.keys(next) as Array<keyof CommercialFilters>).every(key => next[key] === current[key]) ? current : next;
    });
  }, []);
  const refresh = useCallback(() => { invalidateCachedJson("/comercial/"); setRevision((value) => value + 1); }, []);

  const query = buildQuery({ ...filters, pageSize: 25 });
  const analytics = snapshot?.query === query ? snapshot.data : null;
  const catalogs = snapshot?.data.catalogs ?? null;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    commercialApi<AnalyticsSummary>(`/bff/comercial/analitica?${query}`, { signal: controller.signal })
      .then(data => {
        if (!controller.signal.aborted) setSnapshot({ query, data });
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "No se pudo cargar la información comercial");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [query, revision]);

  const value = useMemo(() => ({ analytics, catalogs, filters, loading, error, setFilters, refresh }), [analytics, catalogs, filters, loading, error, setFilters, refresh]);
  return <CommercialDataContext.Provider value={value}>{children}</CommercialDataContext.Provider>;
}

export function useCommercialData() {
  const context = useContext(CommercialDataContext);
  if (!context) throw new Error("useCommercialData debe usarse dentro de CommercialDataProvider");
  return context;
}
