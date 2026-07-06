import type { ChangeEvent, ReactNode } from "react";
import { AlertTriangle, TrainFront } from "lucide-react";
import type { Arrastre, VagonArrastre } from "@/features/torreon/arrastres";
import { ArrastreCard, EmptyState, ModuleHeader, MovimientoToolbar } from "../components";
import { emptyIncidentDraft, type ActionPayload, type Ambito, type IncidentDraft } from "../types";
import { isClosed } from "../utils";

type Props = {
  feedback: ReactNode;
  ambito: Ambito;
  search: string;
  dateFilter: string;
  refreshing: boolean;
  loading: boolean;
  visibleArrastres: Arrastre[];
  activeCount: number;
  pastCount: number;
  busyAction: string | null;
  dailyCounters: Map<number, { index: number; total: number; date: string }>;
  incidentDrafts: Record<number, IncidentDraft>;
  onAmbito: (ambito: Ambito) => void;
  onSearch: (value: string) => void;
  onDateFilter: (value: string) => void;
  onRefresh: () => void;
  onNuevo: () => void;
  onDraftChange: (arrastreId: number, draft: IncidentDraft) => void;
  onFiles: (arrastreId: number, event: ChangeEvent<HTMLInputElement>) => void;
  onAction: (payload: ActionPayload) => void;
  onEditVagon: (arrastre: Arrastre, vagon: VagonArrastre) => void;
  onCancel: (arrastre: Arrastre) => void;
};

export function MovimientosView({
  feedback,
  ambito,
  search,
  dateFilter,
  refreshing,
  loading,
  visibleArrastres,
  activeCount,
  pastCount,
  busyAction,
  dailyCounters,
  incidentDrafts,
  onAmbito,
  onSearch,
  onDateFilter,
  onRefresh,
  onNuevo,
  onDraftChange,
  onFiles,
  onAction,
  onEditVagon,
  onCancel,
}: Props) {
  return (
    <section className="w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 text-slate-900 shadow-xl shadow-slate-200/50">
      <div className="flex min-h-[calc(100svh-7rem)] flex-col gap-5 px-3 py-4 sm:px-5 sm:py-6 lg:px-7">
        <ModuleHeader title="Movimientos" chip={ambito === "actuales" ? "Actuales" : "Pasados"} total={visibleArrastres.length} icon={TrainFront} />
        <div className="h-px bg-gradient-to-r from-transparent via-emerald-300/40 to-transparent" />
        {feedback}
        <MovimientoToolbar
          ambito={ambito}
          search={search}
          dateFilter={dateFilter}
          refreshing={refreshing}
          actuales={activeCount}
          pasados={pastCount}
          onAmbito={onAmbito}
          onSearch={onSearch}
          onDateFilter={onDateFilter}
          onRefresh={onRefresh}
          onNuevo={onNuevo}
        />
        <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-slate-100 bg-white px-2 py-3 shadow-sm sm:px-4">
          {loading ? (
            <div className="h-72 animate-pulse rounded-2xl bg-slate-100" />
          ) : visibleArrastres.length ? (
            <div className="grid gap-3">
              {visibleArrastres.map((arrastre) => (
                <ArrastreCard
                  key={arrastre.id}
                  arrastre={arrastre}
                  dailyInfo={dailyCounters.get(arrastre.id)}
                  readOnly={isClosed(arrastre.estado)}
                  busyAction={busyAction}
                  draft={incidentDrafts[arrastre.id] || emptyIncidentDraft}
                  onDraftChange={(draft) => onDraftChange(arrastre.id, draft)}
                  onFiles={(event) => onFiles(arrastre.id, event)}
                  onAction={onAction}
                  onEditVagon={onEditVagon}
                  onCancel={onCancel}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              text={ambito === "actuales" ? "No hay movimientos activos" : "No hay movimientos pasados"}
              hint={search ? "Ajusta la busqueda o cambia de pestana" : "Cuando se soliciten arrastres apareceran aqui"}
            />
          )}
        </section>
      </div>
    </section>
  );
}

export function MovimientosEmptyIcon() {
  return <AlertTriangle className="h-4 w-4" />;
}
