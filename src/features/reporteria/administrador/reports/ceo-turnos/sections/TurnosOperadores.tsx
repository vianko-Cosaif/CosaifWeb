"use client";

import type { TurnosOperadoresProps } from "../../types";

import React from "react";
import ConfigurableTable from "../../../components/ConfigurableTable";
import SectionTitle from "../../../components/SectionTitle";
import { fmtMaybeInt, fmtMaybePct } from "../../../lib/utils";





export default function TurnosOperadores({ grupos }: TurnosOperadoresProps) {
  if (!grupos?.length) return null;

  return (
    <div className="space-y-6">
      <SectionTitle title="Operadores por turno" subtitle="Ranking operativo por turno" />
      <section className="space-y-4">
        {grupos.map((g, idx) => (
          <ConfigurableTable
            key={`${g.turnoId ?? idx}`}
            title={`${g.turnoLabel ?? "Turno"} ${g.turnoRango ? `(${g.turnoRango})` : ""}`}
            subtitle="Top operadores del turno"
            data={g.operadores ?? []}
            accent="sky"
            storageKey={`ceo-turnos:operadores:${g.turnoId ?? idx}`}
            defaultSortKey="totalMovimientos"
            columns={[
              { key: "operadorNombre", label: "TurnosOperadoresOperador" },
              { key: "totalMovimientos", label: "Mov", format: (v: unknown) => fmtMaybeInt(v) },
              { key: "conInicioFin", label: "Con fin", format: (v: unknown) => fmtMaybeInt(v) },
              { key: "okPct", label: "OK %", format: (v: unknown) => fmtMaybePct(v) },
              { key: "criticosTotal", label: "Crit", format: (v: unknown) => fmtMaybeInt(v) },
              { key: "incidentesTotal", label: "Inc", format: (v: unknown) => fmtMaybeInt(v) },
            ]}
          />
        ))}
      </section>
    </div>
  );
}
