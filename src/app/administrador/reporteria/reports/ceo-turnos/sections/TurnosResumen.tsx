"use client";

import React from "react";
import ChartCard from "../../../components/ChartCard";
import SectionTitle from "../../../components/SectionTitle";
import { fmtMaybeInt, fmtMaybePct } from "../../../lib/utils";

type Turno = {
  turnoId?: string;
  turnoLabel?: string;
  turnoRango?: string;
  totalMovimientos?: number;
  conInicioFin?: number;
  okPct?: number;
  criticosTotal?: number;
  incidentesTotal?: number;
  cancelados?: number;
  canceladosConIncidente?: number;
};

export default function TurnosResumen({ turnos }: { turnos: Turno[] }) {
  if (!turnos?.length) return null;

  return (
    <div className="space-y-4">
      <SectionTitle title="Turnos" subtitle="Desempeño por turno operativo" />
      <section className="grid grid-cols-12 gap-4">
        {turnos.map((t) => (
          <div key={t.turnoId ?? t.turnoLabel} className="col-span-12 md:col-span-6 xl:col-span-4">
            <ChartCard title={t.turnoLabel ?? "Turno"} subtitle={t.turnoRango ?? ""} accent="amber">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">Movimientos</div>
                  <div className="text-lg font-black text-[var(--text)]">{fmtMaybeInt(t.totalMovimientos)}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">OK %</div>
                  <div className="text-lg font-black text-[var(--text)]">{fmtMaybePct(t.okPct)}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">Incidentes</div>
                  <div className="text-lg font-black text-[var(--text)]">{fmtMaybeInt(t.incidentesTotal)}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">Criticos</div>
                  <div className="text-lg font-black text-[var(--text)]">{fmtMaybeInt(t.criticosTotal)}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">Cancelados</div>
                  <div className="text-lg font-black text-[var(--text)]">{fmtMaybeInt(t.cancelados)}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">Canc + Inc</div>
                  <div className="text-lg font-black text-[var(--text)]">{fmtMaybeInt(t.canceladosConIncidente)}</div>
                </div>
              </div>
            </ChartCard>
          </div>
        ))}
      </section>
    </div>
  );
}
