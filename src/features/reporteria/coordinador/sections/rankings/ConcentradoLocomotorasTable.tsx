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
    <section className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 sm:p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--app-text-muted)]">Operación</p>
          <h3 className="text-lg font-semibold text-[var(--app-text)]">Concentrado por locomotora</h3>
        </div>
        <span className="text-sm text-[var(--app-text-muted)]">{fmtMaybeInt(rows?.length ?? 0)} locomotoras</span>
      </div>
      <div className="mt-4 w-full overflow-auto rounded-2xl border border-[var(--app-border)]">
        <table className="min-w-[900px] w-full text-sm">
          <thead className="bg-[var(--app-surface-subtle)]">
            <tr className="text-left text-[11px] uppercase tracking-[0.2em] text-[var(--app-text-muted)]">
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
                <tr key={`${row.locomotiveNumber}-${idx}`} className="border-t border-[var(--app-border)] hover:bg-[var(--app-surface-subtle)]">
                  <td className="px-4 py-3 font-semibold text-[var(--app-text)]">{row.locomotiveNumber}</td>
                  <td className="px-4 py-3 text-[var(--app-text)]">{fmtMaybeInt(row.totalMovimientos)}</td>
                  <td className="px-4 py-3 text-[var(--app-text)]">{fmtMaybeInt(row.incidentesTotal)}</td>
                  <td className="px-4 py-3 text-[var(--app-text)]">
                    {fmtMaybePct(
                      row.totalMovimientos ? (row.incidentesTotal / row.totalMovimientos) * 100 : null
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => onSelect(String(row.locomotiveNumber ?? ""))}
                      className="rounded-full border border-[var(--app-border)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--app-text-muted)] transition hover:border-[var(--app-border-strong)] hover:text-[var(--app-text)]"
                    >
                      Ver movimientos
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr className="border-t border-[var(--app-border)]">
                <td className="px-4 py-6 text-center text-sm text-[var(--app-text-muted)]" colSpan={5}>
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
