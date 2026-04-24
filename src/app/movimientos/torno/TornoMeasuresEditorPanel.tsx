"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  EMPTY_TORNO_VALUE,
  formatTornoMeasure,
  getTornoPositions,
  normalizeTornoMeasureValue,
  TORNO_DEN_OPTIONS,
  TORNO_WHEEL_COUNT_OPTIONS,
  type TornoMeasurementField,
  type TornoMeasurementPart,
  type TornoMedicionState,
  type TornoWheelCount,
  type TornoWheelPosition,
} from "../crear/tornoMedicion.types";
import { resolveTornoProfile, TORNO_PROFILE_FIELDS } from "../crear/tornoProfiles";
import { Movimiento } from "../Movimiento";
import { DynamicTable, type DynamicTableColumn } from "@/app/Components/dynamic-table";

type Props = {
  tornoMedicion: TornoMedicionState;
  companyName?: string;
  readonly?: boolean;
  setTornoWheelCount: (count: TornoWheelCount) => void;
  updateTornoMedicion: (
    position: TornoWheelPosition,
    field: TornoMeasurementField,
    part: TornoMeasurementPart,
    value: string
  ) => void;
  clearTornoMedicion: () => void;
};

type TornoEditorRow = {
  position: TornoWheelPosition;
};

const wholeOptions = ["", ...Array.from({ length: 100 }, (_, index) => String(index))];

function targetId(position: TornoWheelPosition, field: TornoMeasurementField) {
  return `${position}::${field}`;
}

export default function TornoMeasuresEditorPanel(props: Props) {
  const {
    tornoMedicion,
    companyName,
    readonly,
    setTornoWheelCount,
    updateTornoMedicion,
    clearTornoMedicion,
  } = props;

  const profile = useMemo(() => resolveTornoProfile(companyName), [companyName]);
  const fieldDefs = TORNO_PROFILE_FIELDS[profile];
  const positions = useMemo(() => getTornoPositions(tornoMedicion.wheelCount), [tornoMedicion.wheelCount]);
  const tableData = useMemo<TornoEditorRow[]>(
    () => positions.map((position) => ({ position })),
    [positions]
  );

  const [measureModal, setMeasureModal] = useState<{
    open: boolean;
    position: TornoWheelPosition | null;
    field: TornoMeasurementField | null;
    label: string;
    draft: { whole: string; num: string; den: string };
  }>({
    open: false,
    position: null,
    field: null,
    label: "",
    draft: { whole: "", num: "", den: "" },
  });
  const [copyModal, setCopyModal] = useState<{
    open: boolean;
    sourcePosition: TornoWheelPosition | null;
    sourceField: TornoMeasurementField | null;
    sourceLabel: string;
    sourceValue: { whole: string; num: string; den: string };
    targets: string[];
    expandedPositions: TornoWheelPosition[];
  }>({
    open: false,
    sourcePosition: null,
    sourceField: null,
    sourceLabel: "",
    sourceValue: { whole: "", num: "", den: "" },
    targets: [],
    expandedPositions: [],
  });
  const [pastedTargets, setPastedTargets] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!pastedTargets.size) return;
    const t = window.setTimeout(() => setPastedTargets(new Set()), 1200);
    return () => window.clearTimeout(t);
  }, [pastedTargets]);

  const numeratorOptions = useMemo(() => {
    const denominator = Number(measureModal.draft.den);
    if (Number.isFinite(denominator) && denominator > 0) {
      return ["", ...Array.from({ length: denominator }, (_, index) => String(index))];
    }
    return ["", ...Array.from({ length: 65 }, (_, index) => String(index))];
  }, [measureModal.draft.den]);

  const openMeasureModal = (
    position: TornoWheelPosition,
    field: TornoMeasurementField,
    label: string,
    value: { whole: string; num: string; den: string }
  ) => {
    if (readonly) return;
    setMeasureModal({
      open: true,
      position,
      field,
      label,
      draft: {
        whole: value.whole ?? "",
        num: value.num ?? "",
        den: value.den ?? "",
      },
    });
  };

  const applyMeasureModal = () => {
    if (!measureModal.field || !measureModal.position) return;
    const normalized = normalizeTornoMeasureValue(measureModal.draft);
    updateTornoMedicion(measureModal.position, measureModal.field, "whole", normalized.whole);
    updateTornoMedicion(measureModal.position, measureModal.field, "num", normalized.num);
    updateTornoMedicion(measureModal.position, measureModal.field, "den", normalized.den);
    setMeasureModal((prev) => ({ ...prev, open: false }));
  };

  const openCopyModal = (
    position: TornoWheelPosition,
    field: TornoMeasurementField,
    label: string,
    sourceValue: { whole: string; num: string; den: string }
  ) => {
    if (readonly) return;
    setCopyModal({
      open: true,
      sourcePosition: position,
      sourceField: field,
      sourceLabel: label,
      sourceValue: {
        whole: sourceValue.whole ?? "",
        num: sourceValue.num ?? "",
        den: sourceValue.den ?? "",
      },
      targets: [],
      expandedPositions: [position],
    });
  };

  const toggleTarget = (position: TornoWheelPosition, field: TornoMeasurementField) => {
    if (copyModal.sourcePosition === position && copyModal.sourceField === field) return;
    const id = targetId(position, field);
    setCopyModal((prev) => {
      const exists = prev.targets.includes(id);
      return {
        ...prev,
        targets: exists ? prev.targets.filter((x) => x !== id) : [...prev.targets, id],
      };
    });
  };

  const selectAllWheelTargets = (position: TornoWheelPosition) => {
    setCopyModal((prev) => {
      const ids = fieldDefs
        .map((field) => targetId(position, field.key))
        .filter((id) => {
          if (!prev.sourcePosition || !prev.sourceField) return true;
          return id !== targetId(prev.sourcePosition, prev.sourceField);
        });
      const allSelected = ids.length > 0 && ids.every((id) => prev.targets.includes(id));
      return {
        ...prev,
        targets: allSelected
          ? prev.targets.filter((id) => !ids.includes(id))
          : [...new Set([...prev.targets, ...ids])],
      };
    });
  };

  const toggleAccordion = (position: TornoWheelPosition) => {
    setCopyModal((prev) => {
      const expanded = prev.expandedPositions.includes(position);
      return {
        ...prev,
        expandedPositions: expanded
          ? prev.expandedPositions.filter((x) => x !== position)
          : [...prev.expandedPositions, position],
      };
    });
  };

  const applyCopy = () => {
    if (!copyModal.sourceField || !copyModal.sourcePosition || copyModal.targets.length === 0) {
      setCopyModal((prev) => ({ ...prev, open: false }));
      return;
    }

    copyModal.targets.forEach((id) => {
      const [rawPosition, rawField] = id.split("::");
      const position = rawPosition as TornoWheelPosition;
      const field = rawField as TornoMeasurementField;
      if (!positions.includes(position)) return;
      if (!fieldDefs.some((f) => f.key === field)) return;
      updateTornoMedicion(position, field, "whole", copyModal.sourceValue.whole);
      updateTornoMedicion(position, field, "num", copyModal.sourceValue.num);
      updateTornoMedicion(position, field, "den", copyModal.sourceValue.den);
    });
    setPastedTargets(new Set(copyModal.targets));
    setCopyModal((prev) => ({ ...prev, open: false, targets: [], expandedPositions: [] }));
  };

  const tableColumns = useMemo<DynamicTableColumn<TornoEditorRow>[]>(() => {
    const baseColumns: DynamicTableColumn<TornoEditorRow>[] = [
      {
        key: "position",
        title: "Posicion",
        width: 98,
        priority: 1,
        render: ({ row }) => (
          <span className="font-semibold text-slate-800 dark:text-slate-100">{row.position}</span>
        ),
      },
    ];

    const measureColumns = fieldDefs.map<DynamicTableColumn<TornoEditorRow>>((field) => ({
      key: field.key,
      title: field.label,
      width: 210,
      priority: 2,
      render: ({ row }) => {
        const value = tornoMedicion.rows[row.position]?.[field.key] ?? EMPTY_TORNO_VALUE;
        const formatted = formatTornoMeasure(value);
        const hasValue = formatted.length > 0;
        const currentTargetId = targetId(row.position, field.key);
        const pasted = pastedTargets.has(currentTargetId);

        return (
          <div
            className={Movimiento.clsx(
              "rounded-lg border p-1.5",
              pasted
                ? "border-sky-400 bg-sky-50 dark:border-sky-700 dark:bg-sky-900/20"
                : hasValue
                  ? "border-emerald-300 bg-emerald-50/70 dark:border-emerald-800 dark:bg-emerald-900/15"
                  : "border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900/35"
            )}
          >
            <div className="mb-1 text-[11px] text-slate-500 dark:text-slate-400">{formatted || "Sin medida"}</div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={readonly}
                onClick={() => openMeasureModal(row.position, field.key, field.label, value)}
                className={Movimiento.clsx(
                  "min-w-0 flex-1 rounded-md border px-2 py-1 text-left text-[11px] font-semibold transition-colors",
                  readonly
                    ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-600"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                )}
              >
                {hasValue ? "Editar" : "Configurar"}
              </button>
              <button
                type="button"
                disabled={readonly || !hasValue}
                onClick={() => openCopyModal(row.position, field.key, field.label, value)}
                className={Movimiento.clsx(
                  "inline-flex h-7 w-7 items-center justify-center rounded-md border text-[11px] transition-colors",
                  readonly || !hasValue
                    ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-600"
                    : "border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100 dark:border-sky-700 dark:bg-sky-900/30 dark:text-sky-200 dark:hover:bg-sky-900/45"
                )}
                title="Copiar medida"
              >
                C
              </button>
            </div>
          </div>
        );
      },
    }));

    return [...baseColumns, ...measureColumns];
  }, [fieldDefs, pastedTargets, readonly, tornoMedicion.rows]);

  return (
    <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/70">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Medidas de torno</h3>
        <button
          type="button"
          onClick={clearTornoMedicion}
          disabled={readonly}
          className={Movimiento.clsx(
            "ml-auto rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
            readonly
              ? "cursor-not-allowed border-slate-200 text-slate-400 dark:border-slate-800 dark:text-slate-600"
              : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          )}
        >
          Limpiar
        </button>
      </div>

      <div className="mb-3">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Ruedas</div>
        <div className="flex flex-wrap gap-2">
          {TORNO_WHEEL_COUNT_OPTIONS.map((count) => {
            const active = tornoMedicion.wheelCount === count;
            return (
              <button
                key={count}
                type="button"
                disabled={readonly}
                onClick={() => setTornoWheelCount(count)}
                className={Movimiento.clsx(
                  "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                  active
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800",
                  readonly && "opacity-60"
                )}
              >
                {count}
              </button>
            );
          })}
        </div>
      </div>

      <DynamicTable
        data={tableData}
        columns={tableColumns}
        rowKey={(row) => row.position}
        height={Math.min(620, 130 + tableData.length * 58)}
        rowHeight={58}
        headerHeight={46}
        emptyText="Sin posiciones"
        getRowType={(row) => (row.position.startsWith("L") ? "left" : "right")}
      />

      {measureModal.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-800 dark:bg-slate-950">
            <div className="mb-3">
              <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100">Seleccion de medida</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">{measureModal.position ?? "--"} - {measureModal.label}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-[130px_1fr]">
              <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 p-2 dark:border-slate-700">
                <div className="grid gap-1">
                  {wholeOptions.map((option) => {
                    const active = measureModal.draft.whole === option;
                    return (
                      <button
                        key={`whole_${option || "empty"}`}
                        type="button"
                        onClick={() => setMeasureModal((prev) => ({ ...prev, draft: { ...prev.draft, whole: option } }))}
                        className={Movimiento.clsx(
                          "rounded-md border px-2 py-1.5 text-center text-xs font-semibold",
                          active
                            ? "border-emerald-600 bg-emerald-600 text-white"
                            : "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                        )}
                      >
                        {option || "--"}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <div className="mb-2 max-w-full overflow-x-auto">
                  <div className="flex gap-2">
                    {numeratorOptions.map((option) => {
                      const active = measureModal.draft.num === option;
                      return (
                        <button
                          key={`num_${option || "empty"}`}
                          type="button"
                          disabled={!measureModal.draft.den}
                          onClick={() => setMeasureModal((prev) => ({ ...prev, draft: { ...prev.draft, num: option } }))}
                          className={Movimiento.clsx(
                            "shrink-0 rounded-md border px-3 py-1 text-xs font-semibold",
                            !measureModal.draft.den && "opacity-40",
                            active
                              ? "border-emerald-600 bg-emerald-600 text-white"
                              : "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                          )}
                        >
                          {option || "--"}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="my-2 h-px bg-slate-200 dark:bg-slate-700" />
                <div className="max-w-full overflow-x-auto">
                  <div className="flex gap-2">
                    {TORNO_DEN_OPTIONS.map((option) => {
                      const active = measureModal.draft.den === option;
                      return (
                        <button
                          key={`den_${option || "empty"}`}
                          type="button"
                          onClick={() =>
                            setMeasureModal((prev) => ({
                              ...prev,
                              draft: {
                                ...prev.draft,
                                den: option,
                                num: option ? prev.draft.num : "",
                              },
                            }))
                          }
                          className={Movimiento.clsx(
                            "shrink-0 rounded-md border px-3 py-1 text-xs font-semibold",
                            active
                              ? "border-emerald-600 bg-emerald-600 text-white"
                              : "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                          )}
                        >
                          {option || "--"}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <p className="mt-3 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
              {formatTornoMeasure(normalizeTornoMeasureValue(measureModal.draft)) || "Sin medida"}
            </p>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setMeasureModal((prev) => ({ ...prev, open: false }))}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={applyMeasureModal}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {copyModal.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-800 dark:bg-slate-950">
            <div className="mb-3">
              <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100">Pegar medida</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {copyModal.sourcePosition} - {copyModal.sourceLabel} - {formatTornoMeasure(copyModal.sourceValue) || "--"}
              </p>
            </div>

            <div className="max-h-[58vh] overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700">
              {positions.map((position) => {
                const wheelTargetIds = fieldDefs
                  .map((field) => targetId(position, field.key))
                  .filter((id) => {
                    if (!copyModal.sourcePosition || !copyModal.sourceField) return true;
                    return id !== targetId(copyModal.sourcePosition, copyModal.sourceField);
                  });
                const selectedCount = wheelTargetIds.filter((id) => copyModal.targets.includes(id)).length;
                const expanded = copyModal.expandedPositions.includes(position);

                return (
                  <div key={`wheel_${position}`} className="border-b border-slate-200 p-2 dark:border-slate-700">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleAccordion(position)}
                        className="flex flex-1 items-center justify-between rounded-lg px-2 py-1.5 text-left hover:bg-slate-50 dark:hover:bg-slate-900"
                      >
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{position}</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">{selectedCount}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => selectAllWheelTargets(position)}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        Toda rueda
                      </button>
                    </div>

                    {expanded ? (
                      <div className="mt-2 grid gap-1">
                        {fieldDefs.map((field) => {
                          const id = targetId(position, field.key);
                          const sourceCell = copyModal.sourcePosition === position && copyModal.sourceField === field.key;
                          const checked = copyModal.targets.includes(id);
                          const targetValue = tornoMedicion.rows[position]?.[field.key] ?? { whole: "", num: "", den: "" };

                          return (
                            <button
                              key={`target_${position}_${field.key}`}
                              type="button"
                              disabled={sourceCell}
                              onClick={() => toggleTarget(position, field.key)}
                              className={Movimiento.clsx(
                                "flex items-center justify-between rounded-lg border px-2 py-2 text-left",
                                sourceCell
                                  ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-600"
                                  : checked
                                    ? "border-sky-400 bg-sky-50 text-sky-700 dark:border-sky-700 dark:bg-sky-900/30 dark:text-sky-200"
                                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                              )}
                            >
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-xs font-semibold">{field.label}</span>
                                <span className="block text-[11px] opacity-75">
                                  {sourceCell ? "Origen" : (formatTornoMeasure(targetValue) || "--")}
                                </span>
                              </span>
                              <span className="ml-2 text-xs font-bold">{sourceCell ? "LOCK" : checked ? "ON" : "OFF"}</span>
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <p className="mt-2 text-right text-xs text-slate-500 dark:text-slate-400">{copyModal.targets.length} medida(s)</p>

            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCopyModal((prev) => ({ ...prev, open: false, targets: [], expandedPositions: [] }))}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={copyModal.targets.length === 0}
                onClick={applyCopy}
                className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-55"
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
