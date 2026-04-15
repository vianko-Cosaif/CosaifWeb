"use client";

import React from "react";
import type { TopLocomotora } from "../../lib/types";
import { fmtMaybeInt, fmtMaybePct } from "../../lib/utils";

export default function ConcentradoLocomotorasTable({
  rows,
  onSelect,
}: {
  rows: TopLocomotora[];
  onSelect: (locomotora: string) => void;
}) {
  return (
    <section className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Operación</p>
          <h3 className="text-lg font-semibold text-slate-900">Concentrado por locomotora</h3>
        </div>
        <span className="text-sm text-slate-500">{fmtMaybeInt(rows?.length ?? 0)} locomotoras</span>
      </div>
      <div className="mt-4 w-full overflow-auto rounded-2xl border border-slate-200">
        <table className="min-w-[900px] w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left text-[11px] uppercase tracking-[0.2em] text-slate-400">
              <th className="px-4 py-3 font-semibold">Locomotora</th>
              <th className="px-4 py-3 font-semibold">Mov</th>
              <th className="px-4 py-3 font-semibold">Inc</th>
              <th className="px-4 py-3 font-semibold">% Inc</th>
              <th className="px-4 py-3 font-semibold">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {rows?.length ? (
              rows.map((row, idx) => (
                <tr key={`${row.locomotiveNumber}-${idx}`} className="border-t border-slate-200 hover:bg-slate-50">
                  <td className="px-4 py-3 font-semibold text-slate-900">{row.locomotiveNumber}</td>
                  <td className="px-4 py-3 text-slate-700">{fmtMaybeInt(row.totalMovimientos)}</td>
                  <td className="px-4 py-3 text-slate-700">{fmtMaybeInt(row.incidentesTotal)}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {fmtMaybePct(
                      row.totalMovimientos ? (row.incidentesTotal / row.totalMovimientos) * 100 : null
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => onSelect(String(row.locomotiveNumber ?? ""))}
                      className="rounded-full border border-slate-200 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
                    >
                      Ver movimientos
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr className="border-t border-slate-200">
                <td className="px-4 py-6 text-center text-sm text-slate-400" colSpan={5}>
                  Sin locomotoras en el rango seleccionado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
