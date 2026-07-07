"use client";

import { useState } from "react";
import { Boxes, LayoutGrid, TrainFront } from "lucide-react";
import TorreonArrastresPanel from "./TorreonArrastresPanel";
import TorreonNaturalesPanel from "./TorreonNaturalesPanel";

type Props = {
  apiBase: string;
  token: string;
  empresaIdUsuario: number | null;
  localidadIdUsuario: number;
};

type Tab = "general" | "naturales" | "arrastres";

const TABS: Array<{ value: Tab; label: string; icon: typeof LayoutGrid }> = [
  { value: "general", label: "General", icon: LayoutGrid },
  { value: "naturales", label: "Movimientos", icon: TrainFront },
  { value: "arrastres", label: "Arrastres", icon: Boxes },
];

export default function CoordinatorTorreonMovimientos({
  localidadIdUsuario,
}: Props) {
  const [tab, setTab] = useState<Tab>("general");
  const showNaturales = tab === "general" || tab === "naturales";
  const showArrastres = tab === "general" || tab === "arrastres";

  return (
    <section className="w-full min-h-screen overflow-x-hidden">
      <div className="mx-auto w-full max-w-[1500px] px-3 py-3 sm:px-4 lg:px-6">
        <div className="mb-4 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Torreon</p>
              <h1 className="mt-1 text-2xl font-bold text-slate-950 dark:text-white">Movimientos</h1>
            </div>
            <div className="grid grid-cols-3 gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800">
              {TABS.map((item) => {
                const Icon = item.icon;
                const active = tab === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setTab(item.value)}
                    className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-black transition ${
                      active
                        ? "bg-slate-950 text-white shadow-sm dark:bg-white dark:text-slate-950"
                        : "text-slate-500 hover:bg-white hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-5">
          {showNaturales && <TorreonNaturalesPanel localidadId={localidadIdUsuario} />}
          {showArrastres && <TorreonArrastresPanel localidadId={localidadIdUsuario} variant="movimientos" />}
        </div>
      </div>
    </section>
  );
}
