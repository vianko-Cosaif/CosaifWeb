"use client";

import { useCallback, useEffect, useState } from "react";
import type { PageResponse } from "../crmTypes";
import { commercialApi } from "./api";

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
    commercialApi<PageResponse<T>>(path, { signal: controller.signal })
      .then((payload) => setItems(payload.data || []))
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
