"use client";

import React from "react";
import ConfigurableTable from "../../../components/ConfigurableTable";
import SectionTitle from "../../../components/SectionTitle";
import { fmtMaybeInt, fmtMaybePct } from "../../../lib/utils";

type Segmento = {
  key?: string;
  nombre?: string;
  totalMovimientos?: number;
  conInicioFin?: number;
  okPct?: number;
  incidentesTotal?: number;
  criticosTotal?: number;
  cancelados?: number;
  canceladosConIncidente?: number;
};

export default function CumplimientoSegmentacion({
  porEmpresa,
  porLocalidad,
  porTurno,
}: {
  porEmpresa: Segmento[];
  porLocalidad: Segmento[];
  porTurno: Segmento[];
}) {
  const columns: { key: keyof Segmento; label: string; format?: (v: any, row: Segmento) => string }[] = [
    { key: "nombre", label: "Nombre" },
    { key: "totalMovimientos", label: "Mov", format: (v: any) => fmtMaybeInt(v) },
    { key: "conInicioFin", label: "Con fin", format: (v: any) => fmtMaybeInt(v) },
    { key: "okPct", label: "OK %", format: (v: any) => fmtMaybePct(v) },
    { key: "incidentesTotal", label: "Inc", format: (v: any) => fmtMaybeInt(v) },
    { key: "criticosTotal", label: "Crit", format: (v: any) => fmtMaybeInt(v) },
    { key: "cancelados", label: "Canc", format: (v: any) => fmtMaybeInt(v) },
    { key: "canceladosConIncidente", label: "Canc+Inc", format: (v: any) => fmtMaybeInt(v) },
  ];

  return (
    <div className="space-y-6">
      <SectionTitle title="Segmentación Operativa" subtitle="Desempeño por empresa, localidad y turno" />

      <section className="grid grid-cols-12 gap-4">
        <div className="col-span-12 xl:col-span-6">
          <ConfigurableTable
            title="Por empresa"
            subtitle="Cumplimiento por empresa"
            data={porEmpresa}
            accent="emerald"
            highlightKey="okPct"
            storageKey="ceo-cumplimiento:empresa"
            defaultSortKey="okPct"
            columns={columns}
          />
        </div>
        <div className="col-span-12 xl:col-span-6">
          <ConfigurableTable
            title="Por localidad"
            subtitle="Cumplimiento por localidad"
            data={porLocalidad}
            accent="sky"
            highlightKey="okPct"
            storageKey="ceo-cumplimiento:localidad"
            defaultSortKey="okPct"
            columns={columns}
          />
        </div>
      </section>

      <section className="grid grid-cols-12 gap-4">
        <div className="col-span-12">
          <ConfigurableTable
            title="Por turno"
            subtitle="Cumplimiento por turno operativo"
            data={porTurno}
            accent="amber"
            highlightKey="okPct"
            storageKey="ceo-cumplimiento:turno"
            defaultSortKey="okPct"
            columns={columns}
          />
        </div>
      </section>
    </div>
  );
}
