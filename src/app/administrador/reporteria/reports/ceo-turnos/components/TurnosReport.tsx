"use client";

import React from "react";
import { CalendarClock, Flame, Layers } from "lucide-react";
import ReportLayout from "../../../components/ReportLayout";
import { useTurnosReport } from "../hooks/useTurnosReport";
import type { Tab } from "../../../lib/types";
import TurnosResumen from "../sections/TurnosResumen";
import TurnosOperadores from "../sections/TurnosOperadores";
import TurnosTendencias from "../sections/TurnosTendencias";
import TurnosIncidentes from "../sections/TurnosIncidentes";

const tabs: Array<{ id: Tab; label: string; icon: React.ElementType }> = [
  { id: "overview", label: "Turnos", icon: CalendarClock },
  { id: "operaciones", label: "Operadores", icon: Layers },
  { id: "incidentes", label: "Incidentes", icon: Flame },
];

export default function TurnosReport() {
  const report = useTurnosReport();

  return (
    <ReportLayout
      title="Desempeño por Turno"
      subtitle="Comparativo 07–15 / 15–23 / 23–07 con KPIs y picos."
      accent="#f97316"
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
          <TurnosResumen turnos={(report.rawReport as any)?.turnos ?? []} />
          <TurnosTendencias
            movimientosHora={report.movimientosHora}
            ejecucionData={report.ejecucionData}
            meanHora={report.meanHora}
            peakHora={report.peakHora}
            meanPct={report.meanPct}
            execMax={report.execMax}
          />
        </>
      )}

      {report.activeTab === "operaciones" && (
        <TurnosOperadores grupos={(report.rawReport as any)?.rankingOperadoresPorTurno ?? []} />
      )}

      {report.activeTab === "incidentes" && (
        <TurnosIncidentes
          kpis={report.kpis}
          incidentesHora={report.incidentesHora}
          meanIncHora={report.meanIncHora}
          peakIncHora={report.peakIncHora}
        />
      )}
    </ReportLayout>
  );
}
