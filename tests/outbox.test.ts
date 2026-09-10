import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { OutboxStore } from '@/features/movimientos/offline/outboxStore';
import { synchronizeOutbox } from '@/features/movimientos/offline/synchronize';
import type { OutboxItem } from '@/features/movimientos/offline/types';
const item = (id: string, owner = 'alice'): OutboxItem => ({ id, owner, payload: {}, endpoint: '/bff/movimientos', status: 'queued', attempts: 0, createdAt: Date.now(), nextAttemptAt: 0 });
const store = () => new OutboxStore(crypto.randomUUID());
describe('movement outbox', () => {
  it('preserves a request added while another is sending', async () => {
    const db = store(); await db.put(item('a'));
    await synchronizeOutbox(db, 'alice', async () => { await db.put(item('b')); return new Response(null, { status: 201 }); }, () => true);
    expect((await db.list('alice')).map(i => i.id)).toEqual(['b']);
  });
  it('claims a request once across independent tab connections', async () => {
    const name = crypto.randomUUID(); const a = new OutboxStore(name), b = new OutboxStore(name);
    await a.put(item('a')); let calls = 0;
    const send = async () => { calls++; await new Promise(resolve => setTimeout(resolve, 10)); return new Response(null, { status: 201 }); };
    await Promise.all([synchronizeOutbox(a, 'alice', send, () => true), synchronizeOutbox(b, 'alice', send, () => true)]);
    expect(calls).toBe(1);
  });
  it('does not expose or delete another owner requests', async () => {
    const db = store(); await db.put(item('a')); expect(await db.list('bob')).toEqual([]);
    expect(await db.claim('a','bob')).toBeNull(); await db.remove('a','bob'); expect(await db.list('alice')).toHaveLength(1);
  });
  it('keeps an ambiguous network result for review instead of automatically repeating it', async () => {
    const db = store(); await db.put(item('a')); let calls = 0;
    const send = async () => { calls++; throw new TypeError('network'); };
    await synchronizeOutbox(db,'alice',send,() => true); await synchronizeOutbox(db,'alice',send,() => true);
    expect(calls).toBe(1); expect((await db.list('alice'))[0].status).toBe('uncertain');
  });
  it('does not send after the active owner changes', async () => {
    const db = store(); await db.put(item('a')); let calls = 0;
    await synchronizeOutbox(db,'alice',async () => { calls++; return new Response(); },() => false);
    expect(calls).toBe(0); expect(await db.list('alice')).toHaveLength(1);
  });
  it('does not steal an expired claim whose upstream result is unknown', async () => {
    const db = store(); await db.put(item('a')); await db.claim('a','alice',0);
    expect(await db.claim('a','alice',90_000)).toBeNull(); expect((await db.list('alice'))[0].status).toBe('uncertain');
  });
});
