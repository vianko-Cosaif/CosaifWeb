"use client";

import React from "react";
import {
  BarChart3,
  Flame,
  Layers,
  Sparkles,
  TrendingUp,
} from "lucide-react";

import ReportLayout from "../../../components/ReportLayout";
import { useReporteriaAdmin } from "../../../hooks/useReporteriaAdmin";
import OverviewSection from "../../../sections/OverviewSection";
import OperacionesSection from "../../../sections/OperacionesSection";
import IncidentesSection from "../../../sections/IncidentesSection";
import RankingsSection from "../../../sections/RankingsSection";
import InsightsSection from "../../../sections/InsightsSection";
import type { Tab } from "../../../lib/types";

const tabs: Array<{ id: Tab; label: string; icon: React.ElementType }> = [
  { id: "overview", label: "Overview", icon: Layers },
  { id: "operaciones", label: "Operaciones", icon: TrendingUp },
  { id: "incidentes", label: "Incidentes", icon: Flame },
  { id: "rankings", label: "Rankings", icon: BarChart3 },
  { id: "insights", label: "Insights", icon: Sparkles },
];

export default function GeneralReport() {
  const report = useReporteriaAdmin();

  return (
    <ReportLayout
      title="Reporte General"
      subtitle="KPIs críticos, rangos de ejecución y rankings operativos."
      accent="var(--accent)"
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
          conInicioFin={report.conInicioFin}
          sinFin={report.sinFin}
          completionPct={report.completionPct}
          sinFinPct={report.sinFinPct}
          sparkData={report.sparkData}
          ejecucionData={report.ejecucionData}
          execMax={report.execMax}
          meanExec={report.meanExec}
          movimientosHora={report.movimientosHora}
          meanHora={report.meanHora}
          peakHora={report.peakHora}
        />
      )}

      {report.activeTab === "operaciones" && (
        <OperacionesSection
          kpis={report.kpis}
          movimientosDia={report.movimientosDia}
          ejecucionData={report.ejecucionData}
          meanPct={report.meanPct}
          meanDia={report.meanDia}
          peakDia={report.peakDia}
        />
      )}

      {report.activeTab === "incidentes" && (
        <IncidentesSection
          kpis={report.kpis}
          incidentesHora={report.incidentesHora}
          incidentesDia={report.incidentesDia}
          incidentesEstado={report.incidentesEstado}
          meanIncHora={report.meanIncHora}
          meanIncDia={report.meanIncDia}
          peakIncHora={report.peakIncHora}
          peakIncDia={report.peakIncDia}
          topLocos={report.topLocos}
          rankingEmpresas={report.rankingEmpresas}
          topCriticos={report.topCriticos}
          topIncidentes={report.topIncidentes}
        />
      )}

      {report.activeTab === "rankings" && (
        <RankingsSection
          rankingOperadores={report.rankingOperadores}
          rankingLocomotoras={report.rankingLocomotoras}
          rankingSupervisores={report.rankingSupervisores}
          rankingCoordinadores={report.rankingCoordinadores}
          rankingEmpresas={report.rankingEmpresas}
          rankingClientes={report.rankingClientes}
          rankingLocalidades={report.rankingLocalidades}
        />
      )}

      {report.activeTab === "insights" && (
        <InsightsSection
          insights={report.insights}
          rankingEmpresas={report.rankingEmpresas}
          rankingClientes={report.rankingClientes}
          rankingOperadores={report.rankingOperadores}
          rankingLocomotoras={report.rankingLocomotoras}
          peakHora={report.peakHora}
          peakDia={report.peakDia}
          execMax={report.execMax}
          kpis={report.kpis}
        />
      )}
    </ReportLayout>
  );
}
