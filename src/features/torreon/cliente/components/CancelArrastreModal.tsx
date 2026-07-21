import { useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Ban, Loader2, X } from "lucide-react";
import type { CancelArrastreDraft } from "../types";

type Props = {
  draft: CancelArrastreDraft;
  busy: boolean;
  error: string | null;
  onChange: (motivo: string) => void;
  onClose: () => void;
  onConfirm: () => void;
};

export function CancelArrastreModal({ draft, busy, error, onChange, onClose, onConfirm }: Props) {
  const [mounted, setMounted] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => setMounted(true), []);
  const ready = draft.motivo.trim().length >= 3 && confirmed && !busy;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (ready) onConfirm();
  }

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="cancel-arrastre-title">
      <form onSubmit={submit} className="w-full max-w-lg overflow-hidden rounded-2xl border border-rose-200 bg-white shadow-2xl dark:border-rose-950 dark:bg-slate-950">
        <header className="flex items-start justify-between gap-4 border-b border-rose-100 bg-rose-50 p-4 dark:border-rose-950 dark:bg-rose-950/25">
          <div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"><Ban className="h-5 w-5" /></span><div><p className="text-xs font-black uppercase tracking-wide text-rose-700 dark:text-rose-300">{draft.referencia}</p><h2 id="cancel-arrastre-title" className="text-xl font-black text-slate-950 dark:text-white">Cancelar movimiento</h2><p className="mt-1 text-sm font-semibold text-slate-600 dark:text-slate-300">La solicitud saldrá de la cola y no podrá reactivarse.</p></div></div>
          <button type="button" onClick={onClose} disabled={busy} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-rose-200 bg-white text-slate-600 disabled:opacity-50 dark:border-rose-900 dark:bg-slate-950 dark:text-slate-300" aria-label="Cerrar cancelación"><X className="h-4 w-4" /></button>
        </header>
        <div className="space-y-4 p-4">
          {error ? <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div> : null}
          <label><span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-600 dark:text-slate-300">Motivo de cancelación *</span><textarea autoFocus value={draft.motivo} onChange={(event) => onChange(event.target.value)} maxLength={300} className="min-h-24 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-950 outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white" placeholder="Explica brevemente por qué se cancela" /><span className="mt-1 block text-xs font-semibold text-slate-500">Mínimo 3 caracteres · {draft.motivo.length}/300</span></label>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-0.5 h-4 w-4 accent-rose-600" /><span className="text-sm font-bold text-slate-700 dark:text-slate-200">Confirmo que deseo retirar esta solicitud de la cola de Arrastre.</span></label>
        </div>
        <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 p-4 dark:border-slate-800 sm:flex-row sm:justify-end"><button type="button" onClick={onClose} disabled={busy} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">Conservar solicitud</button><button type="submit" disabled={!ready} className="inline-flex min-h-11 min-w-48 items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 text-sm font-black text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-45">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}{busy ? "Cancelando…" : "Cancelar movimiento"}</button></footer>
      </form>
    </div>,
    document.body,
  );
}
