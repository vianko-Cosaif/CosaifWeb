"use client";

import React from "react";
import { BarChart3, Flame, Layers, TrendingUp } from "lucide-react";
import Layout from "./components/Layout";
import OverviewSection from "./sections/OverviewSection";
import OperacionesSection from "./sections/OperacionesSection";
import IncidentesSection from "./sections/IncidentesSection";
import RankingsSection from "./sections/RankingsSection";
import type { Tab } from "./lib/types";
import { useReporteriaCoor } from "./hooks/useReporteriaCoor";

const tabs: Array<{ id: Tab; label: string; icon: React.ElementType }> = [
  { id: "overview", label: "Overview", icon: Layers },
  { id: "operaciones", label: "Operaciones", icon: TrendingUp },
  { id: "incidentes", label: "Incidentes", icon: Flame },
  { id: "rankings", label: "Rankings", icon: BarChart3 },
];

export default function ReporteriaCoorClient() {
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
        />
      )}
    </Layout>
  );
}
