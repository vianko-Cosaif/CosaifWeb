"use client";

import React from "react";
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
    <div className="report-shell chart-3d space-y-6">
      <div className="report-hero">
        <div className="report-hero-left">
          <div className="report-hero-eyebrow">Reportería Ejecutiva</div>
          <h2 className="report-hero-title">{title}</h2>
          {subtitle ? <p className="report-hero-desc">{subtitle}</p> : null}
        </div>
        <div className="report-hero-actions">
          <button
            type="button"
            onClick={fetchReport}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--stroke)] bg-[var(--panel)] px-4 py-2 text-sm font-semibold text-[var(--text)] shadow-[var(--shadow)] hover:bg-[var(--panel-2)] disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Actualizando" : "Actualizar"}
          </button>
          <button
            type="button"
            onClick={exportPdf}
            disabled={pdfBusy}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-[var(--shadow-strong)] hover:brightness-110 disabled:opacity-60"
            style={{ background: accent }}
          >
            <FileDown className="h-4 w-4" />
            {pdfBusy ? "Descargando…" : "Descargar PDF"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
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

        <main className="space-y-6">
          <TabsBar tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
          {children}
          <div className="text-xs text-[var(--muted)]">
            {fetchedAt ? `Actualizado: ${fetchedAt.toLocaleString("es-MX")}` : "Sin carga inicial"}
          </div>
        </main>
      </div>

      <style jsx global>{`
        @import url("https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap");

        .report-shell {
          position: relative;
          max-width: 1600px;
          margin: 0 auto;
          padding-bottom: 2rem;
          font-family: "Outfit", system-ui, -apple-system, sans-serif;
        }

        .report-shell > * {
          position: relative;
          z-index: 1;
        }

        body {
          background: var(--bg) !important;
          background-image: none !important;
          color: var(--text);
        }

        :root {
          --bg: #f6f7fb;
          --panel: #ffffff;
          --panel-2: #f8fafc;
          --stroke: #e2e8f0;
          --text: #0b1220;
          --muted: #64748b;
          --accent: #0ea5e9;
          --shadow: 0 14px 36px rgba(15, 23, 42, 0.12);
          --shadow-strong: 0 24px 60px rgba(15, 23, 42, 0.18);
        }

        .dark {
          --bg: #0b0f14;
          --panel: #0f151d;
          --panel-2: #131b25;
          --stroke: #1f2a37;
          --text: #e2e8f0;
          --muted: #94a3b8;
          --accent: #22d3ee;
          --shadow: 0 18px 48px rgba(0, 0, 0, 0.45);
          --shadow-strong: 0 28px 70px rgba(0, 0, 0, 0.55);
        }

        .report-hero {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          align-items: center;
          gap: 1rem;
          padding: 1.5rem;
          border-radius: 24px;
          border: 1px solid var(--stroke);
          background: linear-gradient(120deg, rgba(14, 165, 233, 0.08), rgba(34, 197, 94, 0.08));
          box-shadow: var(--shadow);
        }

        .report-hero-left {
          display: grid;
          gap: 0.35rem;
        }

        .report-hero-eyebrow {
          text-transform: uppercase;
          font-size: 0.65rem;
          letter-spacing: 0.32em;
          color: var(--muted);
          font-weight: 600;
        }

        .report-hero-title {
          font-size: clamp(1.6rem, 2.4vw, 2.4rem);
          font-weight: 800;
          color: var(--text);
        }

        .report-hero-desc {
          color: var(--muted);
          font-size: 0.95rem;
          max-width: 54ch;
        }

        .report-hero-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
          justify-content: flex-end;
        }

        .chart-3d .chart-block {
          perspective: 1200px;
        }

        .chart-3d .chart-block svg {
          filter: drop-shadow(0 18px 34px rgba(15, 23, 42, 0.22));
          transform: rotateX(10deg) rotateZ(-1deg);
          transform-origin: bottom center;
        }

        @media (max-width: 960px) {
          .report-hero {
            grid-template-columns: 1fr;
          }

          .report-hero-actions {
            justify-content: flex-start;
          }
        }
      `}</style>
    </div>
  );
}
