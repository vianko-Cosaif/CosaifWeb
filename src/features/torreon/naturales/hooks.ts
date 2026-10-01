import { useCallback, useEffect, useMemo, useState } from "react";
import type { EmpresaOption, FechaCampo, MovimientoNatural, SortDir, SortKey, StatusTab } from "./types";
import { filterNaturalRows, getNaturalMetrics, toLocalDateTimeInput } from "./utils";
import { cachedFetchJson } from "@/lib/http/client";
import { readTorreonJson, useTorreonCollection } from "../useTorreonCollection";

function normalizeBase(base?: string): string {
  return (base || process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL || "/bff").replace(/\/+$/, "");
}

function normalizeEmpresas(input: unknown): EmpresaOption[] {
  const data = Array.isArray(input)
    ? input
    : input && typeof input === "object" && Array.isArray((input as { data?: unknown }).data)
      ? (input as { data: unknown[] }).data
      : [];

  return data
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as { id?: unknown; nombre?: unknown };
      const id = Number(record.id);
      const nombre = typeof record.nombre === "string" ? record.nombre.trim() : "";
      return Number.isFinite(id) && id > 0 && nombre ? { id, nombre } : null;
    })
    .filter((item): item is EmpresaOption => Boolean(item));
}

export function useTorreonNaturales(localidadId: number, apiBase?: string) {
  const [status, setStatus] = useState<StatusTab>("activos");
  const [search, setSearch] = useState("");
  const [empresaId, setEmpresaId] = useState<number | null>(null);
  const [empresas, setEmpresas] = useState<EmpresaOption[]>([]);
  const [fechaCampo, setFechaCampo] = useState<FechaCampo>("inicio");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortKey, setSortKey] = useState<SortKey>("cronologia");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const catalogBase = normalizeBase(apiBase);

  useEffect(() => {
    const controller = new AbortController();
    cachedFetchJson<unknown>(`${catalogBase}/empresas/lite`, {
      cache: "no-store",
      credentials: "include",
      signal: controller.signal,
    }, { ttlMs: 5 * 60_000 })
      .then((payload) => {
        if (!controller.signal.aborted) setEmpresas(normalizeEmpresas(payload));
      })
      .catch(() => {
        if (!controller.signal.aborted) setEmpresas([]);
      });

    return () => {
      controller.abort();
    };
  }, [catalogBase]);

  const fetchRows = useCallback(async (signal: AbortSignal, force: boolean) => {
    const params = new URLSearchParams({ localidadId: String(localidadId), status, page: "1", pageSize: "100", includeFotos: "0" });
    if (empresaId) params.set("empresaId", String(empresaId));
    const payload = await readTorreonJson<{ data?: MovimientoNatural[] }>(
      `/api/coordinador/torreon/movimientos?${params}`, signal, force,
    );
    return Array.isArray(payload?.data) ? payload.data : [];
  }, [empresaId, localidadId, status]);

  const { rows, loading: initialLoading, refreshing, error, load, refreshItem } = useTorreonCollection({
    queryKey: `${localidadId}:${empresaId}:${status}`, fetchRows,
  });
  const loading = initialLoading || refreshing;

  const refreshById = useCallback(async (id: number) => {
    if (!Number.isFinite(id) || id <= 0) return load(true);
    return refreshItem(id, async (signal) => {
      const params = new URLSearchParams({ localidadId: String(localidadId), id: String(id) });
      const payload = await readTorreonJson<{ data?: MovimientoNatural }>(
        `/api/coordinador/torreon/movimientos?${params}`, signal, true,
      );
      return payload?.data?.id ? payload.data : null;
    }, (current, next) => {
      const closed = ["CONCLUIDO", "CANCELADO"].includes(String(next.estado ?? "").toUpperCase());
      const belongsToTab = status === "todos" || (status === "concluidos" ? closed : !closed);
      const belongsToCompany = !empresaId || Number(next.empresaId) === empresaId;
      const withoutCurrent = current.filter((row) => Number(row.id) !== Number(next.id));
      return belongsToTab && belongsToCompany ? [next, ...withoutCurrent] : withoutCurrent;
    });
  }, [empresaId, load, localidadId, refreshItem, status]);

  useEffect(() => {
    setPage(1);
  }, [status, search, empresaId, fechaCampo, desde, hasta, pageSize, sortKey, sortDir]);

  const filteredRows = useMemo(() => (
    filterNaturalRows(rows, { search, empresaId, fechaCampo, desde, hasta, sortKey, sortDir })
  ), [desde, empresaId, fechaCampo, hasta, rows, search, sortDir, sortKey]);

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
    empresaId,
    setEmpresaId,
    empresas,
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
    refreshById,
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
