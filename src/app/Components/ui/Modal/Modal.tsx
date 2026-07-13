"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "../cn";

type ModalProps = {
  title: ReactNode;
  children: ReactNode;
  onClose: () => void;
  maxWidth?: string;
  className?: string;
  bodyClassName?: string;
  closeLabel?: string;
};

export default function Modal({
  title,
  children,
  onClose,
  maxWidth = "max-w-2xl",
  className,
  bodyClassName,
  closeLabel = "Cerrar",
}: ModalProps) {
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
        aria-label={closeLabel}
      />
      <div
        className={cn(
          "relative w-full animate-in zoom-in-95 fade-in slide-in-from-bottom-4 duration-200",
          "max-h-[90vh] overflow-y-auto rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] shadow-[var(--app-shadow-md)]",
          maxWidth,
          className
        )}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--app-border)] bg-[var(--app-surface)] px-6 py-4">
          <h2 className="text-lg font-black text-[var(--app-text)]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
            aria-label={closeLabel}
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className={cn("p-6", bodyClassName)}>{children}</div>
      </div>
    </div>
  );
}
