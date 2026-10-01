"use client";

import { Activity } from "lucide-react";
import { LocomotiveWheelMap } from "../../../torno-measures/locomotive-wheel-selector/LocomotiveWheelMap";
import type { LocomotiveViewMode, WheelCount, WheelData, WheelOverride } from "../../../torno-measures/locomotive-wheel-selector/core/types";
import type { TornoMeasurePosition } from "../../lib/types";
import { cn } from "../../lib/tornoFormat";

export default function GraphicWheelServiceMap({
  wheelCount,
  wheels,
  viewMode,
  selectedWheelId,
  onViewModeChange,
  onWheelSelect,
}: {
  wheelCount: WheelCount;
  wheels: WheelOverride[];
  viewMode: LocomotiveViewMode;
  selectedWheelId?: string;
  onViewModeChange: (mode: LocomotiveViewMode) => void;
  onWheelSelect: (wheel: WheelData) => void;
}) {
  const selectedWheel = wheels.find((wheel) => wheel.id === selectedWheelId);
  const selectedMeta = selectedWheel?.metadata as
    | {
        position?: TornoMeasurePosition;
        workStatus?: string;
        requested?: string | null;
        finalMeasure?: string | null;
      }
    | undefined;
  const views: Array<{ key: LocomotiveViewMode; label: string }> = [
    { key: "top", label: "Superior" },
    { key: "left", label: "Lateral L" },
    { key: "right", label: "Lateral R" },
  ];

  return (
    <div className="grid gap-3 p-3 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 rounded-lg border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-900/30">
        <div className="mb-3 grid grid-cols-3 gap-2">
          {views.map((view) => {
            const active = viewMode === view.key;
            return (
              <button
                key={view.key}
                type="button"
                onClick={() => onViewModeChange(view.key)}
                className={cn(
                  "h-9 rounded-md border px-2 text-xs font-black transition",
                  active
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900",
                )}
              >
                {view.label}
              </button>
            );
          })}
        </div>
        <div className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <LocomotiveWheelMap
            wheelCount={wheelCount}
            viewMode={viewMode}
            selectedWheelId={selectedWheelId}
            wheels={wheels}
            disabled={false}
            showLabels={false}
            orientation="horizontal"
            onWheelSelect={onWheelSelect}
            theme={{
              colors: {
                primary: "#059669",
                primarySoft: "#d1fae5",
                success: "#10b981",
                successSoft: "#d1fae5",
                inProcess: "#0ea5e9",
                inProcessSoft: "#e0f2fe",
                warning: "#f59e0b",
                warningSoft: "#fef3c7",
                danger: "#ef4444",
                dangerSoft: "#fee2e2",
                disabled: "#64748b",
                disabledSoft: "#f1f5f9",
                text: "var(--app-text)",
                textMuted: "var(--app-text-muted)",
                background: "var(--app-surface)",
                surface: "var(--app-surface)",
                surfaceMuted: "var(--app-surface-muted)",
                border: "var(--app-border-strong)",
                rail: "#94a3b8",
                machineStroke: "#047857",
                machineFill: "#059669",
              },
            }}
          />
        </div>
      </div>

      <aside className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
        <p className="text-[11px] font-black uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
          Rueda seleccionada
        </p>
        <h4 className="mt-1 text-lg font-black text-slate-950 dark:text-slate-100">
          {selectedMeta?.position ? `Rueda ${selectedMeta.position}` : "Selecciona una rueda"}
        </h4>
        <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
          Aqui se muestran exclusivamente las medidas de la rueda marcada en el mapa.
        </p>

        <div className="mt-3 grid gap-3">
          <WheelStatusPanel
            status={selectedMeta?.workStatus}
            fallback={selectedWheel?.observations}
          />
          <div className="max-h-[280px] overflow-y-auto rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
            <div className="text-[10px] font-black uppercase opacity-70">Medida inicio</div>
            <WheelMeasureParts value={selectedMeta?.requested} tone="amber" />
          </div>
          <div className="max-h-[280px] overflow-y-auto rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
            <div className="text-[10px] font-black uppercase opacity-70">Medida final</div>
            <WheelMeasureParts value={selectedMeta?.finalMeasure} tone="emerald" />
          </div>
        </div>
      </aside>
    </div>
  );
}

function parseMeasureParts(value?: string | null) {
  if (!value) return [];
  return String(value)
    .split(/\s*\|\s*/g)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const separator = part.indexOf(":");
      if (separator < 0) return { label: "Medida", value: part };
      return {
        label: part.slice(0, separator).trim() || "Medida",
        value: part.slice(separator + 1).trim() || "Sin registro",
      };
    });
}

function WheelMeasureParts({
  value,
  tone,
}: {
  value?: string | null;
  tone: "amber" | "emerald";
}) {
  const parts = parseMeasureParts(value);
  const valueClass =
    tone === "emerald"
      ? "bg-emerald-100 text-emerald-950 dark:bg-emerald-900/50 dark:text-emerald-100"
      : "bg-amber-100 text-amber-950 dark:bg-amber-900/50 dark:text-amber-100";

  if (parts.length === 0) {
    return <div className="mt-1 text-xs font-bold leading-5 opacity-75">Sin registro</div>;
  }

  return (
    <div className="mt-2 grid gap-1.5">
      {parts.map((part, index) => (
        <div
          key={`${part.label}-${index}`}
          className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-md bg-white/60 px-2 py-1.5 text-xs dark:bg-slate-950/30"
        >
          <span className="min-w-0 truncate font-bold opacity-75">{part.label}</span>
          <span className={`max-w-[112px] truncate rounded px-1.5 py-0.5 text-right font-black ${valueClass}`}>
            {part.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function WheelStatusPanel({
  status,
  fallback,
}: {
  status?: string | null;
  fallback?: string | null;
}) {
  const key = String(status || fallback || "").toUpperCase();
  const isInProcess = key.includes("EN_PROCESO") || key.includes("EN PROCESO");
  const isCompleted = key.includes("TERMINADO") || key.includes("COMPLETED");
  const isPending = key.includes("PENDIENTE") || key.includes("PAUSADO");
  const label = status || fallback || "Sin rueda activa";
  const tone = isInProcess
    ? "border-sky-300 bg-sky-50 text-sky-950 dark:border-sky-800 dark:bg-sky-950/35 dark:text-sky-100"
    : isCompleted
      ? "border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-100"
      : isPending
        ? "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/35 dark:text-amber-100"
        : "border-slate-200 bg-slate-50 text-slate-950 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-100";

  return (
    <div className={`rounded-md border px-3 py-2 ${tone}`}>
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-white/70 dark:bg-slate-950/35">
          {isInProcess ? (
            <Activity className="h-4 w-4" />
          ) : isCompleted ? (
            <CheckIconMini />
          ) : (
            <span className="h-2.5 w-2.5 rounded-full bg-current opacity-70" />
          )}
        </span>
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase opacity-70">Estado</div>
          <div className="mt-0.5 truncate text-sm font-black">{label}</div>
        </div>
      </div>
    </div>
  );
}

function CheckIconMini() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4">
      <path
        fill="currentColor"
        d="M8.2 14.4 3.9 10.1l1.4-1.4 2.9 2.9 6.5-6.5 1.4 1.4-7.9 7.9Z"
      />
    </svg>
  );
}

