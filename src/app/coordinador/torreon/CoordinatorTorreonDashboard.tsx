"use client";

import { useState } from "react";
import { DynamicBanner } from "@/app/Components/DynamicBanner";
import {
  TorreonOperationTabs,
  type TorreonOperationView,
} from "@/features/torreon/components/TorreonOperationTabs";
import TorreonArrastresPanel from "./TorreonArrastresPanel";
import TorreonNaturalesPanel from "./TorreonNaturalesPanel";

export default function CoordinatorTorreonDashboard({
  localidadId,
  showBanner = true,
}: {
  localidadId: number;
  showBanner?: boolean;
}) {
  const [view, setView] = useState<TorreonOperationView>("general");
  const showArrastres = view === "general" || view === "arrastres";
  const showNaturales = view === "general" || view === "naturales";

  return (
    <div className="mx-auto w-full max-w-[1500px] min-w-0 space-y-4">
      {showBanner && <DynamicBanner />}

      <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Torreón</p>
            <h1 className="mt-1 text-2xl font-black text-slate-950 dark:text-white">Operación del patio</h1>
          </div>
          <TorreonOperationTabs value={view} onChange={setView} />
        </div>
      </div>

      {showArrastres && <TorreonArrastresPanel localidadId={localidadId} variant="dashboard" />}

      {showNaturales && (
        <TorreonNaturalesPanel localidadId={localidadId} variant="dashboard" />
      )}
    </div>
  );
}
