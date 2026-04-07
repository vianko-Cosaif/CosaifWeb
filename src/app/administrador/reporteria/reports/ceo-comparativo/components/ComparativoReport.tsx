"use client";

import React from "react";
import { Layers, Shuffle } from "lucide-react";
import ReportLayout from "../../../components/ReportLayout";
import { useComparativoReport } from "../hooks/useComparativoReport";
import type { Tab } from "../../../lib/types";
import ComparativoResumen from "../sections/ComparativoResumen";
import ComparativoBuckets from "../sections/ComparativoBuckets";
import ComparativoCambios from "../sections/ComparativoCambios";

const tabs: Array<{ id: Tab; label: string; icon: React.ElementType }> = [
  { id: "overview", label: "Comparativo", icon: Shuffle },
  { id: "operaciones", label: "Cambios", icon: Layers },
];

export default function ComparativoReport() {
  const report = useComparativoReport();

  return (
    <ReportLayout
      title="Ejecutivo Comparativo"
      subtitle="Variaciones vs periodo anterior, KPI y tendencia."
      accent="#06b6d4"
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
          <ComparativoResumen resumen={(report.rawReport as any)?.resumen} />
          <ComparativoBuckets
            actual={(report.rawReport as any)?.actual?.ejecucionBuckets ?? []}
            anterior={(report.rawReport as any)?.anterior?.ejecucionBuckets ?? []}
          />
        </>
      )}

      {report.activeTab === "operaciones" && (
        <ComparativoCambios
          cambiosEmpresas={(report.rawReport as any)?.cambiosEmpresas ?? []}
          cambiosClientes={(report.rawReport as any)?.cambiosClientes ?? []}
        />
      )}

    </ReportLayout>
  );
}
