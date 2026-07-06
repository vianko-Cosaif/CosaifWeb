"use client";

import { ArrowLeft, Ban, CalendarClock, Loader2, Play, RefreshCw, TrainFront, UserRound } from "lucide-react";
import { useState, type ReactNode } from "react";
import IncidentTree from "../IncidentTree";
import MeasuresSection from "../MeasuresSection";
import TornoFinalMeasuresForm from "../TornoFinalMeasuresForm/TornoFinalMeasuresForm";
import TornoStatusBadge from "../TornoStatusBadge/TornoStatusBadge";
import TornoWheelBoard from "../TornoWheelBoard/TornoWheelBoard";
import type {
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
import { cn, formatDateTime, serviceFolio } from "../../lib/tornoFormat";

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
  const finalStatus = ["CONCLUIDO", "CANCELADO"].includes(String(item.status).toUpperCase());
  const blocked = (item.activeIncidents ?? 0) > 0;
  const showInternal = permissions.canViewIncidents;
  const canOperate = permissions.canOperateServices && !finalStatus && !blocked;
  const canStart = canOperate && (String(item.status).toUpperCase() === "SOLICITADO" || !item.work?.wheels.length);
  const canCancel = permissions.canCancelServices && !finalStatus;

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

      <TornoWheelBoard
        item={item}
        canOperate={canOperate}
        canViewDurations={permissions.canViewDurations}
        busyKey={busy?.startsWith("wheel:") ? busy.slice("wheel:".length) : null}
        onStartWheel={(position, side) => run(`wheel:${position}-${side}`, () => onStartWheel?.(item, position, side) ?? Promise.resolve())}
        onFinishWheel={(position, side) => run(`wheel:${position}-${side}`, () => onFinishWheel?.(item, position, side) ?? Promise.resolve())}
      />

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
