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
};

export default function IncidentCatalogSelect({
  value,
  onChange,
  options,
  placeholder,
  fullWidth,
}: IncidentCatalogSelectProps) {
  return (
    <SelectField
      containerClassName={fullWidth ? "w-full" : "w-48"}
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)}
      className="rounded-xl focus:border-emerald-500 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
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
