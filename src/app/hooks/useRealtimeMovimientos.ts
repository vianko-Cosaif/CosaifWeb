"use client";

import { useEffect, useRef } from "react";

export type RealtimeMovementEventType =
  | "movimiento.estado"
  | "movimiento.incidente"
  | "incidente.estado"
  | "realtime.ready"
  | "realtime.pong";

export type RealtimeMovementEvent = {
  type?: RealtimeMovementEventType;
  eventId?: string;
  movimientoId?: number | null;
  empresaId?: number | null;
  localidadId?: number | null;
  clienteId?: number | null;
  estado?: string | null;
  estadoAnterior?: string | null;
  incidenteGlobal?: boolean | null;
  finalizado?: boolean | null;
  incidenteId?: number | null;
  descripcion?: string | null;
  locomotiveNumber?: number | string | null;
  occurredAt?: string;
  transport?: "websocket" | "sse";
  [key: string]: unknown;
};

type Subscriber = (event: RealtimeMovementEvent) => void;

type StreamState = {
  abortController: AbortController | null;
  reconnectTimer: number | null;
  attempt: number;
  running: boolean;
  sseUrl: string;
  wsConfigUrl: string;
  webSocket: WebSocket | null;
};

const DEFAULT_REALTIME_SSE_URL =
  process.env.NEXT_PUBLIC_REALTIME_URL || "/api/passthrough/realtime/events";
const DEFAULT_REALTIME_WS_CONFIG_URL =
  process.env.NEXT_PUBLIC_REALTIME_WS_CONFIG_URL || "/api/realtime/ws-config";

const subscribers = new Set<Subscriber>();

const streamState: StreamState = {
  abortController: null,
  reconnectTimer: null,
  attempt: 0,
  running: false,
  sseUrl: DEFAULT_REALTIME_SSE_URL,
  wsConfigUrl: DEFAULT_REALTIME_WS_CONFIG_URL,
  webSocket: null,
};

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function buildHeaders(): HeadersInit {
  const token = getCookie("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function scopedUrl(url: string, localidadId?: number | null): string {
  if (!localidadId || typeof window === "undefined") return url;

  const parsed = new URL(url, window.location.origin);
  parsed.searchParams.set("localidadId", String(localidadId));

  return parsed.origin === window.location.origin
    ? `${parsed.pathname}${parsed.search}${parsed.hash}`
    : parsed.toString();
}

function notifySubscribers(event: RealtimeMovementEvent) {
  for (const subscriber of subscribers) {
    subscriber(event);
  }
}

function parseJsonEvent(data: unknown): RealtimeMovementEvent | null {
  if (typeof data !== "string") return null;
  try {
    return JSON.parse(data) as RealtimeMovementEvent;
  } catch {
    return null;
  }
}

function parseSseBlock(block: string): RealtimeMovementEvent | null {
  const lines = block.split(/\r?\n/);
  let eventType = "";
  const dataLines: string[] = [];

  for (const line of lines) {
    if (!line || line.startsWith(":")) continue;
    if (line.startsWith("event:")) {
      eventType = line.slice("event:".length).trim();
      continue;
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trimStart());
    }
  }

  if (!dataLines.length) return null;

  try {
    const payload = JSON.parse(dataLines.join("\n")) as RealtimeMovementEvent;
    return { ...payload, type: (payload.type ?? eventType) as RealtimeMovementEventType };
  } catch {
    return null;
  }
}

function scheduleReconnect() {
  if (!streamState.running || streamState.reconnectTimer != null) return;
  const base = Math.min(30_000, 1_000 * 2 ** streamState.attempt);
  const jitter = Math.floor(Math.random() * 1_000);

  streamState.reconnectTimer = window.setTimeout(() => {
    streamState.reconnectTimer = null;
    if (!streamState.running || subscribers.size === 0) return;
    streamState.attempt += 1;
    void connectRealtime();
  }, base + jitter);
}

async function readSseStream(response: Response, signal: AbortSignal) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Realtime sin body");

  const decoder = new TextDecoder();
  let buffer = "";

  while (!signal.aborted) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() ?? "";

    for (const block of blocks) {
      const event = parseSseBlock(block);
      if (event) notifySubscribers(event);
    }
  }
}

async function connectStream(url: string) {
  streamState.abortController?.abort();
  const abortController = new AbortController();
  streamState.abortController = abortController;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: buildHeaders(),
      credentials: "include",
      cache: "no-store",
      signal: abortController.signal,
    });

    if (!response.ok) throw new Error(`Realtime SSE HTTP ${response.status}`);

    streamState.attempt = 0;
    await readSseStream(response, abortController.signal);
  } catch (error) {
    if (!abortController.signal.aborted) {
      console.warn("[realtime] SSE cerrada:", error);
    }
  } finally {
    if (streamState.abortController === abortController) {
      streamState.abortController = null;
    }
    if (!abortController.signal.aborted) scheduleReconnect();
  }
}

async function resolveWebSocketUrl(configUrl: string): Promise<string> {
  const response = await fetch(configUrl, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });

  if (!response.ok) throw new Error(`Realtime WS config HTTP ${response.status}`);
  const payload = (await response.json()) as { url?: string };
  if (!payload.url) throw new Error("Realtime WS sin URL");
  return payload.url;
}

async function connectWebSocket(configUrl: string): Promise<void> {
  const wsUrl = await resolveWebSocketUrl(configUrl);

  return new Promise((resolve, reject) => {
    let settled = false;
    const timeoutId = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      streamState.webSocket?.close();
      reject(new Error("Realtime WS timeout"));
    }, 8_000);

    const ws = new WebSocket(wsUrl);
    streamState.webSocket = ws;

    ws.onopen = () => {
      if (streamState.webSocket !== ws) {
        ws.close();
        return;
      }
      settled = true;
      streamState.attempt = 0;
      window.clearTimeout(timeoutId);
      resolve();
    };

    ws.onmessage = (message) => {
      const event = parseJsonEvent(message.data);
      if (event) notifySubscribers(event);
    };

    ws.onerror = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      reject(new Error("Realtime WS error"));
    };

    ws.onclose = () => {
      if (streamState.webSocket === ws) streamState.webSocket = null;
      window.clearTimeout(timeoutId);
      if (!settled) {
        settled = true;
        reject(new Error("Realtime WS cerrado"));
        return;
      }
      if (streamState.running && subscribers.size > 0) scheduleReconnect();
    };
  });
}

function closeActiveConnection() {
  streamState.abortController?.abort();
  streamState.abortController = null;

  const ws = streamState.webSocket;
  streamState.webSocket = null;
  ws?.close();
}

async function connectRealtime() {
  closeActiveConnection();

  if (streamState.wsConfigUrl) {
    try {
      await connectWebSocket(streamState.wsConfigUrl);
      return;
    } catch (error) {
      console.warn("[realtime] WS no disponible, usando SSE:", error);
    }
  }

  await connectStream(streamState.sseUrl);
}

function startRealtime(sseUrl: string, wsConfigUrl: string, localidadId?: number | null) {
  const nextSseUrl = scopedUrl(sseUrl || DEFAULT_REALTIME_SSE_URL, localidadId);
  const nextWsConfigUrl = scopedUrl(wsConfigUrl, localidadId);
  const shouldReconnect =
    streamState.sseUrl !== nextSseUrl || streamState.wsConfigUrl !== nextWsConfigUrl;

  streamState.sseUrl = nextSseUrl;
  streamState.wsConfigUrl = nextWsConfigUrl;
  streamState.running = true;

  if (shouldReconnect) {
    closeActiveConnection();
    if (streamState.reconnectTimer != null) {
      clearTimeout(streamState.reconnectTimer);
      streamState.reconnectTimer = null;
    }
  }

  if (streamState.abortController || streamState.webSocket) return;
  void connectRealtime();
}

function stopRealtime() {
  streamState.running = false;
  closeActiveConnection();
  if (streamState.reconnectTimer != null) {
    clearTimeout(streamState.reconnectTimer);
    streamState.reconnectTimer = null;
  }
}

export function useRealtimeMovimientos({
  enabled = true,
  url = DEFAULT_REALTIME_SSE_URL,
  wsConfigUrl = DEFAULT_REALTIME_WS_CONFIG_URL,
  localidadId = null,
  onEvent,
}: {
  enabled?: boolean;
  url?: string;
  wsConfigUrl?: string;
  localidadId?: number | null;
  onEvent: Subscriber;
}) {
  const onEventRef = useRef(onEvent);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const subscriber: Subscriber = (event) => onEventRef.current(event);
    subscribers.add(subscriber);
    startRealtime(url, wsConfigUrl, localidadId);

    return () => {
      subscribers.delete(subscriber);
      if (subscribers.size === 0) stopRealtime();
    };
  }, [enabled, url, wsConfigUrl, localidadId]);
}
