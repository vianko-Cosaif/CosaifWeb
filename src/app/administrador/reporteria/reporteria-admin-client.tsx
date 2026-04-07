"use client";

import React, { useState } from "react";
import {
  Gauge,
  Medal,
  Shuffle,
  Target,
  Timer,
  Users,
} from "lucide-react";
import type { ReportKey } from "./lib/types";
import GeneralReport from "./reports/general/components/GeneralReport";
import CumplimientoReport from "./reports/ceo-cumplimiento/components/CumplimientoReport";
import TraficoClienteReport from "./reports/ceo-trafico-cliente/components/TraficoClienteReport";
import TurnosReport from "./reports/ceo-turnos/components/TurnosReport";
import MaquinistasReport from "./reports/ceo-maquinistas/components/MaquinistasReport";
import ComparativoReport from "./reports/ceo-comparativo/components/ComparativoReport";

const reportOptions: Array<{
  id: ReportKey;
  label: string;
  desc: string;
  icon: React.ElementType;
  tone: string;
}> = [
  {
    id: "general",
    label: "Reporte General",
    desc: "Tablero base con KPIs, operaciones, incidentes y rankings.",
    icon: Gauge,
    tone: "#0ea5e9",
  },
  {
    id: "cumplimiento",
    label: "Cumplimiento Operativo",
    desc: "KPIs críticos, rangos de ejecución y cumplimiento global.",
    icon: Target,
    tone: "#22c55e",
  },
  {
    id: "traficoCliente",
    label: "Tráfico por Cliente",
    desc: "Volumen, concentración y tendencias por cliente.",
    icon: Users,
    tone: "#38bdf8",
  },
  {
    id: "turnos",
    label: "Desempeño por Turno",
    desc: "Comparativo de turnos, picos y consistencia.",
    icon: Timer,
    tone: "#f97316",
  },
  {
    id: "maquinistas",
    label: "Ranking de Maquinistas",
    desc: "Ranking avanzado con desempeño e incidentes.",
    icon: Medal,
    tone: "#a855f7",
  },
  {
    id: "comparativo",
    label: "Ejecutivo Comparativo",
    desc: "Vs periodo anterior, variaciones y tendencia.",
    icon: Shuffle,
    tone: "#06b6d4",
  },
];

const reportMap: Record<ReportKey, React.ReactNode> = {
  general: <GeneralReport />,
  cumplimiento: <CumplimientoReport />,
  traficoCliente: <TraficoClienteReport />,
  turnos: <TurnosReport />,
  maquinistas: <MaquinistasReport />,
  comparativo: <ComparativoReport />,
};

export default function ReporteriaAdminClient() {
  const [reportKey, setReportKey] = useState<ReportKey>("general");

  return (
    <div className="space-y-6">
      <section className="report-selector">
        {reportOptions.map((opt) => {
          const active = opt.id === reportKey;
          const Icon = opt.icon;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setReportKey(opt.id)}
              className={`report-option ${active ? "is-active" : ""}`}
              style={{ ["--tone" as any]: opt.tone }}
            >
              <div className="report-option-icon">
                <Icon className="h-5 w-5" />
              </div>
              <div className="report-option-body">
                <div className="report-option-title">{opt.label}</div>
                <div className="report-option-desc">{opt.desc}</div>
              </div>
            </button>
          );
        })}
      </section>

      {reportMap[reportKey]}

      <style jsx global>{`
        .report-selector {
          display: grid;
          gap: 1rem;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        }

        .report-option {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          gap: 0.9rem;
          padding: 1rem 1.1rem;
          border-radius: 18px;
          border: 1px solid var(--stroke);
          background: var(--panel);
          box-shadow: var(--shadow);
          text-align: left;
          transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
        }

        .report-option:hover {
          transform: translateY(-2px);
          border-color: color-mix(in srgb, var(--tone) 40%, var(--stroke));
        }

        .report-option.is-active {
          border-color: var(--tone);
          box-shadow: 0 18px 40px color-mix(in srgb, var(--tone) 30%, transparent);
        }

        .report-option-icon {
          height: 42px;
          width: 42px;
          border-radius: 12px;
          display: grid;
          place-items: center;
          background: color-mix(in srgb, var(--tone) 18%, transparent);
          color: var(--tone);
        }

        .report-option-title {
          font-weight: 700;
          color: var(--text);
          font-size: 0.98rem;
        }

        .report-option-desc {
          font-size: 0.8rem;
          color: var(--muted);
        }
      `}</style>
    </div>
  );
}
