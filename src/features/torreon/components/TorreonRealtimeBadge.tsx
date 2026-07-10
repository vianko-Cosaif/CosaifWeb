"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, Wifi, WifiOff } from "lucide-react";
import type { RealtimeConnectionStatus } from "@/app/hooks/useRealtimeMovimientos";
import { realtimeStatusLabel } from "@/features/torreon/realtime";

export function TorreonRealtimeBadge({ status }: { status: RealtimeConnectionStatus }) {
  const [lastEventAt, setLastEventAt] = useState<number | null>(null);
  const [, setClock] = useState(0);
  const connected = status === "connected";
  const connecting = status === "connecting";
  const Icon = connected ? Wifi : connecting ? LoaderCircle : WifiOff;

  useEffect(() => {
    const onEvent = () => setLastEventAt(Date.now());
    window.addEventListener("cosaif:realtime-event", onEvent);
    const timer = window.setInterval(() => setClock((value) => value + 1), 15_000);
    return () => {
      window.removeEventListener("cosaif:realtime-event", onEvent);
      window.clearInterval(timer);
    };
  }, []);

  const secondsAgo = lastEventAt ? Math.floor((Date.now() - lastEventAt) / 1_000) : null;
  const activityLabel = secondsAgo == null ? "" : secondsAgo < 60 ? " · ahora" : ` · ${Math.floor(secondsAgo / 60)} min`;

  return (
    <span
      role="status"
      className={`inline-flex h-9 items-center gap-2 rounded-md border px-3 text-xs font-bold ${
        connected
          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-300"
          : connecting
            ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/35 dark:text-amber-300"
            : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/35 dark:text-rose-300"
      }`}
    >
      <Icon className={`h-3.5 w-3.5 ${connecting ? "animate-spin" : ""}`} aria-hidden />
      {realtimeStatusLabel(status)}{connected ? activityLabel : ""}
    </span>
  );
}
