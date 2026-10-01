"use client";

import { AlertTriangle, X } from "lucide-react";

type Props = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  tone?: "default" | "danger";
  onCancel: () => void;
  onConfirm: () => void;
};

export function CatalogConfirmDialog({ open, title, description, confirmLabel, tone = "default", onCancel, onConfirm }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="catalog-confirm-title" aria-describedby="catalog-confirm-description" className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-start justify-between gap-4">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${tone === "danger" ? "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300" : "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"}`}>
            <AlertTriangle className="h-5 w-5" />
          </span>
          <button type="button" onClick={onCancel} className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-900" aria-label="Cerrar confirmación"><X className="h-5 w-5" /></button>
        </div>
        <h2 id="catalog-confirm-title" className="mt-4 text-xl font-black text-slate-950 dark:text-zinc-50">{title}</h2>
        <p id="catalog-confirm-description" className="mt-2 text-sm font-semibold leading-6 text-slate-600 dark:text-zinc-400">{description}</p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCancel} className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-black text-slate-700 dark:border-zinc-800 dark:text-zinc-200">Cancelar</button>
          <button type="button" onClick={onConfirm} className={`min-h-11 rounded-xl px-4 text-sm font-black text-white ${tone === "danger" ? "bg-rose-600 hover:bg-rose-700" : "bg-slate-900 hover:bg-slate-800 dark:bg-zinc-100 dark:text-zinc-950"}`}>{confirmLabel}</button>
        </div>
      </section>
    </div>
  );
}
