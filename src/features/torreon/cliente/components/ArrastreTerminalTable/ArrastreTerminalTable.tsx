import { Fragment, useEffect, useMemo, useState } from "react";
import type { Arrastre, DailyInfo, IncidenteArrastre, VagonArrastre } from "@/features/torreon/arrastres";
import { EmptyState } from "../EmptyState";
import { statusText } from "../../utils";
import { Direction } from "./helpers";
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
  canPrioritizeByIncident?: boolean;
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
  canPrioritizeByIncident = false,
  onEditVagon,
  onPrioritizeSolicitud,
  onReorderVagon,
  onReorderSolicitud,
  onCancel,
  onIncidentSelect,
}: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(() => new Set());
  const [page, setPage] = useState(1);

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
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] table-fixed text-left text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-[0.2em] text-slate-500 dark:bg-slate-900 dark:text-slate-400">
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
                        onToggle={() => toggle(arrastre.id)}
                        onPrioritizeSolicitud={onPrioritizeSolicitud}
                        onReorderSolicitud={onReorderSolicitud}
                        onCancel={onCancel}
                        onIncidentSelect={onIncidentSelect}
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
