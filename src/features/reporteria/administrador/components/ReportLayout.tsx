"use client";

import React from "react";
import ModuleHeader from "@/components/ui/ModuleHeader";
import {
  Calendar,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  RefreshCw,
  FileDown,
} from "lucide-react";
import type { PeriodoUI, Tab } from "../lib/types";
import FiltersSidebar from "./FiltersSidebar";
import TabsBar from "./TabsBar";

const periodOptions: Array<{ id: PeriodoUI; label: string; back: string; icon: React.ElementType }> = [
  { id: "dia", label: "Dia", back: "DIA", icon: CalendarDays },
  { id: "semana", label: "Semana", back: "SEMANA", icon: CalendarRange },
  { id: "mes", label: "Mes", back: "MES", icon: Calendar },
  { id: "bimestre", label: "Bimestre", back: "BIMESTRE", icon: CalendarClock },
  { id: "semestre", label: "Semestre", back: "SEMESTRE", icon: CalendarClock },
  { id: "anual", label: "Anual", back: "ANUAL", icon: CalendarClock },
];

export type ReportLayoutFilters = {
  periodo: PeriodoUI;
  setPeriodo: (v: PeriodoUI) => void;
  diaISO: string;
  setDiaISO: (v: string) => void;
  semanaISO: string;
  setSemanaISO: (v: string) => void;
  mesYM: string;
  setMesYM: (v: string) => void;
  bimYear: number;
  setBimYear: (v: number) => void;
  bimIndex: number;
  setBimIndex: (v: number) => void;
  semYear: number;
  setSemYear: (v: number) => void;
  semIndex: number;
  setSemIndex: (v: number) => void;
  anio: number;
  setAnio: (v: number) => void;
  empresaId: string;
  setEmpresaId: (v: string) => void;
  localidadId: string;
  setLocalidadId: (v: string) => void;
  empresas: Array<{ id: number; nombre: string }>;
  localidades: Array<{ id: number; nombre: string; empresaId?: number | null; estado?: string }>;
};

export default function ReportLayout({
  title,
  subtitle,
  accent = "var(--accent)",
  loading,
  pdfBusy,
  fetchReport,
  exportPdf,
  error,
  fetchedAt,
  filters,
  tabs,
  activeTab,
  setActiveTab,
  children,
}: {
  title: string;
  subtitle?: string;
  accent?: string;
  loading: boolean;
  pdfBusy: boolean;
  fetchReport: () => void;
  exportPdf: () => void;
  error: string | null;
  fetchedAt: Date | null;
  filters: ReportLayoutFilters;
  tabs: Array<{ id: Tab; label: string; icon: React.ElementType }>;
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="report-shell min-w-0 space-y-5">
      <ModuleHeader title={title} subtitle={subtitle} eyebrow="Reportería ejecutiva" actions={<>
          <button
            type="button"
            onClick={fetchReport}
            disabled={loading}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--stroke)] bg-[var(--panel)] px-4 py-2 text-sm font-semibold text-[var(--text)] shadow-[var(--shadow)] hover:bg-[var(--panel-2)] disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Actualizando" : "Actualizar"}
          </button>
          <button
            type="button"
            onClick={exportPdf}
            disabled={pdfBusy || loading || !fetchedAt}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-[var(--app-accent-contrast)] shadow-[var(--shadow)] hover:brightness-110 disabled:opacity-60"
            style={{ background: "var(--app-accent)", borderBottom: `3px solid ${accent}` }}
          >
            <FileDown className="h-4 w-4" />
            {pdfBusy ? "Descargando…" : "Descargar PDF"}
          </button>
      </>} />

      {error ? (
        <div role="alert" className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
          {error}
        </div>
      ) : null}

      <div className="report-grid grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <FiltersSidebar
          periodo={filters.periodo}
          setPeriodo={filters.setPeriodo}
          periodOptions={periodOptions}
          diaISO={filters.diaISO}
          setDiaISO={filters.setDiaISO}
          semanaISO={filters.semanaISO}
          setSemanaISO={filters.setSemanaISO}
          mesYM={filters.mesYM}
          setMesYM={filters.setMesYM}
          bimYear={filters.bimYear}
          setBimYear={filters.setBimYear}
          bimIndex={filters.bimIndex}
          setBimIndex={filters.setBimIndex}
          semYear={filters.semYear}
          setSemYear={filters.setSemYear}
          semIndex={filters.semIndex}
          setSemIndex={filters.setSemIndex}
          anio={filters.anio}
          setAnio={filters.setAnio}
          empresaId={filters.empresaId}
          setEmpresaId={filters.setEmpresaId}
          localidadId={filters.localidadId}
          setLocalidadId={filters.setLocalidadId}
          empresas={filters.empresas}
          localidades={filters.localidades}
        />

        <div className="space-y-6">
          <TabsBar tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
          {loading && !fetchedAt ? <p role="status" className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 text-sm text-[var(--app-text-muted)]">Cargando los datos del periodo seleccionado…</p> : error && !fetchedAt ? null : children}
          <div className="text-xs text-[var(--muted)]">
            {fetchedAt ? `Actualizado: ${fetchedAt.toLocaleString("es-MX")}` : "Sin carga inicial"}
          </div>
        </div>
      </div>


    </div>
  );
}
