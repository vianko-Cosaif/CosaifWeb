"use client";

import { LockKeyhole, Trash2 } from "lucide-react";
import type { TrackDraft } from "../types";

type Props = {
  tracks: TrackDraft[];
  inputClassName: string;
  onChange: (index: number, patch: Partial<TrackDraft>) => void;
  onRemove: (index: number) => void;
};

export function CatalogTrackEditor({ tracks, inputClassName, onChange, onRemove }: Props) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-zinc-800">
      <div className="hidden grid-cols-[90px_minmax(160px,1fr)_140px_120px_54px] gap-3 bg-slate-100 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-slate-500 dark:bg-zinc-900 dark:text-zinc-500 md:grid">
        <span>Número</span><span>Nombre</span><span>Secciones</span><span>Estado</span><span />
      </div>
      <div className="max-h-[520px] divide-y divide-slate-100 overflow-auto dark:divide-zinc-900">
        {tracks.map((track, index) => (
          <div key={track.id ? `via-${track.id}` : `new-${index}`} className="grid gap-3 p-3 md:grid-cols-[90px_minmax(160px,1fr)_140px_120px_54px] md:items-center">
            <MobileLabel label="Número"><input aria-label={`Número de vía ${index + 1}`} className={`${inputClassName} w-full`} type="number" min={1} value={track.numero} onChange={(event) => onChange(index, { numero: Number(event.target.value) })} /></MobileLabel>
            <MobileLabel label="Nombre"><input aria-label={`Nombre de vía ${track.numero}`} className={`${inputClassName} w-full`} value={track.nombre} maxLength={80} onChange={(event) => onChange(index, { nombre: event.target.value })} /></MobileLabel>
            <MobileLabel label="Secciones"><input aria-label={`Secciones de vía ${track.numero}`} className={`${inputClassName} w-full`} type="number" min={track.minimumSections ?? 0} max={200} value={track.secciones} onChange={(event) => onChange(index, { secciones: Number(event.target.value) })} /></MobileLabel>
            <div className="flex items-center justify-between gap-2 md:block">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 md:hidden">Estado</span>
              {track.occupiedSections ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-[10px] font-black text-amber-800 dark:bg-amber-950/50 dark:text-amber-200"><LockKeyhole className="h-3 w-3" /> {track.occupiedSections} ocupada(s)</span> : <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-black text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">Disponible</span>}
            </div>
            <button type="button" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-rose-200 px-3 text-sm font-bold text-rose-600 transition hover:bg-rose-50 dark:border-rose-900/60 dark:text-rose-300 dark:hover:bg-rose-950/30 md:h-11 md:w-11 md:px-0" onClick={() => onRemove(index)} aria-label={`Quitar vía ${track.nombre}`}><Trash2 className="h-4 w-4" /><span className="md:sr-only">Quitar vía</span></button>
          </div>
        ))}
      </div>
    </div>
  );
}

function MobileLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid min-w-0 grid-cols-[90px_1fr] items-center gap-2 md:block"><span className="text-[10px] font-black uppercase tracking-widest text-slate-400 md:sr-only">{label}</span>{children}</label>;
}
