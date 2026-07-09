import { useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, Camera, CheckCircle2, RefreshCw, Search, ShieldAlert } from "lucide-react";
import {
  buildArrastreFolio,
  fmtDate,
  type Arrastre,
  type DailyInfo,
  type IncidenteArrastre,
} from "@/features/torreon/arrastres";
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

function statusClass(status: string) {
  if (status === "ABIERTO") return "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200";
  if (status === "RESUELTO" || status === "CERRADO") return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200";
  return "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300";
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
    <section className="w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 text-slate-900 shadow-xl shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:shadow-black/30">
      <div className="flex min-h-[calc(100svh-7rem)] flex-col gap-5 px-3 py-4 sm:px-5 sm:py-6 lg:px-7">
        <ModuleHeader title="Incidentes" chip={tab === "abiertos" ? "Abiertos" : "Historial"} total={visibleRows.length} icon={ShieldAlert} />
        <div className="h-px bg-gradient-to-r from-transparent via-amber-300/40 to-transparent" />
        {feedback}

        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="inline-flex w-full rounded-2xl bg-slate-100 p-1 dark:bg-slate-800 lg:w-auto">
              <TabButton active={tab === "abiertos"} onClick={() => setTab("abiertos")}>
                Abiertos <span>{openCount}</span>
              </TabButton>
              <TabButton active={tab === "resueltos"} onClick={() => setTab("resueltos")}>
                Resueltos <span>{solvedCount}</span>
              </TabButton>
            </div>
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm transition hover:border-emerald-300 hover:text-emerald-700 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Actualizar
            </button>
          </div>
          <label className="mt-3 flex h-12 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-950">
            <Search className="h-4 w-4" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por folio, vagon, via, motivo..."
              className="h-full min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100"
            />
          </label>
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
                          <span className={`inline-flex rounded-lg border px-2.5 py-1 text-xs font-black ${statusClass(status)}`}>
                            {status || "SIN ESTADO"}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-1.5 text-xs font-black text-slate-600 dark:text-slate-300">
                            {row.incident.viaBloqueadaId ? <span className="rounded-lg bg-slate-100 px-2 py-1 dark:bg-slate-900">Via {row.incident.viaBloqueadaId}</span> : null}
                            {row.incident.seccionBloqueadaId ? <span className="rounded-lg bg-slate-100 px-2 py-1 dark:bg-slate-900">Seccion {row.incident.seccionBloqueadaId}</span> : null}
                            {row.incident.vagonId ? <span className="rounded-lg bg-slate-100 px-2 py-1 dark:bg-slate-900">Vagon #{row.incident.vagonId}</span> : null}
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
            text={tab === "abiertos" ? "No hay incidentes abiertos" : "No hay incidentes resueltos"}
            hint={search ? "Ajusta la busqueda o cambia de pestana" : "Los bloqueos de arrastre apareceran aqui"}
          />
        )}
      </div>
    </section>
  );
}

function TabButton({ active, children, onClick }: { active: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black transition lg:min-w-40 ${
        active
          ? "bg-white text-slate-950 shadow-sm dark:bg-slate-950 dark:text-white"
          : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
      }`}
    >
      {children}
    </button>
  );
}
