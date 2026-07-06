"use client";

import React from "react";

export type ConfirmChoiceAlertProps = {
  open: boolean;
  question: string;
  contextLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function ConfirmChoiceAlert({
  open,
  question,
  contextLabel,
  onCancel,
  onConfirm,
}: ConfirmChoiceAlertProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-md rounded-3xl border border-slate-200/70 bg-white/95 p-6 shadow-2xl shadow-black/25 dark:border-slate-700/70 dark:bg-slate-900/95">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/35 dark:text-emerald-300">
          <span className="text-2xl font-bold">!</span>
        </div>

        <h3 className="text-center text-xl font-semibold text-slate-900 dark:text-slate-100">
          Confirmar selección
        </h3>

        <p className="mt-2 text-center text-sm text-slate-600 dark:text-slate-300">{question}</p>

        {contextLabel ? (
          <p className="mt-1 text-center text-xs text-slate-500 dark:text-slate-400">{contextLabel}</p>
        ) : null}

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            No
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all hover:from-emerald-600 hover:to-emerald-700 hover:shadow-emerald-500/40"
          >
            Sí
          </button>
        </div>
      </div>
    </div>
  );
}
