"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, ArrowRight, CalendarClock, FileClock, History, Loader2, UserRound, X } from "lucide-react";
import type { ArrastreAuditSnapshotVagon, ArrastreEditAudit } from "../types";

type Props = {
  arrastreId: number;
  entries: ArrastreEditAudit[];
  loading: boolean;
  error: string | null;
  onClose: () => void;
};

type Change = { label: string; before: string; after: string };

function text(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized || "—";
}

function route(vagon: ArrastreAuditSnapshotVagon, kind: "origin" | "destination") {
  return kind === "origin"
    ? `${text(vagon.viaOrigenNombre || vagon.viaOrigenId)} / ${text(vagon.seccionOrigenNombre || vagon.seccionOrigenId)}`
    : `${text(vagon.viaDestinoNombre || vagon.viaId)} / ${text(vagon.seccionDestinoNombre || vagon.seccionId)}`;
}

function changesFor(entry: ArrastreEditAudit) {
  const changes: Change[] = [];
  if (text(entry.antes?.instrucciones) !== text(entry.despues?.instrucciones)) {
    changes.push({ label: "Instrucciones", before: text(entry.antes?.instrucciones), after: text(entry.despues?.instrucciones) });
  }

  const beforeById = new Map((entry.antes?.vagones || []).map((vagon) => [Number(vagon.id), vagon]));
  const afterById = new Map((entry.despues?.vagones || []).map((vagon) => [Number(vagon.id), vagon]));
  const ids = new Set([...beforeById.keys(), ...afterById.keys()]);
  ids.forEach((id) => {
    const before = beforeById.get(id);
    const after = afterById.get(id);
    if (!before || !after) {
      changes.push({ label: `Vagón #${id}`, before: before ? "Existía" : "No existía", after: after ? "Existe" : "Eliminado" });
      return;
    }
    const fields = [
      { label: "Número", before: text(before.numeroVagon), after: text(after.numeroVagon) },
      { label: "Carga", before: text(before.carga), after: text(after.carga) },
      { label: "Origen", before: route(before, "origin"), after: route(after, "origin") },
      { label: "Destino", before: route(before, "destination"), after: route(after, "destination") },
      { label: "Orden", before: text(before.orden), after: text(after.orden) },
    ];
    fields.forEach((field) => {
      if (field.before !== field.after) changes.push({ label: `Vagón ${text(after.numeroVagon || id)} · ${field.label}`, before: field.before, after: field.after });
    });
  });
  return changes;
}

function fmtDate(value?: string | null) {
  if (!value) return "Fecha no disponible";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Mexico_City" });
}

export default function ArrastreAuditModal({ arrastreId, entries, loading, error, onClose }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/65 p-2 backdrop-blur-sm sm:p-4" role="dialog" aria-modal="true" aria-labelledby="arrastre-audit-title">
      <section className="flex max-h-[96dvh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-900 sm:px-6">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"><History className="h-5 w-5" /></span>
            <div><p className="text-xs font-black uppercase tracking-[0.16em] text-violet-700 dark:text-violet-300">Arrastre #{arrastreId}</p><h2 id="arrastre-audit-title" className="text-xl font-black text-slate-950 dark:text-white">Bitácora de ediciones</h2><p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">Evidencia del usuario, fecha y valores antes/después.</p></div>
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300" aria-label="Cerrar bitácora"><X className="h-4 w-4" /></button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
          {loading ? <div className="flex min-h-48 items-center justify-center gap-2 text-sm font-black text-slate-500"><Loader2 className="h-5 w-5 animate-spin" />Cargando evidencia…</div> : null}
          {error ? <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div> : null}
          {!loading && !error && entries.length === 0 ? <div className="grid min-h-48 place-items-center rounded-2xl border border-dashed border-slate-300 p-6 text-center dark:border-slate-700"><div><FileClock className="mx-auto h-8 w-8 text-slate-400" /><p className="mt-3 font-black text-slate-700 dark:text-slate-200">Esta solicitud no tiene ediciones registradas</p><p className="mt-1 text-sm font-semibold text-slate-500">La bitácora comenzará con el siguiente cambio del cliente.</p></div></div> : null}

          {!loading && !error ? entries.map((entry) => {
            const changes = changesFor(entry);
            return (
              <article key={entry.id} className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
                <div className="grid gap-3 bg-slate-50 p-4 dark:bg-slate-900 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <div><p className="text-xs font-black uppercase tracking-wide text-violet-700 dark:text-violet-300">Edición #{entry.id}</p><div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm font-bold text-slate-700 dark:text-slate-200"><span className="inline-flex items-center gap-1.5"><UserRound className="h-4 w-4 text-slate-400" />{entry.editadoPorNombre || `Usuario #${entry.editadoPorId}`} · {entry.editadoPorRol}</span><span className="inline-flex items-center gap-1.5"><CalendarClock className="h-4 w-4 text-slate-400" />{fmtDate(entry.fechaEdicion)}</span></div></div>
                  <span className="h-fit rounded-full bg-violet-100 px-3 py-1 text-xs font-black text-violet-700 dark:bg-violet-950 dark:text-violet-200">{changes.length} cambio{changes.length === 1 ? "" : "s"}</span>
                </div>
                {entry.motivo ? <div className="border-y border-slate-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900 dark:border-slate-800 dark:bg-amber-950/20 dark:text-amber-100"><span className="text-xs font-black uppercase tracking-wide">Motivo declarado:</span> {entry.motivo}</div> : null}
                <div className="space-y-3 p-4">
                  {changes.length ? changes.map((change, index) => (
                    <div key={`${change.label}-${index}`} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800"><p className="text-xs font-black uppercase tracking-wide text-slate-500">{change.label}</p><div className="mt-2 grid items-center gap-2 sm:grid-cols-[minmax(0,1fr)_24px_minmax(0,1fr)]"><ValueBox label="Antes" value={change.before} /><ArrowRight className="mx-auto hidden h-4 w-4 text-slate-400 sm:block" /><ValueBox label="Después" value={change.after} after /></div></div>
                  )) : <p className="rounded-xl bg-slate-50 p-3 text-sm font-bold text-slate-500 dark:bg-slate-900">La solicitud se guardó sin diferencias operativas detectables.</p>}
                </div>
              </article>
            );
          }) : null}
        </div>
        <footer className="flex justify-end border-t border-slate-200 p-4 dark:border-slate-800"><button type="button" onClick={onClose} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-950 px-5 text-sm font-black text-white dark:bg-white dark:text-slate-950">Cerrar</button></footer>
      </section>
    </div>,
    document.body,
  );
}

function ValueBox({ label, value, after = false }: { label: string; value: string; after?: boolean }) {
  return <div className={`rounded-lg border px-3 py-2 ${after ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/20" : "border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"}`}><p className={`text-[10px] font-black uppercase tracking-wide ${after ? "text-emerald-700 dark:text-emerald-300" : "text-slate-400"}`}>{label}</p><p className="mt-1 whitespace-pre-wrap text-sm font-bold text-slate-800 dark:text-slate-100">{value}</p></div>;
}
