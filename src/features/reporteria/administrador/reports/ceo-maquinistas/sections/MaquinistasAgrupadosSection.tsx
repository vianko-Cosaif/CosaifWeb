"use client";

import type { MaquinistasAgrupadosSectionProps, MaquinistasAgrupadosSectionOperadorRow } from "../../types";

import React from "react";
import ConfigurableTable from "../../../components/ConfigurableTable";
import SectionTitle from "../../../components/SectionTitle";
import { fmtMaybeDec, fmtMaybeInt, fmtMaybePct } from "../../../lib/utils";





const columns: { key: keyof MaquinistasAgrupadosSectionOperadorRow; label: string; format?: (v: unknown, row: MaquinistasAgrupadosSectionOperadorRow) => string }[] = [
  { key: "operadorNombre", label: "Operador" },
  { key: "totalMovimientos", label: "Mov", format: (v: unknown) => fmtMaybeInt(v) },
  { key: "conInicioFin", label: "Con fin", format: (v: unknown) => fmtMaybeInt(v) },
  { key: "execMeanMin", label: "Media", format: (v: unknown) => fmtMaybeDec(v) },
  { key: "execP90Min", label: "P90", format: (v: unknown) => fmtMaybeDec(v) },
  { key: "okPct", label: "OK %", format: (v: unknown) => fmtMaybePct(v) },
  { key: "criticosTotal", label: "Crit", format: (v: unknown) => fmtMaybeInt(v) },
  { key: "incidentesTotal", label: "Inc", format: (v: unknown) => fmtMaybeInt(v) },
  { key: "cancelados", label: "Canc", format: (v: unknown) => fmtMaybeInt(v) },
  { key: "canceladosConIncidente", label: "Canc+Inc", format: (v: unknown) => fmtMaybeInt(v) },
];

export default function MaquinistasAgrupadosSection({
  porEmpresa,
  porLocalidad,
}: MaquinistasAgrupadosSectionProps) {
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
