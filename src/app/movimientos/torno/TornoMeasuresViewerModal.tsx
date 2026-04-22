"use client";

import React, { useMemo, useState } from "react";
import {
  EMPTY_TORNO_ROW,
  formatTornoMeasure,
  getTornoPositions,
  type TornoMedicionState,
} from "../crear/tornoMedicion.types";
import { resolveTornoProfile, TORNO_PROFILE_FIELDS } from "../crear/tornoProfiles";
import { Movimiento } from "../Movimiento";

type Props = {
  open: boolean;
  onClose: () => void;
  tornoMedicion: TornoMedicionState;
  locomotiveLabel?: string;
  companyName?: string;
};

type ViewMode = "detail" | "table";

const LABEL_TO_ACRONYM: Record<string, string> = {
  "Altura de Ceja": "AC",
  "Espesor de Ceja": "EC",
  "Caida Vertical": "CV",
  "Espesor de Pestana": "EP",
  "Trazado Entre Caras": "TEC",
  "Diametro Promedio": "DPR",
  "Grueso de Rueda": "GR",
  "Desgaste de Pisada": "DPI",
  "Tramo de Mancuerna": "TM",
  "Diametro de Rueda": "DR",
  Lectura: "LEC",
};

const deriveAcronym = (label: string) => {
  const parts = label.replace(/[^\w\s]/g, " ").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "N/A";
  if (parts.length === 1) return parts[0].slice(0, 3).toUpperCase();
  return parts.slice(0, 3).map((p) => p[0]?.toUpperCase() || "").join("");
};

const swapXAndY = (value: string) =>
  value
    .replace(/\bX\b/g, "__TMP_X__")
    .replace(/\bY\b/g, "X")
    .replace(/\b__TMP_X__\b/g, "Y");

const toAcronymValue = (value: string) => {
  if (!value) return "--";
  if (/^no_aplica$/i.test(value.trim())) return "N/A";
  return value;
};

export default function TornoMeasuresViewerModal(props: Props) {
  const { open, onClose, tornoMedicion, locomotiveLabel, companyName } = props;
  const [viewMode, setViewMode] = useState<ViewMode>("detail");
  const [showLegend, setShowLegend] = useState(false);
  const profile = useMemo(() => resolveTornoProfile(companyName), [companyName]);
  const fieldDefs = TORNO_PROFILE_FIELDS[profile];
  const positions = useMemo(() => getTornoPositions(tornoMedicion.wheelCount), [tornoMedicion.wheelCount]);

  const tableLabels = useMemo(() => fieldDefs.map((field) => field.label), [fieldDefs]);
  const tableAcronyms = useMemo(() => {
    const map: Record<string, string> = {};
    tableLabels.forEach((label) => {
      map[label] = LABEL_TO_ACRONYM[label] ?? deriveAcronym(label);
    });
    return map;
  }, [tableLabels]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-6xl rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-800 dark:bg-slate-950">
        <div className="mb-3 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Medidas de torno</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {locomotiveLabel ? `Locomotora ${locomotiveLabel}` : "Locomotora no definida"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className="mb-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setViewMode("detail");
              setShowLegend(false);
            }}
            className={Movimiento.clsx(
              "rounded-lg border px-3 py-1.5 text-xs font-semibold",
              viewMode === "detail"
                ? "border-emerald-600 bg-emerald-600 text-white"
                : "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            )}
          >
            Completa
          </button>
          <button
            type="button"
            onClick={() => setViewMode("table")}
            className={Movimiento.clsx(
              "rounded-lg border px-3 py-1.5 text-xs font-semibold",
              viewMode === "table"
                ? "border-emerald-600 bg-emerald-600 text-white"
                : "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            )}
          >
            Acronimos
          </button>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {viewMode === "detail" ? "Vista completa para usuarios nuevos." : "Vista rapida para usuarios avanzados."}
          </span>
        </div>

        {viewMode === "detail" ? (
          <div className="max-h-[62vh] overflow-y-auto rounded-xl border border-slate-200 p-3 dark:border-slate-800">
            <div className="grid gap-3 md:grid-cols-2">
              {positions.map((position) => {
                const row = tornoMedicion.rows[position] ?? EMPTY_TORNO_ROW;
                return (
                  <article key={position} className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/40">
                    <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">{position}</h4>
                    <div className="grid gap-1">
                      {fieldDefs.map((field) => {
                        const value = formatTornoMeasure(row[field.key]);
                        return (
                          <div key={`${position}_${field.key}`} className="flex items-center justify-between gap-2 border-b border-slate-200 py-1 text-xs last:border-b-0 dark:border-slate-800">
                            <span className="text-slate-700 dark:text-slate-300">{field.label}</span>
                            <span className="font-semibold text-slate-900 dark:text-slate-100">{value || "--"}</span>
                          </div>
                        );
                      })}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        ) : (
          <div>
            <div className="max-h-[54vh] overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <div className="overflow-x-auto">
                <table className="min-w-[760px] w-full text-xs">
                  <thead className="sticky top-0 bg-slate-100 dark:bg-slate-900">
                    <tr>
                      <th className="border-b border-slate-200 px-2 py-2 text-left dark:border-slate-800">Rueda</th>
                      {tableLabels.map((label) => (
                        <th key={`h_${label}`} className="border-b border-slate-200 px-2 py-2 text-left dark:border-slate-800">
                          {tableAcronyms[label]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {positions.map((position) => {
                      const row = tornoMedicion.rows[position] ?? EMPTY_TORNO_ROW;
                      return (
                        <tr key={`r_${position}`} className="border-b border-slate-200 dark:border-slate-800">
                          <td className="px-2 py-2 font-semibold text-emerald-700 dark:text-emerald-300">{position}</td>
                          {fieldDefs.map((field) => {
                            const formatted = formatTornoMeasure(row[field.key]);
                            return (
                              <td key={`${position}_${field.key}`} className="px-2 py-2 text-slate-800 dark:text-slate-100">
                                {toAcronymValue(swapXAndY(formatted || "--"))}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-2">
              <button
                type="button"
                onClick={() => setShowLegend((prev) => !prev)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-emerald-300 dark:hover:bg-slate-800"
              >
                {showLegend ? "Ocultar info" : "Mas info"}
              </button>
              {showLegend ? (
                <div className="mt-2 max-h-24 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                  {tableLabels.map((label) => (
                    <div key={`legend_${label}`}>{tableAcronyms[label]} = {label}</div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
