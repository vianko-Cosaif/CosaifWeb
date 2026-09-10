"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  type RealtimeMovementEvent,
  useRealtimeMovimientos,
} from "../movimientos/useRealtimeMovimientos";

type RefreshReason = {
  event: RealtimeMovementEvent;
  forced?: boolean;
};

type UseRealtimeBoardRefreshArgs = {
  enabled?: boolean;
  realtimeLocalidadId?: number | null;
  scopeLocalidadId?: number | null;
  minDelayMs?: number;
  maxDelayMs?: number;
  matchesEvent?: (event: RealtimeMovementEvent) => boolean;
  onRefresh: (reason: RefreshReason) => void | Promise<void>;
};

function toPositiveInt(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

function isBoardRefreshEvent(event: RealtimeMovementEvent) {
  const type = String(event.type ?? "");
  if (type === "realtime.ready" || type === "realtime.resume") return true;
  return !type || !type.startsWith("realtime.");
}

function matchesLocalidadScope(event: RealtimeMovementEvent, scopeLocalidadId?: number | null) {
  const scope = toPositiveInt(scopeLocalidadId);
  const eventLocalidadId = toPositiveInt(event.localidadId);

  if (!scope || !eventLocalidadId) return true;
  return scope === eventLocalidadId;
}

function eventKey(event: RealtimeMovementEvent) {
  return (
    event.eventId ??
    [
      event.type,
      event.movimientoId,
      event.arrastreId,
      event.vagonId,
      event.incidenteId,
      event.accion,
      event.estado,
      event.estadoAnterior,
      event.occurredAt,
    ]
      .map((part) => String(part ?? ""))
      .join(":")
  );
}

export function useRealtimeBoardRefresh({
  enabled = true,
  realtimeLocalidadId = null,
  scopeLocalidadId = null,
  minDelayMs = 450,
  maxDelayMs = 1_800,
  matchesEvent,
  onRefresh,
}: UseRealtimeBoardRefreshArgs) {
  const refreshRef = useRef(onRefresh);
  const matchesEventRef = useRef(matchesEvent);
  const timerRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);
  const pendingEventRef = useRef<RealtimeMovementEvent | null>(null);
  const lastEventKeyRef = useRef<string | null>(null);
  const lastEventAtRef = useRef(0);
  const generationRef = useRef(0);

  useEffect(() => {
    refreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    matchesEventRef.current = matchesEvent;
  }, [matchesEvent]);

  const scheduleRefresh = useCallback((event: RealtimeMovementEvent, forced = false) => {
    if (!enabled || typeof window === 'undefined' || document.visibilityState === 'hidden') return;
    const generation = generationRef.current;
    pendingEventRef.current = event;

    if (timerRef.current != null || inFlightRef.current) return;

    const min = Math.max(0, minDelayMs);
    const max = Math.max(min, maxDelayMs);
    const jitterMs = min + Math.floor(Math.random() * (max - min + 1));

    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      if (generation !== generationRef.current || document.visibilityState === 'hidden') return;
      const nextEvent = pendingEventRef.current ?? event;
      pendingEventRef.current = null;
      inFlightRef.current = true;

      Promise.resolve().then(() => generation === generationRef.current ? refreshRef.current({ event: nextEvent, forced }) : undefined)
        .catch((error) => {
          if (generation === generationRef.current) console.error("[realtime-board] refresh error", error);
        })
        .finally(() => {
          if (generation !== generationRef.current) return;
          inFlightRef.current = false;
          if (pendingEventRef.current) {
            scheduleRefresh(pendingEventRef.current, true);
          }
        });
    }, jitterMs);
  }, [enabled, minDelayMs, maxDelayMs]);

  useEffect(() => {
    const cancel = () => {
      generationRef.current += 1;
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
      timerRef.current = null;
      pendingEventRef.current = null;
      inFlightRef.current = false;
      lastEventKeyRef.current = null;
      lastEventAtRef.current = 0;
    };
    cancel();
    const visibility = () => {
      if (document.visibilityState === 'hidden') cancel();
      else if (enabled) scheduleRefresh({ type: 'realtime.resume' });
    };
    document.addEventListener('visibilitychange', visibility);
    return () => { document.removeEventListener('visibilitychange', visibility); cancel(); };
  }, [enabled, realtimeLocalidadId, scopeLocalidadId, scheduleRefresh]);

  const connectionStatus = useRealtimeMovimientos({
    enabled,
    localidadId: realtimeLocalidadId,
    onEvent: (event) => {
      if (!enabled || document.visibilityState === "hidden") return;
      if (!isBoardRefreshEvent(event)) return;
      if (!matchesLocalidadScope(event, scopeLocalidadId)) return;
      if (matchesEventRef.current && !matchesEventRef.current(event)) return;

      const key = eventKey(event);
      const now = Date.now();
      if (key && key === lastEventKeyRef.current && now - lastEventAtRef.current < 750) return;
      lastEventKeyRef.current = key;
      lastEventAtRef.current = now;

      scheduleRefresh(event);
    },
  });

  return connectionStatus;
}
