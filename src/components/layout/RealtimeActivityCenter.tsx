"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { operationalMessage } from "@/lib/operationalMessage";
import { AlertTriangle, Bell, Wifi, WifiOff, X } from "lucide-react";
import {
  useRealtimeMovimientos,
  type RealtimeMovementEvent,
} from "@/features/movimientos/useRealtimeMovimientos";
import { claimNotification } from "@/lib/notificationDelivery";
import { notificationIdentity } from "@/lib/notificationIdentity";
import { playNotificationSound } from "@/lib/notificationSound";
import { matchesNotificationAudience } from "@/lib/notificationAudience";
import { currentNotificationViewer } from "@/lib/notificationViewer";

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

function activityScope() {
  const viewer = currentNotificationViewer();
  return `cosaif:activity:v1:${viewer.id ?? 'session'}:${viewer.role}:${viewer.localidadId}:${viewer.empresaId}`;
}
function realtimeSoundType(event: RealtimeMovementEvent) {
  const type = String(event.type ?? "");
  return [type, event.accion, event.estado].filter(Boolean).map(String).join("_") || "generic";
}

export default function RealtimeActivityCenter() {
  const pathname = usePathname();
  const [filter, setFilter] = useState("Todas");
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<ActivityItem | null>(null);
  const seen = useRef(new Set<string>());
  const scopeRef = useRef<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const closeActivity = useCallback(() => {
    const viewed = new Set(seen.current);
    setItems(current => current.filter(item => !viewed.has(item.eventId)));
    setToast(current => current && !viewed.has(current.eventId) ? current : null);
    seen.current.clear();
    setOpen(false);
  }, []);
  const [incidentStatus, setIncidentStatus] = useState({ activeCount: 0, connected: true });

  // Mantiene WebSocket/SSE activo en cualquier pantalla que use el shell,
  // aunque el tablero visible no tenga su propia suscripcion.
  useRealtimeMovimientos({ onEvent: () => undefined });

  useEffect(() => {
    const scope = activityScope();
    if (scopeRef.current !== scope) { setItems([]); setToast(null); setOpen(false); seen.current.clear(); scopeRef.current = scope; }
    // Remove the old content history; delivery IDs remain solely for deduplication.
    try { Object.keys(localStorage).filter(key => key.startsWith("cosaif:activity:v1:")).forEach(key => localStorage.removeItem(key)); } catch { /* restricted storage */ }
  }, [pathname]);

  const pushItem = useCallback((item: ActivityItem, showToast = false) => {
    setItems((current) => {
      const updated = [item, ...current.filter(entry => entry.eventId !== item.eventId)].slice(0, 200);
      return updated;
    });
    if (showToast) setToast(item);
  }, []);

  useEffect(() => {
    let mounted = true;
    const onRealtimeEvent = (raw: Event) => {
      const event = (raw as CustomEvent<RealtimeMovementEvent>).detail;
      const type = String(event?.type ?? "");
      if (!event || type.startsWith("realtime.")) return;
      if (!matchesNotificationAudience(event, currentNotificationViewer())) return;
      const identity = notificationIdentity(event);
      const item: ActivityItem = {
        eventId: identity.key,
        title: operationalMessage(event).title,
        description: operationalMessage(event).body,
        source: event.localidadId ? `Patio ${event.localidadId}` : "Operación",
        kind: "realtime",
        receivedAt: Date.now(),
      };
      void claimNotification(identity.key, identity.ttlMs).then((accepted) => {
        if (!accepted || !mounted) return;
        pushItem(item, document.visibilityState === "visible");
        if (document.visibilityState === "visible")
          void playNotificationSound(realtimeSoundType(event));
      });
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
        document.visibilityState === "visible",
      );
    };

    const onRealtimeStatus = (raw: Event) => {
      const status = String((raw as CustomEvent<{ status?: string }>).detail?.status ?? "");
      if (!status) return;
      setIncidentStatus(current => ({ ...current, connected: status === "connected" }));
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
      mounted = false;
      window.removeEventListener("cosaif:realtime-event", onRealtimeEvent);
      window.removeEventListener("cosaif:activity-event", onAppActivity);
      window.removeEventListener("cosaif:realtime-status", onRealtimeStatus);
      window.removeEventListener("cosaif:incident-monitor-status", onIncidentStatus);
    };
  }, [pushItem]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => {
      if (document.visibilityState === "visible") setItems(current => current.filter(item => item.eventId !== toast.eventId));
      setToast(null);
    }, 7_000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeActivity();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, closeActivity]);

  const unread = Math.min(items.length, 99);
  const openActivity = () => { seen.current.clear(); setOpen(true); setToast(null); };
  const markRead = () => { setItems([]); setToast(null); seen.current.clear(); };
  const visibleItems = useMemo(() => items.filter(item => filter !== 'Incidentes' || /incidente/i.test(item.title)), [items, filter]);
  useEffect(() => {
    if (!open || !listRef.current) return;
    const elements = listRef.current.querySelectorAll<HTMLElement>('[data-notice-id]');
    if (typeof IntersectionObserver === 'undefined') {
      elements.forEach(element => seen.current.add(element.dataset.noticeId!));
      return;
    }
    const observer = new IntersectionObserver(entries => {
      if (document.visibilityState !== 'visible') return;
      entries.forEach(entry => { if (entry.isIntersecting) seen.current.add((entry.target as HTMLElement).dataset.noticeId!); });
    }, { root: listRef.current, threshold: 0.75 });
    elements.forEach(element => observer.observe(element));
    return () => observer.disconnect();
  }, [open, visibleItems]);

  return (
    <>
      {toast ? (
        <button
          type="button"
          onClick={() => {
            openActivity();
            setToast(null);
          }}
          className="fixed right-4 top-[calc(env(safe-area-inset-top)+4.5rem)] z-[1070] w-[min(calc(100vw-2rem),440px)] rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3 text-left text-sm text-[var(--app-text)] shadow-[var(--app-shadow-md)]"
          aria-label={`Abrir actividad: ${toast.title}`}
          role={toast.title.toLowerCase().includes("incidente") ? "alert" : "status"}
          aria-live={toast.title.toLowerCase().includes("incidente") ? "assertive" : "polite"}
        >
          <span className="block text-xs font-bold text-[var(--app-accent)]">
            Notificación en tiempo real
          </span>
          <span className="mt-1 block font-semibold">{toast.title}</span>
          {toast.description ? (
            <span className="mt-1 block text-xs text-[var(--app-text-muted)]">
              {toast.description}
            </span>
          ) : null}
        </button>
      ) : null}

      <button
        type="button"
        onClick={() => (open ? closeActivity() : openActivity())}
        className="fixed right-4 top-[calc(env(safe-area-inset-top)+1rem)] z-[55] inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text-muted)] shadow-[var(--app-shadow-sm)] transition hover:bg-[var(--app-surface-muted)]"
        aria-label={
          unread
            ? `Abrir actividad en tiempo real, ${unread} sin leer`
            : "Abrir actividad en tiempo real"
        }
        aria-expanded={open}
        aria-controls="realtime-activity-panel"
      >
        <Bell className="h-5 w-5 text-[var(--app-accent)]" />
        {unread ? (
          <span className="absolute -right-1.5 -top-1.5 grid min-h-5 min-w-5 place-items-center rounded-full bg-rose-600 px-1 text-[10px] font-black text-white ring-2 ring-[var(--app-bg)]">
            {unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <aside
          id="realtime-activity-panel"
          aria-label="Actividad reciente"
          className="fixed right-4 top-[calc(env(safe-area-inset-top)+4.5rem)] z-[60] max-h-[min(82vh,680px)] w-[min(calc(100vw-2rem),440px)] overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] shadow-[var(--app-shadow-md)]"
        >
          <header className="flex items-center justify-between border-b border-[var(--app-border)] px-4 py-3">
            <div>
              <p className="text-lg font-bold text-[var(--app-text)]">Notificaciones</p>
              <p className="text-xs text-[var(--app-text-muted)]">Avisos pendientes de tu patio</p>
            </div>
            <button
              type="button"
              onClick={closeActivity}
              className="rounded-md p-2 hover:bg-[var(--app-surface-muted)]"
              aria-label="Cerrar actividad"
            >
              <X className="h-4 w-4" />
            </button>
          </header>
          <div className="grid grid-cols-2 gap-2 border-b border-[var(--app-border)] p-3">
            <div
              className={`rounded-xl border p-3 ${incidentStatus.activeCount ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200" : "border-[var(--app-border)] bg-[var(--app-surface-subtle)] text-[var(--app-text-muted)]"}`}
            >
              <div className="flex items-center gap-2 text-xs font-bold">
                <AlertTriangle className="h-4 w-4" /> Incidentes
              </div>
              <p className="mt-1 text-xl font-black tabular-nums">{incidentStatus.activeCount}</p>
            </div>
            <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] p-3 text-[var(--app-text-muted)]">
              <div className="flex items-center gap-2 text-xs font-bold">
                {incidentStatus.connected ? (
                  <Wifi className="h-4 w-4 text-emerald-600" />
                ) : (
                  <WifiOff className="h-4 w-4 text-rose-600" />
                )}{" "}
                Sistema
              </div>
              <p className="mt-1 text-sm font-black text-[var(--app-text)]">
                {incidentStatus.connected ? "Conectado" : "Sin conexión"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--app-border)] p-3">
            {['Todas', 'Incidentes'].map(label => <button key={label} type="button" aria-pressed={filter === label} onClick={() => setFilter(label)} className={`min-h-10 rounded-lg px-3 text-sm font-semibold ${filter === label ? 'bg-[var(--app-accent)] text-white' : 'bg-[var(--app-surface-muted)] text-[var(--app-text)]'}`}>{label}</button>)}
            {unread > 0 && <button type="button" onClick={markRead} className="min-h-10 text-xs font-semibold text-[var(--app-accent)]">Eliminar todos</button>}
          </div>
          <div ref={listRef} className="max-h-[min(46vh,430px)] overflow-y-auto p-3">
            {visibleItems.length ? (
              visibleItems.map((item, index) => (
                <div
                  key={item.eventId || `${item.kind}-${index}`}
                  data-notice-id={item.eventId}
                  className="mb-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-[var(--app-text)]">{item.title}</p>
                    {item.source ? (
                      <span className="shrink-0 rounded-full bg-[var(--app-surface-muted)] px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--app-text-muted)]">
                        {item.source}
                      </span>
                    ) : null}
                  </div>
                  {item.description ? (
                    <p className="mt-2 text-sm leading-6 text-[var(--app-text-muted)]">{item.description}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-[var(--app-text-muted)]">
                    {new Date(item.receivedAt).toLocaleString("es-MX", {
                      day: "2-digit", month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              ))
            ) : (
              <p className="p-6 text-center text-sm text-[var(--app-text-muted)]">
                Estás al día. No tienes avisos pendientes.
              </p>
            )}
          </div>
          <p className="border-t border-[var(--app-border)] p-3 text-xs text-[var(--app-text-muted)]">Los avisos que veas se eliminan al cerrar. No se guarda historial.</p>
        </aside>
      ) : null}
    </>
  );
}
