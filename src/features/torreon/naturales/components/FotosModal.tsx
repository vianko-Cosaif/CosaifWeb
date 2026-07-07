/* eslint-disable @next/next/no-img-element */
import { ImageIcon, X } from "lucide-react";
import { STAGES } from "../constants";
import type { MovimientoNatural } from "../types";
import { formatDate } from "../utils";

type Props = {
  movimiento: MovimientoNatural;
  onClose: () => void;
};

export function FotosModal({ movimiento, onClose }: Props) {
  const fotosPorTipo = movimiento.fotosPorTipo || {};
  const totalFotos = (movimiento.fotos || []).length;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-4 dark:bg-black/75">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-4 dark:border-slate-800">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Evidencias movimiento</p>
            <h3 className="mt-1 text-xl font-black text-slate-950 dark:text-white">Movimiento #{movimiento.id}</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Loco {movimiento.locomotiveNumber || "--"} · {movimiento.viaOrigen || "--"} a {movimiento.viaDestino || "--"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
            aria-label="Cerrar visor de imagenes"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {totalFotos === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 text-slate-500 dark:border-slate-700 dark:text-slate-400">
              <ImageIcon className="h-10 w-10" />
              <p className="mt-3 text-sm font-bold">Sin imagenes capturadas</p>
            </div>
          ) : (
            <div className="space-y-5">
              {STAGES.map((stage) => {
                const fotos = fotosPorTipo[stage.key] || [];
                return (
                  <section key={stage.key}>
                    <div className="mb-2 flex items-center justify-between">
                      <h4 className="text-sm font-black uppercase tracking-wide text-slate-700 dark:text-slate-200">{stage.label}</h4>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                        {fotos.length}/2
                      </span>
                    </div>
                    {fotos.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm font-semibold text-slate-400 dark:border-slate-700 dark:text-slate-500">
                        Sin capturas en esta etapa.
                      </div>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {fotos.map((foto) => (
                          <figure key={`${stage.key}-${foto.id ?? foto.orden}`} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40">
                            <img src={foto.url} alt={`${stage.label} ${foto.orden}`} className="h-64 w-full object-contain bg-slate-950" />
                            <figcaption className="space-y-1 p-3 text-xs text-slate-500 dark:text-slate-400">
                              <p className="font-bold text-slate-700 dark:text-slate-200">Captura {foto.orden}</p>
                              <p>{formatDate(foto.tomadaAt)}</p>
                              {foto.comentario ? <p>{foto.comentario}</p> : null}
                            </figcaption>
                          </figure>
                        ))}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
