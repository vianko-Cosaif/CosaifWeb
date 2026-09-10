'use client';
import { useState } from 'react';
import { CloudOff, RefreshCw, Trash2 } from 'lucide-react';
import { Button, Modal } from '@/components/ui';
import type { OutboxItem } from './types';
const labels = { queued: 'Pendiente', sending: 'Enviando', retry: 'Reintento programado', blocked: 'Requiere corrección', uncertain: 'Verificar resultado' };
export function OutboxPanel({ items, syncing, onRetry, onDiscard, onSync }: { items: OutboxItem[]; syncing: boolean; onRetry: (id: string) => Promise<void>; onDiscard: (id: string) => Promise<void>; onSync: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<{ item: OutboxItem; kind: 'retry' | 'discard' } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!items.length && !open) return null;
  return <>
    <Button size="sm" variant="secondary" onClick={() => setOpen(true)} leftIcon={<CloudOff className="h-4 w-4"/>}>{items.length} solicitudes en dispositivo</Button>
    {open && <Modal title="Solicitudes pendientes" onClose={() => !busy && setOpen(false)}>
      <p className="mb-4 text-sm text-[var(--app-text-muted)]">Sólo se muestran las solicitudes de tu cuenta en este dispositivo. Una solicitud guardada todavía puede necesitar confirmación del servidor.</p>
      <Button size="sm" disabled={syncing || busy} onClick={() => void onSync()} leftIcon={<RefreshCw className="h-4 w-4"/>}>{syncing ? 'Sincronizando…' : 'Enviar pendientes'}</Button>
      {error && <p role="alert" className="mt-3 text-sm text-rose-600">{error}</p>}
      <ul className="mt-4 space-y-3">{items.map(item => {
        const active = item.status === 'sending' && (item.leaseUntil || 0) > Date.now();
        const status = item.status === 'sending' && !active ? 'uncertain' : item.status;
        const payload = item.payload as { locomotiveNumber?: unknown };
        return <li key={item.id} className="rounded-lg border border-[var(--app-border)] p-3">
          <div className="flex flex-wrap justify-between gap-2 text-sm font-semibold"><span>Locomotora {String(payload?.locomotiveNumber || '—')}</span><span>{labels[status]}</span></div>
          <p className="mt-1 text-xs text-[var(--app-text-muted)]">{new Date(item.createdAt).toLocaleString('es-MX')}</p>
          {item.error && <p className="mt-2 text-sm">{item.error}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {['blocked','uncertain'].includes(status) && <Button size="sm" variant="secondary" disabled={busy} onClick={() => setAction({ item, kind: 'retry' })}>Revisar y reintentar</Button>}
            <Button size="sm" variant="secondary" disabled={busy || active} onClick={() => setAction({ item, kind: 'discard' })} leftIcon={<Trash2 className="h-4 w-4"/>}>Descartar</Button>
          </div>
        </li>;
      })}</ul>
      {!items.length && <p className="py-6 text-center text-sm">No quedan solicitudes pendientes.</p>}
      {action && <section className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-slate-900" role="region" aria-label="Confirmar acción">
        <p className="text-sm">{action.kind === 'retry' ? 'Comprueba primero que el movimiento no aparece en Seguimiento. Reenviar un resultado no confirmado podría duplicarlo si el servidor no reconoce el envío anterior.' : 'Se eliminará esta solicitud del dispositivo. Esto no cancela ningún movimiento que el servidor ya haya recibido.'}</p>
        <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" disabled={busy} onClick={async () => {
          setBusy(true); setError('');
          try { await (action.kind === 'retry' ? onRetry : onDiscard)(action.item.id); setAction(null); }
          catch { setError('No se pudo completar la acción. El pendiente se conserva.'); }
          finally { setBusy(false); }
        }}>{busy ? 'Procesando…' : action.kind === 'retry' ? 'Verifiqué que no existe: reenviar' : 'Confirmar descarte'}</Button><Button size="sm" variant="secondary" disabled={busy} onClick={() => setAction(null)}>Volver</Button></div>
      </section>}
    </Modal>}
  </>;
}
