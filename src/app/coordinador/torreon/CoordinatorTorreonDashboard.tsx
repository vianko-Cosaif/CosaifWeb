"use client";

import { DynamicBanner } from "@/app/Components/DynamicBanner";
import RailQueueBoard from "../RailQueueBoard";
import TorreonArrastresPanel from "./TorreonArrastresPanel";

export default function CoordinatorTorreonDashboard({ localidadId }: { localidadId: number }) {
  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-6 sm:space-y-8 min-w-0">
      <DynamicBanner />

      <TorreonArrastresPanel localidadId={localidadId} variant="dashboard" />

      <section className="space-y-3">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Torreon</p>
          <h2 className="text-xl font-bold text-slate-950">Movimientos naturales</h2>
        </div>
        <RailQueueBoard localidadId={localidadId} />
      </section>
    </div>
  );
}
