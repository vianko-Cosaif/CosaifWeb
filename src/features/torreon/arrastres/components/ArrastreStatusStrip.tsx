"use client";

import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  ClipboardList,
  LoaderCircle,
  PauseCircle,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import KpiCard, { type KpiTone } from "@/app/Components/ui/KpiCard";
import type { ArrastreStats } from "../types";

type StatusStripItem = {
  label: string;
  value: number;
  tone: KpiTone;
  icon: LucideIcon;
};

export default function ArrastreStatusStrip({ stats, operational = false }: { stats: ArrastreStats; operational?: boolean }) {
  const allItems: StatusStripItem[] = [
    { label: "En espera", value: stats.solicitados, tone: "neutral", icon: ClipboardList },
    { label: "En movimiento", value: stats.proceso, tone: "info", icon: LoaderCircle },
    { label: "Pausados", value: stats.detenidos, tone: "warning", icon: PauseCircle },
    { label: "Finalizados", value: stats.concluidos, tone: "success", icon: CheckCircle2 },
    { label: "Cancelados", value: stats.cancelados, tone: "danger", icon: XCircle },
    { label: "Vagones por mover", value: stats.vagonesPendientes, tone: "indigo", icon: Boxes },
    { label: "Requieren atención", value: stats.incidentesAbiertos, tone: "warning", icon: AlertTriangle },
  ];
  const items = operational
    ? [allItems[0], allItems[1], allItems[2], allItems[5], allItems[6]]
    : [allItems[0], allItems[1], allItems[2], allItems[3], allItems[6]];

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {items.map((item) => (
        <KpiCard
          key={item.label}
          label={item.label}
          value={item.value}
          icon={item.icon}
          tone={item.tone}
          compact
          className="min-h-[76px]"
        />
      ))}
    </div>
  );
}
