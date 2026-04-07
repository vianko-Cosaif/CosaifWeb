"use client";

import React from "react";
import { Flame, Layers, Target } from "lucide-react";
import ReportLayout from "../../../components/ReportLayout";
import { useCumplimientoReport } from "../hooks/useCumplimientoReport";
import OverviewSection from "../../../sections/OverviewSection";
import OperacionesSection from "../../../sections/OperacionesSection";
import type { Tab } from "../../../lib/types";
import KpiCard from "../../../components/KpiCard";
import { fmtMaybeInt } from "../../../lib/utils";
import CumplimientoSegmentacion from "../sections/CumplimientoSegmentacion";
import CumplimientoEstados from "../sections/CumplimientoEstados";
import CumplimientoIncidentes from "../sections/CumplimientoIncidentes";

const tabs: Array<{ id: Tab; label: string; icon: React.ElementType }> = [
  { id: "overview", label: "Cumplimiento", icon: Target },
  { id: "operaciones", label: "Ejecución", icon: Layers },
  { id: "incidentes", label: "Incidentes", icon: Flame },
];

export default function CumplimientoReport() {
  const report = useCumplimientoReport();

  return (
    <ReportLayout
      title="Cumplimiento Operativo"
      subtitle="KPIs críticos, rangos de ejecución y cumplimiento global."
      accent="#22c55e"
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
        <>
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
          <section className="grid grid-cols-12 gap-4">
            <div className="col-span-12 md:col-span-4 xl:col-span-3">
              <KpiCard title="Cancelados" value={fmtMaybeInt((report.kpis as any)?.cancelados)} accent="rose" />
            </div>
            <div className="col-span-12 md:col-span-4 xl:col-span-3">
              <KpiCard
                title="Cancelados con incidente"
                value={fmtMaybeInt((report.kpis as any)?.canceladosConIncidente)}
                accent="amber"
              />
            </div>
          </section>
          <CumplimientoEstados estados={(report.rawReport as any)?.estadosGeneral} />
        </>
      )}

      {report.activeTab === "operaciones" && (
        <>
          <OperacionesSection
            kpis={report.kpis}
            movimientosDia={report.movimientosDia}
            meanDia={report.meanDia}
            peakDia={report.peakDia}
            ejecucionData={report.ejecucionData}
            meanPct={report.meanPct}
          />
          <CumplimientoSegmentacion
            porEmpresa={(report.rawReport as any)?.porEmpresa ?? []}
            porLocalidad={(report.rawReport as any)?.porLocalidad ?? []}
            porTurno={(report.rawReport as any)?.porTurno ?? []}
          />
        </>
      )}

      {report.activeTab === "incidentes" && (
        <CumplimientoIncidentes
          kpis={report.kpis}
          incidentesHora={report.incidentesHora}
          incidentesDia={report.incidentesDia}
          incidentesEstado={report.incidentesEstado}
          meanIncHora={report.meanIncHora}
          meanIncDia={report.meanIncDia}
          peakIncHora={report.peakIncHora}
          peakIncDia={report.peakIncDia}
        />
      )}
    </ReportLayout>
  );
}
