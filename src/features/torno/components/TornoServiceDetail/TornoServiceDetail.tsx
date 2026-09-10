"use client";

import { ArrowLeft, Ban, CalendarClock, Grid2X2, Loader2, Map as MapIcon, Play, RefreshCw, TrainFront, UserRound } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { GuidedTarget } from "@/features/capacitacion";
import dynamic from "next/dynamic";
import MeasuresSection from "../MeasuresSection";
import TornoFinalMeasuresForm from "../TornoFinalMeasuresForm/TornoFinalMeasuresForm";
import TornoStatusBadge from "../TornoStatusBadge/TornoStatusBadge";
import TornoWheelBoard from "../TornoWheelBoard/TornoWheelBoard";
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
  WheelOverride,
} from "../../../torno-measures/locomotive-wheel-selector/core/types";
import { cn, formatDateTime, serviceFolio } from "../../lib/tornoFormat";

const GraphicWheelServiceMap = dynamic(() => import("./GraphicWheelServiceMap"), {
  loading: () => <div role="status" className="min-h-80 p-4 text-sm text-[var(--app-text-muted)]">Cargando mapa de ruedas…</div>,
});
const IncidentTree = dynamic(() => import("../IncidentTree"), {
  loading: () => <div role="status" className="min-h-32 p-4 text-sm text-[var(--app-text-muted)]">Cargando incidentes…</div>,
});

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
    <GuidedTarget id="torno-service-detail" as="section" className="space-y-4">
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
          Servicio detenido por incidente activo. Resuelve el incidente para continuar la operación.
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

      <GuidedTarget
        id="torno-wheel-panel"
        as="section"
        className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div className="min-w-0">
            <h3 className="text-sm font-black text-slate-950 dark:text-slate-100">
              {axisDisplayMode === "graphic" ? "Mapa de ruedas" : "Tablero de ejes"}
            </h3>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Consulta el avance por eje o selecciona una rueda en el mapa.
            </p>
          </div>
          <GuidedTarget id="torno-wheel-view-tabs" className="grid w-full grid-cols-2 gap-2 sm:w-[360px]">
            <button
              type="button"
              onClick={() => setAxisDisplayMode("board")}
              aria-pressed={axisDisplayMode === "board"}
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
              aria-pressed={axisDisplayMode === "graphic"}
              className={cn(
                "inline-flex h-10 items-center justify-center gap-2 rounded-md border px-3 text-xs font-black transition",
                axisDisplayMode === "graphic"
                  ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900",
              )}
            >
              <MapIcon className="h-4 w-4" />
              Mapa de ruedas
            </button>
          </GuidedTarget>
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
      </GuidedTarget>

      {axisDisplayMode !== "graphic" && (
        <GuidedTarget id="torno-measures-panel" className="grid items-start gap-4 xl:grid-cols-2">
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
        </GuidedTarget>
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
    </GuidedTarget>
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
