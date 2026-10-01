/* eslint-disable @next/next/no-img-element -- Evidencia privada: las imágenes usan la sesión del navegador y URLs de objetos locales. */
"use client";

import React, { useMemo, useState } from "react";
import Modal from "@/components/ui/Modal";
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
    <Modal title={`Locomotora ${locomotora}`} onClose={onClose} maxWidth="max-w-5xl" bodyClassName="p-0 sm:p-0">
      <p className="px-4 pt-4 text-sm text-[var(--app-text-muted)] sm:px-6">
        {fmtMaybeInt(movimientos.length)} movimientos · {fmtMaybeInt(incidentes.length)} incidentes
      </p>
        <div className="flex flex-wrap gap-2 px-6 py-3">
          <button
            type="button"
            aria-pressed={tab === "mov"}
            onClick={() => setTab("mov")}
            className={`min-h-9 rounded-lg px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] ${
              tab === "mov" ? "bg-[var(--app-text)] text-[var(--app-surface)]" : "bg-[var(--app-surface-muted)] text-[var(--app-text-muted)]"
            }`}
          >
            Movimientos
          </button>
          <button
            type="button"
            aria-pressed={tab === "inc"}
            onClick={() => setTab("inc")}
            disabled={!incidentes.length}
            className={`min-h-9 rounded-lg px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] ${
              tab === "inc" ? "bg-[var(--app-text)] text-[var(--app-surface)]" : "bg-[var(--app-surface-muted)] text-[var(--app-text-muted)]"
            } ${!incidentes.length ? "opacity-50" : ""}`}
          >
            Incidentes {incidentes.length ? `(${incidentes.length})` : ""}
          </button>
        </div>

        {tab === "mov" && (
          <div className="max-h-[60vh] overflow-auto px-6 pb-6">
            <div className="overflow-auto rounded-2xl border border-[var(--app-border)]">
              <table className="min-w-[1100px] w-full text-sm">
                <thead className="bg-[var(--app-surface-subtle)]">
                  <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-[var(--app-text-muted)]">
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
                    <tr key={String(m.id)} className="border-t border-[var(--app-border)]">
                      <td className="px-4 py-3 font-semibold text-[var(--app-text)]">{m.id ?? "—"}</td>
                      <td className="px-4 py-3 text-[var(--app-text)]">{m.estado ?? "—"}</td>
                      <td className="px-4 py-3 text-[var(--app-text)]">{m.fechaSolicitudMX ?? "—"}</td>
                      <td className="px-4 py-3 text-[var(--app-text)]">{m.fechaInicioMX ?? "—"}</td>
                      <td className="px-4 py-3 text-[var(--app-text)]">{m.fechaFinMX ?? "—"}</td>
                      <td className="px-4 py-3 text-[var(--app-text)]">
                        {m.viaOrigen ?? "—"} → {m.viaDestino ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-[var(--app-text)]">{m.solicitadoPor?.nombre ?? "—"}</td>
                      <td className="px-4 py-3 text-[var(--app-text)]">{m.operador?.nombre ?? "—"}</td>
                      <td className="px-4 py-3 text-[var(--app-text-muted)]">{m.comentarios ?? "—"}</td>
                    </tr>
                  ))}
                  {!movimientos.length && (
                    <tr className="border-t border-[var(--app-border)]">
                      <td className="px-4 py-4 text-center text-sm text-[var(--app-text-muted)]" colSpan={9}>
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
            <div className="overflow-auto rounded-2xl border border-[var(--app-border)]">
              <table className="min-w-[1100px] w-full text-sm">
                <thead className="bg-[var(--app-surface-subtle)]">
                  <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-[var(--app-text-muted)]">
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
                      <tr key={`${inc.id}-${idx}`} className="border-t border-[var(--app-border)]">
                        <td className="px-4 py-3 font-semibold text-[var(--app-text)]">{inc.movimientoId ?? "—"}</td>
                        <td className="px-4 py-3 text-[var(--app-text)]">{inc.id ?? "—"}</td>
                        <td className="px-4 py-3 text-[var(--app-text)]">{inc.estado ?? "—"}</td>
                        <td className="px-4 py-3 text-[var(--app-text-muted)]">{inc.descripcion ?? "—"}</td>
                        <td className="px-4 py-3 text-[var(--app-text)]">{inc.fechaInicioMX ?? "—"}</td>
                        <td className="px-4 py-3 text-[var(--app-text)]">{inc.fechaFinMX ?? "—"}</td>
                        <td className="px-4 py-3 text-[var(--app-text)]">{inc.usuario?.nombre ?? "—"}</td>
                        <td className="px-4 py-3">
                          {list?.length ? (
                            <div className="grid grid-cols-3 gap-2">
                              {list.map((raw, i) => {
                                const url = viaProxy(raw);
                                return (
                                  <a
                                    key={`${raw}-${i}`}
                                    className="block overflow-hidden rounded-lg border border-[var(--app-border)]"
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
                    <tr className="border-t border-[var(--app-border)]">
                      <td className="px-4 py-4 text-center text-sm text-[var(--app-text-muted)]" colSpan={8}>
                        Sin incidentes ligados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
    </Modal>
  );
}
