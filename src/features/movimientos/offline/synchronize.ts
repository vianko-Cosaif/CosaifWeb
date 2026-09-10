import { OutboxStore } from './outboxStore';
import type { OutboxItem } from './types';

export async function synchronizeOutbox(store: OutboxStore, owner: string, send: (item: OutboxItem) => Promise<Response>, isCurrentOwner: () => boolean) {
  const pending = await store.list(owner);
  for (const candidate of pending) {
    if (!isCurrentOwner()) break;
    const item = await store.claim(candidate.id, owner);
    if (!item) continue;
    if (!isCurrentOwner()) {
      await store.settle(item, { status: 'queued' });
      break;
    }
    try {
      const response = await send(item);
      if (response.ok) {
        await store.remove(item.id, owner, item.attempts);
      } else if (response.status === 429 || response.status === 425) {
        const wait = Math.min(3600, Math.max(5, Number(response.headers.get('retry-after')) || 30));
        await store.settle(item, { status: 'retry', nextAttemptAt: Date.now() + wait * 1000, error: 'El servicio está ocupado. Se reintentará automáticamente.' });
      } else {
        const uncertain = response.status >= 500 || response.status === 408;
        let message = uncertain ? 'No se pudo confirmar el resultado. Verifica el historial antes de reintentar.' : 'Revisa los datos y permisos antes de volver a enviar.';
        if (response.status === 401) message = 'Inicia sesión de nuevo con la cuenta que creó esta solicitud.';
        if (response.status === 403) message = 'Esta cuenta no tiene permiso para enviar la solicitud.';
        if ([400, 409, 422].includes(response.status)) {
          const payload = await response.json().catch(() => null) as { error?: unknown; message?: unknown } | null;
          const detail = payload?.message ?? payload?.error;
          if (typeof detail === 'string') message = detail.replace(/[\u0000-\u001F]/g, ' ').slice(0,200);
        }
        await store.settle(item, { status: uncertain ? 'uncertain' : 'blocked', error: message });
        if (response.status === 401 || response.status === 403) break;
      }
    } catch {
      await store.settle(item, { status: 'uncertain', error: 'La conexión se interrumpió después del envío. Verifica si el movimiento ya aparece en el historial.' });
    }
  }
}
