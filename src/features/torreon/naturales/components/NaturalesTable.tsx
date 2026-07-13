"use client";

import { Fragment, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Camera,
  ChevronDown,
  ChevronUp,
  Clock3,
  Eye,
  MapPin,
  Timer,
  UserRound,
} from "lucide-react";
import type { MovimientoNatural, SelectedIncident } from "../types";
import {
  formatDate,
  formatDuration,
  getClientLabel,
  getIncidentList,
  getMovimientoFolio,
  getOperatorLabel,
  getPrimaryIncident,
  normalizeStatus,
  statusClass,
} from "../utils";

type Props = {
  rows: MovimientoNatural[];
  loading: boolean;
  error: string | null;
  page: number;
  pageSize: number;
  compact?: boolean;
  onOpenFotos: (row: MovimientoNatural) => void;
  onOpenIncident: (incident: SelectedIncident) => void;
};

export function NaturalesTable({
  rows,
  loading,
  error,
  page,
  pageSize,
  compact = false,
  onOpenFotos,
  onOpenIncident,
}: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-slate-700 dark:text-slate-200">
            {compact ? "Cola de movimientos" : "Movimientos filtrados"}
          </p>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Selecciona una fila para consultar responsables, instrucciones y evidencias.
          </p>
        </div>
        <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          {rows.length} registro{rows.length === 1 ? "" : "s"}
        </span>
      </div>

      {loading ? (
        <div className="p-8 text-center text-sm font-semibold text-slate-500 dark:text-slate-400">Cargando movimientos...</div>
      ) : error ? (
        <div className="flex items-center justify-center gap-2 p-8 text-sm font-semibold text-rose-600">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
      ) : rows.length === 0 ? (
        <div className="p-10 text-center">
          <p className="font-black text-slate-700 dark:text-slate-200">Sin movimientos para mostrar</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">La cola se actualizará cuando exista una nueva solicitud.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] table-fixed text-left text-sm">
            <colgroup>
              <col className="w-12" />
              <col className="w-16" />
              <col className="w-44" />
              <col className="w-52" />
              <col className="w-56" />
              <col className="w-64" />
              <col className="w-36" />
              <col className="w-48" />
            </colgroup>
            <thead className="border-b border-slate-200 bg-slate-100 text-[11px] uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
              <tr>
                <th className="px-3 py-3" aria-label="Detalle" />
                <th className="px-3 py-3">Orden</th>
                <th className="px-3 py-3">Movimiento</th>
                <th className="px-3 py-3">Cliente / operador</th>
                <th className="px-3 py-3">Ruta</th>
                <th className="px-3 py-3">Ventana operativa</th>
                <th className="px-3 py-3">Estado</th>
                <th className="px-3 py-3 text-right">Seguimiento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
              {rows.map((row, index) => {
                const rowKey = String(row.id);
                const isOpen = Boolean(expanded[rowKey]);
                return (
                  <Fragment key={rowKey}>
                    <NaturalRow
                      row={row}
                      index={(page - 1) * pageSize + index + 1}
                      expanded={isOpen}
                      onToggle={() => setExpanded((current) => ({ ...current, [rowKey]: !current[rowKey] }))}
                      onOpenFotos={onOpenFotos}
                      onOpenIncident={onOpenIncident}
                    />
                    {isOpen ? (
                      <NaturalDetailRow row={row} onOpenFotos={onOpenFotos} onOpenIncident={onOpenIncident} />
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function NaturalRow({
  row,
  index,
  expanded,
  onToggle,
  onOpenFotos,
  onOpenIncident,
}: {
  row: MovimientoNatural;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  onOpenFotos: (row: MovimientoNatural) => void;
  onOpenIncident: (incident: SelectedIncident) => void;
}) {
  const state = normalizeStatus(row.estado);
  const fotosCount = row.fotosCount ?? (row.fotos || []).length;
  const incidentes = getIncidentList(row);
  const primaryIncident = getPrimaryIncident(row);
  const folio = getMovimientoFolio(row);

  return (
    <tr
      onClick={onToggle}
      className={`cursor-pointer transition hover:bg-slate-50 dark:hover:bg-slate-800/50 ${expanded ? "bg-emerald-50/40 dark:bg-emerald-950/10" : ""}`}
    >
      <td className="px-3 py-3">
        <button
          type="button"
          onClick={(event) => { event.stopPropagation(); onToggle(); }}
          aria-label={expanded ? "Ocultar detalle" : "Ver detalle"}
          aria-expanded={expanded}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:border-emerald-300 hover:text-emerald-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </td>
      <td className="px-3 py-3 font-mono text-xs font-black text-slate-500 dark:text-slate-400">{index}</td>
      <td className="px-3 py-3">
        <p className="font-black text-slate-950 dark:text-white">{folio}</p>
        <p className="mt-0.5 text-xs font-bold text-slate-500 dark:text-slate-400">
          Loco {row.locomotiveNumber || "--"} · Ronda {row.rondaNumero || "--"}
        </p>
      </td>
      <td className="px-3 py-3">
        <p className="truncate font-bold text-slate-800 dark:text-slate-200">{getClientLabel(row)}</p>
        <p className="mt-0.5 truncate text-xs font-semibold text-slate-400">{getOperatorLabel(row)}</p>
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-300">
          <span className="truncate">{row.viaOrigen || "--"}</span>
          <ArrowRight className="h-4 w-4 shrink-0 text-emerald-600" />
          <span className="truncate">{row.viaDestino || "--"}</span>
        </div>
      </td>
      <td className="px-3 py-3">
        <p className="text-xs font-black text-emerald-700 dark:text-emerald-300">Inicio {formatDate(row.fechaInicio)}</p>
        <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">Fin {formatDate(row.fechaFin)}</p>
      </td>
      <td className="px-3 py-3">
        <span className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-bold ${statusClass(state)}`}>
          {state.replace(/_/g, " ")}
        </span>
      </td>
      <td className="px-3 py-3">
        <div className="flex justify-end gap-2">
          {primaryIncident ? (
            <button
              type="button"
              title="Ver incidente"
              onClick={(event) => {
                event.stopPropagation();
                onOpenIncident({
                  incident: primaryIncident,
                  title: `Movimiento ${folio}`,
                  subtitle: `Loco ${row.locomotiveNumber || "--"} · ${row.viaOrigen || "--"} a ${row.viaDestino || "--"}`,
                });
              }}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 text-xs font-black text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              {incidentes.length}
            </button>
          ) : null}
          <button
            type="button"
            title="Ver evidencias"
            onClick={(event) => { event.stopPropagation(); onOpenFotos(row); }}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 px-2.5 text-xs font-bold text-slate-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-emerald-950/40"
          >
            <Camera className="h-3.5 w-3.5" />
            {fotosCount}
          </button>
        </div>
      </td>
    </tr>
  );
}

function NaturalDetailRow({
  row,
  onOpenFotos,
  onOpenIncident,
}: {
  row: MovimientoNatural;
  onOpenFotos: (row: MovimientoNatural) => void;
  onOpenIncident: (incident: SelectedIncident) => void;
}) {
  const incidentes = getIncidentList(row);
  const primaryIncident = getPrimaryIncident(row);
  const folio = getMovimientoFolio(row);

  return (
    <tr>
      <td colSpan={8} className="bg-slate-50 px-4 py-4 dark:bg-slate-950/50">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Detail label="Solicitud" value={formatDate(row.fechaSolicitud)} icon={Clock3} />
            <Detail label="Tipo" value={row.tipoMovimiento || "Movimiento natural"} icon={Timer} />
            <Detail label="Responsable" value={row.supervisorNombre || row.coordinadorNombre || "Sin responsable"} icon={UserRound} />
            <Detail label="Posición" value={`Ronda ${row.rondaNumero || "--"} · Orden ${row.ordenRonda || "--"}`} icon={MapPin} />
          </div>
          <div className="flex items-start gap-2">
            {primaryIncident ? (
              <button
                type="button"
                onClick={() => onOpenIncident({
                  incident: primaryIncident,
                  title: `Movimiento ${folio}`,
                  subtitle: `Loco ${row.locomotiveNumber || "--"} · ${row.viaOrigen || "--"} a ${row.viaDestino || "--"}`,
                })}
                className="inline-flex h-9 items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 text-xs font-black text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
              >
                <AlertTriangle className="h-4 w-4" /> Ver incidente ({incidentes.length})
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => onOpenFotos(row)}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 hover:border-emerald-300 hover:text-emerald-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            >
              <Eye className="h-4 w-4" /> Evidencias
            </button>
          </div>
        </div>
        <div className="mt-3 flex flex-col gap-2 border-t border-slate-200 pt-3 text-sm dark:border-slate-800 sm:flex-row sm:items-start sm:justify-between">
          <p className="font-semibold text-slate-600 dark:text-slate-300">
            <span className="font-black text-slate-800 dark:text-slate-100">Instrucciones:</span>{" "}
            {row.instrucciones || "Sin instrucciones adicionales."}
          </p>
          <span className="shrink-0 rounded-md bg-white px-2.5 py-1 text-xs font-black text-slate-600 dark:bg-slate-900 dark:text-slate-300">
            Resolución {formatDuration(row.fechaInicio, row.fechaFin)}
          </span>
        </div>
      </td>
    </tr>
  );
}

function Detail({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Clock3 }) {
  return (
    <div className="min-w-0 border-l-2 border-emerald-500 pl-3">
      <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-slate-400">
        <Icon className="h-3.5 w-3.5" /> {label}
      </p>
      <p className="mt-1 truncate text-sm font-black text-slate-800 dark:text-slate-200">{value}</p>
    </div>
  );
}
