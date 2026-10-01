"use client";

import React, { useEffect, useMemo, useState } from "react";

export type DynamicCopyPasteField<FieldKey extends string> = {
  key: FieldKey;
  label: string;
};

export type DynamicCopyPasteScope = "cell" | "row" | "column";

export type DynamicCopyPasteTarget<Position extends string, FieldKey extends string> =
  | { scope: "cell"; position: Position; field: FieldKey }
  | { scope: "row"; position: Position }
  | { scope: "column"; field: FieldKey };

type Props<Position extends string, FieldKey extends string, Value> = {
  open: boolean;
  scope: DynamicCopyPasteScope;
  positions: readonly Position[];
  fields: readonly DynamicCopyPasteField<FieldKey>[];
  sourcePosition?: Position | null;
  sourceField?: FieldKey | null;
  sourceLabel: string;
  sourceValueLabel: string;
  getValueLabel: (position: Position, field: FieldKey) => string;
  title?: string;
  onCancel: () => void;
  onApply: (targets: DynamicCopyPasteTarget<Position, FieldKey>[]) => void;
};

const targetId = (scope: DynamicCopyPasteScope, position?: string, field?: string) =>
  `${scope}::${position ?? ""}::${field ?? ""}`;

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function DynamicTableCopyPasteDialog<
  Position extends string,
  FieldKey extends string,
  Value = unknown,
>(props: Props<Position, FieldKey, Value>) {
  const {
    open,
    scope,
    positions,
    fields,
    sourcePosition,
    sourceField,
    sourceLabel,
    sourceValueLabel,
    getValueLabel,
    title = "Pegar valores",
    onCancel,
    onApply,
  } = props;

  const [targets, setTargets] = useState<string[]>([]);
  const [expandedRows, setExpandedRows] = useState<Position[]>([]);

  useEffect(() => {
    if (!open) {
      setTargets([]);
      setExpandedRows([]);
    }
  }, [open, scope, sourcePosition, sourceField]);

  const sourceId = useMemo(
    () => targetId(scope, sourcePosition ?? undefined, sourceField ?? undefined),
    [scope, sourceField, sourcePosition]
  );

  const modeCopy = useMemo(() => {
    if (scope === "row") return "Selecciona una o varias filas destino.";
    if (scope === "column") return "Selecciona una o varias columnas destino.";
    return "Abre una fila y selecciona celdas destino.";
  }, [scope]);

  const resetAndCancel = () => {
    setTargets([]);
    setExpandedRows([]);
    onCancel();
  };

  const toggleTarget = (id: string) => {
    if (id === sourceId) return;
    setTargets((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  const toggleRowCells = (position: Position) => {
    const ids = fields
      .map((field) => targetId("cell", position, field.key))
      .filter((id) => id !== sourceId);
    const allSelected = ids.length > 0 && ids.every((id) => targets.includes(id));
    setTargets((current) =>
      allSelected ? current.filter((id) => !ids.includes(id)) : [...new Set([...current, ...ids])]
    );
  };

  const applyTargets = () => {
    const parsed = targets
      .map<DynamicCopyPasteTarget<Position, FieldKey> | null>((id) => {
        const [rawScope, rawPosition, rawField] = id.split("::") as [
          DynamicCopyPasteScope,
          string,
          string,
        ];
        if (rawScope === "row") {
          const position = positions.find((item) => item === rawPosition);
          return position ? { scope: "row", position } : null;
        }
        if (rawScope === "column") {
          const field = fields.find((item) => item.key === rawField);
          return field ? { scope: "column", field: field.key } : null;
        }
        const position = positions.find((item) => item === rawPosition);
        const field = fields.find((item) => item.key === rawField);
        return position && field ? { scope: "cell", position, field: field.key } : null;
      })
      .filter(Boolean) as DynamicCopyPasteTarget<Position, FieldKey>[];

    onApply(parsed);
    setTargets([]);
    setExpandedRows([]);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-end justify-center bg-black/45 p-3 sm:items-center">
      <div className="w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h4>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                Origen: <span className="font-semibold">{sourceLabel || "--"}</span>{" "}
                <span className="text-emerald-700 dark:text-emerald-300">({sourceValueLabel || "Sin medida"})</span>
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

        <div className="max-h-[66vh] overflow-y-auto px-3 py-3">
          <div className="mb-3 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100">
            {modeCopy}
          </div>

          {scope === "column" ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {fields.map((field) => {
                const id = targetId("column", undefined, field.key);
                const isSource = id === sourceId;
                const checked = targets.includes(id);
                return (
                  <label
                    key={`copy_column_${field.key}`}
                    className={cx(
                      "flex items-center gap-3 rounded-xl border px-3 py-3 transition-colors",
                      isSource
                        ? "cursor-not-allowed border-emerald-200 bg-emerald-50/80 dark:border-emerald-800 dark:bg-emerald-900/20"
                        : checked
                          ? "cursor-pointer border-sky-300 bg-sky-50 dark:border-sky-700 dark:bg-sky-900/20"
                          : "cursor-pointer border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={isSource}
                      onChange={() => toggleTarget(id)}
                      className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 dark:border-slate-700"
                    />
                    <span className="min-w-0 flex-1 text-sm font-medium text-slate-800 dark:text-slate-100">
                      {field.label}
                    </span>
                  </label>
                );
              })}
            </div>
          ) : null}

          {scope === "row" ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {positions.map((position) => {
                const id = targetId("row", position);
                const isSource = id === sourceId;
                const checked = targets.includes(id);
                return (
                  <label
                    key={`copy_row_${position}`}
                    className={cx(
                      "flex items-center gap-3 rounded-xl border px-3 py-3 transition-colors",
                      isSource
                        ? "cursor-not-allowed border-emerald-200 bg-emerald-50/80 dark:border-emerald-800 dark:bg-emerald-900/20"
                        : checked
                          ? "cursor-pointer border-sky-300 bg-sky-50 dark:border-sky-700 dark:bg-sky-900/20"
                          : "cursor-pointer border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={isSource}
                      onChange={() => toggleTarget(id)}
                      className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 dark:border-slate-700"
                    />
                    <span className="min-w-0 flex-1 text-sm font-medium text-slate-800 dark:text-slate-100">
                      {position}
                    </span>
                  </label>
                );
              })}
            </div>
          ) : null}

          {scope === "cell" ? (
            <div className="grid gap-2">
              {positions.map((position) => {
                const isOpen = expandedRows.includes(position);
                const rowTargetIds = fields
                  .map((field) => targetId("cell", position, field.key))
                  .filter((id) => id !== sourceId);
                const selectedCount = rowTargetIds.filter((id) => targets.includes(id)).length;
                const allSelected = rowTargetIds.length > 0 && rowTargetIds.every((id) => targets.includes(id));

                return (
                  <div key={`copy_cell_row_${position}`} className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/40">
                    <div className="flex items-center gap-2 px-3 py-2">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedRows((current) =>
                            current.includes(position)
                              ? current.filter((item) => item !== position)
                              : [...current, position]
                          )
                        }
                        className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-900"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{position}</div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {selectedCount > 0 ? `${selectedCount} destino(s)` : "Sin destinos seleccionados"}
                          </div>
                        </div>
                        <span className={cx(
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
                        onClick={() => toggleRowCells(position)}
                        className={cx(
                          "rounded-lg border px-3 py-2 text-xs font-semibold transition-colors",
                          allSelected
                            ? "border-sky-500 bg-sky-600 text-white"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                        )}
                      >
                        Toda fila
                      </button>
                    </div>

                    {isOpen ? (
                      <div className="border-t border-slate-200 px-3 py-2 dark:border-slate-800">
                        <div className="grid gap-2">
                          {fields.map((field) => {
                            const id = targetId("cell", position, field.key);
                            const isSource = id === sourceId;
                            const checked = targets.includes(id);
                            return (
                              <label
                                key={`copy_cell_${position}_${field.key}`}
                                className={cx(
                                  "flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors",
                                  isSource
                                    ? "cursor-not-allowed border-emerald-200 bg-emerald-50/80 dark:border-emerald-800 dark:bg-emerald-900/20"
                                    : checked
                                      ? "cursor-pointer border-sky-300 bg-sky-50 dark:border-sky-700 dark:bg-sky-900/20"
                                      : "cursor-pointer border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900"
                                )}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={isSource}
                                  onChange={() => toggleTarget(id)}
                                  className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 dark:border-slate-700"
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm font-medium text-slate-800 dark:text-slate-100">{field.label}</div>
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                    {isSource ? "Medida origen" : getValueLabel(position, field.key) || "Sin medida capturada"}
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
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
          <span className="text-xs text-slate-600 dark:text-slate-300">
            {targets.length} destino(s) seleccionado(s)
          </span>
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
