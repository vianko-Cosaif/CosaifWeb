"use client";

import React, { useMemo, useState } from "react";
import type { IncidenteDetalle, MovimientoDetalle } from "../../lib/types";
import { fmtMaybeInt } from "../../lib/utils";

const PROXY = "/bff";

function viaProxy(u: string) {
  if (!u) return "";
  if (u.startsWith(`${PROXY}/`) || u === PROXY) return u;
  if (u.startsWith("/")) return `${PROXY}${u}`;
  if (/^https?:\/\//i.test(u)) {
    try {
      const url = new URL(u);
      return `${PROXY}${url.pathname}${url.search}`;
    } catch {
      return u;
    }
  }
  return `${PROXY}/${u.replace(/^\/+/, "")}`;
}

export default function LocomotoraDetalleModal({
  locomotora,
  movimientos,
  onClose,
}: {
  locomotora: string;
  movimientos: MovimientoDetalle[];
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"mov" | "inc">("mov");

  const incidentes = useMemo(() => {
    const rows: Array<IncidenteDetalle & { movimientoId?: number | string }> = [];
    movimientos.forEach((mov) => {
      (mov.incidentes ?? []).forEach((inc) => {
        rows.push({ ...inc, movimientoId: mov.id });
      });
    });
    return rows;
  }, [movimientos]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Cerrar"
      />
      <div className="relative z-10 w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Detalle de locomotora</p>
            <h3 className="text-lg font-semibold text-slate-900">Locomotora {locomotora}</h3>
            <p className="text-sm text-slate-500">
              {fmtMaybeInt(movimientos.length)} movimientos · {fmtMaybeInt(incidentes.length)} incidentes
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 hover:text-slate-900"
          >
            Cerrar
          </button>
        </div>

        <div className="flex flex-wrap gap-2 px-6 py-3">
          <button
            type="button"
            onClick={() => setTab("mov")}
            className={`rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] ${
              tab === "mov" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500"
            }`}
          >
            Movimientos
          </button>
          <button
            type="button"
            onClick={() => setTab("inc")}
            disabled={!incidentes.length}
            className={`rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] ${
              tab === "inc" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500"
            } ${!incidentes.length ? "opacity-50" : ""}`}
          >
            Incidentes {incidentes.length ? `(${incidentes.length})` : ""}
          </button>
        </div>

        {tab === "mov" && (
          <div className="max-h-[60vh] overflow-auto px-6 pb-6">
            <div className="overflow-auto rounded-2xl border border-slate-200">
              <table className="min-w-[1100px] w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-slate-400">
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">Estado</th>
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
                  {movimientos.map((m) => (
                    <tr key={String(m.id)} className="border-t border-slate-200">
                      <td className="px-4 py-3 font-semibold text-slate-900">{m.id ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-700">{m.estado ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-700">{m.fechaSolicitudMX ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-700">{m.fechaInicioMX ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-700">{m.fechaFinMX ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-700">
                        {m.viaOrigen ?? "—"} → {m.viaDestino ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{m.solicitadoPor?.nombre ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-700">{m.operador?.nombre ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-500">{m.comentarios ?? "—"}</td>
                    </tr>
                  ))}
                  {!movimientos.length && (
                    <tr className="border-t border-slate-200">
                      <td className="px-4 py-4 text-center text-sm text-slate-400" colSpan={9}>
                        Sin movimientos para esta locomotora.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "inc" && (
          <div className="max-h-[60vh] overflow-auto px-6 pb-6">
            <div className="overflow-auto rounded-2xl border border-slate-200">
              <table className="min-w-[1100px] w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-slate-400">
                    <th className="px-4 py-3">Mov</th>
                    <th className="px-4 py-3">Incidente</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Descripción</th>
                    <th className="px-4 py-3">Inicio</th>
                    <th className="px-4 py-3">Fin</th>
                    <th className="px-4 py-3">Usuario</th>
                    <th className="px-4 py-3">Imágenes</th>
                  </tr>
                </thead>
                <tbody>
                  {incidentes.map((inc, idx) => {
                    const list =
                      inc.imagenUrls?.length
                        ? inc.imagenUrls
                        : (inc.imagenes ?? []).map((p) =>
                            /^https?:\/\//i.test(p) ? p : `/incidentes/imagen/${encodeURIComponent(p)}`
                          );
                    return (
                      <tr key={`${inc.id}-${idx}`} className="border-t border-slate-200">
                        <td className="px-4 py-3 font-semibold text-slate-900">{inc.movimientoId ?? "—"}</td>
                        <td className="px-4 py-3 text-slate-700">{inc.id ?? "—"}</td>
                        <td className="px-4 py-3 text-slate-700">{inc.estado ?? "—"}</td>
                        <td className="px-4 py-3 text-slate-500">{inc.descripcion ?? "—"}</td>
                        <td className="px-4 py-3 text-slate-700">{inc.fechaInicioMX ?? "—"}</td>
                        <td className="px-4 py-3 text-slate-700">{inc.fechaFinMX ?? "—"}</td>
                        <td className="px-4 py-3 text-slate-700">{inc.usuario?.nombre ?? "—"}</td>
                        <td className="px-4 py-3">
                          {list?.length ? (
                            <div className="grid grid-cols-3 gap-2">
                              {list.map((raw, i) => {
                                const url = viaProxy(raw);
                                return (
                                  <a
                                    key={`${raw}-${i}`}
                                    className="block overflow-hidden rounded-lg border border-slate-200"
                                    href={url}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    <img
                                      src={url}
                                      alt={`Incidente ${inc.id ?? ""} imagen ${i + 1}`}
                                      loading="lazy"
                                      className="h-20 w-full object-cover"
                                    />
                                  </a>
                                );
                              })}
                            </div>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {!incidentes.length && (
                    <tr className="border-t border-slate-200">
                      <td className="px-4 py-4 text-center text-sm text-slate-400" colSpan={8}>
                        Sin incidentes ligados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
