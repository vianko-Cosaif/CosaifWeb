"use client";

import { useState } from "react";
import { Boxes, LayoutGrid, TrainFront } from "lucide-react";
import { DynamicBanner } from "@/app/Components/DynamicBanner";
import RailQueueBoard from "../RailQueueBoard";
import TorreonArrastresPanel from "./TorreonArrastresPanel";

type ViewMode = "general" | "arrastres" | "naturales";

const VIEW_OPTIONS: Array<{ value: ViewMode; label: string; icon: typeof LayoutGrid }> = [
  { value: "general", label: "General", icon: LayoutGrid },
  { value: "arrastres", label: "Arrastres", icon: Boxes },
  { value: "naturales", label: "Movimientos", icon: TrainFront },
];

export default function CoordinatorTorreonDashboard({
  localidadId,
  showBanner = true,
}: {
  localidadId: number;
  showBanner?: boolean;
}) {
  const [view, setView] = useState<ViewMode>("general");
  const showArrastres = view === "general" || view === "arrastres";
  const showNaturales = view === "general" || view === "naturales";

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-6 sm:space-y-8 min-w-0">
      {showBanner && <DynamicBanner />}

      <div className="rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Torreón</p>
            <h1 className="mt-1 text-2xl font-black text-slate-950 dark:text-white">Operación del patio</h1>
          </div>
          <div className="grid grid-cols-3 gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800">
            {VIEW_OPTIONS.map((option) => {
              const Icon = option.icon;
              const active = view === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setView(option.value)}
                  className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-black transition ${
                    active
                      ? "bg-slate-950 text-white shadow-sm dark:bg-white dark:text-slate-950"
                      : "text-slate-500 hover:bg-white hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {showArrastres && <TorreonArrastresPanel localidadId={localidadId} variant="dashboard" />}

      {showNaturales && <section className="space-y-3">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Torreón</p>
          <h2 className="text-xl font-bold text-slate-950 dark:text-white">Movimientos del patio</h2>
        </div>
        <RailQueueBoard localidadId={localidadId} />
      </section>}
    </div>
  );
}
