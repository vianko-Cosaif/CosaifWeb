import { useCallback, useEffect, useMemo, useState } from "react";
import type { FechaCampo, MovimientoNatural, SortDir, SortKey, StatusTab } from "./types";
import { filterNaturalRows, getNaturalMetrics, toLocalDateTimeInput } from "./utils";

export function useTorreonNaturales(localidadId: number) {
  const [status, setStatus] = useState<StatusTab>("activos");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<MovimientoNatural[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fechaCampo, setFechaCampo] = useState<FechaCampo>("inicio");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortKey, setSortKey] = useState<SortKey>("cronologia");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        localidadId: String(localidadId),
        status,
      });
      const response = await fetch(`/api/coordinador/torreon/movimientos?${params.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.error || "No se pudieron cargar movimientos");
      }
      setRows(Array.isArray(payload?.data) ? payload.data : []);
    } catch (err) {
      setRows([]);
      setError(err instanceof Error ? err.message : "Error al cargar movimientos");
    } finally {
      setLoading(false);
    }
  }, [localidadId, status]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [status, search, fechaCampo, desde, hasta, pageSize, sortKey, sortDir]);

  const filteredRows = useMemo(() => (
    filterNaturalRows(rows, { search, fechaCampo, desde, hasta, sortKey, sortDir })
  ), [desde, fechaCampo, hasta, rows, search, sortDir, sortKey]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedRows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, pageSize, safePage]);

  const metrics = useMemo(() => getNaturalMetrics(filteredRows), [filteredRows]);
  const chronologyRows = useMemo(() => filteredRows.slice(0, Math.min(filteredRows.length, 6)), [filteredRows]);

  const applyToday = useCallback((field: FechaCampo) => {
    const now = new Date();
    setFechaCampo(field);
    setDesde(toLocalDateTimeInput(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0)));
    setHasta(toLocalDateTimeInput(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59)));
  }, []);

  const clearDates = useCallback(() => {
    setDesde("");
    setHasta("");
  }, []);

  return {
    status,
    setStatus,
    search,
    setSearch,
    loading,
    error,
    fechaCampo,
    setFechaCampo,
    desde,
    setDesde,
    hasta,
    setHasta,
    pageSize,
    setPageSize,
    sortKey,
    setSortKey,
    sortDir,
    setSortDir,
    page,
    setPage,
    load,
    filteredRows,
    paginatedRows,
    totalPages,
    safePage,
    metrics,
    chronologyRows,
    applyToday,
    clearDates,
  };
}
