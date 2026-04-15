"use client";

import React from "react";
import { FileDown, RefreshCw } from "lucide-react";
import type { PeriodoUI, Tab } from "../lib/types";
import FiltersSidebar from "./FiltersSidebar";
import TabsBar from "./TabsBar";

export default function Layout({
  title,
  subtitle,
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
  loading: boolean;
  pdfBusy: boolean;
  fetchReport: () => void;
  exportPdf: () => void;
  error: string | null;
  fetchedAt: Date | null;
  filters: {
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
    lockEmpresa: boolean;
    lockLocalidad: boolean;
    empresas: Array<{ id: number; nombre: string }>;
    localidades: Array<{ id: number; nombre: string }>;
  };
  tabs: Array<{ id: Tab; label: string; icon: React.ElementType }>;
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  children: React.ReactNode;
}) {
  return (
    <section className="w-full space-y-6">
      <header className="flex w-full flex-col gap-4 rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-sm backdrop-blur lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
            Reportería Coordinador
          </p>
          <h1 className="text-2xl font-black text-slate-900 sm:text-3xl">{title}</h1>
          {subtitle ? <p className="max-w-2xl text-sm text-slate-500">{subtitle}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={fetchReport}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Actualizando" : "Actualizar"}
          </button>
          <button
            type="button"
            onClick={exportPdf}
            disabled={pdfBusy}
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-slate-800 disabled:opacity-60"
          >
            <FileDown className="h-4 w-4" />
            {pdfBusy ? "Descargando…" : "Descargar PDF"}
          </button>
        </div>
      </header>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <FiltersSidebar {...filters} variant="inline" />

      <TabsBar tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      <div className="min-w-0 space-y-6">{children}</div>

      <div className="text-xs text-slate-400">
        {fetchedAt ? `Actualizado: ${fetchedAt.toLocaleString("es-MX")}` : "Sin carga inicial"}
      </div>
    </section>
  );
}
