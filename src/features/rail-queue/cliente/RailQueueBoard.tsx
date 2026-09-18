"use client";
import TornoMeasuresDialog from "@/features/torno-measures/TornoMeasuresDialog";

import { hasRealtimeNotificationConnection } from "@/lib/notificationDelivery";
import { useEffect, useMemo, useState, Fragment } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Bell,
  BellOff,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Droplet,
  Pencil,
  Plus,
  RefreshCw,
  Settings,
  TrainFront,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { GuidedTarget } from "@/features/capacitacion";
import { TRAINING_ROUND_ID, useTrainingTour } from "@/features/capacitacion/TrainingTourContext";
import { S } from "./RailQueueBoardCliente.styles";
import QueueSegmentedFilter, {
  type QueueSegmentedFilterOption,
} from "../../cliente/components/QueueSegmentedFilter";
import { useRealtimeBoardRefresh } from "../useRealtimeBoardRefresh";
import type { RealtimeMovementEvent } from "../../movimientos/useRealtimeMovimientos";
import { useTornoMeasuresModal } from "@/features/torno-measures";
import {
  API_XAPI_BASE,
  codeFrom,
  fmtLoco as formatLoco,
  formatQueueDate as fmtDate,
  movementIdFrom,
} from "@/features/rail-queue/utils";
import { useLocalStorageBoolean, useToasts, useVisibleInterval } from "@/features/rail-queue/hooks";
import type { QueueEntityKind, Ronda, RondaInfo } from "@/features/rail-queue/types";
import { clientQueueInfo } from "./queueData";
import { useClientQueueData } from "./useClientQueueData";
import {
  playNotificationSound,
  playOperationConfirmation,
  preloadNotificationSound,
  primeNotificationSound,
} from "@/lib/notificationSound";
import { PANEL_GRAFICO_ENABLED } from "@/features/panel-grafico/panelGrafico.config";

const fmtLoco = (value: unknown) => formatLoco(value, "—");

function clientRealtimeStateNotice(event: RealtimeMovementEvent) {
  if (event.type !== "movimiento.estado") return null;
  const estado = String(event.estado ?? "").toUpperCase();
  const estadoAnterior = String(event.estadoAnterior ?? "").toUpperCase();
  const subject = event.locomotiveNumber
    ? `Locomotora ${event.locomotiveNumber}`
    : event.movimientoId
      ? `Movimiento #${event.movimientoId}`
      : "Movimiento";

  if (estado === "EN_PROCESO") {
    return {
      text: estadoAnterior === "DETENIDO" ? `${subject} reanudado` : `${subject} iniciado`,
      kind: "move" as const,
    };
  }
  if (estado === "DETENIDO") return { text: `${subject} detenido`, kind: "warning" as const };
  if (estado === "CONCLUIDO") return { text: `${subject} finalizado`, kind: "done" as const };
  if (estado === "CANCELADO") return { text: `${subject} cancelado`, kind: "warning" as const };
  return null;
}

const EditRondas = dynamic(() => import("../components/EditRondas"), {
  ssr: false,
  loading: () => <div className="p-10 text-center text-sm text-slate-500">Cargando editor...</div>,
});

const ENTITY_OPTIONS: QueueSegmentedFilterOption<QueueEntityKind>[] = [
  { label: "Movimientos", value: "movimientos" },
  { label: "Torneados", value: "torneados" },
];

/* ═══════════ MAIN COMPONENT ═══════════ */
export default function RailQueueBoard({
  localidadId,
  empresaId,
  role,
  canCreateMovements = false,
  autoMs = 120_000,
}: {
  localidadId: number;
  empresaId?: number | null;
  role?: string | null;
  canCreateMovements?: boolean;
  autoMs?: number;
}) {
  const sharedLocality = role === "CLIENTE";
  const trainingTour = useTrainingTour();
  const [activeEntity, setActiveEntity] = useState<QueueEntityKind>("movimientos");
  const [openEditor, setOpenEditor] = useState(false);
  const [polling, setPolling] = useLocalStorageBoolean("rail-queue:polling", true);
  const [soundOn, setSoundOn] = useLocalStorageBoolean("rail-queue:soundOn", false);
  const pathname = usePathname();
  const { toasts, push: pushToast, dismiss } = useToasts();
  const { measuresModal, openMeasuresModal, closeMeasuresModal } = useTornoMeasuresModal(
    empresaId ? "/api/cliente" : API_XAPI_BASE,
  );
  const { items, loading, refreshing, error, updatedAt, load } = useClientQueueData({
    localidadId,
    empresaId,
    entity: activeEntity,
    onChanged: (data, previous) => {
      if (hasRealtimeNotificationConnection()) return;
      const previousIds = previous.map((item) => item.id);
      const nextIds = data.map((item) => item.id);
      if (!previousIds.length) return;
      const previousSet = new Set(previousIds);
      const nextSet = new Set(nextIds);
      const created = nextIds.some((id) => !previousSet.has(id));
      const removed = previousIds.some((id) => !nextSet.has(id));
      const reordered =
        previousIds.length === nextIds.length &&
        previousIds.some((id, index) => nextIds[index] !== id);
      if (nextIds[0] && nextIds[0] !== previousIds[0]) pushToast("Orden actualizada", "move");
      if (soundOn) {
        if (created) void playOperationConfirmation("ronda_nueva_creada");
        else if (removed) void playOperationConfirmation("ronda_movimiento_concluido");
        else if (reordered) void playOperationConfirmation("ronda_orden_actualizada");
      }
    },
  });
  const info = useMemo(() => clientQueueInfo(items), [items]);

  useEffect(() => {
    if (soundOn) preloadNotificationSound();
  }, [soundOn]);

  const realtimeStatus = useRealtimeBoardRefresh({
    enabled: Boolean(localidadId) && polling,
    realtimeLocalidadId: localidadId,
    scopeLocalidadId: localidadId,
    onRefresh: ({ event }) => {
      if (document.visibilityState !== "visible") return;
      if (
        event.type === "realtime.ready" &&
        (loading || (updatedAt && Date.now() - updatedAt < 20_000))
      )
        return;
      const notice = clientRealtimeStateNotice(event);
      if (notice && !hasRealtimeNotificationConnection()) pushToast(notice.text, notice.kind);
      return load(true);
    },
  });

  useVisibleInterval(
    () => polling && load(false),
    polling && realtimeStatus !== "connected" ? Math.min(autoMs, 30_000) : null,
    [autoMs, localidadId, empresaId, polling, activeEntity, realtimeStatus, load],
  );

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    if (!next) return;
    void primeNotificationSound().then((ready) => {
      if (ready) void playNotificationSound("sonido_actualizado");
    });
  }

  const trainingQueueItems = useMemo<Ronda[]>(() => {
    if (!trainingTour.active || activeEntity !== "movimientos") return [];
    const movementById = new Map(trainingTour.movements.map((movement) => [movement.id, movement]));
    return trainingTour.roundOrder.reduce<Ronda[]>((rounds, movementId, index) => {
      const movement = movementById.get(movementId);
      if (
        !movement ||
        movement.finalizado ||
        ["CONCLUIDO", "CANCELADO"].includes(String(movement.estado).toUpperCase())
      )
        return rounds;
      rounds.push({
        id: TRAINING_ROUND_ID + index,
        rondaNumero: 99,
        orden: index + 1,
        concluido: false,
        empresa: {
          id: movement.empresaId,
          nombre: movement.empresaNombre || "Empresa de capacitación",
        },
        localidadId: movement.localidadId,
        localidad: {
          id: movement.localidadId,
          nombre: movement.localidadNombre || "Localidad de capacitación",
        },
        movimientoId: movement.id,
        createdAt: movement.fechaSolicitud,
        movimiento: {
          id: movement.id,
          idTecnico: movement.id,
          folioLocalidad: movement.folioLocalidad,
          folioLocalidadLabel: movement.folioLocalidadLabel,
          viaOrigen: { nombre: String(movement.viaOrigen || "—") },
          viaDestino: { nombre: String(movement.viaDestino || "—") },
          lavado: movement.lavado,
          torno: movement.torno,
          estado: movement.estado,
          prioridad: movement.prioridad === "ALTA" ? "ALTA" : "BAJA",
          locomotiveNumber: movement.locomotora,
          locomotora: String(movement.locomotora),
          fechaSolicitud: movement.fechaSolicitud,
          fechaInicio: movement.fechaInicio,
          fechaFin: movement.fechaFin,
          instrucciones: movement.instrucciones,
        },
      });
      return rounds;
    }, []);
  }, [activeEntity, trainingTour.active, trainingTour.movements, trainingTour.roundOrder]);
  const entityItems = useMemo(() => {
    if (!trainingQueueItems.length) return items;
    const ids = new Set(trainingQueueItems.map((item) => item.id));
    return [...trainingQueueItems, ...items.filter((item) => !ids.has(item.id))];
  }, [items, trainingQueueItems]);
  const displayedInfo = useMemo(() => {
    const next = { ...info };
    trainingQueueItems.forEach((round) => {
      const movement = round.movimiento;
      next[round.id] = {
        empresa: round.empresa || { id: 0, nombre: "Empresa de capacitación" },
        movimiento: {
          ...(movement || {}),
          lavado: Boolean(movement?.lavado),
          torno: Boolean(movement?.torno),
          estado: movement?.estado || undefined,
          prioridad: movement?.prioridad === "ALTA" ? "ALTA" : "BAJA",
          locomotiveNumber: movement?.locomotiveNumber || "SIM",
        },
        movimientoId: movement?.id,
      };
    });
    return next;
  }, [info, trainingQueueItems]);
  const entityOptions = useMemo<QueueSegmentedFilterOption<QueueEntityKind>[]>(
    () =>
      ENTITY_OPTIONS.map((option) => ({
        ...option,
        count: option.value === activeEntity ? entityItems.length : undefined,
      })),
    [activeEntity, entityItems.length],
  );
  const current = entityItems[0];
  const curInfo = current ? displayedInfo[current.id] : undefined;
  const nextItems = useMemo(() => entityItems.slice(1), [entityItems]);
  const panelGraficoHref = useMemo(() => {
    const query = new URLSearchParams();
    query.set("localidadId", String(localidadId));
    if (empresaId) query.set("empresaId", String(empresaId));
    const suffix = `?${query.toString()}`;
    if (pathname.startsWith("/supervisor")) return `/supervisor/panel-grafico${suffix}`;
    if (pathname.startsWith("/coordinador")) return `/coordinador/panel-grafico${suffix}`;
    if (pathname.startsWith("/administrador")) return `/administrador/panel-grafico${suffix}`;
    return `/cliente/panel-grafico${suffix}`;
  }, [empresaId, localidadId, pathname]);
  const emptyMessage =
    activeEntity === "torneados"
      ? "No hay torneados pendientes o en movimiento en esta localidad."
      : "No hay movimientos pendientes o en curso en esta localidad.";

  return (
    <GuidedTarget id="dashboard-rounds-board" className={S.Layout.root}>
      {trainingTour.active ? (
        <div
          className="mb-3 rounded-xl border border-violet-300 bg-violet-50 px-4 py-3 text-sm font-bold text-violet-900 dark:border-violet-800 dark:bg-violet-950/35 dark:text-violet-100"
          role="status"
        >
          CAPACITACIÓN ACTIVA · La ronda 99 y sus registros SIM existen sólo en esta sesión.
        </div>
      ) : null}
      {/* ─── HEADER ─── */}
      <GuidedTarget id="dashboard-rounds-header" as="header" className={S.Layout.header}>
        <div className={S.Header.left}>
          <h1 className={S.Header.title}>
            {sharedLocality ? "Ronda general de la localidad" : "Rondas actuales"}
          </h1>
          <span className={S.Header.liveBadge}>
            {realtimeStatus === "connected" && polling ? (
              <>
                <span className={S.Header.liveDot} /> EN VIVO
              </>
            ) : polling ? (
              "Actualización automática"
            ) : (
              "Actualización manual"
            )}
          </span>
        </div>
        <div className={S.Header.right}>
          {canCreateMovements && empresaId && (
            <Link href="/movimientos/crear" className={S.Header.btnEdit}>
              <Plus className="h-4 w-4" aria-hidden /> Crear movimiento
            </Link>
          )}
          <button
            onClick={() => setPolling(!polling)}
            className={S.Header.btn(polling)}
            title="Auto-refresh"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${polling ? "bg-emerald-500 dark:bg-emerald-400 animate-pulse" : "bg-slate-300 dark:bg-slate-600"}`}
            />
          </button>
          <button
            onClick={toggleSound}
            className={S.Header.btn(soundOn)}
            title={soundOn ? "Desactivar sonido" : "Activar sonido"}
            aria-pressed={soundOn}
          >
            {soundOn ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={() => load(true)}
            disabled={refreshing || loading}
            className={S.Header.btn()}
            title="Actualizar"
            aria-label="Actualizar rondas"
            aria-busy={refreshing}
          >
            <RefreshCw className={refreshing ? "w-4 h-4 animate-spin" : "w-4 h-4"} />
          </button>
          {activeEntity === "movimientos" && empresaId ? (
            <GuidedTarget id="dashboard-edit-rounds" className="inline-flex">
              <button onClick={() => setOpenEditor(true)} className={S.Header.btnEdit}>
                <Pencil className="w-3.5 h-3.5" />{" "}
                <span className="hidden sm:inline">Editar mis rondas</span>
              </button>
            </GuidedTarget>
          ) : null}
        </div>
      </GuidedTarget>

      {/* ─── CONTENT ─── */}
      <div className={S.Layout.main} aria-busy={loading || refreshing}>
        <p className="text-xs leading-5 text-[var(--app-text-muted)] lg:col-span-12">
          {sharedLocality
            ? "Actuales de todas las empresas de tu localidad: pendientes, en movimiento y detenidos."
            : "Rondas actuales de la localidad disponibles para tu perfil."}{" "}
          Las acciones y las mediciones siguen limitadas a tu empresa.
        </p>
        {error && (
          <div
            role="alert"
            className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200 lg:col-span-12"
          >
            {error}{" "}
            {items.length > 0
              ? "Se conserva la última consulta de esta selección; puede haber cambiado."
              : "No se pudo consultar esta selección."}
            <button
              type="button"
              onClick={() => load(true)}
              className="ml-2 font-semibold underline"
            >
              Reintentar
            </button>
          </div>
        )}
        <GuidedTarget
          id="dashboard-round-filters"
          as="section"
          className="flex flex-col gap-2 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-2 shadow-[var(--app-shadow-sm)] sm:flex-row sm:items-center sm:justify-between lg:col-span-12"
        >
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <GuidedTarget id="dashboard-entity-tabs">
              <QueueSegmentedFilter
                ariaLabel="Tipo de listado"
                options={entityOptions}
                value={activeEntity}
                onChange={setActiveEntity}
              />
            </GuidedTarget>
            {PANEL_GRAFICO_ENABLED ? (
              <Link
                href={panelGraficoHref}
                className="inline-flex min-h-9 items-center justify-center rounded-md border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-3 text-xs font-black text-[var(--app-text-muted)] transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300"
              >
                Panel Grafico
              </Link>
            ) : null}
          </div>
          <GuidedTarget id="dashboard-status-tabs">
            <span className="px-2 text-xs font-semibold text-[var(--app-text-muted)]">
              Actuales de la localidad
            </span>
          </GuidedTarget>
        </GuidedTarget>
        {/* LEFT — Hero */}
        <section className={S.Layout.colLeft}>
          <AnimatePresence mode="wait">
            {loading ? (
              <div className={S.Layout.skeleton} />
            ) : error && !current ? null : !current ? (
              <div className="flex min-h-[360px] flex-col items-center justify-center rounded-lg border border-dashed border-[var(--app-border-strong)] bg-[var(--app-surface)] p-8 text-center shadow-[var(--app-shadow-sm)]">
                <div className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
                  Sin registros
                </div>
                <div className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                  {emptyMessage}
                </div>
                <button
                  type="button"
                  onClick={() => load(true)}
                  className="mt-5 rounded-md bg-[var(--app-accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--app-accent-hover)]"
                >
                  Actualizar
                </button>
              </div>
            ) : (
              <HeroCard
                key={current.id}
                item={current}
                info={curInfo}
                onViewMeasures={openMeasuresModal}
                canAccessMeasures={Boolean(empresaId && Number(current.empresa?.id) === empresaId)}
              />
            )}
          </AnimatePresence>
        </section>

        {/* RIGHT — Queue */}
        <GuidedTarget id="dashboard-rounds-queue" as="aside" className={S.Layout.colRight}>
          <div className={S.List.header}>
            <span className={S.List.title}>
              {activeEntity === "torneados" ? "Cola de torneados" : "Cola de movimientos"}
            </span>
            <span className={S.List.count}>{loading ? "—" : nextItems.length}</span>
          </div>
          <div className="flex flex-col gap-2 pb-16 overflow-y-auto max-h-[calc(100vh-120px)] pr-1">
            <AnimatePresence initial={false}>
              {nextItems.map((item, i) => (
                <QueueCard
                  key={item.id}
                  item={item}
                  info={displayedInfo[item.id]}
                  prev={i > 0 ? nextItems[i - 1] : null}
                  idx={i}
                  onViewMeasures={openMeasuresModal}
                  canAccessMeasures={Boolean(empresaId && Number(item.empresa?.id) === empresaId)}
                />
              ))}
            </AnimatePresence>
          </div>
        </GuidedTarget>
      </div>

      {/* ─── MODAL ─── */}
      {openEditor && (
        <div className={S.Modal.overlay} onClick={() => setOpenEditor(false)}>
          <GuidedTarget id="dashboard-rounds-editor" className="h-[90vh] w-full max-w-5xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="h-full w-full overflow-hidden rounded-lg bg-[var(--app-surface)] shadow-[var(--app-shadow-md)]"
              onClick={(e) => e.stopPropagation()}
            >
              <EditRondas
                localidadId={localidadId}
                onClose={() => setOpenEditor(false)}
                onSaved={() => {
                  setOpenEditor(false);
                  load(true);
                }}
              />
            </motion.div>
          </GuidedTarget>
        </div>
      )}

      <TornoMeasuresDialog state={measuresModal} onClose={closeMeasuresModal} />

      {/* ─── TOASTS ─── */}
      <div className={S.Toast.wrap}>
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: 16 }}
              className={S.Toast.item(t.kind)}
              onClick={() => dismiss(t.id)}
            >
              {t.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </GuidedTarget>
  );
}

/* ═══════════ HERO CARD ═══════════ */
function HeroCard({
  item,
  info,
  onViewMeasures,
  canAccessMeasures,
}: {
  item: Ronda;
  info?: RondaInfo;
  onViewMeasures: (args: {
    movementId?: number | null;
    locomotiveLabel?: string;
    companyName?: string;
  }) => void;
  canAccessMeasures: boolean;
}) {
  const hi = info?.movimiento?.prioridad === "ALTA";
  const loco = fmtLoco(info?.movimiento?.locomotora || info?.movimiento?.locomotiveNumber);
  const orig = info?.movimiento?.viaOrigen?.nombre || "—";
  const dest = info?.movimiento?.viaDestino?.nombre || "—";
  const movementId = movementIdFrom(item, info);
  const canViewMeasures = Boolean(canAccessMeasures && info?.movimiento?.torno && movementId);

  return (
    <GuidedTarget id="dashboard-current-movement">
      <motion.div
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ layout: { type: "spring", stiffness: 420, damping: 36, mass: 0.7 } }}
        className={S.Card.root}
      >
        <div className={S.Card.accent(hi)} />

        <div className={S.Card.body}>
          {/* Top row: loco + route */}
          <div className={S.Card.topRow}>
            <div className={S.Card.locoWrap}>
              <div className={S.Card.locoIcon}>
                <TrainFront className="w-5 h-5 text-slate-400" />
              </div>
              <div>
                <div className={S.Card.locoNum}>{loco}</div>
                <div className={S.Card.locoCompany}>{info?.empresa?.nombre}</div>
              </div>
            </div>
            <div className={S.Card.routeTag}>
              <span className="text-emerald-600 dark:text-emerald-400">{orig}</span>
              <span className={S.Card.routeArrow}>→</span>
              <span className="text-blue-600 dark:text-blue-400">{dest}</span>
            </div>
          </div>

          {/* Stats grid: origin / destination / services */}
          <div className={S.Card.statsGrid}>
            <div className={S.Card.statBox}>
              <div className={S.Card.statLabel}>
                <ChevronUp className="w-3 h-3 text-emerald-600 dark:text-emerald-400 inline mr-1" />
                Vía origen
              </div>
              <div className={S.Card.statValue}>{orig}</div>
            </div>
            <div className={S.Card.statBox}>
              <div className={S.Card.statLabel}>
                <ChevronDown className="w-3 h-3 text-blue-600 dark:text-blue-400 inline mr-1" />
                Vía destino
              </div>
              <div className={S.Card.statValue}>{dest}</div>
            </div>
            <div className={S.Services.wrap}>
              <div className={S.Services.label}>Servicios</div>
              <div className={S.Services.pillWrap}>
                <span className={S.Services.pill(!!info?.movimiento?.lavado)}>
                  <Droplet className="w-3 h-3" /> Lavado
                </span>
                <span className={S.Services.pill(!!info?.movimiento?.torno)}>
                  <Settings className="w-3 h-3" /> Torno
                </span>
              </div>
            </div>
          </div>

          {/* Status chips */}
          <div className={S.Card.statusRow}>
            <div className={S.Card.statusChip(hi ? "red" : "")}>
              <div className={S.Card.chipLabel}>Estado</div>
              <div className={S.Card.chipValue}>{info?.movimiento?.estado || "SOLICITADO"}</div>
            </div>
            <div className={S.Card.statusChip(hi ? "red" : "emerald")}>
              <div className={S.Card.chipLabel}>Prioridad</div>
              <div className={S.Card.chipValue}>{info?.movimiento?.prioridad || "BAJA"}</div>
            </div>
            <div className={S.Card.statusChip("")}>
              <div className={S.Card.chipLabel}>Orden</div>
              <div className={S.Card.chipValue}>{item.orden}</div>
            </div>
            <div className={S.Card.statusChip("")}>
              <div className={S.Card.chipLabel}>Ronda</div>
              <div className={S.Card.chipValue}>{item.rondaNumero}</div>
            </div>
          </div>

          {/* Footer */}
          <div className={S.Card.footer}>
            <div className={S.Card.footerRoute}>
              Mover <strong className="text-slate-900 dark:text-white">{loco}</strong> ·{" "}
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{orig}</span> →{" "}
              <span className="text-blue-600 dark:text-blue-400 font-semibold">{dest}</span>
            </div>

            {info?.movimiento?.instrucciones && (
              <div className={S.Card.instrBox}>
                <div className={S.Card.instrLabel}>Instrucciones</div>
                <div className={S.Card.instrText}>{info.movimiento.instrucciones}</div>
              </div>
            )}

            <div className={S.Card.dateRow}>
              <span className="flex items-center gap-1">
                <CalendarDays className="w-3 h-3" /> Creado
              </span>
              <span className="font-semibold tabular-nums">{fmtDate(item.createdAt)}</span>
            </div>
            {canViewMeasures && (
              <GuidedTarget id="dashboard-current-measures" className="inline-flex">
                <button
                  type="button"
                  onClick={() =>
                    onViewMeasures({
                      movementId,
                      locomotiveLabel: loco,
                      companyName: info?.empresa?.nombre,
                    })
                  }
                  className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200 dark:hover:bg-emerald-900/40"
                >
                  Ver mediciones
                </button>
              </GuidedTarget>
            )}
          </div>
        </div>
      </motion.div>
    </GuidedTarget>
  );
}

/* ═══════════ QUEUE CARD ═══════════ */
function QueueCard({
  item,
  info,
  prev,
  idx,
  onViewMeasures,
  canAccessMeasures,
  showRoundDivider = true,
}: {
  item: Ronda;
  info?: RondaInfo;
  prev: Ronda | null;
  idx: number;
  onViewMeasures: (args: {
    movementId?: number | null;
    locomotiveLabel?: string;
    companyName?: string;
  }) => void;
  canAccessMeasures: boolean;
  showRoundDivider?: boolean;
}) {
  const hi = info?.movimiento?.prioridad === "ALTA";
  const newRound = idx === 0 || item.rondaNumero !== prev?.rondaNumero;
  const loco = fmtLoco(info?.movimiento?.locomotora || info?.movimiento?.locomotiveNumber);
  const movementId = movementIdFrom(item, info);
  const canViewMeasures = Boolean(canAccessMeasures && info?.movimiento?.torno && movementId);

  return (
    <Fragment>
      {showRoundDivider && newRound && (
        <div className={S.List.divider}>
          <div className={S.List.dividerLabel}>Ronda {item.rondaNumero}</div>
          <div className={S.List.dividerLine} />
        </div>
      )}

      <motion.div
        layout
        initial={{ opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0 }}
        transition={{ layout: { type: "spring", stiffness: 420, damping: 36, mass: 0.7 } }}
        data-guide-id={idx === 0 ? "training-round-row" : undefined}
        className={S.List.card(hi)}
      >
        {hi && <div className={S.List.highBar} />}

        <div className={S.List.topRow}>
          <div className="flex items-center gap-2">
            <div className={S.List.itemIcon}>
              <TrainFront className="w-3.5 h-3.5 text-slate-500" />
            </div>
            <div>
              <div className={S.List.itemLoco}>{loco}</div>
              <div className={S.List.itemSub}>{info?.empresa?.nombre}</div>
            </div>
          </div>
          <div className="text-right">
            <div className={S.List.itemSub}>Código</div>
            <div className="text-sm font-semibold text-slate-900 dark:text-white tabular-nums">
              {codeFrom(info, item.id)}
            </div>
          </div>
        </div>

        <div className={S.List.miniGrid}>
          <div className={S.List.miniCell}>
            <div className={S.List.miniLabel}>Origen</div>
            <div className={S.List.miniValue(false, "text-emerald-600 dark:text-emerald-400")}>
              {info?.movimiento?.viaOrigen?.nombre || "—"}
            </div>
          </div>
          <div className={S.List.miniCell}>
            <div className={S.List.miniLabel}>Destino</div>
            <div className={S.List.miniValue(false, "text-blue-600 dark:text-blue-400")}>
              {info?.movimiento?.viaDestino?.nombre || "—"}
            </div>
          </div>
        </div>

        <div className={S.List.miniGrid}>
          <div className={S.List.miniCell}>
            <div className={S.List.miniLabel}>Estado</div>
            <div className={S.List.miniValue(true)}>{info?.movimiento?.estado || "SOLICITADO"}</div>
          </div>
          <div className={S.List.miniCell}>
            <div className={S.List.miniLabel}>Prioridad</div>
            <div
              className={S.List.miniValue(
                true,
                hi ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400",
              )}
            >
              {info?.movimiento?.prioridad || "BAJA"}
            </div>
          </div>
        </div>

        {info?.movimiento?.instrucciones && (
          <div className={S.List.instrPreview}>{info.movimiento.instrucciones}</div>
        )}

        <div className={S.List.bottom}>
          <div className="flex gap-1">
            {info?.movimiento?.lavado && <span className={S.List.badge}>LAV</span>}
            {info?.movimiento?.torno && <span className={S.List.badge}>TOR</span>}
          </div>
          <span className={S.List.date}>{fmtDate(item.createdAt)}</span>
        </div>
        {canViewMeasures && (
          <button
            type="button"
            onClick={() =>
              onViewMeasures({
                movementId,
                locomotiveLabel: loco,
                companyName: info?.empresa?.nombre,
              })
            }
            className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Ver mediciones
          </button>
        )}
      </motion.div>
    </Fragment>
  );
}
