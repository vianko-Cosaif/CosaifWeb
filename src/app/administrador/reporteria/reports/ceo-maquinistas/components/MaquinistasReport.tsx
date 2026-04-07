"use client";

import React from "react";
import { BarChart3, Medal } from "lucide-react";
import ReportLayout from "../../../components/ReportLayout";
import { useMaquinistasReport } from "../hooks/useMaquinistasReport";
import type { Tab } from "../../../lib/types";
import MaquinistasRankingSection from "../sections/MaquinistasRankingSection";
import MaquinistasAgrupadosSection from "../sections/MaquinistasAgrupadosSection";
import MaquinistasResumen from "../sections/MaquinistasResumen";

const tabs: Array<{ id: Tab; label: string; icon: React.ElementType }> = [
  { id: "rankings", label: "Ranking", icon: Medal },
  { id: "overview", label: "Segmentos", icon: BarChart3 },
];

export default function MaquinistasReport() {
  const report = useMaquinistasReport();

  return (
    <ReportLayout
      title="Ranking de Maquinistas"
      subtitle="Desempeño, incidentes y criticidad por operador."
      accent="#a855f7"
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
      {report.activeTab === "rankings" && (
        <>
          <MaquinistasResumen kpis={report.kpis} />
          <MaquinistasRankingSection operadores={(report.rawReport as any)?.rankingOperadores ?? []} />
        </>
      )}

      {report.activeTab === "overview" && (
        <MaquinistasAgrupadosSection
          porEmpresa={(report.rawReport as any)?.operadoresPorEmpresa ?? []}
          porLocalidad={(report.rawReport as any)?.operadoresPorLocalidad ?? []}
        />
      )}
    </ReportLayout>
  );
}
