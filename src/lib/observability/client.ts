import { currentStorageScope } from '@/lib/auth/storageScope';
import { routeFamily, type TelemetryEvent } from './events';

let queue: TelemetryEvent[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;
export function reportClientEvent(event: Omit<TelemetryEvent, 'route' | 'at'>) {
  if (typeof window === 'undefined' || !currentStorageScope()) return;
  queue.push({ ...event, route: routeFamily(window.location.pathname), at: Date.now() });
  if (queue.length >= 10) flushTelemetry();
  else if (!timer) timer = setTimeout(flushTelemetry, 5000);
}
export function flushTelemetry() {
  clearTimeout(timer); timer = undefined;
  if (!queue.length) return;
  const batch = queue.splice(0, 10);
  if (!currentStorageScope()) { queue = []; return; }
  void fetch('/api/telemetry', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(batch), keepalive: true, credentials: 'same-origin' }).catch(() => undefined);
}
