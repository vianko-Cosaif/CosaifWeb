import { AlertTriangle, Eye, Timer } from "lucide-react";
import type { MovimientoNatural, SelectedIncident } from "../types";
import {
  formatDate,
  formatDuration,
  getClientLabel,
  getIncidentList,
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
  onOpenFotos: (row: MovimientoNatural) => void;
  onOpenIncident: (incident: SelectedIncident) => void;
};

export function NaturalesTable({ rows, loading, error, page, pageSize, onOpenFotos, onOpenIncident }: Props) {
  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
      {loading ? (
        <div className="p-6 text-center text-sm font-semibold text-slate-500 dark:text-slate-400">Cargando movimientos...</div>
      ) : error ? (
        <div className="flex items-center justify-center gap-2 p-6 text-sm font-semibold text-rose-600">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
      ) : rows.length === 0 ? (
        <div className="p-6 text-center text-sm font-semibold text-slate-500 dark:text-slate-400">Sin movimientos para mostrar.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-[1480px] w-full text-left text-sm">
            <thead className="bg-slate-950 text-[11px] uppercase tracking-wide text-white">
              <tr>
                <th className="px-3 py-3">Orden</th>
                <th className="px-3 py-3">ID</th>
                <th className="px-3 py-3">Cliente</th>
                <th className="px-3 py-3">Loco</th>
                <th className="px-3 py-3">Inicio por</th>
                <th className="px-3 py-3">Origen</th>
                <th className="px-3 py-3">Destino</th>
                <th className="px-3 py-3">Solicitud</th>
                <th className="px-3 py-3">Inicio</th>
                <th className="px-3 py-3">Fin</th>
                <th className="px-3 py-3">Resolución</th>
                <th className="px-3 py-3">Estado</th>
                <th className="px-3 py-3">Incidentes</th>
                <th className="px-3 py-3 text-right">Imágenes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map((row, index) => (
                <NaturalRow
                  key={String(row.id)}
                  row={row}
                  index={(page - 1) * pageSize + index + 1}
                  onOpenFotos={onOpenFotos}
                  onOpenIncident={onOpenIncident}
                />
              ))}
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
  onOpenFotos,
  onOpenIncident,
}: {
  row: MovimientoNatural;
  index: number;
  onOpenFotos: (row: MovimientoNatural) => void;
  onOpenIncident: (incident: SelectedIncident) => void;
}) {
  const state = normalizeStatus(row.estado);
  const fotosCount = row.fotosCount ?? (row.fotos || []).length;
  const incidentes = getIncidentList(row);
  const primaryIncident = getPrimaryIncident(row);

  return (
    <tr className="hover:bg-slate-50 dark:hover:bg-slate-900/70">
      <td className="px-3 py-3 font-mono text-xs font-black text-slate-500 dark:text-slate-400">{index}</td>
      <td className="px-3 py-3 font-black text-slate-950 dark:text-white">#{row.id}</td>
      <td className="px-3 py-3">
        <p className="font-bold text-slate-800 dark:text-slate-200">{getClientLabel(row)}</p>
        <p className="text-xs font-semibold text-slate-400">{row.tipoMovimiento || "Movimiento"}</p>
      </td>
      <td className="px-3 py-3 font-bold text-slate-700 dark:text-slate-300">{row.locomotiveNumber || "--"}</td>
      <td className="px-3 py-3">
        <p className="font-bold text-slate-800 dark:text-slate-200">{getOperatorLabel(row)}</p>
        <p className="text-xs font-semibold text-slate-400">{row.supervisorNombre || row.coordinadorNombre || "Sin responsable"}</p>
      </td>
      <td className="px-3 py-3 text-slate-600 dark:text-slate-400">{row.viaOrigen || "--"}</td>
      <td className="px-3 py-3 text-slate-600 dark:text-slate-400">{row.viaDestino || "--"}</td>
      <td className="px-3 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">{formatDate(row.fechaSolicitud)}</td>
      <td className="px-3 py-3 text-xs font-black text-emerald-700">{formatDate(row.fechaInicio)}</td>
      <td className="px-3 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">{formatDate(row.fechaFin)}</td>
      <td className="px-3 py-3">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-50 px-2 py-1 text-xs font-black text-slate-700 dark:bg-slate-800 dark:text-slate-300">
          <Timer className="h-3.5 w-3.5 text-slate-400" />
          {formatDuration(row.fechaInicio, row.fechaFin)}
        </span>
      </td>
      <td className="px-3 py-3">
        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${statusClass(state)}`}>
          {state.replace(/_/g, " ")}
        </span>
      </td>
      <td className="px-3 py-3">
        {primaryIncident ? (
          <button
            type="button"
            onClick={() => onOpenIncident({
              incident: primaryIncident,
              title: `Movimiento #${row.id}`,
              subtitle: `Loco ${row.locomotiveNumber || "--"} · ${row.viaOrigen || "--"} a ${row.viaDestino || "--"}`,
            })}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 text-xs font-black text-amber-800 transition hover:border-amber-300 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-900/50"
          >
            <AlertTriangle className="h-4 w-4" />
            Ver {incidentes.length}
          </button>
        ) : (
          <span className="text-xs font-bold text-slate-400">--</span>
        )}
      </td>
      <td className="px-3 py-3 text-right">
        <button
          type="button"
          onClick={() => onOpenFotos(row)}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300"
        >
          <Eye className="h-4 w-4" />
          Ver {fotosCount ? `(${fotosCount})` : ""}
        </button>
      </td>
    </tr>
  );
}
