export type OutboxStatus = 'queued' | 'sending' | 'retry' | 'blocked' | 'uncertain';
export type OutboxItem = {
  id: string;
  owner: string;
  endpoint: string;
  payload: unknown;
  createdAt: number;
  status: OutboxStatus;
  attempts: number;
  nextAttemptAt: number;
  leaseUntil?: number;
  error?: string;
};
export type EnqueueOptions = { requestId?: string; uncertain?: boolean };
export const OUTBOX_CHANGED = 'cosaif:outbox-changed';
