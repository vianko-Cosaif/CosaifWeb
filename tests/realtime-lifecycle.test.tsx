// @vitest-environment jsdom
import React, { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRealtimeMovimientos } from '@/features/movimientos/useRealtimeMovimientos';
import { handleAuthError } from '@/lib/auth/auth';

vi.mock('@/lib/auth/auth', () => ({ handleAuthError: vi.fn() }));
const sockets: Socket[] = [];
class Socket {
  static OPEN = 1;
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  send = vi.fn();
  constructor() { sockets.push(this); }
  close() { this.readyState = 3; this.onclose?.(); }
  open() { this.readyState = 1; this.onopen?.(); }
}
function Probe({ wsConfigUrl }: { wsConfigUrl?: string }) { useRealtimeMovimientos({ wsConfigUrl, onEvent: () => undefined }); return null; }
function StatusProbe() {
  const status = useRealtimeMovimientos({ onEvent: () => undefined });
  return <output data-testid="channel-status">{status}</output>;
}
const configResponse = () => new Response(JSON.stringify({ transport: 'websocket', url: 'ws://localhost/realtime-test' }), { status: 200 });
function pendingBodyResponse(signal: AbortSignal, contentType: string) {
  return new Response(new ReadableStream({
    start(controller) {
      signal.addEventListener('abort', () => controller.error(new DOMException('Aborted', 'AbortError')), { once: true });
    },
  }), { headers: { 'content-type': contentType } });
}
beforeEach(() => {
  sockets.length = 0;
  vi.stubGlobal('WebSocket', Socket);
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(async () => {
  cleanup(); await act(async () => { await Promise.resolve(); });
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe('shared realtime lifecycle', () => {
  it('keeps a single handshake through Strict Mode setup/cleanup and multiple subscribers', async () => {
    const fetcher = vi.fn().mockResolvedValue(configResponse()); vi.stubGlobal('fetch', fetcher);
    await act(async () => { render(<StrictMode><Probe /><Probe /></StrictMode>); });
    expect(fetcher).toHaveBeenCalledTimes(1); expect(sockets).toHaveLength(1);
    await act(async () => sockets[0].open());
  });
  it('hydrates server markup even when another component already connected the shared channel', async () => {
    const html = renderToString(<StatusProbe />);
    expect(html).toContain('disconnected');
    const fetcher = vi.fn().mockResolvedValue(configResponse()); vi.stubGlobal('fetch', fetcher);
    await act(async () => { render(<Probe />); });
    await act(async () => sockets[0].open());
    const container = document.createElement('div');
    document.body.appendChild(container);
    container.innerHTML = html;
    const onRecoverableError = vi.fn();
    let view!: ReturnType<typeof render>;
    await act(async () => { view = render(<StatusProbe />, { container, hydrate: true, onRecoverableError }); });
    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(view.getByTestId('channel-status').textContent).toBe('connected');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('does not reconnect a healthy socket on focus or visibility recovery', async () => {
    const fetcher = vi.fn().mockResolvedValue(configResponse()); vi.stubGlobal('fetch', fetcher);
    await act(async () => { render(<Probe />); });
    await act(async () => sockets[0].open());
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('pageshow'));
    });
    expect(fetcher).toHaveBeenCalledTimes(1); expect(sockets[0].readyState).toBe(Socket.OPEN);
  });
  it('aborts a departed handshake and ignores its late unauthorized response', async () => {
    let finish!: (value: Response) => void;
    const fetcher = vi.fn<(url: string, options: RequestInit) => Promise<Response>>(() => new Promise<Response>(resolve => { finish = resolve; }));
    vi.stubGlobal('fetch', fetcher);
    const view = render(<Probe />);
    view.unmount(); await act(async () => { await Promise.resolve(); });
    expect((fetcher.mock.calls[0][1].signal as AbortSignal).aborted).toBe(true);
    await act(async () => finish(new Response('{}', { status: 401 })));
    expect(handleAuthError).not.toHaveBeenCalled();
  });
  it('still invalidates the current session on an actual unauthorized handshake', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })));
    await act(async () => { render(<Probe />); });
    expect(handleAuthError).toHaveBeenCalledTimes(1);
  });
  it('reuses a healthy SSE stream and reconnects it when focus returns after a long silence', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn((_url: string, options: RequestInit) => Promise.resolve(pendingBodyResponse(options.signal as AbortSignal, 'text/event-stream')));
    vi.stubGlobal('fetch', fetcher);
    await act(async () => { render(<Probe wsConfigUrl="" />); });
    expect(fetcher).toHaveBeenCalledTimes(1);
    await act(async () => window.dispatchEvent(new Event('focus')));
    expect(fetcher).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(90_001); });
    await act(async () => window.dispatchEvent(new Event('focus')));
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect((fetcher.mock.calls[0][1].signal as AbortSignal).aborted).toBe(true);
    expect(handleAuthError).not.toHaveBeenCalled();
  });
  it('aborts a pending configuration body on logout and does not reconnect on focus', async () => {
    const fetcher = vi.fn((_url: string, options: RequestInit) => Promise.resolve(pendingBodyResponse(options.signal as AbortSignal, 'application/json')));
    vi.stubGlobal('fetch', fetcher);
    await act(async () => { render(<Probe />); });
    const signal = fetcher.mock.calls[0][1].signal as AbortSignal;
    expect(signal.aborted).toBe(false);
    await act(async () => window.dispatchEvent(new Event('cosaif:session-ended')));
    expect(signal.aborted).toBe(true);
    await act(async () => window.dispatchEvent(new Event('focus')));
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(handleAuthError).not.toHaveBeenCalled();
  });
  it('times out a stalled configuration body and continues through SSE', async () => {
    vi.useFakeTimers();
    let first = true;
    const fetcher = vi.fn((_url: string, options: RequestInit) => {
      const contentType = first ? 'application/json' : 'text/event-stream';
      first = false;
      return Promise.resolve(pendingBodyResponse(options.signal as AbortSignal, contentType));
    });
    vi.stubGlobal('fetch', fetcher);
    await act(async () => { render(<Probe />); });
    await act(async () => { await vi.advanceTimersByTimeAsync(6_001); });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect((fetcher.mock.calls[0][1].signal as AbortSignal).aborted).toBe(true);
    expect((fetcher.mock.calls[1][1].signal as AbortSignal).aborted).toBe(false);
    expect(handleAuthError).not.toHaveBeenCalled();
  });
});
