"use client";

import React from "react";
import type { CronologiaCierre } from "../../lib/types";
import { fmtMaybeInt } from "../../lib/utils";

export default function CronologiaMovimientosSection({ data }: { data: CronologiaCierre[] }) {
  const total = data?.reduce((acc, d) => acc + (d.movimientos?.length ?? 0), 0) ?? 0;

  return (
    <section className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Cronología</p>
          <h3 className="text-lg font-semibold text-slate-900">Cronología de movimientos</h3>
        </div>
        <span className="text-sm text-slate-500">{fmtMaybeInt(total)} movimientos</span>
      </div>

      <div className="mt-4 space-y-4">
        {data?.length ? (
          data.map((dia, idx) => (
            <div key={`${dia.fecha ?? "fecha"}-${idx}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                  {dia.fecha ?? "Fecha"}
                </span>
                <span className="text-xs text-slate-400">
                  {fmtMaybeInt(dia.movimientos?.length ?? 0)} movimientos
                </span>
              </div>
              <div className="mt-3 w-full overflow-auto rounded-xl border border-slate-200 bg-white">
                <table className="min-w-[1200px] w-full text-sm">
                  <thead className="bg-slate-100">
                    <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-slate-400">
                      <th className="px-4 py-3">#</th>
                      <th className="px-4 py-3">Mov</th>
                      <th className="px-4 py-3">Loco</th>
                      <th className="px-4 py-3">Estado</th>
                      <th className="px-4 py-3">Empresa</th>
                      <th className="px-4 py-3">Localidad</th>
                      <th className="px-4 py-3">Solicitud</th>
                      <th className="px-4 py-3">Inicio</th>
                      <th className="px-4 py-3">Fin</th>
                      <th className="px-4 py-3">Origen → Destino</th>
                      <th className="px-4 py-3">Solicita</th>
                      <th className="px-4 py-3">Operador</th>
                      <th className="px-4 py-3">Comentarios</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dia.movimientos?.length ? (
                      dia.movimientos.map((mov) => (
                        <tr key={`${dia.fecha ?? "f"}-${mov.id}`} className="border-t border-slate-200">
                          <td className="px-4 py-3 font-semibold text-slate-700">{mov.ordenDia ?? "—"}</td>
                          <td className="px-4 py-3 font-semibold text-slate-900">{mov.id ?? "—"}</td>
                          <td className="px-4 py-3 text-slate-700">{mov.locomotiveNumber ?? "—"}</td>
                          <td className="px-4 py-3 text-slate-700">{mov.estado ?? "—"}</td>
                          <td className="px-4 py-3 text-slate-700">{mov.empresa ?? "—"}</td>
                          <td className="px-4 py-3 text-slate-700">{mov.localidad ?? "—"}</td>
                          <td className="px-4 py-3 text-slate-700">{mov.fechaSolicitudMX ?? "—"}</td>
                          <td className="px-4 py-3 text-slate-700">{mov.fechaInicioMX ?? "—"}</td>
                          <td className="px-4 py-3 text-slate-700">{mov.fechaFinMX ?? "—"}</td>
                          <td className="px-4 py-3 text-slate-700">
                            {mov.viaOrigen ?? "—"} → {mov.viaDestino ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-slate-700">{mov.solicitadoPor?.nombre ?? "—"}</td>
                          <td className="px-4 py-3 text-slate-700">{mov.operador?.nombre ?? "—"}</td>
                          <td className="px-4 py-3 text-slate-500">{mov.comentarios ?? "—"}</td>
                        </tr>
                      ))
                    ) : (
                      <tr className="border-t border-slate-200">
                        <td className="px-4 py-4 text-center text-sm text-slate-400" colSpan={13}>
                          Sin movimientos.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">
            Sin cronología para el periodo seleccionado.
          </div>
        )}
      </div>
    </section>
  );
}
