"use client";

import { Boxes, LayoutGrid, TrainFront, type LucideIcon } from "lucide-react";
import SegmentedControl from "@/app/Components/ui/SegmentedControl";

export type TorreonOperationView = "general" | "naturales" | "arrastres";

type Option = {
  value: TorreonOperationView;
  label: string;
  description: string;
  icon: LucideIcon;
};

const OPTIONS: Option[] = [
  {
    value: "general",
    label: "General",
    description: "Resumen de la operación",
    icon: LayoutGrid,
  },
  {
    value: "naturales",
    label: "Naturales",
    description: "Locomotoras y rondas",
    icon: TrainFront,
  },
  {
    value: "arrastres",
    label: "Arrastres",
    description: "Solicitudes y vagones",
    icon: Boxes,
  },
];

export function TorreonOperationTabs({
  value,
  onChange,
  includeGeneral = true,
  compact = false,
}: {
  value: TorreonOperationView;
  onChange: (value: TorreonOperationView) => void;
  includeGeneral?: boolean;
  compact?: boolean;
}) {
  const options = includeGeneral ? OPTIONS : OPTIONS.filter((option) => option.value !== "general");

  if (compact) {
    return (
      <SegmentedControl
        value={value}
        options={options.map((option) => ({
          value: option.value,
          label: option.label,
          icon: option.icon,
        }))}
        onChange={onChange}
        ariaLabel="Tipo de operación en Torreón"
        size="md"
        className="w-full sm:w-auto"
      />
    );
  }

  return (
    <div
      role="tablist"
      aria-label="Tipo de operación en Torreón"
      className={`grid w-full gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-800 ${
        includeGeneral ? "sm:grid-cols-3" : "sm:grid-cols-2"
      } lg:w-auto`}
    >
      {options.map((option) => {
        const Icon = option.icon;
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={`flex min-h-12 min-w-0 items-center gap-2 rounded-md px-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
              active
                ? "bg-white text-slate-950 shadow-sm dark:bg-slate-950 dark:text-white"
                : "text-slate-500 hover:bg-white/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"
            }`}
          >
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
              active
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                : "bg-white text-slate-400 dark:bg-slate-900 dark:text-slate-500"
            }`}>
              <Icon className="h-4 w-4" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-black">{option.label}</span>
              <span className="block truncate text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                {option.description}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
