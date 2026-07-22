"use client";

import { ArrowLeft, CalendarClock, CircleGauge, FileDown, Loader2, TrainFront, UserRound } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import MeasuresSection from "./MeasuresSection";
import IncidentTree from "./IncidentTree";
import { downloadTornoHistoryPdf } from "../../movimientos/crear/tornoPdf";
import {
  resolveTornoProfile,
  TORNO_PROFILE_FIELDS,
} from "../../movimientos/crear/tornoProfiles";
import type {
  TornoMeasurePosition,
  TornoMeasures,
  TornoHistoryItem,
  TornoIncidentChild,
  TornoIncidentParent,
  TornoIncidentPayload,
  TornoPermissions,
  TornoReopenPayload,
  TornoResolvePayload,
} from "../lib/types";
import { LocomotiveWheelMap } from "../../Components/locomotive-wheel-selector/LocomotiveWheelMap";
import type {
  LocomotiveViewMode,
  WheelCount,
  WheelData,
  WheelOverride,
} from "../../Components/locomotive-wheel-selector/core/types";

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusClasses(status?: string) {
  const key = String(status || "").toUpperCase();
  if (key === "SOLICITADO") return "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200";
  if (key === "EN_PROCESO") return "border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-200";
  if (key === "CONCLUIDO") return "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200";
  if (key === "DETENIDO") return "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200";
  return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200";
}

const MEASURE_POSITIONS = ["L1", "R1", "L2", "R2", "L3", "R3", "L4", "R4", "L5", "R5", "L6", "R6"] as const;

type HistoryWheelMapItem = {
  position: TornoMeasurePosition;
  requested: string | null;
  final: string | null;
};

function normalizeMeasureText(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text || /^NO[_\s-]?APLICA$/i.test(text)) return null;
  return text;
}

function normalizeWheelCount(value: unknown): WheelCount | null {
  const numeric = Number(value);
  if (numeric === 4 || numeric === 6 || numeric === 8 || numeric === 12) return numeric;
  return null;
}

function inferHistoryWheelCount(item?: TornoHistoryItem | null): WheelCount {
  const explicit = normalizeWheelCount(item?.measuresRequested?.wheelCount ?? item?.measuresFinal?.wheelCount ?? item?.work?.totalWheels);
  if (explicit) return explicit;

  let maxAxle = 0;
  MEASURE_POSITIONS.forEach((position) => {
    const hasValue =
      normalizeMeasureText(item?.measuresRequested?.[position]) ||
      normalizeMeasureText(item?.measuresFinal?.[position]);
    if (hasValue) maxAxle = Math.max(maxAxle, Number(position.slice(1)));
  });

  if (maxAxle >= 6) return 12;
  if (maxAxle >= 4) return 8;
  if (maxAxle >= 3) return 6;
  return 4;
}

function positionToWheelId(position: TornoMeasurePosition) {
  const side = position.startsWith("L") ? "L" : "R";
  return `A${Number(position.slice(1))}-${side}`;
}

function wheelIdToPosition(id: string): TornoMeasurePosition | null {
  const match = /^A(\d+)-(L|R)$/.exec(id);
  if (!match) return null;
  return `${match[2]}${match[1]}` as TornoMeasurePosition;
}

function buildHistoryWheelMapItems(
  requested: TornoMeasures | undefined,
  final: TornoMeasures | undefined,
  wheelCount: WheelCount,
): HistoryWheelMapItem[] {
  const items: HistoryWheelMapItem[] = [];
  const axleCount = wheelCount / 2;
  for (let axle = 1; axle <= axleCount; axle += 1) {
    (["L", "R"] as const).forEach((side) => {
      const position = `${side}${axle}` as TornoMeasurePosition;
      items.push({
        position,
        requested: normalizeMeasureText(requested?.[position]),
        final: normalizeMeasureText(final?.[position]),
      });
    });
  }
  return items;
}

function buildHistoryWheelOverrides(items: HistoryWheelMapItem[]): WheelOverride[] {
  return items.map((item) => ({
    id: positionToWheelId(item.position),
    label: item.position,
    status: item.final ? "completed" : item.requested ? "warning" : "disabled",
    observations: item.final
      ? "Medida final registrada"
      : item.requested
        ? "Medida solicitada registrada"
        : "Sin datos historicos",
    metadata: {
      position: item.position,
      requested: item.requested,
      final: item.final,
    },
  }));
}

function truncateMeasure(value?: string | null) {
  if (!value) return "Sin registro";
  return value.length > 140 ? `${value.slice(0, 139).trim()}...` : value;
}

export default function HistorialDetailModal({
  item,
  loading,
  permissions,
  createdById,
  onClose,
  onCreateParent,
  onEditParent,
  onAddChild,
  onResolveParent,
  onReopenParent,
  onResolveChild,
  onNavajas,
}: {
  item: TornoHistoryItem | null;
  loading: boolean;
  permissions: TornoPermissions;
  createdById?: string | number;
  onClose: () => void;
  onCreateParent?: (payload: TornoIncidentPayload) => Promise<void>;
  onEditParent?: (
    incident: TornoIncidentParent,
    patch: Partial<TornoIncidentPayload> & { status?: string },
  ) => Promise<void>;
  onAddChild?: (parentId: string | number, payload: TornoIncidentPayload) => Promise<void>;
  onResolveParent?: (incident: TornoIncidentParent, payload?: TornoResolvePayload) => Promise<void>;
  onReopenParent?: (incident: TornoIncidentParent, payload?: TornoReopenPayload) => Promise<void>;
  onResolveChild?: (child: TornoIncidentChild, payload?: TornoResolvePayload) => Promise<void>;
  onNavajas?: () => void;
}) {
  const [pdfSending, setPdfSending] = useState(false);
  const [wheelMapViewMode, setWheelMapViewMode] = useState<LocomotiveViewMode>("top");
  const [selectedWheelPosition, setSelectedWheelPosition] = useState<TornoMeasurePosition | null>(null);
  const historyWheelCount = useMemo(() => inferHistoryWheelCount(item), [item]);
  const historyWheelItems = useMemo(
    () => buildHistoryWheelMapItems(item?.measuresRequested, item?.measuresFinal, historyWheelCount),
    [historyWheelCount, item?.measuresFinal, item?.measuresRequested],
  );
  const historyWheelOverrides = useMemo(
    () => buildHistoryWheelOverrides(historyWheelItems),
    [historyWheelItems],
  );
  const firstWheelWithData = useMemo(
    () => historyWheelItems.find((wheel) => wheel.final || wheel.requested)?.position ?? null,
    [historyWheelItems],
  );
  const selectedWheelBelongsToItem = historyWheelItems.some((wheel) => wheel.position === selectedWheelPosition);
  const activeWheelPosition =
    selectedWheelPosition && selectedWheelBelongsToItem ? selectedWheelPosition : firstWheelWithData;
  const activeWheelItem = useMemo(
    () => historyWheelItems.find((wheel) => wheel.position === activeWheelPosition),
    [activeWheelPosition, historyWheelItems],
  );

  if (!item) return null;

  const handleDownloadPdf = () => {
    if (pdfSending) return;
    const original = item.original && typeof item.original === "object" ? (item.original as Record<string, any>) : {};
    const movimientoId = original.movimientoId ?? original.movimiento?.id ?? original.movimiento?.movimientoId ?? item.id;
    const companyName =
      original.empresa?.nombre ??
      original.company?.name ??
      original.companyName ??
      original.empresaNombre ??
      original.movimiento?.empresa?.nombre ??
      original.ruedaSolicitud?.movimiento?.empresa?.nombre ??
      "";
    const profile = resolveTornoProfile(String(companyName));

    try {
      setPdfSending(true);
      downloadTornoHistoryPdf({
        locomotiveNumber: item.locomotive ?? item.numeroLocomotora ?? "",
        movimientoId,
        servicioId: item.servicioId ?? item.rondaServicioId,
        status: item.status,
        startAt: item.startAt,
        endAt: item.endAt,
        previousMeasures: item.measuresRequested,
        finalMeasures: item.measuresFinal,
        columns: TORNO_PROFILE_FIELDS[profile].map((field) => field.label),
        comments: `Reporte generado desde Detalle Torno. Incidentes registrados: ${item.incidents?.length ?? 0}.`,
      });
    } finally {
      window.setTimeout(() => setPdfSending(false), 500);
    }
  };

  const details = [
    ["Estado", item.status || "—", null],
    ["Servicio", item.service ?? "Torno", null],
    ["Inicio", formatDate(item.startAt), <CalendarClock key="inicio" className="h-3.5 w-3.5" />],
    ["Fin", formatDate(item.endAt), <CalendarClock key="fin" className="h-3.5 w-3.5" />],
    ["Fecha", formatDate(item.date), <CalendarClock key="fecha" className="h-3.5 w-3.5" />],
    ["Tornero", item.operator || "—", <UserRound key="tornero" className="h-3.5 w-3.5" />],
  ] as const;

  return (
    <section className="min-w-0 space-y-4">
      <header className="sticky top-0 z-20 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/70 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none">
        <div className="grid gap-3 p-3 sm:p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver
            </button>
            <div className="hidden h-10 w-px bg-slate-200 dark:bg-slate-800 sm:block" />
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-slate-950 text-white dark:bg-white dark:text-slate-950">
              <TrainFront className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-wide text-cyan-700 dark:text-cyan-300">
                Detalle Torno
              </p>
              <h2 className="truncate text-xl font-black text-slate-950 dark:text-slate-100">
                Locomotora {item.locomotive ?? "—"}
              </h2>
              <p className="truncate text-xs font-semibold text-slate-500 dark:text-slate-400">
                Servicio {item.service ?? "Torno"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={pdfSending}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-cyan-200 bg-cyan-50 px-3 text-xs font-black text-cyan-800 shadow-sm transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-100 dark:hover:bg-cyan-950/70"
            >
              {pdfSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              {pdfSending ? "Generando" : "Generar PDF"}
            </button>
            {loading && (
              <span className="inline-flex h-9 items-center gap-2 rounded-md border border-cyan-200 bg-cyan-50 px-3 text-xs font-black text-cyan-800 dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-100">
                <Loader2 className="h-4 w-4 animate-spin" />
                Actualizando
              </span>
            )}
            <span className={`inline-flex h-9 items-center rounded-full border px-3 text-[11px] font-black uppercase ${statusClasses(item.status)}`}>
              {item.status || "—"}
            </span>
          </div>
        </div>
      </header>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none">
        <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/50">
          <CircleGauge className="h-4 w-4 text-cyan-600 dark:text-cyan-300" />
          <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">Informacion del servicio</h3>
        </div>

        <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {details.map(([label, value, icon]) => (
            <DataTile key={label} label={label} value={value} icon={icon} />
          ))}
        </div>
      </section>

      <HistoryWheelMapPanel
        wheelCount={historyWheelCount}
        wheels={historyWheelOverrides}
        selectedPosition={activeWheelPosition}
        selectedItem={activeWheelItem}
        viewMode={wheelMapViewMode}
        onViewModeChange={setWheelMapViewMode}
        onWheelSelect={(wheel) => {
          const nextPosition = wheelIdToPosition(wheel.id);
          if (nextPosition) setSelectedWheelPosition(nextPosition);
        }}
      />

      <div className="grid items-start gap-4 xl:grid-cols-2">
        <MeasuresSection title="Medidas de inicio" measures={item.measuresRequested} />
        <MeasuresSection title="Medidas de fin" measures={item.measuresFinal} />
      </div>

      {permissions.canViewIncidents && (
        <IncidentTree
          incidents={item.incidents ?? []}
          permissions={permissions}
          createdById={createdById}
          incidentContext={{
            rondaServicioId: item.rondaServicioId,
            ruedaSolicitudId: item.servicioId,
            numeroLocomotora: item.numeroLocomotora,
          }}
          onCreateParent={onCreateParent}
          onEditParent={onEditParent}
          onAddChild={onAddChild}
          onResolveParent={onResolveParent}
          onReopenParent={onReopenParent}
          onResolveChild={onResolveChild}
          onNavajas={onNavajas}
        />
      )}
    </section>
  );
}

function HistoryWheelMapPanel({
  wheelCount,
  wheels,
  selectedPosition,
  selectedItem,
  viewMode,
  onViewModeChange,
  onWheelSelect,
}: {
  wheelCount: WheelCount;
  wheels: WheelOverride[];
  selectedPosition: TornoMeasurePosition | null;
  selectedItem?: HistoryWheelMapItem;
  viewMode: LocomotiveViewMode;
  onViewModeChange: (mode: LocomotiveViewMode) => void;
  onWheelSelect: (wheel: WheelData) => void;
}) {
  const views: Array<{ key: LocomotiveViewMode; label: string }> = [
    { key: "top", label: "Superior" },
    { key: "left", label: "Lateral L" },
    { key: "right", label: "Lateral R" },
  ];

  return (
    <section className="overflow-hidden rounded-lg border border-cyan-100 bg-cyan-50/45 shadow-sm shadow-cyan-100/50 dark:border-cyan-950 dark:bg-cyan-950/20 dark:shadow-none">
      <div className="grid gap-2 border-b border-cyan-100 px-3 py-3 dark:border-cyan-950 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="min-w-0">
          <h3 className="text-sm font-black text-slate-950 dark:text-slate-100">Mapa historico de ruedas</h3>
          <p className="mt-1 text-xs font-semibold leading-5 text-slate-500 dark:text-slate-400">
            Verde indica medida final, amarillo indica medida solicitada y gris indica sin dato historico.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:w-[360px]">
          {views.map((view) => {
            const active = viewMode === view.key;
            return (
              <button
                key={view.key}
                type="button"
                onClick={() => onViewModeChange(view.key)}
                className={
                  active
                    ? "h-9 rounded-md border border-cyan-700 bg-cyan-700 px-2 text-xs font-black text-white shadow-sm"
                    : "h-9 rounded-md border border-slate-200 bg-white px-2 text-xs font-black text-slate-600 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900"
                }
              >
                {view.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3 p-3 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <LocomotiveWheelMap
            wheelCount={wheelCount}
            viewMode={viewMode}
            selectedWheelId={selectedPosition ? positionToWheelId(selectedPosition) : undefined}
            wheels={wheels}
            disabled={false}
            showLabels={false}
            orientation="horizontal"
            onWheelSelect={onWheelSelect}
            theme={{
              colors: {
                primary: "#0891b2",
                primarySoft: "#cffafe",
                success: "#059669",
                successSoft: "#d1fae5",
                inProcess: "#0ea5e9",
                inProcessSoft: "#e0f2fe",
                warning: "#d97706",
                warningSoft: "#fef3c7",
                danger: "#dc2626",
                dangerSoft: "#fee2e2",
                disabled: "#64748b",
                disabledSoft: "#f1f5f9",
                text: "#0f172a",
                textMuted: "#64748b",
                background: "#ffffff",
                surface: "#ffffff",
                surfaceMuted: "#f8fafc",
                border: "#cbd5e1",
                rail: "#94a3b8",
                machineStroke: "#0e7490",
                machineFill: "#0891b2",
              },
            }}
          />
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
          <p className="text-[11px] font-black uppercase tracking-wide text-cyan-700 dark:text-cyan-300">
            Rueda seleccionada
          </p>
          <h4 className="mt-1 text-lg font-black text-slate-950 dark:text-slate-100">
            {selectedPosition ? `Rueda ${selectedPosition}` : "Sin seleccion"}
          </h4>
          <div className="mt-3 grid gap-2">
            <WheelMeasurePreview label="Solicitada" value={selectedItem?.requested} tone="amber" />
            <WheelMeasurePreview label="Final" value={selectedItem?.final} tone="emerald" />
          </div>
        </div>
      </div>
    </section>
  );
}

function WheelMeasurePreview({
  label,
  value,
  tone,
}: {
  label: string;
  value?: string | null;
  tone: "amber" | "emerald";
}) {
  const toneClass =
    tone === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100"
      : "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100";

  return (
    <div className={`rounded-md border px-3 py-2 ${toneClass}`}>
      <div className="text-[10px] font-black uppercase opacity-70">{label}</div>
      <div className="mt-1 text-xs font-bold leading-5">{truncateMeasure(value)}</div>
    </div>
  );
}

function DataTile({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-md border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-slate-400">
        {icon}
        {label}
      </div>
      <div className="mt-1 truncate text-sm font-black text-slate-900 dark:text-slate-100">{value}</div>
    </div>
  );
}
