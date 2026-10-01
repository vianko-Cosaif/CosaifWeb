"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, Network, Radio, RefreshCw, Server } from "lucide-react";

type RealtimeStats = {
  clients?: number;
  sseClients?: number;
  websocketClients?: number;
  pendingWsTickets?: number;
  events?: { published?: number; delivered?: number; suppressed?: number };
  bus?: { enabled?: boolean; connected?: boolean; published?: number; received?: number; lastError?: string | null };
};

export function RealtimeHealthPanel() {
  const [stats, setStats] = useState<RealtimeStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/passthrough/realtime/stats", { credentials: "include", cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "No se pudo consultar realtime");
      setStats(payload?.realtime ?? null);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Realtime no disponible");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(load, 15_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const busLabel = !stats?.bus?.enabled ? "Local" : stats.bus.connected ? "Redis conectado" : "Redis desconectado";

  return (
    <section className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-[var(--app-shadow-sm)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase text-[var(--app-accent)]">Infraestructura</p>
          <h2 className="text-lg font-bold text-[var(--app-text)]">Salud del tiempo real</h2>
        </div>
        <button type="button" onClick={load} disabled={loading} className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--app-border)] px-3 text-xs font-bold text-[var(--app-text-muted)] hover:bg-[var(--app-surface-muted)]">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Actualizar
        </button>
      </div>

      {error ? <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300">{error}</p> : null}

      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <HealthMetric icon={Radio} label="Conexiones" value={stats?.clients ?? 0} detail={`${stats?.websocketClients ?? 0} WS · ${stats?.sseClients ?? 0} SSE`} />
        <HealthMetric icon={Activity} label="Eventos entregados" value={stats?.events?.delivered ?? 0} detail={`${stats?.events?.suppressed ?? 0} duplicados evitados`} />
        <HealthMetric icon={Network} label="Bus" value={busLabel} detail={`${stats?.bus?.published ?? 0} enviados · ${stats?.bus?.received ?? 0} recibidos`} />
        <HealthMetric icon={Server} label="Tickets pendientes" value={stats?.pendingWsTickets ?? 0} detail="Expiran automaticamente" />
      </div>
    </section>
  );
}

function HealthMetric({ icon: Icon, label, value, detail }: { icon: typeof Activity; label: string; value: string | number; detail: string }) {
  return (
    <div className="rounded-md border border-[var(--app-border)] bg-[var(--app-surface-subtle)] p-3">
      <div className="flex items-center gap-2 text-xs font-bold text-[var(--app-text-muted)]"><Icon className="h-4 w-4 text-[var(--app-accent)]" />{label}</div>
      <p className="mt-2 text-xl font-black text-[var(--app-text)]">{value}</p>
      <p className="mt-1 text-xs text-[var(--app-text-soft)]">{detail}</p>
    </div>
  );
}
