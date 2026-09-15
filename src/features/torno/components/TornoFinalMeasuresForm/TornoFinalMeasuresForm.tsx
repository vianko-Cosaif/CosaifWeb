"use client";

import { CheckCircle2, Save } from "lucide-react";
import { useEffect, useState } from "react";
import type { TornoMeasurePosition, TornoMeasures } from "../../lib/types";
import { cn, normalizeMeasureInput, TORNO_MEASURE_POSITIONS } from "../../lib/tornoFormat";

const AXIS_PAIRS = [
  ["L1", "R1"],
  ["L2", "R2"],
  ["L3", "R3"],
  ["L4", "R4"],
  ["L5", "R5"],
  ["L6", "R6"],
] as const satisfies ReadonlyArray<readonly [TornoMeasurePosition, TornoMeasurePosition]>;

type MeasurePart = {
  label: string;
  value: string;
};

type WheelMeasureRow = {
  key: string;
  label: string;
  initial: string;
  final: string;
};

const VALID_MEASURE_LABELS = [
  "Altura de Ceja",
  "Espesor de Ceja",
  "Caida Vertical",
  "Espesor de Pestana",
  "Espesor de Pestaña",
  "Trazado Entre Caras",
  "Diametro Promedio",
  "Diámetro Promedio",
  "Grueso de Rueda",
  "Desgaste de Pisada",
  "Tramo de Mancuerna",
  "Diametro de Rueda",
  "Diámetro de Rueda",
  "Lectura",
].map(normalizeMeasureLabel);

function hasMeasureValue(value: unknown) {
  if (value == null || value === "") return false;
  return String(value).trim() !== "";
}

function measureParts(value: string | number | null | undefined): MeasurePart[] {
  if (!hasMeasureValue(value)) return [];
  const raw = String(value).trim();
  if (/^(NO[_\s-]?APLICA|0|-)$/i.test(raw)) return [];

  return raw
    .split(/\s*\|\s*|\n+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .flatMap((part) => {
      const separator = part.indexOf(":");
      if (separator === -1) return [];
      const label = part.slice(0, separator).trim();
      const normalizedLabel = normalizeMeasureLabel(label);
      const parsedValue = part.slice(separator + 1).trim();
      if (!VALID_MEASURE_LABELS.includes(normalizedLabel)) return [];
      if (!parsedValue || /^(NO[_\s-]?APLICA|0|-)$/i.test(parsedValue)) return [];
      return [{ label, value: parsedValue }];
    });
}

function normalizeMeasureLabel(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function measureKey(label: string) {
  return normalizeMeasureLabel(label);
}

function buildWheelMeasureRows(
  requestedValue: string | number | null | undefined,
  finalValue: string | number | null | undefined,
): WheelMeasureRow[] {
  const rows = new Map<string, WheelMeasureRow>();

  const addPart = (part: MeasurePart, source: "initial" | "final") => {
    const label = part.label;
    const key = measureKey(label);
    if (!key) return;
    const current = rows.get(key) ?? { key, label, initial: "", final: "" };
    rows.set(key, { ...current, label: current.label || label, [source]: part.value });
  };

  measureParts(requestedValue).forEach((part) => addPart(part, "initial"));
  measureParts(finalValue).forEach((part) => addPart(part, "final"));

  return Array.from(rows.values());
}

function serializeWheelMeasureRows(rows: WheelMeasureRow[]) {
  return rows
    .map((row) => {
      const value = row.final.trim();
      if (!value) return "";
      return `${row.label}: ${value}`;
    })
    .filter(Boolean)
    .join(" | ");
}

function updateWheelMeasureValue({
  requestedValue,
  finalValue,
  rowKey,
  nextValue,
}: {
  requestedValue: string | number | null | undefined;
  finalValue: string | number | null | undefined;
  rowKey: string;
  nextValue: string;
}) {
  const rows = buildWheelMeasureRows(requestedValue, finalValue).map((row) =>
    row.key === rowKey ? { ...row, final: nextValue } : row,
  );
  return serializeWheelMeasureRows(rows);
}

function MeasureValueDisplay({ value }: { value: string }) {
  const hasValue = hasMeasureValue(value);

  return (
    <div
      className={cn(
        "min-h-10 rounded-md border px-3 py-2 text-sm font-black",
        hasValue
          ? "border-cyan-100 bg-cyan-50/70 text-cyan-950 dark:border-cyan-950 dark:bg-cyan-950/20 dark:text-cyan-100"
          : "border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-500",
      )}
    >
      {hasValue ? value : "-"}
    </div>
  );
}

function FinalMeasureInput({
  value,
  canEdit,
  onChange,
}: {
  value: string;
  canEdit: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <input
      value={value}
      readOnly={!canEdit}
      onChange={(event) => onChange(event.target.value)}
      className={cn(
        "h-10 w-full rounded-md border px-3 text-sm font-black outline-none transition",
        canEdit
          ? "border-emerald-200 bg-white text-slate-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 dark:border-emerald-900 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-emerald-950"
          : "border-emerald-100 bg-emerald-50/50 text-slate-700 dark:border-emerald-950 dark:bg-emerald-950/20 dark:text-slate-200",
      )}
      placeholder="-"
    />
  );
}

export default function TornoFinalMeasuresForm({
  requested,
  final,
  canEdit,
  canConclude,
  busy,
  onSave,
  onConclude,
}: {
  requested?: TornoMeasures;
  final?: TornoMeasures;
  canEdit: boolean;
  canConclude: boolean;
  busy?: boolean;
  onSave?: (measures: TornoMeasures) => Promise<void>;
  onConclude?: (measures: TornoMeasures) => Promise<void>;
}) {
  const [values, setValues] = useState(() => normalizeMeasureInput(final ?? requested));

  useEffect(() => {
    setValues(normalizeMeasureInput(final ?? requested));
  }, [final, requested]);

  const measures = values as TornoMeasures;
  const valid = TORNO_MEASURE_POSITIONS.every((position) => String(values[position] ?? "").trim().length > 0);
  const axisMeasureGroups = AXIS_PAIRS.map(([left, right]) => ({
    axis: left.slice(1),
    rows: [
      ...buildWheelMeasureRows(requested?.[left], values[left]).map((row) => ({ position: left, row })),
      ...buildWheelMeasureRows(requested?.[right], values[right]).map((row) => ({ position: right, row })),
    ],
  })).filter((group) => group.rows.length > 0);

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/50">
        <div>
          <h3 className="text-sm font-black text-slate-950 dark:text-slate-100">Comparativo de medidas</h3>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Valores iniciales y finales por rueda y eje.
          </p>
        </div>
        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy || !valid}
              onClick={() => onSave?.(measures)}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
            >
              <Save className="h-4 w-4" />
              Guardar
            </button>
            {canConclude && (
              <button
                type="button"
                disabled={busy || !valid}
                onClick={() => onConclude?.(measures)}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-emerald-600 px-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400"
              >
                <CheckCircle2 className="h-4 w-4" />
                Concluir
              </button>
            )}
          </div>
        )}
      </div>

      <div className="overflow-x-auto p-3">
        <table className="w-full min-w-[820px] border-separate border-spacing-0 text-left text-xs">
          <thead>
            <tr>
              <th className="w-[72px] rounded-l-md border-b border-slate-200 bg-slate-100 px-3 py-2 text-[11px] font-black uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                Eje
              </th>
              <th className="w-[88px] border-b border-slate-200 bg-slate-100 px-3 py-2 text-[11px] font-black uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                Rueda
              </th>
              <th className="border-b border-slate-200 bg-slate-100 px-3 py-2 text-[11px] font-black uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                Medida
              </th>
              <th className="w-[240px] border-b border-slate-200 bg-slate-100 px-3 py-2 text-[11px] font-black uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                Inicial
              </th>
              <th className="w-[260px] rounded-r-md border-b border-slate-200 bg-slate-100 px-3 py-2 text-[11px] font-black uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                Final
              </th>
            </tr>
          </thead>
          <tbody>
            {axisMeasureGroups.length > 0 ? (
              axisMeasureGroups.flatMap(({ axis, rows: axisRows }) =>
                axisRows.map(({ position, row }, index) => (
                <tr key={`${position}-${row.key}`}>
                  {index === 0 && (
                    <td
                      rowSpan={axisRows.length}
                      className="border-b border-slate-200 bg-white px-2 py-2 align-top dark:border-slate-800 dark:bg-slate-950"
                    >
                      <div className="sticky top-2 grid min-h-[64px] place-items-center rounded-md bg-slate-50 text-center dark:bg-slate-900">
                        <span className="text-[10px] font-black uppercase text-slate-400">Eje</span>
                        <span className="text-lg font-black text-slate-950 dark:text-slate-100">{axis}</span>
                      </div>
                    </td>
                  )}
                  <td className="border-b border-slate-200 bg-white px-2 py-2 align-top dark:border-slate-800 dark:bg-slate-950">
                    <span
                      className={cn(
                        "inline-flex h-8 min-w-10 items-center justify-center rounded-md px-2 text-xs font-black",
                        position.startsWith("L")
                          ? "bg-cyan-50 text-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-100"
                          : "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100",
                      )}
                    >
                      {position}
                    </span>
                  </td>
                  <td className="border-b border-slate-200 bg-white px-2 py-2 align-middle dark:border-slate-800 dark:bg-slate-950">
                    <div className="rounded-md bg-slate-50 px-3 py-2 text-sm font-black text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                      {row.label}
                    </div>
                  </td>
                  <td className="border-b border-slate-200 bg-white px-2 py-2 align-middle dark:border-slate-800 dark:bg-slate-950">
                    <MeasureValueDisplay value={row.initial} />
                  </td>
                  <td className="border-b border-slate-200 bg-white px-2 py-2 align-middle dark:border-slate-800 dark:bg-slate-950">
                    <FinalMeasureInput
                      value={row.final}
                      canEdit={canEdit}
                      onChange={(nextValue) =>
                        setValues((prev) => ({
                          ...prev,
                          [position]: updateWheelMeasureValue({
                            requestedValue: requested?.[position],
                            finalValue: prev[position],
                            rowKey: row.key,
                            nextValue,
                          }),
                        }))
                      }
                    />
                  </td>
                </tr>
                )),
              )
            ) : (
              <tr>
                <td
                  colSpan={5}
                  className="border-b border-slate-200 bg-white px-3 py-10 text-center text-sm font-bold text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400"
                >
                  Sin medidas validas para desplegar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
