// page.tsx
"use client";
import TornoMeasuresDialog from "@/features/torno-measures/TornoMeasuresDialog";

import { hasRealtimeNotificationConnection } from "@/lib/notificationDelivery";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import LocalityQueue from "../components/LocalityQueue";
import styles from "./RailQueueBoard.module.css";
import { useCoordinatorQueueData } from "./useCoordinatorQueueData";
import DeferredTerminalQueueTable from "./DeferredTerminalQueueTable";
import { GuidedTarget } from "@/features/capacitacion";
import { S } from "./RailQueueBoard.styles";
import { useRealtimeBoardRefresh } from "../useRealtimeBoardRefresh";
import { useTornoMeasuresModal } from "@/features/torno-measures";
import {
  API_XAPI_BASE,
  fmtLoco,
  railQueueListFormatter,
  timeAgo,
} from "@/features/rail-queue/utils";
import {
  useLocalStorageBoolean,
  useOnline,
  useRelativeClock,
  useToasts,
  useVisibleInterval,
} from "@/features/rail-queue/hooks";
import type { Ronda, RondaInfo } from "@/features/rail-queue/types";
import {
  playNotificationSound,
  playOperationConfirmation,
  preloadNotificationSound,
  primeNotificationSound,
} from "@/lib/notificationSound";

const API_BASE = API_XAPI_BASE;
const fmtList = railQueueListFormatter;

/* ===== Carga dinámica del editor ===== */
const EditRondas = dynamic(() => import("../components/EditRondas"), {
  ssr: false,
});

/* ===== Página/Componente ===== */
export default function RailQueueBoardPage({
  localidadId,
  autoMs = 120_000,
  nextCount = 5,
}: {
  localidadId: number;
  autoMs?: number;
  nextCount?: number;
}) {
  const online = useOnline();
  useRelativeClock();

  const boardRef = useRef<HTMLDivElement | null>(null);
  const [isFs, setIsFs] = useState(false);

  const [fullscreenPending, setFullscreenPending] = useState(false);
  const [polling, setPolling] = useLocalStorageBoolean("rail-queue:polling", true);

  const [soundOn, setSoundOn] = useLocalStorageBoolean("rail-queue:soundOn", false);

  const { toasts, push: pushToast, dismiss } = useToasts();

  const lastCurrent = useRef<{ localidadId: number; id: number | null } | null>(null);

  useEffect(() => {
    if (soundOn) preloadNotificationSound();
  }, [soundOn]);

  const toggleSound = useCallback(() => {
    const next = !soundOn;
    setSoundOn(next);
    if (!next) return;
    void primeNotificationSound().then((ready) => {
      if (ready) void playNotificationSound("sonido_actualizado");
    });
  }, [setSoundOn, soundOn]);

  const [openEditor, setOpenEditor] = useState(false);
  const { measuresModal, openMeasuresModal, closeMeasuresModal } = useTornoMeasuresModal(API_BASE);

  const onChanged = useCallback(
    (data: Ronda[], previous: Ronda[]) => {
      if (hasRealtimeNotificationConnection()) return;
      const current = data[0];
      if (previous.length && current && current.id !== previous[0].id) {
        pushToast(
          `Se movió la orden a ${current.movimiento?.id ?? current.movimientoId ?? current.id}`,
          "move",
        );
      }
      const previousIds = new Set(previous.map((item) => item.id));
      const nextIds = new Set(data.map((item) => item.id));
      const created = data.filter((item) => !previousIds.has(item.id));
      const removed = previous.filter((item) => !nextIds.has(item.id));
      if (created.length)
        pushToast(
          `Nueva(s) orden(es): ${fmtList.format(created.map((item) => String(item.movimiento?.id ?? item.movimientoId ?? item.id)))}`,
          "new",
        );
      if (removed.length)
        pushToast(
          `Orden(es) ${fmtList.format(removed.map((item) => String(item.movimiento?.id ?? item.movimientoId ?? item.id)))} salió`,
          "done",
        );
    },
    [pushToast],
  );
  const { items, loading, refreshing, error, updatedAt, load } = useCoordinatorQueueData({
    localidadId,
    onChanged,
    autoRefresh: polling && online,
  });
  const info = useMemo<Record<number, RondaInfo>>(
    () =>
      Object.fromEntries(
        items.map((item) => [
          item.id,
          {
            empresa: item.empresa ?? { id: 0, nombre: "—" },
            movimientoId: item.movimiento?.id ?? item.movimientoId ?? undefined,
            movimiento: {
              ...item.movimiento,
              lavado: Boolean(item.movimiento?.lavado),
              torno: Boolean(item.movimiento?.torno),
              estado: item.movimiento?.estado ?? undefined,
              prioridad: item.movimiento?.prioridad ?? undefined,
              locomotiveNumber:
                item.movimiento?.locomotiveNumber ?? item.movimiento?.locomotora ?? undefined,
            },
          },
        ]),
      ),
    [items],
  );

  const realtimeStatus = useRealtimeBoardRefresh({
    enabled: Boolean(localidadId) && polling && online,
    realtimeLocalidadId: localidadId,
    scopeLocalidadId: localidadId,
    onRefresh: ({ event }) =>
      load(!["realtime.ready", "realtime.resume"].includes(event.type ?? "")),
  });

  // Fullscreen owns its background and scroll container, including on mobile.
  useEffect(() => {
    const onChange = () => setIsFs(document.fullscreenElement === boardRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (fullscreenPending) return;
    setFullscreenPending(true);
    try {
      if (document.fullscreenElement === boardRef.current) await document.exitFullscreen();
      else if (boardRef.current?.requestFullscreen) await boardRef.current.requestFullscreen();
      else throw new Error("Fullscreen unavailable");
    } catch {
      pushToast("No se pudo activar la pantalla completa. Puedes volver a intentarlo.", "warning");
    } finally {
      setFullscreenPending(false);
    }
  }, [fullscreenPending, pushToast]);

  // Shortcuts (deshabilitados cuando el editor está abierto)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (openEditor || measuresModal.open || e.ctrlKey || e.metaKey || e.altKey || e.repeat)
        return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT" ||
          t.isContentEditable)
      )
        return;

      if (e.key === "r") {
        e.preventDefault();
        load(true);
      }
      if (e.key === "a") setPolling((p) => !p);
      if (e.key === "s") toggleSound();
      if (e.key === "f") toggleFullscreen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openEditor, measuresModal.open, toggleSound, toggleFullscreen, setPolling, load]);

  useVisibleInterval(
    () => polling && online && load(),
    polling && realtimeStatus !== "connected" ? Math.min(autoMs, 30_000) : null,
    [autoMs, localidadId, polling, online, realtimeStatus, load],
  );

  useEffect(() => {
    const curId = items[0]?.id ?? null;
    if (
      soundOn &&
      curId &&
      lastCurrent.current?.localidadId === localidadId &&
      lastCurrent.current.id &&
      curId !== lastCurrent.current.id
    ) {
      void playOperationConfirmation("ronda_movimiento_iniciado");
    }
    lastCurrent.current = { localidadId, id: curId };
  }, [items, soundOn, localidadId]);

  const lastAgo = timeAgo(updatedAt);

  return (
    <GuidedTarget id="dashboard-rounds-board">
      <div
        ref={boardRef}
        className={`${S.main} ${styles.board}`}
        data-coordinator-dashboard="true"
        data-fullscreen={isFs}
      >
        {/* TOASTS */}
        <div className={S.toastsWrap}>
          <div className={S.toastsList}>
            {toasts.map((t) => {
              const bar =
                t.kind === "move"
                  ? "border-l-4 border-emerald-500/80"
                  : t.kind === "new"
                    ? "border-l-4 border-sky-500/80"
                    : t.kind === "warning"
                      ? "border-l-4 border-amber-500/80"
                      : "border-l-4 border-slate-400/70";

              const tone =
                t.kind === "move"
                  ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
                  : t.kind === "new"
                    ? "bg-sky-50 text-sky-900 dark:bg-sky-950/40 dark:text-sky-200"
                    : t.kind === "warning"
                      ? "bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
                      : "bg-slate-50 text-slate-900 dark:bg-slate-800 dark:text-slate-100";

              return (
                <button
                  key={t.id}
                  role={t.kind === "warning" ? "alert" : "status"}
                  aria-live={t.kind === "warning" ? "assertive" : "polite"}
                  onClick={() => dismiss(t.id)}
                  className={`${S.toastBtn} ${styles.appear} ${bar} ${tone}`}
                  title="Clic para cerrar"
                >
                  <div className={S.toastRow}>
                    <span className={S.toastIcon}>
                      {t.kind === "move"
                        ? "🔄"
                        : t.kind === "new"
                          ? "🆕"
                          : t.kind === "warning"
                            ? "⚠️"
                            : "✅"}
                    </span>
                    <span className={S.toastText}>{t.text}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* TOOLBAR */}
        <GuidedTarget id="dashboard-rounds-toolbar" className={S.toolbar}>
          <div className={S.toolbarInner}>
            <div className={S.toolbarRow}>
              <div className={S.toolbarLeft}>
                <span className={S.liveChip(polling)}>
                  <span className={S.liveDot(polling)} aria-hidden />
                  {!online
                    ? "Sin conexión"
                    : !polling
                      ? "En pausa"
                      : realtimeStatus === "connected"
                        ? "En vivo"
                        : "Actualización automática"}
                </span>
                <span className={S.lastUpdate}>Últ. act: {lastAgo}</span>
              </div>

              <div className={S.toolbarRight}>
                {!online && <span className={S.offlineChip}>⚠️ Offline</span>}

                <div className={S.toolbarButtons}>
                  <button
                    onClick={toggleSound}
                    className={S.btnSound(soundOn)}
                    title="Pitido al cambiar la orden actual"
                    aria-pressed={soundOn}
                  >
                    <span className={S.btnIcon}>{soundOn ? "🔔" : "🔕"}</span>
                    <span className={S.btnLabel}>{soundOn ? "Sonido" : "Silencio"}</span>
                  </button>

                  <button
                    onClick={() => setPolling((p) => !p)}
                    className={S.btnCommon}
                    title="Activar/pausar auto-actualización"
                    aria-pressed={polling}
                  >
                    <span className={S.btnIcon}>{polling ? "⏸️" : "▶️"}</span>
                    <span className={S.btnLabel}>Auto</span>
                  </button>

                  <button
                    onClick={() => load(true)}
                    disabled={loading || refreshing}
                    className={`${S.btnCommon} ${S.btnDisabled}`}
                    aria-busy={refreshing}
                    title="Refrescar"
                  >
                    <span className={S.btnIcon}>{refreshing ? "⟳" : "↻"}</span>
                    <span className={S.btnLabel}>
                      {refreshing ? "Actualizando…" : "Actualizar"}
                    </span>
                  </button>

                  <button
                    onClick={toggleFullscreen}
                    className={S.btnCommon}
                    title={isFs ? "Salir de pantalla completa (f)" : "Pantalla completa (f)"}
                    aria-label={isFs ? "Salir de pantalla completa" : "Pantalla completa"}
                    disabled={fullscreenPending}
                    aria-pressed={isFs}
                  >
                    <span className={S.btnIcon}>⤢</span>
                    <span className={S.btnLabel}>{isFs ? "Salir" : "Ampliar"}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </GuidedTarget>
        {error && (
          <div
            role="alert"
            className="mx-auto mt-4 flex max-w-screen-2xl flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
          >
            <p>
              {error}
              {updatedAt ? " Se conserva la última información recibida." : ""}
            </p>
            <button
              type="button"
              className={S.btnCommon}
              disabled={loading || refreshing}
              onClick={() => load(true)}
            >
              Reintentar
            </button>
          </div>
        )}
        <section className={S.section}>
          <LocalityQueue
            items={items}
            info={info}
            loading={loading}
            refreshing={refreshing}
            nextCount={nextCount}
            error={error}
            title="Tablero de Rondas"
            headingAs="h1"
            onRefresh={() => load(true)}
            onViewMeasures={openMeasuresModal}
          />
        </section>

        <GuidedTarget
          id="dashboard-rounds-table"
          as="section"
          className="mx-auto w-full max-w-screen-2xl px-3 pb-6 sm:px-4 md:px-6 lg:px-8"
        >
          <DeferredTerminalQueueTable
            items={items}
            info={info}
            loading={loading}
            onViewMeasures={(ronda) => {
              const inf = info[ronda.id];
              const mv = inf?.movimiento ?? ronda.movimiento ?? null;
              openMeasuresModal({
                movementId: inf?.movimientoId ?? mv?.id ?? ronda.movimientoId,
                locomotiveLabel: fmtLoco(mv?.locomotiveNumber ?? mv?.locomotora),
                companyName: inf?.empresa?.nombre ?? ronda.empresa?.nombre ?? "—",
              });
            }}
          />
        </GuidedTarget>

        <TornoMeasuresDialog state={measuresModal} onClose={closeMeasuresModal} />

        {openEditor && (
          <div className={S.modalOverlay}>
            <GuidedTarget id="dashboard-rounds-editor" className={S.modalCard}>
              <div className={S.modalScroll}>
                <EditRondas
                  localidadId={localidadId}
                  onClose={() => setOpenEditor(false)}
                  onSaved={() => {
                    setOpenEditor(false);
                    load(true);
                  }}
                />
              </div>
            </GuidedTarget>
          </div>
        )}
      </div>
    </GuidedTarget>
  );
}
