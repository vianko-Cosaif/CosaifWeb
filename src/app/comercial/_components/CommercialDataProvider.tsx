"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { AnalyticsSummary, CommercialOrigin, CommercialPeriod } from "../crmTypes";
import { buildQuery, commercialApi } from "../_lib/api";
import { todayIso } from "../_lib/format";

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
  filters: CommercialFilters;
  loading: boolean;
  error: string;
  setFilters: (patch: Partial<CommercialFilters>) => void;
  refresh: () => void;
};

const CommercialDataContext = createContext<CommercialDataContextValue | null>(null);

export default function CommercialDataProvider({ children }: { children: React.ReactNode }) {
  const [filters, setFilterState] = useState<CommercialFilters>({ period: "MONTH", referenceDate: todayIso(), page: 1 });
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  const setFilters = useCallback((patch: Partial<CommercialFilters>) => {
    setFilterState((current) => ({ ...current, ...patch, page: patch.page ?? 1 }));
  }, []);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const query = buildQuery({
      period: filters.period,
      referenceDate: filters.referenceDate,
      empresaId: filters.empresaId,
      localidadId: filters.localidadId,
      origin: filters.origin,
      page: filters.page,
      pageSize: 25,
    });
    commercialApi<AnalyticsSummary>(`/bff/comercial/analitica?${query}`, { signal: controller.signal })
      .then(setAnalytics)
      .catch((cause) => {
        if ((cause as Error).name !== "AbortError") setError(cause instanceof Error ? cause.message : "No se pudo cargar la información comercial");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [filters, revision]);

  const value = useMemo(() => ({ analytics, filters, loading, error, setFilters, refresh }), [analytics, filters, loading, error, setFilters, refresh]);
  return <CommercialDataContext.Provider value={value}>{children}</CommercialDataContext.Provider>;
}

export function useCommercialData() {
  const context = useContext(CommercialDataContext);
  if (!context) throw new Error("useCommercialData debe usarse dentro de CommercialDataProvider");
  return context;
}
