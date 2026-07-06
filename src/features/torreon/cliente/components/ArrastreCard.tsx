import { type ChangeEvent, useState } from "react";
import { AlertTriangle, Ban, ChevronDown, ChevronUp, Loader2, Pencil, Upload } from "lucide-react";
import { fmtDate, fmtMinutes, type Arrastre, type VagonArrastre } from "@/features/torreon/arrastres";
import type { ActionPayload, IncidentDraft } from "../types";
import { fieldClass, fmtFullDate, getOpenIncident, statusText } from "../utils";
import { EstadoBadge } from "./EstadoBadge";

type Props = {
  arrastre: Arrastre;
  dailyInfo?: { index: number; total: number; date: string };
  readOnly?: boolean;
  busyAction: string | null;
  draft: IncidentDraft;
  onDraftChange: (draft: IncidentDraft) => void;
  onFiles: (event: ChangeEvent<HTMLInputElement>) => void;
  onAction: (payload: ActionPayload) => void;
  onEditVagon: (arrastre: Arrastre, vagon: VagonArrastre) => void;
  onCancel: (arrastre: Arrastre) => void;
};

export function ArrastreCard({
  arrastre,
  dailyInfo,
  readOnly,
  busyAction,
  draft,
  onDraftChange,
  onFiles,
  onAction,
  onEditVagon,
  onCancel,
}: Props) {
  const incidenteAbierto = getOpenIncident(arrastre);
  const [expanded, setExpanded] = useState(false);
  const vagones = arrastre.vagones || [];
  const hasVagonEnProceso = vagones.some((vagon) => statusText(vagon.estado) === "EN_PROCESO");
  const canCancel = !readOnly && !hasVagonEnProceso;
  const dailyLabel = dailyInfo ? `Arrastre ${dailyInfo.index} de ${dailyInfo.total}` : "Arrastre";

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
        <button type="button" onClick={() => setExpanded((value) => !value)} className="flex min-w-0 flex-1 items-start gap-3 text-left">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-slate-500 shadow-sm ring-1 ring-slate-200">
            {expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">{fmtFullDate(arrastre.fechaSolicitud)}</span>
              <EstadoBadge estado={arrastre.estado} />
              {incidenteAbierto && (
                <span className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Incidente abierto
                </span>
              )}
            </div>
            <h2 className="mt-1 text-xl font-black text-slate-950">
              {dailyLabel}
              <span className="ml-2 text-sm font-semibold text-slate-400">ID #{arrastre.id}</span>
            </h2>
            <div className="mt-2 flex flex-wrap gap-3 text-xs font-semibold text-slate-500">
              <span>Total {arrastre.resumen?.totalVagones ?? vagones.length} vagones</span>
              <span>Tiempo {fmtMinutes(arrastre.resumen?.solicitudTotalMin)}</span>
              <span>Operacion {fmtMinutes(arrastre.resumen?.operacionTotalMin)}</span>
            </div>
            {arrastre.instrucciones && <p className="mt-2 max-w-4xl truncate text-sm text-slate-600">{arrastre.instrucciones}</p>}
          </div>
        </button>

        <div className="flex flex-wrap gap-2 lg:justify-end">
          {!readOnly && (
            <button
              type="button"
              onClick={() => onCancel(arrastre)}
              disabled={!canCancel || busyAction === `${arrastre.id}:CANCELAR`}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-3 text-sm font-bold text-rose-600 shadow-sm transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
              title={hasVagonEnProceso ? "No se puede cancelar con vagon en proceso" : "Cancelar arrastre"}
            >
              {busyAction === `${arrastre.id}:CANCELAR` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
              Cancelar
            </button>
          )}
          <button type="button" onClick={() => setExpanded((value) => !value)} className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 shadow-sm">
            {expanded ? "Ocultar" : "Ver detalle"}
          </button>
        </div>
      </div>

      {!expanded ? (
        <ArrastreSummary vagones={vagones} />
      ) : (
        <ArrastreDetail
          arrastre={arrastre}
          vagones={vagones}
          readOnly={readOnly}
          busyAction={busyAction}
          draft={draft}
          incidenteAbierto={incidenteAbierto}
          onDraftChange={onDraftChange}
          onFiles={onFiles}
          onAction={onAction}
          onEditVagon={onEditVagon}
        />
      )}
    </article>
  );
}

function ArrastreSummary({ vagones }: { vagones: VagonArrastre[] }) {
  return (
    <div className="grid gap-2 px-4 py-3 text-xs font-semibold text-slate-500 sm:grid-cols-4">
      <span>Pendientes {vagones.filter((vagon) => statusText(vagon.estado) === "PENDIENTE").length}</span>
      <span>Proceso {vagones.filter((vagon) => statusText(vagon.estado) === "EN_PROCESO").length}</span>
      <span>Bloqueados {vagones.filter((vagon) => statusText(vagon.estado) === "BLOQUEADO").length}</span>
      <span>Concluidos {vagones.filter((vagon) => statusText(vagon.estado) === "CONCLUIDO").length}</span>
    </div>
  );
}

function ArrastreDetail({
  arrastre,
  vagones,
  readOnly,
  busyAction,
  draft,
  incidenteAbierto,
  onDraftChange,
  onFiles,
  onAction,
  onEditVagon,
}: {
  arrastre: Arrastre;
  vagones: VagonArrastre[];
  readOnly?: boolean;
  busyAction: string | null;
  draft: IncidentDraft;
  incidenteAbierto: ReturnType<typeof getOpenIncident>;
  onDraftChange: (draft: IncidentDraft) => void;
  onFiles: (event: ChangeEvent<HTMLInputElement>) => void;
  onAction: (payload: ActionPayload) => void;
  onEditVagon: (arrastre: Arrastre, vagon: VagonArrastre) => void;
}) {
  return (
    <div className="px-4 py-4">
      <div className="overflow-x-auto">
        <table className="min-w-[920px] w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
            <tr>
              <th className="py-2 pr-3">Vagon</th>
              <th className="py-2 pr-3">Carga</th>
              <th className="py-2 pr-3">Zona</th>
              <th className="py-2 pr-3">Estado</th>
              <th className="py-2 pr-3">Inicio</th>
              <th className="py-2 pr-3">Fin</th>
              <th className="py-2 pr-3">Operacion</th>
              {!readOnly && <th className="py-2 pr-3">Accion</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {vagones.map((vagon) => (
              <ArrastreVagonRow
                key={vagon.id}
                arrastre={arrastre}
                vagon={vagon}
                readOnly={readOnly}
                busyAction={busyAction}
                onEditVagon={onEditVagon}
              />
            ))}
          </tbody>
        </table>
      </div>

      {!readOnly && (
        <IncidentEditor
          arrastre={arrastre}
          vagones={vagones}
          draft={draft}
          busyAction={busyAction}
          incidenteAbierto={incidenteAbierto}
          onDraftChange={onDraftChange}
          onFiles={onFiles}
          onAction={onAction}
        />
      )}
    </div>
  );
}

function ArrastreVagonRow({
  arrastre,
  vagon,
  readOnly,
  busyAction,
  onEditVagon,
}: {
  arrastre: Arrastre;
  vagon: VagonArrastre;
  readOnly?: boolean;
  busyAction: string | null;
  onEditVagon: (arrastre: Arrastre, vagon: VagonArrastre) => void;
}) {
  const estado = statusText(vagon.estado);
  const isBusy = busyAction === `edit:${arrastre.id}:${vagon.id}`;
  const canEditVagon = estado !== "EN_PROCESO";

  return (
    <tr>
      <td className="py-2 pr-3 font-medium text-slate-900">{vagon.numeroVagon || `#${vagon.orden}`}</td>
      <td className="py-2 pr-3 text-slate-700">{vagon.carga}</td>
      <td className="py-2 pr-3 text-slate-700">Via {vagon.viaId} / Seccion {vagon.seccionId}</td>
      <td className="py-2 pr-3"><EstadoBadge estado={vagon.estado} /></td>
      <td className="py-2 pr-3 text-slate-600">{fmtDate(vagon.fechaInicio)}</td>
      <td className="py-2 pr-3 text-slate-600">{fmtDate(vagon.fechaFin)}</td>
      <td className="py-2 pr-3 text-slate-600">{fmtMinutes(vagon.metricas?.operacionMin)}</td>
      {!readOnly && (
        <td className="py-2 pr-3">
          {canEditVagon ? (
            <button
              type="button"
              disabled={isBusy}
              onClick={() => onEditVagon(arrastre, vagon)}
              className="inline-flex h-9 min-w-[92px] items-center justify-center gap-1 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Pencil className="h-3.5 w-3.5" />Editar</>}
            </button>
          ) : (
            <span className="text-xs font-semibold text-slate-500">En proceso</span>
          )}
        </td>
      )}
    </tr>
  );
}

function IncidentEditor({
  arrastre,
  vagones,
  draft,
  busyAction,
  incidenteAbierto,
  onDraftChange,
  onFiles,
  onAction,
}: {
  arrastre: Arrastre;
  vagones: VagonArrastre[];
  draft: IncidentDraft;
  busyAction: string | null;
  incidenteAbierto: ReturnType<typeof getOpenIncident>;
  onDraftChange: (draft: IncidentDraft) => void;
  onFiles: (event: ChangeEvent<HTMLInputElement>) => void;
  onAction: (payload: ActionPayload) => void;
}) {
  return (
    <div className="mt-4 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
      {incidenteAbierto ? (
        <ResolveIncident arrastre={arrastre} draft={draft} busyAction={busyAction} incidenteAbierto={incidenteAbierto} onDraftChange={onDraftChange} onAction={onAction} />
      ) : (
        <CreateIncident arrastre={arrastre} vagones={vagones} draft={draft} busyAction={busyAction} onDraftChange={onDraftChange} onFiles={onFiles} onAction={onAction} />
      )}
    </div>
  );
}

function ResolveIncident({
  arrastre,
  draft,
  busyAction,
  incidenteAbierto,
  onDraftChange,
  onAction,
}: {
  arrastre: Arrastre;
  draft: IncidentDraft;
  busyAction: string | null;
  incidenteAbierto: NonNullable<ReturnType<typeof getOpenIncident>>;
  onDraftChange: (draft: IncidentDraft) => void;
  onAction: (payload: ActionPayload) => void;
}) {
  return (
    <>
      <div className="lg:col-span-2">
        <p className="text-xs font-semibold uppercase text-amber-700">Incidente abierto</p>
        <p className="mt-1 text-sm text-slate-700">{incidenteAbierto.motivo || "Sin motivo capturado"}</p>
      </div>
      <div className="flex min-w-[240px] flex-col gap-2">
        <input value={draft.solucion} onChange={(event) => onDraftChange({ ...draft, solucion: event.target.value })} className={fieldClass()} placeholder="Resolucion" />
        <button
          type="button"
          disabled={busyAction === `incidente:${arrastre.id}` || draft.solucion.trim().length < 3}
          onClick={() => onAction({
            action: "RESOLVER_INCIDENTE",
            arrastreId: arrastre.id,
            incidenteId: incidenteAbierto.id,
            solucion: draft.solucion,
          })}
          className="inline-flex h-10 items-center justify-center rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busyAction === `incidente:${arrastre.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : "Resolver y reanudar"}
        </button>
      </div>
    </>
  );
}

function CreateIncident({
  arrastre,
  vagones,
  draft,
  busyAction,
  onDraftChange,
  onFiles,
  onAction,
}: {
  arrastre: Arrastre;
  vagones: VagonArrastre[];
  draft: IncidentDraft;
  busyAction: string | null;
  onDraftChange: (draft: IncidentDraft) => void;
  onFiles: (event: ChangeEvent<HTMLInputElement>) => void;
  onAction: (payload: ActionPayload) => void;
}) {
  return (
    <>
      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-600">Incidente</label>
        <input value={draft.motivo} onChange={(event) => onDraftChange({ ...draft, motivo: event.target.value })} className={fieldClass()} placeholder="Motivo" />
      </div>
      <div className="grid gap-2 sm:grid-cols-[180px_1fr]">
        <select value={draft.vagonId} onChange={(event) => onDraftChange({ ...draft, vagonId: event.target.value })} className={fieldClass()}>
          <option value="">Zona general</option>
          {vagones.map((vagon) => (
            <option key={vagon.id} value={vagon.id}>
              {vagon.numeroVagon || `Vagon ${vagon.orden}`}
            </option>
          ))}
        </select>
        <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700">
          <Upload className="h-4 w-4" />
          4 fotos ({draft.fotos.length}/4)
          <input type="file" accept="image/*" multiple className="hidden" onChange={onFiles} />
        </label>
      </div>
      <button
        type="button"
        disabled={busyAction === `incidente:${arrastre.id}` || draft.motivo.trim().length < 3 || draft.fotos.length !== 4}
        onClick={() => onAction({
          action: "CREAR_INCIDENTE",
          arrastreId: arrastre.id,
          vagonId: draft.vagonId ? Number(draft.vagonId) : undefined,
          motivo: draft.motivo,
          fotos: draft.fotos.map((foto) => ({ dataUrl: foto.dataUrl })),
        })}
        className="inline-flex h-10 items-center justify-center rounded-lg bg-amber-600 px-3 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busyAction === `incidente:${arrastre.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : "Detener por incidente"}
      </button>
    </>
  );
}
