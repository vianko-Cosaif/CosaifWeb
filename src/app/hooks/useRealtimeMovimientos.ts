"use client";

import { useEffect, useRef, useState } from "react";
import { handleAuthError } from "@/app/utils/auth";

export type RealtimeMovementEventType =
  | "movimiento.creado"
  | "movimiento.estado"
  | "movimiento.incidente"
  | "torno.estado"
  | "incidente.estado"
  | "torreon.movimiento.creado"
  | "torreon.movimiento.estado"
  | "torreon.movimiento.incidente"
  | "torreon.incidente.estado"
  | "torreon.arrastre.creado"
  | "torreon.arrastre.estado"
  | "torreon.arrastre.vagon"
  | "torreon.arrastre.incidente"
  | "torreon.arrastre.orden"
  | "realtime.ready"
  | "realtime.resume"
  | "realtime.pong";

export type RealtimeMovementEvent = {
  type?: RealtimeMovementEventType;
  eventId?: string;
  source?: "cosaif" | "torreon" | string;
  entity?: "movimiento" | "arrastre" | "vagon" | "incidente" | string;
  entityId?: number | string | null;
  movimientoId?: number | null;
  arrastreId?: number | null;
  vagonId?: number | null;
  empresaId?: number | null;
  localidadId?: number | null;
  clienteId?: number | null;
  folio?: string | null;
  accion?: string | null;
  estado?: string | null;
  estadoAnterior?: string | null;
  incidenteGlobal?: boolean | null;
  finalizado?: boolean | null;
  incidenteId?: number | null;
  descripcion?: string | null;
  locomotiveNumber?: number | string | null;
  occurredAt?: string;
  transport?: "websocket" | "sse";
  version?: string | number | null;
  snapshot?: Record<string, unknown> | null;
  [key: string]: unknown;
};

type Subscriber = (event: RealtimeMovementEvent) => void;
export type RealtimeConnectionStatus = "connecting" | "connected" | "disconnected";
type StatusSubscriber = (status: RealtimeConnectionStatus) => void;

type StreamState = {
  abortController: AbortController | null;
  reconnectTimer: number | null;
  healthTimer: number | null;
  attempt: number;
  running: boolean;
  connecting: boolean;
  sseUrl: string;
  wsConfigUrl: string;
  webSocket: WebSocket | null;
  connectionToken: number;
  lastActivityAt: number;
};

const DEFAULT_REALTIME_SSE_URL =
  process.env.NEXT_PUBLIC_REALTIME_URL || "/api/passthrough/realtime/events";
const DEFAULT_REALTIME_WS_CONFIG_URL =
  process.env.NEXT_PUBLIC_REALTIME_WS_CONFIG_URL || "/api/realtime/ws-config";

const subscribers = new Set<Subscriber>();
const statusSubscribers = new Set<StatusSubscriber>();
let realtimeStatus: RealtimeConnectionStatus = "disconnected";
const recentEvents = new Map<string, number>();
const RECENT_EVENT_TTL_MS = 1_200;

const streamState: StreamState = {
  abortController: null,
  reconnectTimer: null,
  healthTimer: null,
  attempt: 0,
  running: false,
  connecting: false,
  sseUrl: DEFAULT_REALTIME_SSE_URL,
  wsConfigUrl: DEFAULT_REALTIME_WS_CONFIG_URL,
  webSocket: null,
  connectionToken: 0,
  lastActivityAt: 0,
};

let lifecycleListenersBound = false;
const suppressedReconnectSockets = new WeakSet<WebSocket>();

class RealtimeAuthError extends Error {}

function warnInDevelopment(message: string, error: unknown) {
  if (process.env.NODE_ENV !== "production") console.warn(message, error);
}

function browserIsOnline() {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

function markActivity() {
  streamState.lastActivityAt = Date.now();
}

function setRealtimeStatus(status: RealtimeConnectionStatus) {
  if (realtimeStatus === status) return;
  realtimeStatus = status;
  for (const subscriber of statusSubscribers) subscriber(status);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("cosaif:realtime-status", { detail: { status } }));
  }
}

function buildHeaders(): HeadersInit {
  return {};
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
  if (shouldSuppressEvent(event)) return;

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("cosaif:realtime-event", { detail: event }));
  }

  for (const subscriber of subscribers) {
    subscriber(event);
  }
}

function eventKey(event: RealtimeMovementEvent) {
  if (event.eventId) return `id:${event.eventId}`;
  return [
    event.type,
    event.source,
    event.entity,
    event.entityId,
    event.empresaId,
    event.localidadId,
    event.clienteId,
    event.movimientoId,
    event.arrastreId,
    event.vagonId,
    event.incidenteId,
    event.accion,
    event.estado,
    event.estadoAnterior,
  ].map((part) => String(part ?? "-")).join("|");
}

function shouldSuppressEvent(event: RealtimeMovementEvent) {
  const type = String(event.type ?? "");
  if (type === "realtime.ready" || type === "realtime.resume" || type === "realtime.pong") {
    return false;
  }

  const now = Date.now();
  if (recentEvents.size > 400) {
    for (const [key, expiresAt] of recentEvents) {
      if (expiresAt <= now) recentEvents.delete(key);
    }
  }

  const key = eventKey(event);
  const expiresAt = recentEvents.get(key);
  if (expiresAt && expiresAt > now) return true;

  recentEvents.set(key, now + RECENT_EVENT_TTL_MS);
  return false;
}

function notifyRealtimeResume(reason: string) {
  notifySubscribers({
    type: "realtime.resume",
    eventId: `realtime.resume:${reason}:${Date.now()}`,
    occurredAt: new Date().toISOString(),
  });
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
  if (!browserIsOnline()) return;
  setRealtimeStatus("disconnected");

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
      if (event) {
        markActivity();
        notifySubscribers(event);
      }
    }
  }
}

async function connectStream(url: string, token: number) {
  streamState.abortController?.abort();
  const abortController = new AbortController();
  streamState.abortController = abortController;
  const connectionTimeoutId = window.setTimeout(() => abortController.abort(), 10_000);
  let connectedAt = 0;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: buildHeaders(),
      credentials: "include",
      cache: "no-store",
      signal: abortController.signal,
    });
    window.clearTimeout(connectionTimeoutId);

    if (response.status === 401 || response.status === 403) {
      throw new RealtimeAuthError(`Realtime SSE HTTP ${response.status}`);
    }
    if (!response.ok) throw new Error(`Realtime SSE HTTP ${response.status}`);
    const contentType = String(response.headers.get("content-type") || "").toLowerCase();
    if (!contentType.includes("text/event-stream")) {
      throw new Error("Realtime SSE respondió con un formato inválido");
    }
    if (streamState.connectionToken !== token || !streamState.running) {
      abortController.abort();
      return;
    }

    connectedAt = Date.now();
    markActivity();
    setRealtimeStatus("connected");
    await readSseStream(response, abortController.signal);
  } catch (error) {
    if (error instanceof RealtimeAuthError) {
      stopRealtime();
      handleAuthError();
    } else if (!abortController.signal.aborted) {
      warnInDevelopment("[realtime] SSE cerrada:", error);
    }
  } finally {
    window.clearTimeout(connectionTimeoutId);
    if (connectedAt && Date.now() - connectedAt >= 30_000) streamState.attempt = 0;
    if (streamState.abortController === abortController) {
      streamState.abortController = null;
    }
    if (streamState.connectionToken === token) setRealtimeStatus("disconnected");
    if (streamState.running && streamState.connectionToken === token) scheduleReconnect();
  }
}

function webSocketAllowedForPage(rawUrl: string): string {
  const wsUrl = new URL(rawUrl, window.location.href);
  if (window.location.protocol === "https:" && wsUrl.protocol === "ws:") {
    throw new Error("Realtime WS bloqueado por HTTPS; usando SSE PWA");
  }
  if (wsUrl.protocol !== "ws:" && wsUrl.protocol !== "wss:") {
    throw new Error("Realtime WS URL invalida");
  }
  return wsUrl.toString();
}

async function resolveWebSocketUrl(configUrl: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 6_000);
  let response: Response;

  try {
    response = await fetch(configUrl, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timeoutId);
  }

  if (response.status === 401 || response.status === 403) {
    throw new RealtimeAuthError(`Realtime WS config HTTP ${response.status}`);
  }
  if (!response.ok) throw new Error(`Realtime WS config HTTP ${response.status}`);
  const payload = (await response.json()) as { url?: string | null; transport?: string; reason?: string };
  if (payload.transport && payload.transport !== "websocket") {
    throw new Error(payload.reason || "Realtime WS no disponible para esta conexion");
  }
  if (!payload.url) throw new Error("Realtime WS sin URL");
  return webSocketAllowedForPage(payload.url);
}

function clearWebSocketHealthTimer() {
  if (streamState.healthTimer != null) {
    window.clearInterval(streamState.healthTimer);
    streamState.healthTimer = null;
  }
}

function startWebSocketHealthTimer(ws: WebSocket) {
  clearWebSocketHealthTimer();
  streamState.healthTimer = window.setInterval(() => {
    if (streamState.webSocket !== ws) {
      clearWebSocketHealthTimer();
      return;
    }

    if (ws.readyState !== WebSocket.OPEN) return;

    const staleMs = Date.now() - streamState.lastActivityAt;
    if (staleMs > 120_000) {
      ws.close();
      return;
    }

    try {
      ws.send("ping");
    } catch {
      ws.close();
    }
  }, 45_000);
}

async function connectWebSocket(configUrl: string, token: number): Promise<void> {
  const wsUrl = await resolveWebSocketUrl(configUrl);
  if (streamState.connectionToken !== token || !streamState.running) return;

  return new Promise((resolve, reject) => {
    let settled = false;
    let openedAt = 0;
    const timeoutId = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      streamState.webSocket?.close();
      reject(new Error("Realtime WS timeout"));
    }, 8_000);

    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
    } catch (error) {
      window.clearTimeout(timeoutId);
      reject(error);
      return;
    }
    streamState.webSocket = ws;

    ws.onopen = () => {
      if (streamState.webSocket !== ws || streamState.connectionToken !== token) {
        ws.close();
        return;
      }
      settled = true;
      openedAt = Date.now();
      markActivity();
      setRealtimeStatus("connected");
      startWebSocketHealthTimer(ws);
      window.clearTimeout(timeoutId);
      resolve();
    };

    ws.onmessage = (message) => {
      const event = parseJsonEvent(message.data);
      if (event) {
        markActivity();
        notifySubscribers(event);
      }
    };

    ws.onerror = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      reject(new Error("Realtime WS error"));
    };

    ws.onclose = () => {
      if (streamState.webSocket === ws) {
        streamState.webSocket = null;
        clearWebSocketHealthTimer();
        setRealtimeStatus("disconnected");
      }
      window.clearTimeout(timeoutId);
      if (!settled) {
        settled = true;
        reject(new Error("Realtime WS cerrado"));
        return;
      }
      if (suppressedReconnectSockets.has(ws)) {
        suppressedReconnectSockets.delete(ws);
        return;
      }
      if (openedAt && Date.now() - openedAt >= 30_000) streamState.attempt = 0;
      if (streamState.running && subscribers.size > 0 && streamState.connectionToken === token) {
        scheduleReconnect();
      }
    };
  });
}

function closeActiveConnection({ suppressWsReconnect = true } = {}) {
  streamState.abortController?.abort();
  streamState.abortController = null;
  clearWebSocketHealthTimer();

  const ws = streamState.webSocket;
  streamState.webSocket = null;
  if (ws && suppressWsReconnect) suppressedReconnectSockets.add(ws);
  ws?.close();
}

async function connectRealtime() {
  if (!streamState.running || subscribers.size === 0 || streamState.connecting) return;
  if (!browserIsOnline()) {
    scheduleReconnect();
    return;
  }

  const token = streamState.connectionToken + 1;
  streamState.connectionToken = token;
  streamState.connecting = true;
  setRealtimeStatus("connecting");
  closeActiveConnection();

  try {
    if (streamState.wsConfigUrl) {
      try {
        await connectWebSocket(streamState.wsConfigUrl, token);
        return;
      } catch (error) {
        if (error instanceof RealtimeAuthError) {
          stopRealtime();
          handleAuthError();
          return;
        }
        warnInDevelopment("[realtime] WS no disponible, usando SSE:", error);
      }
    }

    if (streamState.connectionToken === token && streamState.running) {
      await connectStream(streamState.sseUrl, token);
    }
  } finally {
    if (streamState.connectionToken === token) streamState.connecting = false;
  }
}

function clearReconnectTimer() {
  if (streamState.reconnectTimer != null) {
    window.clearTimeout(streamState.reconnectTimer);
    streamState.reconnectTimer = null;
  }
}

function forceRealtimeReconnect(reason: string, notify = true) {
  if (!streamState.running || subscribers.size === 0) return;
  streamState.connectionToken += 1;
  streamState.connecting = false;
  streamState.attempt = 0;
  setRealtimeStatus("connecting");
  clearReconnectTimer();
  closeActiveConnection();
  if (notify) notifyRealtimeResume(reason);
  if (browserIsOnline()) void connectRealtime();
}

function bindLifecycleListeners() {
  if (lifecycleListenersBound || typeof window === "undefined") return;
  lifecycleListenersBound = true;

  const reconnectIfVisible = (reason: string) => {
    if (document.visibilityState === "hidden") return;
    forceRealtimeReconnect(reason);
  };

  window.addEventListener("online", () => forceRealtimeReconnect("online"));
  window.addEventListener("focus", () => {
    const inactiveMs = Date.now() - streamState.lastActivityAt;
    if (!streamState.webSocket && !streamState.abortController) {
      forceRealtimeReconnect("focus");
    } else if (inactiveMs > 90_000) {
      forceRealtimeReconnect("focus-stale");
    }
  });
  window.addEventListener("pageshow", () => reconnectIfVisible("pageshow"));
  document.addEventListener("visibilitychange", () => reconnectIfVisible("visible"));
  window.addEventListener("pagehide", () => {
    streamState.connectionToken += 1;
    streamState.connecting = false;
    clearReconnectTimer();
    closeActiveConnection();
  });
}

function startRealtime(sseUrl: string, wsConfigUrl: string) {
  bindLifecycleListeners();
  // La conexión es un singleton compartido por toda la PWA. El backend ya
  // limita la audiencia por usuario y cada consumidor filtra su propia vista;
  // aplicar aquí el alcance de un consumidor hacía que otro cerrara el canal.
  const nextSseUrl = scopedUrl(sseUrl || DEFAULT_REALTIME_SSE_URL);
  const nextWsConfigUrl = scopedUrl(wsConfigUrl);
  const shouldReconnect =
    streamState.sseUrl !== nextSseUrl || streamState.wsConfigUrl !== nextWsConfigUrl;

  streamState.sseUrl = nextSseUrl;
  streamState.wsConfigUrl = nextWsConfigUrl;
  streamState.running = true;

  if (shouldReconnect) {
    streamState.connectionToken += 1;
    streamState.connecting = false;
    closeActiveConnection();
    clearReconnectTimer();
  }

  if (streamState.abortController || streamState.webSocket || streamState.connecting) return;
  setRealtimeStatus("connecting");
  void connectRealtime();
}

function stopRealtime() {
  streamState.running = false;
  streamState.connectionToken += 1;
  streamState.connecting = false;
  closeActiveConnection();
  clearReconnectTimer();
  setRealtimeStatus("disconnected");
}

export function useRealtimeMovimientos({
  enabled = true,
  url = DEFAULT_REALTIME_SSE_URL,
  wsConfigUrl = DEFAULT_REALTIME_WS_CONFIG_URL,
  onEvent,
}: {
  enabled?: boolean;
  url?: string;
  wsConfigUrl?: string;
  localidadId?: number | null;
  onEvent: Subscriber;
}) {
  const onEventRef = useRef(onEvent);
  const [status, setStatus] = useState<RealtimeConnectionStatus>(realtimeStatus);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    statusSubscribers.add(setStatus);
    setStatus(realtimeStatus);
    return () => {
      statusSubscribers.delete(setStatus);
    };
  }, []);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const subscriber: Subscriber = (event) => onEventRef.current(event);
    subscribers.add(subscriber);
    startRealtime(url, wsConfigUrl);

    return () => {
      subscribers.delete(subscriber);
      if (subscribers.size === 0) stopRealtime();
    };
  }, [enabled, url, wsConfigUrl]);

  return status;
}
