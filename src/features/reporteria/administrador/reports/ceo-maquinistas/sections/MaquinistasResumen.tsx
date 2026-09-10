"use client";

import React from "react";
import type { Kpis } from "../../../lib/types";
import { fmtMaybeDec, fmtMaybeInt } from "../../../lib/utils";
import KpiCard from "../../../components/KpiCard";
import SectionTitle from "../../../components/SectionTitle";

export default function MaquinistasResumen({ kpis }: { kpis: Kpis }) {
  return (
    <div className="space-y-4">
      <SectionTitle title="Resumen operativo" subtitle="KPI clave por maquinistas" />
      <section className="grid grid-cols-12 gap-4">
        <div className="col-span-12 md:col-span-4 xl:col-span-3">
          <KpiCard title="Total movimientos" value={fmtMaybeInt(kpis.totalMovimientos)} accent="indigo" />
        </div>
        <div className="col-span-12 md:col-span-4 xl:col-span-3">
          <KpiCard title="Incidentes" value={fmtMaybeInt(kpis.totalIncidentes)} accent="rose" />
        </div>
        <div className="col-span-12 md:col-span-4 xl:col-span-3">
          <KpiCard title="Críticos" value={fmtMaybeInt(kpis.criticosTotal)} accent="amber" />
        </div>
        <div className="col-span-12 md:col-span-4 xl:col-span-3">
          <KpiCard title="Cancelados" value={fmtMaybeInt(kpis.cancelados)} accent="rose" />
        </div>
        <div className="col-span-12 md:col-span-4 xl:col-span-3">
          <KpiCard title="Exec media (min)" value={fmtMaybeDec(kpis.execMeanMin)} accent="sky" />
        </div>
        <div className="col-span-12 md:col-span-4 xl:col-span-3">
          <KpiCard title="Exec P90 (min)" value={fmtMaybeDec(kpis.execP90Min)} accent="amber" />
        </div>
      </section>
    </div>
  );
}
