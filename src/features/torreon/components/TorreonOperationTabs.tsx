"use client";

import { Boxes, TrainFront, type LucideIcon } from "lucide-react";
import s from "../presentation/rail.module.scss";

export type TorreonOperationView = "naturales" | "arrastres";

type Option = {
  value: TorreonOperationView;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
};

const OPTIONS: Option[] = [
  {
    value: "naturales",
    label: "Rondas naturales",
    shortLabel: "Naturales",
    icon: TrainFront,
  },
  {
    value: "arrastres",
    label: "Arrastres",
    shortLabel: "Arrastres",
    icon: Boxes,
  },
];

export function TorreonOperationTabs({
  value,
  onChange,
  compact = false,
}: {
  value: TorreonOperationView;
  onChange: (value: TorreonOperationView) => void;
  compact?: boolean;
}) {
  return (
    <div
      className={s.operationTabs}
      data-compact={compact}
      role="group"
      aria-label="Tipo de operación en Torreón"
    >
      {OPTIONS.map(({ value: option, label, shortLabel, icon: Icon }) => (
        <button
          key={option}
          type="button"
          data-mode={option}
          aria-label={label}
          aria-pressed={value === option}
          onClick={() => onChange(option)}
        >
          <span className={s.operationTabIcon}>
            <Icon size={19} aria-hidden />
          </span>
          <span>
            <strong>
              <span className={s.operationTabLong}>{label}</span>
              <span className={s.operationTabShort}>{shortLabel}</span>
            </strong>
          </span>
        </button>
      ))}
    </div>
  );
}
