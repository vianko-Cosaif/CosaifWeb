import React from "react";
import type { Empresa, Localidad, PeriodoUI } from "../lib/types";
import { clampInt } from "../lib/utils";

export default function FiltersSidebar({
  periodo,
  setPeriodo,
  periodOptions,
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
  empresas,
  localidades,
}: {
  periodo: PeriodoUI;
  setPeriodo: (v: PeriodoUI) => void;
  periodOptions: Array<{ id: PeriodoUI; label: string; icon: React.ElementType }>;
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
  empresas: Empresa[];
  localidades: Localidad[];
}) {
  return (
    <aside className="space-y-4 no-export">
      <div className="rounded-2xl border border-[var(--stroke)] bg-[var(--panel)] p-4 shadow-[var(--shadow)]">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
          Filtros
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {periodOptions.map((p) => {
            const Icon = p.icon;
            const active = p.id === periodo;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriodo(p.id)}
                className={`flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.15em] transition ${
                  active
                    ? "bg-slate-900 text-white"
                    : "bg-[var(--panel-2)] text-[var(--muted)] hover:brightness-95"
                }`}
              >
                <Icon className="h-4 w-4" />
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--stroke)] bg-[var(--panel)] p-4 shadow-[var(--shadow)]">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Parametros</div>
        <div className="mt-3 space-y-3">
          {periodo === "dia" && (
            <div className="space-y-1">
              <label className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">Fecha</label>
              <input
                type="date"
                value={diaISO}
                onChange={(e) => setDiaISO(e.target.value)}
                className="w-full rounded-xl border border-[var(--stroke)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--text)]"
              />
            </div>
          )}

          {periodo === "semana" && (
            <div className="space-y-1">
              <label className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">Semana</label>
              <input
                type="date"
                value={semanaISO}
                onChange={(e) => setSemanaISO(e.target.value)}
                className="w-full rounded-xl border border-[var(--stroke)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--text)]"
              />
            </div>
          )}

          {periodo === "mes" && (
            <div className="space-y-1">
              <label className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">Mes</label>
              <input
                type="month"
                value={mesYM}
                onChange={(e) => setMesYM(e.target.value)}
                className="w-full rounded-xl border border-[var(--stroke)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--text)]"
              />
            </div>
          )}

          {periodo === "bimestre" && (
            <>
              <div className="space-y-1">
                <label className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">Año</label>
                <input
                  type="number"
                  min={2000}
                  max={2100}
                  value={bimYear}
                  onChange={(e) => setBimYear(clampInt(e.target.value, 2000, 2100))}
                  className="w-full rounded-xl border border-[var(--stroke)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--text)]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">Bimestre</label>
                <select
                  value={bimIndex}
                  onChange={(e) => setBimIndex(clampInt(e.target.value, 1, 6))}
                  className="w-full rounded-xl border border-[var(--stroke)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--text)]"
                >
                  <option value={1}>B01</option>
                  <option value={2}>B02</option>
                  <option value={3}>B03</option>
                  <option value={4}>B04</option>
                  <option value={5}>B05</option>
                  <option value={6}>B06</option>
                </select>
              </div>
            </>
          )}

          {periodo === "semestre" && (
            <>
              <div className="space-y-1">
                <label className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">Año</label>
                <input
                  type="number"
                  min={2000}
                  max={2100}
                  value={semYear}
                  onChange={(e) => setSemYear(clampInt(e.target.value, 2000, 2100))}
                  className="w-full rounded-xl border border-[var(--stroke)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--text)]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">Semestre</label>
                <select
                  value={semIndex}
                  onChange={(e) => setSemIndex(clampInt(e.target.value, 1, 2))}
                  className="w-full rounded-xl border border-[var(--stroke)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--text)]"
                >
                  <option value={1}>S1</option>
                  <option value={2}>S2</option>
                </select>
              </div>
            </>
          )}

          {periodo === "anual" && (
            <div className="space-y-1">
              <label className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">Año</label>
              <input
                type="number"
                min={2000}
                max={2100}
                value={anio}
                onChange={(e) => setAnio(clampInt(e.target.value, 2000, 2100))}
                className="w-full rounded-xl border border-[var(--stroke)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--text)]"
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">Empresa</label>
            <select
              value={empresaId}
              onChange={(e) => setEmpresaId(e.target.value)}
              className="w-full rounded-xl border border-[var(--stroke)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--text)]"
            >
              <option value="">Todas</option>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">Localidad</label>
            <select
              value={localidadId}
              onChange={(e) => setLocalidadId(e.target.value)}
              className="w-full rounded-xl border border-[var(--stroke)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--text)]"
            >
              <option value="">Todas</option>
              {localidades.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nombre}
                  {l.estado ? ` (${l.estado})` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </aside>
  );
}
