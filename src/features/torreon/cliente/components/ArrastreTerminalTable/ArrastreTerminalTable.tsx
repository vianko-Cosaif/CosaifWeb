import { useMemo, useState, useId, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Ban,
  ChevronDown,
  ChevronRight,
  ChevronsUp,
  Pencil,
  MoreHorizontal,
  TrainFront,
  History,
  Play,
  Check,
} from "lucide-react";
import type {
  Arrastre,
  DailyInfo,
  IncidenteArrastre,
  VagonArrastre,
} from "../../../arrastres/types";
import { buildArrastreFolio, getPrimaryIncident } from "../../../arrastres/utils";
import StatusBadge from "@/components/ui/StatusBadge";
import { canCancelArrastreRequest, canEditArrastreRequest, statusText } from "../../utils";
import { type Direction, getCurrentVagon, getStats } from "./helpers";
import { RondaDetail } from "./RondaDetail";
import { TerminalPager } from "./TerminalControls";
import { RailRoute } from "../../../presentation/RailPrimitives";
import s from "../../../presentation/rail.module.scss";

type Props = {
  rows: Arrastre[];
  dailyCounters: Map<number, DailyInfo>;
  busyAction?: string | null;
  title: string;
  subtitle: string;
  pageSize?: number;
  hidePagination?: boolean;
  emptyText?: string;
  editableSolicitudIds?: number[];
  manageableRowIds?: number[];
  canPrioritizeByIncident?: boolean;
  onEditArrastre?: (arrastre: Arrastre) => void;
  onEditVagon?: (arrastre: Arrastre, vagon: VagonArrastre) => void;
  onPrioritizeSolicitud?: (arrastre: Arrastre) => void;
  onReorderVagon?: (arrastre: Arrastre, vagon: VagonArrastre, direction: Direction) => void;
  onReorderSolicitud?: (arrastre: Arrastre, direction: Direction) => void;
  onStartVagon?: (arrastre: Arrastre, vagon: VagonArrastre) => void;
  onFinishVagon?: (arrastre: Arrastre, vagon: VagonArrastre) => void;
  onAuditSelect?: (arrastre: Arrastre) => void;
  onCancel?: (arrastre: Arrastre) => void;
  onIncidentSelect?: (incident: IncidenteArrastre, arrastre: Arrastre) => void;
};

export function ArrastreTerminalTable({
  rows,
  dailyCounters,
  busyAction = null,
  title,
  subtitle,
  pageSize = 8,
  hidePagination = false,
  emptyText = "No hay rondas para mostrar.",
  editableSolicitudIds = [],
  manageableRowIds,
  canPrioritizeByIncident = false,
  onEditArrastre,
  onEditVagon,
  onPrioritizeSolicitud,
  onReorderVagon,
  onReorderSolicitud,
  onCancel,
  onIncidentSelect,
  onStartVagon,
  onFinishVagon,
  onAuditSelect,
}: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(() => new Set());
  const [page, setPage] = useState(1);
  const detailId = useId();
  const manageableIds = useMemo(
    () => (manageableRowIds ? new Set(manageableRowIds) : null),
    [manageableRowIds],
  );
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = hidePagination ? 1 : Math.min(page, totalPages);
  const start = rows.length ? (safePage - 1) * pageSize : 0;
  const pageRows = hidePagination ? rows : rows.slice(start, start + pageSize);
  function toggle(id: number) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  return (
    <section className={s.queue}>
      <header className={s.queueHeader}>
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <span className={s.count}>{rows.length} rondas</span>
      </header>
      {pageRows.map((arrastre) => {
        const expanded = expandedIds.has(arrastre.id);
        const canManage = !manageableIds || manageableIds.has(arrastre.id);
        const index = editableSolicitudIds.indexOf(arrastre.id);
        const incident = getPrimaryIncident(arrastre);
        const current = getCurrentVagon(arrastre);
        const stats = getStats(arrastre);
        const editable = canManage && canEditArrastreRequest(arrastre);
        const cancellable = canManage && canCancelArrastreRequest(arrastre);
        const prioritizable =
          canManage &&
          canPrioritizeByIncident &&
          (hidePagination ? index >= 0 : index > 0) &&
          (arrastre.vagones || []).some((v) => statusText(v.estado) === "PENDIENTE");
        const hasMenu =
          (editable && onEditArrastre) ||
          (cancellable && onCancel) ||
          (prioritizable && onPrioritizeSolicitud) ||
          (canManage && index >= 0 && onReorderSolicitud) ||
          onAuditSelect;
        const isMoving = statusText(current?.estado) === "EN_PROCESO";
        const operation =
          canManage && current ? (isMoving ? onFinishVagon : onStartVagon) : undefined;
        return (
          <article
            key={arrastre.id}
            className={s.queueRow}
            aria-label={`Arrastre ${buildArrastreFolio(arrastre, dailyCounters.get(arrastre.id))}`}
          >
            <div className={s.rowMain}>
              <div className={s.rowIdentity}>
                <TrainFront size={20} aria-hidden />
                <div>
                  <strong>{buildArrastreFolio(arrastre, dailyCounters.get(arrastre.id))}</strong>
                  <small>
                    Turno {arrastre.ordenSolicitud ?? "—"}
                    {manageableIds ? ` · ${canManage ? "Tu empresa" : "Otra empresa"}` : ""}
                  </small>
                </div>
              </div>
              <div className={s.rowRoute}>
                <p>
                  {current
                    ? `Vagón ${current.numeroVagon || current.orden}`
                    : "Recorrido de la solicitud"}
                </p>
                <RailRoute vagon={current ?? arrastre.vagones?.[0]} />
              </div>
              <div className={s.rowProgress}>
                <div className={s.progressCaption}>
                  <span>
                    {stats.concluidos}/{stats.total} vagones
                  </span>
                  <strong>{stats.pct}%</strong>
                </div>
                <div className={s.progress}>
                  <span style={{ width: `${stats.pct}%` }} />
                </div>
              </div>
              <div className={s.rowEnd}>
                <StatusBadge status={arrastre.estado} size="sm" />
                {incident && canManage && onIncidentSelect ? (
                  <button
                    type="button"
                    className={s.expand}
                    aria-label="Ver incidente"
                    title="Ver incidente"
                    onClick={() => onIncidentSelect(incident, arrastre)}
                  >
                    <AlertTriangle size={16} aria-hidden />
                  </button>
                ) : null}
                {operation && current ? (
                  <button
                    type="button"
                    className={s.primaryButton}
                    disabled={busyAction !== null}
                    onClick={() => operation(arrastre, current)}
                  >
                    {isMoving ? <Check size={15} aria-hidden /> : <Play size={15} aria-hidden />}
                    {isMoving ? "Finalizar" : "Iniciar"}
                  </button>
                ) : null}
                <button
                  type="button"
                  className={s.expand}
                  aria-expanded={expanded}
                  aria-controls={`${detailId}-${arrastre.id}`}
                  onClick={() => toggle(arrastre.id)}
                >
                  {expanded ? "Ocultar vagones" : "Ver vagones"}
                  {expanded ? (
                    <ChevronDown size={15} aria-hidden />
                  ) : (
                    <ChevronRight size={15} aria-hidden />
                  )}
                </button>
                {hasMenu ? (
                  <details
                    className={s.menu}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        event.currentTarget.open = false;
                        event.currentTarget.querySelector("summary")?.focus();
                      }
                    }}
                  >
                    <summary
                      aria-label={`Acciones del arrastre ${buildArrastreFolio(arrastre)}`}
                      title="Más acciones"
                    >
                      <MoreHorizontal size={18} aria-hidden />
                    </summary>
                    <div className={s.menuContent}>
                      {editable && onEditArrastre ? (
                        <Action
                          disabled={busyAction !== null}
                          onClick={() => onEditArrastre(arrastre)}
                        >
                          <Pencil size={15} aria-hidden />
                          Editar movimiento
                        </Action>
                      ) : null}
                      {prioritizable && onPrioritizeSolicitud ? (
                        <Action
                          disabled={busyAction !== null}
                          onClick={() => onPrioritizeSolicitud(arrastre)}
                        >
                          <ChevronsUp size={15} aria-hidden />
                          Priorizar por incidente
                        </Action>
                      ) : null}
                      {canManage && index >= 0 && onReorderSolicitud ? (
                        <>
                          <Action
                            disabled={busyAction !== null || (!hidePagination && index === 0)}
                            onClick={() => onReorderSolicitud(arrastre, "up")}
                          >
                            <ArrowUp size={15} aria-hidden />
                            Subir turno
                          </Action>
                          <Action
                            disabled={
                              busyAction !== null ||
                              (!hidePagination && index === editableSolicitudIds.length - 1)
                            }
                            onClick={() => onReorderSolicitud(arrastre, "down")}
                          >
                            <ArrowDown size={15} aria-hidden />
                            Bajar turno
                          </Action>
                        </>
                      ) : null}
                      {onAuditSelect ? (
                        <Action onClick={() => onAuditSelect(arrastre)}>
                          <History size={15} aria-hidden />
                          Ver bitácora de ediciones
                        </Action>
                      ) : null}
                      {cancellable && onCancel ? (
                        <Action disabled={busyAction !== null} onClick={() => onCancel(arrastre)}>
                          <Ban size={15} aria-hidden />
                          Cancelar solicitud
                        </Action>
                      ) : null}
                    </div>
                  </details>
                ) : null}
              </div>
            </div>
            {expanded ? (
              <div className={s.rowDetail} id={`${detailId}-${arrastre.id}`}>
                <RondaDetail
                  arrastre={arrastre}
                  dailyInfo={dailyCounters.get(arrastre.id)}
                  busyAction={busyAction}
                  onEditVagon={canManage ? onEditVagon : undefined}
                  onReorderVagon={canManage ? onReorderVagon : undefined}
                />
              </div>
            ) : null}
          </article>
        );
      })}
      {!rows.length ? (
        <p className={s.empty}>{emptyText}</p>
      ) : !hidePagination ? (
        <TerminalPager
          page={safePage}
          totalPages={totalPages}
          total={rows.length}
          from={start + 1}
          to={Math.min(start + pageSize, rows.length)}
          onPage={setPage}
        />
      ) : null}
    </section>
  );
}
function Action({
  children,
  disabled,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(event) => {
        const menu = event.currentTarget.closest("details");
        if (menu) menu.open = false;
        onClick();
      }}
    >
      {children}
    </button>
  );
}
