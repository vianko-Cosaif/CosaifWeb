"use client";

import { useState } from "react";
import { Boxes, TrainFront } from "lucide-react";
import TorreonArrastresPanel from "./TorreonArrastresPanel";
import TorreonNaturalesPanel from "./TorreonNaturalesPanel";

type Props = {
  apiBase: string;
  token: string;
  empresaIdUsuario: number | null;
  localidadIdUsuario: number;
};

type Tab = "naturales" | "arrastres";

export default function CoordinatorTorreonMovimientos({
  localidadIdUsuario,
}: Props) {
  const [tab, setTab] = useState<Tab>("naturales");

  return (
    <section className="w-full min-h-screen overflow-x-hidden">
      <div className="mx-auto w-full max-w-[1500px] px-3 py-3 sm:px-4 lg:px-6">
        <div className="mb-4 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Torreon</p>
              <h1 className="mt-1 text-2xl font-bold text-slate-950">Movimientos</h1>
            </div>
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setTab("naturales")}
                className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-bold transition ${
                  tab === "naturales"
                    ? "bg-white text-slate-950 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <TrainFront className="h-4 w-4" />
                Naturales
              </button>
              <button
                type="button"
                onClick={() => setTab("arrastres")}
                className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-bold transition ${
                  tab === "arrastres"
                    ? "bg-white text-slate-950 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <Boxes className="h-4 w-4" />
                Arrastres
              </button>
            </div>
          </div>
        </div>

        {tab === "naturales" ? (
          <TorreonNaturalesPanel localidadId={localidadIdUsuario} />
        ) : (
          <TorreonArrastresPanel localidadId={localidadIdUsuario} variant="movimientos" />
        )}
      </div>
    </section>
  );
}
