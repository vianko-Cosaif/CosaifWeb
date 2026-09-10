import type { OutboxItem } from './types';

const STORE = 'requests';
const LEASE_MS = 60_000;

/** Read/write transactions serialize claims across every tab of this origin. */
export class OutboxStore {
  private connection?: Promise<IDBDatabase>;
  constructor(private readonly name = 'cosaif-movement-outbox-v2') {}

  private open() {
    this.connection ??= new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof indexedDB === 'undefined') return reject(new Error('Este navegador no permite guardar solicitudes sin conexión.'));
      const request = indexedDB.open(this.name, 1);
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('owner', 'owner');
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => { db.close(); this.connection = undefined; };
        resolve(db);
      };
      request.onerror = () => { this.connection = undefined; reject(request.error); };
      request.onblocked = () => { this.connection = undefined; reject(new Error('Cierra otras pestañas antiguas para actualizar el almacenamiento.')); };
    });
    return this.connection;
  }

  private async transaction<T>(mode: IDBTransactionMode, execute: (store: IDBObjectStore, result: (value: T) => void) => void): Promise<T> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      let value: T;
      tx.oncomplete = () => resolve(value);
      tx.onerror = () => reject(tx.error || new Error('No se pudo guardar la solicitud en el dispositivo.'));
      tx.onabort = () => reject(tx.error || new Error('Se interrumpió el almacenamiento de la solicitud.'));
      try { execute(tx.objectStore(STORE), (next) => { value = next; }); }
      catch (error) { tx.abort(); reject(error); }
    });
  }

  list(owner: string): Promise<OutboxItem[]> {
    return this.transaction('readonly', (store, result) => {
      const req = store.index('owner').getAll(owner);
      req.onsuccess = () => result((req.result as OutboxItem[]).sort((a, b) => a.createdAt - b.createdAt));
    });
  }

  put(item: OutboxItem): Promise<void> {
    return this.transaction('readwrite', (store, result) => {
      const req = store.get(item.id);
      req.onsuccess = () => {
        // A repeated click must not replace an existing claim or failed request.
        if (!req.result) store.add(item);
        result(undefined);
      };
    });
  }

  private update(id: string, owner: string, change: (item: OutboxItem) => OutboxItem | null): Promise<OutboxItem | null> {
    return this.transaction('readwrite', (store, result) => {
      const req = store.get(id);
      req.onsuccess = () => {
        const item = req.result as OutboxItem | undefined;
        if (!item || item.owner !== owner) return result(null);
        const next = change(item);
        if (next) store.put(next);
        result(next);
      };
    });
  }

  claim(id: string, owner: string, now = Date.now()) {
    return this.update(id, owner, (item) => {
      // An expired claim may already have committed upstream. Never resend it automatically.
      if (item.status === 'sending' && (item.leaseUntil || 0) < now) {
        return { ...item, status: 'uncertain', error: 'El envío se interrumpió. Verifica el historial antes de reintentar.' };
      }
      if (!['queued', 'retry'].includes(item.status) || item.nextAttemptAt > now) return null;
      return { ...item, status: 'sending', attempts: item.attempts + 1, leaseUntil: now + LEASE_MS };
    }).then(item => item?.status === 'sending' ? item : null);
  }

  settle(item: OutboxItem, patch: Pick<OutboxItem, 'status'> & Partial<OutboxItem>) {
    return this.update(item.id, item.owner, current => current.status === 'sending' && current.attempts === item.attempts ? { ...current, ...patch, leaseUntil: undefined } : null);
  }

  retry(id: string, owner: string) {
    return this.update(id, owner, item => item.status === 'sending' && (item.leaseUntil || 0) > Date.now() ? null : { ...item, status: 'queued', error: undefined, nextAttemptAt: 0, leaseUntil: undefined });
  }

  remove(id: string, owner: string, confirmedAttempt?: number): Promise<void> {
    return this.transaction('readwrite', (store, result) => {
      const req = store.get(id);
      req.onsuccess = () => {
        const item = req.result as OutboxItem | undefined;
        if (item?.owner === owner && (confirmedAttempt === item.attempts || (confirmedAttempt === undefined && (item.status !== 'sending' || (item.leaseUntil || 0) < Date.now())))) store.delete(id);
        result(undefined);
      };
    });
  }
}
export const movementOutbox = new OutboxStore();
