import { useMemo, useState, type ReactNode } from "react";
import { Camera, CheckCircle2, RefreshCw, ShieldAlert } from "lucide-react";
import {
  buildArrastreFolio,
  fmtDate,
  type Arrastre,
  type DailyInfo,
  type IncidenteArrastre,
} from "@/features/torreon/arrastres";
import SearchInput from "@/components/ui/SearchInput";
import Button from "@/components/ui/Button";
import SegmentedControl from "@/components/ui/SegmentedControl";
import StatusBadge from "@/components/ui/StatusBadge";
import { EmptyState, ModuleHeader } from "../components";
import { statusText } from "../utils";

export type ClienteArrastreIncidentRow = {
  arrastre: Arrastre;
  incident: IncidenteArrastre;
  dailyInfo?: DailyInfo;
};

type IncidentTab = "abiertos" | "resueltos";

type Props = {
  feedback: ReactNode;
  rows: ClienteArrastreIncidentRow[];
  dailyCounters: Map<number, DailyInfo>;
  loading: boolean;
  refreshing: boolean;
  resolvingId: string | null;
  onRefresh: () => void;
  onIncidentSelect: (incident: IncidenteArrastre, arrastre: Arrastre) => void;
  onResolveClick: (incident: IncidenteArrastre, arrastre: Arrastre) => void;
};

function incidentText(row: ClienteArrastreIncidentRow) {
  const { arrastre, incident } = row;
  return [
    arrastre.id,
    buildArrastreFolio(arrastre, row.dailyInfo),
    incident.id,
    incident.estado,
    incident.motivo,
    incident.solucion,
    incident.viaBloqueadaId,
    incident.seccionBloqueadaId,
    incident.vagonId,
  ].join(" ").toLowerCase();
}

export function IncidentesView({
  feedback,
  rows,
  dailyCounters,
  loading,
  refreshing,
  resolvingId,
  onRefresh,
  onIncidentSelect,
  onResolveClick,
}: Props) {
  const [tab, setTab] = useState<IncidentTab>("abiertos");
  const [search, setSearch] = useState("");

  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      const status = statusText(row.incident.estado);
      const isOpen = status === "ABIERTO";
      if (tab === "abiertos" && !isOpen) return false;
      if (tab === "resueltos" && isOpen) return false;
      return !query || incidentText(row).includes(query);
    });
  }, [rows, search, tab]);

  const openCount = rows.filter((row) => statusText(row.incident.estado) === "ABIERTO").length;
  const solvedCount = rows.length - openCount;

  return (
    <section className="min-w-0 w-full overflow-hidden rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text)] shadow-[var(--app-shadow-sm)]">
      <div className="flex min-h-[calc(100svh-7rem)] flex-col gap-5 px-3 py-4 sm:px-5 sm:py-6 lg:px-7">
        <ModuleHeader title="Incidentes" chip={tab === "abiertos" ? "Abiertos" : "Historial"} total={visibleRows.length} icon={ShieldAlert} />
        <div className="h-px bg-gradient-to-r from-transparent via-amber-300/40 to-transparent" />
        {feedback}

        <div className="min-w-0 space-y-3 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-subtle)] p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <SegmentedControl value={tab} onChange={setTab} ariaLabel="Estado de incidentes de arrastre" className="w-full [&>button]:flex-1 lg:w-auto" options={[{ value: "abiertos", label: "Abiertos", count: openCount }, { value: "resueltos", label: "Historial", count: solvedCount }]} />
            <Button onClick={onRefresh} loading={refreshing} disabled={loading} leftIcon={<RefreshCw className="h-4 w-4" aria-hidden />}>Actualizar</Button>
          </div>
          <SearchInput value={search} onChange={setSearch} onClear={() => setSearch("")} label="Buscar incidentes por folio, vagón, vía o motivo" placeholder="Folio, vagón, vía o motivo…" inputClassName="text-base sm:text-sm" />
        </div>

        {loading ? (
          <div className="h-72 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-900" />
        ) : visibleRows.length ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] text-left text-sm">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-[0.2em] text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Ronda</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Bloqueo</th>
                    <th className="px-4 py-3">Motivo</th>
                    <th className="px-4 py-3">Evidencias</th>
                    <th className="px-4 py-3">Registro</th>
                    <th className="px-4 py-3 text-right">Accion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {visibleRows.map((row) => {
                    const status = statusText(row.incident.estado);
                    const fotos = row.incident.fotosCount ?? (Array.isArray(row.incident.fotos) ? row.incident.fotos.length : 0);
                    const resolving = resolvingId === `${row.arrastre.id}:${row.incident.id}`;

                    return (
                      <tr key={`${row.arrastre.id}:${row.incident.id}`} className="bg-white align-top hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-900/70">
                        <td className="px-4 py-4">
                          <div className="font-mono text-base font-black text-slate-950 dark:text-white">
                            {buildArrastreFolio(row.arrastre, dailyCounters.get(row.arrastre.id))}
                          </div>
                          <div className="mt-1 text-xs font-bold text-slate-400">Arrastre #{row.arrastre.id} · Incidente #{row.incident.id}</div>
                        </td>
                        <td className="px-4 py-4">
                          <StatusBadge status={status} />
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-1.5 text-xs font-black text-slate-600 dark:text-slate-300">
                            {row.incident.viaBloqueadaId ? <span className="rounded-lg bg-slate-100 px-2 py-1 dark:bg-slate-900">Vía {row.incident.viaBloqueadaId}</span> : null}
                            {row.incident.seccionBloqueadaId ? <span className="rounded-lg bg-slate-100 px-2 py-1 dark:bg-slate-900">Sección {row.incident.seccionBloqueadaId}</span> : null}
                            {row.incident.vagonId ? <span className="rounded-lg bg-slate-100 px-2 py-1 dark:bg-slate-900">Vagón #{row.incident.vagonId}</span> : null}
                            {!row.incident.viaBloqueadaId && !row.incident.seccionBloqueadaId && !row.incident.vagonId ? "-" : null}
                          </div>
                        </td>
                        <td className="max-w-md px-4 py-4">
                          <p className="line-clamp-2 font-semibold text-slate-700 dark:text-slate-200">
                            {row.incident.motivo || row.incident.descripcion || "Sin motivo capturado"}
                          </p>
                          {row.incident.solucion ? (
                            <p className="mt-2 line-clamp-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                              Solucion: {row.incident.solucion}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-4 py-4">
                          <span className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                            <Camera className="h-4 w-4" />
                            {fotos}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm font-semibold text-slate-600 dark:text-slate-300">
                          <div>{fmtDate(row.incident.fechaInicio)}</div>
                          {row.incident.fechaResolucion ? <div className="mt-1 text-emerald-700 dark:text-emerald-300">{fmtDate(row.incident.fechaResolucion)}</div> : null}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => onIncidentSelect(row.incident, row.arrastre)}
                              className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 shadow-sm transition hover:border-emerald-300 hover:text-emerald-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                            >
                              Ver
                            </button>
                            {status === "ABIERTO" ? (
                              <button
                                type="button"
                                onClick={() => onResolveClick(row.incident, row.arrastre)}
                                disabled={Boolean(resolvingId)}
                                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 text-xs font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
                              >
                                {resolving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                                Resolver
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <EmptyState
            text={search ? "Sin resultados con esta búsqueda" : tab === "abiertos" ? "No hay incidentes abiertos" : "No hay incidentes en el historial"}
            hint={search ? "Ajusta o limpia la búsqueda para consultar otros incidentes." : "Los incidentes de arrastre aparecerán aquí."}
          />
        )}
      </div>
    </section>
  );
}
