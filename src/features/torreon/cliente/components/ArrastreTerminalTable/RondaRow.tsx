import { AlertTriangle, ArrowDown, ArrowUp, Ban, ChevronsUp, ChevronDown, ChevronRight, Pencil } from "lucide-react";
import { buildArrastreFolio, fmtDate, getPrimaryIncident, type Arrastre, type DailyInfo, type IncidenteArrastre, type VagonArrastre } from "@/features/torreon/arrastres";
import { canCancelArrastreRequest, canEditArrastreRequest, statusText } from "../../utils";
import { EstadoBadge } from "../EstadoBadge";
import { Direction, getCurrentVagon, getNextVagones, getStats, vagonLabel } from "./helpers";
import { IconButton } from "./TerminalControls";

type Props = {
  arrastre: Arrastre;
  dailyInfo?: DailyInfo;
  expanded: boolean;
  busyAction: string | null;
  canMoveSolicitudUp: boolean;
  canMoveSolicitudDown: boolean;
  canPrioritizeSolicitud: boolean;
  isManaged: boolean;
  onToggle: () => void;
  onPrioritizeSolicitud?: (arrastre: Arrastre) => void;
  onReorderSolicitud?: (arrastre: Arrastre, direction: Direction) => void;
  onEditArrastre?: (arrastre: Arrastre) => void;
  onCancel?: (arrastre: Arrastre) => void;
  onIncidentSelect?: (incident: IncidenteArrastre, arrastre: Arrastre) => void;
};

export function RondaRow({
  arrastre,
  dailyInfo,
  expanded,
  busyAction,
  canMoveSolicitudUp,
  canMoveSolicitudDown,
  canPrioritizeSolicitud,
  isManaged,
  onToggle,
  onPrioritizeSolicitud,
  onReorderSolicitud,
  onEditArrastre,
  onCancel,
  onIncidentSelect,
}: Props) {
  const current = getCurrentVagon(arrastre);
  const next = getNextVagones(arrastre);
  const stats = getStats(arrastre);
  const currentStatus = current ? statusText(current.estado) : "";
  const currentLabel = currentStatus === "EN_PROCESO" ? "REALIZANDO" : current ? "SIGUE" : "SIN PENDIENTES";
  const canCancel = canCancelArrastreRequest(arrastre);
  const primaryIncident = getPrimaryIncident(arrastre);
  const incidentCount = arrastre.incidentes?.length || 0;

  return (
    <tr className={`align-middle transition ${expanded ? "bg-emerald-50/60 dark:bg-emerald-950/20" : "bg-white hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-900/70"}`}>
      <td className="px-3 py-3">
        <button
          type="button"
          onClick={onToggle}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-emerald-300 hover:text-emerald-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          aria-label={expanded ? "Ocultar vagones" : "Ver vagones"}
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      </td>
      <td className="px-3 py-3">
        <div className="font-mono text-base font-black text-slate-950 dark:text-white">{buildArrastreFolio(arrastre, dailyInfo)}</div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-400">
          <span>ID #{arrastre.id}</span>
          {dailyInfo && <span>Ronda {dailyInfo.index}/{dailyInfo.total}</span>}
          <span className={isManaged ? "text-emerald-700 dark:text-emerald-300" : "text-slate-400"}>
            {isManaged ? "Tu empresa" : "Solo consulta"}
          </span>
        </div>
      </td>
      <td className="px-3 py-3">
        <EstadoBadge estado={arrastre.estado} />
      </td>
      <td className="px-3 py-3">
        <div className="font-semibold text-slate-900 dark:text-slate-100">{fmtDate(arrastre.fechaSolicitud)}</div>
        <div className="mt-1 text-xs text-slate-500">Solicitud</div>
      </td>
      <td className="px-3 py-3">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-800 dark:bg-emerald-950/30">
          <div className="font-mono text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">{currentLabel}</div>
          <div className="mt-1 text-lg font-black text-emerald-900 dark:text-emerald-100">{vagonLabel(current)}</div>
          {current && (
            <div className="mt-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
              {formatVagonRoute(current)} · {statusText(current.carga)}
            </div>
          )}
        </div>
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-xs font-black uppercase tracking-[0.14em] text-slate-500">Avance</span>
          <span className="font-mono text-base font-black text-slate-950 dark:text-white">{stats.pct}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${stats.pct}%` }} />
        </div>
        <div className="mt-2 grid grid-cols-4 gap-1 text-center text-[11px] font-black">
          <span className="rounded-md bg-slate-100 px-1.5 py-1 text-slate-600 dark:bg-slate-800 dark:text-slate-300">P {stats.pendientes}</span>
          <span className="rounded-md bg-blue-50 px-1.5 py-1 text-blue-700 dark:bg-blue-950/50 dark:text-blue-200">E {stats.proceso}</span>
          <span className="rounded-md bg-amber-50 px-1.5 py-1 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">B {stats.bloqueados}</span>
          <span className="rounded-md bg-emerald-50 px-1.5 py-1 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200">L {stats.concluidos}</span>
        </div>
      </td>
      <td className="px-3 py-3">
        <div className="grid grid-cols-2 gap-2">
          {next.length ? next.map((vagon) => (
            <div key={vagon.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <div className="text-xs font-black uppercase tracking-wide text-slate-400">Vagon {vagon.orden}</div>
              <div className="mt-0.5 font-black text-slate-950 dark:text-white">{vagonLabel(vagon)}</div>
              <div className="mt-1 text-[11px] font-semibold text-slate-500">{formatVagonRoute(vagon)}</div>
            </div>
          )) : (
            <span className="col-span-2 text-sm font-semibold text-slate-400">Sin vagones pendientes</span>
          )}
        </div>
      </td>
      <td className="px-3 py-3">
        <div className="flex justify-end gap-1.5">
          {onPrioritizeSolicitud && (
            <IconButton title="Subir al frente por incidente" disabled={!canPrioritizeSolicitud || busyAction != null} onClick={() => onPrioritizeSolicitud(arrastre)}>
              <ChevronsUp className="h-4 w-4" />
            </IconButton>
          )}
          {onReorderSolicitud && (
            <>
              <IconButton title="Subir ronda" disabled={!canMoveSolicitudUp || busyAction != null} onClick={() => onReorderSolicitud(arrastre, "up")}>
                <ArrowUp className="h-4 w-4" />
              </IconButton>
              <IconButton title="Bajar ronda" disabled={!canMoveSolicitudDown || busyAction != null} onClick={() => onReorderSolicitud(arrastre, "down")}>
                <ArrowDown className="h-4 w-4" />
              </IconButton>
            </>
          )}
          {onEditArrastre && (
            <IconButton title="Editar movimiento" disabled={!canEditArrastreRequest(arrastre) || busyAction != null} onClick={() => onEditArrastre(arrastre)}>
              <Pencil className="h-4 w-4" />
            </IconButton>
          )}
          {onCancel && (
            <IconButton title="Cancelar movimiento" tone="danger" disabled={!canCancel || busyAction != null} onClick={() => onCancel(arrastre)}>
              <Ban className="h-4 w-4" />
            </IconButton>
          )}
          {primaryIncident && onIncidentSelect ? (
            <IconButton title={`Ver incidente (${incidentCount})`} tone="warning" disabled={busyAction != null} onClick={() => onIncidentSelect(primaryIncident, arrastre)}>
              <AlertTriangle className="h-4 w-4" />
            </IconButton>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

function formatVagonRoute(vagon?: VagonArrastre | null) {
  return `Origen ${formatPoint(vagon?.viaOrigenNombre, vagon?.seccionOrigenNombre, vagon?.viaOrigenId, vagon?.seccionOrigenId)} -> Destino ${formatPoint(vagon?.viaDestinoNombre, vagon?.seccionDestinoNombre, vagon?.viaId, vagon?.seccionId)}`;
}

function formatPoint(viaName?: string | null, sectionName?: string | null, viaId?: number | null, seccionId?: number | null) {
  return `Via ${viaName || viaId || "-"} / Sec ${sectionName || seccionId || "-"}`;
}
