"use client";

import React, { useMemo, useState } from "react";
import type { CronologiaCierre, MovimientoDetalle, TopEmpresa, TopLocomotora } from "../lib/types";
import { fmtInt, fmtMaybePct, hasArray, n } from "../lib/utils";
import ConcentradoLocomotorasTable from "./rankings/ConcentradoLocomotorasTable";
import CronologiaMovimientosSection from "./rankings/CronologiaMovimientosSection";
import LocomotoraDetalleModal from "./rankings/LocomotoraDetalleModal";

function SimpleTable({
  title,
  columns,
  rows,
}: {
  title: string;
  columns: Array<{ key: string; label: string; format?: (v: unknown) => string }>;
  rows: Array<Record<string, unknown>>;
}) {
  if (!hasArray(rows)) return null;
  return (
    <section className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 sm:p-5 shadow-sm">
      <div className="text-sm font-semibold text-[var(--app-text)]">{title}</div>
      <div className="mt-4 w-full overflow-auto rounded-2xl border border-[var(--app-border)]">
        <table className="min-w-[680px] w-full text-sm">
          <thead className="bg-[var(--app-surface-subtle)]">
            <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-[var(--app-text-muted)]">
              {columns.map((c) => (
                <th key={c.key} className="px-4 py-3 font-semibold">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={`${title}-${idx}`} className="border-t border-[var(--app-border)]">
                {columns.map((c) => (
                  <td key={`${c.key}-${idx}`} className="px-4 py-3 text-[var(--app-text)]">
                    {c.format ? c.format(row[c.key]) : String(row[c.key] ?? "—")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function RankingsSection({
  topEmpresas,
  topLocomotoras,
  movimientosDetalle,
  cronologiaMovimientos,
}: {
  topEmpresas: TopEmpresa[];
  topLocomotoras: TopLocomotora[];
  movimientosDetalle: MovimientoDetalle[];
  cronologiaMovimientos: CronologiaCierre[];
}) {
  const [activeLoc, setActiveLoc] = useState<string | null>(null);

  const movimientos = useMemo(() => {
    if (!activeLoc) return [];
    return (movimientosDetalle ?? []).filter(
      (m) => String(m.locomotiveNumber ?? "") === String(activeLoc)
    );
  }, [activeLoc, movimientosDetalle]);

  return (
    <div className="space-y-6">
      <SimpleTable
        title="Top empresas"
        rows={topEmpresas}
        columns={[
          { key: "empresa", label: "Empresa" },
          { key: "totalMovimientos", label: "Mov", format: (v) => fmtInt.format(n(v)) },
          { key: "incidentesTotal", label: "Inc", format: (v) => fmtInt.format(n(v)) },
          { key: "incidentesPct", label: "% Inc", format: (v) => fmtMaybePct(v) },
        ]}
      />

      <ConcentradoLocomotorasTable rows={topLocomotoras} onSelect={setActiveLoc} />

      <CronologiaMovimientosSection data={cronologiaMovimientos} />

      {activeLoc ? (
        <LocomotoraDetalleModal
          locomotora={activeLoc}
          movimientos={movimientos}
          onClose={() => setActiveLoc(null)}
        />
      ) : null}
    </div>
  );
}
