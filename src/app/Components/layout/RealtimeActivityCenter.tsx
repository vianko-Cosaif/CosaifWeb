"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bell, Wifi, WifiOff, X } from "lucide-react";
import type { RealtimeMovementEvent } from "@/app/hooks/useRealtimeMovimientos";

type AppActivityEvent = {
  eventId?: string;
  title?: string;
  description?: string;
  source?: string;
  type?: string;
};

type ActivityItem = {
  eventId: string;
  title: string;
  description?: string;
  source?: string;
  kind: "realtime" | "app" | "status" | "route";
  receivedAt: number;
};

function eventTitle(event: RealtimeMovementEvent) {
  const action = String(event.accion ?? "").replaceAll("_", " ").trim();
  const entity = event.arrastreId
    ? `Arrastre #${event.arrastreId}`
    : event.movimientoId
      ? `Movimiento #${event.movimientoId}`
      : event.incidenteId
        ? `Incidente #${event.incidenteId}`
        : "Operación";
  return action ? `${entity}: ${action}` : `${entity} actualizado`;
}

export default function RealtimeActivityCenter() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<ActivityItem | null>(null);
  const [lastReadAt, setLastReadAt] = useState(() => Date.now());
  const [incidentStatus, setIncidentStatus] = useState({ activeCount: 0, connected: true });

  const pushItem = useCallback((item: ActivityItem, showToast = false) => {
    setItems((current) => [item, ...current.filter((entry) => entry.eventId !== item.eventId)].slice(0, 40));
    if (showToast) setToast(item);
  }, []);

  useEffect(() => {
    const onRealtimeEvent = (raw: Event) => {
      const event = (raw as CustomEvent<RealtimeMovementEvent>).detail;
      const type = String(event?.type ?? "");
      if (!event || type.startsWith("realtime.")) return;
      const item: ActivityItem = {
        eventId: event.eventId ?? `${type}-${event.entityId ?? event.movimientoId ?? event.arrastreId ?? Date.now()}`,
        title: eventTitle(event),
        description: event.estado ? `Estado: ${event.estado}` : event.descripcion ?? undefined,
        source: event.source ? String(event.source).toUpperCase() : "Realtime",
        kind: "realtime",
        receivedAt: Date.now(),
      };
      pushItem(item, !type.includes("incidente"));
    };

    const onAppActivity = (raw: Event) => {
      const event = (raw as CustomEvent<AppActivityEvent>).detail;
      if (!event?.title && !event?.description) return;
      pushItem(
        {
          eventId: event.eventId ?? `app-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          title: event.title ?? "Actividad",
          description: event.description,
          source: event.source,
          kind: "app",
          receivedAt: Date.now(),
        },
        false,
      );
    };

    const onRealtimeStatus = (raw: Event) => {
      const status = String((raw as CustomEvent<{ status?: string }>).detail?.status ?? "");
      if (!status) return;
      pushItem(
        {
          eventId: `realtime-status-${status}-${Date.now()}`,
          title: status === "connected" ? "Monitor conectado" : status === "connecting" ? "Monitor conectando" : "Monitor desconectado",
          description: "Estado del canal en tiempo real",
          source: "Sistema",
          kind: "status",
          receivedAt: Date.now(),
        },
        false,
      );
    };

    const onIncidentStatus = (raw: Event) => {
      const detail = (raw as CustomEvent<{ activeCount?: number; connected?: boolean }>).detail;
      setIncidentStatus({
        activeCount: Math.max(0, Number(detail?.activeCount) || 0),
        connected: detail?.connected !== false,
      });
    };

    window.addEventListener("cosaif:realtime-event", onRealtimeEvent);
    window.addEventListener("cosaif:activity-event", onAppActivity);
    window.addEventListener("cosaif:realtime-status", onRealtimeStatus);
    window.addEventListener("cosaif:incident-monitor-status", onIncidentStatus);
    return () => {
      window.removeEventListener("cosaif:realtime-event", onRealtimeEvent);
      window.removeEventListener("cosaif:activity-event", onAppActivity);
      window.removeEventListener("cosaif:realtime-status", onRealtimeStatus);
      window.removeEventListener("cosaif:incident-monitor-status", onIncidentStatus);
    };
  }, [pushItem]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4_500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setLastReadAt(Date.now());
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const unread = useMemo(
    () => Math.min(items.filter((item) => (item.kind === "realtime" || item.kind === "app") && item.receivedAt > lastReadAt).length, 99),
    [items, lastReadAt],
  );

  const openActivity = () => {
    setLastReadAt(Date.now());
    setOpen(true);
  };

  const closeActivity = () => {
    setLastReadAt(Date.now());
    setOpen(false);
  };

  return (
    <>
      {toast ? (
        <button
          type="button"
          onClick={() => { openActivity(); setToast(null); }}
          className="fixed right-4 top-[calc(env(safe-area-inset-top)+4.5rem)] z-[70] max-w-sm rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3 text-left text-sm text-[var(--app-text)] shadow-[var(--app-shadow-md)]"
          aria-label={`Abrir actividad: ${toast.title}`}
        >
          <span className="block text-xs font-bold text-[var(--app-accent)]">Actualización en tiempo real</span>
          <span className="mt-1 block">{toast.title}</span>
        </button>
      ) : null}

      <button
        type="button"
        onClick={() => open ? closeActivity() : openActivity()}
        className="fixed right-4 top-[calc(env(safe-area-inset-top)+1rem)] z-[55] inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text-muted)] shadow-[var(--app-shadow-sm)] transition hover:bg-[var(--app-surface-muted)]"
        aria-label={unread ? `Abrir actividad en tiempo real, ${unread} sin leer` : "Abrir actividad en tiempo real"}
        aria-expanded={open}
        aria-controls="realtime-activity-panel"
      >
        <Bell className="h-5 w-5 text-[var(--app-accent)]" />
        {(unread || incidentStatus.activeCount) ? <span className="absolute -right-1.5 -top-1.5 grid min-h-5 min-w-5 place-items-center rounded-full bg-rose-600 px-1 text-[10px] font-black text-white ring-2 ring-[var(--app-bg)]">{Math.min(99, unread + incidentStatus.activeCount)}</span> : null}
      </button>

      {open ? (
        <aside id="realtime-activity-panel" aria-label="Actividad reciente" className="fixed right-4 top-[calc(env(safe-area-inset-top)+4.5rem)] z-[60] max-h-[min(72vh,560px)] w-[min(calc(100vw-2rem),390px)] overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] shadow-[var(--app-shadow-md)]">
          <header className="flex items-center justify-between border-b border-[var(--app-border)] px-4 py-3">
            <div>
              <p className="text-sm font-bold text-[var(--app-text)]">Alertas y actividad</p>
              <p className="text-xs text-[var(--app-text-muted)]">Todo en un solo lugar</p>
            </div>
            <button type="button" onClick={closeActivity} className="rounded-md p-2 hover:bg-[var(--app-surface-muted)]" aria-label="Cerrar actividad">
              <X className="h-4 w-4" />
            </button>
          </header>
          <div className="grid grid-cols-2 gap-2 border-b border-[var(--app-border)] p-3">
            <div className={`rounded-xl border p-3 ${incidentStatus.activeCount ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200" : "border-[var(--app-border)] bg-[var(--app-surface-subtle)] text-[var(--app-text-muted)]"}`}>
              <div className="flex items-center gap-2 text-xs font-bold"><AlertTriangle className="h-4 w-4" /> Incidentes</div>
              <p className="mt-1 text-xl font-black tabular-nums">{incidentStatus.activeCount}</p>
            </div>
            <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] p-3 text-[var(--app-text-muted)]">
              <div className="flex items-center gap-2 text-xs font-bold">{incidentStatus.connected ? <Wifi className="h-4 w-4 text-emerald-600" /> : <WifiOff className="h-4 w-4 text-rose-600" />} Sistema</div>
              <p className="mt-1 text-sm font-black text-[var(--app-text)]">{incidentStatus.connected ? "Conectado" : "Sin conexión"}</p>
            </div>
          </div>
          <div className="max-h-[430px] overflow-y-auto p-2">
            {items.length ? items.map((item, index) => (
              <div key={item.eventId || `${item.kind}-${index}`} className="border-b border-[var(--app-border)] px-2 py-3 last:border-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-[var(--app-text)]">{item.title}</p>
                  {item.source ? <span className="shrink-0 rounded-full bg-[var(--app-surface-muted)] px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--app-text-muted)]">{item.source}</span> : null}
                </div>
                {item.description ? <p className="mt-1 text-xs text-[var(--app-text-muted)]">{item.description}</p> : null}
                <p className="mt-1 text-xs text-[var(--app-text-muted)]">{new Date(item.receivedAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</p>
              </div>
            )) : <p className="p-6 text-center text-sm text-[var(--app-text-muted)]">Aún no hay actividad.</p>}
          </div>
        </aside>
      ) : null}
    </>
  );
}
