"use client";

import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import Modal from "@/components/ui/Modal/Modal";

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  children: ReactNode;
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
  if (!isOpen) return null;

  return (
    <Modal
      title={
        <span className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" aria-hidden />
          {title}
        </span>
      }
      onClose={onClose}
      maxWidth="max-w-md"
      className="rounded-2xl"
    >
      <div className="text-sm leading-relaxed text-[var(--app-text-muted)]">{children}</div>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 rounded-xl border border-[var(--app-border)] px-4 py-2 text-sm font-semibold text-[var(--app-text)] hover:bg-[var(--app-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
        >
          No, cancelar
        </button>
        <button
          type="button"
          data-guide-action={confirmDataGuideAction}
          onClick={onConfirm}
          className="min-h-11 rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
        >
          Sí, cerrar incidente
        </button>
      </div>
    </Modal>
  );
}
