"use client";

import React from "react";
import { Layers, Users } from "lucide-react";
import ReportLayout from "../../../components/ReportLayout";
import { useTraficoClienteReport } from "../hooks/useTraficoClienteReport";
import type { Tab } from "../../../lib/types";
import TraficoClientesSection from "../sections/TraficoClientesSection";
import TraficoTendencias from "../sections/TraficoTendencias";
import CumplimientoEstados from "../../ceo-cumplimiento/sections/CumplimientoEstados";

const tabs: Array<{ id: Tab; label: string; icon: React.ElementType }> = [
  { id: "overview", label: "Clientes", icon: Users },
  { id: "operaciones", label: "Tendencias", icon: Layers },
];

export default function TraficoClienteReport() {
  const report = useTraficoClienteReport();

  return (
    <ReportLayout
      title="Tráfico por Cliente"
      subtitle="Volumen, concentración y desempeño por cliente."
      accent="#38bdf8"
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
          <TraficoClientesSection
            topMovimientos={(report.rawReport as any)?.topClientesMovimientos ?? []}
            topIncidentes={(report.rawReport as any)?.topClientesIncidentes ?? []}
            clientes={(report.rawReport as any)?.clientes ?? []}
            porEmpresa={(report.rawReport as any)?.porEmpresa ?? []}
          />
          <CumplimientoEstados estados={(report.rawReport as any)?.estadosGeneral} />
        </>
      )}

      {report.activeTab === "operaciones" && (
        <TraficoTendencias
          movimientosHora={report.movimientosHora}
          movimientosDia={report.movimientosDia}
          ejecucionData={report.ejecucionData}
          meanHora={report.meanHora}
          peakHora={report.peakHora}
          meanDia={report.meanDia}
          peakDia={report.peakDia}
          meanPct={report.meanPct}
        />
      )}
    </ReportLayout>
  );
}
