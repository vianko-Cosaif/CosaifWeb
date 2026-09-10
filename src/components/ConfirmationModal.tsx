// En un nuevo archivo, por ejemplo: /components/ConfirmationModal.tsx
"use client";

import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  children: React.ReactNode;
  confirmDataGuideAction?: string;
}

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  children,
  confirmDataGuideAction,
}: ConfirmationModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/80 dark:bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl">
        {/* Encabezado */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-full bg-amber-100">
              <AlertTriangle className="h-6 w-6 text-amber-600" aria-hidden="true" />
            </div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200" id="modal-title">
              {title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Contenido */}
        <div className="mt-4 text-sm text-slate-600 dark:text-slate-400">
          {children}
        </div>

        {/* Acciones */}
        <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end sm:gap-3 gap-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto rounded-lg px-4 py-2 text-sm font-semibold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
          >
            No, cancelar
          </button>
          <button
            type="button"
            data-guide-action={confirmDataGuideAction}
            onClick={onConfirm}
            className="w-full sm:w-auto rounded-lg px-4 py-2 text-sm font-semibold bg-rose-600 text-white hover:bg-rose-700 transition-colors"
          >
            Sí, aceptar
          </button>
        </div>
      </div>
    </div>
  );
}
