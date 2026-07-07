"use client";

import { Loader2 } from "lucide-react";
import { cn } from "../cn";

type LoadingStateProps = {
  label?: string;
  className?: string;
};

export default function LoadingState({ label = "Cargando", className }: LoadingStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-40 items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 text-sm font-black text-slate-500 dark:border-slate-700 dark:text-slate-400",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
      <span>{label}</span>
    </div>
  );
}
