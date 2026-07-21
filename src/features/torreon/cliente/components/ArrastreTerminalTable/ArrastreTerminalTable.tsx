import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, Ban, ChevronDown, ChevronRight, ChevronsUp, Pencil } from "lucide-react";
import { buildArrastreFolio, getPrimaryIncident, type Arrastre, type DailyInfo, type IncidenteArrastre, type VagonArrastre } from "@/features/torreon/arrastres";
import { operationStatusHint } from "@/features/torreon/operationCopy";
import { EmptyState } from "../EmptyState";
import { EstadoBadge } from "../EstadoBadge";
import { canCancelArrastreRequest, canEditArrastreRequest, statusText } from "../../utils";
import { Direction, getCurrentVagon, getStats, vagonLabel } from "./helpers";
import { RondaDetail } from "./RondaDetail";
import { RondaRow } from "./RondaRow";
import { TerminalPager } from "./TerminalControls";

type Props = {
  rows: Arrastre[];
  dailyCounters: Map<number, DailyInfo>;
  busyAction?: string | null;
  title: string;
  subtitle: string;
  pageSize?: number;
  emptyText?: string;
  editableSolicitudIds?: number[];
  manageableRowIds?: number[];
  canPrioritizeByIncident?: boolean;
  onEditArrastre?: (arrastre: Arrastre) => void;
  onEditVagon?: (arrastre: Arrastre, vagon: VagonArrastre) => void;
  onPrioritizeSolicitud?: (arrastre: Arrastre) => void;
  onReorderVagon?: (arrastre: Arrastre, vagon: VagonArrastre, direction: Direction) => void;
  onReorderSolicitud?: (arrastre: Arrastre, direction: Direction) => void;
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
}: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(() => new Set());
  const [page, setPage] = useState(1);
  const manageableIds = useMemo(
    () => manageableRowIds ? new Set(manageableRowIds) : null,
    [manageableRowIds],
  );

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = rows.length ? (safePage - 1) * pageSize : 0;
  const pageRows = useMemo(() => rows.slice(start, start + pageSize), [rows, start, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [rows.length, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  function toggle(id: number) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function canPrioritizeSolicitud(arrastre: Arrastre, solicitudIndex: number) {
    return canPrioritizeByIncident
      && solicitudIndex > 0
      && (arrastre.vagones || []).some((vagon) => statusText(vagon.estado) === "PENDIENTE");
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="flex flex-col gap-1 border-b border-slate-200 px-4 py-3 dark:border-slate-800 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-xs font-black uppercase tracking-[0.28em] text-emerald-700 dark:text-emerald-300">{subtitle}</p>
          <h2 className="text-lg font-black text-slate-950 dark:text-white">{title}</h2>
        </div>
        <div className="inline-flex items-center rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1 font-mono text-xs font-black uppercase tracking-[0.14em] text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
          {rows.length} ronda{rows.length === 1 ? "" : "s"}
        </div>
      </div>

      {rows.length ? (
        <>
          <div className="grid gap-3 p-3 lg:hidden">
            {pageRows.map((arrastre) => {
              const expanded = expandedIds.has(arrastre.id);
              const dailyInfo = dailyCounters.get(arrastre.id);
              const solicitudIndex = editableSolicitudIds.indexOf(arrastre.id);
              const primaryIncident = getPrimaryIncident(arrastre);
              const current = getCurrentVagon(arrastre);
              const stats = getStats(arrastre);
              const canCancel = canCancelArrastreRequest(arrastre);
              const canManage = !manageableIds || manageableIds.has(arrastre.id);

              return (
                <article key={arrastre.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-wide text-slate-400">Turno {arrastre.ordenSolicitud || solicitudIndex + 1}</p>
                        <h3 className="mt-1 font-mono text-lg font-black text-slate-950 dark:text-white">{buildArrastreFolio(arrastre, dailyInfo)}</h3>
                        <p className={`mt-1 text-xs font-black ${canManage ? "text-emerald-700 dark:text-emerald-300" : "text-slate-400"}`}>
                          {canManage ? "Tu empresa" : "Otra empresa · solo consulta"}
                        </p>
                      </div>
                      <EstadoBadge estado={arrastre.estado} />
                    </div>

                    <p className="mt-2 text-xs font-bold text-slate-500 dark:text-slate-400">{operationStatusHint(arrastre.estado)}</p>

                    <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-950/30">
                      <p className="text-[10px] font-black uppercase tracking-wide text-emerald-700 dark:text-emerald-300">{statusText(current?.estado) === "EN_PROCESO" ? "En movimiento ahora" : "Siguiente vagón"}</p>
                      <p className="mt-1 font-black text-slate-950 dark:text-white">{vagonLabel(current)}</p>
                      {current ? <p className="mt-1 text-xs font-semibold text-slate-600 dark:text-slate-300">{mobileRoute(current)}</p> : <p className="mt-1 text-xs text-slate-500">Sin vagones pendientes</p>}
                    </div>

                    <div className="mt-4 flex items-center gap-3">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${stats.pct}%` }} />
                      </div>
                      <span className="text-sm font-black tabular-nums text-slate-700 dark:text-slate-200">{stats.pct}%</span>
                    </div>

                    <button type="button" onClick={() => toggle(arrastre.id)} className="mt-4 inline-flex min-h-11 w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-black text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200" aria-expanded={expanded}>
                      {expanded ? "Ocultar detalle" : `Ver ${stats.total} vagón${stats.total === 1 ? "" : "es"}`}
                      {expanded ? <ChevronDown className="h-4 w-4" aria-hidden /> : <ChevronRight className="h-4 w-4" aria-hidden />}
                    </button>

                    {canManage && (onEditArrastre || onPrioritizeSolicitud || onReorderSolicitud || onCancel || (primaryIncident && onIncidentSelect)) ? (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {onEditArrastre ? <MobileAction label="Editar movimiento" disabled={!canEditArrastreRequest(arrastre) || busyAction != null} onClick={() => onEditArrastre(arrastre)}><Pencil className="h-4 w-4" /></MobileAction> : null}
                        {onPrioritizeSolicitud ? <MobileAction label="Priorizar" disabled={!canPrioritizeSolicitud(arrastre, solicitudIndex) || busyAction != null} onClick={() => onPrioritizeSolicitud(arrastre)}><ChevronsUp className="h-4 w-4" /></MobileAction> : null}
                        {onReorderSolicitud ? (
                          <div className="grid grid-cols-2 gap-2">
                            <MobileAction label="Subir" compact disabled={solicitudIndex <= 0 || busyAction != null} onClick={() => onReorderSolicitud(arrastre, "up")}><ArrowUp className="h-4 w-4" /></MobileAction>
                            <MobileAction label="Bajar" compact disabled={solicitudIndex < 0 || solicitudIndex >= editableSolicitudIds.length - 1 || busyAction != null} onClick={() => onReorderSolicitud(arrastre, "down")}><ArrowDown className="h-4 w-4" /></MobileAction>
                          </div>
                        ) : null}
                        {primaryIncident && onIncidentSelect ? <MobileAction label="Ver incidente" warning disabled={busyAction != null} onClick={() => onIncidentSelect(primaryIncident, arrastre)}><AlertTriangle className="h-4 w-4" /></MobileAction> : null}
                        {onCancel ? <MobileAction label="Cancelar" danger disabled={!canCancel || busyAction != null} onClick={() => onCancel(arrastre)}><Ban className="h-4 w-4" /></MobileAction> : null}
                      </div>
                    ) : null}
                  </div>

                  {expanded ? <div className="border-t border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950"><RondaDetail arrastre={arrastre} dailyInfo={dailyInfo} busyAction={busyAction} onEditVagon={onEditVagon} onReorderVagon={onReorderVagon} /></div> : null}
                </article>
              );
            })}
          </div>

          <div className="hidden max-h-[min(72dvh,760px)] touch-pan-y overflow-auto overscroll-contain [scrollbar-gutter:stable] lg:block">
            <table className="w-full min-w-[1180px] table-fixed text-left text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] uppercase tracking-[0.2em] text-slate-500 shadow-[0_1px_0_0_rgb(226_232_240)] dark:bg-slate-900 dark:text-slate-400 dark:shadow-[0_1px_0_0_rgb(30_41_59)]">
                <tr>
                  <th className="w-14 px-3 py-3" />
                  <th className="w-48 px-3 py-3">Ronda</th>
                  <th className="w-36 px-3 py-3">Estado</th>
                  <th className="w-40 px-3 py-3">Solicitud</th>
                  <th className="w-72 px-3 py-3">Ahora</th>
                  <th className="w-56 px-3 py-3">Avance</th>
                  <th className="w-72 px-3 py-3">Siguientes</th>
                  <th className="w-32 px-3 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {pageRows.map((arrastre) => {
                  const expanded = expandedIds.has(arrastre.id);
                  const dailyInfo = dailyCounters.get(arrastre.id);
                  const solicitudIndex = editableSolicitudIds.indexOf(arrastre.id);
                  const canManage = !manageableIds || manageableIds.has(arrastre.id);

                  return (
                    <Fragment key={arrastre.id}>
                      <RondaRow
                        arrastre={arrastre}
                        dailyInfo={dailyInfo}
                        expanded={expanded}
                        busyAction={busyAction}
                        canMoveSolicitudUp={solicitudIndex > 0}
                        canMoveSolicitudDown={solicitudIndex >= 0 && solicitudIndex < editableSolicitudIds.length - 1}
                        canPrioritizeSolicitud={canPrioritizeSolicitud(arrastre, solicitudIndex)}
                        isManaged={canManage}
                        onToggle={() => toggle(arrastre.id)}
                        onPrioritizeSolicitud={canManage ? onPrioritizeSolicitud : undefined}
                        onReorderSolicitud={canManage ? onReorderSolicitud : undefined}
                        onEditArrastre={canManage ? onEditArrastre : undefined}
                        onCancel={canManage ? onCancel : undefined}
                        onIncidentSelect={canManage ? onIncidentSelect : undefined}
                      />
                      {expanded && (
                        <tr className="bg-slate-50/70 dark:bg-slate-900/50">
                          <td colSpan={8} className="px-3 py-3">
                            <RondaDetail
                              arrastre={arrastre}
                              dailyInfo={dailyInfo}
                              busyAction={busyAction}
                              onEditVagon={onEditVagon}
                              onReorderVagon={onReorderVagon}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <TerminalPager
            page={safePage}
            totalPages={totalPages}
            total={rows.length}
            from={start + 1}
            to={Math.min(start + pageSize, rows.length)}
            onPage={setPage}
          />
        </>
      ) : (
        <div className="p-4">
          <EmptyState text={emptyText} />
        </div>
      )}
    </section>
  );
}

function mobileRoute(vagon: VagonArrastre) {
  const origin = `${vagon.viaOrigenNombre || vagon.viaOrigenId || "—"} · ${vagon.seccionOrigenNombre || vagon.seccionOrigenId || "—"}`;
  const destination = `${vagon.viaDestinoNombre || vagon.viaId || "—"} · ${vagon.seccionDestinoNombre || vagon.seccionId || "—"}`;
  return `${origin} → ${destination}`;
}

function MobileAction({ children, label, disabled, compact = false, danger = false, warning = false, onClick }: { children: ReactNode; label: string; disabled: boolean; compact?: boolean; danger?: boolean; warning?: boolean; onClick: () => void }) {
  const tone = danger
    ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"
    : warning
      ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
      : "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200";
  return <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-black disabled:cursor-not-allowed disabled:opacity-35 ${tone}`}>{children}{compact ? null : label}</button>;
}
