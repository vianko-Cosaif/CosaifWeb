"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../cn";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "success"
  | "warning"
  | "dark";

export type ButtonSize = "sm" | "md" | "lg" | "icon";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  loading?: boolean;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "border-[var(--app-accent)] bg-[var(--app-accent)] text-[var(--app-accent-contrast)] shadow-sm hover:border-[var(--app-accent-hover)] hover:bg-[var(--app-accent-hover)]",
  secondary:
    "border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text-muted)] shadow-sm hover:border-[var(--app-border-strong)] hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-text)]",
  ghost:
    "border-transparent bg-transparent text-[var(--app-text-muted)] hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-text)]",
  danger:
    "border-rose-200 bg-[var(--app-surface)] text-rose-600 shadow-sm hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/30",
  success:
    "border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/50",
  warning:
    "border-amber-200 bg-amber-50 text-amber-800 shadow-sm hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-900/50",
  dark:
    "border-slate-950 bg-slate-950 text-white shadow-sm hover:bg-slate-800 dark:border-slate-100 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "min-h-9 rounded-lg px-3 py-1.5 text-xs",
  md: "min-h-11 rounded-lg px-4 py-2 text-sm",
  lg: "min-h-12 rounded-lg px-5 py-2.5 text-sm",
  icon: "h-11 w-11 rounded-lg p-0",
};

export default function Button({
  variant = "secondary",
  size = "md",
  leftIcon,
  rightIcon,
  loading = false,
  className,
  disabled,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex max-w-full shrink-0 items-center justify-center gap-2 border text-center font-semibold leading-5 transition-colors motion-safe:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus)]",
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : leftIcon}
      {children}
      {!loading ? rightIcon : null}
    </button>
  );
}
