"use client";

import React from "react";
import type { TopEmpresa, TopLocomotora } from "../lib/types";
import { fmtInt, fmtMaybePct, hasArray, n } from "../lib/utils";

function SimpleTable({
  title,
  columns,
  rows,
}: {
  title: string;
  columns: Array<{ key: string; label: string; format?: (v: any) => string }>;
  rows: Array<Record<string, any>>;
}) {
  if (!hasArray(rows)) return null;
  return (
    <div className="rounded-2xl border border-[var(--stroke)] bg-[var(--panel)] p-4 shadow-[var(--shadow)]">
      <div className="text-sm font-semibold text-[var(--text)]">{title}</div>
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
              {columns.map((c) => (
                <th key={c.key} className="px-3 py-2">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={`${title}-${idx}`} className="border-t border-[var(--stroke)]">
                {columns.map((c) => (
                  <td key={`${c.key}-${idx}`} className="px-3 py-2">
                    {c.format ? c.format(row[c.key]) : String(row[c.key] ?? "—")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function RankingsSection({
  topEmpresas,
  topLocomotoras,
}: {
  topEmpresas: TopEmpresa[];
  topLocomotoras: TopLocomotora[];
}) {
  return (
    <div className="space-y-4">
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
      <SimpleTable
        title="Top locomotoras"
        rows={topLocomotoras}
        columns={[
          { key: "locomotiveNumber", label: "Locomotora" },
          { key: "totalMovimientos", label: "Mov", format: (v) => fmtInt.format(n(v)) },
          { key: "incidentesTotal", label: "Inc", format: (v) => fmtInt.format(n(v)) },
        ]}
      />
    </div>
  );
}
