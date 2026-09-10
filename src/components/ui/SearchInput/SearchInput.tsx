"use client";

import { forwardRef, useId, type InputHTMLAttributes } from "react";
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
    id,
    ...props
  },
  ref
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <div className={cn("relative block min-w-0", className)}>
      <label htmlFor={inputId} className="sr-only">{label}</label>
      <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden />
      <input
        ref={ref}
        id={inputId}
        type="search"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={cn(
          "h-11 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] py-2.5 pl-10 pr-4 text-sm font-medium text-[var(--app-text)] shadow-sm transition-colors",
          "placeholder:text-[var(--app-text-soft)] focus:border-[var(--app-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--app-focus)] disabled:cursor-not-allowed disabled:opacity-60",
          value && onClear ? "pr-10" : "",
          onClear ? "[&::-webkit-search-cancel-button]:appearance-none" : "",
          inputClassName
        )}
        {...props}
      />
      {value && onClear ? (
        <button
          type="button"
          disabled={disabled}
          onClick={onClear}
          className="absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-md text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-surface-muted)] disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Limpiar búsqueda"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      ) : null}
    </div>
  );
});

export default SearchInput;
