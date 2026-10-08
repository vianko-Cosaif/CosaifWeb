"use client";
import { useEffect, useState } from "react";
import { shouldUseIncidentCountdown } from "@/lib/incidentCountdownPolicy";
import type { RondaMovement } from "../types";

export default function RoundIncidentTimer({ incident }: { incident?: RondaMovement["incidenteActivo"] }) {
  const [now, setNow] = useState<number | null>(null);
  const start = Date.parse(incident?.fechaInicio ?? "");
  const active = shouldUseIncidentCountdown(incident) && incident?.estado === "ABIERTO" && Number.isFinite(start);
  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(Date.now());
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [active, start]);
  if (!active) return null;
  const seconds = now == null ? null : Math.max(0, Math.floor((now - start) / 1000));
  const clock = seconds == null ? "—" : `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
  return <p className="mt-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
    Incidente #{incident!.id} · {clock} transcurridos
    {seconds != null && seconds >= 600 && <span className="block">Tiempo vencido · actualizando ronda…</span>}
  </p>;
}
