"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, X } from "lucide-react";
import type { RealtimeMovementEvent } from "@/app/hooks/useRealtimeMovimientos";

type ActivityItem = RealtimeMovementEvent & { receivedAt: number };

function eventTitle(event: RealtimeMovementEvent) {
  const action = String(event.accion ?? "").replaceAll("_", " ").trim();
  const entity = event.arrastreId
    ? `Arrastre #${event.arrastreId}`
    : event.movimientoId
      ? `Movimiento #${event.movimientoId}`
      : event.incidenteId
        ? `Incidente #${event.incidenteId}`
        : "Operacion";
  return action ? `${entity}: ${action}` : `${entity} actualizado`;
}

export default function RealtimeActivityCenter() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<ActivityItem | null>(null);

  useEffect(() => {
    const onRealtimeEvent = (raw: Event) => {
      const event = (raw as CustomEvent<RealtimeMovementEvent>).detail;
      const type = String(event?.type ?? "");
      if (!event || type.startsWith("realtime.")) return;
      const item = { ...event, receivedAt: Date.now() };
      setItems((current) => [item, ...current.filter((entry) => entry.eventId !== item.eventId)].slice(0, 30));
      if (!type.includes("incidente")) setToast(item);
    };
    window.addEventListener("cosaif:realtime-event", onRealtimeEvent);
    return () => window.removeEventListener("cosaif:realtime-event", onRealtimeEvent);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4_500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const unread = useMemo(() => Math.min(items.length, 99), [items.length]);

  return (
    <>
      {toast ? (
        <button
          type="button"
          onClick={() => { setOpen(true); setToast(null); }}
          className="fixed right-4 top-4 z-[70] max-w-sm rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3 text-left text-sm text-[var(--app-text)] shadow-[var(--app-shadow-md)]"
        >
          <span className="block text-xs font-bold text-[var(--app-accent)]">Actualizacion en tiempo real</span>
          <span className="mt-1 block">{eventTitle(toast)}</span>
        </button>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="fixed bottom-4 left-4 z-[55] inline-flex h-10 items-center gap-2 rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-xs font-bold text-[var(--app-text-muted)] shadow-[var(--app-shadow-sm)] hover:bg-[var(--app-surface-muted)] md:left-[296px]"
        aria-label="Abrir actividad en tiempo real"
      >
        <Activity className="h-4 w-4 text-[var(--app-accent)]" />
        Actividad
        {unread ? <span className="rounded-full bg-[var(--app-accent-soft)] px-1.5 text-[10px] text-[var(--app-accent)]">{unread}</span> : null}
      </button>

      {open ? (
        <aside className="fixed bottom-16 left-4 z-[60] max-h-[min(70vh,520px)] w-[min(92vw,380px)] overflow-hidden rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] shadow-[var(--app-shadow-md)] md:left-[296px]">
          <header className="flex items-center justify-between border-b border-[var(--app-border)] px-4 py-3">
            <div>
              <p className="text-sm font-bold text-[var(--app-text)]">Actividad reciente</p>
              <p className="text-xs text-[var(--app-text-muted)]">Eventos de esta sesion</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="rounded-md p-2 hover:bg-[var(--app-surface-muted)]" aria-label="Cerrar actividad">
              <X className="h-4 w-4" />
            </button>
          </header>
          <div className="max-h-[430px] overflow-y-auto p-2">
            {items.length ? items.map((item, index) => (
              <div key={item.eventId ?? `${item.type}-${index}`} className="border-b border-[var(--app-border)] px-2 py-3 last:border-0">
                <p className="text-sm font-semibold text-[var(--app-text)]">{eventTitle(item)}</p>
                <p className="mt-1 text-xs text-[var(--app-text-muted)]">{new Date(item.receivedAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</p>
              </div>
            )) : <p className="p-6 text-center text-sm text-[var(--app-text-muted)]">Aun no hay actividad.</p>}
          </div>
        </aside>
      ) : null}
    </>
  );
}
