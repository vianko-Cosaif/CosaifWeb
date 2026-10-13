"use client";

import type { SectionDraft } from "../types";

type Props = {
  trackName: string;
  sections: SectionDraft[];
  inputClassName: string;
  maxLength?: number;
  disabled?: boolean;
  onChange: (numero: number, nombre: string) => void;
};

export function CatalogSectionNameEditor({
  trackName,
  sections,
  inputClassName,
  maxLength = 80,
  disabled = false,
  onChange,
}: Props) {
  if (!sections.length) return null;
  return (
    <details className="col-span-full rounded-xl border border-slate-200 bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900/50">
      <summary className="cursor-pointer px-3 py-2.5 text-sm font-bold text-slate-700 dark:text-zinc-200">
        Nombres de secciones · {trackName} ({sections.length})
      </summary>
      <div className="grid gap-3 border-t border-slate-200 p-3 dark:border-zinc-800 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((section) => (
          <label key={section.numero} className="grid min-w-0 gap-1.5">
            <span className="text-xs font-bold text-slate-600 dark:text-zinc-300">
              Sección {section.numero}
            </span>
            <input
              aria-label={`Nombre de sección ${section.numero} en ${trackName}`}
              className={`${inputClassName} w-full`}
              value={section.nombre}
              maxLength={maxLength}
              disabled={disabled}
              onChange={(event) => onChange(section.numero, event.target.value)}
            />
          </label>
        ))}
      </div>
    </details>
  );
}
