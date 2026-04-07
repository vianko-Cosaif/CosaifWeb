"use client";

import React from "react";
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
  return (
    <aside className="space-y-4">
      <div className="rounded-2xl border border-[var(--stroke)] bg-[var(--panel)] p-4 shadow-[var(--shadow)]">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Periodo</div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {periodOptions.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriodo(p.id)}
              className={`rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] ${
                periodo === p.id ? "bg-slate-900 text-white" : "bg-[var(--panel-2)] text-[var(--muted)]"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--stroke)] bg-[var(--panel)] p-4 shadow-[var(--shadow)]">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Parámetros</div>
        <div className="mt-4 space-y-3 text-sm">
          {periodo === "dia" && (
            <input className="w-full rounded-xl border border-[var(--stroke)] bg-transparent px-3 py-2" type="date" value={diaISO} onChange={(e) => setDiaISO(e.target.value)} />
          )}
          {periodo === "semana" && (
            <input className="w-full rounded-xl border border-[var(--stroke)] bg-transparent px-3 py-2" type="date" value={semanaISO} onChange={(e) => setSemanaISO(e.target.value)} />
          )}
          {periodo === "mes" && (
            <input className="w-full rounded-xl border border-[var(--stroke)] bg-transparent px-3 py-2" type="month" value={mesYM} onChange={(e) => setMesYM(e.target.value)} />
          )}
          {periodo === "bimestre" && (
            <div className="flex gap-2">
              <input className="w-1/2 rounded-xl border border-[var(--stroke)] bg-transparent px-3 py-2" type="number" value={bimYear} onChange={(e) => setBimYear(Number(e.target.value))} />
              <input className="w-1/2 rounded-xl border border-[var(--stroke)] bg-transparent px-3 py-2" type="number" value={bimIndex} min={1} max={6} onChange={(e) => setBimIndex(Number(e.target.value))} />
            </div>
          )}
          {periodo === "semestre" && (
            <div className="flex gap-2">
              <input className="w-1/2 rounded-xl border border-[var(--stroke)] bg-transparent px-3 py-2" type="number" value={semYear} onChange={(e) => setSemYear(Number(e.target.value))} />
              <input className="w-1/2 rounded-xl border border-[var(--stroke)] bg-transparent px-3 py-2" type="number" value={semIndex} min={1} max={2} onChange={(e) => setSemIndex(Number(e.target.value))} />
            </div>
          )}
          {periodo === "anual" && (
            <input className="w-full rounded-xl border border-[var(--stroke)] bg-transparent px-3 py-2" type="number" value={anio} onChange={(e) => setAnio(Number(e.target.value))} />
          )}

          <select
            className="w-full rounded-xl border border-[var(--stroke)] bg-transparent px-3 py-2"
            value={empresaId}
            onChange={(e) => setEmpresaId(e.target.value)}
            disabled={lockEmpresa}
          >
            <option value="">Todas las empresas</option>
            {empresas.map((e) => (
              <option key={e.id} value={String(e.id)}>{e.nombre}</option>
            ))}
          </select>
          <select
            className="w-full rounded-xl border border-[var(--stroke)] bg-transparent px-3 py-2"
            value={localidadId}
            onChange={(e) => setLocalidadId(e.target.value)}
            disabled={lockLocalidad}
          >
            <option value="">Todas las localidades</option>
            {localidades.map((l) => (
              <option key={l.id} value={String(l.id)}>{l.nombre}</option>
            ))}
          </select>
        </div>
      </div>
    </aside>
  );
}
