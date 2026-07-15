"use client";

import { useState } from "react";
import { Eye, Radio } from "lucide-react";
import {
  TorreonOperationTabs,
  type TorreonOperationView,
} from "@/features/torreon/components/TorreonOperationTabs";
import TorreonArrastresPanel from "./TorreonArrastresPanel";
import TorreonNaturalesPanel from "./TorreonNaturalesPanel";

export default function CoordinatorTorreonDashboard({
  localidadId,
  rol = "COORDINADOR",
}: {
  localidadId: number;
  showBanner?: boolean;
  rol?: "ADMINISTRADOR" | "COORDINADOR";
}) {
  const [view, setView] = useState<TorreonOperationView>("general");
  const isAdmin = rol === "ADMINISTRADOR";

  return (
    <div className="mx-auto w-full max-w-[1500px] min-w-0 space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
              {isAdmin ? <Eye className="h-4 w-4" aria-hidden /> : <Radio className="h-4 w-4" aria-hidden />}
              Torreón · {isAdmin ? "Supervisión" : "Coordinación"}
            </p>
            <h1 className="mt-1 text-2xl font-black text-slate-950 dark:text-white">Operación del patio</h1>
            <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
              {isAdmin
                ? "Detecta bloqueos y entra al detalle solo cuando sea necesario."
                : "Consulta la cola y atiende la siguiente operación del patio."}
            </p>
          </div>
          <TorreonOperationTabs value={view} onChange={setView} />
        </div>
      </div>

      {view === "general" ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <TorreonNaturalesPanel
            localidadId={localidadId}
            variant="summary"
            rol={rol}
            onOpen={() => setView("naturales")}
          />
          <TorreonArrastresPanel
            localidadId={localidadId}
            variant="summary"
            rol={rol}
            onOpen={() => setView("arrastres")}
          />
        </div>
      ) : null}

      {view === "arrastres" ? <TorreonArrastresPanel localidadId={localidadId} variant="dashboard" rol={rol} /> : null}

      {view === "naturales" ? (
        <TorreonNaturalesPanel localidadId={localidadId} variant="dashboard" rol={rol} />
      ) : null}
    </div>
  );
}
