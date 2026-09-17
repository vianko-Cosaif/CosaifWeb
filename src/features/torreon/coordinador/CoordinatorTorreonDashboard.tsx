"use client";

import { useState } from "react";
import { Eye, Radio } from "lucide-react";
import {
  TorreonOperationTabs,
  type TorreonOperationView,
} from "@/features/torreon/components/TorreonOperationTabs";
import s from "../presentation/rail.module.scss";
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
    <div className={s.workspace}>
      <header className={s.pageHeader}>
        <div>
          <p className={s.eyebrow}>
            {isAdmin ? <Eye size={16} aria-hidden /> : <Radio size={16} aria-hidden />}Torreón ·{" "}
            {isAdmin ? "Supervisión" : "Coordinación"}
          </p>
          <h1 className={s.title}>Operación del patio</h1>
          <p className={s.subtitle}>
            Rondas, locomotoras y vagones. Toda la operación de tu localidad, conectada.
          </p>
        </div>
      </header>
      <TorreonOperationTabs value={view} onChange={setView} />
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

      {view === "arrastres" ? (
        <TorreonArrastresPanel localidadId={localidadId} variant="dashboard" rol={rol} />
      ) : null}

      {view === "naturales" ? (
        <TorreonNaturalesPanel localidadId={localidadId} variant="dashboard" rol={rol} />
      ) : null}
    </div>
  );
}
