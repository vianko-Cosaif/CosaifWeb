"use client";

import React from "react";
import ConfigurableTable from "../../../components/ConfigurableTable";
import SectionTitle from "../../../components/SectionTitle";
import { fmtMaybeDec, fmtMaybeInt, fmtMaybePct } from "../../../lib/utils";

type OperadorRow = {
  operadorId?: number;
  operadorNombre?: string;
  totalMovimientos?: number;
  conInicioFin?: number;
  execMeanMin?: number;
  execP90Min?: number;
  okPct?: number;
  criticosTotal?: number;
  incidentesTotal?: number;
  cancelados?: number;
  canceladosConIncidente?: number;
};

type Grupo = {
  key?: string;
  nombre?: string;
  operadores?: OperadorRow[];
};

const columns: { key: keyof OperadorRow; label: string; format?: (v: any, row: OperadorRow) => string }[] = [
  { key: "operadorNombre", label: "Operador" },
  { key: "totalMovimientos", label: "Mov", format: (v: any) => fmtMaybeInt(v) },
  { key: "conInicioFin", label: "Con fin", format: (v: any) => fmtMaybeInt(v) },
  { key: "execMeanMin", label: "Media", format: (v: any) => fmtMaybeDec(v) },
  { key: "execP90Min", label: "P90", format: (v: any) => fmtMaybeDec(v) },
  { key: "okPct", label: "OK %", format: (v: any) => fmtMaybePct(v) },
  { key: "criticosTotal", label: "Crit", format: (v: any) => fmtMaybeInt(v) },
  { key: "incidentesTotal", label: "Inc", format: (v: any) => fmtMaybeInt(v) },
  { key: "cancelados", label: "Canc", format: (v: any) => fmtMaybeInt(v) },
  { key: "canceladosConIncidente", label: "Canc+Inc", format: (v: any) => fmtMaybeInt(v) },
];

export default function MaquinistasAgrupadosSection({
  porEmpresa,
  porLocalidad,
}: {
  porEmpresa: Grupo[];
  porLocalidad: Grupo[];
}) {
  return (
    <div className="space-y-6">
      <SectionTitle title="Maquinistas por grupo" subtitle="Desglose por empresa y localidad" />
      <section className="space-y-4">
        {porEmpresa.map((g, idx) => (
          <ConfigurableTable
            key={`emp-${g.key ?? idx}`}
            title={g.nombre ?? "Empresa"}
            subtitle="Operadores por empresa"
            data={g.operadores ?? []}
            accent="emerald"
            storageKey={`ceo-maquinistas:empresa:${g.key ?? idx}`}
            defaultSortKey="totalMovimientos"
            columns={columns}
          />
        ))}
      </section>

      <section className="space-y-4">
        {porLocalidad.map((g, idx) => (
          <ConfigurableTable
            key={`loc-${g.key ?? idx}`}
            title={g.nombre ?? "Localidad"}
            subtitle="Operadores por localidad"
            data={g.operadores ?? []}
            accent="sky"
            storageKey={`ceo-maquinistas:localidad:${g.key ?? idx}`}
            defaultSortKey="totalMovimientos"
            columns={columns}
          />
        ))}
      </section>
    </div>
  );
}
