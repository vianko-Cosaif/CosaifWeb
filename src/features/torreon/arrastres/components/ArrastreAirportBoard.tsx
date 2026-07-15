"use client";

import { AlertTriangle, ArrowRight, Boxes, Radio } from "lucide-react";
import { operationStatusLabel } from "@/features/torreon/operationCopy";
import type { Arrastre, DailyInfo, IncidenteArrastre, VagonArrastre } from "../types";
import {
  buildArrastreFolio,
  fmtDate,
  getPrimaryIncident,
  getVagonName,
  getVagonStats,
  normalizeStatus,
} from "../utils";

type Props = {
  rows: Arrastre[];
  dailyCounters: Map<number, DailyInfo>;
  onIncidentSelect?: (incident: IncidenteArrastre, arrastre: Arrastre) => void;
};

export default function ArrastreAirportBoard({ rows, dailyCounters, onIncidentSelect }: Props) {
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-100 px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
        <div>
          <div className="flex items-center gap-2 font-mono text-[11px] font-black uppercase tracking-[0.22em] text-emerald-700 dark:text-emerald-300">
            <Radio className="h-3.5 w-3.5" aria-hidden />
            Cola de arrastres
          </div>
          <h3 className="mt-0.5 text-base font-black text-slate-950 dark:text-white">Solicitudes activas</h3>
        </div>
        <div className="inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 font-mono text-xs font-black uppercase tracking-wide text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          {rows.length} activ{rows.length === 1 ? "a" : "as"}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="flex min-h-40 items-center justify-center px-4 text-center font-mono text-sm font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
          Sin arrastres pendientes
        </div>
      ) : (
        <>
        <div className="grid gap-3 p-3 lg:hidden">
          {rows.map((arrastre, index) => (
            <AirportMobileCard
              key={arrastre.id}
              arrastre={arrastre}
              index={index}
              dailyInfo={dailyCounters.get(arrastre.id)}
              onIncidentSelect={onIncidentSelect}
            />
          ))}
        </div>
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[1180px] table-fixed text-left text-sm">
            <colgroup>
              <col className="w-36" />
              <col className="w-56" />
              <col className="w-36" />
              <col className="w-44" />
              <col className="w-72" />
              <col className="w-56" />
              <col className="w-72" />
              <col className="w-24" />
            </colgroup>
            <thead className="border-b border-slate-200 bg-slate-50 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Turno</th>
                <th className="px-3 py-3">Ronda</th>
                <th className="px-3 py-3">Estado</th>
                <th className="px-3 py-3">Solicitud</th>
                <th className="px-3 py-3">Ahora</th>
                <th className="px-3 py-3">Avance</th>
                <th className="px-3 py-3">Siguientes</th>
                <th className="px-3 py-3 text-right">Inc.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-950">
              {rows.map((arrastre, index) => (
                <AirportArrastreRow
                  key={arrastre.id}
                  arrastre={arrastre}
                  index={index}
                  dailyInfo={dailyCounters.get(arrastre.id)}
                  onIncidentSelect={onIncidentSelect}
                />
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
    </section>
  );
}

function AirportMobileCard({ arrastre, index, dailyInfo, onIncidentSelect }: { arrastre: Arrastre; index: number; dailyInfo?: DailyInfo; onIncidentSelect?: (incident: IncidenteArrastre, arrastre: Arrastre) => void }) {
  const vagones = arrastre.vagones || [];
  const current = getCurrentVagon(vagones);
  const stats = getVagonStats(vagones);
  const completed = stats.CONCLUIDO;
  const progress = vagones.length ? Math.round((completed / vagones.length) * 100) : 0;
  const incident = getPrimaryIncident(arrastre);

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-slate-400">Turno {arrastre.ordenSolicitud ?? index + 1}</p>
          <h4 className="mt-1 font-mono text-lg font-black text-slate-950 dark:text-white">{buildArrastreFolio(arrastre, dailyInfo)}</h4>
        </div>
        <StatusLabel status={normalizeStatus(arrastre.estado)} />
      </div>

      <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-950/30">
        <p className="text-[10px] font-black uppercase tracking-wide text-emerald-700 dark:text-emerald-300">{normalizeStatus(current?.estado) === "EN_PROCESO" ? "En movimiento" : "Siguiente vagón"}</p>
        <p className="mt-1 font-black text-slate-950 dark:text-white">{current ? getVagonName(current) : "Sin pendientes"}</p>
        {current ? <p className="mt-1 text-xs font-semibold text-slate-600 dark:text-slate-300">{shortRoute(current)}</p> : null}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} /></div>
        <span className="text-sm font-black tabular-nums text-slate-700 dark:text-slate-200">{progress}%</span>
      </div>

      {incident && onIncidentSelect ? (
        <button type="button" onClick={() => onIncidentSelect(incident, arrastre)} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 text-sm font-black text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4" aria-hidden />
          Ver incidente
        </button>
      ) : null}
    </article>
  );
}

function shortRoute(vagon: VagonArrastre) {
  const origin = `${vagon.viaOrigenNombre || vagon.viaOrigenId || "—"} · ${vagon.seccionOrigenNombre || vagon.seccionOrigenId || "—"}`;
  const destination = `${vagon.viaDestinoNombre || vagon.viaId || "—"} · ${vagon.seccionDestinoNombre || vagon.seccionId || "—"}`;
  return <>{origin}<ArrowRight className="mx-1 inline h-3.5 w-3.5 text-emerald-600" aria-hidden />{destination}</>;
}

function AirportArrastreRow({
  arrastre,
  index,
  dailyInfo,
  onIncidentSelect,
}: {
  arrastre: Arrastre;
  index: number;
  dailyInfo?: DailyInfo;
  onIncidentSelect?: (incident: IncidenteArrastre, arrastre: Arrastre) => void;
}) {
  const vagones = arrastre.vagones || [];
  const current = getCurrentVagon(vagones);
  const next = getNextVagones(vagones, current?.id, 2);
  const stats = getVagonStats(vagones);
  const state = normalizeStatus(arrastre.estado);
  const primaryIncident = getPrimaryIncident(arrastre);
  const incidentCount = arrastre.incidentes?.length || 0;
  const isCurrent = normalizeStatus(current?.estado) === "EN_PROCESO" || (index === 0 && state === "SOLICITADO");
  const turn = getTurnLabel(state, isCurrent);
  const completed = stats.CONCLUIDO;
  const progress = vagones.length ? Math.round((completed / vagones.length) * 100) : 0;

  return (
    <tr className={isCurrent ? "bg-emerald-50/70 dark:bg-emerald-950/25" : "hover:bg-slate-50 dark:hover:bg-slate-900/70"}>
      <td className={`border-l-4 px-4 py-3 ${isCurrent ? "border-emerald-500" : state === "DETENIDO" ? "border-amber-500" : "border-transparent"}`}>
        <span className={`inline-flex rounded-md border px-2 py-1 font-mono text-[10px] font-black uppercase tracking-[0.12em] ${turn.className}`}>
          {turn.label}
        </span>
        <p className="mt-1 font-mono text-[11px] font-bold text-slate-400">POS {arrastre.ordenSolicitud ?? index + 1}</p>
      </td>
      <td className="px-3 py-3">
        <p className="font-mono text-base font-black text-slate-950 dark:text-white">{buildArrastreFolio(arrastre, dailyInfo)}</p>
        <p className="mt-1 text-xs font-bold text-slate-400">{vagones.length} vagón{vagones.length === 1 ? "" : "es"}</p>
      </td>
      <td className="px-3 py-3">
        <StatusLabel status={state} />
      </td>
      <td className="px-3 py-3 font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
        {fmtDate(arrastre.fechaSolicitud)}
      </td>
      <td className="px-3 py-3">
        {current ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-800 dark:bg-emerald-950/30">
            <div className="font-mono text-[10px] font-black uppercase tracking-[0.15em] text-emerald-700 dark:text-emerald-300">
              {normalizeStatus(current.estado) === "EN_PROCESO" ? "Realizando" : "Sigue"}
            </div>
            <div className="mt-1 flex items-center gap-2">
              <Boxes className="h-4 w-4 text-emerald-600" aria-hidden />
              <span className="font-mono text-lg font-black text-emerald-900 dark:text-emerald-100">{getVagonName(current)}</span>
              <span className="truncate text-xs font-bold text-slate-500 dark:text-slate-300">{formatZone(current)}</span>
            </div>
          </div>
        ) : (
          <span className="font-mono text-xs font-black uppercase text-slate-400">Sin pendientes</span>
        )}
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center justify-between gap-2 font-mono text-xs font-black">
          <span className="text-slate-500">AVANCE</span>
          <span className="text-slate-950 dark:text-white">{progress}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} />
        </div>
        <div className="mt-2 flex gap-3 font-mono text-[10px] font-black">
          <span className="text-slate-500">P {stats.PENDIENTE}</span>
          <span className="text-sky-700 dark:text-sky-300">E {stats.EN_PROCESO}</span>
          <span className="text-amber-700 dark:text-amber-300">B {stats.BLOQUEADO}</span>
          <span className="text-emerald-700 dark:text-emerald-300">L {stats.CONCLUIDO}</span>
        </div>
      </td>
      <td className="px-3 py-3">
        {next.length ? (
          <div className="grid grid-cols-2 gap-2">
            {next.map((vagon, nextIndex) => (
              <div key={vagon.id} className="min-w-0 rounded-md border border-slate-200 bg-white px-2.5 py-2 dark:border-slate-700 dark:bg-slate-900">
                <p className="font-mono text-[9px] font-black uppercase tracking-wide text-slate-400">{nextIndex === 0 ? "Después" : "Luego"}</p>
                <p className="mt-0.5 truncate font-mono text-sm font-black text-slate-950 dark:text-white">{getVagonName(vagon)}</p>
                <p className="mt-0.5 truncate text-[10px] font-bold text-slate-500">{formatZone(vagon)}</p>
              </div>
            ))}
          </div>
        ) : (
          <span className="font-mono text-xs font-black uppercase text-slate-400">Sin siguientes</span>
        )}
      </td>
      <td className="px-3 py-3 text-right">
        {primaryIncident && onIncidentSelect ? (
          <button
            type="button"
            title="Ver incidente"
            onClick={() => onIncidentSelect(primaryIncident, arrastre)}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 text-xs font-black text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
          >
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
            {incidentCount}
          </button>
        ) : (
          <span className="font-mono text-xs font-bold text-slate-300 dark:text-slate-700">--</span>
        )}
      </td>
    </tr>
  );
}

function getCurrentVagon(vagones: VagonArrastre[]) {
  return [...vagones]
    .filter((vagon) => ["EN_PROCESO", "PENDIENTE"].includes(normalizeStatus(vagon.estado)))
    .sort((a, b) => {
      const aPriority = normalizeStatus(a.estado) === "EN_PROCESO" ? 0 : 1;
      const bPriority = normalizeStatus(b.estado) === "EN_PROCESO" ? 0 : 1;
      return aPriority - bPriority || (a.orden ?? 0) - (b.orden ?? 0);
    })[0];
}

function getNextVagones(vagones: VagonArrastre[], currentId: number | undefined, limit: number) {
  return [...vagones]
    .filter((vagon) => vagon.id !== currentId && normalizeStatus(vagon.estado) === "PENDIENTE")
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
    .slice(0, limit);
}

function formatZone(vagon: VagonArrastre) {
  return `Origen ${formatPoint(vagon.viaOrigenNombre, vagon.seccionOrigenNombre, vagon.viaOrigenId, vagon.seccionOrigenId)} -> Destino ${formatPoint(vagon.viaDestinoNombre, vagon.seccionDestinoNombre, vagon.viaId, vagon.seccionId)}`;
}

function formatPoint(viaName?: string | null, sectionName?: string | null, viaId?: number | null, seccionId?: number | null) {
  return `Via ${viaName || viaId || "-"} / Sec ${sectionName || seccionId || "-"}`;
}

function getTurnLabel(state: string, isCurrent: boolean) {
  if (state === "EN_PROCESO") {
    return { label: "En atencion", className: "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200" };
  }
  if (state === "DETENIDO") {
    return { label: "Detenido", className: "border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200" };
  }
  if (isCurrent) {
    return { label: "Sigue", className: "border-sky-300 bg-sky-100 text-sky-800 dark:border-sky-700 dark:bg-sky-950 dark:text-sky-200" };
  }
  return { label: "En espera", className: "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300" };
}

function StatusLabel({ status }: { status: string }) {
  const tone = status === "EN_PROCESO"
    ? "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300"
    : status === "DETENIDO"
      ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
      : "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300";
  return <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-black ${tone}`}>{operationStatusLabel(status)}</span>;
}
