"use client";

import React, { useState } from "react";
import { BarChart3, Flame, Layers, TrendingUp, Train } from "lucide-react";
import Layout from "./components/Layout";
import OverviewSection from "./sections/OverviewSection";
import OperacionesSection from "./sections/OperacionesSection";
import IncidentesSection from "./sections/IncidentesSection";
import RankingsSection from "./sections/RankingsSection";
import type { Tab } from "./lib/types";
import { useReporteriaCoor } from "./hooks/useReporteriaCoor";
import EmpresaLocomotorasReport from "./reports/empresa-locomotoras/EmpresaLocomotorasReport";

const tabs: Array<{ id: Tab; label: string; icon: React.ElementType }> = [
  { id: "overview", label: "Overview", icon: Layers },
  { id: "operaciones", label: "Operaciones", icon: TrendingUp },
  { id: "incidentes", label: "Incidentes", icon: Flame },
  { id: "rankings", label: "Rankings", icon: BarChart3 },
];

type ReportKey = "general" | "empresaLocomotoras";

const reportOptions: Array<{
  id: ReportKey;
  label: string;
  desc: string;
  icon: React.ElementType;
  tone: string;
}> = [
  {
    id: "general",
    label: "Reporte Coordinador",
    desc: "KPIs, incidentes, estados y rankings.",
    icon: Layers,
    tone: "#6366f1",
  },
  {
    id: "empresaLocomotoras",
    label: "Alstom - Locomotoras",
    desc: "Concentrado de movimientos.",
    icon: Train,
    tone: "#0ea5e9",
  },
];

function GeneralReport() {
  const report = useReporteriaCoor();

  return (
    <Layout
      title="Reportería Coordinador"
      subtitle="KPIs críticos, ejecución e incidencias con filtros dinámicos."
      loading={report.loading}
      pdfBusy={report.pdfBusy}
      fetchReport={report.fetchReport}
      exportPdf={report.exportPdf}
      error={report.error}
      fetchedAt={report.fetchedAt}
      filters={{
        periodo: report.periodo,
        setPeriodo: report.setPeriodo,
        diaISO: report.diaISO,
        setDiaISO: report.setDiaISO,
        semanaISO: report.semanaISO,
        setSemanaISO: report.setSemanaISO,
        mesYM: report.mesYM,
        setMesYM: report.setMesYM,
        bimYear: report.bimYear,
        setBimYear: report.setBimYear,
        bimIndex: report.bimIndex,
        setBimIndex: report.setBimIndex,
        semYear: report.semYear,
        setSemYear: report.setSemYear,
        semIndex: report.semIndex,
        setSemIndex: report.setSemIndex,
        anio: report.anio,
        setAnio: report.setAnio,
        empresaId: report.empresaId,
        setEmpresaId: report.setEmpresaId,
        localidadId: report.localidadId,
        setLocalidadId: report.setLocalidadId,
        lockEmpresa: report.lockEmpresa,
        lockLocalidad: report.lockLocalidad,
        empresas: report.empresas,
        localidades: report.filteredLocalidades,
      }}
      tabs={tabs}
      activeTab={report.activeTab}
      setActiveTab={report.setActiveTab}
    >
      {report.activeTab === "overview" && (
        <OverviewSection
          kpis={report.kpis}
          totalMov={report.totalMov}
          movimientosHora={report.movimientosHora}
          meanHora={report.meanHora}
          peakHora={report.peakHora}
        />
      )}

      {report.activeTab === "operaciones" && (
        <OperacionesSection
          movimientosDia={report.movimientosDia}
          meanDia={report.meanDia}
          peakDia={report.peakDia}
          estadosGeneral={report.estadosGeneral}
        />
      )}

      {report.activeTab === "incidentes" && (
        <IncidentesSection
          kpis={report.kpis}
          incidentesHora={report.incidentesHora}
          incidentesDia={report.incidentesDia}
          meanIncHora={report.meanIncHora}
          meanIncDia={report.meanIncDia}
          peakIncHora={report.peakIncHora}
          peakIncDia={report.peakIncDia}
        />
      )}

      {report.activeTab === "rankings" && (
        <RankingsSection
          topEmpresas={report.topEmpresas}
          topLocomotoras={report.topLocomotoras}
          movimientosDetalle={report.movimientosDetalle}
          cronologiaMovimientos={report.cronologiaMovimientos}
        />
      )}
    </Layout>
  );
}

export default function ReporteriaCoorClient() {
  const [reportKey, setReportKey] = useState<ReportKey>("general");

  return (
    <div className="reporteria-coor-root w-full max-w-[1600px] mx-auto space-y-6 overflow-x-hidden">
      <section className="grid gap-4 md:grid-cols-2">
        {reportOptions.map((opt) => {
          const active = opt.id === reportKey;
          const Icon = opt.icon;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setReportKey(opt.id)}
              className={`flex w-full items-start gap-3 rounded-3xl border p-5 text-left shadow-sm transition ${
                active
                  ? "border-slate-900 bg-white"
                  : "border-slate-200/70 bg-white/80 hover:border-slate-300"
              }`}
            >
              <span
                className="grid h-12 w-12 place-items-center rounded-2xl"
                style={{ background: `${opt.tone}22`, color: opt.tone }}
              >
                <Icon className="h-5 w-5" />
              </span>
              <span className="space-y-1">
                <span className="block text-base font-semibold text-slate-900">{opt.label}</span>
                <span className="block text-sm text-slate-500">{opt.desc}</span>
              </span>
            </button>
          );
        })}
      </section>

      {reportKey === "general" ? <GeneralReport /> : <EmpresaLocomotorasReport />}

      <style jsx global>{`
        .reporteria-coor-root,
        .reporteria-coor-root * {
          min-width: 0;
        }
      `}</style>
    </div>
  );
}
