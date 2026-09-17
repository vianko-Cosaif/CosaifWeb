"use client";

import { Boxes, LayoutGrid, TrainFront, type LucideIcon } from "lucide-react";
import s from "../presentation/rail.module.scss";

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
    label: "Resumen",
    description: "Lo importante ahora",
    icon: LayoutGrid,
  },
  {
    value: "naturales",
    label: "Rondas naturales",
    description: "Locomotoras del patio",
    icon: TrainFront,
  },
  {
    value: "arrastres",
    label: "Arrastres",
    description: "Vagones y solicitudes",
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

  return (
    <div className={s.operationTabs} role="group" aria-label="Tipo de operación en Torreón">
      {options.map(({ value: option, label, description, icon: Icon }) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
        >
          <Icon size={19} aria-hidden />
          <span>
            <strong>{label}</strong>
            {!compact ? <small>{description}</small> : null}
          </span>
        </button>
      ))}
    </div>
  );
}
