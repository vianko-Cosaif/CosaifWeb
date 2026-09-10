"use client";

import React from "react";
import FieldShell from "@/components/ui/FieldShell";
import type { PeriodoUI } from "../lib/types";

const periodOptions: Array<{ id: PeriodoUI; label: string }> = [
  { id: "dia", label: "Día" },
  { id: "semana", label: "Semana" },
  { id: "mes", label: "Mes" },
  { id: "bimestre", label: "Bimestre" },
  { id: "semestre", label: "Semestre" },
  { id: "anual", label: "Anual" },
];

export default function FiltersSidebar({
  variant = "sidebar",
  periodo,
  setPeriodo,
  diaISO,
  setDiaISO,
  semanaISO,
  setSemanaISO,
  mesYM,
  setMesYM,
  bimYear,
  setBimYear,
  bimIndex,
  setBimIndex,
  semYear,
  setSemYear,
  semIndex,
  setSemIndex,
  anio,
  setAnio,
  empresaId,
  setEmpresaId,
  localidadId,
  setLocalidadId,
  lockEmpresa,
  lockLocalidad,
  empresas,
  localidades,
}: {
  variant?: "sidebar" | "inline";
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
}) {
  const wrapperClass =
    variant === "inline"
      ? "grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]"
      : "space-y-4";

  return (
    <section className={wrapperClass}>
      <div className="min-w-0 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 sm:p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--app-text-muted)]">Periodo</p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {periodOptions.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={periodo === p.id}
              onClick={() => setPeriodo(p.id)}
              className={`rounded-full px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] transition ${
                periodo === p.id
                  ? "bg-[var(--app-text)] text-[var(--app-surface)]"
                  : "bg-[var(--app-surface-muted)] text-[var(--app-text-muted)] hover:bg-[var(--app-surface-subtle)]"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-w-0 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 sm:p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--app-text-muted)]">Parámetros</p>
        <div className="mt-4 space-y-3 text-sm">
          {periodo === "dia" && (
            <FieldShell label="Día"><input
              className="w-full min-w-0 border-0 bg-transparent p-0 text-sm text-[var(--app-text)] outline-none focus:ring-0"
              type="date"
              value={diaISO}
              onChange={(e) => setDiaISO(e.target.value)}
            /></FieldShell>
          )}
          {periodo === "semana" && (
            <FieldShell label="Semana del"><input
              className="w-full min-w-0 border-0 bg-transparent p-0 text-sm text-[var(--app-text)] outline-none focus:ring-0"
              type="date"
              value={semanaISO}
              onChange={(e) => setSemanaISO(e.target.value)}
            /></FieldShell>
          )}
          {periodo === "mes" && (
            <FieldShell label="Mes"><input
              className="w-full min-w-0 border-0 bg-transparent p-0 text-sm text-[var(--app-text)] outline-none focus:ring-0"
              type="month"
              value={mesYM}
              onChange={(e) => setMesYM(e.target.value)}
            /></FieldShell>
          )}
          {periodo === "bimestre" && (
            <div className="grid grid-cols-2 gap-2">
              <FieldShell label="Año"><input
                className="w-full min-w-0 border-0 bg-transparent p-0 text-sm text-[var(--app-text)] outline-none focus:ring-0"
                type="number" min={2000} max={2100}
                value={bimYear}
                onChange={(e) => setBimYear(Number(e.target.value))}
              /></FieldShell>
              <FieldShell label="Bimestre (1–6)"><input
                className="w-full min-w-0 border-0 bg-transparent p-0 text-sm text-[var(--app-text)] outline-none focus:ring-0"
                type="number"
                value={bimIndex}
                min={1}
                max={6}
                onChange={(e) => setBimIndex(Number(e.target.value))}
              /></FieldShell>
            </div>
          )}
          {periodo === "semestre" && (
            <div className="grid grid-cols-2 gap-2">
              <FieldShell label="Año"><input
                className="w-full min-w-0 border-0 bg-transparent p-0 text-sm text-[var(--app-text)] outline-none focus:ring-0"
                type="number" min={2000} max={2100}
                value={semYear}
                onChange={(e) => setSemYear(Number(e.target.value))}
              /></FieldShell>
              <FieldShell label="Semestre (1–2)"><input
                className="w-full min-w-0 border-0 bg-transparent p-0 text-sm text-[var(--app-text)] outline-none focus:ring-0"
                type="number"
                value={semIndex}
                min={1}
                max={2}
                onChange={(e) => setSemIndex(Number(e.target.value))}
              /></FieldShell>
            </div>
          )}
          {periodo === "anual" && (
            <FieldShell label="Año"><input
              className="w-full min-w-0 border-0 bg-transparent p-0 text-sm text-[var(--app-text)] outline-none focus:ring-0"
              type="number" min={2000} max={2100}
              value={anio}
              onChange={(e) => setAnio(Number(e.target.value))}
            /></FieldShell>
          )}

          <FieldShell label="Empresa"><select
            className="w-full min-w-0 border-0 bg-transparent p-0 text-sm text-[var(--app-text)] outline-none focus:ring-0"
            value={empresaId}
            onChange={(e) => setEmpresaId(e.target.value)}
            disabled={lockEmpresa}
          >
            <option value="">Todas las empresas</option>
            {empresas.map((e) => (
              <option key={e.id} value={String(e.id)}>
                {e.nombre}
              </option>
            ))}
          </select></FieldShell>
          <FieldShell label="Localidad"><select
            className="w-full min-w-0 border-0 bg-transparent p-0 text-sm text-[var(--app-text)] outline-none focus:ring-0"
            value={localidadId}
            onChange={(e) => setLocalidadId(e.target.value)}
            disabled={lockLocalidad}
          >
            <option value="">Todas las localidades</option>
            {localidades.map((l) => (
              <option key={l.id} value={String(l.id)}>
                {l.nombre}
              </option>
            ))}
          </select></FieldShell>
          {lockLocalidad ? <p className="text-xs text-[var(--app-text-muted)]">La localidad corresponde al patio asignado a tu cuenta.</p> : null}
        </div>
      </div>
    </section>
  );
}
