"use client";

import { Check, Play, TimerReset } from "lucide-react";
import TornoStatusBadge from "../TornoStatusBadge/TornoStatusBadge";
import type { TornoHistoryItem, TornoWheelSide, TornoWheelWork } from "../../lib/types";
import { cn, formatDateTime, formatDuration } from "../../lib/tornoFormat";

export default function TornoWheelBoard({
  item,
  canOperate,
  canViewDurations,
  busyKey,
  onStartWheel,
  onFinishWheel,
}: {
  item: TornoHistoryItem;
  canOperate: boolean;
  canViewDurations: boolean;
  busyKey?: string | null;
  onStartWheel?: (position: number, side: TornoWheelSide) => Promise<void>;
  onFinishWheel?: (position: number, side: TornoWheelSide) => Promise<void>;
}) {
  const wheels = item.work?.wheels ?? [];

  if (wheels.length === 0) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none">
        <div className="text-sm font-black text-slate-950 dark:text-slate-100">Ejes</div>
        <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
          El servicio aun no tiene ruedas activas. Al iniciar el torno se cargan las ruedas del back.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <div>
          <h3 className="text-sm font-black text-slate-950 dark:text-slate-100">Tablero de ejes</h3>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Control por lado de rueda.
          </p>
        </div>
        <div className="text-xs font-black text-slate-500 dark:text-slate-400">
          {item.work?.completedWheels ?? 0}/{item.work?.totalWheels ?? wheels.length} terminadas
        </div>
      </div>

      <div className="grid gap-3 p-3 lg:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((position) => (
          <AxisCard
            key={position}
            position={position}
            left={wheels.find((wheel) => wheel.position === position && wheel.side === "L")}
            right={wheels.find((wheel) => wheel.position === position && wheel.side === "R")}
            canOperate={canOperate && !["CONCLUIDO", "CANCELADO"].includes(String(item.status).toUpperCase())}
            canViewDurations={canViewDurations}
            busyKey={busyKey}
            onStartWheel={onStartWheel}
            onFinishWheel={onFinishWheel}
          />
        ))}
      </div>
    </section>
  );
}

function AxisCard({
  position,
  left,
  right,
  canOperate,
  canViewDurations,
  busyKey,
  onStartWheel,
  onFinishWheel,
}: {
  position: number;
  left?: TornoWheelWork;
  right?: TornoWheelWork;
  canOperate: boolean;
  canViewDurations: boolean;
  busyKey?: string | null;
  onStartWheel?: (position: number, side: TornoWheelSide) => Promise<void>;
  onFinishWheel?: (position: number, side: TornoWheelSide) => Promise<void>;
}) {
  return (
    <article className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/40">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-black text-slate-950 dark:text-slate-100">Eje {position}</div>
        <TimerReset className="h-4 w-4 text-slate-400" />
      </div>
      <div className="mt-3 grid gap-2">
        <WheelRow
          label="L"
          wheel={left}
          position={position}
          canOperate={canOperate}
          canViewDurations={canViewDurations}
          busyKey={busyKey}
          onStartWheel={onStartWheel}
          onFinishWheel={onFinishWheel}
        />
        <WheelRow
          label="R"
          wheel={right}
          position={position}
          canOperate={canOperate}
          canViewDurations={canViewDurations}
          busyKey={busyKey}
          onStartWheel={onStartWheel}
          onFinishWheel={onFinishWheel}
        />
      </div>
    </article>
  );
}

function WheelRow({
  label,
  wheel,
  position,
  canOperate,
  canViewDurations,
  busyKey,
  onStartWheel,
  onFinishWheel,
}: {
  label: TornoWheelSide;
  wheel?: TornoWheelWork;
  position: number;
  canOperate: boolean;
  canViewDurations: boolean;
  busyKey?: string | null;
  onStartWheel?: (position: number, side: TornoWheelSide) => Promise<void>;
  onFinishWheel?: (position: number, side: TornoWheelSide) => Promise<void>;
}) {
  const status = String(wheel?.status ?? "").toUpperCase();
  const key = `${position}-${label}`;
  const busy = busyKey === key;
  const canStart = canOperate && wheel && ["PENDIENTE", "PAUSADO"].includes(status);
  const canFinish = canOperate && wheel && status === "EN_PROCESO";

  return (
    <div className="grid gap-2 rounded-md border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-950">
      <div className="grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-2">
        <div className="grid h-8 w-8 place-items-center rounded-md bg-slate-100 text-xs font-black text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          {label}
        </div>
        <div className="min-w-0">
          {wheel ? <TornoStatusBadge status={wheel.status} compact /> : <span className="text-xs font-black text-slate-400">SIN RUEDA</span>}
          <div className="mt-1 truncate text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            Inicio {formatDateTime(wheel?.startAt)} - Fin {formatDateTime(wheel?.endAt)}
          </div>
          {canViewDurations && (
            <div className="mt-1 text-[11px] font-black text-emerald-700 dark:text-emerald-300">
              {formatDuration(wheel?.durationSeconds)}
            </div>
          )}
        </div>
        {canOperate && wheel && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={!canStart || busy}
              onClick={() => onStartWheel?.(position, label)}
              className={cn(
                "inline-flex h-8 w-8 items-center justify-center rounded-md border text-slate-600 transition disabled:cursor-not-allowed disabled:opacity-35 dark:text-slate-300",
                "border-slate-200 bg-white hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-950 dark:hover:bg-slate-900",
              )}
              title="Iniciar rueda"
              aria-label="Iniciar rueda"
            >
              <Play className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              disabled={!canFinish || busy}
              onClick={() => onFinishWheel?.(position, label)}
              className={cn(
                "inline-flex h-8 w-8 items-center justify-center rounded-md border text-slate-600 transition disabled:cursor-not-allowed disabled:opacity-35 dark:text-slate-300",
                "border-slate-200 bg-white hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 dark:border-slate-700 dark:bg-slate-950 dark:hover:bg-slate-900",
              )}
              title="Finalizar rueda"
              aria-label="Finalizar rueda"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
