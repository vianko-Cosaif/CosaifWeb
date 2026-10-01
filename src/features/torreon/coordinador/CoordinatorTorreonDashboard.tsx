"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, MapPin } from "lucide-react";
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
  rol?: "ADMINISTRADOR" | "COORDINADOR" | "SUPERVISOR";
}) {
  const [view, setView] = useState<TorreonOperationView>("naturales");
  const area = rol.toLowerCase();

  return (
    <div className={s.workspace}>
      <header className={s.pageHeader}>
        <div>
          <p className={s.eyebrow}>
            <MapPin size={16} aria-hidden /> Torreón · {rol.toLowerCase()}
          </p>
          <h1 className={s.title}>Operación de Torreón</h1>
        </div>
        <Link className={s.button} href={`/${area}/movimientos?tipo=${view}`}>
          Abrir movimientos <ArrowUpRight size={16} aria-hidden />
        </Link>
      </header>
      <div className={s.sectionSwitch}>
        <TorreonOperationTabs value={view} onChange={setView} />
      </div>

      {view === "arrastres" ? (
        <TorreonArrastresPanel localidadId={localidadId} variant="dashboard" rol={rol} />
      ) : null}

      {view === "naturales" ? (
        <TorreonNaturalesPanel localidadId={localidadId} variant="dashboard" rol={rol} />
      ) : null}
    </div>
  );
}
