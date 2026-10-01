"use client";

import React from "react";
import ModuleHeader from "@/components/ui/ModuleHeader";
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
    <section className="min-w-0 w-full space-y-5">
      <ModuleHeader title={title} subtitle={subtitle} eyebrow="Operación por localidad" actions={<>
          <button
            type="button"
            onClick={fetchReport}
            disabled={loading}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-2 text-sm font-semibold text-[var(--app-text)] shadow-sm transition hover:border-[var(--app-border-strong)] hover:text-[var(--app-text)] disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Actualizando" : "Actualizar"}
          </button>
          <button
            type="button"
            onClick={exportPdf}
            disabled={pdfBusy || loading || !fetchedAt}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--app-accent)] px-4 py-2 text-sm font-semibold text-[var(--app-accent-contrast)] shadow-md transition hover:opacity-90 disabled:opacity-60"
          >
            <FileDown className="h-4 w-4" />
            {pdfBusy ? "Descargando…" : "Descargar PDF"}
          </button>
      </>} />

      {error ? (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
          {error}
        </div>
      ) : null}

      <FiltersSidebar {...filters} variant="inline" />

      <TabsBar tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      <div className="min-w-0 space-y-6">{loading && !fetchedAt ? <p role="status" className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 sm:p-5 text-sm text-[var(--app-text-muted)]">Cargando los datos del periodo seleccionado…</p> : error && !fetchedAt ? null : children}</div>

      <div className="text-xs text-[var(--app-text-muted)]">
        {fetchedAt ? `Actualizado: ${fetchedAt.toLocaleString("es-MX")}` : "Sin carga inicial"}
      </div>
    </section>
  );
}
