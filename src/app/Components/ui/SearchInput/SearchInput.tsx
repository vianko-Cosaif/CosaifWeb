"use client";

import { forwardRef, type InputHTMLAttributes } from "react";
import { Search, X } from "lucide-react";
import { cn } from "../cn";

type SearchInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  onClear?: () => void;
  className?: string;
  inputClassName?: string;
};

const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
  {
    value,
    onChange,
    placeholder = "Buscar...",
    label = "Buscar",
    disabled = false,
    onClear,
    className,
    inputClassName,
    ...props
  },
  ref
) {
  return (
    <label className={cn("relative block min-w-0", className)}>
      <span className="sr-only">{label}</span>
      <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden />
      <input
        ref={ref}
        type="search"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={cn(
          "h-11 w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm font-semibold text-slate-800 shadow-sm transition",
          "focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 disabled:cursor-not-allowed disabled:opacity-60",
          "dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100",
          value && onClear ? "pr-10" : "",
          inputClassName
        )}
        {...props}
      />
      {value && onClear ? (
        <button
          type="button"
          onClick={onClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          aria-label="Limpiar busqueda"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      ) : null}
    </label>
  );
});

export default SearchInput;
