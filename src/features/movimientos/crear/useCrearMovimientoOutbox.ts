import { useCallback, useEffect, useRef, useState } from 'react';
import { Movimiento } from '../Movimiento';
import { API_BASE, FLUSH_INTERVAL_MS, OUTBOX_KEY, DRAFT_KEY } from '../movimientos.shared';
import { useVisibleInterval } from '@/hooks/useVisibleInterval';
import { containsTrainingReservedId } from '@/lib/routePolicy';
import { currentStorageScope } from '@/lib/auth/storageScope';
import { movementOutbox } from '../offline/outboxStore';
import { synchronizeOutbox } from '../offline/synchronize';
import { OUTBOX_CHANGED, type EnqueueOptions, type OutboxItem } from '../offline/types';
import { invalidateCachedJson } from '@/lib/http/client';

function announceChange() {
  window.dispatchEvent(new Event(OUTBOX_CHANGED));
  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel(OUTBOX_CHANGED);
    channel.postMessage('changed');
    channel.close();
  }
}

export function useCrearMovimientoOutbox({ disabled = false }: { disabled?: boolean } = {}) {
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [pendingItems, setPendingItems] = useState<OutboxItem[]>([]);
  const [banner, setBanner] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const disabledRef = useRef(disabled);
  const running = useRef(false);
  const abort = useRef<AbortController | null>(null);
  disabledRef.current = disabled;

  const hydratePendingCount = useCallback(async () => {
    const owner = currentStorageScope();
    if (disabledRef.current || !owner) { setPendingItems([]); return; }
    try {
      const items = await movementOutbox.list(owner);
      if (owner === currentStorageScope() && !disabledRef.current) setPendingItems(items);
    } catch { setBanner('No se pudo abrir la bandeja del dispositivo. Tus datos del formulario siguen disponibles.'); }
  }, []);

  const flushOutbox = useCallback(async () => {
    const owner = currentStorageScope();
    if (!owner || disabledRef.current || !navigator.onLine || running.current) return;
    running.current = true;
    setSyncing(true);
    abort.current = new AbortController();
    try {
      await synchronizeOutbox(movementOutbox, owner, item => Movimiento.fetchWithTimeout(item.endpoint, {
        method: 'POST', credentials: 'same-origin', signal: abort.current?.signal,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'Idempotency-Key': item.id, 'X-Cosaif-Outbox-Owner': owner },
        body: JSON.stringify(item.payload),
      }), () => !disabledRef.current && owner === currentStorageScope() && !abort.current?.signal.aborted);
      invalidateCachedJson('/movimientos');
      announceChange();
    } catch { setBanner('No se pudo sincronizar. Los pendientes se conservan en este dispositivo.'); }
    finally { running.current = false; setSyncing(false); await hydratePendingCount(); }
  }, [hydratePendingCount]);

  useEffect(() => {
    const on = () => { setOnline(true); void flushOutbox(); };
    const off = () => setOnline(false);
    const changed = () => { void hydratePendingCount(); };
    const identityChanged = (event?: Event) => {
      if (event instanceof StorageEvent && event.key !== 'user' && event.key !== null) return; abort.current?.abort(); setPendingItems([]); changed(); };
    window.addEventListener('online', on); window.addEventListener('offline', off);
    window.addEventListener(OUTBOX_CHANGED, changed); window.addEventListener('storage', identityChanged);
    window.addEventListener('cosaif:auth-expired', identityChanged);
    window.addEventListener('cosaif:session-ended', identityChanged);
    const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(OUTBOX_CHANGED) : null;
    if (channel) channel.onmessage = changed;
    changed();
    try {
      if (!disabledRef.current && (localStorage.getItem(OUTBOX_KEY) || localStorage.getItem(DRAFT_KEY))) setBanner('Hay datos de una versión anterior en este dispositivo. Se conservan para revisión; confirma su cuenta y estado con el administrador antes de recapturarlos.');
    } catch { /* Storage may be unavailable. */ }
    return () => {
      abort.current?.abort(); channel?.close();
      window.removeEventListener('online', on); window.removeEventListener('offline', off);
      window.removeEventListener(OUTBOX_CHANGED, changed); window.removeEventListener('storage', identityChanged);
      window.removeEventListener('cosaif:auth-expired', identityChanged);
      window.removeEventListener('cosaif:session-ended', identityChanged);
    };
  }, [flushOutbox, hydratePendingCount]);

  useEffect(() => { if (disabled) { abort.current?.abort(); setPendingItems([]); } }, [disabled]);

  const pushOutbox = useCallback(async (payload: unknown, endpoint = `${API_BASE}/movimientos`, options: EnqueueOptions = {}) => {
    const owner = currentStorageScope();
    if (disabledRef.current) return;
    if (!owner) throw new Error('Inicia sesión para guardar una solicitud pendiente.');
    if (!/^\/(?:bff|xapi|api\/passthrough)\/(?:movimientos|torreon\/movimientos)$/.test(endpoint) || containsTrainingReservedId(payload)) throw new Error('La solicitud no puede guardarse en la bandeja.');
    await movementOutbox.put({ id: options.requestId || crypto.randomUUID(), owner, payload, endpoint, createdAt: Date.now(), status: options.uncertain ? 'uncertain' : 'queued', attempts: 0, nextAttemptAt: 0, error: options.uncertain ? 'Verifica el historial: el servidor pudo haber recibido esta solicitud.' : undefined });
    setBanner(options.uncertain ? 'Resultado por verificar. La solicitud quedó guardada en la bandeja.' : 'Guardado en este dispositivo. Se enviará cuando haya conexión.');
    announceChange();
    await hydratePendingCount();
  }, [hydratePendingCount]);

  const discardPending = useCallback(async (id: string) => {
    const owner = currentStorageScope(); if (!owner || disabledRef.current) return;
    await movementOutbox.remove(id, owner); announceChange(); await hydratePendingCount();
  }, [hydratePendingCount]);
  const retryPending = useCallback(async (id: string) => {
    const owner = currentStorageScope(); if (!owner || disabledRef.current) return;
    await movementOutbox.retry(id, owner); announceChange(); await flushOutbox();
  }, [flushOutbox]);
  const clearOutbox = useCallback(async () => {
    const owner = currentStorageScope(); if (!owner || disabledRef.current) return;
    if (!window.confirm('¿Descartar los pendientes de esta cuenta en este dispositivo? Los envíos en curso se conservarán.')) return;
    for (const item of await movementOutbox.list(owner)) await movementOutbox.remove(item.id, owner);
    announceChange(); await hydratePendingCount();
  }, [hydratePendingCount]);

  useVisibleInterval(flushOutbox, !disabled && online ? FLUSH_INTERVAL_MS : null);
  return { online, pendingCount: pendingItems.length, pendingItems, syncing, banner, flushOutbox, pushOutbox, clearOutbox, hydratePendingCount, discardPending, retryPending };
}
