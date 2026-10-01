"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import {
  formatTornoMeasure,
  normalizeTornoMeasureValue,
  TORNO_DEN_OPTIONS,
  type TornoMeasurementValue,
} from "../crear/tornoMedicion.types";

type TornoMeasurePickerDialogProps = {
  open: boolean;
  title?: string;
  subtitle?: string;
  draft: TornoMeasurementValue;
  onChange: (draft: TornoMeasurementValue) => void;
  onCancel: () => void;
  onSave: () => void;
  accent?: "emerald" | "rose";
  wholeOptions?: string[];
  denominatorOptions?: readonly string[];
};

const DEFAULT_WHOLE_OPTIONS = ["", ...Array.from({ length: 100 }, (_, index) => String(index))];

function clsx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function ScrollColumn(props: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  accent: "emerald" | "rose";
}) {
  const { label, options, value, onChange, disabled, accent } = props;
  const listRef = useRef<HTMLDivElement | null>(null);
  const optionRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const activeColor = accent === "rose"
    ? "border-red-600 bg-red-50 text-red-800 dark:border-red-500 dark:bg-red-950/40 dark:text-red-100"
    : "border-emerald-600 bg-emerald-50 text-emerald-800 dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-100";

  useEffect(() => {
    if (!value) return;
    optionRefs.current[value]?.scrollIntoView({ block: "center", inline: "center" });
  }, [value]);

  return (
    <section className={clsx("min-w-0", disabled && "opacity-45")}>
      <div className="mb-2 text-center text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-zinc-400">
        {label}
      </div>
      <div
        ref={listRef}
        className="max-h-[34dvh] min-h-44 snap-y overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-2 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="grid gap-2">
          {options.map((option, index) => {
            const active = option === value;
            const key = `${label}_${option || "empty"}_${index}`;
            return (
              <button
                key={key}
                ref={(node) => {
                  optionRefs.current[option || "__empty__"] = node;
                }}
                type="button"
                disabled={disabled}
                onClick={() => onChange(option)}
                className={clsx(
                  "torno-measure-option cosaif-motion-button min-h-14 snap-center rounded-2xl border px-3 text-center text-lg font-black",
                  active
                    ? activeColor
                    : "border-slate-200 bg-white text-slate-800 hover:bg-slate-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900"
                )}
              >
                {option || "--"}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function HorizontalSelector(props: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  accent: "emerald" | "rose";
}) {
  const { label, options, value, onChange, disabled, accent } = props;
  const activeColor = accent === "rose"
    ? "border-red-600 bg-red-50 text-red-800 dark:border-red-500 dark:bg-red-950/40 dark:text-red-100"
    : "border-emerald-600 bg-emerald-50 text-emerald-800 dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-100";

  return (
    <section className={clsx("min-w-0", disabled && "opacity-45")}>
      <div className="mb-2 text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-zinc-400">
        {label}
      </div>
      <div className="overflow-x-auto pb-1">
        <div className="flex min-w-max gap-2">
          {options.map((option, index) => {
            const active = option === value;
            return (
              <button
                key={`${label}_${option || "empty"}_${index}`}
                type="button"
                disabled={disabled}
                onClick={() => onChange(option)}
                className={clsx(
                  "torno-measure-option cosaif-motion-button min-h-12 min-w-14 rounded-2xl border px-3 text-base font-black",
                  active
                    ? activeColor
                    : "border-slate-200 bg-white text-slate-800 hover:bg-slate-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900"
                )}
              >
                {option || "--"}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default function TornoMeasurePickerDialog({
  open,
  title = "Seleccion de medida",
  subtitle = "",
  draft,
  onChange,
  onCancel,
  onSave,
  accent = "emerald",
  wholeOptions = DEFAULT_WHOLE_OPTIONS,
  denominatorOptions = TORNO_DEN_OPTIONS,
}: TornoMeasurePickerDialogProps) {
  const numeratorOptions = useMemo(() => {
    const denominator = Number(draft.den);
    if (Number.isFinite(denominator) && denominator > 0) {
      return ["", ...Array.from({ length: denominator }, (_, index) => String(index))];
    }
    return ["", ...Array.from({ length: 65 }, (_, index) => String(index))];
  }, [draft.den]);
  const preview = formatTornoMeasure(normalizeTornoMeasureValue(draft)) || "Sin medida";
  const accentHeader = accent === "rose"
    ? "bg-red-50 dark:bg-red-950/30"
    : "bg-emerald-50 dark:bg-emerald-950/30";
  const accentText = accent === "rose"
    ? "text-red-800 dark:text-red-100"
    : "text-emerald-800 dark:text-emerald-100";
  const accentButton = accent === "rose"
    ? "bg-red-600 shadow-red-500/25 hover:bg-red-700"
    : "bg-emerald-600 shadow-emerald-500/25 hover:bg-emerald-700";

  if (!open) return null;

  return createPortal(
    <div className="torno-measure-dialog-overlay fixed inset-0 z-[100020] flex items-end justify-center overflow-hidden bg-black/50 p-2 sm:items-center sm:p-3">
      <style jsx global>{`
        @keyframes tornoMeasureOverlayIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes tornoMeasureSheetIn {
          from { opacity: 0; transform: translate3d(0, 24px, 0) scale(0.985); }
          to { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
        }
        @keyframes tornoMeasureItemIn {
          from { opacity: 0; transform: translate3d(0, 8px, 0); }
          to { opacity: 1; transform: translate3d(0, 0, 0); }
        }
        .torno-measure-dialog-overlay {
          animation: tornoMeasureOverlayIn 160ms ease-out both;
        }
        .torno-measure-dialog-card {
          animation: tornoMeasureSheetIn 220ms cubic-bezier(.2,.8,.2,1) both;
          will-change: transform, opacity;
        }
        .torno-measure-option {
          transition: transform 140ms ease, background-color 140ms ease, border-color 140ms ease, box-shadow 140ms ease;
          will-change: transform;
        }
        .torno-measure-option:hover {
          transform: translateY(-1px);
        }
        .torno-measure-option:active {
          transform: scale(0.97);
        }
        .torno-measure-stagger > * {
          animation: tornoMeasureItemIn 180ms ease-out both;
        }
        .torno-measure-stagger > *:nth-child(1) { animation-delay: 20ms; }
        .torno-measure-stagger > *:nth-child(2) { animation-delay: 40ms; }
        .torno-measure-stagger > *:nth-child(3) { animation-delay: 60ms; }
        @media (prefers-reduced-motion: reduce) {
          .torno-measure-dialog-overlay,
          .torno-measure-dialog-card,
          .torno-measure-stagger > * {
            animation: none !important;
          }
          .torno-measure-option {
            transition: none !important;
            transform: none !important;
            will-change: auto !important;
          }
        }
      `}</style>
      <div className="torno-measure-dialog-card cosaif-motion-panel flex max-h-[calc(100dvh-1rem)] min-h-[min(680px,calc(100dvh-1rem))] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950 sm:rounded-[28px]">
        <header className={clsx("shrink-0 border-b border-slate-200 px-4 py-4 dark:border-zinc-800 sm:px-6", accentHeader)}>
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h4 className="break-words text-xl font-black leading-tight text-slate-950 dark:text-white sm:text-2xl">
                {title}
              </h4>
              {subtitle ? (
                <p className="mt-1 text-sm font-bold text-slate-500 dark:text-zinc-400">{subtitle}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="cosaif-motion-button inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-lg font-black text-slate-600 shadow-sm dark:bg-zinc-900 dark:text-zinc-100"
              aria-label="Cerrar selector de medida"
            >
              x
            </button>
          </div>

          <div className={clsx("mt-4 rounded-2xl border border-current bg-white px-4 py-3 dark:bg-zinc-950", accentText)}>
            <div className="text-[11px] font-black uppercase tracking-wide opacity-75">Vista previa</div>
            <div className="mt-1 text-2xl font-black leading-tight sm:text-3xl">{preview}</div>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          <div className="torno-measure-stagger grid min-w-0 gap-4 sm:grid-cols-[minmax(120px,0.72fr)_minmax(0,1.28fr)] sm:items-center">
            <ScrollColumn
              label="Entero"
              options={wholeOptions}
              value={draft.whole}
              onChange={(value) => onChange({ ...draft, whole: value })}
              accent={accent}
            />

            <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-zinc-800 dark:bg-zinc-900 sm:p-4">
              <HorizontalSelector
                label="Numerador"
                options={numeratorOptions}
                value={draft.num}
                onChange={(value) => onChange({ ...draft, num: value })}
                disabled={!draft.den}
                accent={accent}
              />
              <div className="my-4 h-px bg-slate-200 dark:bg-zinc-800" />
              <HorizontalSelector
                label="Denominador"
                options={denominatorOptions}
                value={draft.den}
                onChange={(value) => onChange({ ...draft, den: value, num: value ? draft.num : "" })}
                accent={accent}
              />
            </div>
          </div>
        </main>

        <footer className="flex shrink-0 flex-col gap-2 border-t border-slate-200 bg-slate-50 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900 min-[380px]:flex-row sm:px-6">
          <button
            type="button"
            onClick={onCancel}
            className="cosaif-motion-button min-h-12 flex-1 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onSave}
            className={clsx("cosaif-motion-button min-h-12 flex-1 rounded-2xl px-4 text-sm font-black text-white shadow-lg", accentButton)}
          >
            Guardar
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
}
