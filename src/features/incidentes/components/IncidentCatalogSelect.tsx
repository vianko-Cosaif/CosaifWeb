"use client";

import { SelectField } from "@/app/Components/ui";

export type IncidentCatalogOption = {
  id: number;
  nombre: string;
};

type IncidentCatalogSelectProps = {
  value: number | null;
  onChange: (value: number | null) => void;
  options: IncidentCatalogOption[];
  placeholder: string;
  fullWidth?: boolean;
  disabled?: boolean;
};

export default function IncidentCatalogSelect({
  value,
  onChange,
  options,
  placeholder,
  fullWidth,
  disabled,
}: IncidentCatalogSelectProps) {
  return (
    <SelectField
      containerClassName={fullWidth ? "w-full" : "w-48"}
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)}
      disabled={disabled}
      className="rounded-xl focus:border-emerald-500 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-600 disabled:opacity-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:disabled:bg-slate-800 dark:disabled:text-slate-300"
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.nombre}
        </option>
      ))}
    </SelectField>
  );
}
