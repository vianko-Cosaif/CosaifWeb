import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, ArrowRight, CheckCircle2, Flag, Loader2, MapPin, Pencil, X } from "lucide-react";
import { ARRASTRE_MAX_CAPACITY, arrastreVagonCapacity } from "@/features/torreon/arrastres/constants";
import type { CargaVagon, EditArrastreDraft, EditArrastreVagonDraft, OperationalVia } from "../types";

type Props = {
  draft: EditArrastreDraft;
  vias: OperationalVia[];
  catalogLoading: boolean;
  catalogError: string | null;
  error: string | null;
  busy: boolean;
  onInstructionsChange: (value: string) => void;
  onReasonChange: (value: string) => void;
  onUpdateVagon: (vagonId: number, patch: Partial<EditArrastreVagonDraft>) => void;
  onClose: () => void;
  onSubmit: () => void;
};

const fieldClass = "h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:disabled:bg-slate-900";

function normalizedNumber(value: string) {
  return value.trim().toLocaleUpperCase("es-MX");
}

export function EditArrastreModal({
  draft,
  vias,
  catalogLoading,
  catalogError,
  error,
  busy,
  onInstructionsChange,
  onReasonChange,
  onUpdateVagon,
  onClose,
  onSubmit,
}: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const capacity = useMemo(
    () => draft.vagones.reduce((total, vagon) => total + arrastreVagonCapacity(vagon.carga), 0),
    [draft.vagones],
  );
  const repeatedNumbers = useMemo(() => {
    const counts = new Map<string, number>();
    draft.vagones.forEach((vagon) => {
      const number = normalizedNumber(vagon.numeroVagon);
      if (number) counts.set(number, (counts.get(number) || 0) + 1);
    });
    return new Set(Array.from(counts.entries()).filter(([, count]) => count > 1).map(([number]) => number));
  }, [draft.vagones]);
  const issues = useMemo(() => {
    const current: string[] = [];
    if (draft.instrucciones.trim().length < 3) current.push("Describe la maniobra con al menos 3 caracteres.");
    if (draft.instrucciones.trim().length > 1_000) current.push("Las instrucciones no pueden superar 1000 caracteres.");
    if (draft.motivoEdicion.trim().length > 0 && draft.motivoEdicion.trim().length < 3) current.push("El motivo del cambio debe tener al menos 3 caracteres o quedar vacío.");
    draft.vagones.forEach((vagon, index) => {
      const label = `Vagón ${index + 1}`;
      const number = normalizedNumber(vagon.numeroVagon);
      if (!number) current.push(`${label}: captura el número.`);
      else if (repeatedNumbers.has(number)) current.push(`${label}: el número está repetido.`);
      if (!vagon.viaOrigenId || !vagon.seccionOrigenId) current.push(`${label}: completa el origen.`);
      if (!vagon.viaId || !vagon.seccionId) current.push(`${label}: completa el destino.`);
    });
    if (capacity > ARRASTRE_MAX_CAPACITY) current.push("La capacidad supera el máximo de 8 puntos.");
    return current;
  }, [capacity, draft.instrucciones, draft.motivoEdicion, draft.vagones, repeatedNumbers]);
  const canSave = !busy && !catalogLoading && !catalogError && issues.length === 0;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (canSave) onSubmit();
  }

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 p-2 backdrop-blur-sm sm:p-4" role="dialog" aria-modal="true" aria-labelledby="edit-arrastre-title">
      <form onSubmit={submit} className="flex max-h-[96dvh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-900 sm:px-6">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"><Pencil className="h-5 w-5" aria-hidden /></span>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">Solicitud #{draft.arrastreId}</p>
              <h2 id="edit-arrastre-title" className="text-xl font-black text-slate-950 dark:text-white">Editar movimiento de Arrastre</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">Puedes cambiar instrucciones, carga y ruta mientras la solicitud no haya iniciado.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300" aria-label="Cerrar edición"><X className="h-4 w-4" /></button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
          {error ? <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div> : null}
          {catalogError ? <div role="alert" className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{catalogError}</div> : null}

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
            <div className="space-y-4">
              <label>
                <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-600 dark:text-slate-300">Instrucciones de la maniobra *</span>
                <textarea value={draft.instrucciones} onChange={(event) => onInstructionsChange(event.target.value)} maxLength={1_000} className="min-h-24 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white" placeholder="Describe qué debe mover el equipo" />
                <span className="mt-1 block text-xs font-semibold text-slate-500">{draft.instrucciones.length}/1000 caracteres</span>
              </label>
              <label>
                <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-600 dark:text-slate-300">Motivo del cambio <span className="normal-case text-slate-400">(opcional)</span></span>
                <textarea value={draft.motivoEdicion} onChange={(event) => onReasonChange(event.target.value)} maxLength={300} className="min-h-20 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white" placeholder="Ej. Corrección solicitada por operaciones" />
                <span className="mt-1 block text-xs font-semibold text-slate-500">Se guardará en la bitácora · {draft.motivoEdicion.length}/300</span>
              </label>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">Capacidad</p>
              <p className="mt-1 text-2xl font-black text-slate-950 dark:text-white">{capacity}/{ARRASTRE_MAX_CAPACITY}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">Vacío usa 1 · Lleno usa 2</p>
              <p className="mt-3 text-xs font-bold text-slate-600 dark:text-slate-300">{draft.vagones.length} {draft.vagones.length === 1 ? "vagón existente" : "vagones existentes"}</p>
            </div>
          </div>

          {catalogLoading ? <div className="h-20 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-900" /> : null}

          <div className="space-y-4">
            {draft.vagones.map((vagon, index) => {
              const canSetFull = vagon.carga === "LLENO" || capacity < ARRASTRE_MAX_CAPACITY;
              return (
                <article key={vagon.vagonId} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-900/50">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-950 font-black text-white dark:bg-white dark:text-slate-950">{index + 1}</span><div><h3 className="font-black text-slate-950 dark:text-white">Vagón {index + 1}</h3><p className="text-xs font-semibold text-slate-500">ID operativo #{vagon.vagonId}</p></div></div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-600 ring-1 ring-slate-200 dark:bg-slate-950 dark:text-slate-300 dark:ring-slate-700">Pendiente</span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_190px]">
                    <label><span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-600 dark:text-slate-300">Número de vagón *</span><input value={vagon.numeroVagon} onChange={(event) => onUpdateVagon(vagon.vagonId, { numeroVagon: event.target.value })} maxLength={40} className={fieldClass} placeholder="Ej. FRT-204" required /></label>
                    <label><span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-600 dark:text-slate-300">Carga</span><select value={vagon.carga} onChange={(event) => onUpdateVagon(vagon.vagonId, { carga: event.target.value as CargaVagon })} className={fieldClass}><option value="VACIO">Vacío · 1 punto</option><option value="LLENO" disabled={!canSetFull}>Lleno · 2 puntos{!canSetFull ? " · sin capacidad" : ""}</option></select></label>
                  </div>
                  <div className="mt-4 grid items-stretch gap-3 lg:grid-cols-[minmax(0,1fr)_36px_minmax(0,1fr)]">
                    <EditRoutePoint kind="origen" index={index} vias={vias} viaValue={vagon.viaOrigenId} sectionValue={vagon.seccionOrigenId} onVia={(viaId, sectionId) => onUpdateVagon(vagon.vagonId, { viaOrigenId: viaId, seccionOrigenId: sectionId })} onSection={(sectionId) => onUpdateVagon(vagon.vagonId, { seccionOrigenId: sectionId })} />
                    <div className="hidden items-center justify-center lg:flex"><ArrowRight className="h-5 w-5 text-slate-400" aria-hidden /></div>
                    <EditRoutePoint kind="destino" index={index} vias={vias} viaValue={vagon.viaId} sectionValue={vagon.seccionId} onVia={(viaId, sectionId) => onUpdateVagon(vagon.vagonId, { viaId, seccionId: sectionId })} onSection={(sectionId) => onUpdateVagon(vagon.vagonId, { seccionId: sectionId })} />
                  </div>
                </article>
              );
            })}
          </div>

          {issues.length ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900 dark:bg-amber-950/25 dark:text-amber-100"><p className="text-sm font-black">Antes de guardar:</p><ul className="mt-2 grid gap-1 text-sm font-semibold sm:grid-cols-2">{issues.slice(0, 8).map((issue) => <li key={issue}>• {issue}</li>)}</ul></div> : <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-black text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/25 dark:text-emerald-200"><CheckCircle2 className="h-4 w-4" />Cambios listos para guardar.</div>}
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-white px-4 py-4 dark:border-slate-800 dark:bg-slate-950 sm:flex-row sm:justify-end sm:px-6">
          <button type="button" onClick={onClose} disabled={busy} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">Cerrar sin guardar</button>
          <button type="submit" disabled={!canSave} className="inline-flex min-h-11 min-w-48 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-black text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-45">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}{busy ? "Guardando…" : "Guardar cambios"}</button>
        </footer>
      </form>
    </div>,
    document.body,
  );
}

function EditRoutePoint({ kind, index, vias, viaValue, sectionValue, onVia, onSection }: { kind: "origen" | "destino"; index: number; vias: OperationalVia[]; viaValue: string; sectionValue: string; onVia: (viaId: string, sectionId: string) => void; onSection: (sectionId: string) => void }) {
  const selectedVia = vias.find((via) => via.id === Number(viaValue));
  const selectedSection = selectedVia?.secciones.find((section) => section.id === Number(sectionValue));
  const origin = kind === "origen";
  const Icon = origin ? MapPin : Flag;
  return (
    <fieldset className={`rounded-xl border p-3 ${origin ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/15" : "border-blue-200 bg-blue-50/60 dark:border-blue-900 dark:bg-blue-950/15"}`}>
      <legend className="sr-only">{origin ? "Origen" : "Destino"} del vagón {index + 1}</legend>
      <div className="mb-3 flex items-center gap-2"><Icon className={`h-4 w-4 ${origin ? "text-emerald-600" : "text-blue-600"}`} /><span className="text-xs font-black uppercase tracking-wide text-slate-700 dark:text-slate-200">{origin ? "Origen" : "Destino"}</span>{selectedVia && selectedSection ? <span className="ml-auto text-[10px] font-black text-emerald-700 dark:text-emerald-300">Completo</span> : null}</div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label><span className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300">Vía</span><select aria-label={`Vía de ${kind} del vagón ${index + 1}`} value={viaValue} onChange={(event) => { const value = event.target.value; const via = vias.find((item) => item.id === Number(value)); onVia(value, via?.secciones.length === 1 ? String(via.secciones[0].id) : ""); }} className={fieldClass}><option value="">Selecciona vía</option>{vias.map((via) => <option key={via.id} value={String(via.id)}>{via.nombre}{via.ocupada ? " · ocupada" : ""}</option>)}</select></label>
        <label><span className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300">Sección</span><select aria-label={`Sección de ${kind} del vagón ${index + 1}`} value={sectionValue} onChange={(event) => onSection(event.target.value)} disabled={!selectedVia} className={fieldClass}><option value="">{selectedVia ? "Selecciona sección" : "Elige vía primero"}</option>{(selectedVia?.secciones || []).map((section) => <option key={section.id} value={String(section.id)}>{section.nombre}{section.ocupada ? " · ocupada" : ""}</option>)}</select></label>
      </div>
    </fieldset>
  );
}
