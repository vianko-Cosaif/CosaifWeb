import React, { useMemo, useState } from "react";
import { Movimiento } from "../../Movimiento";

type MeasureValue = { whole: string; num: string; den: string };

export type TornoCopyPasteField<FieldKey extends string> = {
  key: FieldKey;
  label: string;
};

type Props<Position extends string, FieldKey extends string> = {
  open: boolean;
  positions: readonly Position[];
  fields: readonly TornoCopyPasteField<FieldKey>[];
  sourcePosition: Position | null;
  sourceField: FieldKey | null;
  sourceLabel: string;
  sourceValue: MeasureValue;
  getValue: (position: Position, field: FieldKey) => MeasureValue;
  formatValue: (value: MeasureValue) => string;
  title?: string;
  onCancel: () => void;
  onApply: (targets: Array<{ position: Position; field: FieldKey }>, sourceValue: MeasureValue) => void;
};

const targetId = (position: string, field: string) => `${position}::${field}`;

export default function TornoMeasureCopyPasteDialog<Position extends string, FieldKey extends string>(
  props: Props<Position, FieldKey>
) {
  const {
    open,
    positions,
    fields,
    sourcePosition,
    sourceField,
    sourceLabel,
    sourceValue,
    getValue,
    formatValue,
    title = "Pegar medida",
    onCancel,
    onApply,
  } = props;
  const [targets, setTargets] = useState<string[]>([]);
  const [expandedPositions, setExpandedPositions] = useState<Position[]>([]);

  const sourceId = sourcePosition && sourceField ? targetId(sourcePosition, sourceField) : "";
  const sourceText = useMemo(() => formatValue(sourceValue) || "Sin medida", [formatValue, sourceValue]);

  const resetAndCancel = () => {
    setTargets([]);
    setExpandedPositions([]);
    onCancel();
  };

  const toggleAccordion = (position: Position) => {
    setExpandedPositions((current) =>
      current.includes(position)
        ? current.filter((item) => item !== position)
        : [...current, position]
    );
  };

  const toggleTarget = (position: Position, field: FieldKey) => {
    const id = targetId(position, field);
    if (id === sourceId) return;
    setTargets((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  const toggleWheelTargets = (position: Position) => {
    const wheelTargets = fields
      .map((field) => targetId(position, field.key))
      .filter((id) => id !== sourceId);
    const allSelected = wheelTargets.length > 0 && wheelTargets.every((id) => targets.includes(id));
    setTargets((current) =>
      allSelected
        ? current.filter((id) => !wheelTargets.includes(id))
        : [...new Set([...current, ...wheelTargets])]
    );
  };

  const applyTargets = () => {
    const parsedTargets = targets
      .map((id) => {
        const [rawPosition, rawField] = id.split("::");
        const position = positions.find((item) => item === rawPosition);
        const field = fields.find((item) => item.key === rawField);
        return position && field ? { position, field: field.key } : null;
      })
      .filter(Boolean) as Array<{ position: Position; field: FieldKey }>;

    onApply(parsedTargets, sourceValue);
    setTargets([]);
    setExpandedPositions([]);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 p-3 sm:items-center">
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h4>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                Origen: <span className="font-semibold">{sourcePosition ?? "--"}</span> /{" "}
                <span className="font-semibold">{sourceLabel || "--"}</span>{" "}
                <span className="text-emerald-700 dark:text-emerald-300">({sourceText})</span>
              </p>
            </div>
            <button
              type="button"
              onClick={resetAndCancel}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              aria-label="Cerrar selector de pegado"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="max-h-[65vh] overflow-y-auto px-3 py-3">
          <div className="mb-3 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100">
            Abre una rueda, marca una o varias propiedades y pega la medida origen en todos los destinos seleccionados.
          </div>

          <div className="grid gap-2">
            {positions.map((position) => {
              const isOpen = expandedPositions.includes(position);
              const wheelTargetIds = fields.map((field) => targetId(position, field.key)).filter((id) => id !== sourceId);
              const selectedCount = wheelTargetIds.filter((id) => targets.includes(id)).length;
              const allSelected = wheelTargetIds.length > 0 && wheelTargetIds.every((id) => targets.includes(id));

              return (
                <div key={`copy_${position}`} className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/40">
                  <div className="flex items-center gap-2 px-3 py-2">
                    <button
                      type="button"
                      onClick={() => toggleAccordion(position)}
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-900"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className={Movimiento.clsx("h-4 w-4 shrink-0 text-slate-400 transition-transform dark:text-slate-500", isOpen && "rotate-90")}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="m9 6 6 6-6 6" />
                      </svg>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{position}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {selectedCount > 0 ? `${selectedCount} destino(s) seleccionados` : "Sin destinos seleccionados"}
                        </div>
                      </div>
                      <span className={Movimiento.clsx(
                        "rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                        selectedCount > 0
                          ? "border-sky-300 bg-sky-100 text-sky-700 dark:border-sky-700 dark:bg-sky-900/30 dark:text-sky-200"
                          : "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
                      )}>
                        {selectedCount}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleWheelTargets(position)}
                      className={Movimiento.clsx(
                        "rounded-lg border px-3 py-2 text-xs font-semibold transition-colors",
                        allSelected
                          ? "border-sky-500 bg-sky-600 text-white"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                      )}
                    >
                      Toda rueda
                    </button>
                  </div>

                  {isOpen ? (
                    <div className="border-t border-slate-200 px-3 py-2 dark:border-slate-800">
                      <div className="grid gap-2">
                        {fields.map((field) => {
                          const id = targetId(position, field.key);
                          const isSourceCell = id === sourceId;
                          const checked = targets.includes(id);
                          const targetValue = getValue(position, field.key);

                          return (
                            <label
                              key={`copy_field_${position}_${field.key}`}
                              className={Movimiento.clsx(
                                "flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors",
                                isSourceCell
                                  ? "cursor-not-allowed border-emerald-200 bg-emerald-50/80 dark:border-emerald-800 dark:bg-emerald-900/20"
                                  : checked
                                    ? "cursor-pointer border-sky-300 bg-sky-50 dark:border-sky-700 dark:bg-sky-900/20"
                                    : "cursor-pointer border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900"
                              )}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={isSourceCell}
                                onChange={() => toggleTarget(position, field.key)}
                                className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 dark:border-slate-700"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium text-slate-800 dark:text-slate-100">{field.label}</div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                  {isSourceCell ? "Medida origen" : formatValue(targetValue) || "Sin medida capturada"}
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
          <span className="text-xs text-slate-600 dark:text-slate-300">{targets.length} destino(s) seleccionado(s)</span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={resetAndCancel}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={applyTargets}
              disabled={targets.length === 0}
              className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Finalizar y pegar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
