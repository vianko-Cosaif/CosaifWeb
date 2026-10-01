import 'server-only';

export function buildUpstreamHeaders(req: Request, token: string) {
  const headers = new Headers({ accept: req.headers.get('accept') || 'application/json', authorization: `Bearer ${token}` });
  for (const name of ['content-type', 'range', 'if-none-match', 'last-event-id']) {
    const value = req.headers.get(name); if (value) headers.set(name, value);
  }
  const key = req.headers.get('idempotency-key') || req.headers.get('x-idempotency-key');
  if (key && /^[A-Za-z0-9:_-]{8,128}$/.test(key)) headers.set('x-idempotency-key', key);
  headers.set('x-request-id', crypto.randomUUID());
  return headers;
}

export function getErrorStatus(error: unknown): 502 | 504 {
  return error instanceof Error && ['AbortError', 'TimeoutError'].includes(error.name) ? 504 : 502;
}

/** Share transport behavior while keeping each API's authorization and scope rules explicit. */
export async function fetchUpstream(url: string, init: RequestInit, requestSignal?: AbortSignal, stream = false) {
  const headers = new Headers(init.headers);
  const requestId = headers.get('x-request-id') || crypto.randomUUID();
  headers.set('x-request-id', requestId);
  const configured = Number(process.env.BFF_TIMEOUT_MS || 12_000);
  const deadline = Number.isFinite(configured) ? Math.max(1000, Math.min(120_000, configured)) : 12_000;
  const signals = [requestSignal, init.signal, stream ? undefined : AbortSignal.timeout(deadline)].filter((signal): signal is AbortSignal => Boolean(signal));
  const started = performance.now();
  let status = 502;
  try {
    const response = await fetch(url, { ...init, headers, signal: AbortSignal.any(signals), cache: 'no-store', redirect: 'manual' });
    status = response.status;
    const responseHeaders = new Headers(response.headers);
    responseHeaders.set('x-request-id', requestId);
    responseHeaders.set('server-timing', `upstream;dur=${Math.round(performance.now() - started)}`);
    return new Response(response.body, { status, statusText: response.statusText, headers: responseHeaders });
  } catch (error) { status = getErrorStatus(error); throw error; }
  finally {
    if (process.env.TELEMETRY_ENABLED === 'true') {
      console.info(JSON.stringify({ event: 'upstream.response', requestId, method: init.method || 'GET', service: new URL(url).pathname.split('/')[1], status, durationMs: Math.round(performance.now() - started) }));
    }
  }
}

export function upstreamResponseHeaders(response: Response, stream = false) {
  const headers = new Headers({ 'content-type': response.headers.get('content-type') || 'application/json', 'cache-control': stream ? 'no-cache, no-transform' : 'no-store' });
  for (const name of ['content-disposition', 'content-range', 'etag', 'retry-after', 'x-idempotent-replay', 'x-request-id', 'server-timing']) {
    const value = response.headers.get(name); if (value) headers.set(name, value);
  }
  // fetch decompresses upstream responses, so forwarding its Content-Length is incorrect.
  if (stream) headers.set('x-accel-buffering', 'no');
  return headers;
}
