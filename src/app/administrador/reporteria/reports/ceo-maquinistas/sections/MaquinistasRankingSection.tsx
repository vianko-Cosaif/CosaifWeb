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

export default function MaquinistasRankingSection({ operadores }: { operadores: OperadorRow[] }) {
  return (
    <div className="space-y-4">
      <SectionTitle title="Ranking de Maquinistas" subtitle="Desempeño avanzado por operador" />
      <ConfigurableTable
        title="Ranking avanzado"
        subtitle="Operadores con mejores métricas"
        data={operadores}
        accent="indigo"
        storageKey="ceo-maquinistas:ranking"
        defaultSortKey="totalMovimientos"
        columns={[
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
        ]}
      />
    </div>
  );
}
