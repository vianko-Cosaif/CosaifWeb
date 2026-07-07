"use client";

import { AlertCircle, Check, X } from "lucide-react";
import { cn } from "@/app/Components/ui";
import type { Toast } from "../types";

type UserToastContainerProps = {
  toasts: Toast[];
  onRemove: (id: string) => void;
};

export default function UserToastContainer({ toasts, onRemove }: UserToastContainerProps) {
  return (
    <div className="pointer-events-none fixed right-4 top-20 z-50 flex flex-col gap-2 md:right-6">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "pointer-events-auto min-w-[280px] max-w-md rounded-lg border p-4 shadow-lg backdrop-blur-xl",
            "animate-in slide-in-from-right-full fade-in duration-300",
            toast.type === "success" &&
              "border-emerald-300 bg-emerald-50/95 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/95 dark:text-emerald-100",
            toast.type === "error" &&
              "border-rose-300 bg-rose-50/95 text-rose-900 dark:border-rose-700 dark:bg-rose-950/95 dark:text-rose-100",
            toast.type === "info" &&
              "border-sky-300 bg-sky-50/95 text-sky-900 dark:border-sky-700 dark:bg-sky-950/95 dark:text-sky-100"
          )}
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5">
              {toast.type === "success" ? <Check className="h-5 w-5" aria-hidden /> : null}
              {toast.type === "error" || toast.type === "info" ? <AlertCircle className="h-5 w-5" aria-hidden /> : null}
            </div>
            <div className="flex-1 text-sm font-semibold">{toast.message}</div>
            <button
              type="button"
              onClick={() => onRemove(toast.id)}
              className="rounded-md p-1 opacity-60 transition hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
              aria-label="Cerrar notificacion"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
