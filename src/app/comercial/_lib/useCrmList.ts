"use client";

import { useCallback, useEffect, useState } from "react";
import type { PageResponse } from "../crmTypes";
import { commercialApi } from "./api";

function withPage(path: string, page: number) {
  const [base, search = ""] = path.split("?");
  const params = new URLSearchParams(search);
  params.set("page", String(page));
  if (!params.has("pageSize")) params.set("pageSize", "100");
  return `${base}?${params.toString()}`;
}

async function loadAll<T>(path: string, signal: AbortSignal) {
  const first = await commercialApi<PageResponse<T>>(path, { signal });
  const data = [...(first.data || [])];
  const totalPages = Math.min(first.meta?.totalPages || 1, 50);
  for (let page = 2; page <= totalPages; page += 1) {
    const payload = await commercialApi<PageResponse<T>>(withPage(path, page), { signal });
    data.push(...(payload.data || []));
  }
  return data;
}

export function useCrmList<T>(path: string) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    loadAll<T>(path, controller.signal)
      .then((payload) => setItems(payload))
      .catch((cause) => {
        if ((cause as Error).name !== "AbortError") setError(cause instanceof Error ? cause.message : "No se pudo cargar el módulo comercial");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [path, revision]);
  return { items, loading, error, reload };
}
