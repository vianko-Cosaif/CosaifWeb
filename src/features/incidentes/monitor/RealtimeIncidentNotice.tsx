"use client";

import { Activity, AlertTriangle } from "lucide-react";
import styles from "./RealtimeIncidentNotice.module.css";

export type RealtimeIncidentNotice = {
  id: string;
  title: string;
  description: string;
  tone: "emerald" | "sky" | "rose" | "amber";
  icon: "movement" | "incident";
};

const toneClasses = {
  emerald: "border-emerald-200 text-emerald-800 dark:border-emerald-800 dark:text-emerald-200",
  sky: "border-sky-200 text-sky-800 dark:border-sky-800 dark:text-sky-200",
  amber: "border-amber-200 text-amber-800 dark:border-amber-800 dark:text-amber-200",
  rose: "border-rose-200 text-rose-800 dark:border-rose-800 dark:text-rose-200",
};

export default function RealtimeNotice({ notice }: { notice: RealtimeIncidentNotice }) {
  const Icon = notice.icon === "incident" ? AlertTriangle : Activity;
  return (
    <div
      role="status"
      className={`${styles.notice} fixed right-4 top-4 z-[1060] w-[min(92vw,360px)] rounded-xl border bg-white/95 p-3 shadow-xl backdrop-blur dark:bg-zinc-900/95 ${toneClasses[notice.tone]}`}
    >
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0">
          <div className="text-sm font-bold">{notice.title}</div>
          <div className="truncate text-xs opacity-80">{notice.description}</div>
        </div>
      </div>
    </div>
  );
}
