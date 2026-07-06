"use client";

import type { ReactNode, SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../cn";

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: ReactNode;
  icon?: ReactNode;
  error?: ReactNode;
  containerClassName?: string;
};

export default function SelectField({
  label,
  icon,
  error,
  containerClassName,
  className,
  children,
  ...props
}: SelectFieldProps) {
  return (
    <label className={cn("block min-w-0", containerClassName)}>
      {label ? (
        <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {label}
        </span>
      ) : null}
      <span className="relative block">
        {icon ? (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            {icon}
          </span>
        ) : null}
        <select
          className={cn(
            "h-10 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 pr-9 text-sm font-semibold text-slate-800 shadow-sm transition",
            "focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 disabled:cursor-not-allowed disabled:opacity-60",
            "dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100",
            icon ? "pl-10" : "",
            error ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500/20" : "",
            className
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
      </span>
      {error ? <span className="mt-1 block text-xs font-semibold text-rose-600 dark:text-rose-400">{error}</span> : null}
    </label>
  );
}
