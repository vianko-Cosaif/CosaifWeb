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
    <div className="coor-shell space-y-6">
      <div className="coor-hero">
        <div>
          <div className="coor-hero-eyebrow">Reportería Coordinador</div>
          <h2 className="coor-hero-title">{title}</h2>
          {subtitle ? <p className="coor-hero-desc">{subtitle}</p> : null}
        </div>
        <div className="coor-hero-actions">
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
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-[var(--shadow-strong)] hover:brightness-110 disabled:opacity-60"
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

      <div className="coor-grid grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <FiltersSidebar {...filters} />

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
        .coor-shell {
          position: relative;
          max-width: 1600px;
          margin: 0 auto;
          padding-bottom: 2rem;
          font-family: "Outfit", system-ui, -apple-system, sans-serif;
        }
        :root {
          --bg: #f7f8fb;
          --panel: #ffffff;
          --panel-2: #f8fafc;
          --stroke: #e2e8f0;
          --text: #0b1220;
          --muted: #64748b;
          --shadow: 0 14px 36px rgba(15, 23, 42, 0.12);
          --shadow-strong: 0 24px 60px rgba(15, 23, 42, 0.18);
        }
        body {
          background: var(--bg) !important;
        }
        .coor-hero {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          align-items: center;
          gap: 1rem;
          padding: 1.5rem;
          border-radius: 24px;
          border: 1px solid var(--stroke);
          background: linear-gradient(120deg, rgba(15, 23, 42, 0.04), rgba(59, 130, 246, 0.08));
          box-shadow: var(--shadow);
        }
        .coor-hero-eyebrow {
          text-transform: uppercase;
          font-size: 0.65rem;
          letter-spacing: 0.32em;
          color: var(--muted);
          font-weight: 600;
        }
        .coor-hero-title {
          font-size: clamp(1.6rem, 2.4vw, 2.4rem);
          font-weight: 800;
          color: var(--text);
        }
        .coor-hero-desc {
          color: var(--muted);
          font-size: 0.95rem;
          max-width: 54ch;
        }
        .coor-hero-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
          justify-content: flex-end;
        }
        .chart-block {
          perspective: 1200px;
        }
        .chart-block svg {
          filter: drop-shadow(0 18px 34px rgba(15, 23, 42, 0.18));
          transform: rotateX(8deg);
          transform-origin: bottom center;
        }
        @media (max-width: 960px) {
          .coor-hero {
            grid-template-columns: 1fr;
          }
          .coor-hero-actions {
            justify-content: flex-start;
          }
        }
      `}</style>
    </div>
  );
}
