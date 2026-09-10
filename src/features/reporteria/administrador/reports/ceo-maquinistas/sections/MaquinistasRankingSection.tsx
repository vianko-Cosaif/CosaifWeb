"use client";

import type { MaquinistasRankingSectionProps } from "../../types";

import React from "react";
import ConfigurableTable from "../../../components/ConfigurableTable";
import SectionTitle from "../../../components/SectionTitle";
import { fmtMaybeDec, fmtMaybeInt, fmtMaybePct } from "../../../lib/utils";



export default function MaquinistasRankingSection({ operadores }: MaquinistasRankingSectionProps) {
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
          { key: "totalMovimientos", label: "Mov", format: (v: unknown) => fmtMaybeInt(v) },
          { key: "conInicioFin", label: "Con fin", format: (v: unknown) => fmtMaybeInt(v) },
          { key: "execMeanMin", label: "Media", format: (v: unknown) => fmtMaybeDec(v) },
          { key: "execP90Min", label: "P90", format: (v: unknown) => fmtMaybeDec(v) },
          { key: "okPct", label: "OK %", format: (v: unknown) => fmtMaybePct(v) },
          { key: "criticosTotal", label: "Crit", format: (v: unknown) => fmtMaybeInt(v) },
          { key: "incidentesTotal", label: "Inc", format: (v: unknown) => fmtMaybeInt(v) },
          { key: "cancelados", label: "Canc", format: (v: unknown) => fmtMaybeInt(v) },
          { key: "canceladosConIncidente", label: "Canc+Inc", format: (v: unknown) => fmtMaybeInt(v) },
        ]}
      />
    </div>
  );
}
