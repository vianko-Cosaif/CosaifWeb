"use client";

import { useCallback, useEffect, useState } from 'react';
import type { PageResponse } from '../types';
import { invalidateCachedJson } from '@/lib/http/client';
import { loadCrmCatalog, loadCrmPage } from './pagination';

export function useCrmList<T>(path: string) {
  const [selection, setSelection] = useState({ path, page: 1 });
  const page = selection.path === path ? selection.page : 1;
  const setPage = useCallback((value: number) => setSelection({ path, page: Math.max(1, value) }), [path]);
  const queryKey = `${path}|${page}`;
  const [snapshot, setSnapshot] = useState<{ key: string; result: PageResponse<T> } | null>(null);
  const result = snapshot?.key === queryKey ? snapshot.result : null;
  const { loading, error, reload } = useCrmRequest(path, page, (signal) => loadCrmPage<T>(path, page, signal), result => setSnapshot({ key: queryKey, result }));
  return { items: result?.data ?? [], meta: result?.meta, page, setPage, loading, error, reload };
}

export function useCrmCatalog<T>(path: string) {
  const [snapshot, setSnapshot] = useState<{ path: string; items: T[] } | null>(null);
  const items = snapshot?.path === path ? snapshot.items : [];
  const { loading, error, reload } = useCrmRequest(path, 0, (signal) => loadCrmCatalog<T>(path, signal), items => setSnapshot({ path, items }));
  return { items, loading, error, reload };
}

function useCrmRequest<T>(path: string, page: number, load: (signal: AbortSignal) => Promise<T>, apply: (value: T) => void) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => {
    invalidateCachedJson(path.split('?')[0]);
    setRevision((value) => value + 1);
  }, [path]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    load(controller.signal).then((value) => { if (!controller.signal.aborted) apply(value); }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'No se pudo cargar la información comercial.');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
    // load and apply are closures of the declared query identity, not independent triggers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, page, revision]);
  return { loading, error, reload };
}
