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
        "flex min-h-40 items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--app-border)] bg-[var(--app-surface-subtle)] p-4 text-sm font-medium text-[var(--app-text-muted)]",
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
