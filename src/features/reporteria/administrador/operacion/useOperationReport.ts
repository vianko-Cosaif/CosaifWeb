"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Detail, Filters, OperationReport } from './types';
export const ENDPOINT = '/bff/reporteria/admin/operacion';
export function localDay(date = new Date()) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date); }
export function shiftDay(day: string, n: number) { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
export function initialFilters(): Filters { const to = localDay(); return { from: shiftDay(to, -29), to, companyId: '', clientId: '', localityId: '', type: 'ALL', target: '60' }; }
export async function readResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(response.status === 401 ? 'Tu sesión terminó. Vuelve a iniciar sesión.' : response.status === 403 ? 'Tu perfil no tiene permiso para consultar este reporte.' : body?.message || body?.error || 'No fue posible consultar el reporte. Intenta nuevamente.');
  if (!body) throw new Error('El servicio devolvió una respuesta vacía.');
  return body as T;
}
async function fetchReport(url: string, signal: AbortSignal): Promise<Response> {
  // A replaced request can still be finishing on the API. Retry only its explicit busy response.
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(url, { signal, cache: 'no-store' });
    if (response.status !== 429 || attempt >= 4) return response;
    const seconds = Number(response.headers.get('Retry-After') || 2);
    const delay = Number.isFinite(seconds) ? Math.max(100, Math.min(5000, seconds * 1000)) : 2000;
    await new Promise<void>((resolve, reject) => {
      const abort = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); reject(new DOMException('Aborted', 'AbortError')); };
      const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, delay);
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) abort();
    });
  }
}
export function useOperationReport() {
  const [draft, setDraft] = useState<Filters>(initialFilters);
  const [applied, setApplied] = useState<Filters>(draft);
  const [version, setVersion] = useState(0);
  const [report, setReport] = useState<OperationReport | null>(null);
  const [catalogs, setCatalogs] = useState<OperationReport['catalogs']>({ companies: [], localities: [], clients: [] });
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [download, setDownload] = useState(''), [downloadError, setDownloadError] = useState('');
  const [expired, setExpired] = useState(false);
  const activeDownload = useRef<AbortController | null>(null);
  const activeId = useRef<string | null>(null);
  useEffect(() => {
    const controller = new AbortController(); let alive = true;
    setLoading(true); setReport(null); activeId.current = null; setError(''); setExpired(false); setDownloadError('');
    activeDownload.current?.abort(); activeDownload.current = null; setDownload('');
    const query = new URLSearchParams(Object.entries(applied).filter(([, v]) => v !== ''));
    fetchReport(`${ENDPOINT}?${query}`, controller.signal).then(readResponse<OperationReport>).then(data => {
      if (!alive) return;
      if (!data.meta?.id || !data.summary || !Number.isFinite(data.summary.clientDelayMinutes) || !Number.isFinite(data.summary.incidentTimeMissing) || !Array.isArray(data.retries) || !Array.isArray(data.destinations) || data.destinations.length !== 2) throw new Error('El reporte recibido está incompleto.');
      activeId.current = data.meta.id; setReport(data); setCatalogs(data.catalogs);
    }).catch(e => { if (alive && !controller.signal.aborted) setError(e instanceof Error ? e.message : 'Error de conexión.'); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; controller.abort(); activeDownload.current?.abort(); };
  }, [applied, version]);
  useEffect(() => {
    if (!report) return;
    const timer = setTimeout(() => setExpired(true), Math.max(0, Date.parse(report.meta.expiresAt) - Date.now()));
    return () => clearTimeout(timer);
  }, [report]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(applied);
  const apply = useCallback(() => { setApplied({ ...draft }); setVersion(v => v + 1); }, [draft]);
  const exportReport = async (format: 'excel' | 'pdf') => {
    if (!report || loading || dirty || expired || download || activeDownload.current) return;
    const id = report.meta.id, controller = new AbortController(); activeDownload.current = controller;
    setDownload(format); setDownloadError('');
    try {
      const response = await fetch(`${ENDPOINT}/${id}/${format}`, { cache: 'no-store', signal: controller.signal });
      if (!response.ok) { await readResponse(response); return; }
      const expected = format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      if (!response.headers.get('content-type')?.includes(expected)) throw new Error('La descarga no contiene el formato esperado. Actualiza el reporte.');
      const blob = await response.blob();
      if (controller.signal.aborted || activeId.current !== id) return;
      const url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = `Cosaif_Administracion_${report.meta.from}_${report.meta.to}_${id.slice(0, 8)}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (e) { if (!controller.signal.aborted && activeId.current === id) setDownloadError(e instanceof Error ? e.message : 'No fue posible descargar el archivo.'); }
    finally { if (activeDownload.current === controller) { setDownload(''); activeDownload.current = null; } }
  };
  return { draft, setDraft, applied, report, catalogs, loading, error, dirty, apply, download, downloadError, exportReport, expired };
}
export function useReportDetail(id: string, query: string) {
  const [detail, setDetail] = useState<Detail | null>(null), [error, setError] = useState(''), [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController(); let alive = true;
    setDetail(null); setError(''); setLoading(true);
    fetch(`${ENDPOINT}/${id}/detalle?${query}`, { signal: controller.signal, cache: 'no-store' }).then(readResponse<Detail>).then(data => { if (alive) setDetail(data); }).catch(e => { if (alive && !controller.signal.aborted) setError(e instanceof Error ? e.message : 'Error al consultar el detalle.'); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; controller.abort(); };
  }, [id, query]);
  return { detail, loading, error };
}
