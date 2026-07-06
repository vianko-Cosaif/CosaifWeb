import { AlertTriangle, CheckCircle2, Clock3, PauseCircle, TrainFront, Wrench } from "lucide-react";
import type { TornoHistoryItem } from "../../lib/types";
import { cn } from "../../lib/tornoFormat";

type SummaryCard = {
  label: string;
  value: number;
  icon: typeof Clock3;
  className: string;
};

export default function TornoSummaryCards({ items }: { items: TornoHistoryItem[] }) {
  const cards: SummaryCard[] = [
    {
      label: "Solicitados",
      value: countStatus(items, "SOLICITADO"),
      icon: Clock3,
      className: "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-200 dark:bg-amber-950/30 dark:border-amber-900",
    },
    {
      label: "En proceso",
      value: countStatus(items, "EN_PROCESO"),
      icon: Wrench,
      className: "text-sky-700 bg-sky-50 border-sky-200 dark:text-sky-200 dark:bg-sky-950/30 dark:border-sky-900",
    },
    {
      label: "Detenidos",
      value: countStatus(items, "DETENIDO"),
      icon: PauseCircle,
      className: "text-rose-700 bg-rose-50 border-rose-200 dark:text-rose-200 dark:bg-rose-950/30 dark:border-rose-900",
    },
    {
      label: "Concluidos",
      value: countStatus(items, "CONCLUIDO"),
      icon: CheckCircle2,
      className: "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900",
    },
    {
      label: "Ruedas activas",
      value: items.reduce((sum, item) => sum + activeWheels(item), 0),
      icon: TrainFront,
      className: "text-indigo-700 bg-indigo-50 border-indigo-200 dark:text-indigo-200 dark:bg-indigo-950/30 dark:border-indigo-900",
    },
    {
      label: "Incidentes",
      value: items.reduce((sum, item) => sum + (item.activeIncidents ?? 0), 0),
      icon: AlertTriangle,
      className: "text-orange-700 bg-orange-50 border-orange-200 dark:text-orange-200 dark:bg-orange-950/30 dark:border-orange-900",
    },
  ];

  return (
    <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className={cn(
              "min-h-24 rounded-lg border bg-white p-3 shadow-sm shadow-slate-200/60 dark:shadow-none",
              card.className,
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <span className="text-[11px] font-black uppercase tracking-wide opacity-80">
                {card.label}
              </span>
              <Icon className="h-4 w-4 shrink-0" />
            </div>
            <div className="mt-3 text-3xl font-black leading-none text-slate-950 dark:text-white">
              {card.value}
            </div>
          </div>
        );
      })}
    </section>
  );
}

function countStatus(items: TornoHistoryItem[], status: string) {
  return items.filter((item) => String(item.status).toUpperCase() === status).length;
}

function activeWheels(item: TornoHistoryItem) {
  const wheels = item.work?.wheels ?? [];
  return wheels.filter((wheel) => ["PENDIENTE", "EN_PROCESO", "PAUSADO"].includes(String(wheel.status).toUpperCase())).length;
}
