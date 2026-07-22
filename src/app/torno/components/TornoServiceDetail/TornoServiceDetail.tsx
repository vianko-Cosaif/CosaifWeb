"use client";

import { Activity, ArrowLeft, Ban, CalendarClock, Grid2X2, Loader2, Map as MapIcon, Play, RefreshCw, TrainFront, UserRound } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import IncidentTree from "../IncidentTree";
import MeasuresSection from "../MeasuresSection";
import TornoFinalMeasuresForm from "../TornoFinalMeasuresForm/TornoFinalMeasuresForm";
import TornoStatusBadge from "../TornoStatusBadge/TornoStatusBadge";
import TornoWheelBoard from "../TornoWheelBoard/TornoWheelBoard";
import { LocomotiveWheelMap } from "../../../Components/locomotive-wheel-selector/LocomotiveWheelMap";
import type {
  TornoMeasurePosition,
  TornoHistoryItem,
  TornoIncidentChild,
  TornoIncidentParent,
  TornoIncidentPayload,
  TornoMeasures,
  TornoPermissions,
  TornoReopenPayload,
  TornoResolvePayload,
  TornoWheelSide,
} from "../../lib/types";
import type {
  LocomotiveViewMode,
  WheelCount,
  WheelData,
  WheelOverride,
} from "../../../Components/locomotive-wheel-selector/core/types";
import { cn, formatDateTime, serviceFolio } from "../../lib/tornoFormat";

type AxisDisplayMode = "board" | "graphic";

const MEASURE_POSITIONS = ["L1", "R1", "L2", "R2", "L3", "R3", "L4", "R4", "L5", "R5", "L6", "R6"] as const;

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

function inferWheelCount(item: TornoHistoryItem): WheelCount {
  const explicit = normalizeWheelCount(item.work?.totalWheels ?? item.measuresRequested?.wheelCount ?? item.measuresFinal?.wheelCount);
  if (explicit) return explicit;

  const maxWorkAxle = Math.max(0, ...(item.work?.wheels ?? []).map((wheel) => Number(wheel.position) || 0));
  if (maxWorkAxle >= 6) return 12;
  if (maxWorkAxle >= 4) return 8;
  if (maxWorkAxle >= 3) return 6;

  let maxMeasureAxle = 0;
  MEASURE_POSITIONS.forEach((position) => {
    const hasValue =
      normalizeMeasureText(item.measuresRequested?.[position]) ||
      normalizeMeasureText(item.measuresFinal?.[position]);
    if (hasValue) maxMeasureAxle = Math.max(maxMeasureAxle, Number(position.slice(1)));
  });

  if (maxMeasureAxle >= 6) return 12;
  if (maxMeasureAxle >= 4) return 8;
  if (maxMeasureAxle >= 3) return 6;
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

function buildWheelOverrides(item: TornoHistoryItem, wheelCount: WheelCount): WheelOverride[] {
  const workByPosition = new Map<string, string>();
  (item.work?.wheels ?? []).forEach((wheel) => {
    workByPosition.set(`${wheel.side}${wheel.position}`, String(wheel.status ?? "").toUpperCase());
  });

  const result: WheelOverride[] = [];
  const axleCount = wheelCount / 2;
  for (let axle = 1; axle <= axleCount; axle += 1) {
    (["L", "R"] as const).forEach((side) => {
      const position = `${side}${axle}` as TornoMeasurePosition;
      const workStatus = workByPosition.get(position);
      const requested = normalizeMeasureText(item.measuresRequested?.[position]);
      const finalMeasure = normalizeMeasureText(item.measuresFinal?.[position]);
      const status =
        workStatus === "TERMINADO" || finalMeasure
          ? "completed"
          : workStatus === "EN_PROCESO"
            ? "inProcess"
            : workStatus === "PAUSADO" || workStatus === "PENDIENTE" || requested
              ? "warning"
              : "disabled";

      result.push({
        id: positionToWheelId(position),
        label: position,
        status,
        observations:
          status === "completed"
            ? "Rueda terminada"
            : status === "inProcess"
              ? "Rueda en proceso"
              : status === "warning"
                ? "Rueda pendiente"
                : "Sin rueda activa",
        profile: status === "inProcess" ? "EN PROCESO" : undefined,
        metadata: { position, workStatus, requested, finalMeasure },
      });
    });
  }
  return result;
}

export default function TornoServiceDetail({
  item,
  loading,
  permissions,
  createdById,
  onBack,
  onRefresh,
  onStartService,
  onCancelService,
  onStartWheel,
  onFinishWheel,
  onSaveFinalMeasures,
  onConcludeService,
  onCreateParent,
  onEditParent,
  onAddChild,
  onResolveParent,
  onReopenParent,
  onResolveChild,
  onNavajas,
}: {
  item: TornoHistoryItem;
  loading: boolean;
  permissions: TornoPermissions;
  createdById?: string | number;
  onBack: () => void;
  onRefresh: () => Promise<void>;
  onStartService?: (item: TornoHistoryItem) => Promise<void>;
  onCancelService?: (item: TornoHistoryItem) => Promise<void>;
  onStartWheel?: (item: TornoHistoryItem, position: number, side: TornoWheelSide) => Promise<void>;
  onFinishWheel?: (item: TornoHistoryItem, position: number, side: TornoWheelSide) => Promise<void>;
  onSaveFinalMeasures?: (item: TornoHistoryItem, measures: TornoMeasures) => Promise<void>;
  onConcludeService?: (item: TornoHistoryItem, measures: TornoMeasures) => Promise<void>;
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
  const [busy, setBusy] = useState<string | null>(null);
  const [axisDisplayMode, setAxisDisplayMode] = useState<AxisDisplayMode>("board");
  const [wheelMapViewMode, setWheelMapViewMode] = useState<LocomotiveViewMode>("top");
  const [selectedWheelPosition, setSelectedWheelPosition] = useState<TornoMeasurePosition | null>(null);
  const finalStatus = ["CONCLUIDO", "CANCELADO"].includes(String(item.status).toUpperCase());
  const blocked = (item.activeIncidents ?? 0) > 0;
  const showInternal = permissions.canViewIncidents;
  const canOperate = permissions.canOperateServices && !finalStatus && !blocked;
  const canStart = canOperate && (String(item.status).toUpperCase() === "SOLICITADO" || !item.work?.wheels.length);
  const canCancel = permissions.canCancelServices && !finalStatus;
  const wheelCount = useMemo(() => inferWheelCount(item), [item]);
  const wheelOverrides = useMemo(() => buildWheelOverrides(item, wheelCount), [item, wheelCount]);
  const firstAvailableWheel = useMemo(
    () => wheelOverrides.find((wheel) => wheel.status !== "disabled")?.id ?? null,
    [wheelOverrides],
  );
  const selectedWheelId = selectedWheelPosition ? positionToWheelId(selectedWheelPosition) : firstAvailableWheel ?? undefined;

  const run = async (key: string, action?: () => Promise<void>) => {
    if (!action || busy) return;
    setBusy(key);
    try {
      await action();
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="space-y-4">
      <header className="sticky top-0 z-20 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/70 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none">
        <div className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver
            </button>
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-emerald-600 text-white shadow-sm dark:bg-emerald-400 dark:text-slate-950">
              <TrainFront className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                Servicio Torno
              </p>
              <h1 className="truncate text-xl font-black text-slate-950 dark:text-slate-100">
                Locomotora {item.numeroLocomotora ?? item.locomotive ?? "-"}
              </h1>
              <p className="truncate text-xs font-semibold text-slate-500 dark:text-slate-400">
                {serviceFolio(item)} - {item.companyName || "Cliente sin nombre"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <TornoStatusBadge status={item.status} />
            <button
              type="button"
              onClick={() => run("refresh", onRefresh)}
              disabled={busy === "refresh" || loading}
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
              title="Actualizar"
              aria-label="Actualizar"
            >
              <RefreshCw className={cn("h-4 w-4", (busy === "refresh" || loading) && "animate-spin")} />
            </button>
            {canStart && (
              <button
                type="button"
                onClick={() => run("start", () => onStartService?.(item) ?? Promise.resolve())}
                disabled={busy === "start"}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-sky-600 px-3 text-sm font-black text-white shadow-sm transition hover:bg-sky-700 disabled:opacity-50 dark:bg-sky-400 dark:text-slate-950 dark:hover:bg-sky-300"
              >
                {busy === "start" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Iniciar
              </button>
            )}
            {canCancel && (
              <button
                type="button"
                onClick={() => run("cancel", () => onCancelService?.(item) ?? Promise.resolve())}
                disabled={busy === "cancel"}
                className="inline-flex h-10 items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 text-sm font-black text-rose-700 transition hover:bg-rose-100 disabled:opacity-50 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200"
              >
                {busy === "cancel" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
                Cancelar
              </button>
            )}
          </div>
        </div>
      </header>

      {blocked && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-bold text-orange-800 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-200">
          Servicio detenido por incidente activo. Resuelve el incidente para continuar la operacion.
        </div>
      )}

      <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none md:grid-cols-2 xl:grid-cols-4">
        <InfoTile label="Solicitud" value={formatDateTime(item.date)} icon={<CalendarClock className="h-4 w-4" />} />
        <InfoTile label="Inicio" value={formatDateTime(item.startAt ?? item.work?.startAt)} icon={<CalendarClock className="h-4 w-4" />} />
        <InfoTile label="Fin" value={formatDateTime(item.endAt ?? item.work?.endAt)} icon={<CalendarClock className="h-4 w-4" />} />
        <InfoTile
          label={showInternal ? "Operador" : "Servicio"}
          value={showInternal ? item.operator || "-" : item.service || "Torno"}
          icon={<UserRound className="h-4 w-4" />}
        />
      </section>

      <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none md:grid-cols-2 xl:grid-cols-4">
        <InfoTile label="Cliente" value={item.companyName || "-"} />
        <InfoTile label="Localidad" value={item.localityName || "-"} />
        <InfoTile label="Origen" value={item.originName || "-"} />
        <InfoTile label="Destino" value={item.destinationName || "-"} />
      </section>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div className="min-w-0">
            <h3 className="text-sm font-black text-slate-950 dark:text-slate-100">
              {axisDisplayMode === "graphic" ? "Mapa grafico mobile" : "Tablero de ejes"}
            </h3>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Alterna entre el tablero clasico y una vista grafica didactica.
            </p>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:w-[360px]">
            <button
              type="button"
              onClick={() => setAxisDisplayMode("board")}
              className={cn(
                "inline-flex h-10 items-center justify-center gap-2 rounded-md border px-3 text-xs font-black transition",
                axisDisplayMode === "board"
                  ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900",
              )}
            >
              <Grid2X2 className="h-4 w-4" />
              Tablero
            </button>
            <button
              type="button"
              onClick={() => setAxisDisplayMode("graphic")}
              className={cn(
                "inline-flex h-10 items-center justify-center gap-2 rounded-md border px-3 text-xs font-black transition",
                axisDisplayMode === "graphic"
                  ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900",
              )}
            >
              <MapIcon className="h-4 w-4" />
              Mapa grafico
            </button>
          </div>
        </div>

        {axisDisplayMode === "graphic" ? (
          <GraphicWheelServiceMap
            wheelCount={wheelCount}
            wheels={wheelOverrides}
            viewMode={wheelMapViewMode}
            selectedWheelId={selectedWheelId}
            onViewModeChange={setWheelMapViewMode}
            onWheelSelect={(wheel) => {
              const next = wheelIdToPosition(wheel.id);
              if (next) setSelectedWheelPosition(next);
            }}
          />
        ) : (
          <TornoWheelBoard
            item={item}
            canOperate={canOperate}
            canViewDurations={permissions.canViewDurations}
            busyKey={busy?.startsWith("wheel:") ? busy.slice("wheel:".length) : null}
            onStartWheel={(position, side) => run(`wheel:${position}-${side}`, () => onStartWheel?.(item, position, side) ?? Promise.resolve())}
            onFinishWheel={(position, side) => run(`wheel:${position}-${side}`, () => onFinishWheel?.(item, position, side) ?? Promise.resolve())}
          />
        )}
      </section>

      {axisDisplayMode !== "graphic" && (
        <div className="grid items-start gap-4 xl:grid-cols-2">
          <MeasuresSection title="Medidas de inicio" measures={item.measuresRequested} />
          <TornoFinalMeasuresForm
            requested={item.measuresRequested}
            final={item.measuresFinal}
            canEdit={permissions.canManageFinalMeasures && !finalStatus}
            canConclude={permissions.canManageFinalMeasures && !finalStatus && !blocked}
            busy={busy === "save-final" || busy === "conclude"}
            onSave={(measures) => run("save-final", () => onSaveFinalMeasures?.(item, measures) ?? Promise.resolve())}
            onConclude={(measures) => run("conclude", () => onConcludeService?.(item, measures) ?? Promise.resolve())}
          />
        </div>
      )}

      {permissions.canViewIncidents && (
        <IncidentTree
          incidents={item.incidents ?? []}
          permissions={permissions}
          createdById={createdById}
          incidentContext={{
            rondaServicioId: item.rondaServicioId ?? undefined,
            ruedaSolicitudId: item.ruedaSolicitudId ?? undefined,
            numeroLocomotora: item.numeroLocomotora ?? undefined,
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

function GraphicWheelServiceMap({
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
                text: "#0f172a",
                textMuted: "#64748b",
                background: "#ffffff",
                surface: "#ffffff",
                surfaceMuted: "#f8fafc",
                border: "#cbd5e1",
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

function InfoTile({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900/40">
      <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {icon}
        {label}
      </div>
      <div className="mt-1 truncate text-sm font-black text-slate-950 dark:text-slate-100">{value}</div>
    </div>
  );
}
