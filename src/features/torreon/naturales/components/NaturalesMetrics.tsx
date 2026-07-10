import { AlertTriangle, Camera, CheckCircle2, Clock3, Timer, TrainFront } from "lucide-react";
import type { NaturalesMetrics as NaturalesMetricsValue } from "../types";
import { formatMinutes } from "../utils";

export function NaturalesMetrics({ metrics, compact = false }: { metrics: NaturalesMetricsValue; compact?: boolean }) {
  const items = compact
    ? [
        { label: "En cola", value: metrics.active, icon: Clock3 },
        { label: "En proceso", value: metrics.process, icon: TrainFront },
        { label: "Con incidente", value: metrics.withIncidents, icon: AlertTriangle },
        { label: "Con evidencias", value: metrics.withPhotos, icon: Camera },
      ]
    : [
        { label: "Activos", value: metrics.active, icon: Clock3 },
        { label: "En proceso", value: metrics.process, icon: TrainFront },
        { label: "Concluidos", value: metrics.done, icon: CheckCircle2 },
        { label: "Con evidencias", value: metrics.withPhotos, icon: Camera },
        { label: "Con incidente", value: metrics.withIncidents, icon: AlertTriangle },
        { label: "Resolución prom.", value: formatMinutes(metrics.avg), icon: Timer },
      ];

  return (
    <div className={`mt-4 grid gap-2 sm:grid-cols-2 ${compact ? "xl:grid-cols-4" : "xl:grid-cols-6"}`}>
      {items.map((item) => <Metric key={item.label} {...item} />)}
    </div>
  );
}

function Metric({ label, value, icon: Icon }: { label: string; value: number | string; icon: typeof Clock3 }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/40">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-1 text-2xl font-black text-slate-950 dark:text-white">{value}</p>
        </div>
        <Icon className="h-5 w-5 text-emerald-600" />
      </div>
    </div>
  );
}
