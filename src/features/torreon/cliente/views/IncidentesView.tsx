import type { ReactNode } from "react";
import { AlertTriangle, CalendarDays, RefreshCw, Search } from "lucide-react";
import { fmtDate, type Arrastre, type IncidenteArrastre, type VagonArrastre } from "@/features/torreon/arrastres";
import { EmptyState, EstadoBadge, ModuleHeader } from "../components";
import { displayStatus, fmtFullDate } from "../utils";

export type ClienteIncidentRow = {
  arrastre: Arrastre;
  incidente: IncidenteArrastre;
  vagon?: VagonArrastre;
  dailyInfo?: { index: number; total: number; date: string };
};

type Props = {
  feedback: ReactNode;
  rows: ClienteIncidentRow[];
  loading: boolean;
  refreshing: boolean;
  search: string;
  dateFilter: string;
  onSearch: (value: string) => void;
  onDateFilter: (value: string) => void;
  onRefresh: () => void;
};

export function IncidentesView({ feedback, rows, loading, refreshing, search, dateFilter, onSearch, onDateFilter, onRefresh }: Props) {
  return (
    <section className="w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 text-slate-900 shadow-xl shadow-slate-200/50">
      <div className="flex min-h-[calc(100svh-7rem)] flex-col gap-5 px-3 py-4 sm:px-5 sm:py-6 lg:px-7">
        <ModuleHeader title="Incidentes de arrastre" chip="Ligados al movimiento" total={rows.length} icon={AlertTriangle} />
        <div className="h-px bg-gradient-to-r from-transparent via-amber-300/40 to-transparent" />
        {feedback}
        <IncidentesToolbar search={search} dateFilter={dateFilter} refreshing={refreshing} onSearch={onSearch} onDateFilter={onDateFilter} onRefresh={onRefresh} />
        <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-slate-100 bg-white px-2 py-3 shadow-sm sm:px-4">
          {loading ? (
            <div className="h-72 animate-pulse rounded-2xl bg-slate-100" />
          ) : rows.length ? (
            <div className="grid gap-3">
              {rows.map((row) => <IncidentCard key={`${row.arrastre.id}-${row.incidente.id}`} row={row} />)}
            </div>
          ) : (
            <EmptyState text="No hay incidentes de arrastre" hint={search || dateFilter ? "Ajusta filtros para ver otros incidentes" : "Cuando un arrastre se detenga por incidente aparecera aqui"} />
          )}
        </section>
      </div>
    </section>
  );
}

function IncidentesToolbar({ search, dateFilter, refreshing, onSearch, onDateFilter, onRefresh }: Omit<Props, "feedback" | "rows" | "loading">) {
  return (
    <section className="space-y-3 rounded-xl border border-slate-100 bg-gradient-to-b from-slate-50/80 to-white px-2 py-2 shadow-sm sm:rounded-2xl sm:px-4 sm:py-4">
      <div className="grid gap-2 lg:grid-cols-[1fr_210px_auto]">
        <div className="relative">
          <input type="search" value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Buscar por arrastre, incidente, vagon, motivo..." className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white/90 py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/30" />
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        </div>
        <label className="relative">
          <CalendarDays className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input type="date" value={dateFilter} onChange={(event) => onDateFilter(event.target.value)} className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white/90 py-2.5 pl-10 pr-3 text-sm font-semibold text-slate-700 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/30" />
        </label>
        <button type="button" title="Actualizar" onClick={onRefresh} disabled={refreshing} className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white/90 px-4 py-2 text-xs font-medium text-slate-600 transition hover:border-emerald-400 hover:text-emerald-600 disabled:cursor-not-allowed disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          <span>{refreshing ? "Actualizando..." : "Actualizar"}</span>
        </button>
      </div>
    </section>
  );
}

function IncidentCard({ row }: { row: ClienteIncidentRow }) {
  const { arrastre, incidente, vagon, dailyInfo } = row;
  const dailyLabel = dailyInfo ? `Arrastre ${dailyInfo.index} de ${dailyInfo.total}` : "Arrastre";
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{fmtFullDate(incidente.fechaInicio || arrastre.fechaSolicitud)}</p>
          <h2 className="mt-1 text-xl font-black text-slate-950">
            {dailyLabel}
            <span className="ml-2 text-sm font-semibold text-slate-400">ID #{arrastre.id}</span>
          </h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">Incidente #{incidente.id}</p>
        </div>
        <EstadoBadge estado={incidente.estado} />
      </div>

      <div className="mt-4 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
        <InfoBox label="Vagon" value={vagon?.numeroVagon || (vagon ? `Vagon ${vagon.orden}` : "Zona general")} />
        <InfoBox label="Zona" value={vagon ? `Via ${vagon.viaId} / Seccion ${vagon.seccionId}` : "General"} />
        <InfoBox label="Arrastre" value={displayStatus(arrastre.estado)} />
        <InfoBox label="Resolucion" value={fmtDate(incidente.fechaResolucion)} />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <TextBox label="Motivo" value={incidente.motivo || "Sin motivo capturado"} />
        <TextBox label="Solucion" value={incidente.solucion || "Pendiente"} />
      </div>
    </article>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-3">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 font-semibold text-slate-800">{value}</p>
    </div>
  );
}

function TextBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-100 px-3 py-3">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm text-slate-700">{value}</p>
    </div>
  );
}
