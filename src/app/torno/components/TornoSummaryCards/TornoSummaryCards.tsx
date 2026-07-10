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
      className: "text-amber-700 border-amber-300 dark:text-amber-300 dark:border-amber-800",
    },
    {
      label: "En proceso",
      value: countStatus(items, "EN_PROCESO"),
      icon: Wrench,
      className: "text-sky-700 border-sky-300 dark:text-sky-300 dark:border-sky-800",
    },
    {
      label: "Detenidos",
      value: countStatus(items, "DETENIDO"),
      icon: PauseCircle,
      className: "text-rose-700 border-rose-300 dark:text-rose-300 dark:border-rose-800",
    },
    {
      label: "Concluidos",
      value: countStatus(items, "CONCLUIDO"),
      icon: CheckCircle2,
      className: "text-emerald-700 border-emerald-300 dark:text-emerald-300 dark:border-emerald-800",
    },
    {
      label: "Ruedas activas",
      value: items.reduce((sum, item) => sum + activeWheels(item), 0),
      icon: TrainFront,
      className: "text-indigo-700 border-indigo-300 dark:text-indigo-300 dark:border-indigo-800",
    },
    {
      label: "Incidentes",
      value: items.reduce((sum, item) => sum + (item.activeIncidents ?? 0), 0),
      icon: AlertTriangle,
      className: "text-orange-700 border-orange-300 dark:text-orange-300 dark:border-orange-800",
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
              "min-h-24 rounded-lg border bg-[var(--app-surface)] p-3 shadow-[var(--app-shadow-sm)]",
              card.className,
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <span className="text-[11px] font-black uppercase tracking-wide opacity-80">
                {card.label}
              </span>
              <Icon className="h-4 w-4 shrink-0" />
            </div>
            <div className="mt-3 text-3xl font-black leading-none text-[var(--app-text)]">
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
