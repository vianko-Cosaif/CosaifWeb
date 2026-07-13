"use client";

import { useState } from "react";
import {
  TorreonOperationTabs,
  type TorreonOperationView,
} from "@/features/torreon/components/TorreonOperationTabs";
import TorreonArrastresPanel from "./TorreonArrastresPanel";
import TorreonNaturalesPanel from "./TorreonNaturalesPanel";

type Props = {
  apiBase: string;
  token: string;
  empresaIdUsuario: number | null;
  localidadIdUsuario: number;
};

export default function CoordinatorTorreonMovimientos({
  localidadIdUsuario,
}: Props) {
  const [tab, setTab] = useState<Exclude<TorreonOperationView, "general">>("naturales");

  return (
    <section className="w-full min-h-screen overflow-x-hidden">
      <div className="mx-auto w-full max-w-[1500px] px-3 py-3 sm:px-4 lg:px-6">
        <div className="mb-3 flex justify-end">
          <TorreonOperationTabs
            value={tab}
            includeGeneral={false}
            compact
            onChange={(next) => {
              if (next !== "general") setTab(next);
            }}
          />
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
