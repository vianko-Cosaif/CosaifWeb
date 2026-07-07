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
import { KpiCard, type KpiTone } from "@/app/Components/ui";
import type { ArrastreStats } from "../types";

type StatusStripItem = {
  label: string;
  value: number;
  tone: KpiTone;
  icon: LucideIcon;
};

export default function ArrastreStatusStrip({ stats }: { stats: ArrastreStats }) {
  const items: StatusStripItem[] = [
    { label: "Solicitados", value: stats.solicitados, tone: "neutral", icon: ClipboardList },
    { label: "En proceso", value: stats.proceso, tone: "info", icon: LoaderCircle },
    { label: "Detenidos", value: stats.detenidos, tone: "warning", icon: PauseCircle },
    { label: "Concluidos", value: stats.concluidos, tone: "success", icon: CheckCircle2 },
    { label: "Cancelados", value: stats.cancelados, tone: "danger", icon: XCircle },
    { label: "Vagones activos", value: stats.vagonesPendientes, tone: "indigo", icon: Boxes },
    { label: "Incidentes", value: stats.incidentesAbiertos, tone: "warning", icon: AlertTriangle },
  ];

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
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
