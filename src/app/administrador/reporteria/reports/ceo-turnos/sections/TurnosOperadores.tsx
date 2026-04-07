"use client";

import React from "react";
import ConfigurableTable from "../../../components/ConfigurableTable";
import SectionTitle from "../../../components/SectionTitle";
import { fmtMaybeInt, fmtMaybePct } from "../../../lib/utils";

type Operador = {
  operadorId?: number;
  operadorNombre?: string;
  totalMovimientos?: number;
  conInicioFin?: number;
  okPct?: number;
  criticosTotal?: number;
  incidentesTotal?: number;
};

type GrupoTurno = {
  turnoId?: string;
  turnoLabel?: string;
  turnoRango?: string;
  operadores?: Operador[];
};

export default function TurnosOperadores({ grupos }: { grupos: GrupoTurno[] }) {
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
              { key: "operadorNombre", label: "Operador" },
              { key: "totalMovimientos", label: "Mov", format: (v: any) => fmtMaybeInt(v) },
              { key: "conInicioFin", label: "Con fin", format: (v: any) => fmtMaybeInt(v) },
              { key: "okPct", label: "OK %", format: (v: any) => fmtMaybePct(v) },
              { key: "criticosTotal", label: "Crit", format: (v: any) => fmtMaybeInt(v) },
              { key: "incidentesTotal", label: "Inc", format: (v: any) => fmtMaybeInt(v) },
            ]}
          />
        ))}
      </section>
    </div>
  );
}
